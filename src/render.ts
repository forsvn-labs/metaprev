import { formatBytes } from './format.ts'
import type { Report } from './types.ts'

/*
 * The HTML preview is a self-contained, offline, single-file report. Design intent:
 *   register  product / tool (the report serves the data; it is not a marketing page)
 *   audience  developers verifying a share card before shipping
 *   tone      utilitarian-editorial — calm, precise, data-first
 *   scene     a dev glancing at the report in daylight / a bright editor → warm light
 *             "workbench" canvas, one terracotta accent that never collides with the
 *             platform brand colors, system sans + mono (zero font fetch, instant render)
 *
 * The platform card mocks are the product. They stay faithful to how each platform
 * actually renders an OpenGraph card in 2026 (X hides title text behind a domain
 * overlay; LinkedIn dropped the in-feed description; Discord auto-embeds have no color
 * bar) — fidelity is the feature, so that layer is reproduced, not reinterpreted.
 */

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

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

type Level = 'error' | 'warn' | 'info'

const ISSUE_ICONS: Record<Level, string> = {
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
}

// Brand glyphs used purely to label each platform mock (24×24, currentColor).
const MARKS = {
  fb: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07c0 6 4.39 10.97 10.13 11.87v-8.4H7.08v-3.47h3.05V9.43c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.4C19.62 23.04 24 18.07 24 12.07z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z"/></svg>`,
  li: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>`,
  dc: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.32 4.37A19.79 19.79 0 0 0 15.43 2.86a.07.07 0 0 0-.08.04c-.21.37-.44.86-.61 1.25a18.27 18.27 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04c-1.71.3-3.35.81-4.88 1.51a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .09-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.89a.08.08 0 0 0-.04.11c.36.69.78 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .04-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z"/></svg>`,
} as const

export function renderHtml(report: Report): string {
  const m = report.meta
  const title = m.ogTitle ?? m.twitterTitle ?? m.title ?? ''
  const desc = m.ogDescription ?? m.twitterDescription ?? m.description ?? ''
  const declaredImage = m.ogImage ?? m.twitterImage
  const pageHost = host(report.finalUrl)
  const siteName = m.ogSiteName || pageHost

  // Only the data URI we built and validated is allowed into the CSS url() context.
  // A failed probe must never put an attacker-controlled remote URL into inline CSS —
  // it falls back to the honest "didn't load" placeholder instead.
  const cssImage = report.image?.dataUri ? escapeHtml(report.image.dataUri) : ''
  const hasImage = cssImage !== ''
  const missingText = declaredImage ? 'Image failed to load' : 'No og:image'

  const errorCount = report.issues.filter((i) => i.level === 'error').length
  const warnCount = report.issues.filter((i) => i.level === 'warn').length
  const infoCount = report.issues.filter((i) => i.level === 'info').length
  const totalIssues = report.issues.length

  const verdict = errorCount > 0
    ? { kind: 'error', label: pluralize(errorCount, 'error') }
    : warnCount > 0
      ? { kind: 'warn', label: pluralize(warnCount, 'warning') }
      : infoCount > 0
        ? { kind: 'info', label: pluralize(infoCount, 'note') }
        : { kind: 'ok', label: 'All clear' }

  const card = {
    host: escapeHtml(pageHost),
    site: escapeHtml(siteName),
    title: escapeHtml(title || '(no title)'),
    desc: escapeHtml(desc),
    cssImage,
    hasImage,
    missingText,
  }

  const dims = report.image?.width && report.image?.height
    ? `${report.image.width} × ${report.image.height} px`
    : report.image?.error
      ? `Failed: ${report.image.error}`
      : undefined
  const ctype = report.image?.contentType?.split(';')[0]?.trim()
  const bytes = report.image?.byteLength != null ? formatBytes(report.image.byteLength) : undefined

  const issuesHtml = report.issues
    .map(
      (i) => `
        <li class="issue issue--${i.level}">
          <span class="issue__icon" aria-hidden="true">${ISSUE_ICONS[i.level as Level]}</span>
          <div class="issue__body">
            <span class="issue__field">${escapeHtml(i.field)}</span>
            <p class="issue__msg">${escapeHtml(i.message)}</p>
          </div>
        </li>`,
    )
    .join('')

  const finalUrlEsc = escapeHtml(report.finalUrl)
  const href = /^https?:\/\//i.test(report.finalUrl) ? finalUrlEsc : '#'

  // Single source of truth for the parsed-meta facts — rendered into the panel and
  // formatted into the "Copy" payload from the same list.
  const facts: Fact[] = [
    { key: 'source', value: report.source },
    { key: 'final url', value: report.finalUrl },
    { key: 'http', value: String(report.status) },
    { key: 'og:title', value: title || undefined, count: count(title) },
    { key: 'og:description', value: desc || undefined, count: count(desc) },
    { key: 'og:image', value: declaredImage },
    { key: 'image', value: dims },
    { key: 'type', value: ctype },
    { key: 'bytes', value: bytes },
    { key: 'twitter:card', value: m.twitterCard },
    { key: 'og:site_name', value: m.ogSiteName },
    { key: 'canonical', value: m.canonical ?? m.ogUrl },
  ]
  const copyPayloads = buildCopyPayloads(report, facts)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<meta name="color-scheme" content="light" />
<title>metaprev · ${escapeHtml(pageHost || title || 'preview')}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  html, body { margin: 0; padding: 0; }
  html, body { overflow-x: clip; }

  :root {
    /* Warm paper workbench, OKLCH, tinted toward 75° so no neutral is a dead gray. */
    --paper: oklch(97.6% 0.006 75);
    --surface: oklch(99.3% 0.004 80);
    --stage: oklch(94.4% 0.008 75);
    --stage-dark: oklch(26% 0.012 264);
    --ink: oklch(26% 0.012 65);
    --ink-2: oklch(46% 0.012 65);
    --ink-3: oklch(53% 0.01 65);
    --line: oklch(89% 0.008 75);
    --line-2: oklch(93.5% 0.006 75);

    --accent: oklch(57% 0.165 41);
    --accent-2: oklch(48% 0.155 39);
    --accent-wash: oklch(95.5% 0.03 50);

    --error: oklch(52% 0.19 27);
    --error-wash: oklch(96% 0.035 27);
    --error-line: oklch(86% 0.07 27);
    --warn: oklch(52% 0.11 64);
    --warn-wash: oklch(96.5% 0.05 80);
    --warn-line: oklch(86% 0.08 80);
    --info: oklch(52% 0.12 255);
    --info-wash: oklch(96.5% 0.025 255);
    --info-line: oklch(87% 0.05 255);
    --ok: oklch(50% 0.13 152);
    --ok-wash: oklch(96% 0.04 152);
    --ok-line: oklch(85% 0.08 152);

    --sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, 'Helvetica Neue', sans-serif;
    --mono: ui-monospace, 'SF Mono', 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace;

    --r-sm: 8px; --r-md: 12px; --r-lg: 18px;
    --shadow-card: 0 1px 2px oklch(26% 0.012 65 / 0.05), 0 6px 20px oklch(26% 0.012 65 / 0.06);
    --shadow-pop: 0 2px 6px oklch(26% 0.012 65 / 0.08), 0 14px 40px oklch(26% 0.012 65 / 0.10);
    --ease: cubic-bezier(0.22, 1, 0.36, 1);
  }

  body {
    background:
      radial-gradient(110% 60% at 50% -8%, var(--accent-wash) 0%, transparent 60%),
      var(--paper);
    background-attachment: fixed;
    color: var(--ink);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .wrap { width: 100%; max-width: 1120px; margin: 0 auto; padding-inline: 28px; }
  @media (max-width: 600px) { .wrap { padding-inline: 16px; } }

  h1, h2, h3 { margin: 0; font-weight: 600; letter-spacing: -0.01em; }
  a { color: inherit; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }

  @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  .rise { animation: rise 0.5s var(--ease) both; }

  /* ── Top bar ── */
  .topbar {
    position: sticky; top: 0; z-index: 20;
    background: oklch(97.6% 0.006 75 / 0.82);
    backdrop-filter: saturate(1.4) blur(10px);
    -webkit-backdrop-filter: saturate(1.4) blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .topbar__inner {
    display: flex; align-items: center; gap: 16px;
    padding-block: 14px; min-height: 60px;
  }
  .brand {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--mono); font-size: 13px; font-weight: 600;
    letter-spacing: -0.02em; color: var(--ink); flex-shrink: 0; white-space: nowrap;
  }
  .brand__dot {
    width: 9px; height: 9px; border-radius: 3px; background: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-wash);
  }
  .target {
    flex: 1; min-width: 0;
    font-family: var(--mono); font-size: 13px; color: var(--ink-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    text-decoration: none; padding: 4px 10px; border-radius: var(--r-sm);
    border: 1px solid transparent; transition: border-color 0.18s var(--ease), color 0.18s var(--ease);
  }
  .target:hover { color: var(--ink); border-color: var(--line); }
  .verdict {
    display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0;
    padding: 6px 13px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
    border: 1px solid transparent; white-space: nowrap;
  }
  .verdict__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .verdict--ok { color: var(--ok); background: var(--ok-wash); border-color: var(--ok-line); }
  .verdict--error { color: var(--error); background: var(--error-wash); border-color: var(--error-line); }
  .verdict--warn { color: var(--warn); background: var(--warn-wash); border-color: var(--warn-line); }
  .verdict--info { color: var(--info); background: var(--info-wash); border-color: var(--info-line); }
  .verdict--ok .verdict__dot { animation: pulse 2s var(--ease) infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

  /* ── Summary strip ── */
  .summary { padding-top: 30px; }
  .summary__title {
    font-size: clamp(22px, 4vw, 30px); line-height: 1.1; letter-spacing: -0.025em;
    color: var(--ink); max-width: 24ch;
  }
  .summary__title b { color: var(--accent-2); font-weight: 600; }
  .summary__meta {
    margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px 10px;
    font-family: var(--mono); font-size: 12px; color: var(--ink-2);
  }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px; background: var(--surface);
    border: 1px solid var(--line); font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .chip svg { width: 13px; height: 13px; opacity: 0.7; }
  .chip--error { color: var(--error); border-color: var(--error-line); background: var(--error-wash); }
  .chip--warn { color: var(--warn); border-color: var(--warn-line); background: var(--warn-wash); }
  .chip--info { color: var(--info); border-color: var(--info-line); background: var(--info-wash); }
  .chip--ok { color: var(--ok); border-color: var(--ok-line); background: var(--ok-wash); }
  .chip--muted { color: var(--ink-3); }

  main { flex: 1; padding-bottom: 56px; }

  /* ── Section heads ── */
  .section { margin-top: 40px; }
  .section__head {
    display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
    margin-bottom: 18px; flex-wrap: wrap;
  }
  .section__label {
    font-family: var(--mono); font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.14em; color: var(--ink-3);
  }

  /* ── Appearance toggle ── */
  .seg {
    display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px;
    background: var(--stage); border: 1px solid var(--line);
  }
  .seg__btn {
    font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
    color: var(--ink-2); background: transparent; border: 0; border-radius: 999px;
    padding: 5px 14px; display: inline-flex; align-items: center; gap: 6px;
    transition: color 0.18s var(--ease);
  }
  .seg__btn svg { width: 13px; height: 13px; }
  .seg__btn[aria-pressed="true"] {
    color: var(--ink); background: var(--surface); box-shadow: var(--shadow-card);
  }

  /* ── Card stage ── */
  .stage {
    border-radius: var(--r-lg); padding: 26px;
    background: var(--stage);
    border: 1px solid var(--line);
    transition: background 0.35s var(--ease), border-color 0.35s var(--ease);
  }
  .stage[data-appearance="dark"] { background: var(--stage-dark); border-color: oklch(34% 0.02 264); }
  .grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px;
  }
  @media (max-width: 760px) { .grid { grid-template-columns: minmax(0, 1fr); } }

  .card { min-width: 0; }
  .card__head {
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    color: var(--ink-2);
  }
  .stage[data-appearance="dark"] .card__head { color: oklch(78% 0.01 264); }
  .card__mark { width: 16px; height: 16px; flex-shrink: 0; }
  .card__name { font-size: 12.5px; font-weight: 600; letter-spacing: -0.01em; }
  .card__note {
    margin-left: auto; font-family: var(--mono); font-size: 10.5px;
    letter-spacing: 0.02em; color: var(--ink-3);
  }
  .stage[data-appearance="dark"] .card__note { color: oklch(58% 0.01 264); }

  /* shared mock image */
  .mock__img {
    background-color: oklch(90% 0.01 75);
    background-size: cover; background-position: center; background-repeat: no-repeat;
  }
  .mock__img--missing {
    display: flex; align-items: center; justify-content: center;
    background: repeating-linear-gradient(45deg, oklch(91% 0.01 75) 0 10px, oklch(93% 0.008 75) 10px 20px);
    color: var(--ink-3); font-family: var(--mono); font-size: 11px;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .mock__line-clamp { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }

  /* ── Facebook ── */
  .mock--fb {
    border-radius: 8px; overflow: hidden; border: 1px solid #dadde1; background: #fff;
    font-family: Helvetica, Arial, sans-serif;
  }
  .mock--fb .mock__img { aspect-ratio: 1.91/1; border-bottom: 1px solid #dadde1; }
  .mock--fb .mock__img--missing { aspect-ratio: 1.91/1; }
  .mock--fb .mock__body { background: #f2f3f5; padding: 10px 12px; }
  .mock--fb .mock__site { font-size: 12px; text-transform: uppercase; color: #606770; letter-spacing: 0.2px; }
  .mock--fb .mock__title { font-size: 16px; font-weight: 600; color: #050505; margin: 3px 0 0; line-height: 1.27; -webkit-line-clamp: 2; }
  .mock--fb .mock__desc { font-size: 13px; color: #606770; margin: 3px 0 0; line-height: 1.3; -webkit-line-clamp: 1; }
  [data-appearance="dark"] .mock--fb { background: #242526; border-color: #393a3b; }
  [data-appearance="dark"] .mock--fb .mock__img { border-bottom-color: #393a3b; }
  [data-appearance="dark"] .mock--fb .mock__body { background: #3a3b3c; }
  [data-appearance="dark"] .mock--fb .mock__site { color: #b0b3b8; }
  [data-appearance="dark"] .mock--fb .mock__title { color: #e4e6eb; }
  [data-appearance="dark"] .mock--fb .mock__desc { color: #b0b3b8; }

  /* ── X (summary_large_image): image + domain overlay only, no text below ── */
  .mock--x .mock__shot { position: relative; border-radius: 16px; overflow: hidden; border: 1px solid #cfd9de; }
  .mock--x .mock__img { aspect-ratio: 1.91/1; }
  .mock--x .mock__img--missing { aspect-ratio: 1.91/1; }
  .mock--x .mock__domain {
    position: absolute; left: 12px; bottom: 12px;
    background: rgba(0,0,0,0.65); color: #fff; font-family: system-ui, sans-serif;
    font-size: 12.5px; padding: 1px 7px; border-radius: 4px; max-width: calc(100% - 24px);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  [data-appearance="dark"] .mock--x .mock__shot { border-color: #2f3336; }
  /* X no-image fallback = compact summary card */
  .mock--x .mock__summary {
    border: 1px solid #cfd9de; border-radius: 16px; overflow: hidden;
    font-family: system-ui, sans-serif; background: #fff;
  }
  .mock--x .mock__summary .mock__body { padding: 12px 14px; }
  .mock--x .mock__summary .mock__site { font-size: 13px; color: #536471; }
  .mock--x .mock__summary .mock__title { font-size: 15px; font-weight: 700; color: #0f1419; margin: 2px 0 0; -webkit-line-clamp: 2; line-height: 1.3; }
  .mock--x .mock__summary .mock__desc { font-size: 14px; color: #536471; margin: 2px 0 0; -webkit-line-clamp: 2; line-height: 1.3; }
  [data-appearance="dark"] .mock--x .mock__summary { background: #16181c; border-color: #2f3336; }
  [data-appearance="dark"] .mock--x .mock__summary .mock__title { color: #e7e9ea; }
  [data-appearance="dark"] .mock--x .mock__summary .mock__site,
  [data-appearance="dark"] .mock--x .mock__summary .mock__desc { color: #71767b; }

  /* ── LinkedIn: image + heavy title + domain, no description ── */
  .mock--li { border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0; background: #fff; font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; }
  .mock--li .mock__img { aspect-ratio: 1.91/1; }
  .mock--li .mock__img--missing { aspect-ratio: 1.91/1; }
  .mock--li .mock__body { padding: 10px 12px; background: #fff; }
  .mock--li .mock__title { font-size: 14px; font-weight: 600; color: rgba(0,0,0,0.9); line-height: 1.29; -webkit-line-clamp: 2; }
  .mock--li .mock__site { font-size: 12px; color: rgba(0,0,0,0.6); margin-top: 4px; }
  [data-appearance="dark"] .mock--li { background: #1b1f23; border-color: #38434f; }
  [data-appearance="dark"] .mock--li .mock__body { background: #1b1f23; }
  [data-appearance="dark"] .mock--li .mock__title { color: rgba(255,255,255,0.9); }
  [data-appearance="dark"] .mock--li .mock__site { color: rgba(255,255,255,0.6); }

  /* ── Discord auto-embed (no color bar on OG unfurls) ── */
  .mock--dc { border-radius: 8px; overflow: hidden; background: #2b2d31; border: 1px solid #1e1f22; font-family: 'gg sans', system-ui, sans-serif; }
  .mock--dc .mock__body { padding: 12px 14px 8px; }
  .mock--dc .mock__site { font-size: 12px; color: #b5bac1; }
  .mock--dc .mock__title { font-size: 15px; font-weight: 600; color: #00a8fc; margin: 4px 0 0; line-height: 1.27; -webkit-line-clamp: 2; }
  .mock--dc .mock__desc { font-size: 13px; color: #dbdee1; margin: 5px 0 0; line-height: 1.38; -webkit-line-clamp: 3; }
  .mock--dc .mock__img { aspect-ratio: 1.91/1; margin: 12px 14px 14px; border-radius: 6px; max-width: 380px; }
  .mock--dc .mock__img--missing { aspect-ratio: 1.91/1; margin: 12px 14px 14px; border-radius: 6px; max-width: 380px; background: repeating-linear-gradient(45deg, #232529 0 10px, #2b2d31 10px 20px); color: #72767d; }
  [data-appearance="light"] .mock--dc { background: #ffffff; border-color: #e3e5e8; }
  [data-appearance="light"] .mock--dc .mock__site { color: #5c5e66; }
  [data-appearance="light"] .mock--dc .mock__title { color: #0067e0; }
  [data-appearance="light"] .mock--dc .mock__desc { color: #4e5058; }
  [data-appearance="light"] .mock--dc .mock__img--missing { background: repeating-linear-gradient(45deg, #e8eaed 0 10px, #f1f2f4 10px 20px); color: #8a8d93; }

  /* ── Detail panels ── */
  .panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; }
  @media (max-width: 760px) { .panels { grid-template-columns: minmax(0, 1fr); } }
  .panel {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--r-md); box-shadow: var(--shadow-card); overflow: hidden;
  }
  .panel__head {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 14px 16px; border-bottom: 1px solid var(--line-2);
  }
  .panel__title { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .panel__count {
    font-family: var(--mono); font-size: 11px; color: var(--ink-3);
    background: var(--stage); padding: 2px 7px; border-radius: 999px; font-weight: 600;
  }
  .panel__body { padding: 14px 16px; }

  .copy-btn {
    font: inherit; font-family: var(--mono); font-size: 11px; font-weight: 600;
    color: var(--ink-2); background: transparent; border: 1px solid var(--line);
    border-radius: var(--r-sm); padding: 4px 10px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 5px;
    transition: color 0.18s var(--ease), border-color 0.18s var(--ease), background 0.18s var(--ease);
  }
  .copy-btn svg { width: 12px; height: 12px; }
  .copy-btn:hover { color: var(--ink); border-color: var(--ink-3); }
  .copy-btn[data-state="copied"] { color: var(--ok); border-color: var(--ok-line); background: var(--ok-wash); }

  /* issues */
  .issues { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
  .issue {
    display: grid; grid-template-columns: 22px 1fr; gap: 11px; align-items: start;
    padding: 11px 13px; border-radius: var(--r-sm); border: 1px solid;
  }
  .issue--error { background: var(--error-wash); border-color: var(--error-line); }
  .issue--warn { background: var(--warn-wash); border-color: var(--warn-line); }
  .issue--info { background: var(--info-wash); border-color: var(--info-line); }
  .issue__icon { width: 20px; height: 20px; margin-top: 1px; }
  .issue__icon svg { width: 20px; height: 20px; }
  .issue--error .issue__icon { color: var(--error); }
  .issue--warn .issue__icon { color: var(--warn); }
  .issue--info .issue__icon { color: var(--info); }
  .issue__body { min-width: 0; }
  .issue__field { font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .issue--error .issue__field { color: var(--error); }
  .issue--warn .issue__field { color: var(--warn); }
  .issue--info .issue__field { color: var(--info); }
  .issue__msg { margin: 2px 0 0; font-size: 13px; line-height: 1.42; color: var(--ink); }

  .clean { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 26px 12px; color: var(--ok); }
  .clean svg { width: 30px; height: 30px; }
  .clean p { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--ink); }
  .clean span { font-size: 12.5px; color: var(--ink-2); font-weight: 400; }

  /* facts */
  .facts { margin: 0; }
  .fact {
    display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 14px;
    padding: 9px 0; border-bottom: 1px solid var(--line-2); align-items: baseline;
  }
  .fact:last-child { border-bottom: 0; }
  .fact:first-child { padding-top: 0; }
  .fact__key { font-family: var(--mono); font-size: 11px; color: var(--ink-3); font-weight: 600; }
  .fact__val { font-size: 13px; color: var(--ink); word-break: break-word; overflow-wrap: anywhere; min-width: 0; }
  .fact__val.is-empty { color: var(--ink-3); font-style: italic; }
  .fact__count { font-family: var(--mono); font-size: 11px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
  @media (max-width: 480px) { .fact { grid-template-columns: 92px minmax(0, 1fr); gap: 10px; } }

  /* footer */
  .footer { border-top: 1px solid var(--line); }
  .footer__inner {
    display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
    padding-block: 22px; font-family: var(--mono); font-size: 11.5px; color: var(--ink-3);
  }
  .footer__brand { display: inline-flex; align-items: center; gap: 6px; }
  .footer__brand b { color: var(--ink-2); font-weight: 600; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
  }
</style>
</head>
<body>
  <header class="topbar">
    <div class="wrap topbar__inner">
      <span class="brand"><span class="brand__dot" aria-hidden="true"></span>metaprev</span>
      <a class="target" href="${href}" target="_blank" rel="noopener" title="${finalUrlEsc}">${finalUrlEsc}</a>
      <span class="verdict verdict--${verdict.kind}">
        <span class="verdict__dot" aria-hidden="true"></span>${escapeHtml(verdict.label)}
      </span>
    </div>
  </header>

  <main>
    <section class="wrap summary rise">
      <h1 class="summary__title">How <b>${escapeHtml(pageHost || 'your link')}</b> renders when shared</h1>
      <div class="summary__meta">
        <span class="chip chip--muted">HTTP ${escapeHtml(String(report.status))}</span>
        ${dims ? `<span class="chip chip--muted">${escapeHtml(dims)}</span>` : ''}
        ${bytes ? `<span class="chip chip--muted">${escapeHtml(bytes)}</span>` : ''}
        ${errorCount ? `<span class="chip chip--error">${ISSUE_ICONS.error}${pluralize(errorCount, 'error')}</span>` : ''}
        ${warnCount ? `<span class="chip chip--warn">${ISSUE_ICONS.warn}${pluralize(warnCount, 'warning')}</span>` : ''}
        ${infoCount ? `<span class="chip chip--info">${ISSUE_ICONS.info}${pluralize(infoCount, 'note')}</span>` : ''}
        ${totalIssues === 0 ? `<span class="chip chip--ok">No issues</span>` : ''}
      </div>
    </section>

    <section class="wrap section">
      <div class="section__head">
        <h2 class="section__label">Link previews</h2>
        <div class="seg" role="group" aria-label="Preview appearance">
          <button type="button" class="seg__btn" data-appearance-set="light" aria-pressed="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>Light
          </button>
          <button type="button" class="seg__btn" data-appearance-set="dark" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>Dark
          </button>
        </div>
      </div>
      <div class="stage rise" id="stage" data-appearance="light" style="animation-delay:0.06s">
        <div class="grid">
          ${cardMock('Facebook', 'fb', card, 'Domain · Title · Desc')}
          ${cardMock('X', 'x', card, card.hasImage ? 'Image + domain only' : 'Summary card')}
          ${cardMock('LinkedIn', 'li', card, 'No description in feed')}
          ${cardMock('Discord / Slack', 'dc', card, 'Auto-embed')}
        </div>
      </div>
    </section>

    <section class="wrap section">
      <div class="panels">
        <div class="panel rise" style="animation-delay:0.12s">
          <div class="panel__head">
            <span class="panel__title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-3)"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Validation
              ${totalIssues > 0 ? `<span class="panel__count">${totalIssues}</span>` : ''}
            </span>
            ${totalIssues > 0 ? copyButton('issues') : ''}
          </div>
          <div class="panel__body">
            ${totalIssues === 0
              ? `<div class="clean">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <p>No issues found</p>
                  <span>Title, description, and image all check out.</span>
                </div>`
              : `<ul class="issues">${issuesHtml}</ul>`}
          </div>
        </div>

        <div class="panel rise" style="animation-delay:0.16s">
          <div class="panel__head">
            <span class="panel__title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-3)"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Parsed meta
            </span>
            ${copyButton('facts')}
          </div>
          <div class="panel__body">
            <dl class="facts">
              ${facts.map((f) => factRow(f.key, f.value, f.count)).join('')}
            </dl>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="wrap footer__inner">
      <span>fetched ${escapeHtml(report.fetchedAt)}</span>
      <span class="footer__brand">rendered by <b>metaprev</b></span>
    </div>
  </footer>

  <script id="metaprev-data" type="application/json">${escapeForScriptJson(copyPayloads)}</script>
  <script>
    (function () {
      var stage = document.getElementById('stage');
      var segButtons = document.querySelectorAll('[data-appearance-set]');
      function setAppearance(mode) {
        if (stage) stage.setAttribute('data-appearance', mode);
        segButtons.forEach(function (b) {
          b.setAttribute('aria-pressed', b.getAttribute('data-appearance-set') === mode ? 'true' : 'false');
        });
      }
      segButtons.forEach(function (b) {
        b.addEventListener('click', function () { setAppearance(b.getAttribute('data-appearance-set')); });
      });

      var node = document.getElementById('metaprev-data');
      var payloads = {};
      try { payloads = JSON.parse((node && node.textContent) || '{}'); } catch (e) {}
      document.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest && event.target.closest('.copy-btn');
        if (!btn) return;
        var key = btn.getAttribute('data-copy-target');
        var text = key && payloads[key];
        if (!text) return;
        var label = btn.querySelector('.copy-btn__label');
        var done = function () {
          btn.setAttribute('data-state', 'copied');
          var prev = label ? label.textContent : null;
          if (label) label.textContent = 'Copied';
          setTimeout(function () {
            btn.removeAttribute('data-state');
            if (label && prev !== null) label.textContent = prev;
          }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
        } else { fallback(text, done); }
      });
      function fallback(text, done) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {} finally { document.body.removeChild(ta); }
      }
    })();
  </script>
</body>
</html>`
}

type CardParts = {
  host: string
  site: string
  title: string
  desc: string
  cssImage: string
  hasImage: boolean
  missingText: string
}

function imgBlock(p: CardParts): string {
  return p.hasImage
    ? `<div class="mock__img" style="background-image:url('${p.cssImage}')"></div>`
    : `<div class="mock__img mock__img--missing">${escapeHtml(p.missingText)}</div>`
}

function cardMock(label: string, variant: 'fb' | 'x' | 'li' | 'dc', p: CardParts, note: string): string {
  let mock: string
  if (variant === 'fb') {
    mock = `<div class="mock mock--fb">
      ${imgBlock(p)}
      <div class="mock__body">
        <div class="mock__site">${p.host}</div>
        <div class="mock__title mock__line-clamp">${p.title}</div>
        ${p.desc ? `<div class="mock__desc mock__line-clamp">${p.desc}</div>` : ''}
      </div>
    </div>`
  } else if (variant === 'x') {
    // Current X timeline: large-image cards show the image with the domain overlaid,
    // and the title/description are NOT rendered. With no image, X falls back to a
    // compact summary card that does show the text.
    mock = p.hasImage
      ? `<div class="mock mock--x">
          <div class="mock__shot">
            <div class="mock__img" style="background-image:url('${p.cssImage}')"></div>
            <span class="mock__domain">${p.host}</span>
          </div>
        </div>`
      : `<div class="mock mock--x">
          <div class="mock__summary">
            <div class="mock__body">
              <div class="mock__site">${p.host}</div>
              <div class="mock__title mock__line-clamp">${p.title}</div>
              ${p.desc ? `<div class="mock__desc mock__line-clamp">${p.desc}</div>` : ''}
            </div>
          </div>
        </div>`
  } else if (variant === 'li') {
    mock = `<div class="mock mock--li">
      ${imgBlock(p)}
      <div class="mock__body">
        <div class="mock__title mock__line-clamp">${p.title}</div>
        <div class="mock__site">${p.host}</div>
      </div>
    </div>`
  } else {
    mock = `<div class="mock mock--dc">
      <div class="mock__body">
        <div class="mock__site">${p.site}</div>
        <div class="mock__title mock__line-clamp">${p.title}</div>
        ${p.desc ? `<div class="mock__desc mock__line-clamp">${p.desc}</div>` : ''}
      </div>
      ${imgBlock(p)}
    </div>`
  }

  return `<article class="card">
    <div class="card__head">
      <span class="card__mark">${MARKS[variant]}</span>
      <span class="card__name">${escapeHtml(label)}</span>
      <span class="card__note">${escapeHtml(note)}</span>
    </div>
    ${mock}
  </article>`
}

function copyButton(target: 'issues' | 'facts'): string {
  return `<button class="copy-btn" type="button" data-copy-target="${target}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    <span class="copy-btn__label">Copy</span>
  </button>`
}

type Fact = { key: string; value?: string; count?: string }

function factRow(label: string, value: string | undefined, countSuffix?: string): string {
  const empty = !value
  return `<div class="fact">
    <dt class="fact__key">${escapeHtml(label)}</dt>
    <dd class="fact__val${empty ? ' is-empty' : ''}">${empty ? '—' : escapeHtml(value)}${countSuffix ? ` <span class="fact__count">${escapeHtml(countSuffix)}</span>` : ''}</dd>
  </div>`
}

function count(s: string | undefined): string | undefined {
  if (!s) return undefined
  return `${s.length} ch`
}

function buildCopyPayloads(report: Report, facts: Fact[]): Record<string, string> {
  const payloads: Record<string, string> = {}

  if (report.issues.length > 0) {
    const header = `metaprev — ${report.finalUrl}\nfetched ${report.fetchedAt}\n\nIssues (${report.issues.length}):`
    const lines = report.issues.map((i) => `- [${i.level.toUpperCase()}] ${i.field}: ${i.message}`)
    payloads.issues = `${header}\n${lines.join('\n')}\n`
  }

  const width = Math.max(...facts.map((f) => f.key.length))
  payloads.facts = `metaprev — ${report.finalUrl}\n\n${facts
    .map((f) => `${f.key.padEnd(width)}  ${f.value ? `${f.value}${f.count ? ` (${f.count})` : ''}` : '—'}`)
    .join('\n')}\n`

  return payloads
}

function escapeForScriptJson(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .replace(/-->/g, '--\\>')
}
