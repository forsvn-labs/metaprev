// The editor and its unauthenticated file proxy are loopback-only development tools.
// They are deliberately outside public/ and never enter the edge asset build.
const root = new URL('../../', import.meta.url).pathname
const server = Bun.serve({ hostname: '127.0.0.1', port: 4340, async fetch(request) {
  const url = new URL(request.url)
  if (url.host !== '127.0.0.1:4340' || !['GET', 'HEAD'].includes(request.method)) return new Response('Not allowed', { status: 403 })
  const path = url.pathname
  let file: ReturnType<typeof Bun.file>
  if (path === '/' || path === '/admin/' || path === '/admin/index.html') file = Bun.file(new URL('../cms/index.html', import.meta.url))
  else if (path === '/admin/config.yml') file = Bun.file(new URL('../cms/config.json', import.meta.url))
  else if (/^\/admin\/[a-zA-Z0-9._-]+\.(js|wasm)$/.test(path)) file = Bun.file(new URL('../node_modules/decap-cms/dist/' + path.split('/').pop(), import.meta.url))
  else return new Response('Not found', { status: 404 })
  if (!await file.exists()) return new Response('Not found', { status: 404 })
  return new Response(request.method === 'HEAD' ? null : file, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Frame-Options': 'DENY' } })
}})
const proxy = Bun.spawn(['node', new URL('../node_modules/decap-server/dist/index.js', import.meta.url).pathname], {
  cwd: root,
  env: { ...process.env, PORT: '8081', BIND_HOST: '127.0.0.1', ORIGIN: 'http://127.0.0.1:4340', MODE: 'fs', GIT_REPO_DIRECTORY: root },
  stdout: 'inherit', stderr: 'inherit',
})
function stop() { server.stop(true); proxy.kill() }
process.on('SIGINT', () => { stop(); process.exit(0) })
process.on('SIGTERM', () => { stop(); process.exit(0) })
console.log('Local editor: http://127.0.0.1:4340/admin/ — saving edits files; it does not deploy.')
const exit = await proxy.exited
stop()
process.exit(exit || 1)
