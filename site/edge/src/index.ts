import { inspectWith } from '../../lib/inspect-core.ts'
import { renderHomeContent, renderResult } from '../../views/home.ts'
import { page } from '../../lib/page.ts'
import { InspectionError } from '../../lib/url-policy.ts'
import { boundedBody, fetchRemote } from './free-fetch.ts'
import { createAdmission } from './admission.ts'
import { cacheOperation } from './cache-operation.ts'
const privateHeaders = {
  'Cache-Control':'no-store, no-transform', 'X-Robots-Tag':'noindex, nofollow',
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
}
const admission = createAdmission()
export default {
  async fetch(request:Request,_env:Cloudflare.Env):Promise<Response>{
    const url=new URL(request.url)
    const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{...privateHeaders,'Cache-Control':'no-store'}})
    const html=(body:string,status=200)=>new Response(page({title:'Check a URL · Metaprev',body,privatePage:true}),{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8'}})
    if(url.pathname==='/api/image'){
      if(!['GET','HEAD'].includes(request.method))return json({ok:false,error:'Use GET.'},405)
      const id=url.searchParams.get('id')??''
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return json({ok:false,error:'Invalid image.'},400)
      try {
        const cached=await cacheOperation(async signal=>{
          const cache=await caches.open('metaprev-images')
          signal.throwIfAborted()
          return cache.match(new Request(`${url.origin}/api/image?id=${id}`))
        },request.signal)
        if(!cached)return json({ok:false,error:'Preview expired. Inspect the URL again.'},404)
        if(request.method==='HEAD')void cached.body?.cancel().catch(()=>{})
        return new Response(request.method==='HEAD'?null:cached.body,{headers:{...privateHeaders,'Content-Type':cached.headers.get('Content-Type')!}})
      } catch {
        const response=json({ok:false,error:'Preview storage is unavailable. Try again in a few seconds.'},503)
        response.headers.set('Retry-After','5')
        return response
      }
    }
    if(!['/api/inspect','/inspect'].includes(url.pathname))return json({ok:false,error:'Not found.'},404)
    const fail=(error:string,status:number)=>url.pathname==='/inspect'?html(renderHomeContent({error}),status):json({ok:false,error},status)
    if(request.method!=='POST')return fail('Use POST to inspect a URL.',405)
    const origin=request.headers.get('origin')
    if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return fail('Open Metaprev to inspect a URL.',403)
    // Per-isolate guard, not a global quota. Workers Free supplies the account
    // request/CPU ceilings. No paid bindings, database, or private-network access.
    const permit=admission.acquire(request.headers.get('CF-Connecting-IP')??'unknown')
    if('status' in permit){
      const response=fail(permit.status===429
        ? `Too many checks. Wait ${permit.retryAfter} seconds, then try again.`
        : `The inspector is busy. Wait ${permit.retryAfter} seconds, then try again or use the local CLI.`,permit.status)
      response.headers.set('Retry-After',String(permit.retryAfter))
      return response
    }
    try{
      const bytes=await boundedBody(new Response(request.body),16384,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]))
      const text=new TextDecoder().decode(bytes)
      const input=(request.headers.get('content-type')??'').includes('application/json')?JSON.parse(text):Object.fromEntries(new URLSearchParams(text))
      if(typeof input?.url!=='string'||!input.url.trim()||input.url.length>2048)throw new InspectionError('Enter a public URL.',400)
      const report=await inspectWith(input.url,(target,{kind})=>fetchRemote(target,kind,fetch,request.signal),async(bytes,type)=>{
        const id=crypto.randomUUID()
        await cacheOperation(async signal=>{
          const cache=await caches.open('metaprev-images')
          signal.throwIfAborted()
          await cache.put(new Request(`${url.origin}/api/image?id=${id}`),new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=300'}}))
        },request.signal)
        return `/api/image?id=${id}`
      })
      return url.pathname==='/inspect'?html(renderHomeContent({url:input.url,result:report})):json({ok:true,report,html:renderResult(report)})
    }catch(error){return fail(error instanceof InspectionError?error.message:'The page could not be inspected. Check the URL or use the local CLI.',error instanceof SyntaxError?400:error instanceof InspectionError?error.status:422)}
    finally{permit.release()}
  },
} satisfies ExportedHandler<Cloudflare.Env>
