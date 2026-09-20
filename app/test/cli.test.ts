import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fetchPage, probeImage } from '../src/fetch.ts'

let server: ReturnType<typeof Bun.serve>
let rawServer: ReturnType<typeof createServer>
let base = ''
let rawBase = ''
let ogRequests = 0
let xRequests = 0
const headThenPad = { bytes: 0 }
const largePng = { bytes: 0 }
const countedPng = { bytes: 0 }
const LARGE_PNG_BYTES = 2 * 1024 * 1024
const PAD_CHUNK = 64 * 1024

function pngBytes(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12)
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

function pngHeader(width: number, height: number): ArrayBuffer {
  const bytes = pngBytes(width, height)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function cleanHtml(): string {
  return `<!doctype html><html><head>
    <title>Fallback title</title>
    <meta property="og:type" content="website">
    <meta property="og:title" content="A concise product title">
    <meta property="og:description" content="A factual description that does not need padding to satisfy an arbitrary count.">
    <meta property="og:url" content="${base}/clean">
    <meta property="og:image" content="${base}/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="A blue product card">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${base}/x.png">
    <meta name="twitter:image:alt" content="A blue X-specific product card">
  </head><body></body></html>`
}

function warningOnlyHtml(): string {
  return `<!doctype html><html><head>
    <title>Fallback title</title>
    <meta property="og:title" content="A concise product title">
    <meta property="og:description" content="A factual description.">
    <meta property="og:image" content="${base}/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="A blue product card">
    <meta name="twitter:card" content="summary_large_image">
  </head><body></body></html>`
}

async function runProc(cmd: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(cmd, {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, NO_COLOR: '1' },
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

async function runCli(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return runProc([process.execPath, 'bin/metaprev.ts', ...args])
}

function writeThrottled(
  req: IncomingMessage,
  res: ServerResponse,
  stats: { bytes: number },
  first: Buffer,
  headers: Record<string, string | number>,
  totalBytes?: number,
): void {
  let sent = 0
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const pad = Buffer.alloc(PAD_CHUNK, 0x78)

  const stop = (): void => {
    if (stopped) return
    stopped = true
    if (timer) clearTimeout(timer)
    if (!res.writableEnded) res.end()
  }

  req.on('aborted', () => stop())
  req.socket?.on('close', () => stop())
  res.on('error', () => stop())
  res.on('finish', () => stop())

  res.writeHead(200, { Connection: 'close', ...headers })
  sent += first.byteLength
  stats.bytes += first.byteLength
  res.write(first)

  const tick = (): void => {
    if (stopped) return
    if (totalBytes != null && sent >= totalBytes) {
      stop()
      return
    }
    const left = totalBytes != null ? totalBytes - sent : PAD_CHUNK
    const chunk = left < PAD_CHUNK ? pad.subarray(0, Math.max(left, 0)) : pad
    if (chunk.byteLength === 0) {
      stop()
      return
    }
    sent += chunk.byteLength
    stats.bytes += chunk.byteLength
    const ok = res.write(chunk)
    if (stopped) return
    const schedule = (): void => {
      if (!stopped) timer = setTimeout(tick, 5)
    }
    if (ok) schedule()
    else res.once('drain', schedule)
  }
  timer = setTimeout(tick, 5)
}

beforeAll(async () => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const path = new URL(req.url).pathname
      if (path === '/clean') return new Response(cleanHtml(), { headers: { 'content-type': 'text/html; charset=utf-8' } })
      if (path === '/warnings-only') return new Response(warningOnlyHtml(), { headers: { 'content-type': 'text/html; charset=utf-8' } })
      if (path === '/broken') return new Response('<title>Only a title</title>', { headers: { 'content-type': 'text/html' } })
      if (path === '/large-broken') {
        const title = 'x'.repeat(200_000)
        return new Response(`<meta property="og:title" content="${title}"><meta property="og:description" content="Description">`, {
          headers: { 'content-type': 'text/html' },
        })
      }
      if (path === '/not-html') return new Response('{}', { headers: { 'content-type': 'application/json' } })
      if (path === '/og.png') {
        ogRequests++
        return new Response(pngHeader(1200, 630), { headers: { 'content-type': 'application/octet-stream' } })
      }
      if (path === '/x.png') {
        xRequests++
        return new Response(pngHeader(1200, 630), { headers: { 'content-type': 'image/png' } })
      }
      if (path === '/card.svg') {
        return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"></svg>', { headers: { 'content-type': 'image/svg+xml' } })
      }
      return new Response('not found', { status: 404 })
    },
  })
  base = `http://127.0.0.1:${server.port}`
  rawServer = createServer((req, res) => {
    const path = req.url?.split('?')[0]
    if (path === '/head-then-pad') {
      const head = Buffer.from(`<!doctype html><html><head>
        <title>Head title</title>
        <meta property="og:title" content="From head">
        <meta property="og:description" content="A factual description.">
        <meta property="og:image" content="${base}/og.png">
      </HEAD>`)
      writeThrottled(req, res, headThenPad, head, { 'Content-Type': 'text/html; charset=utf-8' })
      return
    }
    if (path === '/split-head') {
      const prefix = Buffer.from(`<!doctype html><html><head>
        <title>Split title</title>
        <meta property="og:title" content="From split">
      </hea`)
      const suffix = Buffer.from(`d><body>${'x'.repeat(8000)}</body></html>`)
      req.on('aborted', () => { if (!res.writableEnded) res.end() })
      res.writeHead(200, { Connection: 'close', 'Content-Type': 'text/html; charset=utf-8' })
      res.write(prefix)
      setTimeout(() => {
        if (!res.writableEnded) {
          res.write(suffix)
          res.end()
        }
      }, 15)
      return
    }
    if (path === '/large.png') {
      writeThrottled(
        req,
        res,
        largePng,
        pngBytes(1200, 630),
        { 'Content-Type': 'image/png', 'Content-Length': LARGE_PNG_BYTES },
        LARGE_PNG_BYTES,
      )
      return
    }
    if (path === '/counted.png') {
      writeThrottled(
        req,
        res,
        countedPng,
        pngBytes(1200, 630),
        { 'Content-Type': 'image/png' },
        256 * 1024,
      )
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((resolve, reject) => {
    rawServer.once('error', reject)
    rawServer.listen(0, '127.0.0.1', () => resolve())
  })
  const addr = rawServer.address()
  if (!addr || typeof addr === 'string') throw new Error('expected TCP address')
  rawBase = `http://127.0.0.1:${addr.port}`
})

afterAll(async () => {
  server.stop(true)
  if (rawServer.listening) {
    rawServer.closeAllConnections?.()
    await new Promise<void>((resolve) => rawServer.close(() => resolve()))
  }
})

describe('CLI compatibility', () => {
  test('preserves exits 0 for clean, 1 for findings, and 2 for fetch/runtime failure', async () => {
    const clean = await runCli('issues', `${base}/clean`, '--json')
    expect(clean.exitCode).toBe(0)
    expect(JSON.parse(clean.stdout)).toEqual([])

    const broken = await runCli('issues', `${base}/broken`, '--json')
    expect(broken.exitCode).toBe(1)
    expect(JSON.parse(broken.stdout).some((issue: { code: string }) => issue.code === 'missing-og-image')).toBe(true)

    const fullJsonBroken = await runCli(`${base}/broken`, '--json')
    expect(fullJsonBroken.exitCode).toBe(1)
    expect(JSON.parse(fullJsonBroken.stdout).issues.some((issue: { level: string }) => issue.level === 'error')).toBe(true)

    const failed = await runCli(`${base}/not-html`, '--json')
    expect(failed.exitCode).toBe(2)
    expect(failed.stderr).toContain('not HTML')
  }, 15_000)

  test('keeps warning-only reports at exit 0 for issues and full JSON', async () => {
    const issuesResult = await runCli('issues', `${base}/warnings-only`, '--json')
    // SAFETY: The assertions below verify the Issue compatibility fields read from CLI JSON.
    const issues = JSON.parse(issuesResult.stdout) as Array<{ code: string; level: string; field: string; message: string }>
    expect(issuesResult.exitCode).toBe(0)
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-canonical-url', level: 'warn', field: 'og:url' }),
      expect.objectContaining({ code: 'missing-og-type', level: 'warn', field: 'og:type' }),
    ]))
    expect(issues.every((issue) => Boolean(issue.level && issue.field && issue.message))).toBe(true)
    expect(issues.some((issue) => issue.level === 'error')).toBe(false)

    const fullResult = await runCli(`${base}/warnings-only`, '--json')
    // SAFETY: The assertions below verify the report issue levels read from CLI JSON.
    const full = JSON.parse(fullResult.stdout) as { issues: Array<{ level: string }> }
    expect(fullResult.exitCode).toBe(0)
    expect(full.issues.some((issue) => issue.level === 'warn')).toBe(true)
    expect(full.issues.some((issue) => issue.level === 'error')).toBe(false)
  }, 15_000)

  test('keeps facts/JSON on one image probe and omits embedded bytes', async () => {
    ogRequests = 0
    xRequests = 0
    const result = await runCli('facts', `${base}/clean`, '--json')
    const facts = JSON.parse(result.stdout)
    expect(result.exitCode).toBe(0)
    expect(facts).toMatchObject({ status: 200, image: { width: 1200, height: 630, detectedContentType: 'image/png' } })
    expect(facts.image.dataUri).toBeUndefined()
    expect(ogRequests).toBe(1)
    expect(xRequests).toBe(0)
  }, 15_000)

  test('flushes large JSON reports before returning a non-zero CI exit', async () => {
    const result = await runCli(`${base}/large-broken`, '--json')
    expect(result.exitCode).toBe(1)
    expect(result.stdout.length).toBeGreaterThan(200_000)
    const report = JSON.parse(result.stdout)
    expect(report.meta.ogTitle).toHaveLength(200_000)
    expect(report.issues.some((issue: { code: string }) => issue.code === 'missing-og-image')).toBe(true)
  }, 15_000)

  test('fails unknown flags as a usage error with exit 2', async () => {
    const result = await runCli('issues', `${base}/clean`, '--no-such-flag')
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain("unknown option '--no-such-flag'")
    expect(result.stderr).toContain('--help')
  }, 15_000)

  test('facts stays exempt from the findings exit code (diagnostic dump exits 0)', async () => {
    const facts = await runCli('facts', `${base}/broken`)
    // /broken has error-level findings, yet the facts dump is pipeline-friendly.
    expect(facts.exitCode).toBe(0)
    expect(facts.stdout).toContain('title')
    const issues = await runCli('issues', `${base}/broken`)
    expect(issues.exitCode).toBe(1)
  }, 15_000)
})

describe('fetch hardening', () => {
  test('rejects non-HTTP page protocols before fetching them', async () => {
    expect(fetchPage('file:///etc/passwd')).rejects.toThrow('Page URL must use HTTP or HTTPS')
  })

  test('rejects a successful non-HTML page response', async () => {
    expect(fetchPage(`${base}/not-html`)).rejects.toThrow('not HTML')
  })

  test('uses detected bytes, not an unsafe response MIME, for embedded images', async () => {
    const image = await probeImage(`${base}/og.png`, `${base}/clean`, { withDataUri: true })
    expect(image.contentType).toBe('application/octet-stream')
    expect(image.detectedContentType).toBe('image/png')
    expect(image.dataUri).toStartWith('data:image/png;base64,')

    const svg = await probeImage(`${base}/card.svg`, `${base}/clean`, { withDataUri: true })
    expect(svg.detectedContentType).toBe('image/svg+xml')
    expect(svg.dataUri).toBeUndefined()
  })

  test('rejects non-HTTP image protocols before fetching them', async () => {
    const image = await probeImage('file:///etc/passwd', `${base}/clean`, { withDataUri: true })
    expect(image).toMatchObject({ ok: false, status: 0, error: 'Image URL must use HTTP or HTTPS' })
    expect(image.dataUri).toBeUndefined()
  })

  test('stops HTML at </head> and cancels a 2MB padded body', async () => {
    headThenPad.bytes = 0
    const page = await fetchPage(`${rawBase}/head-then-pad`)
    expect(page.status).toBe(200)
    expect(page.html).toContain('From head')
    expect(page.html.toLowerCase()).toContain('</head>')
    expect(page.html.includes('x'.repeat(1000))).toBe(false)
    expect(headThenPad.bytes).toBeLessThan(256 * 1024)
  }, 10_000)

  test('finds </head> when the close tag is split across chunks', async () => {
    const page = await fetchPage(`${rawBase}/split-head`)
    expect(page.status).toBe(200)
    expect(page.html).toContain('From split')
    expect(page.html.toLowerCase()).toContain('</head>')
    expect(page.html.includes('x'.repeat(1000))).toBe(false)
  }, 10_000)

  test('facts-path image probe cancels after dimensions and keeps Content-Length', async () => {
    largePng.bytes = 0
    const image = await probeImage(`${rawBase}/large.png`, `${rawBase}/`)
    expect(image.ok).toBe(true)
    expect(image.width).toBe(1200)
    expect(image.height).toBe(630)
    expect(image.byteLength).toBe(LARGE_PNG_BYTES)
    expect(image.dataUri).toBeUndefined()
    expect(largePng.bytes).toBeLessThan(512 * 1024)
    expect(largePng.bytes).toBeLessThan(LARGE_PNG_BYTES / 4)
  }, 10_000)

  test('facts-path image probe discard-counts size when Content-Length is missing', async () => {
    countedPng.bytes = 0
    const image = await probeImage(`${rawBase}/counted.png`, `${rawBase}/`)
    expect(image.ok).toBe(true)
    expect(image.width).toBe(1200)
    expect(image.height).toBe(630)
    expect(image.byteLength).toBe(256 * 1024)
    expect(image.dataUri).toBeUndefined()
    expect(countedPng.bytes).toBeGreaterThanOrEqual(256 * 1024)
  }, 10_000)

  test('preview image probe still reads the body and embeds a data URI', async () => {
    largePng.bytes = 0
    const image = await probeImage(`${rawBase}/large.png`, `${rawBase}/`, { withDataUri: true })
    expect(image.width).toBe(1200)
    expect(image.height).toBe(630)
    expect(image.byteLength).toBe(LARGE_PNG_BYTES)
    expect(image.dataUri).toStartWith('data:image/png;base64,')
    expect(largePng.bytes).toBeGreaterThanOrEqual(LARGE_PNG_BYTES)
  }, 15_000)
})

describe('CLI startup', () => {
  test('prints 0.6.0 from bun ts, bun mjs, and node mjs', async () => {
    const bunTs = await runCli('--version')
    const bunHelp = await runCli('--help')
    const bunMjs = await runProc([process.execPath, 'bin/metaprev.mjs', '--version'])
    const bunMjsHelp = await runProc([process.execPath, 'bin/metaprev.mjs', '--help'])
    const nodeVer = await runProc(['node', 'bin/metaprev.mjs', '--version'])
    const nodeHelp = await runProc(['node', 'bin/metaprev.mjs', '--help'])
    expect(bunTs.stdout.trim()).toBe('0.6.0')
    expect(bunMjs.stdout.trim()).toBe('0.6.0')
    expect(nodeVer.stdout.trim()).toBe('0.6.0')
    expect(bunHelp.stdout).toContain('metaprev v0.6.0')
    expect(bunMjsHelp.stdout).toBe(bunHelp.stdout)
    expect(nodeHelp.stdout).toBe(bunHelp.stdout)
    expect(bunTs.exitCode).toBe(0)
    expect(nodeHelp.exitCode).toBe(0)
  })
})
