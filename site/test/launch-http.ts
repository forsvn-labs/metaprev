// Standalone public service acceptance; no third-party inspection is submitted.
import { mkdir, writeFile } from 'node:fs/promises'
const processUnderTest = Bun.spawn(['bun', 'server.ts'], {
  cwd: new URL('../', import.meta.url).pathname,
  env: { ...process.env, PORT: '0', HOST: '127.0.0.1', ADS_ENABLED: 'off', ADS_TXT_ENABLED: 'off', PUBLIC_INDEXING: 'off' },
  stdout: 'pipe', stderr: 'pipe',
})
const checks: { name: string; ok: boolean }[] = []
const check = (name: string, ok: boolean) => { checks.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
try {
  const reader = processUnderTest.stdout.getReader()
  const output = await Promise.race([reader.read(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Server startup timed out')), 10_000))])
  const base = new TextDecoder().decode(output.value).match(/http:\/\/[^\s]+/)?.[0]
  if (!base) throw new Error('Server did not expose a loopback URL')
  for (const path of ['/', '/guides/og-image', '/privacy', '/about']) {
    const response = await fetch(new URL(path, base))
    const html = await response.text()
    check(`${path}: real route works`, response.status === 200)
    check(`${path}: no ad or CMP markup by default`, !html.includes('src="/ads.js"') && !html.includes('src="/ads-cmp.js"') && !html.includes('data-metaprev-ad'))
    check(`${path}: strict first-party CSP`, response.headers.get('content-security-policy')?.includes("script-src 'self'") === true)
  }
  const health = await fetch(new URL('/healthz', base))
  check('health reports disabled advertising', health.ok && (await health.json() as { advertisingEnabled: boolean }).advertisingEnabled === false)
  const seller = await fetch(new URL('/ads.txt', base))
  check('no invented seller account', seller.status === 404 && !(await seller.text()).includes('pub-'))
  const cmp = await fetch(new URL('/ads-cmp.js', base))
  check('unconfigured CMP is not served', cmp.status === 404)
  const invalid = await fetch(new URL('/api/inspect', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'http://127.0.0.1' }) })
  const result = await invalid.text()
  check('private inspection rejected without ads', invalid.status === 400 && !result.includes('data-metaprev-ad'))
  check('private response never cached or indexed', invalid.headers.get('cache-control') === 'no-store' && invalid.headers.get('x-robots-tag') === 'noindex, nofollow')
  const robots = await fetch(new URL('/robots.txt', base)).then(r => r.text())
  check('indexing remains off', robots.includes('Disallow: /'))
} finally {
  processUnderTest.kill()
  await processUnderTest.exited
  await mkdir('artifacts', { recursive: true })
  await writeFile('artifacts/launch-http.json', JSON.stringify({ checks }, null, 2))
}
if (checks.some(c => !c.ok)) process.exitCode = 1
