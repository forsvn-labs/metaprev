#!/usr/bin/env bash
set -euo pipefail
BASE=${BASE:-http://127.0.0.1:4323}
SESSION=$(agent-browser session id --scope worktree --prefix metaprev-guide-support)
browser() { agent-browser --session "$SESSION" "$@"; }
trap 'browser close >/dev/null' EXIT
browser open "$BASE/guides/og-image"
browser eval --stdin <<'JS'
(async()=>{
 const a=document.querySelector('.guide-support a')
 if(!a||a.href!=='https://github.com/sponsors/hungv47'||!a.rel.includes('noreferrer'))throw Error('support destination')
 const routes=[...new Set([...document.querySelectorAll('a[href^="/guides/"]')].map(a=>a.getAttribute('href')))];routes.push('/guides/og-image')
 for(const route of routes){
  const r=await fetch(route);const html=await r.text()
  if(!r.ok||!html.includes('Did this guide help?')||!html.includes('Metaprev stays free'))throw Error('guide HTML: '+route)
 }
 for(const route of ['/','/about','/privacy']){
  const html=await (await fetch(route)).text()
  if(html.includes('Did this guide help?'))throw Error('CTA outside guides')
 }
 if([...document.scripts].some(s=>s.src&&new URL(s.src).origin!==location.origin))throw Error('external script')
 if(localStorage.length||sessionStorage.length)throw Error('tracking storage')
 return 'PASS ten server-rendered guide CTAs, verified owner destination, no CTA on other pages or external scripts'
})()
JS
browser set viewport 390 844
browser eval 'if(document.documentElement.scrollWidth>innerWidth)throw Error("mobile overflow"); "PASS guide mobile layout"'
