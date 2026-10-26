import { expect, test } from 'bun:test'
import { Readable } from 'node:stream'
import { gzipSync, brotliCompressSync, deflateSync } from 'node:zlib'
import { readBoundedBody } from '../lib/transfer.ts'
const html = Buffer.from('<head><script>const x="</head>"</script><meta property="og:title" content="Real"></head>')
for (const [encoding, encode] of [['gzip', gzipSync], ['br', brotliCompressSync], ['deflate', deflateSync]] as const) {
  test(`decodes ${encoding} and stops at real head boundary`, async () => {
    const body = await readBoundedBody(Readable.from([encode(Buffer.concat([html, Buffer.alloc(50000, 120)]))]), encoding, 'html')
    expect(Buffer.from(body).toString()).toBe(html.toString())
  })
  test(`rejects ${encoding} expansion beyond decoded limit`, async () => {
    await expect(readBoundedBody(Readable.from([encode(Buffer.alloc(600000, 120))]), encoding, 'html')).rejects.toThrow('512 KB')
  })
}
test('rejects truncated compressed input, unknown encoding and oversized images', async () => {
  await expect(readBoundedBody(Readable.from([Buffer.from('broken')]), 'gzip', 'html')).rejects.toThrow()
  await expect(readBoundedBody(Readable.from([html]), 'unknown', 'html')).rejects.toThrow()
  await expect(readBoundedBody(Readable.from([Buffer.alloc(5 * 1024 * 1024 + 1)]), '', 'image')).rejects.toThrow('5 MB')
})
test('identity head survives chunk boundaries and inert terminators', async () => {
  const body = await readBoundedBody(Readable.from([...html].map(b => Buffer.from([b]))), '', 'html')
  expect(Buffer.from(body).toString()).toBe(html.toString())
})
test('aborted responses close the compressed reader without hanging', async () => {
  const source = new Readable({ read() {} })
  const reading = readBoundedBody(source, 'gzip', 'html')
  source.destroy(new Error('deadline'))
  await expect(reading).rejects.toThrow('deadline')
})
