// Generate public edge assets from the real server. Inspection responses never
// enter this build: the allowlist contains only public pages and discovery.
import { cp, mkdir, rm } from 'node:fs/promises'
import { guides } from '../data/guides.ts'

const site = new URL('../', import.meta.url)
const output = new URL('edge/public/', site)
const port = process.env.STATIC_BUILD_PORT ?? '4329'
const child = Bun.spawn([process.execPath, 'server.ts'], {
  cwd: site.pathname,
  env: { ...process.env, HOST: '127.0.0.1', PORT: port, SITE_URL: 'https://metaprev.forsvn.com', PUBLIC_INDEXING: process.env.PUBLIC_INDEXING ?? 'off' },
  stdout: 'pipe', stderr: 'inherit',
})
try {
  const ready = child.stdout.getReader()
  try {
    let timer: ReturnType<typeof setTimeout> | undefined
    const first = await Promise.race([
      ready.read(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('The static build server did not start.')), 10_000) }),
    ]).finally(() => clearTimeout(timer))
    if (first.done) throw new Error('The static build server stopped before it was ready.')
  } finally { ready.releaseLock() }
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  await cp(new URL('public/', site), output, { recursive: true })
  const routes = ['/', '/guides', '/about', '/privacy', '/robots.txt', '/sitemap.xml', '/llms.txt', '/index.md', ...guides.map(g => `/guides/${g.slug}`)]
  let publicHeaders: Headers | undefined
  for (const route of routes) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, { headers: { 'accept-encoding': 'identity' } })
    if (!response.ok) throw new Error(`Static build failed for ${route}: ${response.status}`)
    publicHeaders ??= response.headers
    const file = route === '/' ? 'index.html' : route.slice(1) + (route.includes('.') ? '' : '.html')
    await Bun.write(new URL(file, output), await response.arrayBuffer())
  }
  const missing = await fetch(`http://127.0.0.1:${port}/404`, { headers: { 'accept-encoding': 'identity' } })
  await Bun.write(new URL('404.html', output), await missing.arrayBuffer())
  const headerNames = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy', 'cross-origin-resource-policy']
  const headers = headerNames.map(name => {
    const value = publicHeaders?.get(name)
    if (!value) throw new Error(`The public response is missing ${name}.`)
    return `  ${name}: ${value}`
  })
  await Bun.write(new URL('_headers', output), `/*\n${headers.join('\n')}\n  Cache-Control: public, max-age=60\n`)
  console.log(`Built ${routes.length} public routes for the edge.`)
} finally {
  child.kill()
  await child.exited
}
