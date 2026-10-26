import { Readable } from 'node:stream'
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib'
import { HeadBoundary } from '../../app/src/head.ts'

// Both wire bytes and expanded bytes are capped. No persistent response cache:
// every inspection rechecks DNS, redirects and the source's current metadata.
export async function readBoundedBody(source: Readable, encoding: string, kind: 'html' | 'image'): Promise<Uint8Array> {
  const max = kind === 'html' ? 512 * 1024 : 5 * 1024 * 1024
  const tooLarge = () => new Error(kind === 'html' ? 'The HTML head exceeds the 512 KB inspection limit.' : 'The image exceeds the 5 MB web inspection limit.')
  const codec = encoding.trim().toLowerCase()
  const decoder = codec === 'gzip' ? createGunzip() : codec === 'deflate' ? createInflate() : codec === 'br' ? createBrotliDecompress() : null
  if (codec && codec !== 'identity' && !decoder) { source.destroy(); throw new Error('Unsupported response compression.') }
  let wire = 0
  source.on('data', (chunk: Buffer) => { wire += chunk.length; if (wire > max) source.destroy(tooLarge()) })
  if (decoder) source.on('error', error => decoder.destroy(error))
  const stream = decoder ? source.pipe(decoder) : source
  const chunks: Buffer[] = []
  const boundary = new HeadBoundary()
  let size = 0
  try {
    for await (const chunk of stream) {
      const bytes = Buffer.from(chunk)
      const end = kind === 'html' ? boundary.push(bytes.toString('latin1')) : undefined
      const retained = end === undefined ? bytes : bytes.subarray(0, end - size)
      size += retained.length
      if (size > max) throw tooLarge()
      chunks.push(retained)
      if (end !== undefined) break
    }
    return Buffer.concat(chunks)
  } finally { stream.destroy(); source.destroy() }
}
