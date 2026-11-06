import { imageSize } from 'image-size'
import { parseMeta } from '../../app/src/parse.ts'
import { validate } from '../../app/src/validate.ts'
import { resolvePlatformInput } from '../../app/src/inputs.ts'
import type { Report, ImageProbe } from '../../app/src/types.ts'
import { parseTarget } from './url-policy.ts'
type FetchPage = (input: string, options: { kind: 'html' | 'image' }) => Promise<{ url: string; status: number; headers: { 'content-type'?: string }; body: Uint8Array; contentType: string }>

export type WebReport = Report & {
  preview: { title: string; description: string; image: string | null; siteName: string; domain: string }
  durationMs: number
}

export async function inspectWith(input: string, fetchPublic: FetchPage, storeImage: (bytes: Uint8Array, type: string) => string | Promise<string>): Promise<WebReport> {
  const start = performance.now()
  const source = parseTarget(input).href
  const page = await fetchPublic(source, { kind: 'html' })
  const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(page.headers['content-type'] ?? '')?.[1] ?? 'utf-8'
  let html: string
  try { html = new TextDecoder(charset).decode(page.body) }
  catch { html = new TextDecoder().decode(page.body) }
  const meta = parseMeta(html)
  let image: ImageProbe | undefined
  let previewImage: string | null = null
  if (meta.ogImage) {
    try {
      const url = new URL(meta.ogImage, page.url).href
      const fetched = await fetchPublic(url, { kind: 'image' })
      const dimensions = imageSize(fetched.body)
      const detectedContentType = dimensions.type === 'jpg' ? 'image/jpeg' : `image/${dimensions.type}`
      image = { url, resolved: fetched.url, status: fetched.status, ok: true, contentType: fetched.contentType,
        detectedContentType, byteLength: fetched.body.length, width: dimensions.width, height: dimensions.height }
      // Store only verified raster bytes in the temporary image cache. Clients
      // receive an opaque same-origin URL, never an arbitrary proxy URL.
      if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(dimensions.type ?? '')) {
        previewImage = await storeImage(fetched.body, detectedContentType)
      }
    } catch {
      image = { url: meta.ogImage, resolved: meta.ogImage, status: 0, ok: false,
        error: 'The image could not be fetched or decoded within the public web inspection limits.' }
    }
  }
  return {
    source, finalUrl: page.url, fetchedAt: new Date().toISOString(), status: page.status,
    meta, ...(image ? { image } : {}), issues: validate(meta, image),
    preview: {
      title: resolvePlatformInput(meta, 'Open Graph', 'title').value ?? 'No share title found',
      description: resolvePlatformInput(meta, 'Open Graph', 'description').value ?? '',
      image: previewImage,
      siteName: meta.ogSiteName ?? new URL(page.url).hostname,
      domain: new URL(page.url).hostname,
    },
    durationMs: Math.round(performance.now() - start),
  }
}

