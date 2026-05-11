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

function tlsOpt(url: string, opts: FetchOpts): { rejectUnauthorized: false } | undefined {
  return opts.insecure || isLocalUrl(url) ? { rejectUnauthorized: false } : undefined
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
      headers: { 'user-agent': UA, accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: ctrl.signal,
      tls: tlsOpt(url, opts),
    })
    const html = await res.text()
    return { finalUrl: res.url || url, status: res.status, html }
  } finally {
    clearTimeout(timer)
  }
}

export async function probeImage(url: string, base: string, opts: FetchOpts = {}, timeoutMs = 10_000): Promise<ImageProbe> {
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
      headers: { 'user-agent': UA, accept: 'image/*,*/*' },
      redirect: 'follow',
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
    const buf = Buffer.from(await res.arrayBuffer())
    probe.byteLength = buf.byteLength
    try {
      const dims = imageSize(buf)
      probe.width = dims.width
      probe.height = dims.height
    } catch (err) {
      probe.error = `Could not read image dimensions: ${(err as Error).message}`
    }
    return probe
  } catch (err) {
    return {
      url,
      resolved,
      status: 0,
      ok: false,
      error: (err as Error).message,
    }
  } finally {
    clearTimeout(timer)
  }
}
