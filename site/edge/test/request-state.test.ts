// State cases: four occupied slots, overflow, cancellation, retry after failure,
// invalid JSON/input, cross-origin calls, method restrictions, no-store errors.
import { expect, test } from 'bun:test'
import worker from '../src/index.ts'
// SAFETY: this handler does not read environment bindings; tests use no cache route.
const send = (request: Request) => worker.fetch(request, {} as Cloudflare.Env)
const request = (body: string, headers: Record<string,string> = {}) => new Request('https://metaprev.forsvn.com/api/inspect', {
  method:'POST', headers: {'content-type':'application/json', 'CF-Connecting-IP':crypto.randomUUID(), ...headers}, body,
})
test('cancellation releases all occupied slots for a retry', async () => {
 const controllers = Array.from({length:4}, () => new AbortController())
 const pending = controllers.map(controller => send(new Request('https://metaprev.forsvn.com/api/inspect', {
  method:'POST', body:new ReadableStream(), signal:controller.signal,
  headers:{'CF-Connecting-IP':crypto.randomUUID()},
 })))
 expect((await send(request('{}'))).status).toBe(503)
 controllers.forEach(controller => controller.abort())
 const responses = await Promise.all(pending)
 expect(responses.every(response => response.status === 422)).toBe(true)
 expect((await send(request('{}'))).status).toBe(400)
})
test('failures preserve private response policy and allow correction', async () => {
 for (const body of ['{','null','[]','{}','{"url":"http://127.0.0.1"}']) {
  const response=await send(request(body))
  expect(response.status).toBe(400)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('x-robots-tag')).toContain('noindex')
 }
 expect((await send(request('{}',{origin:'https://evil.example'}))).status).toBe(403)
 expect((await send(new Request('https://metaprev.forsvn.com/api/inspect'))).status).toBe(405)
})
