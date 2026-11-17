// 세금 계산기 회귀 테스트
// 각 계산기 HTML을 실제 브라우저(Chromium)로 열어, 페이지 안의 계산 함수를 직접 호출해 정답과 비교한다.
// 정답은 법정 산식으로 손계산해 검증한 값이다 (확인 기준일 2026-11-16).
//
// 실행:  cd tests && npm install && npx playwright install chromium && npm test
// 계산 로직을 고치면 반드시 이 테스트를 돌리고, 법이 바뀌어 정답이 달라지면 근거와 함께 정답을 고친다.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let browser;
const errors = [];

async function open(file) {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  page.on('pageerror', e => errors.push(`${file}: ${e.message}`));
  await page.goto(pathToFileURL(path.join(ROOT, file)).href);
  await page.waitForTimeout(200);
  return page;
}

before(async () => { browser = await chromium.launch(); });
after(async () => {
  await browser.close();
  assert.deepEqual(errors, [], '페이지 스크립트 오류가 없어야 함');
});

// ───────────────────────── 취득세 (acquisition.html)
test('취득세: 지방세법 제11조·제13조의2', async () => {
  const p = await open('acquisition.html');
  const acq = (mw, house, region, opts = {}) => p.evaluate(([mw, house, region, opts]) => {
    Object.assign(S, { buyer: 'individual', use: 'housing', house, region, tempTwo: false, hasExclude: false }, opts);
    return Math.round(mw * 10000 * getRates(mw).acq);
  }, [mw, house, region, opts]);

  assert.equal(await acq(60000, '1', 'normal'), 6_000_000, '6억 1주택 1%');
  // 지방세법 제11조①8호나목: ×1/100 한 세율을 넷째 자리로 반올림 → 7억 1.67%, 8억 2.33% (2026-11-17 정정)
  assert.equal(await acq(70000, '1', 'normal'), 11_690_000, '7억 1.67%');
  assert.equal(await acq(75000, '1', 'normal'), 15_000_000, '7.5억 2%');
  assert.equal(await acq(80000, '1', 'normal'), 18_640_000, '8억 2.33%');
  assert.equal(await acq(90000, '1', 'normal'), 27_000_000, '9억 3%');
  assert.equal(await acq(100000, '2', 'normal'), 30_000_000, '2주택 비조정 10억 3%');
  assert.equal(await acq(100000, '2', 'regulated'), 80_000_000, '2주택 조정 10억 8%');
  assert.equal(await acq(100000, '3', 'normal'), 80_000_000, '3주택 비조정 8%');
  assert.equal(await acq(100000, '3', 'regulated'), 120_000_000, '3주택 조정 12%');
  assert.equal(await acq(100000, '4', 'normal'), 120_000_000, '4주택 이상 12%');
  assert.equal(await acq(100000, '2', 'regulated', { tempTwo: true }), 30_000_000, '일시적 2주택 일반세율');

  const corp = await p.evaluate(() => {
    Object.assign(S, { buyer: 'corp', use: 'commercial', metro: 'metro', corpAge: 'under5' });
    const r = getRates(100000); return [r.acq, r.edu, r.farm];
  });
  assert.deepEqual(corp, [0.08, 0.012, 0.002], '법인 대도시 설립 5년 내: 8% + 교육세 1.2% + 농특세 0.2%');
});

// ───────────────────────── 양도세 주택 일반 (capital_gains_tax.html)
test('양도세(주택): 세율·장특공·중과·단기세율', async () => {
  const p = await open('capital_gains_tax.html');
  assert.equal(await p.evaluate(() => progTax(14e6)), 840_000, '과표 1,400만원 6%');
  assert.equal(await p.evaluate(() => progTax(1e8)), 19_560_000, '과표 1억: 35% − 1,544만');
  assert.equal(await p.evaluate(() => Math.round(progTax(12e8))), 474_060_000, '과표 12억: 45% − 6,594만');

  assert.equal(await p.evaluate(() => getHoldMonths('2024-03-15', '2026-03-14')), 23, '보유기간 일 단위');
  assert.equal(await p.evaluate(() => getHoldMonths('2024-03-15', '2026-03-15')), 24);

  const c = (args) => p.evaluate(a => { const r = calcCase(...a); return [Math.round(r.taxAmount), r.exempt]; }, args);
  // 1주택 고가(25억), 보유 11년·거주 11년 → 표2 80%
  assert.deepEqual(await c([15e8, 25e8, 142, 132, 1, true, true, '2026-11-01']), [38_390_000, false]);
  // 1주택 12억 이하 비과세
  assert.deepEqual(await c([3e8, 9e8, 60, 30, 1, false, false, '2026-12-01']), [0, true]);
  // 1주택, 취득 당시 조정·거주 2년 미만 → 과세, 표1 10%
  assert.deepEqual(await c([1e8, 5e8, 60, 10, 1, true, true, '2026-12-01']), [15_240_000, false]);
  // 1주택 1년 미만 → 70%
  assert.deepEqual(await c([1e8, 5e8, 8, 0, 1, false, false, '2026-12-01']), [68_250_000, false]);
  // 2주택, 양도 당시 조정, 2026.5.10 이후 → 중과 +20%p, 장특공 배제
  assert.deepEqual(await c([5e8, 9e8, 107, 0, 2, true, true, '2026-12-01']), [272_560_000, false]);
  // 같은 조건, 유예기간(2026.5.9 이전) 양도 → 기본세율 + 표1 16%
  assert.deepEqual(await c([5e8, 9e8, 98, 0, 2, true, true, '2026-03-01']), [141_060_000, false]);
  // 3주택 조정, 1년 6개월 → 단기 60%와 중과 중 큰 세액
  assert.deepEqual(await c([1e8, 9e8, 18, 0, 3, true, true, '2026-12-01']), [58_500_000, false]);
});

// ───────────────────────── 조정대상지역 판정 (3개 계산기 공통 데이터)
test('조정대상지역 판정: 2026.7.1 지정 및 상위 지역 이력 합산', async () => {
  const cases = [
    ['경기도 구리시', '2026-08-01', true],
    ['경기도 구리시', '2024-01-01', false],
    ['경기도 용인시 기흥구 보정동', '2026-08-01', true],
    ['경기도 용인시 기흥구 보정동', '2019-06-01', true],
    ['경기도 화성시 동탄구 목동', '2026-09-01', true],
    ['서울특별시 관악구', '2024-01-01', false],
    ['서울특별시 관악구', '2025-11-01', true],
    ['서울특별시 강남구', '2024-01-01', true],
  ];
  const p1 = await open('capital_gains_tax.html');
  const p2 = await open('capital_gains_zone_check.html');
  const p3 = await open('capital_gains_rebuild.html');
  for (const [region, date, want] of cases) {
    assert.equal(await p1.evaluate(([r, d]) => checkRegulated(r, d).isRegulated, [region, date]), want, `양도세 ${region} ${date}`);
    assert.equal(await p2.evaluate(([r, d]) => checkRegulatoryStatus(r, d).isRegulated, [region, date]), want, `진단 ${region} ${date}`);
    assert.equal(await p3.evaluate(([r, d]) => checkRegulated(r, d).isRegulated, [region, date]), want, `재건축 ${region} ${date}`);
  }
});

// ───────────────────────── 재건축·재개발 (capital_gains_rebuild.html)
test('재건축 양도세: 장특공·비과세 거주요건·단기세율', async () => {
  const p = await open('capital_gains_rebuild.html');
  assert.equal(await p.evaluate(() => table2Rate(2, 2)), 0, '보유 3년 미만 장특공 0');
  assert.equal(await p.evaluate(() => table2Rate(5, 3)), 0.32);
  assert.equal(await p.evaluate(() => table1Rate(5)), 0.10);
  const base = { oldAcquirePrice: 3e8, rightValue: 6e8, netAddPayment: 2e8, salePrice: 10e8, totalYears: 5, postApprovalYears: 3, totalLiveYears: 1, afterLiveYears: 0 };
  assert.equal(await p.evaluate(b => calculateReconstruction({ ...b, isRegulatedAcq: true }).isExempt, base), false, '취득 당시 조정·거주 1년 → 과세');
  assert.equal(await p.evaluate(b => calculateReconstruction({ ...b, isRegulatedAcq: false }).isExempt, base), true, '비조정 → 비과세');

  await p.evaluate(() => {
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    s('houseCount', '1'); s('salePrice', 50000); s('oldAcquirePrice', 30000);
    s('totalHoldYears', 1); s('totalHoldMonths', 6); s('totalLiveYears', 1); s('totalLiveMonths', 6);
    calculateTax();
  });
  assert.equal(await p.textContent('#capitalGainsTax'), '118,500,000원', '1년 6개월·차익 2억 → 단기 60%');
});

// ───────────────────────── 주택 외 (capital_gains_non_housing.html)
test('주택 외 양도세: 1년 미만 50%', async () => {
  const p = await open('capital_gains_non_housing.html');
  await p.evaluate(() => {
    const s = (id, v) => { document.getElementById(id).value = v; };
    s('acqY', 2025); s('acqM', 6); s('acqD', 1); s('trfY', 2026); s('trfM', 3); s('trfD', 1);
    s('acqPrice', '500,000,000'); s('trfPrice', '600,000,000'); s('expense', '0');
  });
  // 화면은 질문 넘기기 방식이라 원래 계산 버튼은 숨겨져 있음 → 직접 실행
  await p.evaluate(() => document.getElementById('calcBtn').click());
  assert.equal(await p.textContent('#r12'), '53,625,000원', '(1억 − 250만) × 50% × 1.1');
});

// ───────────────────────── 법인 (capital_gains_corporate.html)
test('법인 양도: 2026년 법인세율', async () => {
  const p = await open('capital_gains_corporate.html');
  assert.equal(await p.evaluate(() => calculateCorporateTax(5e8)), 80_000_000, '과표 5억: 20% − 2,000만');
  assert.equal(await p.evaluate(() => calculateCorporateTax(2e8)), 20_000_000, '과표 2억: 10%');
});

// ───────────────────────── 증여세 (gift.html) — 단위: 만원
test('증여세: 10년 합산·할증·신고세액공제', async () => {
  const p = await open('gift.html');
  const g = d => p.evaluate(d => calcGiftFromUserData(Object.assign({
    target: 'child', relation: 'lineal-down', isMinor: false, isGrand: false, isMarriage: false, priorMarriageDeduct: 0,
    debtAmount: 0, priorGift: 0, priorDeductUsed: null, onTime: true }, d)).finalTax, d);
  assert.equal(await g({ assetValue: 30000 }), 3880, '성인 자녀 3억');
  assert.equal(await g({ assetValue: 30000, priorGift: 10000 }), 5335, '10년 내 1억 합산');
  assert.equal(await g({ assetValue: 30000, priorGift: 10000, onTime: false }), 5500, '기한 내 미신고 → 공제 없음');
  assert.equal(await g({ assetValue: 30000, priorGift: 10000, priorDeductUsed: 0 }), 4850, '기사용 공제 0');
  assert.equal(await g({ target: 'grand', isGrand: true, assetValue: 30000 }), 5044, '손주 30% 할증');
  // 상증법 제53조의2: 10년 내 합산 증여에서 이미 받은 혼인·출산 공제(6천)는 합산 과세표준에서도 빼야 함
  // 이번 2억 + 과거 1.6억, 공제 = 기본 5천 + 이번 혼인 4천(1억−6천) + 과거 혼인 6천 = 1.5억 → 과표 2.1억 → 3,200만
  // 과거분: 1.6억 − 5천 − 6천 = 5천 → 500만 ⇒ 2,700만 − 신고공제 81만 = 2,619만
  assert.equal(await g({ assetValue: 20000, isMarriage: true, priorMarriageDeduct: 6000, priorMarriageInPrior: true, priorGift: 16000 }), 2619,
    '과거 혼인·출산 공제 사용분 반영');
});

// ───────────────────────── 상속세 (inheritance.html) — 단위: 만원
test('상속세: 공제 한도·배우자·금융·미성년·동거주택·취득세', async () => {
  const p = await open('inheritance.html');
  const run = (s, mode = 'legal') => p.evaluate(([s, mode]) => {
    Object.assign(S, { houses: [], nhouses: [], finance: 0, insurance: 0, general: 0, debt: 0, finDebt: 0, priorSpouse: 0,
      priorChildren: [], minorCount: 0, minorAges: [], hasCohouse: false, spouseHasHouse: false, cohouseQualifyIdx: [], heirNoHouse: null }, s);
    const r = computeInheritance(mode);
    return { deductLimit: r.deductLimit, spouseDeduct: Math.round(r.spouseDeduct), financeDeduct: r.financeDeduct, chosenLabel: r.chosenLabel,
      cohouseDeduct: r.cohouseDeduct, acquisitionTax: r.acquisitionTax, finalTax: r.finalTax };
  }, [s, mode]);

  assert.equal((await run({ hasSpouse: false, childCount: 1, general: 80000, priorChildren: [{ amount: 50000 }] })).deductLimit, 84500,
    '종합한도 = 과세가액 − 사전증여 과세표준');
  assert.equal((await run({ hasSpouse: true, childCount: 2, general: 200000, priorSpouse: 60000 })).spouseDeduct, 85500,
    '배우자 사전증여 과세표준 0이면 한도 감소 없음');
  assert.equal((await run({ hasSpouse: false, childCount: 1, finance: 50000, finDebt: 40000, debt: 40000 })).financeDeduct, 2000,
    '금융재산 − 금융채무');
  assert.match((await run({ hasSpouse: false, childCount: 3, minorCount: 2, minorAges: [3, 17], general: 300000 })).chosenLabel, /3억 3,000만원/,
    '자녀 1.5억 + 미성년 (16+2)×1천만');
  const house = (debt) => ({ hasSpouse: false, childCount: 1, houses: [{ name: 'A', value: 100000, securedDebt: debt }], hasCohouse: true, cohouseQualifyIdx: [0], debt });
  assert.equal((await run(house(30000))).cohouseDeduct, 60000, '주택 10억·담보 3억 → 6억');
  assert.equal((await run(house(60000))).cohouseDeduct, 40000, '주택 10억·담보 6억 → 4억');
  assert.equal((await run({ hasSpouse: true, childCount: 1, houses: [{ name: 'A', value: 50000 }], heirNoHouse: true })).acquisitionTax, 480, '1가구1주택 특례 0.96%');
  assert.equal((await run({ hasSpouse: true, childCount: 1, houses: [{ name: 'A', value: 50000 }], heirNoHouse: false })).acquisitionTax, 1580, '일반 3.16%');

  // 상속인 구성에 따라 결과가 달라져야 함 (15억: 주택 10억 + 금융 5억)
  const fam = s => run({ houses: [{ name: '아파트', value: 100000 }], finance: 50000, ...s });
  const onlyKids = await fam({ hasSpouse: false, childCount: 2 });
  const spouseOnly = await fam({ hasSpouse: true, childCount: 0 });
  const both = await fam({ hasSpouse: true, childCount: 2 });
  assert.equal(onlyKids.finalTax, 20224, '자녀만 2명');
  assert.equal(spouseOnly.finalTax, 0, '배우자 단독');
  assert.equal(both.finalTax, 3963, '배우자 + 자녀 2명');
});

// ───────────────────────── 질문 넘기기 화면 (TDSWizard) — 끝까지 눌러서 결과가 나오는지
test('질문 넘기기: 취득세 화면을 끝까지 진행하면 결과가 나온다', async () => {
  const p = await open('acquisition.html');
  for (const t of ['개인', '주택', '1주택', '조정대상지역이에요', '85㎡ 이하']) {
    await p.locator('.tds-choice', { hasText: t }).first().click();
    await p.waitForTimeout(250);
  }
  await p.fill('.tds-input', '70000');
  await p.click('#tds-next');
  await p.waitForTimeout(200);
  assert.equal(await p.locator('#tds-wiz').count(), 0, '질문 화면이 닫혀야 함');
  assert.match(await p.textContent('#r-total'), /1,285\.9만/, '7억 1주택 85㎡ 이하: 1,169만 + 교육세 116.9만');
  assert.ok(await p.locator('.law-ref').count() >= 3, '계산 줄마다 근거 조문');
});

test('질문 넘기기: 취득세 주택 수 제외·일시적 2주택 처분기한', async () => {
  const p = await open('acquisition.html');
  const pick = async t => { await p.locator('.tds-choice', { hasText: t }).first().click(); await p.waitForTimeout(250); };
  await pick('개인'); await pick('주택'); await pick('3주택');
  await pick('네');                       // 주택 수에서 빠지는 집 있음
  await pick('2주택');                    // 빼면 2채
  await pick('네');                       // 원래 집 팔 예정 (일시적 2주택)
  await pick('네, 조정대상지역이에요');     // 원래 집 조정
  await pick('조정대상지역이에요');         // 새 집 조정
  await p.fill('.tds-input', '2026-11-20'); await p.click('#tds-next'); await p.waitForTimeout(250);
  await pick('아니요');                   // 8.26까지 계약금 안 냄 → 2년
  await pick('85㎡ 이하');
  await p.fill('.tds-input', '70000'); await p.click('#tds-next'); await p.waitForTimeout(250);
  assert.match(await p.textContent('#r-total'), /1,285\.9만/, '제외 후 일시적 2주택 → 일반세율');
  const note = await p.textContent('#note-box');
  assert.match(note, /2년 안\(2028\.11\.20까지\)/, '양쪽 조정·10.1 이후 취득 → 2년');
  assert.match(note, /제28조의4/, '주택 수 제외 전제 안내');
});

// 상증법 제28조 증여세액공제: 수증자별로 따로 계산 (합쳐서 누진세율 적용하면 공제가 커져 상속세가 과소 표시됨)
// 배우자 7억 증여 → 과표 1억 → 1천만 / 자녀 3억 → 과표 2.5억 → 4천만 ⇒ 5천만 (합산 방식이면 3.5억 → 6천만)
test('상속세: 증여세액공제 수증자별·기한 내 신고 여부', async () => {
  const p = await open('inheritance.html');
  const run = (extra) => p.evaluate((extra) => {
    Object.assign(S, { houses: [], nhouses: [], finance: 0, insurance: 0, general: 300000, debt: 0, finDebt: 0,
      hasSpouse: true, childCount: 1, priorSpouse: 70000, priorSpouseTax: null, priorChildren: [{ amount: 30000, tax: null }],
      minorCount: 0, minorAges: [], hasCohouse: false, spouseHasHouse: false, cohouseQualifyIdx: [], heirNoHouse: null, onTime: true }, extra);
    const r = computeInheritance('legal');
    return { priorTaxPaid: r.priorTaxPaid, reportDeduct: r.reportDeduct, grossTax: r.grossTax, finalTax: r.finalTax };
  }, extra);
  const a = await run({});
  assert.equal(a.priorTaxPaid, 5000, '수증자별 산출세액 합 5천만');
  const b = await run({ priorSpouseTax: 900 });
  assert.equal(b.priorTaxPaid, 4900, '실제 낸 증여세를 입력하면 그 금액 사용');
  const c = await run({ onTime: false });
  assert.equal(c.reportDeduct, 0, '기한 내 신고 안 하면 신고세액공제 없음');
  assert.equal(c.finalTax, c.grossTax - c.priorTaxPaid);
});
