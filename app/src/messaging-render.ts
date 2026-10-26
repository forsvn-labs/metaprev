import { messagingSurfaces, resolveMessagingPreview, type MessagingPreview } from './messaging.ts'
import type { Report } from './types.ts'

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function safeHref(value: string): string | undefined {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}
function safeImage(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (/^data:image\/(?:png|jpeg|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(value)) return value
  if (/^\/api\/image\?id=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value
  return undefined
}
function mock(preview: MessagingPreview, domain: string, image: string | undefined, compact = false, backgroundImage = false): string {
  if (preview.surface.status === 'unverified') return ''
  const alt = escape(preview.imageAlt || `Share image for ${domain}`)
  const media = image && backgroundImage
    ? `<div class="messaging-card__image raster-og" role="img" aria-label="${alt}"></div>`
    : image
    ? `<img class="messaging-card__image" src="${escape(image)}" alt="${alt}" loading="lazy" decoding="async" data-preview-img>`
    : '<div class="messaging-card__image messaging-card__empty">Image not available</div>'
  const text = `<div class="messaging-card__text"><span class="messaging-card__domain">${escape(domain)}</span>
    <b class="messaging-card__title" dir="auto">${escape(preview.title.value || '(no title)')}</b>
    ${preview.description?.value ? `<p class="messaging-card__description" dir="auto">${escape(preview.description.value)}</p>` : ''}</div>`
  const layout = compact ? 'compact' : preview.surface.layout
  return `<div class="messaging-card messaging-card--${preview.surface.id} messaging-card--${layout}">${layout === 'text-first' ? text + media : media + text}</div>`
}

/** Only validated bytes or an opaque same-origin cache path can become images. */
export function renderMessagingCards(report: Report, previewImage?: string | null, imageMode: 'inline' | 'og-background' = 'inline'): string {
  const href = safeHref(report.finalUrl)
  const domain = href ? new URL(href).hostname : 'Invalid page URL'
  const image = report.meta.ogImage && report.image?.ok ? safeImage(previewImage ?? undefined) : undefined
  const url = href ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(href)}</a>` : 'No safe HTTP(S) page URL'
  return `<section class="messaging" aria-label="Messaging previews">
    <h2 class="messaging__heading">Messaging previews</h2>
    <p class="messaging__intro">No messaging accounts connected. These are local simulations from this inspection, not sent messages or live platform results. Frames are illustrative; client versions, settings and caches can change the result.</p>
    <div class="messaging__grid">${messagingSurfaces.map(surface => {
      const preview = resolveMessagingPreview(report.meta, surface.id)
      const source = surface.status === 'unverified' ? 'No metadata rendering assumed' : `Title: ${preview.title.source}${preview.title.fallback && preview.title.value ? ' (workspace fallback)' : ''} · Image: ${preview.imageUrl ? 'og:image' : 'none'}`
      return `<article class="messaging-surface" data-messaging-surface="${surface.id}">
        <header class="messaging-surface__head"><h3>${surface.label}</h3><span class="messaging-surface__status">${surface.status === 'unverified' ? 'Needs live verification' : 'Simulated preview'}</span></header>
        ${mock(preview, domain, image, false, imageMode === 'og-background')}
        <div class="messaging-surface__url">${url}</div>
        <p class="messaging-surface__source">${escape(source)}${preview.description ? ` · Description: ${escape(preview.description.source)}` : ''}</p>
        <p>${escape(surface.note)}</p>
        ${surface.id === 'telegram' ? `<details data-messaging-size><summary>Compare a compact media example</summary>${mock(preview, domain, image, true, imageMode === 'og-background')}<p>This local example does not set Telegram's media preference.</p></details>` : ''}
        ${surface.status === 'simulated' ? `<details data-messaging-disabled><summary>When a preview is unavailable</summary><div class="messaging-surface__url">${url}</div><p>The link can remain visible when a client or sender suppresses the preview. This example makes no network request.</p></details>` : ''}
        <details><summary>Sources and integration limits</summary><p>Open Graph, then page-level text, is this workspace's policy. It is not a promise of vendor fallback order.</p><p>${escape(surface.integration)}</p><a href="${escape(surface.source.url)}" target="_blank" rel="noopener noreferrer">${escape(surface.source.label)} ↗</a><p>Sources checked 26 October 2026. No live-client capture is attached.</p></details>
      </article>`
    }).join('')}</div>
  </section>`
}

// Mirrored in the public static CSS because that context prohibits inline CSS.
export const messagingStyles = `
.messaging { margin: 36px 0; color: inherit; font-family: system-ui, sans-serif; }
.messaging__heading { margin: 0 0 10px; font-size: 1.25rem; }
.messaging__intro { max-width: 82ch; line-height: 1.6; }
.messaging__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 20px; }
.messaging-surface { min-width: 0; padding: 18px; border: 1px solid currentColor; border-radius: 12px; }
.messaging-surface__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 14px; }
.messaging-surface__head h3 { margin: 0; font-size: 1rem; }
.messaging-surface__status { font-size: .75rem; }
.messaging-surface p, .messaging-surface details { font-size: .8125rem; line-height: 1.6; margin: 12px 0 0; }
.messaging-surface summary { cursor: pointer; padding: 5px 0; font-weight: 600; }
.messaging-surface a { color: inherit; text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
.messaging-surface__source { overflow-wrap: anywhere; font-family: ui-monospace, monospace; }
.messaging-surface__url { padding-top: 10px; font-size: .8125rem; overflow-wrap: anywhere; }
.messaging-card { overflow: hidden; border: 1px solid #c8cdd3; border-radius: 12px; background: #f3f4f6; color: #17212b; }
.messaging-card__image { display: block; width: 100%; aspect-ratio: 1.91 / 1; object-fit: cover; min-width: 0; background-size: cover; background-position: center; }
.messaging-card__empty { display: grid; place-items: center; padding: 8px; background: #e2e6eb; color: #424b58; font-size: .75rem; }
.messaging-card__text { min-width: 0; padding: 12px; }
.messaging-card__domain { display: block; font-size: .75rem; color: #455568; overflow-wrap: anywhere; }
.messaging-card__title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; margin-top: 4px; font-size: .9375rem; line-height: 1.4; }
.messaging-card .messaging-card__description { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; overflow-wrap: anywhere; margin: 4px 0 0; font-size: .8125rem; line-height: 1.5; }
.messaging-card--imessage { border-radius: 18px; background: #e9e9eb; }
.messaging-card--telegram { border-left: 3px solid #2981a3; background: #edf7fb; }
.messaging-card--slack { border: 0; border-left: 3px solid #979ca3; border-radius: 0; background: #fff; }
.messaging-card--compact { display: grid; grid-template-columns: 80px minmax(0, 1fr); align-items: start; }
.messaging-card--compact .messaging-card__image { aspect-ratio: 1; height: 80px; }
.messaging-surface details .messaging-card { margin-top: 10px; }
[data-appearance='dark'] .messaging-card, [data-card-appearance='dark'] .messaging-card { background: #242e3a; color: #f0f4f8; border-color: #627080; }
[data-appearance='dark'] .messaging-card__domain, [data-card-appearance='dark'] .messaging-card__domain { color: #c2d1e1; }
@media (max-width: 700px) { .messaging__grid { grid-template-columns: minmax(0, 1fr); } .messaging-surface { padding: 14px; } }
`
