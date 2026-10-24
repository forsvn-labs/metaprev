// Integration oracle: the documented 20 requests per client per minute.
// Failure modes were recorded in deployment-acceptance.md before the edge code.
import { mkdir, writeFile } from 'node:fs/promises'

const checks: { name: string; ok: boolean }[] = []
const check = (name: string, ok: boolean) => {
  checks.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}
for (const trusted of [false, true]) {
  const port = trusted ? 4331 : 4330
  const child = Bun.spawn([process.execPath, 'server.ts'], {
    cwd: new URL('../', import.meta.url).pathname,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), METAPREV_PRIVATE_EDGE: trusted ? 'on' : 'off' },
    stdout: 'pipe', stderr: 'inherit',
  })
  try {
    const reader = child.stdout.getReader()
    try { if ((await reader.read()).done) throw new Error('Test server did not start.') }
    finally { reader.releaseLock() }
    const submit = (ip: string) => fetch(`http://127.0.0.1:${port}/api/inspect`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-metaprev-client-ip': ip },
      body: JSON.stringify({ url: 'http://127.0.0.1' }),
    })
    const initial = []
    for (let i = 0; i < 20; i++) initial.push((await submit(trusted ? '192.0.2.1' : `192.0.2.${i + 1}`)).status)
    check(`${trusted ? 'private edge' : 'direct server'}: first twenty requests use the URL policy`, initial.every(status => status === 400))
    const limited = await submit(trusted ? '192.0.2.1' : '198.51.100.1')
    check(`${trusted ? 'private edge' : 'direct server'}: client limit cannot be bypassed`, limited.status === 429)
    check(`${trusted ? 'private edge' : 'direct server'}: limited response stays private`, limited.headers.get('cache-control') === 'no-store' && limited.headers.get('x-robots-tag') === 'noindex, nofollow')
    if (trusted) check('private edge: another real client has its own allowance', (await submit('198.51.100.2')).status === 400)
  } finally { child.kill(); await child.exited }
}
await mkdir('artifacts/deployment', { recursive: true })
await writeFile('artifacts/deployment/results.json', JSON.stringify({ checks }, null, 2))
console.log(`${checks.filter(c => c.ok).length}/${checks.length} passed`)
process.exitCode = checks.some(c => !c.ok) ? 1 : 0
