import { inspectWith } from './inspect-core.ts'
import { fetchPublic } from './public-fetch.ts'
export type { WebReport } from './inspect-core.ts'
export const inspectUrl = (input: string) => inspectWith(input, fetchPublic, storeImage)

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
