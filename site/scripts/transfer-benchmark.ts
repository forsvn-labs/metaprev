// Deterministic transfer lab. Models a 256 KiB/s link, not deployed latency.
import { Readable } from 'node:stream'
import { gzipSync } from 'node:zlib'
import { readBoundedBody } from '../lib/transfer.ts'
const entries = Array.from({ length: 3500 }, (_, i) => ({ id: i, name: `Product ${i}`, url: `https://example.com/product/${i}`, available: true }))
const html = Buffer.from(`<head><title>Store</title><script type="application/ld+json">${JSON.stringify(entries)}</script><meta property="og:title" content="Store"></head>`)
const rate = 256 * 1024
async function measure(encoding: string, bytes: Buffer) {
  async function* transport() {
    for (let i = 0; i < bytes.length; i += 4096) {
      const chunk = bytes.subarray(i, i + 4096)
      await new Promise(resolve => setTimeout(resolve, chunk.length / rate * 1000))
      yield chunk
    }
  }
  const started = performance.now()
  const decoded = await readBoundedBody(Readable.from(transport()), encoding, 'html')
  if (!Buffer.from(decoded).equals(html)) throw new Error('Decoded content differs')
  return { encoding: encoding || 'identity', wireBytes: bytes.length, decodedBytes: decoded.length, durationMs: Math.round(performance.now() - started) }
}
const baseline = await measure('', html)
const candidate = await measure('gzip', gzipSync(html))
console.log(JSON.stringify({ fixture: '3500 structured-data records', assumption: '256 KiB/s simulated transport; no DNS, TLS or remote server latency', baseline, candidate, wireReductionPercent: +(100 * (1 - candidate.wireBytes / baseline.wireBytes)).toFixed(1), latencyReductionPercent: +(100 * (1 - candidate.durationMs / baseline.durationMs)).toFixed(1) }, null, 2))
