import { describe, expect, test } from 'bun:test'
import { assertPublicAddress, parseTarget, fetchPublic } from '../lib/public-fetch.ts'
import { escapeHtml } from '../lib/html.ts'

describe('public URL boundary', () => {
  for (const target of [
    'file:///etc/passwd', 'ftp://example.com', 'javascript:alert(1)',
    'https://user:password@example.com', 'http://example.com:3000',
    'http://localhost', 'http://test.local', 'http://local',
    'http://127.0.0.1', 'http://127.1', 'http://2130706433',
    'http://0.0.0.0', 'http://10.0.0.1', 'http://172.16.0.1',
    'http://192.168.1.1', 'http://169.254.169.254', 'http://100.100.100.200',
    'http://192.0.2.1', 'http://198.18.0.1', 'http://224.0.0.1',
    'http://[::1]', 'http://[::]', 'http://[::ffff:127.0.0.1]',
    'http://[fc00::1]', 'http://[fe80::1]', 'http://[64:ff9b::a9fe:a9fe]',
    'http://[2002:7f00:1::]', 'http://[2001:db8::1]',
  ]) test(`rejects ${target}`, () => expect(() => parseTarget(target)).toThrow())

  test('normalizes a bare public hostname and drops a fragment', () => {
    expect(parseTarget('forsvn.com/path#section').href).toBe('https://forsvn.com/path')
  })
  test('rejects non-public DNS addresses', () => {
    expect(() => assertPublicAddress('127.0.0.1')).toThrow()
    expect(() => assertPublicAddress('::ffff:10.0.0.1')).toThrow()
    expect(() => assertPublicAddress('8.8.8.8')).not.toThrow()
  })
  test('rejects a hostname which resolves to loopback before connecting', async () => {
    await expect(fetchPublic('https://127.0.0.1.nip.io', { kind: 'html' })).rejects.toThrow()
  })
  test('escapes hostile metadata in text and attributes', () => {
    expect(escapeHtml('\"><img src=x onerror=alert(1)> & \'')).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt; &amp; &#39;')
  })
})
