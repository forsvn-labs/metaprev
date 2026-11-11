// Failure modes defined before implementation: private URLs/DNS, redirects into
// private hosts, leaked caller credentials, wrong MIME, oversized and slow bodies.
import { test, expect } from 'bun:test'
import { fetchRemote } from '../src/free-fetch.ts'
const publicDNS = new Response(JSON.stringify({Status:0, Answer:[{type:1,data:'93.184.216.34'}]}))
function mock(target: (url:string, init?:RequestInit)=>Response) {
  return async (input: string | URL | Request, init?:RequestInit) => {
    const url = String(input)
    return url.startsWith('https://cloudflare-dns.com/dns-query?') ? publicDNS.clone() : target(url,init)
  }
}
for (const url of ['http://127.0.0.1','https://user:pass@example.com','file:///etc/passwd','http://[::1]','http://localhost','http://example.com:8080']) {
 test(`rejects ${url} before fetching`, async()=>{
   let calls=0
   await expect(fetchRemote(url,'html',async()=>{calls++;throw Error()})).rejects.toThrow()
   expect(calls).toBe(0)
 })
}
test('rejects private DNS before the target request',async()=>{
 let calls=0
 await expect(fetchRemote('https://example.com','html',async()=>{calls++; return Response.json({Status:0,Answer:[{type:1,data:'10.0.0.1'}]})})).rejects.toThrow()
 expect(calls).toBe(2)
})
test('validates every redirect',async()=>{
 await expect(fetchRemote('https://example.com','html',mock(()=>new Response(null,{status:302,headers:{location:'http://169.254.169.254/'}})))).rejects.toThrow()
})
test('bounded HTML stops at head and uses credential-free manual redirects',async()=>{
 const result=await fetchRemote('https://example.com','html',mock((_,init)=>{
  expect(init?.redirect).toBe('manual')
  expect(new Headers(init?.headers).has('cookie')).toBe(false)
  return new Response('<head><title>Works</title></head><body>ignored</body>',{headers:{'content-type':'text/html'}})
 }))
 expect(new TextDecoder().decode(result.body)).toContain('<title>Works</title>')
})
test('rejects non-HTML and oversized HTML',async()=>{
 await expect(fetchRemote('https://example.com','html',mock(()=>new Response('x',{headers:{'content-type':'application/json'}})))).rejects.toThrow()
 await expect(fetchRemote('https://example.com','html',mock(()=>new Response('x'.repeat(131073),{headers:{'content-type':'text/html'}})))).rejects.toThrow()
})
test('rejects SVG as image',async()=>{
 await expect(fetchRemote('https://example.com/a.svg','image',mock(()=>new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}})))).rejects.toThrow()
})
test('rejects redirect loops',async()=>{
 await expect(fetchRemote('https://example.com','html',mock(()=>new Response(null,{status:302,headers:{location:'https://example.com'}})))).rejects.toThrow()
})
// Performance regression: a large body must not hide an early, small head.
test('reads only the head even when the declared HTML body exceeds the limit',async()=>{
 const result=await fetchRemote('https://example.com','html',mock(()=>new Response('<head><title>Early</title></head>'+ 'x'.repeat(200000),{headers:{'content-type':'text/html','content-length':'200032'}})))
 expect(new TextDecoder().decode(result.body)).toBe('<head><title>Early</title></head>')
})
test('head boundary split between chunks still stops before a large body',async()=>{
 const enc=new TextEncoder()
 const stream=new ReadableStream({start(c){c.enqueue(enc.encode('<head><title>Split</title></he'));c.enqueue(enc.encode('ad>'+ 'x'.repeat(200000)));c.close()}})
 const result=await fetchRemote('https://example.com','html',mock(()=>new Response(stream,{headers:{'content-type':'text/html'}})))
 expect(new TextDecoder().decode(result.body)).toBe('<head><title>Split</title></head>')
})

// Cancellation must bound cleanup as well as reads. A rejected stream can have
// a cancel hook that never settles; it must not retain an inspection slot.
import { boundedBody } from '../src/free-fetch.ts'
test('rejects oversized declared body without waiting for upstream cancellation', async () => {
 const response = new Response(new ReadableStream({cancel: () => new Promise(() => {})}), {headers: {'content-length':'100'}})
 const result = await Promise.race([
  boundedBody(response, 10, new AbortController().signal).then(() => 'accepted', () => 'rejected'),
  Bun.sleep(100).then(() => 'hung'),
 ])
 expect(result).toBe('rejected')
})
test('already cancelled request makes no DNS or upstream calls', async () => {
 let calls=0
 await expect(fetchRemote('https://example.com','html',async()=>{calls++;return publicDNS.clone()},AbortSignal.abort())).rejects.toThrow()
 expect(calls).toBe(0)
})
test('abort releases a stalled body read', async () => {
 const controller=new AbortController(); let cancelled=false
 const response=new Response(new ReadableStream({cancel(){cancelled=true}}))
 const reading=boundedBody(response,100,controller.signal)
 controller.abort()
 await expect(reading).rejects.toThrow()
 expect(cancelled).toBe(true)
})
test('already aborted body is cancelled without reading', async () => {
 let cancelled=false
 const response=new Response(new ReadableStream({cancel(){cancelled=true}}))
 await expect(boundedBody(response,100,AbortSignal.abort())).rejects.toThrow()
 expect(cancelled).toBe(true)
})
test('redirect cleanup cannot hang the next checked request', async () => {
 let calls=0
 const result=await Promise.race([
  fetchRemote('https://example.com','html',mock(()=>{
   calls++
   return calls===1
    ? new Response(new ReadableStream({cancel:()=>new Promise(()=>{})}),{status:302,headers:{location:'/next'}})
    : new Response('<head><title>Next</title></head>',{headers:{'content-type':'text/html'}})
  })).then(response=>response.url),
  Bun.sleep(100).then(()=>'hung'),
 ])
 expect(result).toBe('https://example.com/next')
})
test('image byte envelope accepts one MiB and rejects the next byte',async()=>{
 for(const size of [1024*1024,1024*1024+1]) {
  const run=fetchRemote('https://example.com/image.png','image',mock(()=>new Response(new Uint8Array(size),{headers:{'content-type':'image/png'}})))
  if(size===1024*1024)expect((await run).body.byteLength).toBe(size)
  else await expect(run).rejects.toThrow('free web limit')
 }
})
