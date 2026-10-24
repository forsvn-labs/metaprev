import { imageSize } from 'image-size'
import { parseMeta } from '../../app/src/parse.ts'
import { validate } from '../../app/src/validate.ts'
import { resolvePlatformInput } from '../../app/src/inputs.ts'
import type { Report, ImageProbe } from '../../app/src/types.ts'
import { fetchPublic, parseTarget } from './public-fetch.ts'

export type WebReport = Report & {
  preview: { title: string; description: string; image: string | null; siteName: string; domain: string }
  durationMs: number
}

export async function inspectUrl(input: string): Promise<WebReport> {
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
      // Store only verified raster bytes in the bounded memory cache. Clients
      // receive an opaque same-origin URL, never an arbitrary proxy URL.
      if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(dimensions.type ?? '')) {
        previewImage = storeImage(fetched.body, detectedContentType)
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

const images = new Map<string, { bytes: Uint8Array; type: string; expires: number }>()
let imageBytes = 0
const IMAGE_CACHE_BYTES = 24 * 1024 * 1024
const IMAGE_TTL = 5 * 60_000
function pruneImages(): void {
  for (const [key, image] of images) {
    if (image.expires <= Date.now() || imageBytes > IMAGE_CACHE_BYTES) {
      imageBytes -= image.bytes.length
      images.delete(key)
    }
  }
}
const cacheTimer = setInterval(pruneImages, 60_000)
cacheTimer.unref()

function storeImage(bytes: Uint8Array, type: string): string {
  const key = crypto.randomUUID()
  images.set(key, { bytes, type, expires: Date.now() + IMAGE_TTL })
  imageBytes += bytes.length
  pruneImages()
  return `/api/image?id=${key}`
}

export function readImage(key: string): { bytes: Uint8Array; type: string } | undefined {
  pruneImages()
  return images.get(key)
}
