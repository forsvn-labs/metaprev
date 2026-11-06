import { inspectWith } from '../../lib/inspect-core.ts'
import { renderHomeContent, renderResult } from '../../views/home.ts'
import { page } from '../../lib/page.ts'
import { InspectionError } from '../../lib/url-policy.ts'
import { boundedBody, fetchRemote } from './free-fetch.ts'
const privateHeaders = {
  'Cache-Control':'no-store, no-transform', 'X-Robots-Tag':'noindex, nofollow',
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
}
const buckets=new Map<string,{until:number;count:number}>()
let active=0
function allowed(key:string){
  const now=Date.now()
  if(buckets.size>=5000)for(const [key,value] of buckets)if(value.until<=now)buckets.delete(key)
  let bucket=buckets.get(key)
  if(!bucket||bucket.until<=now){if(!bucket&&buckets.size>=5000)return false;bucket={until:now+60000,count:0};buckets.set(key,bucket)}
  return ++bucket.count<=20
}
export default {
  async fetch(request:Request,env:Cloudflare.Env):Promise<Response>{
    const url=new URL(request.url)
    const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{...privateHeaders,'Cache-Control':'no-store'}})
    const html=(body:string,status=200)=>new Response(page({title:'Check a URL · Metaprev',body,privatePage:true}),{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8'}})
    if(url.pathname==='/api/image'){
      if(!['GET','HEAD'].includes(request.method))return json({ok:false,error:'Use GET.'},405)
      const id=url.searchParams.get('id')??''
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return json({ok:false,error:'Invalid image.'},400)
      const cache=await caches.open('metaprev-images')
      const cached=await cache.match(new Request(`${url.origin}/api/image?id=${id}`))
      if(!cached)return json({ok:false,error:'Preview expired. Inspect the URL again.'},404)
      return new Response(request.method==='HEAD'?null:cached.body,{headers:{...privateHeaders,'Content-Type':cached.headers.get('Content-Type')!}})
    }
    if(!['/api/inspect','/inspect'].includes(url.pathname))return json({ok:false,error:'Not found.'},404)
    const fail=(error:string,status:number)=>url.pathname==='/inspect'?html(renderHomeContent({error}),status):json({ok:false,error},status)
    if(request.method!=='POST')return fail('Use POST to inspect a URL.',405)
    const origin=request.headers.get('origin')
    if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return fail('Open Metaprev to inspect a URL.',403)
    // Per-isolate guard, not a global quota. Workers Free supplies the account
    // request/CPU ceilings. No paid bindings, database, or private-network access.
    if(active>=4||!allowed(request.headers.get('CF-Connecting-IP')??'unknown'))return fail('Please wait a minute before inspecting another URL.',429)
    active++
    try{
      const bytes=await boundedBody(new Response(request.body),16384,AbortSignal.timeout(5000))
      const text=new TextDecoder().decode(bytes)
      const input=(request.headers.get('content-type')??'').includes('application/json')?JSON.parse(text):Object.fromEntries(new URLSearchParams(text))
      if(typeof input?.url!=='string'||!input.url.trim()||input.url.length>2048)throw new InspectionError('Enter a public URL.',400)
      const report=await inspectWith(input.url,(target,{kind})=>fetchRemote(target,kind),async(bytes,type)=>{
        const id=crypto.randomUUID()
        const cache=await caches.open('metaprev-images')
        await cache.put(new Request(`${url.origin}/api/image?id=${id}`),new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=300'}}))
        return `/api/image?id=${id}`
      })
      return url.pathname==='/inspect'?html(renderHomeContent({url:input.url,result:report})):json({ok:true,report,html:renderResult(report)})
    }catch(error){return fail(error instanceof InspectionError?error.message:'The page could not be inspected. Check the URL or use the local CLI.',error instanceof SyntaxError?400:error instanceof InspectionError?error.status:422)}
    finally{active--}
  },
} satisfies ExportedHandler<Cloudflare.Env>
