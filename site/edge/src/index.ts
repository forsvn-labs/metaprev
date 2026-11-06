import { Container, getContainer } from '@cloudflare/containers'

export class Inspector extends Container {
  defaultPort = 4323
  sleepAfter = '5m'
  enableInternet = true
}

const privateHeaders = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }

export default {
  async fetch(request: Request, env: Cloudflare.Env): Promise<Response> {
    const path = new URL(request.url).pathname
    const inspecting = path === '/api/inspect' || path === '/inspect'
    const image = path === '/api/image'
    if (!inspecting && !image) return Response.json({ ok: false, error: 'This endpoint does not exist.' }, { status: 404, headers: privateHeaders })
    if ((inspecting && request.method !== 'POST') || (image && !['GET', 'HEAD'].includes(request.method))) {
      return Response.json({ ok: false, error: inspecting ? 'Use POST to inspect a URL.' : 'Use GET to read an image.' }, { status: 405, headers: { ...privateHeaders, Allow: inspecting ? 'POST' : 'GET, HEAD' } })
    }
    const headers = new Headers(request.headers)
    headers.delete('x-metaprev-client-ip')
    // Cloudflare supplies this address. Caller-provided proxy headers are ignored.
    headers.set('x-metaprev-client-ip', request.headers.get('CF-Connecting-IP') ?? 'unknown')
    try {
      return await getContainer(env.INSPECTOR, 'public-inspector').fetch(new Request(request, { headers }))
    } catch {
      const error = 'The inspector is starting. Please try again in a few seconds.'
      if (path === '/inspect') return new Response(error, { status: 503, headers: { ...privateHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '5' } })
      return Response.json({ ok: false, error }, { status: 503, headers: { ...privateHeaders, 'Retry-After': '5' } })
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>
