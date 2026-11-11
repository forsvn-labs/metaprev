// One public inspection plus opaque cache reads; never a load test.
import { imageSize } from 'image-size'
const base=process.env.BASE??'https://metaprev.forsvn.com'
function check(ok:boolean, label:string){if(!ok)throw Error(label);console.log('PASS '+label)}
function privacy(response:Response){return response.headers.get('cache-control')?.includes('no-store')===true&&response.headers.get('x-robots-tag')?.includes('noindex')===true}
const result=await fetch(base+'/api/inspect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://conquistador.app'})})
const data=await result.json()
check(result.ok&&data.ok&&privacy(result),'live inspection and private report')
const path=data.report.preview.image
check(typeof path==='string'&&/^\/api\/image\?id=[a-f0-9-]{36}$/.test(path),'opaque image URL')
const image=await fetch(base+path)
const facts=imageSize(new Uint8Array(await image.arrayBuffer()))
check(image.ok&&privacy(image)&&facts.width===1200&&facts.height===630,'live private 1200x630 image')
const head=await fetch(base+path,{method:'HEAD'})
check(head.ok&&privacy(head)&&(await head.arrayBuffer()).byteLength===0,'HEAD image without body')
const miss=await fetch(base+'/api/image?id='+crypto.randomUUID())
check(miss.status===404&&privacy(miss),'missing image is private 404')
check((await miss.text()).includes('Inspect the URL again'),'manual recovery instructions')
