import type { Report } from './types.ts'

function escapeHtml(s: string | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function host(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

const ICONS = {
  error: '✕',
  warn: '!',
  info: 'i',
} as const

export function renderHtml(report: Report): string {
  const m = report.meta
  const title = m.ogTitle ?? m.twitterTitle ?? m.title ?? '(no title)'
  const desc = m.ogDescription ?? m.twitterDescription ?? m.description ?? ''
  const image = m.ogImage ?? m.twitterImage
  const finalImageUrl = report.image?.resolved ?? image
  const siteName = m.ogSiteName ?? host(report.finalUrl)
  const pageHost = host(report.finalUrl)

  const issuesHtml = report.issues
    .map(
      (i) => `
      <li class="issue issue--${i.level}">
        <span class="issue__icon">${ICONS[i.level]}</span>
        <span class="issue__field">${escapeHtml(i.field)}</span>
        <span class="issue__msg">${escapeHtml(i.message)}</span>
      </li>`,
    )
    .join('')

  const safeImg = finalImageUrl ? escapeHtml(finalImageUrl) : ''
  const titleEsc = escapeHtml(title)
  const descEsc = escapeHtml(desc)
  const sourceEsc = escapeHtml(report.source)
  const finalUrlEsc = escapeHtml(report.finalUrl)
  const siteEsc = escapeHtml(siteName)
  const hostEsc = escapeHtml(pageHost.toUpperCase())

  const summary = summaryLine(report)
  const copyPayloads = buildCopyPayloads(report)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>metaprev — ${titleEsc}</title>
<style>
  :root {
    --bg: #f6f6f3;
    --card: #ffffff;
    --ink: #111111;
    --muted: #5d5d5d;
    --rule: #e2e2dd;
    --link: #1d72ed;
    --error: #c53030;
    --warn: #b8860b;
    --info: #4a5568;
    --ok: #1f8055;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    line-height: 1.4;
    padding: 32px 28px 64px;
  }
  header {
    max-width: 1100px;
    margin: 0 auto 24px;
  }
  header h1 {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 6px;
    color: var(--muted);
  }
  header .source {
    font-size: 22px;
    font-weight: 500;
    word-break: break-all;
  }
  header .source a { color: var(--ink); }
  header .summary {
    margin-top: 12px;
    font-size: 13px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  main {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    gap: 32px;
  }
  .row {
    display: grid;
    gap: 24px;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }
  .panel {
    background: var(--card);
    border: 1px solid var(--rule);
    border-radius: 12px;
    padding: 20px;
  }
  .panel h2 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    margin: 0 0 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .copy-btn {
    font: inherit;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
    background: transparent;
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 4px 10px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .copy-btn:hover {
    background: var(--ink);
    color: #fff;
    border-color: var(--ink);
  }
  .copy-btn[data-state="copied"] {
    background: var(--ok);
    color: #fff;
    border-color: var(--ok);
  }

  /* Card mocks */
  .card {
    border: 1px solid var(--rule);
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
  }
  .card__img {
    aspect-ratio: 1.91 / 1;
    background-color: #ececec;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    border-bottom: 1px solid var(--rule);
  }
  .card__body { padding: 12px 14px; }
  .card__host {
    font-size: 11px;
    text-transform: lowercase;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .card__title {
    font-weight: 600;
    font-size: 15px;
    margin: 0 0 4px;
    color: var(--ink);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .card__desc {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* Facebook variant */
  .card--fb .card__host { background: #f2f3f5; padding: 10px 14px; margin: 0; }
  .card--fb .card__body { padding-top: 6px; }

  /* X / Twitter variant */
  .card--x .card__img { border-radius: 0; }
  .card--x .card__body { font-family: "Helvetica Neue", Arial, sans-serif; }
  .card--x .card__host { order: 2; margin: 4px 0 0; font-size: 13px; }
  .card--x .card__body { display: flex; flex-direction: column; }
  .card--x .card__title { order: 0; }
  .card--x .card__desc { order: 1; }

  /* LinkedIn variant */
  .card--li .card__title { font-size: 14px; font-weight: 700; }
  .card--li .card__host { font-size: 12px; margin-top: 6px; }

  /* Discord variant */
  .card--dc {
    background: #2f3136;
    color: #dcddde;
    border: 1px solid #1f2024;
    border-left: 4px solid #5865f2;
    border-radius: 4px;
  }
  .card--dc .card__body { padding: 10px 14px 12px; }
  .card--dc .card__host { color: #b9bbbe; }
  .card--dc .card__title { color: #ffffff; font-weight: 600; font-size: 14px; }
  .card--dc .card__desc { color: #b9bbbe; font-size: 12px; }
  .card--dc .card__img { aspect-ratio: 1.91 / 1; max-width: 400px; margin: 8px 14px 12px; border: 1px solid #1f2024; border-radius: 4px; }

  .img-missing {
    aspect-ratio: 1.91 / 1;
    background: repeating-linear-gradient(45deg, #f1f1ee, #f1f1ee 8px, #e9e9e4 8px, #e9e9e4 16px);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  /* Issues + facts */
  .issues { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .issue {
    display: grid;
    grid-template-columns: 24px 90px 1fr;
    gap: 10px;
    align-items: start;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13px;
  }
  .issue--error { background: #fdecec; color: var(--error); }
  .issue--warn  { background: #fdf6df; color: var(--warn); }
  .issue--info  { background: #eef2f7; color: var(--info); }
  .issue__icon {
    font-weight: 700;
    text-align: center;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    line-height: 20px;
    background: rgba(0,0,0,0.06);
  }
  .issue__field { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; opacity: 0.85; }

  .facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 13px; }
  .facts li { display: grid; grid-template-columns: 130px 1fr; gap: 12px; padding: 6px 0; border-bottom: 1px dashed var(--rule); }
  .facts li:last-child { border-bottom: 0; }
  .facts strong { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; color: var(--muted); font-weight: 500; }
  .facts span { word-break: break-word; }
  .count { font-variant-numeric: tabular-nums; color: var(--muted); }

  footer {
    max-width: 1100px;
    margin: 32px auto 0;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }
  footer code { background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <header>
    <h1>OpenGraph preview</h1>
    <div class="source"><a href="${finalUrlEsc}">${finalUrlEsc}</a></div>
    <div class="summary">${summary}</div>
  </header>

  <main>
    <section class="row">
      ${cardMock('Facebook', 'fb', { hostEsc, titleEsc, descEsc, safeImg, siteEsc })}
      ${cardMock('X (Twitter)', 'x', { hostEsc, titleEsc, descEsc, safeImg, siteEsc })}
      ${cardMock('LinkedIn', 'li', { hostEsc, titleEsc, descEsc, safeImg, siteEsc })}
      ${cardMock('Discord / Slack', 'dc', { hostEsc, titleEsc, descEsc, safeImg, siteEsc })}
    </section>

    <section class="row">
      <div class="panel">
        <h2>
          <span>Issues (${report.issues.length})</span>
          ${
            report.issues.length === 0
              ? ''
              : `<button class="copy-btn" data-copy-target="issues">Copy</button>`
          }
        </h2>
        ${
          report.issues.length === 0
            ? '<p style="color: var(--ok); font-size: 13px; margin: 0;">No issues — your card is clean.</p>'
            : `<ul class="issues">${issuesHtml}</ul>`
        }
      </div>
      <div class="panel">
        <h2>Facts</h2>
        <ul class="facts">
          ${factRow('Source', sourceEsc)}
          ${factRow('Final URL', finalUrlEsc)}
          ${factRow('HTTP', String(report.status))}
          ${factRow('og:title', titleEsc, count(title))}
          ${factRow('og:description', descEsc, count(desc))}
          ${factRow('og:image', safeImg || '(none)')}
          ${factRow('Image dims', report.image?.width && report.image?.height ? `${report.image.width}×${report.image.height}px` : report.image?.error ? `Failed: ${escapeHtml(report.image.error)}` : '(unknown)')}
          ${factRow('Image bytes', report.image?.byteLength ? formatBytes(report.image.byteLength) : '(unknown)')}
          ${factRow('twitter:card', escapeHtml(m.twitterCard) || '(none)')}
          ${factRow('og:site_name', escapeHtml(m.ogSiteName) || '(none)')}
          ${factRow('Canonical', escapeHtml(m.canonical ?? m.ogUrl) || '(none)')}
        </ul>
      </div>
    </section>
  </main>

  <footer>
    Rendered by <code>metaprev</code> at ${escapeHtml(report.fetchedAt)}.
  </footer>

  <script id="metaprev-copy" type="application/json">${escapeForScriptJson(copyPayloads)}</script>
  <script>
    (function () {
      var node = document.getElementById('metaprev-copy');
      if (!node) return;
      var payloads;
      try { payloads = JSON.parse(node.textContent || '{}'); } catch (e) { return; }
      document.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest && event.target.closest('.copy-btn');
        if (!btn) return;
        var key = btn.getAttribute('data-copy-target');
        var text = key && payloads[key];
        if (!text) return;
        var done = function () {
          var original = btn.textContent;
          btn.setAttribute('data-state', 'copied');
          btn.textContent = 'Copied';
          setTimeout(function () {
            btn.removeAttribute('data-state');
            btn.textContent = original;
          }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
        } else {
          fallback(text, done);
        }
      });
      function fallback(text, done) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {} finally { document.body.removeChild(ta); }
      }
    })();
  </script>
</body>
</html>`
}

function cardMock(
  label: string,
  variant: 'fb' | 'x' | 'li' | 'dc',
  parts: { hostEsc: string; titleEsc: string; descEsc: string; safeImg: string; siteEsc: string },
): string {
  const imgBlock = parts.safeImg
    ? `<div class="card__img" style="background-image: url('${parts.safeImg}')"></div>`
    : `<div class="img-missing">No og:image</div>`

  if (variant === 'dc') {
    return `
    <div class="panel">
      <h2>${label}</h2>
      <div class="card card--dc">
        <div class="card__body">
          <div class="card__host">${parts.siteEsc}</div>
          <div class="card__title">${parts.titleEsc}</div>
          <div class="card__desc">${parts.descEsc}</div>
        </div>
        ${parts.safeImg ? `<div class="card__img" style="background-image: url('${parts.safeImg}')"></div>` : ''}
      </div>
    </div>`
  }

  return `
    <div class="panel">
      <h2>${label}</h2>
      <div class="card card--${variant}">
        ${variant === 'fb' ? `<div class="card__host">${parts.hostEsc}</div>` : ''}
        ${imgBlock}
        <div class="card__body">
          ${variant !== 'fb' ? `<div class="card__host">${parts.hostEsc}</div>` : ''}
          <div class="card__title">${parts.titleEsc}</div>
          <div class="card__desc">${parts.descEsc}</div>
        </div>
      </div>
    </div>`
}

function factRow(label: string, value: string, count?: string): string {
  return `<li><strong>${escapeHtml(label)}</strong><span>${value || '<em style="color:#aaa">(empty)</em>'}${count ? ` <span class="count">${count}</span>` : ''}</span></li>`
}

function count(s: string | undefined): string {
  if (!s) return ''
  return `· ${s.length} chars`
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function summaryLine(report: Report): string {
  const errors = report.issues.filter((i) => i.level === 'error').length
  const warns = report.issues.filter((i) => i.level === 'warn').length
  const infos = report.issues.filter((i) => i.level === 'info').length
  return `${errors} error${errors === 1 ? '' : 's'} · ${warns} warning${warns === 1 ? '' : 's'} · ${infos} note${infos === 1 ? '' : 's'}`
}

function buildCopyPayloads(report: Report): Record<string, string> {
  if (report.issues.length === 0) return {}
  const header = `metaprev — ${report.finalUrl}\nfetched ${report.fetchedAt}\n\nIssues (${report.issues.length}):`
  const lines = report.issues.map((i) => `- [${i.level.toUpperCase()}] ${i.field}: ${i.message}`)
  return { issues: `${header}\n${lines.join('\n')}\n` }
}

// JSON inside <script> can't contain "</" sequences (browsers terminate the script tag),
// and "<!--" / "-->" can flip parsing into HTML comment mode. Neutralize all three.
function escapeForScriptJson(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .replace(/-->/g, '--\\>')
}
