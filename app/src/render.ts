import { formatBytes } from './format.ts'
import { CARD_SUMMARY, resolvePlatformInput, resolvePrimaryInput } from './inputs.ts'
import { buildAgentPrompt, buildFindingsText, buildMetaSnippet, buildRepairBrief, resolveInputs } from './repair.ts'
import type { ImageProbe } from './types.ts'
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

function safeHttpHref(value: string): string {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? escapeHtml(url.toString()) : '#'
  } catch {
    return '#'
  }
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function safeDataUri(value: string | undefined): string {
  if (!value) return ''
  return /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(value)
    ? escapeHtml(value)
    : ''
}

function sourceLabel(values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' · ')
}

function cropEvidence(image: ImageProbe | undefined): string {
  if (!image?.width || !image.height) return 'Crop cannot be calculated without decoded dimensions.'
  const ratio = image.width / image.height
  const target = 1200 / 630
  if (Math.abs(ratio - target) / target <= 0.02) return 'Fits the 1.91:1 workspace frame with no material crop.'
  if (ratio < target) return `Cover mode hides about ${Math.round((1 - ratio / target) * 100)}% of the image height across the top and bottom.`
  return `Cover mode hides about ${Math.round((1 - target / ratio) * 100)}% of the image width across the left and right edges.`
}

type CardParts = {
  host: string
  site: string
  title: string
  desc: string
  imageClass: string
  hasImage: boolean
  missingText: string
  alt: string
  compact?: boolean
}

type Level = 'error' | 'warn' | 'info'

const ISSUE_ICONS: Record<Level, string> = {
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
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
  const title = resolvePrimaryInput(m, 'title').value ?? ''
  const pageHost = host(report.finalUrl)
  const siteName = m.ogSiteName || pageHost
  const ogProbe = m.ogImage ? report.image : undefined
  const xProbe = m.twitterImage
    ? (m.twitterImage === m.ogImage ? report.image : report.twitterImage ?? (!m.ogImage ? report.image : undefined))
    : report.image
  const ogCssImage = safeDataUri(ogProbe?.dataUri)
  const xCssImage = safeDataUri(xProbe?.dataUri)
  const ogRasterClass = ogCssImage ? 'raster-og' : ''
  const xRasterClass = xCssImage ? (xCssImage === ogCssImage ? 'raster-og' : 'raster-x') : ''
  const rasterCss = [
    ogCssImage ? `.raster-og { background-image:url('${ogCssImage}'); }` : '',
    xCssImage && xCssImage !== ogCssImage ? `.raster-x { background-image:url('${xCssImage}'); }` : '',
  ].filter(Boolean).join('\n  ')

  const baseCard = {
    host: escapeHtml(pageHost),
    site: escapeHtml(siteName),
  }
  const ogCard: CardParts = {
    ...baseCard,
    title: escapeHtml(resolvePlatformInput(m, 'Open Graph', 'title').value || '(no title)'),
    desc: escapeHtml(resolvePlatformInput(m, 'Open Graph', 'description').value ?? ''),
    imageClass: ogRasterClass,
    hasImage: ogCssImage !== '',
    missingText: m.ogImage ? 'Image failed to load' : 'No og:image',
    alt: escapeHtml(m.ogImageAlt ?? 'Share image preview'),
  }
  const xCard: CardParts = {
    ...baseCard,
    title: escapeHtml(resolvePlatformInput(m, 'X', 'title').value || '(no title)'),
    desc: escapeHtml(resolvePlatformInput(m, 'X', 'description').value ?? ''),
    imageClass: xRasterClass,
    hasImage: xCssImage !== '',
    missingText: m.twitterImage || m.ogImage ? 'Image failed to load' : 'No card image',
    alt: escapeHtml(m.twitterImageAlt ?? m.ogImageAlt ?? 'Share image preview'),
    compact: m.twitterCard === CARD_SUMMARY,
  }
  const ogSources = sourceLabel([
    m.ogTitle ? 'og:title' : m.title ? '<title> fallback' : undefined,
    m.ogImage ? 'og:image' : 'no OG image',
  ])
  const xSources = sourceLabel([
    m.twitterTitle ? 'twitter:title' : m.ogTitle ? 'OG title fallback' : '<title> fallback',
    m.twitterImage ? 'twitter:image' : m.ogImage ? 'OG image fallback' : 'no image',
  ])

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

  const dims = report.image?.width && report.image?.height
    ? `${report.image.width} × ${report.image.height} px`
    : report.image?.error
      ? `Failed: ${report.image.error}`
      : undefined
  const ctype = report.image?.contentType?.split(';')[0]?.trim()
  const detectedType = report.image?.detectedContentType
  const bytes = report.image?.byteLength != null ? formatBytes(report.image.byteLength) : undefined
  const ratio = report.image?.width && report.image.height
    ? `${(report.image.width / report.image.height).toFixed(2)}:1`
    : undefined
  const crop = cropEvidence(report.image)
  const resolvedInputs = resolveInputs(report)
  const metaSnippet = buildMetaSnippet(report)
  const agentPrompt = buildAgentPrompt(report)

  const issuesHtml = report.issues
    .map(
      (i, index) => `
        <li class="issue issue--${i.level}">
          <span class="issue__icon" aria-hidden="true">${ISSUE_ICONS[i.level as Level]}</span>
          <div class="issue__body">
            <span class="issue__field">${String(index + 1).padStart(2, '0')} · ${escapeHtml(i.level)} · ${escapeHtml(i.field)}</span>
            <p class="issue__msg">${escapeHtml(i.message)}</p>
            <dl class="issue__details">
              <div><dt>Impact</dt><dd>${escapeHtml(i.impact)}</dd></div>
              <div><dt>Evidence</dt><dd>${escapeHtml(i.evidence)}</dd></div>
              <div><dt>Fix</dt><dd>${escapeHtml(i.fix)}</dd></div>
            </dl>
          </div>
        </li>`,
    )
    .join('')

  const finalUrlEsc = escapeHtml(report.finalUrl)
  const href = safeHttpHref(report.finalUrl)
  const scriptNonce = crypto.randomUUID().replace(/-/g, '')

  // Single source of truth for the parsed-meta facts — rendered into the panel and
  // formatted into the "Copy" payload from the same list.
  const facts: Fact[] = [
    { key: 'source', value: report.source },
    { key: 'final url', value: report.finalUrl },
    { key: 'http', value: String(report.status) },
    { key: 'og:title', value: m.ogTitle, count: count(m.ogTitle) },
    { key: 'og:description', value: m.ogDescription, count: count(m.ogDescription) },
    { key: 'og:image', value: m.ogImage },
    { key: 'image', value: dims },
    { key: 'ratio', value: ratio },
    { key: 'type', value: ctype },
    { key: 'detected type', value: detectedType },
    { key: 'bytes', value: bytes },
    { key: 'twitter:card', value: m.twitterCard },
    { key: 'og:site_name', value: m.ogSiteName },
    { key: 'canonical', value: m.canonical ?? m.ogUrl },
  ]
  const copyPayloads = buildCopyPayloads(report, facts)

  return `<!doctype html>
<html lang="en" data-theme="workbench" data-chrome="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex" />
<meta name="color-scheme" content="light dark" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'" />
<title>metaprev · ${escapeHtml(pageHost || title || 'preview')}</title>
<script nonce="${scriptNonce}">
  (function () {
    var themes = ['workbench', 'vintage-paper', 'modern-minimal', 'mocha-mousse', 'clean-slate', 'solar-dusk'];
    var theme = null;
    var scheme = null;
    try {
      theme = localStorage.getItem('metaprev-chrome-theme');
      scheme = localStorage.getItem('metaprev-chrome-scheme');
    } catch (e) {}
    if (themes.indexOf(theme) < 0) theme = 'workbench';
    if (scheme !== 'light' && scheme !== 'dark') {
      scheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-chrome', scheme);
  })();
</script>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; color-scheme: light; }
  html[data-chrome="dark"] { color-scheme: dark; }
  html, body { margin: 0; padding: 0; }
  html, body { overflow-x: clip; }

  :root {
    /* Warm paper workbench, OKLCH, tinted toward 75° so no neutral is a dead gray. */
    --paper: oklch(97.6% 0.006 75);
    --surface: oklch(99.3% 0.004 80);
    --stage: oklch(94.4% 0.008 75);
    --stage-dark: oklch(26% 0.012 264);
    --card-stage-light: oklch(94.4% 0.008 75);
    --card-stage-light-ink: oklch(38% 0.012 65);
    --card-stage-light-muted: oklch(43% 0.01 65);
    --card-stage-dark-ink: oklch(86% 0.01 264);
    --card-stage-dark-muted: oklch(75% 0.01 264);
    --ink: oklch(26% 0.012 65);
    --ink-2: oklch(46% 0.012 65);
    --ink-3: oklch(53% 0.01 65);
    --line: oklch(89% 0.008 75);
    --line-2: oklch(93.5% 0.006 75);

    --accent: oklch(57% 0.165 41);
    --accent-2: oklch(48% 0.155 39);
    --accent-wash: oklch(95.5% 0.03 50);
    --accent-ink: var(--surface);

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

  html[data-theme="workbench"][data-chrome="dark"] {
    --paper: oklch(22% 0.010 75); --surface: oklch(27% 0.008 80); --stage: oklch(18% 0.010 75);
    --ink: oklch(94% 0.008 65); --line: oklch(34% 0.010 75);
    --accent: oklch(57% 0.165 41); --accent-ink: oklch(98% 0.004 80); --accent-wash: color-mix(in oklch, var(--accent) 18%, var(--paper)); --error: oklch(62% 0.19 27);
  }

  html[data-theme="vintage-paper"][data-chrome="light"] {
    --paper: oklch(0.9582 0.0152 90.2357); --surface: oklch(0.9914 0.0098 87.4695); --stage: oklch(0.9239 0.0190 83.0636);
    --ink: oklch(0.3760 0.0225 64.3434); --line: oklch(0.8606 0.0321 84.5881);
    --accent: oklch(0.6180 0.0778 65.5444); --accent-ink: oklch(1 0 0); --accent-wash: oklch(0.8348 0.0426 88.8064); --error: oklch(0.5471 0.1438 32.9149);
  }
  html[data-theme="vintage-paper"][data-chrome="dark"] {
    --paper: oklch(0.2747 0.0139 57.6523); --surface: oklch(0.3237 0.0155 59.0603); --stage: oklch(0.2939 0.0125 62.1298);
    --ink: oklch(0.9239 0.0190 83.0636); --line: oklch(0.3795 0.0181 57.1280);
    --accent: oklch(0.7264 0.0581 66.6967); --accent-ink: oklch(0.2747 0.0139 57.6523); --accent-wash: oklch(0.4186 0.0281 56.3404); --error: oklch(0.5471 0.1438 32.9149);
  }

  html[data-theme="modern-minimal"][data-chrome="light"] {
    --paper: oklch(1 0 0); --surface: oklch(1 0 0); --stage: oklch(0.9846 0.0017 247.8389);
    --ink: oklch(0.3211 0 0); --line: oklch(0.9276 0.0058 264.5313);
    --accent: oklch(0.6231 0.1880 259.8145); --accent-ink: oklch(1 0 0); --accent-wash: oklch(0.9514 0.0250 236.8242); --error: oklch(0.6368 0.2078 25.3313);
  }
  html[data-theme="modern-minimal"][data-chrome="dark"] {
    --paper: oklch(0.2046 0 0); --surface: oklch(0.2686 0 0); --stage: oklch(0.2393 0 0);
    --ink: oklch(0.9219 0 0); --line: oklch(0.3715 0 0);
    --accent: oklch(0.6231 0.1880 259.8145); --accent-ink: oklch(1 0 0); --accent-wash: oklch(0.3791 0.1378 265.5222); --error: oklch(0.6368 0.2078 25.3313);
  }

  html[data-theme="mocha-mousse"][data-chrome="light"] {
    --paper: oklch(0.9529 0.0146 102.4597); --surface: oklch(1 0 0); --stage: oklch(0.8502 0.0389 49.0874);
    --ink: oklch(0.4063 0.0255 40.3627); --line: oklch(0.7473 0.0387 80.5476);
    --accent: oklch(0.6083 0.0623 44.3588); --accent-ink: oklch(1 0 0); --accent-wash: oklch(0.8502 0.0389 49.0874); --error: oklch(0.6875 0.1420 21.4566);
  }
  html[data-theme="mocha-mousse"][data-chrome="dark"] {
    --paper: oklch(0.2721 0.0141 48.1783); --surface: oklch(0.3291 0.0156 50.8936); --stage: oklch(0.4063 0.0255 40.3627);
    --ink: oklch(0.9529 0.0146 102.4597); --line: oklch(0.4063 0.0255 40.3627);
    --accent: oklch(0.7272 0.0539 52.3320); --accent-ink: oklch(0.2721 0.0141 48.1783); --accent-wash: oklch(0.7473 0.0387 80.5476); --error: oklch(0.6875 0.1420 21.4566);
  }

  html[data-theme="clean-slate"][data-chrome="light"] {
    --paper: oklch(0.9842 0.0034 247.8575); --surface: oklch(1 0 0); --stage: oklch(0.9670 0.0029 264.5419);
    --ink: oklch(0.2795 0.0368 260.0310); --line: oklch(0.8717 0.0093 258.3382);
    --accent: oklch(0.5854 0.2041 277.1173); --accent-ink: oklch(1 0 0); --accent-wash: oklch(0.9299 0.0334 272.7879); --error: oklch(0.6368 0.2078 25.3313);
  }
  html[data-theme="clean-slate"][data-chrome="dark"] {
    --paper: oklch(0.2077 0.0398 265.7549); --surface: oklch(0.2795 0.0368 260.0310); --stage: oklch(0.2427 0.0381 259.9437);
    --ink: oklch(0.9288 0.0126 255.5078); --line: oklch(0.4461 0.0263 256.8018);
    --accent: oklch(0.6801 0.1583 276.9349); --accent-ink: oklch(0.2077 0.0398 265.7549); --accent-wash: oklch(0.3729 0.0306 259.7328); --error: oklch(0.6368 0.2078 25.3313);
  }

  html[data-theme="solar-dusk"][data-chrome="light"] {
    --paper: oklch(0.9885 0.0057 84.5659); --surface: oklch(0.9686 0.0091 78.2818); --stage: oklch(0.9363 0.0218 83.2637);
    --ink: oklch(0.3660 0.0251 49.6085); --line: oklch(0.8866 0.0404 89.6994);
    --accent: oklch(0.5553 0.1455 48.9975); --accent-ink: oklch(1 0 0); --accent-wash: oklch(0.9000 0.0500 74.9889); --error: oklch(0.4437 0.1613 26.8994);
  }
  html[data-theme="solar-dusk"][data-chrome="dark"] {
    --paper: oklch(0.2161 0.0061 56.0434); --surface: oklch(0.2685 0.0063 34.2976); --stage: oklch(0.2330 0.0073 67.4563);
    --ink: oklch(0.9699 0.0013 106.4238); --line: oklch(0.3741 0.0087 67.5582);
    --accent: oklch(0.7049 0.1867 47.6044); --accent-ink: oklch(1 0 0); --accent-wash: oklch(0.3598 0.0497 229.3202); --error: oklch(0.5771 0.2152 27.3250);
  }

  html[data-theme][data-chrome] {
    /* Same specificity as the presets, declared last so muted text stays AA-safe. */
    --ink-2: color-mix(in oklch, var(--ink) 94%, var(--paper));
    --ink-3: color-mix(in oklch, var(--ink) 88%, var(--paper));
    --line-2: color-mix(in oklch, var(--line) 58%, var(--paper));
    --accent-2: var(--ink);
    --action: var(--ink);
    --action-hover: color-mix(in oklch, var(--ink) 92%, var(--paper));
    --action-ink: var(--paper);
    --error-ink: var(--ink);
    --warn-ink: var(--ink);
    --info-ink: var(--ink);
    --ok-ink: var(--ink);
    --error-wash: color-mix(in oklch, var(--error) 18%, var(--paper));
    --error-line: color-mix(in oklch, var(--error) 38%, var(--line));
    --warn-wash: color-mix(in oklch, var(--warn) 18%, var(--paper));
    --warn-line: color-mix(in oklch, var(--warn) 38%, var(--line));
    --info-wash: color-mix(in oklch, var(--info) 18%, var(--paper));
    --info-line: color-mix(in oklch, var(--info) 38%, var(--line));
    --ok-wash: color-mix(in oklch, var(--ok) 18%, var(--paper));
    --ok-line: color-mix(in oklch, var(--ok) 38%, var(--line));
    --shadow-card: 0 1px 2px color-mix(in oklch, var(--ink) 5%, transparent), 0 6px 20px color-mix(in oklch, var(--ink) 6%, transparent);
    --shadow-pop: 0 2px 6px color-mix(in oklch, var(--ink) 8%, transparent), 0 14px 40px color-mix(in oklch, var(--ink) 10%, transparent);
  }

  html[data-theme-changing] *, html[data-theme-changing] *::before, html[data-theme-changing] *::after { transition: none !important; }

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
    min-height: 100dvh;
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
  .skip-link {
    position: fixed; top: calc(8px + env(safe-area-inset-top)); left: 8px; z-index: 100;
    padding: 8px 12px; border-radius: var(--r-sm); color: var(--action-ink); background: var(--action);
    font: 600 12px var(--mono); text-decoration: none; transform: translateY(-160%);
  }
  .skip-link:focus { transform: translateY(0); }
  :focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; border-radius: 4px; }
  h1, h2, h3, [id] { scroll-margin-top: calc(76px + env(safe-area-inset-top)); }

  /* ── Top bar ── */
  .topbar {
    position: sticky; top: 0; z-index: 20;
    padding-top: env(safe-area-inset-top);
    background: color-mix(in oklab, var(--paper) 82%, transparent);
    backdrop-filter: saturate(1.4) blur(10px);
    -webkit-backdrop-filter: saturate(1.4) blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .topbar__inner {
    display: flex; align-items: center; gap: 16px;
    padding-left: max(28px, env(safe-area-inset-left));
    padding-right: max(28px, env(safe-area-inset-right));
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
  .verdict {
    display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0;
    padding: 6px 13px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
    border: 1px solid transparent; white-space: nowrap;
  }
  .verdict__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .verdict--ok { color: var(--ok-ink); background: var(--ok-wash); border-color: var(--ok-line); }
  .verdict--error { color: var(--error-ink); background: var(--error-wash); border-color: var(--error-line); }
  .verdict--warn { color: var(--warn-ink); background: var(--warn-wash); border-color: var(--warn-line); }
  .verdict--info { color: var(--info-ink); background: var(--info-wash); border-color: var(--info-line); }

  /* ── Summary strip ── */
  .summary { padding-top: 30px; }
  .summary__title {
    font-size: clamp(22px, 4vw, 30px); line-height: 1.1; letter-spacing: -0.025em;
    color: var(--ink); max-width: 24ch; text-wrap: balance;
  }
  .summary__title b { color: var(--accent-2); font-weight: 600; }
  .summary__lede { max-width: 68ch; margin: 10px 0 0; color: var(--ink-2); font-size: 13.5px; text-wrap: pretty; }
  .summary__url { max-width: 100%; margin: 9px 0 0; color: var(--ink-3); font: 11.5px/1.45 var(--mono); overflow-wrap: anywhere; }
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
  .chip--error { color: var(--error-ink); border-color: var(--error-line); background: var(--error-wash); }
  .chip--warn { color: var(--warn-ink); border-color: var(--warn-line); background: var(--warn-wash); }
  .chip--info { color: var(--info-ink); border-color: var(--info-line); background: var(--info-wash); }
  .chip--ok { color: var(--ok-ink); border-color: var(--ok-line); background: var(--ok-wash); }
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
  .section__support { margin: 5px 0 0; max-width: 68ch; color: var(--ink-2); font-size: 12.5px; text-wrap: pretty; }

  /* ── Report chrome theme ── */
  .themebar {
    margin-top: 18px; padding: 12px; display: flex; align-items: end; justify-content: space-between;
    gap: 12px; flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--r-md);
    background: color-mix(in oklab, var(--surface) 78%, transparent); box-shadow: var(--shadow-card);
  }
  .themebar__field { display: grid; gap: 5px; min-width: min(100%, 230px); }
  .themebar__label { color: var(--ink-3); font: 600 10px var(--mono); text-transform: uppercase; letter-spacing: .08em; }
  .themebar__select {
    min-height: 34px; padding: 5px 32px 5px 10px; border: 1px solid var(--line); border-radius: var(--r-sm);
    color: var(--ink); background: var(--surface); font: 600 12px var(--sans); cursor: pointer;
  }

  /* ── Appearance toggle ── */
  .seg {
    display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px;
    background: var(--stage); border: 1px solid var(--line);
  }
  .seg__btn {
    font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
    color: var(--ink); background: transparent; border: 0; border-radius: 999px;
    padding: 5px 14px; display: inline-flex; align-items: center; gap: 6px;
    touch-action: manipulation; user-select: none;
    transition: transform 0.12s var(--ease), color 0.12s var(--ease);
  }
  .seg__btn svg { width: 13px; height: 13px; }
  .seg__btn[aria-pressed="true"] {
    color: var(--ink); background: var(--surface); box-shadow: var(--shadow-card);
  }
  .seg__btn:active { transform: scale(0.96); }

  /* ── Card stage ── */
  .stage {
    border-radius: var(--r-lg); padding: 26px;
    background: var(--card-stage-light);
    border: 1px solid oklch(89% 0.008 75);
  }
  .stage[data-appearance="dark"] { background: var(--stage-dark); border-color: oklch(34% 0.02 264); }
  .grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px;
  }
  @media (max-width: 760px) { .grid { grid-template-columns: minmax(0, 1fr); } }

  .card { min-width: 0; }
  .card__head {
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    color: var(--card-stage-light-ink);
  }
  .stage[data-appearance="dark"] .card__head { color: var(--card-stage-dark-ink); }
  .card__mark { width: 16px; height: 16px; flex-shrink: 0; }
  .card__name { font-size: 12.5px; font-weight: 600; letter-spacing: -0.01em; }
  .card__note {
    margin-left: auto; font-family: var(--mono); font-size: 10.5px;
    letter-spacing: 0.02em; color: var(--card-stage-light-muted);
  }
  .stage[data-appearance="dark"] .card__note { color: var(--card-stage-dark-muted); }

  /* shared mock image */
  .mock__img {
    background-color: oklch(90% 0.01 75);
    background-size: cover; background-position: center; background-repeat: no-repeat;
  }
  .mock__img--missing {
    display: flex; align-items: center; justify-content: center;
    background: repeating-linear-gradient(45deg, oklch(91% 0.01 75) 0 10px, oklch(93% 0.008 75) 10px 20px);
    color: #4b5563; font-family: var(--mono); font-size: 11px;
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
  [data-appearance="dark"] .mock--fb .mock__img--missing { color: #d8dadf; background: repeating-linear-gradient(45deg, #242526 0 10px, #303132 10px 20px); }
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
  .mock--x .mock__summary--with-image { display: grid; grid-template-columns: minmax(0, 1fr) 112px; }
  .mock--x .mock__summary--with-image .mock__thumb {
    min-height: 112px; border-left: 1px solid #cfd9de;
    background-color: #eff3f4; background-size: cover; background-position: center;
  }
  .mock--x .mock__summary .mock__site { font-size: 13px; color: #536471; }
  .mock--x .mock__summary .mock__title { font-size: 15px; font-weight: 700; color: #0f1419; margin: 2px 0 0; -webkit-line-clamp: 2; line-height: 1.3; }
  .mock--x .mock__summary .mock__desc { font-size: 14px; color: #536471; margin: 2px 0 0; -webkit-line-clamp: 2; line-height: 1.3; }
  [data-appearance="dark"] .mock--x .mock__summary { background: #16181c; border-color: #2f3336; }
  [data-appearance="dark"] .mock--x .mock__summary--with-image .mock__thumb { border-left-color: #2f3336; }
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
  [data-appearance="dark"] .mock--li .mock__img--missing { color: #d8dde3; background: repeating-linear-gradient(45deg, #1b1f23 0 10px, #252b31 10px 20px); }
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

  /* neutral image inspection: show the deterministic cover crop beside the whole asset */
  .asset-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(260px, 0.55fr); gap: 22px; align-items: start; }
  .asset-views { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .asset-view { margin: 0; min-width: 0; }
  .asset-frame {
    aspect-ratio: 1.91 / 1; border-radius: var(--r-sm); border: 1px solid var(--line);
    background-color: var(--stage); background-position: center; background-repeat: no-repeat;
    overflow: hidden; display: grid; place-items: center;
  }
  .asset-frame--cover { background-size: cover; }
  .asset-frame--fit { background-size: contain; }
  .asset-frame--empty { color: var(--ink-3); font: 11px var(--mono); text-transform: uppercase; letter-spacing: .05em; }
  .asset-view figcaption { margin-top: 7px; color: var(--ink-2); font-size: 11.5px; }
  .asset-view figcaption b { display: block; color: var(--ink); font: 600 11px var(--mono); }
  .asset-readout { margin: 0; display: grid; gap: 0; }
  .asset-readout div { padding: 9px 0; border-bottom: 1px solid var(--line-2); }
  .asset-readout div:first-child { padding-top: 0; }
  .asset-readout div:last-child { border: 0; }
  .asset-readout dt { color: var(--ink-3); font: 600 10.5px var(--mono); text-transform: uppercase; letter-spacing: .06em; }
  .asset-readout dd { margin: 3px 0 0; color: var(--ink); font-size: 12.5px; overflow-wrap: anywhere; }
  @media (max-width: 760px) { .asset-grid { grid-template-columns: 1fr; } }
  @media (max-width: 520px) { .asset-views { grid-template-columns: 1fr; } }

  .copy-btn {
    font: inherit; font-family: var(--mono); font-size: 11px; font-weight: 600;
    color: var(--ink-2); background: transparent; border: 1px solid var(--line);
    border-radius: var(--r-sm); padding: 4px 10px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 5px; touch-action: manipulation; user-select: none;
    transition: transform 0.12s var(--ease), color 0.12s var(--ease), border-color 0.12s var(--ease), background 0.12s var(--ease);
  }
  .copy-btn svg { width: 12px; height: 12px; }
  .copy-btn:active { transform: scale(0.96); }
  .copy-btn[data-state="copied"] { color: var(--ok-ink); border-color: var(--ok-line); background: var(--ok-wash); }

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
  .issue--error .issue__icon { color: var(--error-ink); }
  .issue--warn .issue__icon { color: var(--warn-ink); }
  .issue--info .issue__icon { color: var(--info-ink); }
  .issue__body { min-width: 0; }
  .issue__field { font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .issue--error .issue__field { color: var(--error-ink); }
  .issue--warn .issue__field { color: var(--warn-ink); }
  .issue--info .issue__field { color: var(--info-ink); }
  .issue__msg { margin: 2px 0 0; font-size: 13px; line-height: 1.42; color: var(--ink); overflow-wrap: anywhere; }
  .issue__details { margin: 8px 0 0; display: grid; gap: 5px; }
  .issue__details div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; }
  .issue__details dt { font: 600 10px var(--mono); text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); }
  .issue__details dd { margin: 0; min-width: 0; color: var(--ink-2); font-size: 12px; line-height: 1.42; overflow-wrap: anywhere; }

  .clean { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 26px 12px; color: var(--ok-ink); }
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

  .subhead { margin: 18px 0 8px; padding-top: 16px; border-top: 1px solid var(--line-2); font: 600 10.5px var(--mono); color: var(--ink-3); text-transform: uppercase; letter-spacing: .08em; }
  .resolved { display: grid; gap: 7px; }
  .resolved__row { display: grid; grid-template-columns: 84px 78px minmax(0, 1fr); gap: 8px; align-items: baseline; font-size: 11.5px; }
  .resolved__platform, .resolved__field { font-family: var(--mono); color: var(--ink-3); }
  .resolved__source { min-width: 0; overflow-wrap: anywhere; color: var(--ink); }
  .resolved__source b { color: var(--accent-2); font-weight: 600; }
  @media (max-width: 480px) {
    .resolved__row { grid-template-columns: 72px minmax(0, 1fr); gap: 2px 8px; align-items: start; }
    .resolved__field { grid-column: 2; grid-row: 1; }
    .resolved__source { grid-column: 2; grid-row: 2; }
  }

  .repair { display: grid; gap: 18px; }
  .repair__head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items: center; }
  .repair__title { margin: 0; font-size: 14px; }
  .repair__copy { margin: 5px 0 0; color: var(--ink-2); font-size: 12.5px; max-width: 70ch; text-wrap: pretty; }
  .repair__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
  .repair__outputs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .repair__output { min-width: 0; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--paper); overflow: hidden; }
  .repair__output summary { cursor: pointer; padding: 10px 12px; font: 600 11px var(--mono); color: var(--ink-2); }
  .repair__output[open] summary { border-bottom: 1px solid var(--line); }
  .repair__output pre { margin: 0; padding: 12px; max-height: 320px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.55 var(--mono); color: var(--ink); }
  .copy-btn--primary { color: var(--action-ink); background: var(--action); border-color: var(--action); }
  @media (max-width: 700px) { .repair__head, .repair__outputs { grid-template-columns: 1fr; } .repair__actions { justify-content: flex-start; } }

  /* footer */
  .footer { border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
  .footer__inner {
    display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
    padding-left: max(28px, env(safe-area-inset-left));
    padding-right: max(28px, env(safe-area-inset-right));
    padding-block: 22px; font-family: var(--mono); font-size: 11.5px; color: var(--ink-3);
  }
  .footer__brand { display: inline-flex; align-items: center; gap: 6px; }
  .footer__brand b { color: var(--ink-2); font-weight: 600; }

  @media (hover: hover) and (pointer: fine) {
    .target:hover { color: var(--ink); border-color: var(--line); }
    .copy-btn:hover { color: var(--ink); border-color: var(--ink-3); }
    .copy-btn--primary:hover { color: var(--action-ink); background: var(--action-hover); border-color: var(--action-hover); }
  }
  @media (pointer: coarse) {
    .seg__btn, .copy-btn { min-height: 44px; padding-inline: 14px; }
    .themebar__select { min-height: 44px; }
  }
  @media (max-width: 600px) {
    .topbar__inner, .footer__inner {
      padding-left: max(16px, env(safe-area-inset-left));
      padding-right: max(16px, env(safe-area-inset-right));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
  }
  ${rasterCss}
</style>
</head>
<body>
  <a class="skip-link" href="#content">Skip to report</a>
  <header class="topbar">
    <div class="wrap topbar__inner">
      <span class="brand"><span class="brand__dot" aria-hidden="true"></span>metaprev</span>
      <a class="target" href="${href}" target="_blank" rel="noopener" title="${finalUrlEsc}" aria-describedby="report-url">${finalUrlEsc}</a>
      <span class="verdict verdict--${verdict.kind}">
        <span class="verdict__dot" aria-hidden="true"></span>${escapeHtml(verdict.label)}
      </span>
    </div>
  </header>

  <main id="content">
    <section class="wrap summary">
      <h1 class="summary__title">Share preview for <b>${escapeHtml(pageHost || 'your link')}</b></h1>
      <p class="summary__lede">Representative previews built from the metadata and image fetched in this run. Platform UI, experiments, and cached unfurls can differ; the source labels below show every fallback metaprev used.</p>
      <p class="summary__url" id="report-url">${finalUrlEsc}</p>
      <div class="summary__meta">
        <span class="chip chip--muted">HTTP ${escapeHtml(String(report.status))}</span>
        ${dims ? `<span class="chip chip--muted">${escapeHtml(dims)}</span>` : ''}
        ${bytes ? `<span class="chip chip--muted">${escapeHtml(bytes)}</span>` : ''}
        ${errorCount ? `<span class="chip chip--error">${ISSUE_ICONS.error}${pluralize(errorCount, 'error')}</span>` : ''}
        ${warnCount ? `<span class="chip chip--warn">${ISSUE_ICONS.warn}${pluralize(warnCount, 'warning')}</span>` : ''}
        ${infoCount ? `<span class="chip chip--info">${ISSUE_ICONS.info}${pluralize(infoCount, 'note')}</span>` : ''}
        ${totalIssues === 0 ? `<span class="chip chip--ok">No issues</span>` : ''}
      </div>
      <div class="themebar" aria-label="Report chrome theme">
        <label class="themebar__field">
          <span class="themebar__label">Report theme</span>
          <select class="themebar__select" data-theme-select>
            <option value="workbench">Workbench</option>
            <option value="vintage-paper">Vintage Paper</option>
            <option value="modern-minimal">Modern Minimal</option>
            <option value="mocha-mousse">Mocha Mousse</option>
            <option value="clean-slate">Clean Slate</option>
            <option value="solar-dusk">Solar Dusk</option>
          </select>
        </label>
        <div>
          <span class="themebar__label">Report scheme</span>
          <div class="seg seg--scheme" role="group" aria-label="Report color scheme">
            <button type="button" class="seg__btn" data-chrome-set="light" aria-pressed="true">Light</button>
            <button type="button" class="seg__btn" data-chrome-set="dark" aria-pressed="false">Dark</button>
          </div>
        </div>
      </div>
    </section>

    <section class="wrap section">
      <div class="section__head">
        <div>
          <h2 class="section__label">Platform workspace</h2>
          <p class="section__support">Compare the fields each card consumes. Facebook and LinkedIn use the Open Graph path; X prefers twitter:* values, and Discord is shown as its own representative mock. Slack classic unfurls inspect common Open Graph and X metadata, but Slack is not represented by the Discord mock. Current docs.x.com does not publish Cards image rules.</p>
        </div>
        <div class="seg" role="group" aria-label="Card appearance">
          <button type="button" class="seg__btn" data-appearance-set="light" aria-pressed="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>Light
          </button>
          <button type="button" class="seg__btn" data-appearance-set="dark" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>Dark
          </button>
        </div>
      </div>
      <div class="stage" id="stage" data-appearance="light">
        <div class="grid">
          ${cardMock('Facebook', 'fb', ogCard, ogSources)}
          ${cardMock('X', 'x', xCard, xSources)}
          ${cardMock('LinkedIn', 'li', ogCard, ogSources)}
          ${cardMock('Discord', 'dc', ogCard, ogSources)}
        </div>
      </div>
    </section>

    <section class="wrap section" aria-labelledby="asset-title">
      <div class="section__head">
        <div>
          <h2 class="section__label" id="asset-title">Image inspection</h2>
          <p class="section__support">This inspection covers og:image against LinkedIn’s current 1.91:1 guidance and retained Facebook guidance that could not be reverified because its first-party pages returned HTTP 429. Fit keeps the whole Open Graph asset visible. A distinct twitter:image is previewed separately in the X mock; these Open Graph findings do not validate that asset for X, whose current image rules are undocumented.</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel__body asset-grid">
          <div class="asset-views">
            <figure class="asset-view">
              <div class="asset-frame asset-frame--cover${ogCssImage ? ` ${ogRasterClass}` : ' asset-frame--empty'}"${ogCssImage ? ` role="img" aria-label="${escapeHtml(m.ogImageAlt ?? 'Open Graph image shown with a centered cover crop')}"` : ''}>${ogCssImage ? '' : 'No validated OG image'}</div>
              <figcaption><b>Cover crop</b>Fills a 1.91:1 card frame.</figcaption>
            </figure>
            <figure class="asset-view">
              <div class="asset-frame asset-frame--fit${ogCssImage ? ` ${ogRasterClass}` : ' asset-frame--empty'}"${ogCssImage ? ' aria-hidden="true"' : ''}>${ogCssImage ? '' : 'No validated OG image'}</div>
              <figcaption><b>Whole asset</b>Fits inside the same frame.</figcaption>
            </figure>
          </div>
          <dl class="asset-readout">
            <div><dt>Decoded size</dt><dd>${escapeHtml(dims ?? 'Unknown')}</dd></div>
            <div><dt>Aspect ratio</dt><dd>${escapeHtml(ratio ?? 'Unknown')} · LinkedIn workspace frame 1.91:1; Facebook guidance not reverified</dd></div>
            <div><dt>Cover result</dt><dd>${escapeHtml(crop)}</dd></div>
            <div><dt>Response</dt><dd>${escapeHtml([ctype, bytes].filter(Boolean).join(' · ') || 'Unknown')}</dd></div>
            ${detectedType && detectedType !== ctype ? `<div><dt>Detected bytes</dt><dd>${escapeHtml(detectedType)}</dd></div>` : ''}
            <div><dt>OG source</dt><dd>${escapeHtml(m.ogImage ?? 'No og:image')}</dd></div>
            ${m.twitterImage && m.twitterImage !== m.ogImage ? `<div><dt>X override</dt><dd>${escapeHtml(m.twitterImage)} · previewed separately; not covered by OG findings</dd></div>` : ''}
          </dl>
        </div>
      </div>
    </section>

    <section class="wrap section">
      <div class="panels">
        <div class="panel">
          <div class="panel__head">
            <h2 class="panel__title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-3)" aria-hidden="true"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Validation
              ${totalIssues > 0 ? `<span class="panel__count">${totalIssues}</span>` : ''}
            </h2>
            ${totalIssues > 0 ? copyButton('issues', 'Copy findings') : ''}
          </div>
          <div class="panel__body">
            ${totalIssues === 0
              ? `<div class="clean">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <p>No validation issues found</p>
                  <span>Review the visual crop and source fallbacks before shipping.</span>
                </div>`
              : `<ul class="issues">${issuesHtml}</ul>`}
          </div>
        </div>

        <div class="panel">
          <div class="panel__head">
            <h2 class="panel__title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-3)" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Parsed meta
            </h2>
            ${copyButton('facts', 'Copy facts')}
          </div>
          <div class="panel__body">
            <dl class="facts">
              ${facts.map((f) => factRow(f.key, f.value, f.count)).join('')}
            </dl>
            <h3 class="subhead">Resolved inputs</h3>
            <div class="resolved" aria-label="Resolved metadata inputs">
              ${resolvedInputs.map((input) => `<div class="resolved__row">
                <span class="resolved__platform">${escapeHtml(input.platform)}</span>
                <span class="resolved__field">${escapeHtml(input.field)}</span>
                <span class="resolved__source"><b>${escapeHtml(input.source)}</b>${input.fallback ? ' · fallback' : ''}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="wrap section" aria-labelledby="repair-title">
      <div class="panel">
        <div class="panel__body repair">
          <div class="repair__head">
            <div>
              <h2 class="repair__title" id="repair-title">Repair handoff</h2>
              <p class="repair__copy">Review the safe metadata starting point, then copy the evidence-led brief or guarded coding-agent prompt. Missing facts remain comments instead of invented values.</p>
            </div>
            <div class="repair__actions">
              ${copyButton('snippet', 'Copy metadata')}
              ${copyButton('repair', 'Copy repair brief')}
              ${copyButton('agent', 'Copy agent prompt', true)}
            </div>
          </div>
          <div class="repair__outputs">
            <details class="repair__output" open>
              <summary>Metadata starting point</summary>
              <pre><code>${escapeHtml(metaSnippet)}</code></pre>
            </details>
            <details class="repair__output">
              <summary>Coding-agent prompt</summary>
              <pre>${escapeHtml(agentPrompt)}</pre>
            </details>
          </div>
        </div>
      </div>
    </section>
    <p class="sr-only" id="copy-status" aria-live="polite"></p>
  </main>

  <footer class="footer">
    <div class="wrap footer__inner">
      <span>fetched ${escapeHtml(report.fetchedAt)}</span>
      <span class="footer__brand">local report by <b>metaprev</b> · platform caches not inspected</span>
    </div>
  </footer>

  <script id="metaprev-data" type="application/json" nonce="${scriptNonce}">${escapeForScriptJson(copyPayloads)}</script>
  <script nonce="${scriptNonce}">
    (function () {
      var root = document.documentElement;
      var themeSelect = document.querySelector('[data-theme-select]');
      var chromeButtons = document.querySelectorAll('[data-chrome-set]');
      var themeKey = 'metaprev-chrome-theme';
      var schemeKey = 'metaprev-chrome-scheme';
      var themes = ['workbench', 'vintage-paper', 'modern-minimal', 'mocha-mousse', 'clean-slate', 'solar-dusk'];
      function readPreference(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
      }
      function writePreference(key, value) {
        try { localStorage.setItem(key, value); } catch (e) {}
      }
      function finishThemeChange() {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { root.removeAttribute('data-theme-changing'); });
        });
      }
      function setChrome(theme, scheme, persist) {
        var nextTheme = themes.indexOf(theme) >= 0 ? theme : 'workbench';
        var nextScheme = scheme === 'dark' ? 'dark' : 'light';
        root.setAttribute('data-theme-changing', '');
        root.setAttribute('data-theme', nextTheme);
        root.setAttribute('data-chrome', nextScheme);
        root.style.colorScheme = nextScheme;
        if (themeSelect) themeSelect.value = nextTheme;
        chromeButtons.forEach(function (button) {
          button.setAttribute('aria-pressed', button.getAttribute('data-chrome-set') === nextScheme ? 'true' : 'false');
        });
        if (persist) {
          writePreference(themeKey, nextTheme);
          writePreference(schemeKey, nextScheme);
        }
        finishThemeChange();
      }
      var savedTheme = readPreference(themeKey);
      var savedScheme = readPreference(schemeKey);
      var preferredScheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setChrome(savedTheme || 'workbench', savedScheme || preferredScheme, false);
      if (themeSelect) {
        themeSelect.addEventListener('change', function () {
          setChrome(themeSelect.value, root.getAttribute('data-chrome'), true);
        });
      }
      chromeButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          setChrome(root.getAttribute('data-theme'), button.getAttribute('data-chrome-set'), true);
        });
      });

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
      var copyStatus = document.getElementById('copy-status');
      var payloads = {};
      try { payloads = JSON.parse((node && node.textContent) || '{}'); } catch (e) {}
      document.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest && event.target.closest('.copy-btn');
        if (!btn) return;
        var key = btn.getAttribute('data-copy-target');
        var text = key && payloads[key];
        if (!text) return;
        var label = btn.querySelector('.copy-btn__label');
        var originalLabel = label ? label.textContent : null;
        var done = function () {
          btn.setAttribute('data-state', 'copied');
          if (label) label.textContent = 'Copied';
          if (copyStatus) copyStatus.textContent = (originalLabel || 'Content') + ' copied to clipboard.';
          setTimeout(function () {
            btn.removeAttribute('data-state');
            if (label && originalLabel !== null) label.textContent = originalLabel;
          }, 1500);
        };
        var failed = function () {
          if (label) label.textContent = 'Copy failed';
          if (copyStatus) copyStatus.textContent = 'Copy failed. Open the matching output and copy it manually.';
          setTimeout(function () { if (label && originalLabel !== null) label.textContent = originalLabel; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text, done, failed); });
        } else { fallback(text, done, failed); }
      });
      function fallback(text, done, failed) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy') ? done() : failed(); } catch (e) { failed(); } finally { document.body.removeChild(ta); }
      }
    })();
  </script>
</body>
</html>`
}

function imgBlock(p: CardParts): string {
  return p.hasImage
    ? `<div class="mock__img${p.imageClass ? ` ${p.imageClass}` : ''}" role="img" aria-label="${p.alt}"></div>`
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
    // Keep the two declared X card treatments distinct. This is a representative
    // workspace, not a claim that every account experiment renders pixel-for-pixel.
    mock = !p.compact && p.hasImage
      ? `<div class="mock mock--x">
          <div class="mock__shot">
            <div class="mock__img${p.imageClass ? ` ${p.imageClass}` : ''}" role="img" aria-label="${p.alt}"></div>
            <span class="mock__domain">${p.host}</span>
          </div>
        </div>`
      : `<div class="mock mock--x">
          <div class="mock__summary${p.compact && p.hasImage ? ' mock__summary--with-image' : ''}">
            <div class="mock__body">
              <div class="mock__site">${p.host}</div>
              <div class="mock__title mock__line-clamp">${p.title}</div>
              ${p.desc ? `<div class="mock__desc mock__line-clamp">${p.desc}</div>` : ''}
            </div>
            ${p.compact && p.hasImage ? `<div class="mock__thumb${p.imageClass ? ` ${p.imageClass}` : ''}" role="img" aria-label="${p.alt}"></div>` : ''}
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
      <h3 class="card__name">${escapeHtml(label)}</h3>
      <span class="card__note">${escapeHtml(note)}</span>
    </div>
    ${mock}
  </article>`
}

type CopyTarget = 'issues' | 'facts' | 'snippet' | 'repair' | 'agent'

function copyButton(target: CopyTarget, label: string, primary = false): string {
  return `<button class="copy-btn${primary ? ' copy-btn--primary' : ''}" type="button" data-copy-target="${target}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    <span class="copy-btn__label">${escapeHtml(label)}</span>
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
    payloads.issues = buildFindingsText(report)
  }
  payloads.repair = buildRepairBrief(report)
  payloads.agent = buildAgentPrompt(report)
  payloads.snippet = buildMetaSnippet(report)

  const width = Math.max(...facts.map((f) => f.key.length))
  payloads.facts = `metaprev — ${report.finalUrl}\n\n${facts
    .map((f) => `${f.key.padEnd(width)}  ${f.value ? `${f.value}${f.count ? ` (${f.count})` : ''}` : '—'}`)
    .join('\n')}\n`

  return payloads
}

function escapeForScriptJson(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
