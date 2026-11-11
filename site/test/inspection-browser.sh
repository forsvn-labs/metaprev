#!/usr/bin/env bash
# Start `bun site/server.ts` first. Uses an isolated session and a real public
# example.com fetch. No accounts, secrets, external writes, or saved URL history.
set -euo pipefail
BASE=${BASE:-http://127.0.0.1:4323}
SESSION=$(agent-browser session id --scope worktree --prefix metaprev-bounds-test)
browser() { agent-browser --session "$SESSION" "$@"; }
trap 'browser close >/dev/null' EXIT
browser open "$BASE"
browser fill 'input[name="url"]' http://127.0.0.1
browser click '[data-submit]'
browser wait --fn 'document.querySelector("[data-error]").hidden === false'
browser eval 'if(document.querySelector("[data-results]").getAttribute("aria-busy")!=="false") throw Error("busy after error"); "PASS unsafe input releases form"'
browser fill 'input[name="url"]' https://example.com
browser click '[data-submit]'
browser click '[data-submit]'
browser wait --fn 'document.querySelector("[data-results-content]") !== null'
browser eval 'if(!document.body.textContent.includes("Example Domain")) throw Error("missing public report"); if(!document.querySelector("[data-error]").hidden) throw Error("stale error"); "PASS retry and repeated submit"'
browser click '[data-tab="x"]'
browser eval 'if(document.querySelector("[role=tab][aria-selected=true]").textContent.trim()!=="X") throw Error("tab"); "PASS platform tab"'
browser click '[data-copy="json"]'
browser wait --fn 'document.querySelector("[data-copy=json]").getAttribute("data-state") === "copied"'
browser eval 'if(localStorage.length || sessionStorage.length) throw Error("stored user data"); if(!document.querySelector("a[href=\"https://github.com/sponsors/hungv47\"]")) throw Error("support missing"); if(document.documentElement.scrollWidth>innerWidth) throw Error("overflow"); "PASS copy, privacy, support, desktop layout"'
browser set viewport 390 844
browser eval 'if(document.documentElement.scrollWidth>innerWidth) throw Error("mobile overflow"); "PASS mobile layout"'
browser eval --stdin <<'JS'
(async () => {
 const response = await fetch('/inspect', {method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'url=https%3A%2F%2Fexample.com'})
 const html = await response.text()
 if(!response.ok || !html.includes('Example Domain') || !response.headers.get('cache-control').includes('no-store') || !response.headers.get('x-robots-tag').includes('noindex')) throw Error('HTML form contract')
 return 'PASS server-rendered form and private response headers'
})()
JS
