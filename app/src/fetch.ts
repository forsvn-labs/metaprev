import { imageSize } from 'image-size'
import { classifyUrlHost } from './host.ts'
import type { ImageProbe } from './types.ts'

const UA = 'metaprev (+https://github.com/forsvn-labs/metaprev)'

// Fetch policy: local dev targets stay fetchable — that is the product's job.
export function isLocalUrl(url: string): boolean {
  return classifyUrlHost(url).isLocalDevHost
}

type FetchOpts = { insecure?: boolean }
type ProbeOpts = FetchOpts & { withDataUri?: boolean }

// Cap how much HTML we pull into memory when the document has no </head>.
// fetchPage stops at the first case-insensitive </head> when it appears sooner.
const MAX_HTML_BYTES = 4 * 1024 * 1024

// Cap image downloads too. This is a memory-safety ceiling, not a platform limit;
// validation applies the current platform-specific threshold separately.
const MAX_IMAGE_BYTES = 32 * 1024 * 1024

function tlsOpt(url: string, opts: FetchOpts): { rejectUnauthorized: false } | undefined {
  return opts.insecure || isLocalUrl(url) ? { rejectUnauthorized: false } : undefined
}

function timeoutError(err: unknown, ctrl: AbortController, timeoutMs: number): Error {
  if (ctrl.signal.aborted || (err as Error)?.name === 'AbortError') {
    return new Error(`timed out after ${Math.round(timeoutMs / 1000)}s`)
  }
  return err as Error
}

// Read a response body up to a byte cap, cancelling the stream once exceeded. Returns the
// bytes (sliced to the cap) plus whether more data was left unread.
export async function readCappedBytes(res: Response, maxBytes: number): Promise<{ bytes: Buffer; truncated: boolean }> {
  const body = res.body
  if (!body) {
    // Null-body path: there is no stream to cap mid-flight, so the only safe bound
    // is the declared length. A missing or oversized Content-Length is rejected
    // rather than read into memory unbounded.
    const declaredLen = Number(res.headers.get('content-length'))
    if (res.headers.get('content-length') === null || !Number.isFinite(declaredLen) || declaredLen < 0 || declaredLen > maxBytes) {
      throw new Error(`Response body has no readable stream and ${res.headers.get('content-length') !== null ? 'declares more than' : 'does not declare'} the readable size limit`)
    }
    const all = Buffer.from(await res.arrayBuffer())
    return { bytes: all.subarray(0, maxBytes), truncated: all.byteLength > maxBytes }
  }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      chunks.push(value)
      total += value.byteLength
      if (total > maxBytes) {
        // Past the cap; we have more than enough. A cancel() rejection must not discard it.
        truncated = true
        await reader.cancel().catch(() => {})
        break
      }
    }
  } finally {
    reader.releaseLock?.()
  }
  const buf = Buffer.concat(chunks)
  return { bytes: truncated ? buf.subarray(0, maxBytes) : buf, truncated }
}

function indexAfterCloseHead(bytes: Uint8Array): number {
  for (let i = 0; i + 7 <= bytes.length; i++) {
    const a = bytes[i]
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const d = bytes[i + 3]
    const e = bytes[i + 4]
    const f = bytes[i + 5]
    const g = bytes[i + 6]
    if (
      a === 0x3c &&
      b === 0x2f &&
      c !== undefined && (c | 32) === 0x68 &&
      d !== undefined && (d | 32) === 0x65 &&
      e !== undefined && (e | 32) === 0x61 &&
      f !== undefined && (f | 32) === 0x64 &&
      g === 0x3e
    ) {
      return i + 7
    }
  }
  return -1
}

// Decode only the kept prefix: through </head> when present, else the 4MB ceiling.
async function readHtmlUntilHead(res: Response, maxBytes: number): Promise<string> {
  const body = res.body
  if (!body) {
    const { bytes } = await readCappedBytes(res, maxBytes)
    return new TextDecoder('utf-8').decode(bytes)
  }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    let overlap = Buffer.alloc(0)
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      const remaining = maxBytes - total
      if (remaining <= 0) {
        await reader.cancel().catch(() => {})
        break
      }
      const searchable = value.byteLength > remaining ? value.subarray(0, remaining) : value
      const window = overlap.byteLength ? Buffer.concat([overlap, searchable]) : searchable
      const end = indexAfterCloseHead(window)
      if (end !== -1) {
        const fromValue = end - overlap.byteLength
        if (fromValue > 0) {
          chunks.push(fromValue < value.byteLength ? value.subarray(0, fromValue) : value)
          total += fromValue
        }
        await reader.cancel().catch(() => {})
        break
      }
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining))
        total += remaining
        await reader.cancel().catch(() => {})
        break
      }
      chunks.push(value)
      total += value.byteLength
      overlap = Buffer.from(window.subarray(window.byteLength - Math.min(6, window.byteLength)))
    }
  } finally {
    reader.releaseLock?.()
  }
  const bytes = total === 0 ? new Uint8Array() : Buffer.concat(chunks, total)
  return new TextDecoder('utf-8').decode(bytes)
}

function tryImageSize(buf: Buffer): ReturnType<typeof imageSize> | undefined {
  try {
    const dims = imageSize(buf)
    if (dims.width && dims.height) return dims
  } catch {
    // Incomplete raster headers are expected while the buffer is still growing.
  }
  return undefined
}

function declaredImageLength(res: Response): number | undefined {
  const raw = res.headers.get('content-length')
  const declaredLen = Number(raw)
  return raw !== null && Number.isFinite(declaredLen) && declaredLen > 0 ? declaredLen : undefined
}

// Facts/issues path: stop once image-size can read width/height. JPEG SOF can sit
// after a large EXIF block, so keep scanning the growing prefix (at least ~512KiB,
// and up to MAX_IMAGE_BYTES) instead of giving up after a PNG-sized first chunk.
// Do not mark truncated on a dims-only cancel — that flag skips dataUri on preview.
async function readImageUntilDimensions(res: Response): Promise<{ bytes: Buffer; truncated: boolean; byteLength: number }> {
  const declared = declaredImageLength(res)
  const body = res.body
  if (!body) {
    const { bytes, truncated } = await readCappedBytes(res, MAX_IMAGE_BYTES)
    return { bytes, truncated, byteLength: declared ?? bytes.byteLength }
  }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  let haveDims = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      chunks.push(value)
      total += value.byteLength
      if (!haveDims && tryImageSize(Buffer.concat(chunks, total))) haveDims = true
      if (haveDims) {
        if (declared != null) {
          await reader.cancel().catch(() => {})
          break
        }
        for (;;) {
          const rest = await reader.read()
          if (rest.done) break
          if (!rest.value?.byteLength) continue
          total += rest.value.byteLength
          if (total > MAX_IMAGE_BYTES) {
            total = MAX_IMAGE_BYTES
            truncated = true
            await reader.cancel().catch(() => {})
            break
          }
        }
        break
      }
      if (total > MAX_IMAGE_BYTES) {
        truncated = true
        await reader.cancel().catch(() => {})
        break
      }
    }
  } finally {
    reader.releaseLock?.()
  }
  const buf = Buffer.concat(chunks)
  const bytes = truncated && !haveDims ? buf.subarray(0, MAX_IMAGE_BYTES) : buf
  return { bytes, truncated, byteLength: declared ?? (truncated ? MAX_IMAGE_BYTES : total) }
}

function guessMime(url: string): string | undefined {
  const ext = url.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    case 'svg': return 'image/svg+xml'
    case 'avif': return 'image/avif'
    default: return undefined
  }
}

type PageResult = {
  finalUrl: string
  status: number
  html: string
}

export async function fetchPage(url: string, opts: FetchOpts = {}, timeoutMs = 10_000): Promise<PageResult> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid page URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Page URL must use HTTP or HTTPS')
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,*/*', 'cache-control': 'no-cache', pragma: 'no-cache' },
      redirect: 'follow',
      cache: 'no-store',
      signal: ctrl.signal,
      tls: tlsOpt(url, opts),
    })
    if (!res.ok) {
      await res.body?.cancel().catch(() => {})
      throw new Error(`page returned HTTP ${res.status}`)
    }
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    if (contentType && contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
      await res.body?.cancel().catch(() => {})
      throw new Error(`page returned ${contentType}, not HTML`)
    }
    const html = await readHtmlUntilHead(res, MAX_HTML_BYTES)
    return { finalUrl: res.url || url, status: res.status, html }
  } catch (err) {
    throw timeoutError(err, ctrl, timeoutMs)
  } finally {
    clearTimeout(timer)
  }
}

export async function probeImage(url: string, base: string, opts: ProbeOpts = {}, timeoutMs = 10_000): Promise<ImageProbe> {
  let resolved = url
  try {
    const parsed = new URL(url, base)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { url, resolved: parsed.toString(), status: 0, ok: false, error: 'Image URL must use HTTP or HTTPS' }
    }
    resolved = parsed.toString()
  } catch {
    return { url, resolved: url, status: 0, ok: false, error: 'Invalid image URL' }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(resolved, {
      headers: { 'user-agent': UA, accept: 'image/*,*/*', 'cache-control': 'no-cache', pragma: 'no-cache' },
      redirect: 'follow',
      cache: 'no-store',
      signal: ctrl.signal,
      tls: tlsOpt(resolved, opts),
    })
    const probe: ImageProbe = {
      url,
      resolved: res.url || resolved,
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get('content-type') ?? undefined,
    }
    if (!res.ok) {
      probe.error = `HTTP ${res.status}`
      return probe
    }
    // Preview embeds a data URI, so it still needs the full (capped) body. facts/issues
    // only need dimensions plus an honest size: cancel once image-size succeeds when
    // Content-Length is present, otherwise discard-count the rest without buffering it.
    let buf: Buffer
    let truncated: boolean
    if (opts.withDataUri) {
      const read = await readCappedBytes(res, MAX_IMAGE_BYTES)
      buf = read.bytes
      truncated = read.truncated
      probe.byteLength = declaredImageLength(res) ?? buf.byteLength
    } else {
      const read = await readImageUntilDimensions(res)
      buf = read.bytes
      truncated = read.truncated
      probe.byteLength = read.byteLength
    }
    try {
      const dims = imageSize(buf)
      probe.width = dims.width
      probe.height = dims.height
      const detectedMime: Record<string, string> = {
        avif: 'image/avif', gif: 'image/gif', jpg: 'image/jpeg', png: 'image/png',
        svg: 'image/svg+xml', webp: 'image/webp',
      }
      probe.detectedContentType = dims.type ? detectedMime[dims.type] : undefined
    } catch (err) {
      probe.error = `Could not read image dimensions: ${(err as Error).message}`
    }
    // Only build the (potentially multi-MB) base64 data URI when the caller actually
    // renders the HTML preview. issues / facts / --json never embed the image, so
    // skipping the encode saves CPU and peak memory. Skip it too when the body was
    // truncated — a partial buffer would embed a broken image.
    if (opts.withDataUri && !truncated) {
      // Validate the MIME against a strict pattern before embedding into HTML/CSS — a
      // misbehaving server could otherwise propagate junk into the data: URI which then
      // sits inside `style="background-image: url('...')"`.
      const embeddable = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'])
      const rawMime = (probe.contentType?.split(';')[0] ?? '').trim().toLowerCase()
      const mime = probe.detectedContentType ?? (embeddable.has(rawMime) ? rawMime : undefined) ?? guessMime(resolved)
      if (mime && embeddable.has(mime)) probe.dataUri = `data:${mime};base64,${buf.toString('base64')}`
    }
    return probe
  } catch (err) {
    return {
      url,
      resolved,
      status: 0,
      ok: false,
      error: timeoutError(err, ctrl, timeoutMs).message,
    }
  } finally {
    clearTimeout(timer)
  }
}
