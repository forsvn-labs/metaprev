import { expect, spyOn, test } from 'bun:test'
import { fetchPage, probeImage } from '../src/fetch.ts'

// A runtime or fetch adapter can reject with a value other than Error.
// Preserve a useful diagnostic instead of losing it or throwing on null.message.
for (const reason of ['upstream unavailable', null]) {
  test(`fetch rejection ${String(reason)} produces a diagnostic`, async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(reason)
    try {
      await expect(fetchPage('https://example.com')).rejects.toThrow(String(reason))
      expect(await probeImage('/image.png', 'https://example.com')).toMatchObject({
        ok: false, status: 0, error: String(reason),
      })
    } finally {
      fetchSpy.mockRestore()
    }
  })
}

test('fetch errors retain their message and abort errors retain the timeout diagnostic', async () => {
  const fetchSpy = spyOn(globalThis, 'fetch')
  try {
    fetchSpy.mockRejectedValue(new Error('connection failed'))
    await expect(fetchPage('https://example.com')).rejects.toThrow('connection failed')
    fetchSpy.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    await expect(fetchPage('https://example.com', {}, 2000)).rejects.toThrow('timed out after 2s')
  } finally {
    fetchSpy.mockRestore()
  }
})
