// Failure modes: full slots misreported as caller abuse; missing retry delay;
// cache open/match failures escape private response policy; expiry must not refetch.
import { expect, test, mock } from 'bun:test'
import worker from '../src/index.ts'
const send = (r:Request) => worker.fetch(r, {} as Cloudflare.Env)
const request = (key:string) => new Request('https://metaprev.forsvn.com/api/inspect', {method:'POST',headers:{'CF-Connecting-IP':key},body:'{}'})
test('rate rejection includes a bounded Retry-After and private headers',async()=>{
 const key=crypto.randomUUID()
 for(let i=0;i<20;i++)expect((await send(request(key))).status).toBe(400)
 const response=await send(request(key))
 expect(response.status).toBe(429)
 expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
 expect(Number(response.headers.get('Retry-After'))).toBeLessThanOrEqual(60)
 expect(response.headers.get('cache-control')).toContain('no-store')
})
test('independent requests occupy four slots; overflow is retryable service capacity',async()=>{
 const controllers=Array.from({length:4},()=>new AbortController())
 const started=Promise.withResolvers<void>();let count=0
 const pending=controllers.map(c=>send(new Request('https://metaprev.forsvn.com/api/inspect',{method:'POST',signal:c.signal,headers:{'CF-Connecting-IP':crypto.randomUUID()},body:new ReadableStream({pull(){if(++count===4)started.resolve()}})})))
 try {
  await started.promise
  const response=await send(request(crypto.randomUUID()))
  expect(response.status).toBe(503)
  expect(response.headers.get('Retry-After')).toBe('5')
 } finally {controllers.forEach(c=>c.abort());await Promise.all(pending)}
 expect((await send(request(crypto.randomUUID()))).status).toBe(400)
})
test('cache failures return private 503 without exposing error or fetching target',async()=>{
 const old=globalThis.caches
 const network=mock(()=>{throw Error('must not fetch')});const oldFetch=globalThis.fetch
 try {
  globalThis.fetch=network as typeof fetch
  for(const stage of ['open','match']) {
   globalThis.caches={open:async()=>{if(stage==='open')throw Error('secret target URL');return {match:async()=>{throw Error('secret target URL')}}}} as unknown as CacheStorage
   const response=await send(new Request('https://metaprev.forsvn.com/api/image?id=12345678-1234-1234-1234-123456789abc'))
   expect(response.status).toBe(503)
   expect(response.headers.get('Retry-After')).toBe('5')
   expect(response.headers.get('cache-control')).toContain('no-store')
   expect(response.headers.get('x-robots-tag')).toContain('noindex')
   expect(await response.text()).not.toContain('secret')
  }
  expect(network).not.toHaveBeenCalled()
 } finally {globalThis.caches=old;globalThis.fetch=oldFetch}
})
test('stalled cache lookup has a deadline and no unsafe remote fallback',async()=>{
 const old=globalThis.caches
 try {
  globalThis.caches={open:async()=>({match:()=>new Promise(()=>{})})} as unknown as CacheStorage
  const result=await Promise.race([
   send(new Request('https://metaprev.forsvn.com/api/image?id=12345678-1234-1234-1234-123456789abc')),
   Bun.sleep(1500).then(()=>null),
  ])
  expect(result?.status).toBe(503)
 } finally {globalThis.caches=old}
})
test('missing and present cache entries support GET/HEAD without remote fetch',async()=>{
 const old=globalThis.caches;const oldFetch=globalThis.fetch
 let calls=0;let hit=false
 try {
  globalThis.fetch=(async()=>{calls++;throw Error('remote')}) as typeof fetch
  globalThis.caches={open:async()=>({match:async()=>hit?new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}}):undefined})} as unknown as CacheStorage
  const url='https://metaprev.forsvn.com/api/image?id=12345678-1234-1234-1234-123456789abc'
  for(const method of ['GET','HEAD']) {
   hit=false;expect((await send(new Request(url,{method}))).status).toBe(404)
   hit=true;const response=await send(new Request(url,{method}))
   expect(response.status).toBe(200)
   expect(response.headers.get('cache-control')).toContain('no-store')
   expect(response.headers.get('x-robots-tag')).toContain('noindex')
   expect((await response.arrayBuffer()).byteLength).toBe(method==='HEAD'?0:3)
  }
  expect((await send(new Request(url.replace('12345678','invalid')))).status).toBe(400)
  expect((await send(new Request(url,{method:'POST'}))).status).toBe(405)
  expect(calls).toBe(0)
 } finally {globalThis.caches=old;globalThis.fetch=oldFetch}
})
test('50 barrier rounds of independent cancellation release exactly four slots',async()=>{
 for(let round=0;round<50;round++) {
  const ready=Promise.withResolvers<void>();let readers=0
  const controllers=Array.from({length:4},()=>new AbortController())
  const pending=controllers.map(c=>send(new Request('https://metaprev.forsvn.com/api/inspect',{method:'POST',signal:c.signal,headers:{'CF-Connecting-IP':crypto.randomUUID()},body:new ReadableStream({pull(){if(++readers===4)ready.resolve()}})})))
  await ready.promise
  expect((await send(request(crypto.randomUUID()))).status).toBe(503)
  controllers.forEach(c=>c.abort())
  expect((await Promise.all(pending)).every(r=>r.status===422)).toBe(true)
  expect((await send(request(crypto.randomUUID()))).status).toBe(400)
 }
})
