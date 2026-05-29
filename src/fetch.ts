import { imageSize } from 'image-size'
import type { ImageProbe } from './types.ts'

const UA = 'metaprev/0.1 (+https://github.com/hungv47/metaprev)'

const LOCAL_HOST_RE = /^(localhost|.+\.localhost|.+\.test|127\.0\.0\.1|0\.0\.0\.0|::1)$/i

export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOST_RE.test(new URL(url).hostname)
  } catch {
    return false
  }
}

type FetchOpts = { insecure?: boolean }
type ProbeOpts = FetchOpts & { withDataUri?: boolean }

// Cap how much HTML we pull into memory. The <head> sits at the top of the document,
// so a few MB is plenty to find every meta tag while staying immune to multi-hundred-MB
// or never-ending responses.
const MAX_HTML_BYTES = 4 * 1024 * 1024

// Cap image downloads too. Real og:images sit well under the 8 MB platform limit; this
// only bounds memory against a hostile or misconfigured multi-hundred-MB response.
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
async function readCappedBytes(res: Response, maxBytes: number): Promise<{ bytes: Buffer; truncated: boolean }> {
  const body = res.body
  if (!body) {
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

// Read a response body up to a byte cap. Returns decoded text.
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const { bytes } = await readCappedBytes(res, maxBytes)
  return new TextDecoder('utf-8').decode(bytes)
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
    const html = await readCapped(res, MAX_HTML_BYTES)
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
    resolved = new URL(url, base).toString()
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
    const { bytes: buf, truncated } = await readCappedBytes(res, MAX_IMAGE_BYTES)
    // Trust Content-Length for the true size when present; otherwise fall back to what we
    // read (which equals the cap when truncated — still enough to trip the "too big" warn).
    const declaredLen = Number(res.headers.get('content-length'))
    probe.byteLength = Number.isFinite(declaredLen) && declaredLen > 0 ? declaredLen : buf.byteLength
    try {
      const dims = imageSize(buf)
      probe.width = dims.width
      probe.height = dims.height
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
      const MIME_RE = /^[a-z]+\/[a-z0-9.+-]+$/i
      const rawMime = (probe.contentType?.split(';')[0] ?? '').trim()
      const mime = (MIME_RE.test(rawMime) ? rawMime : '') || guessMime(resolved) || 'application/octet-stream'
      probe.dataUri = `data:${mime};base64,${buf.toString('base64')}`
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
