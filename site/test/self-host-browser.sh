#!/usr/bin/env bash
# Use the edge dev server, or BASE=https://metaprev.forsvn.com after deployment.
# Two rejected own-host requests and one example.com inspection; no load test.
set -euo pipefail
BASE=${BASE:-http://localhost:5173}
SESSION=$(agent-browser session id --scope worktree --prefix metaprev-self-host-check)
browser() { agent-browser --session "$SESSION" "$@"; }
trap 'browser close >/dev/null' EXIT
browser open "$BASE"
browser fill 'input[name="url"]' 'https://METAPREV.FORSVN.COM./?next=http://127.0.0.1'
browser click '[data-submit]'
browser wait --fn 'document.querySelector("[data-error]").textContent.includes("cannot inspect its own hosted pages")'
browser eval 'if(document.querySelector("[data-results]").getAttribute("aria-busy")!=="false") throw Error("busy after failure"); "PASS explicit self-host failure releases form"'
browser set viewport 390 844
browser eval 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
browser eval 'if(document.documentElement.scrollWidth>innerWidth) throw Error("overflow"); "PASS mobile recovery message"'
browser eval --stdin <<'JS'
(async()=>{
 const response=await fetch('/inspect',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'url=https%3A%2F%2Fmetaprev.forsvn.com'})
 const html=await response.text()
 if(response.status!==422 || !html.includes('cannot inspect its own hosted pages') || !response.headers.get('cache-control').includes('no-store') || !response.headers.get('x-robots-tag').includes('noindex'))throw Error('private form failure')
 return 'PASS no-JS form has private explicit rejection'
})()
JS
browser fill 'input[name="url"]' https://example.com
browser click '[data-submit]'
browser wait --fn 'document.querySelector("[data-results-content]") !== null && document.querySelector("[data-results]").getAttribute("aria-busy") === "false"'
browser eval 'if(!document.body.textContent.includes("Example Domain") || !document.querySelector("[data-error]").hidden) throw Error("correction failed"); if(localStorage.length || sessionStorage.length)throw Error("stored URL"); "PASS correction to external target and no browser storage"'
