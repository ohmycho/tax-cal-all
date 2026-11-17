// 세무사 검토용 "세금계산기 수정사항 vX.Y" PDF 만들기
// 사용: node tools/review/make_pdf.mjs v1.4  →  tools/review/out/세금계산기 수정사항 v1.4.pdf
// 내용은 tools/review/<버전>.json, 버전 이력은 CHANGELOG.md 표에서 읽는다.
import { chromium } from '../../tests/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(DIR, '../..');
const ver = process.argv[2]; const d = JSON.parse(fs.readFileSync(path.join(DIR, ver + '.json'), 'utf8'));
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const hist = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').split('\n')
  .filter(l => /^\| v\d/.test(l)).map(l => l.split('|').slice(1, -1).map(s => s.trim()));
const title = `세금계산기 수정사항 ${d.version}`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>
@page{size:A4;margin:16mm 14mm}
body{font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif;color:#191f28;font-size:10.5pt;line-height:1.6;margin:0}
h1{font-size:20pt;margin:0 0 4px} .sub{color:#6b7684;font-size:10pt;margin-bottom:18px}
.meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.meta span{background:#f2f4f6;border-radius:6px;padding:3px 9px;font-size:9.5pt;color:#4e5968}
.meta b{color:#3182f6}
h2{font-size:13pt;margin:22px 0 8px;padding-bottom:5px;border-bottom:2px solid #191f28}
table{width:100%;border-collapse:collapse;font-size:9.5pt}th{background:#f2f4f6;text-align:left;padding:6px 8px;color:#4e5968;font-weight:700}
td{padding:7px 8px;border-bottom:1px solid #e5e8eb;vertical-align:top}td.n{width:18px;color:#8b95a1}
table.chg td:nth-child(2),table.chg th:nth-child(2){width:56px;white-space:nowrap}table.chg td:nth-child(3),table.chg th:nth-child(3){width:130px}table.chg td:nth-child(4),table.chg th:nth-child(4){width:44px}
.tag{display:inline-block;border-radius:5px;padding:1px 7px;font-size:9pt;font-weight:700;background:#e8f3ff;color:#1b64da;white-space:nowrap}
.tag.no{background:#ffeeee;color:#d22030}.tag.q{background:#fff3e0;color:#e45600}
.q{border:1px solid #e5e8eb;border-radius:8px;padding:9px 12px;margin-bottom:8px;page-break-inside:avoid}
.q b{color:#3182f6}.ans{margin-top:6px;color:#8b95a1;border-top:1px dashed #d1d6db;padding-top:6px;min-height:30px}
.note{background:#f9fafb;border-radius:8px;padding:10px 12px;color:#4e5968;margin-top:14px}
.hist td:first-child{font-weight:700;white-space:nowrap}.hist tr.cur td{background:#e8f3ff}
footer{margin-top:20px;color:#8b95a1;font-size:8.5pt}
</style></head><body>
<h1>${title}</h1>
<div class="sub">부동산 세금계산기 (tax-cal-all.netlify.app) · 세무사 검토용</div>
<div class="meta"><span>버전 <b>${esc(d.version)}</b></span><span>배포 ${esc(d.date)}</span><span>세법 기준일 ${esc(d.lawDate)}</span><span>커밋 ${esc(d.commit)}</span></div>
<div class="note" style="margin:0 0 6px">검토 기준: ${esc(d.basis)}</div>
<h2>1. 반영 내용</h2>
<table class="chg"><tr><th></th><th>계산기</th><th>세무사 의견</th><th>판단</th><th>처리</th></tr>
${d.changes.map((c, i) => `<tr><td class="n">${i + 1}</td><td>${esc(c.calc)}</td><td>${esc(c.comment)}</td><td><span class="tag${/반박/.test(c.decision) ? ' no' : /질문|보류/.test(c.decision) ? ' q' : ''}">${esc(c.decision)}</span></td><td>${esc(c.action)}</td></tr>`).join('')}
</table>
${d.questions.length ? '<h2>2. 질문 (답 적어 주세요)</h2>' : ''}
${d.questions.map((q, i) => `<div class="q"><b>Q${i + 1}.</b> ${esc(q)}<div class="ans">답:</div></div>`).join('')}
${d.note ? `<div class="note">${esc(d.note)}</div>` : ''}
<h2>${d.questions.length ? 3 : 2}. 버전 기록</h2>
<table class="hist"><tr><th>버전</th><th>배포일</th><th>내용</th></tr>
${hist.map(r => `<tr class="${r[0] === d.version ? 'cur' : ''}"><td>${esc(r[0])}</td><td style="white-space:nowrap">${esc(r[1])}</td><td>${esc(r[3])}</td></tr>`).join('')}
</table>
<footer>화면 버전은 계산기 첫 화면, 각 계산기 오른쪽 위, 페이지 맨 아래에 표시됩니다.</footer>
</body></html>`;
const out = path.join(DIR, 'out'); fs.mkdirSync(out, { recursive: true });
const file = path.join(out, `${title}.pdf`);
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent(html, { waitUntil: 'load' }); await p.pdf({ path: file, format: 'A4', printBackground: true });
await b.close(); console.log(file);
