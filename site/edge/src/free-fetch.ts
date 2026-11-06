import { InspectionError, parseTarget, assertPublicAddress } from '../../lib/url-policy.ts'
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
export async function boundedBody(response: Response, max: number, signal: AbortSignal, head = false): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length')) > max) { await response.body?.cancel(); throw new InspectionError('Response exceeds the free web limit. Use the CLI.') }
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []; let size=0; let tail=''
  try {
    while (true) {
      signal.throwIfAborted()
      let abort: () => void = ()=>{}
      const part = await Promise.race([reader.read(), new Promise<never>((_,reject)=>{
        abort=()=>reject(new InspectionError('The request timed out.'))
        signal.addEventListener('abort',abort,{once:true})
      })]).finally(()=>signal.removeEventListener('abort',abort))
      if (part.done) break
      size+=part.value.length
      if(size>max) throw new InspectionError('Response exceeds the free web limit. Use the CLI.')
      chunks.push(part.value)
      if(head){const text=tail+new TextDecoder().decode(part.value);tail=text.slice(-32);if(/<\/head\s*>/i.test(text))break}
    }
  } finally { void reader.cancel().catch(()=>{}) }
  const body=new Uint8Array(size);let offset=0
  for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length}
  return body
}
export async function fetchRemote(input:string, kind:'html'|'image', request:Fetcher=fetch, outer?:AbortSignal) {
  let url=parseTarget(input)
  const signal=AbortSignal.any([AbortSignal.timeout(kind==='html'?10000:6000),...(outer?[outer]:[])])
  const visited=new Set<string>()
  for(let redirects=0;redirects<=4;redirects++){
    if(visited.has(url.href))throw new InspectionError('The page redirects in a loop.')
    visited.add(url.href)
    // Cloudflare's native fetch supplies the network isolation boundary. This
    // extra DNS check rejects private answers before fetch; it is not DNS pinning.
    const answers=await Promise.all(['A','AAAA'].map(async type=>{
      const dns=await request(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(url.hostname)}&type=${type}`,{signal,headers:{accept:'application/dns-json'}})
      if(!dns.ok)throw new InspectionError('The hostname could not be checked.')
      const data=JSON.parse(new TextDecoder().decode(await boundedBody(dns,16384,signal)))
      if(data.Status!==0)throw new InspectionError('The hostname could not be resolved.')
      return (data.Answer??[]).filter((a:{type:number})=>a.type===1||a.type===28).map((a:{data:string})=>a.data) as string[]
    }))
    if(!answers.flat().length)throw new InspectionError('The hostname has no public address.')
    answers.flat().forEach(assertPublicAddress)
    const response=await request(url.href,{signal,redirect:'manual',headers:{
      'User-Agent':'metaprev/0.1 (+https://github.com/forsvn-labs/metaprev)',
      Accept:kind==='html'?'text/html,application/xhtml+xml':'image/png,image/jpeg,image/webp,image/gif',
    }})
    if([301,302,303,307,308].includes(response.status)){
      await response.body?.cancel()
      const location=response.headers.get('location')
      if(!location)throw new InspectionError('Redirect has no destination.')
      url=parseTarget(new URL(location,url).href);continue
    }
    const contentType=(response.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase()
    const accepted=kind==='html'?['text/html','application/xhtml+xml']:['image/png','image/jpeg','image/webp','image/gif']
    if(!response.ok||!accepted.includes(contentType)){await response.body?.cancel();throw new InspectionError(`Target returned HTTP ${response.status} or an unsupported content type.`)}
    const body=await boundedBody(response,kind==='html'?128*1024:1024*1024,signal,kind==='html')
    return {url:url.href,status:response.status,headers:Object.fromEntries(response.headers),body,contentType}
  }
  throw new InspectionError('The page exceeded the four-redirect limit.')
}
