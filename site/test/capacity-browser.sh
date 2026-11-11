#!/usr/bin/env bash
# Start bun site/test/capacity-fixture.ts first (fresh counters per run).
set -euo pipefail
SESSION=$(agent-browser session id --scope worktree --prefix metaprev-capacity-fixture)
browser() { agent-browser --session "$SESSION" "$@"; }
trap 'browser close >/dev/null' EXIT
browser open http://127.0.0.1:4337
browser set media light reduced-motion
browser eval --stdin <<'JS'
(async()=>{
 if(!document.querySelector('[data-preview-recovery]'))throw Error('missing explicit preview recovery')
 if(!document.body.textContent.includes('unavailable or expired'))throw Error('misleading expiry claim')
 if((await (await fetch('/counts')).json()).posts!==0)throw Error('automatic refetch')
 return 'PASS unavailable image retains report and never automatically refetches'
})()
JS
browser click '[data-preview-recovery] button'
browser eval 'if(document.activeElement?.name!=="url") throw Error("recovery did not focus URL"); "PASS explicit recovery focuses existing URL"'
for expected in 'Wait a minute' 'temporarily unavailable'; do
 browser click '[data-submit]'
 browser wait --fn 'document.querySelector("[data-error]").hidden === false'
 browser get text '[data-error-text]' | grep -F "$expected"
 browser eval 'if(document.querySelector("[data-results]").getAttribute("aria-busy")!=="false" || !document.querySelector("[data-results-content]"))throw Error("lost report or busy state"); "PASS non-JSON capacity failure keeps report and permits retry"'
done
browser click '[data-submit]'
browser wait --fn 'document.querySelector("[data-error]").hidden && document.querySelector("[data-results]").getAttribute("aria-busy")==="false"'
browser eval --stdin <<'JS'
(async()=>{
 if((await (await fetch('/counts')).json()).posts!==3)throw Error('unexpected retry count')
 if(document.querySelector('[data-preview-recovery]'))throw Error('stale recovery notice')
 if(localStorage.length||sessionStorage.length)throw Error('stored URL')
 if(document.querySelector('.guide-support'))throw Error('guide CTA leaked into report')
 return 'PASS manual retry replaces report, clears stale notice, stores no URL'
})()
JS
browser set viewport 390 844
browser eval 'if(document.documentElement.scrollWidth>innerWidth)throw Error("overflow"); "PASS mobile layout"'
