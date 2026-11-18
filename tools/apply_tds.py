#!/usr/bin/env python3
"""모든 계산기 HTML에 토스(TDS) 공통 스타일을 적용한다.

- 색: 토스 팔레트 밖의 색을 가장 가까운 TDS 색으로 바꾼다 (보라·남색 등 → 파랑 계열)
- 글꼴: Pretendard 하나로 통일, 굵기 800·900 → 700
- <!-- TDS:BEGIN --> ~ <!-- TDS:END --> 공통 블록을 </head> 앞에 넣는다 (다시 실행하면 교체)
여러 번 실행해도 결과가 같다. 공통 스타일을 바꿀 때는 이 파일의 BLOCK만 고치고 다시 실행한다.
사용: python3 tools/apply_tds.py
"""
import colorsys, glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 계산기 버전 ── 바꿀 때마다 여기만 올리고 CHANGELOG.md에 한 줄 적은 뒤 이 스크립트를 실행한다.
VERSION = 'v1.9.1'
VERSION_DATE = '2026.11.18'
LAW_DATE = '2026.11.16'   # 세법 확인 기준일 (CLAUDE.md '세법 기준'과 같게)

TDS = {
 'grey':  ['#ffffff','#f9fafb','#f2f4f6','#e5e8eb','#d1d6db','#b0b8c1','#8b95a1','#6b7684','#4e5968','#333d4b','#191f28'],
 'blue':  ['#e8f3ff','#c9e2ff','#90c2ff','#64a8ff','#4593fc','#3182f6','#2272eb','#1b64da','#1957c2','#194aa6'],
 'red':   ['#ffeeee','#ffd4d6','#feafb4','#fb8890','#f66570','#f04452','#e42939','#d22030','#bc1b2a','#a51926'],
 'orange':['#fff3e0','#ffe0b0','#ffcd80','#ffbd51','#ffa927','#fe9800','#fb8800','#f57800','#ed6700','#e45600'],
 'yellow':['#fff9e7','#ffefbf','#ffe69b','#ffdd78','#ffd158','#ffc342','#ffb331','#faa131','#ee8f11','#dd7d02'],
 'green': ['#f0faf6','#aeefd5','#76e4b8','#3fd599','#15c47e','#03b26c','#02a262','#029359','#028450','#027648'],
 'teal':  ['#edf8f8','#bce9e9','#89d8d8','#58c7c7','#30b6b6','#18a5a5','#109595','#0c8585','#0a7575','#076565'],
}
ALL = {c for v in TDS.values() for c in v}

def rgb(h):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c*2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def nearest(fam, c):
    r = rgb(c)
    return min(TDS[fam], key=lambda t: sum((a-b)**2 for a, b in zip(rgb(t), r)))

def family(c):
    r, g, b = (x/255 for x in rgb(c))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h *= 360
    if s < 0.18 or l > 0.97: return 'grey'
    if 20 <= h < 50 and l < 0.35: return 'grey'          # 갈색 글씨 → 회색 글씨
    if h < 12 or h >= 330: return 'red'
    if h < 38: return 'orange'
    if h < 58: return 'yellow'
    if h < 160: return 'green'
    if h < 190: return 'teal'
    return 'blue'                                          # 파랑·남색·보라 → 토스 파랑

OVERRIDE = {  # 자동 매핑보다 우선 (보라 강조색 → 토스 파랑 기본색 등)
    '#6b35cf':'#3182f6', '#4a1fa8':'#1b64da', '#1845d4':'#1b64da', '#6366f1':'#3182f6', '#4338ca':'#1b64da',
    '#1e3a5f':'#333d4b', '#1a3a6b':'#333d4b', '#0f172a':'#191f28',
    '#92400e':'#4e5968', '#8a5a00':'#4e5968', '#7a4f00':'#4e5968', '#5a4000':'#4e5968', '#795548':'#4e5968',
}

def map_hex(m):
    raw = m.group(0)
    if raw.lower() in OVERRIDE: return OVERRIDE[raw.lower()]
    c = raw.lower()
    full = '#' + ''.join(x*2 for x in c[1:]) if len(c) == 4 else c
    if full in ALL or full in ('#000000',): return raw
    return nearest(family(full), full)

RGBA_MAP = {'107,53,207': '49,130,246', '5,150,105': '3,178,108', '99,102,241': '49,130,246'}

BLOCK = r'''<!-- TDS:BEGIN (tools/apply_tds.py가 관리 — 직접 고치지 말 것) -->
<link rel="manifest" href="/manifest.webmanifest?v=2">
<link rel="icon" type="image/png" href="/favicon.png?v=2">
<link rel="apple-touch-icon" href="/icons/icon-180.png?v=2">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="세금계산기">
<meta name="theme-color" content="#ffffff">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<script>if(window.self!==window.top)document.documentElement.classList.add('embedded');</script>
<style id="tds-base">
:root{
  --tds-grey50:#f9fafb;--tds-grey100:#f2f4f6;--tds-grey200:#e5e8eb;--tds-grey300:#d1d6db;--tds-grey400:#b0b8c1;
  --tds-grey500:#8b95a1;--tds-grey600:#6b7684;--tds-grey700:#4e5968;--tds-grey800:#333d4b;--tds-grey900:#191f28;
  --tds-blue50:#e8f3ff;--tds-blue100:#c9e2ff;--tds-blue500:#3182f6;--tds-blue600:#2272eb;--tds-blue700:#1b64da;
  --tds-red500:#f04452;--tds-green500:#03b26c;--tds-orange500:#fe9800;
}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{font-family:Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',system-ui,sans-serif!important;
  -webkit-font-smoothing:antialiased;color:var(--tds-grey900);letter-spacing:-0.01em;word-break:keep-all}
button,input,select,textarea{font-family:inherit!important}
button,a,label,[onclick]{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
input::placeholder,textarea::placeholder{color:var(--tds-grey400)}

/* 선택 상자: 기본 모양 대신 토스식 화살표 */
select{-webkit-appearance:none;appearance:none;padding-right:40px!important;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b95a1' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")!important;
  background-repeat:no-repeat!important;background-position:right 14px center!important;background-size:18px!important}
/* 날짜 입력: 아이폰에서 높이가 줄지 않게 */
input[type=date],input[type=month]{-webkit-appearance:none;appearance:none;min-height:48px;display:block;text-align:left}
input[type=date]::-webkit-date-and-time-value{text-align:left}
input:focus,select:focus,textarea:focus{outline:none}

/* 주요 버튼 (Primary) */
.cta-btn,.btn-next,.btn-submit,.wiz-primary-btn,.submit-btn,.button,.consult-submit-btn,.btn-pdf,.modal-btn,.action-btn{
  min-height:56px;border-radius:16px!important;font-size:17px!important;font-weight:600!important;
  box-shadow:none!important;transform:none!important;letter-spacing:-0.01em}
.cta-btn:active,.btn-next:active,.btn-submit:active,.wiz-primary-btn:active,.submit-btn:active,.button:active,
.consult-submit-btn:active,.btn-pdf:active,.modal-btn:active{filter:brightness(.93)}
.cta-btn:disabled,.btn-next:disabled,.btn-submit:disabled,.wiz-primary-btn:disabled,.submit-btn:disabled,.button:disabled{opacity:.4}
/* 보조 버튼 (Secondary) */
.btn-back,.btn-restart-main,.btn-back-input,.btn-save-tmp{border-radius:16px!important;font-weight:600!important;box-shadow:none!important}

/* 화면 제목·설명 (토스 Title 26 / Body 15) */
.header h1,.header h2,.hero h1,.hero-title,.home-title,#landing-screen .header-title,.tds-title{
  font-size:26px!important;font-weight:700!important;line-height:1.38!important;letter-spacing:-0.02em!important;color:var(--tds-grey900)!important}
.header > p,.hero > p,.home-sub,.tds-sub{font-size:15px!important;line-height:1.6!important;color:var(--tds-grey600)!important}

/* 홈으로 (앱 안에서는 숨김 — 앱에 자체 상단바가 있음) */
.home-top-btn{display:inline-flex!important;align-items:center;gap:2px;height:44px;padding:0 6px 0 0!important;margin:0 0 4px -4px!important;
  background:none!important;border:0!important;cursor:pointer;font-size:15px!important;font-weight:600!important;color:var(--tds-grey700)!important}
.home-top-btn svg{width:22px!important;height:22px!important;fill:none!important;stroke:var(--tds-grey700)!important;stroke-width:2.2!important}
.home-top-btn:active{opacity:.6}
.embedded .home-top-btn{display:none!important}
</style>
<script>
/* 아이폰은 글자 16px 미만 입력창을 누르면 화면을 확대하고, 확대가 그대로 남아 레이아웃이 깨진다.
   16px보다 작은 입력창만 16px로 올린다 (큰 금액 입력창은 그대로). 나중에 생기는 입력창(AI 채팅 등)도 처리. */
(function(){
  var SEL='input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]),select,textarea';
  function fix(root){
    if(!root||!root.querySelectorAll) return;
    var list=root.matches&&root.matches(SEL)?[root]:[];
    list=list.concat([].slice.call(root.querySelectorAll(SEL)));
    list.forEach(function(el){ if(parseFloat(getComputedStyle(el).fontSize)<16) el.style.setProperty('font-size','16px','important'); });
  }
  function start(){
    fix(document);
    new MutationObserver(function(ms){ ms.forEach(function(m){ [].forEach.call(m.addedNodes,function(n){ if(n.nodeType===1) fix(n); }); }); })
      .observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
  /* 혹시 확대된 상태로 남으면 입력이 끝날 때 원래 배율로 되돌린다 */
  document.addEventListener('focusout',function(e){
    if(!e.target.matches||!e.target.matches(SEL)) return;
    var vp=document.querySelector('meta[name=viewport]'); if(!vp||!window.visualViewport||visualViewport.scale<=1.01) return;
    var c=vp.content; vp.content=c+', maximum-scale=1'; setTimeout(function(){ vp.content=c; },300);
  });
})();
</script>
<style>
/* 계산 단계별 법령 근거 표시 */
.law-ref,span.law-ref,strong .law-ref,.tax-box .law-ref,.summary-row .law-ref{display:block!important;flex-basis:100%;margin-top:3px!important;font-size:13px!important;line-height:1.5!important;color:var(--tds-grey500)!important;font-weight:500!important;letter-spacing:0!important;word-break:keep-all;text-align:left!important;white-space:normal!important}
.law-ref::before{content:'근거 ';color:var(--tds-blue500);font-weight:600}
.law-ref.inline{display:inline;margin:0 0 0 4px}
</style>
<script>
/* 계산 단계 옆에 붙이는 법령 근거. 사용: lawRef('소득세법 제104조①1호') */
/* 브라우저 alert 대신 토스식 토스트 (alert는 앱 안 iframe에서 화면을 멈추게 함) */
function tdsToast(msg){
  var el=document.getElementById('tds-toast');
  if(!el){ el=document.createElement('div'); el.id='tds-toast';
    el.style.cssText='position:fixed;left:50%;bottom:calc(32px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:calc(100% - 40px);width:max-content;background:rgba(25,31,40,.92);color:#fff;font-size:15px;font-weight:500;line-height:1.5;padding:13px 20px;border-radius:14px;z-index:99999;text-align:center;opacity:0;transition:opacity .2s;pointer-events:none;word-break:keep-all';
    document.body.appendChild(el); }
  el.textContent=String(msg); el.style.opacity='1';
  clearTimeout(el._t); el._t=setTimeout(function(){ el.style.opacity='0'; },2400);
}
function lawRef(t, inline){ return t ? '<span class="law-ref'+(inline?' inline':'')+'">'+t+'</span>' : ''; }
</script>
<!-- TDS:END -->
'''

VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'

WIZARD = open(os.path.join(ROOT, 'tools', 'tds_wizard.html'), encoding='utf-8').read().strip()
BLOCK = BLOCK.replace('<!-- TDS:END -->', WIZARD + '\n<!-- TDS:END -->')
BLOCK = BLOCK.replace('@@VERSION@@', VERSION).replace('@@VERSION_DATE@@', VERSION_DATE).replace('@@LAW_DATE@@', LAW_DATE)

def process(path):
    s = open(path, encoding='utf-8').read()
    o = s
    s = re.sub(r'<!-- TDS:BEGIN.*?<!-- TDS:END -->\n?', '', s, flags=re.S)
    # 예전 개별 embedded 처리 제거 (공통 블록이 대신함)
    s = s.replace("<script>if(window.self!==window.top)document.documentElement.classList.add('embedded');</script>\n", '')
    s = s.replace("<style>.embedded .home-top-btn{display:none!important}</style>\n", '')
    # 글꼴
    s = re.sub(r'<link[^>]*fonts\.googleapis\.com[^>]*>\s*', '', s)
    s = re.sub(r'<link[^>]*fonts\.gstatic\.com[^>]*>\s*', '', s)
    s = re.sub(r"\\?'Noto Sans KR\\?'", 'Pretendard', s)
    s = re.sub(r'"Noto Sans KR"', 'Pretendard', s)
    s = re.sub(r'font-weight:\s*(800|900)', 'font-weight:700', s)
    # 색
    s = re.sub(r'#[0-9a-fA-F]{6}\b|(?<=[:\s,(])#[0-9a-fA-F]{3}(?=[;\s,)!}\'"])', map_hex, s)
    for a, b in RGBA_MAP.items():
        s = re.sub(r'rgba\(\s*' + a.replace(',', r'\s*,\s*') + r'\s*,', 'rgba(' + b + ',', s)
    # viewport
    s = re.sub(r'<meta\s+name="viewport"[^>]*>', VIEWPORT, s, count=1)
    s = s.replace('</head>', BLOCK + '</head>', 1)
    # 페이지별 화면 코드 (tools/pages/<이름>.html) → </body> 앞
    s = re.sub(r'<!-- TDS:PAGE.*?<!-- /TDS:PAGE -->\n?', '', s, flags=re.S)
    pg = os.path.join(ROOT, 'tools', 'pages', os.path.basename(path))
    if os.path.exists(pg):
        part = open(pg, encoding='utf-8').read().strip()
        part = part.replace('@@RESULT_CSS@@', open(os.path.join(ROOT, 'tools', 'pages', '_template_result.css'), encoding='utf-8').read().strip())
        s = s.replace('</body>', '<!-- TDS:PAGE (tools/pages/' + os.path.basename(path) + ' — 직접 고치지 말 것) -->\n' + part + '\n<!-- /TDS:PAGE -->\n</body>', 1)
    if s != o:
        open(path, 'w', encoding='utf-8').write(s)
    return s != o

if __name__ == '__main__':
    for p in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        print(('updated ' if process(p) else 'same    ') + os.path.basename(p))
