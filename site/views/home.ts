// Home page and result views. Every page-controlled string passes through `e`.
// The CSP allows no inline styles, so geometry comes from HTML or SVG attributes.
import type { WebReport } from '../lib/inspect.ts'
import { escapeHtml as e } from '../lib/html.ts'
import { guides } from '../data/guides.ts'
import { resolvePlatformInput } from '../../app/src/inputs.ts'
import { buildFindingsText, buildMetaSnippet } from '../../app/src/repair.ts'
import { formatBytes } from '../../app/src/format.ts'
import { validate } from '../../app/src/validate.ts'

type Meta = WebReport['meta']
type Issue = WebReport['issues'][number]
type Probe = NonNullable<WebReport['image']>
type Level = Issue['level']
type Platform = 'facebook' | 'x' | 'linkedin' | 'discord'

const GITHUB = 'https://github.com/forsvn-labs/metaprev'
const FORSVN = 'https://forsvn.com'
const CARD_RATIO = 1200 / 630
const RATIO_TOLERANCE = 0.02
const IMAGE_PATH = /^\/api\/image\?id=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── small helpers ─────────────────────────────────────────────────────────

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function safeImagePath(value: string | null | undefined): string | null {
  return value && IMAGE_PATH.test(value) ? value : null
}

function safeHref(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function external(href: string, label: string, className = ''): string {
  return `<a${className ? ` class="${className}"` : ''} href="${e(href)}" target="_blank" rel="noopener noreferrer">${label}<span class="ext" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`
}

function imageType(probe: Probe | undefined): string | undefined {
  const type = probe?.detectedContentType ?? probe?.contentType?.split(';')[0]?.trim()
  return type ? type.replace(/^image\//, '').replace('svg+xml', 'svg').toUpperCase() : undefined
}

function imageSummary(probe: Probe | undefined): string | undefined {
  if (!probe?.ok) return undefined
  return [
    probe.width && probe.height ? `${probe.width} × ${probe.height}` : undefined,
    imageType(probe),
    probe.byteLength != null ? formatBytes(probe.byteLength) : undefined,
  ].filter(Boolean).join(' · ') || undefined
}

// Same wording and math as the CLI workspace, so web and local reports agree.
function cropSentence(width?: number, height?: number): string {
  if (!width || !height) return 'The crop cannot be calculated without decoded dimensions.'
  const ratio = width / height
  if (Math.abs(ratio - CARD_RATIO) / CARD_RATIO <= RATIO_TOLERANCE) return 'Fits the 1.91:1 card frame with no material crop.'
  if (ratio < CARD_RATIO) return `A centered cover crop hides about ${Math.round((1 - ratio / CARD_RATIO) * 100)}% of the image height, split between top and bottom.`
  return `A centered cover crop hides about ${Math.round((1 - CARD_RATIO / ratio) * 100)}% of the image width, split between the left and right edges.`
}

// ── icons ─────────────────────────────────────────────────────────────────

const ICON: Record<Level | 'ok' | 'copy', string> = {
  error: '<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.25"/><path d="M7.6 7.6l4.8 4.8M12.4 7.6l-4.8 4.8"/></svg>',
  warn: '<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.3l7.2 12.7H2.8z"/><path d="M10 8.3v3.4M10 13.8v.2"/></svg>',
  info: '<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.25"/><path d="M10 9.2v4.4M10 6.4v.2"/></svg>',
  ok: '<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.25"/><path d="M6.9 10.2l2.1 2.1 4.2-4.6"/></svg>',
  copy: '<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="9.5" height="9.5" rx="1.5"/><path d="M13 4.6V4a1 1 0 0 0-1-1H4.5a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h.6"/></svg>',
}

// Platform marks only label the representative mocks.
const MARK: Record<Platform, string> = {
  facebook: '<svg class="pmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07c0 6 4.39 10.97 10.13 11.87v-8.4H7.08v-3.47h3.05V9.43c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.4C19.62 23.04 24 18.07 24 12.07z"/></svg>',
  x: '<svg class="pmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z"/></svg>',
  linkedin: '<svg class="pmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
  discord: '<svg class="pmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.32 4.37A19.79 19.79 0 0 0 15.43 2.86a.07.07 0 0 0-.08.04c-.21.37-.44.86-.61 1.25a18.27 18.27 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04c-1.71.3-3.35.81-4.88 1.51a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .09-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.65-1.87.89a.08.08 0 0 0-.04.11c.36.69.78 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .04-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z"/></svg>',
}

// metaprev mark: a 1.91:1 card inside four crop marks. Same drawing as /mark.svg.
const SITE_MARK = '<svg class="wordmark__mark" viewBox="0 0 32 32" aria-hidden="true"><path class="wordmark__crop" d="M2.5 12h4M9 5.5v4M29.5 12h-4M23 5.5v4M2.5 20h4M9 26.5v-4M29.5 20h-4M23 26.5v-4"/><rect class="wordmark__card" x="9" y="12" width="14" height="8"/></svg>'

const FORSVN_GLYPH = '<svg class="forsvn-glyph" viewBox="172 115 736.5 849.164" aria-hidden="true"><path d="M276.492 580.673 L619.5 115 L429.702 580.673 Z M527.57 731.164 L172 731.164 L259.172 607.364 L578.612 607.364 Z M804.008 498.492 L461 964.164 L650.798 498.492 Z M552.93 348 L908.5 348 L821.328 471.801 L501.888 471.801 Z"/></svg>'

const CROP_MARKS = '<span class="cm cm--tl" aria-hidden="true"></span><span class="cm cm--tr" aria-hidden="true"></span><span class="cm cm--bl" aria-hidden="true"></span><span class="cm cm--br" aria-hidden="true"></span>'

const FPO = '<svg class="fpo" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0L100 100M100 0L0 100" vector-effect="non-scaling-stroke"/></svg>'

function copyButton(key: string, label: string, variant = ''): string {
  return `<button class="btn${variant ? ` btn--${variant}` : ''}" type="button" data-copy="${key}" hidden>${ICON.copy}<span data-copy-label>${e(label)}</span></button>`
}

// ── site chrome (shared with article pages) ───────────────────────────────

export function renderSiteHeader(): string {
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="site-header__inner">
    <a class="wordmark" href="/">${SITE_MARK}<span class="wordmark__text">metaprev</span></a>
    <nav class="site-nav" aria-label="Main">
      <a href="/guides">Guides</a>
      <a href="/about">About</a>
      ${external(GITHUB, 'GitHub')}
    </nav>
  </div>
</header>`
}

export function renderSiteFooter(): string {
  return `<footer class="site-footer">
  <div class="site-footer__inner">
    <p class="site-footer__made"><a href="${FORSVN}" target="_blank" rel="noopener noreferrer">${FORSVN_GLYPH}<span>A FORSVN product</span><span class="ext" aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></p>
    <nav class="site-footer__nav" aria-label="Footer">
      <a href="/guides">Guides</a>
      <a href="/about">About</a>
      <a href="/privacy">Privacy</a>
      ${external(GITHUB, 'Source')}
    </nav>
    <p class="site-footer__fine">MIT licence. Cards are representative previews, not platform screenshots.</p>
  </div>
</footer>`
}

// ── image states and card mocks ───────────────────────────────────────────

type ImageState =
  | { kind: 'image'; src: string; alt: string; width?: number; height?: number }
  | { kind: 'empty'; label: string }

function ogImageState(report: WebReport, host: string): ImageState {
  const src = safeImagePath(report.preview.image)
  if (src) {
    return { kind: 'image', src, alt: report.meta.ogImageAlt || `Share image for ${host}`, width: report.image?.width, height: report.image?.height }
  }
  if (!report.meta.ogImage) return { kind: 'empty', label: 'No og:image' }
  if (report.image && !report.image.ok) return { kind: 'empty', label: 'Image did not load' }
  if (imageType(report.image) === 'SVG') return { kind: 'empty', label: 'SVG is not previewed' }
  return { kind: 'empty', label: 'Image not previewed' }
}

function xImageState(report: WebReport, og: ImageState): ImageState {
  const m = report.meta
  if (m.twitterImage && m.twitterImage !== m.ogImage) return { kind: 'empty', label: 'twitter:image not fetched' }
  if (!m.twitterImage && !m.ogImage) return { kind: 'empty', label: 'No card image' }
  return og.kind === 'image' ? { ...og, alt: m.twitterImageAlt || og.alt } : og
}

function media(state: ImageState, className = 'mock__media'): string {
  if (state.kind === 'empty') return `<div class="${className} is-empty">${FPO}<span class="mock__empty">${e(state.label)}</span></div>`
  const size = state.width && state.height ? ` width="${state.width}" height="${state.height}"` : ''
  return `<div class="${className}"><img src="${e(state.src)}" alt="${e(state.alt)}"${size} loading="lazy" decoding="async" data-preview-img></div>`
}

type CardText = { host: string; site: string; title: string; description: string }

function facebookMock(t: CardText, image: ImageState): string {
  return `<div class="mock mock--fb">
    ${media(image)}
    <div class="mock__body">
      <div class="mock__site">${e(t.host)}</div>
      <div class="mock__title clamp" dir="auto">${e(t.title)}</div>
      ${t.description ? `<div class="mock__desc clamp" dir="auto">${e(t.description)}</div>` : ''}
    </div>
  </div>`
}

function xMock(t: CardText, image: ImageState, compact: boolean): string {
  if (!compact && image.kind === 'image') {
    return `<div class="mock mock--x"><div class="mock__shot">${media(image)}<span class="mock__domain">${e(t.host)}</span></div></div>`
  }
  if (!compact && image.kind === 'empty' && image.label === 'twitter:image not fetched') {
    return `<div class="mock mock--x"><div class="mock__shot">${media(image)}<span class="mock__domain">${e(t.host)}</span></div></div>`
  }
  const thumb = compact && (image.kind === 'image' || image.label === 'twitter:image not fetched')
  return `<div class="mock mock--x">
    <div class="mock__summary${thumb ? ' has-thumb' : ''}">
      ${thumb ? media(image, 'mock__thumb') : ''}
      <div class="mock__body">
        <div class="mock__site">${e(t.host)}</div>
        <div class="mock__title clamp" dir="auto">${e(t.title)}</div>
        ${t.description ? `<div class="mock__desc clamp" dir="auto">${e(t.description)}</div>` : ''}
      </div>
    </div>
  </div>`
}

function linkedinMock(t: CardText, image: ImageState): string {
  return `<div class="mock mock--li">
    ${media(image)}
    <div class="mock__body">
      <div class="mock__title clamp" dir="auto">${e(t.title)}</div>
      <div class="mock__site">${e(t.host)}</div>
    </div>
  </div>`
}

function discordMock(t: CardText, image: ImageState): string {
  return `<div class="mock mock--dc">
    <div class="mock__body">
      <div class="mock__site" dir="auto">${e(t.site)}</div>
      <div class="mock__title clamp" dir="auto">${e(t.title)}</div>
      ${t.description ? `<div class="mock__desc clamp" dir="auto">${e(t.description)}</div>` : ''}
    </div>
    ${media(image)}
  </div>`
}

// ── tag map: which tag fed each region of a card ─────────────────────────

type MapRow = {
  region: string
  source?: string
  value?: string
  state: 'ok' | 'fallback' | 'missing' | 'failed' | 'unpreviewed' | 'unset' | 'hidden' | 'unfetched'
  note?: string
}

const FLAG: Record<MapRow['state'], string> = {
  ok: '',
  fallback: '<span class="flag flag--warn">fallback</span>',
  missing: '<span class="flag flag--error">missing</span>',
  failed: '<span class="flag flag--error">did not load</span>',
  unpreviewed: '<span class="flag flag--warn">not previewed</span>',
  unset: '<span class="flag">not set</span>',
  hidden: '<span class="flag">not shown</span>',
  unfetched: '<span class="flag">not fetched</span>',
}

function tagMap(rows: MapRow[]): string {
  return `<dl class="tagmap">${rows.map(row => `
    <div class="tagmap__row tagmap__row--${row.state}">
      <dt>${e(row.region)}</dt>
      <dd>
        <span class="tagmap__src">${row.source ? `<code>${e(row.source)}</code>` : ''}${FLAG[row.state]}</span>
        ${row.value ? `<span class="tagmap__val" dir="auto">${e(row.value)}</span>` : ''}
        ${row.note ? `<span class="tagmap__note">${e(row.note)}</span>` : ''}
      </dd>
    </div>`).join('')}
  </dl>`
}

function textRow(region: string, meta: Meta, platform: 'Open Graph' | 'X', field: 'title' | 'description', hidden = false): MapRow {
  const resolved = resolvePlatformInput(meta, platform, field)
  if (!resolved.value) return { region, state: 'missing', note: field === 'title' ? 'No title tag the card can use.' : 'No description tag the card can use.' }
  return { region, source: resolved.source, value: resolved.value, state: hidden ? 'hidden' : resolved.fallback ? 'fallback' : 'ok' }
}

function imageProblem(report: WebReport): Pick<MapRow, 'state' | 'note'> {
  if (report.image && !report.image.ok) return { state: 'failed', note: report.image.error ?? 'The image request did not succeed.' }
  if (imageType(report.image) === 'SVG') return { state: 'unpreviewed', note: 'SVG images are not embedded in previews.' }
  return { state: 'unpreviewed', note: 'This image format is not previewed on the web.' }
}

function ogImageRow(report: WebReport, image: ImageState): MapRow {
  if (!report.meta.ogImage) return { region: 'Image', state: 'missing', note: 'No og:image tag.' }
  if (image.kind === 'empty') return { region: 'Image', source: 'og:image', ...imageProblem(report) }
  return { region: 'Image', source: 'og:image', state: 'ok', value: imageSummary(report.image) }
}

function xImageRow(report: WebReport, image: ImageState): MapRow {
  const m = report.meta
  if (m.twitterImage && m.twitterImage !== m.ogImage) {
    return { region: 'Image', source: 'twitter:image', state: 'unfetched', value: m.twitterImage, note: 'The web check fetches og:image only. The CLI previews a separate twitter:image.' }
  }
  if (!m.twitterImage && !m.ogImage) return { region: 'Image', state: 'missing', note: 'No twitter:image or og:image tag.' }
  const source = m.twitterImage ? 'twitter:image' : 'og:image'
  if (image.kind === 'empty') return { region: 'Image', source, ...imageProblem(report) }
  return { region: 'Image', source, state: m.twitterImage ? 'ok' : 'fallback', value: imageSummary(report.image) }
}

// ── platform panels ───────────────────────────────────────────────────────

type Panel = { key: Platform; label: string; mock: string; rows: MapRow[]; slug: string }

function platformPanels(report: WebReport): Panel[] {
  const m = report.meta
  const host = hostOf(report.finalUrl) || report.preview.domain
  const site = m.ogSiteName || host
  const og = ogImageState(report, host)
  const x = xImageState(report, og)
  const compact = m.twitterCard === 'summary'
  const ogText: CardText = {
    host, site,
    title: resolvePlatformInput(m, 'Open Graph', 'title').value || '(no title)',
    description: resolvePlatformInput(m, 'Open Graph', 'description').value ?? '',
  }
  const xText: CardText = {
    host, site,
    title: resolvePlatformInput(m, 'X', 'title').value || '(no title)',
    description: resolvePlatformInput(m, 'X', 'description').value ?? '',
  }
  const xLarge = !compact && (x.kind === 'image' || x.label === 'twitter:image not fetched')
  const ogImageSlug = !m.ogImage ? 'no og:image'
    : report.image && !report.image.ok ? 'og:image did not load'
    : og.kind === 'image' ? `og:image ${imageSummary(report.image) ?? ''}`.trim()
    : 'og:image not previewed'
  const ogSlug = [ogImageSlug, cropSlug(report.image)].filter(Boolean).join(' · ')
  const domainRow: MapRow = { region: 'Domain', source: 'final URL', value: host, state: 'ok' }
  return [
    {
      key: 'facebook', label: 'Facebook', mock: facebookMock(ogText, og), slug: `Open Graph path · ${ogSlug}`,
      rows: [domainRow, textRow('Title', m, 'Open Graph', 'title'), textRow('Description', m, 'Open Graph', 'description'), ogImageRow(report, og)],
    },
    {
      key: 'x', label: 'X', mock: xMock(xText, x, compact),
      slug: `twitter:card ${m.twitterCard ? m.twitterCard : 'not set'} · ${xLarge ? 'large image card' : !compact && m.twitterCard === 'summary_large_image' ? 'no usable image, drawn as a summary card' : 'summary card'}`,
      rows: [
        m.twitterCard
          ? { region: 'Card type', source: 'twitter:card', value: m.twitterCard, state: 'ok', note: m.twitterCard === 'summary' || m.twitterCard === 'summary_large_image' ? undefined : 'This card type is kept but not drawn here.' }
          : { region: 'Card type', source: 'twitter:card', state: 'unset', note: 'X may choose its own treatment.' },
        xLarge ? { ...textRow('Title', m, 'X', 'title', true), note: 'This representative large image card shows the image and domain only.' } : textRow('Title', m, 'X', 'title'),
        xLarge ? textRow('Description', m, 'X', 'description', true) : textRow('Description', m, 'X', 'description'),
        xImageRow(report, x),
        domainRow,
      ],
    },
    {
      key: 'linkedin', label: 'LinkedIn', mock: linkedinMock(ogText, og), slug: `Open Graph path · ${ogSlug}`,
      rows: [textRow('Title', m, 'Open Graph', 'title'), ogImageRow(report, og), domainRow, { ...textRow('Description', m, 'Open Graph', 'description', true), note: 'This representative card omits the description.' }],
    },
    {
      key: 'discord', label: 'Discord', mock: discordMock(ogText, og), slug: `Open Graph path · ${ogSlug}`,
      rows: [
        m.ogSiteName ? { region: 'Site name', source: 'og:site_name', value: m.ogSiteName, state: 'ok' } : { region: 'Site name', source: 'final URL', value: host, state: 'fallback', note: 'No og:site_name; the host is shown.' },
        textRow('Title', m, 'Open Graph', 'title'),
        textRow('Description', m, 'Open Graph', 'description'),
        ogImageRow(report, og),
      ],
    },
  ]
}

function cropSlug(probe: Probe | undefined): string | undefined {
  if (!probe?.ok || !probe.width || !probe.height) return undefined
  const ratio = probe.width / probe.height
  if (Math.abs(ratio - CARD_RATIO) / CARD_RATIO <= RATIO_TOLERANCE) return 'fits 1.91:1'
  const hidden = ratio < CARD_RATIO ? Math.round((1 - ratio / CARD_RATIO) * 100) : Math.round((1 - CARD_RATIO / ratio) * 100)
  return `cover crop hides ${hidden}%`
}

function renderPanels(report: WebReport): string {
  const panels = platformPanels(report)
  return `<div class="previews" data-tabs data-card-appearance="light">
    <div class="tabbar" data-tablist aria-label="Platform previews" hidden>
      ${panels.map((p, i) => `<button class="tab" type="button" id="mp-tab-${p.key}" data-tab="${p.key}"${i === 0 ? ' aria-selected="true"' : ''}>${MARK[p.key]}<span>${e(p.label)}</span></button>`).join('')}
    </div>
    ${panels.map(p => `<section class="platform" id="mp-panel-${p.key}" data-tabpanel="${p.key}" aria-labelledby="mp-h-${p.key}">
      <h4 class="platform__name" id="mp-h-${p.key}">${MARK[p.key]}<span>${e(p.label)}</span></h4>
      <div class="platform__body">
        <figure class="proof">
          <div class="proof__trim">${CROP_MARKS}${p.mock}</div>
          <figcaption class="slug">${e(p.slug)}</figcaption>
        </figure>
        <div class="platform__map">
          <h5 class="map-title">What this card reads</h5>
          ${tagMap(p.rows)}
        </div>
      </div>
    </section>`).join('')}
  </div>`
}

// ── findings, image, tags, repair ─────────────────────────────────────────

const LEVEL_LABEL: Record<Level, string> = { error: 'Error', warn: 'Warning', info: 'Note' }

function renderFinding(issue: Issue): string {
  return `<li class="finding finding--${issue.level}">
    <div class="finding__head">
      <span class="level level--${issue.level}">${ICON[issue.level]}${LEVEL_LABEL[issue.level]}</span>
      <code class="finding__field">${e(issue.field)}</code>
      <code class="finding__code">${e(issue.code)}</code>
    </div>
    <p class="finding__msg">${e(issue.message)}</p>
    <p class="finding__fix"><span class="finding__label">Fix</span> ${e(issue.fix)}</p>
    <details class="finding__more">
      <summary>Impact and evidence</summary>
      <dl>
        <div><dt>Impact</dt><dd>${e(issue.impact)}</dd></div>
        <div><dt>Evidence</dt><dd>${e(issue.evidence)}</dd></div>
      </dl>
    </details>
  </li>`
}

function renderFindings(issues: Issue[]): string {
  if (!issues.length) {
    return `<div class="clean">${ICON.ok}<div><p class="clean__title">No issues found in the share tags.</p><p class="clean__body">Still compare the cards and the crop before you post.</p></div></div>`
  }
  return `<ol class="findings">${issues.map(renderFinding).join('')}</ol>`
}

type TrimBox = { x: number; y: number; w: number; h: number }

function trimBox(width: number, height: number): TrimBox {
  const ratio = width / height
  if (Math.abs(ratio - CARD_RATIO) / CARD_RATIO <= RATIO_TOLERANCE) return { x: 0, y: 0, w: width, h: height }
  if (ratio < CARD_RATIO) {
    const h = width / CARD_RATIO
    return { x: 0, y: (height - h) / 2, w: width, h }
  }
  const w = height * CARD_RATIO
  return { x: (width - w) / 2, y: 0, w, h: height }
}

// The whole asset with the 1.91:1 cover trim drawn over it. Geometry lives in
// SVG attributes because the CSP forbids inline style.
function trimFigure(assetHtml: string, width: number, height: number, caption: string): string {
  const box = trimBox(width, height)
  const r = (n: number) => Math.round(n * 10) / 10
  const shade = box.w === width && box.h === height
    ? ''
    : `<path class="trim__shade" fill-rule="evenodd" d="M0 0H${width}V${height}H0Z M${r(box.x)} ${r(box.y)}H${r(box.x + box.w)}V${r(box.y + box.h)}H${r(box.x)}Z"/>`
  return `<figure class="proof proof--asset">
    <div class="proof__trim trim">${CROP_MARKS}${assetHtml}
      <svg class="trim__overlay" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${shade}<rect class="trim__box" x="${r(box.x)}" y="${r(box.y)}" width="${r(box.w)}" height="${r(box.h)}" vector-effect="non-scaling-stroke"/></svg>
    </div>
    <figcaption class="slug">${e(caption)}</figcaption>
  </figure>`
}

function renderImageBlock(report: WebReport): string {
  const probe = report.image
  const src = safeImagePath(report.preview.image)
  const host = hostOf(report.finalUrl)
  let figure: string
  if (src && probe?.width && probe.height) {
    const img = `<img class="trim__img" src="${e(src)}" alt="${e(report.meta.ogImageAlt || `Share image for ${host}`)}" width="${probe.width}" height="${probe.height}" loading="lazy" decoding="async" data-preview-img>`
    figure = trimFigure(img, probe.width, probe.height, `Whole asset · dashed line marks the 1.91:1 card trim`)
  } else {
    const label = ogImageState(report, host)
    figure = `<div class="asset-empty">${FPO}<span>${e(label.kind === 'empty' ? label.label : 'Dimensions unknown')}</span></div>`
  }
  const facts: Array<[string, string | undefined]> = [
    ['Crop', probe?.ok ? cropSentence(probe.width, probe.height) : undefined],
    ['Decoded size', probe?.width && probe.height ? `${probe.width} × ${probe.height} px · ${(probe.width / probe.height).toFixed(2)}:1` : undefined],
    ['Response type', probe?.contentType?.split(';')[0]?.trim()],
    ['Detected type', probe?.detectedContentType && probe.detectedContentType !== probe.contentType?.split(';')[0]?.trim() ? probe.detectedContentType : undefined],
    ['File size', probe?.byteLength != null ? formatBytes(probe.byteLength) : undefined],
    ['Problem', probe && !probe.ok ? probe.error ?? 'The image did not load.' : undefined],
    ['og:image', report.meta.ogImage],
  ]
  const rows = facts.filter((f): f is [string, string] => Boolean(f[1]))
  return `${figure}
  ${rows.length ? `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${k === 'og:image' ? `<code>${e(k)}</code>` : e(k)}</dt><dd${k === 'og:image' ? ' class="mono"' : ''}>${e(v)}</dd></div>`).join('')}</dl>` : '<p class="muted">No og:image tag was found, so there is no asset to inspect.</p>'}`
}

const TAG_ROWS: Array<[string, keyof Meta, boolean]> = [
  ['<title>', 'title', true],
  ['meta description', 'description', true],
  ['link rel="canonical"', 'canonical', false],
  ['og:title', 'ogTitle', true],
  ['og:description', 'ogDescription', true],
  ['og:url', 'ogUrl', false],
  ['og:type', 'ogType', false],
  ['og:site_name', 'ogSiteName', false],
  ['og:image', 'ogImage', false],
  ['og:image:alt', 'ogImageAlt', true],
  ['og:image:width', 'ogImageWidth', false],
  ['og:image:height', 'ogImageHeight', false],
  ['twitter:card', 'twitterCard', false],
  ['twitter:site', 'twitterSite', false],
  ['twitter:title', 'twitterTitle', true],
  ['twitter:description', 'twitterDescription', true],
  ['twitter:image', 'twitterImage', false],
  ['twitter:image:alt', 'twitterImageAlt', true],
]

function renderTags(meta: Meta): string {
  const found = TAG_ROWS.filter(([, key]) => meta[key]).length
  return `<p class="block__note">${found} of ${TAG_ROWS.length} share tags found in the HTML head.</p>
  <div class="tags-wrap"><table class="tags">
    <thead><tr><th scope="col">Tag</th><th scope="col">Value</th><th scope="col"><span class="sr-only">Length in </span>Characters</th></tr></thead>
    <tbody>${TAG_ROWS.map(([tag, key, counted]) => {
      const value = meta[key]
      return `<tr${value ? '' : ' class="is-missing"'}><th scope="row"><code>${e(tag)}</code></th><td dir="auto">${value ? e(value) : '<span class="muted">Not found</span>'}</td><td class="num">${value && counted ? value.length : '<span class="muted" aria-label="Not counted">—</span>'}</td></tr>`
    }).join('')}</tbody>
  </table></div>`
}

function verdict(issues: Issue[]): { kind: Level | 'ok'; title: string; counts: string } {
  const count = (level: Level) => issues.filter(i => i.level === level).length
  const errors = count('error'), warns = count('warn'), notes = count('info')
  const counts = [errors && plural(errors, 'error'), warns && plural(warns, 'warning'), notes && plural(notes, 'note')].filter(Boolean).join(' · ') || 'No issues'
  if (errors) return { kind: 'error', title: `Fix ${plural(errors, 'error')} before you share this link`, counts }
  if (warns) return { kind: 'warn', title: `Review ${plural(warns, 'warning')} before you share`, counts }
  if (notes) return { kind: 'info', title: `No errors or warnings. ${plural(notes, 'note')} to review`, counts }
  return { kind: 'ok', title: 'No issues found in the share tags', counts }
}

// ── result fragment (server HTML for both no-JS pages and /api/inspect) ──

export function renderResult(report: WebReport): string {
  const v = verdict(report.issues)
  const href = safeHref(report.finalUrl)
  const redirected = report.source && report.source !== report.finalUrl
  const json = JSON.stringify(report, null, 2)
  return `<section class="report" data-results-content aria-labelledby="mp-report-title" tabindex="-1">
  <header class="report__head">
    <p class="verdict verdict--${v.kind}">${ICON[v.kind]}<span>${e(v.counts)}</span></p>
    <h2 class="report__title" id="mp-report-title">${e(v.title)}</h2>
    <p class="report__url">${href ? external(href, e(report.finalUrl)) : e(report.finalUrl)}</p>
    ${redirected ? `<p class="report__redirect">Redirected from <span class="mono">${e(report.source)}</span></p>` : ''}
    <dl class="report__facts">
      <div><dt>HTTP</dt><dd>${e(report.status)}</dd></div>
      <div><dt>Fetched</dt><dd><time datetime="${e(report.fetchedAt)}">${e(formatTime(report.fetchedAt))}</time></dd></div>
      ${formatDuration(report.durationMs) ? `<div><dt>Took</dt><dd>${e(formatDuration(report.durationMs))}</dd></div>` : ''}
    </dl>
    <div class="report__actions" data-copy-scope>
      ${copyButton('metadata', 'Copy metadata', 'primary')}
      ${copyButton('json', 'Copy JSON')}
    </div>
  </header>

  <section class="block" aria-labelledby="mp-previews-title">
    <div class="block__head">
      <h3 class="block__title" id="mp-previews-title">Representative cards</h3>
      <div class="seg" role="group" aria-label="Card appearance" data-appearance-group hidden>
        <button class="seg__btn" type="button" data-appearance="light" aria-pressed="true">Light</button>
        <button class="seg__btn" type="button" data-appearance="dark" aria-pressed="false">Dark</button>
      </div>
    </div>
    <p class="block__note">Built from the fetched tags and image. Platforms change layouts, run experiments and keep cached cards, so a live post can differ.</p>
    ${renderPanels(report)}
  </section>

  <div class="report__split">
    <section class="block block--findings" aria-labelledby="mp-findings-title">
      <div class="block__head">
        <h3 class="block__title" id="mp-findings-title">Findings <span class="count">${report.issues.length}</span></h3>
        ${report.issues.length ? `<div data-copy-scope>${copyButton('findings', 'Copy findings')}<pre class="sr-only" data-copy-source="findings">${e(buildFindingsText(report))}</pre></div>` : ''}
      </div>
      ${renderFindings(report.issues)}
    </section>
    <section class="block block--image" aria-labelledby="mp-image-title">
      <div class="block__head"><h3 class="block__title" id="mp-image-title">Share image</h3></div>
      ${renderImageBlock(report)}
    </section>
  </div>

  <section class="block" aria-labelledby="mp-tags-title">
    <div class="block__head"><h3 class="block__title" id="mp-tags-title">Tags found</h3></div>
    ${renderTags(report.meta)}
  </section>

  <section class="block" aria-labelledby="mp-repair-title" data-copy-scope>
    <div class="block__head">
      <h3 class="block__title" id="mp-repair-title">Metadata starting point</h3>
      ${copyButton('metadata', 'Copy metadata')}
    </div>
    <p class="block__note">Built from the observed values. Review every line; missing facts stay as comments instead of invented copy.</p>
    <pre class="code" data-copy-source="metadata"><code>${e(buildMetaSnippet(report))}</code></pre>
  </section>

  <details class="json" data-copy-scope>
    <summary>Report JSON</summary>
    <pre class="code code--json" data-copy-source="json"><code>${e(json)}</code></pre>
  </details>

  <p class="report__foot">Observed <time datetime="${e(report.fetchedAt)}">${e(formatTime(report.fetchedAt))}</time> from the page’s HTML head. Tags added by JavaScript and cards cached by platforms are outside this check.</p>
</section>`
}

// ── labeled example (empty state) ─────────────────────────────────────────

// Illustrative input for example.com, run through the real validator so the
// example findings use the same wording as a live check.
const EXAMPLE_META: Meta = {
  title: 'Spring field notes',
  ogTitle: 'Spring field notes: what changed in March',
  ogDescription: 'Release notes, fixes and the three editor changes that shipped this month.',
  ogUrl: 'https://example.com/notes/spring',
  ogType: 'article',
  ogSiteName: 'Example Notes',
  ogImage: 'https://example.com/og/spring.png',
  ogImageAlt: 'Spring field notes title above three coloured bars',
  ogImageWidth: '800',
  ogImageHeight: '800',
  twitterCard: 'summary_large_image',
}
const EXAMPLE_PROBE: Probe = {
  url: 'https://example.com/og/spring.png', resolved: 'https://example.com/og/spring.png', status: 200, ok: true,
  contentType: 'image/png', detectedContentType: 'image/png', byteLength: 96_256, width: 800, height: 800,
}
const EXAMPLE_ISSUES = validate(EXAMPLE_META, EXAMPLE_PROBE)

// A square poster whose title and date sit outside the 1.91:1 band.
function exampleArt(fit: 'slice' | 'meet', className: string, label: boolean): string {
  return `<svg class="${className}" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid ${fit}"${label ? ' role="img" aria-label="Example square share image: a title at the top, three bars in the middle and a date at the bottom"' : ' aria-hidden="true"'}>
    <rect width="800" height="800" fill="#123B5C"/>
    <text x="64" y="136" class="ex-title">SPRING</text>
    <text x="64" y="232" class="ex-title">FIELD NOTES</text>
    <rect x="64" y="330" width="208" height="236" rx="10" fill="#F5B700"/>
    <rect x="296" y="290" width="208" height="276" rx="10" fill="#FF6F59"/>
    <rect x="528" y="370" width="208" height="196" rx="10" fill="#43AA8B"/>
    <rect x="64" y="606" width="672" height="4" fill="#F2F4EF" opacity=".5"/>
    <text x="64" y="712" class="ex-date">MARCH 2026 · EXAMPLE.COM</text>
  </svg>`
}

function renderExample(): string {
  const text: CardText = {
    host: 'example.com', site: 'Example Notes',
    title: EXAMPLE_META.ogTitle ?? '', description: EXAMPLE_META.ogDescription ?? '',
  }
  const card = `<div class="mock mock--fb">
    <div class="mock__media">${exampleArt('slice', 'mock__art', true)}</div>
    <div class="mock__body">
      <div class="mock__site">${e(text.host)}</div>
      <div class="mock__title clamp">${e(text.title)}</div>
      <div class="mock__desc clamp">${e(text.description)}</div>
    </div>
  </div>`
  return `<section class="report report--example" data-example aria-labelledby="mp-example-title">
  <header class="report__head">
    <p class="example-plate"><span class="example-plate__tag">Example</span><span>Illustrative data for example.com. Not a live check.</span></p>
    <h2 class="report__title" id="mp-example-title">A square image loses its title in a 1.91:1 card</h2>
    <p class="report__lede">This is what a check returns: representative cards, the trim the image gets, and findings with their evidence.</p>
  </header>
  <div class="example">
    <figure class="proof example__card">
      <div class="proof__trim">${CROP_MARKS}${card}</div>
      <figcaption class="slug">Facebook · og:image 800 × 800 · PNG · cover crop hides 48%</figcaption>
    </figure>
    <div class="example__side">
      ${trimFigure(exampleArt('meet', 'trim__art', false), 800, 800, 'Whole asset · dashed line marks the 1.91:1 card trim')}
      <ol class="findings findings--compact">${EXAMPLE_ISSUES.map(issue => `<li class="finding finding--${issue.level}">
        <div class="finding__head"><span class="level level--${issue.level}">${ICON[issue.level]}${LEVEL_LABEL[issue.level]}</span><code class="finding__field">${e(issue.field)}</code></div>
        <p class="finding__msg">${e(issue.message)}</p>
        <p class="finding__fix"><span class="finding__label">Fix</span> ${e(issue.fix)}</p>
      </li>`).join('')}</ol>
    </div>
  </div>
</section>`
}

// ── home content ──────────────────────────────────────────────────────────

const CHECKS: Array<[string, string]> = [
  ['Required Open Graph tags', 'og:title, og:type, og:image and og:url are present. A canonical link is not treated as a substitute for og:url.'],
  ['Usable title and description', 'A share title and description exist, and every fallback is labeled. No padding to generic SEO character targets.'],
  ['Absolute image URL', 'og:image is a full HTTP(S) URL. Crawlers fetch the image on its own, so a relative path can leave the card blank.'],
  ['Image response', 'The image loads with a 2xx status, decodes as an image, and its declared type matches its bytes.'],
  ['Size, ratio and crop', 'The decoded asset is compared with the 1.91:1 frame, LinkedIn’s 1200 × 627 minimum and its 5 MB limit.'],
  ['Declared dimensions and alt text', 'Declared og:image:width and og:image:height match the decoded file, and og:image:alt describes the image.'],
  ['X card type', 'The twitter:card value is shown with the preview it maps to. Current X documentation does not publish card rules, so X findings are notes.'],
  ['Canonical share URL', 'og:url is present and absolute. The report shows it beside the inspected and final URL for you to compare.'],
]

export function renderHomeContent({ result, error, url }: { result?: WebReport; error?: string; url?: string } = {}): string {
  const value = url ?? ''
  const describedBy = error ? 'mp-url-help mp-url-error' : 'mp-url-help'
  return `${renderSiteHeader()}
<main id="main" class="home">
  <section class="tool" aria-labelledby="mp-title">
    <div class="tool__main">
    <h1 class="tool__title" id="mp-title">Catch a broken social card before you share the link.</h1>
    <p class="tool__lede">Paste a public URL. metaprev fetches the page and its share image, builds representative Facebook, X, LinkedIn and Discord cards, and lists what to fix.</p>
    <form class="check" id="mp-check" action="/inspect#mp-check" method="post" data-inspect-form>
      <label class="check__label" for="mp-url">Page URL</label>
      <div class="check__row">
        <input class="check__input" id="mp-url" name="url" type="text" inputmode="url" autocomplete="url" autocapitalize="off" autocorrect="off" spellcheck="false" required maxlength="2048" placeholder="example.com/blog/launch" value="${e(value)}" aria-describedby="${describedBy}"${error ? ' aria-invalid="true"' : ''}>
        <button class="check__submit" type="submit" data-submit><span data-submit-label>Check link</span></button>
        <span class="check__progress" data-progress aria-hidden="true"></span>
      </div>
      <p class="check__help" id="mp-url-help">Public HTTP or HTTPS pages only. For localhost and staging, run <code>npx @forsvn/metaprev</code>.</p>
      <p class="check__error" id="mp-url-error" data-error${error ? '' : ' hidden'}>${ICON.error}<span data-error-text>${e(error ?? '')}</span></p>
      <p class="check__status" data-status role="status" aria-live="polite"></p>
    </form>
    </div>
    <dl class="ticket" aria-label="What a check does">
      <div><dt>Reads</dt><dd>HTML head only, no scripts</dd></div>
      <div><dt>Tags</dt><dd>og:*, twitter:*, title tags</dd></div>
      <div><dt>Fetches</dt><dd>og:image, raster ≤ 5 MB</dd></div>
      <div><dt>Draws</dt><dd>Facebook, X, LinkedIn, Discord</dd></div>
      <div><dt>Returns</dt><dd>Findings, tags, fixes, JSON</dd></div>
    </dl>
  </section>

  <div class="results" data-results>
    ${result ? renderResult(result) : renderExample()}
  </div>

  <section class="home-section" aria-labelledby="mp-checks-title">
    <h2 class="section-title" id="mp-checks-title">What a check covers</h2>
    <p class="section-lede">Rules come from the Open Graph protocol and LinkedIn’s published sharing requirements. Each finding carries its impact, the observed evidence and a fix.</p>
    <ul class="checklist">${CHECKS.map(([title, body]) => `<li><h3>${e(title)}</h3><p>${e(body)}</p></li>`).join('')}</ul>
  </section>

  <section class="home-section home-section--split" aria-labelledby="mp-limits-title">
    <div>
      <h2 class="section-title" id="mp-limits-title">What it cannot see</h2>
      <p class="section-lede">The cards are representative. These limits are part of every result.</p>
    </div>
    <dl class="limits">
      <div><dt>Platform renderers and caches</dt><dd>Platforms change layouts, run experiments and keep earlier cards. After a fix, refresh the card with the platform’s own tool, such as the ${external('https://developers.facebook.com/tools/debug/', 'Facebook Sharing Debugger')} or ${external('https://www.linkedin.com/post-inspector/', 'LinkedIn Post Inspector')}.</dd></div>
      <div><dt>JavaScript-rendered tags</dt><dd>The check reads the HTML head as the server sends it. No page scripts run, so tags added in the browser are not seen.</dd></div>
      <div><dt>Private pages</dt><dd>Local, private and password-protected addresses are refused. Run the CLI on your own machine for those.</dd></div>
      <div><dt>Size limits</dt><dd>Up to 512 KB of HTML, four redirects, and PNG, JPEG, WebP or GIF images up to 5 MB. A separate twitter:image is not fetched on the web.</dd></div>
    </dl>
  </section>

  <section class="home-section home-section--split" aria-labelledby="mp-cli-title">
    <div>
      <h2 class="section-title" id="mp-cli-title">Check localhost and CI with the CLI</h2>
      <p class="section-lede">The same parser and rules run on your machine, against a dev server on any port, with exit codes for CI. It needs Bun and is MIT licensed.</p>
      <p class="section-link">${external(GITHUB, 'Read the CLI guide')}</p>
    </div>
    <div class="commands">
      <div class="command" data-copy-scope>
        <pre class="command__code" data-copy-source="cli-local"><code>npx @forsvn/metaprev http://localhost:3000</code></pre>
        ${copyButton('cli-local', 'Copy')}
      </div>
      <div class="command" data-copy-scope>
        <pre class="command__code" data-copy-source="cli-ci"><code>npx @forsvn/metaprev issues https://staging.example.com --json</code></pre>
        ${copyButton('cli-ci', 'Copy')}
      </div>
    </div>
  </section>

  <section class="home-section" aria-labelledby="mp-guides-title">
    <h2 class="section-title" id="mp-guides-title">Field guides</h2>
    <ul class="guide-links">${guides.map(g => `<li><a href="/guides/${e(g.slug)}"><span class="guide-links__field">${e(g.field)}</span><span class="guide-links__title">${e(g.title)}</span></a><p>${e(g.description)}</p></li>`).join('')}</ul>
  </section>
</main>
${renderSiteFooter()}`
}
