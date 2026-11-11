import { InspectionError, parseTarget, assertPublicAddress } from '../../lib/url-policy.ts'
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
export async function boundedBody(response: Response, max: number, signal: AbortSignal, head = false): Promise<Uint8Array> {
  if (signal.aborted) { void response.body?.cancel().catch(()=>{}); signal.throwIfAborted() }
  if (!head && Number(response.headers.get('content-length')) > max) { void response.body?.cancel().catch(()=>{}); throw new InspectionError('Response exceeds the free web limit. Use the CLI.') }
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
      let chunk = part.value
      let complete = false
      if (head) {
        // Single-byte decoding preserves byte offsets for this ASCII delimiter.
        // Scan only the remaining allowance, never an unbounded response chunk.
        const text = tail + new TextDecoder('latin1').decode(chunk.subarray(0, max - size))
        const end = /<\/head\s*>/i.exec(text)
        if (end) {
          chunk = chunk.subarray(0, end.index + end[0].length - tail.length)
          complete = true
        }
        tail = text.slice(-32)
      }
      size += chunk.length
      if (size > max) throw new InspectionError('Response exceeds the free web limit. Use the CLI.')
      chunks.push(chunk)
      if (complete) break
    }
  } finally { void reader.cancel().catch(()=>{}) }
  const body=new Uint8Array(size);let offset=0
  for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length}
  return body
}
export async function fetchRemote(input:string, kind:'html'|'image', request:Fetcher=fetch, outer?:AbortSignal) {
  let url=parseTarget(input)
  const signal=AbortSignal.any([AbortSignal.timeout(kind==='html'?10000:6000),...(outer?[outer]:[])])
  signal.throwIfAborted()
  const visited=new Set<string>()
  for(let redirects=0;redirects<=4;redirects++){
    signal.throwIfAborted()
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
    signal.throwIfAborted()
    const response=await request(url.href,{signal,redirect:'manual',headers:{
      'User-Agent':'metaprev/0.1 (+https://github.com/forsvn-labs/metaprev)',
      Accept:kind==='html'?'text/html,application/xhtml+xml':'image/png,image/jpeg,image/webp,image/gif',
    }})
    if([301,302,303,307,308].includes(response.status)){
      void response.body?.cancel().catch(()=>{})
      const location=response.headers.get('location')
      if(!location)throw new InspectionError('Redirect has no destination.')
      url=parseTarget(new URL(location,url).href);continue
    }
    const contentType=(response.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase()
    const accepted=kind==='html'?['text/html','application/xhtml+xml']:['image/png','image/jpeg','image/webp','image/gif']
    if(!response.ok||!accepted.includes(contentType)){void response.body?.cancel().catch(()=>{});throw new InspectionError(`Target returned HTTP ${response.status} or an unsupported content type.`)}
    const body=await boundedBody(response,kind==='html'?128*1024:1024*1024,signal,kind==='html')
    return {url:url.href,status:response.status,headers:Object.fromEntries(response.headers),body,contentType}
  }
  throw new InspectionError('The page exceeded the four-redirect limit.')
}
