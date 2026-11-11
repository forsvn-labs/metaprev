// Offline browser fault injection. No remote requests or production load.
import { messagingReport } from '../../app/test/fixtures/messaging.ts'
import { page } from '../lib/page.ts'
import { renderHomeContent, renderResult } from '../views/home.ts'
const report = {...messagingReport, durationMs:1, preview:{title:'Fixture report',description:'',image:'/api/image?id=00000000-0000-0000-0000-000000000001',domain:'example.com',siteName:'Fixture'}}
let posts=0
Bun.serve({hostname:'127.0.0.1',port:4337,fetch(request){
 const u=new URL(request.url)
 if(u.pathname==='/api/image')return new Response('Expired',{status:404})
 if(u.pathname==='/counts')return Response.json({posts})
 if(u.pathname==='/api/inspect'){
  posts++
  if(posts<=2)return new Response('<html>Provider capacity</html>',{status:posts===1?429:503,headers:{'Retry-After':'5'}})
  return Response.json({ok:true,html:renderResult({...report,preview:{...report.preview,image:null}})})
 }
 if(['/app.js','/styles.css','/mark.svg'].includes(u.pathname)||u.pathname.startsWith('/fonts/'))return new Response(Bun.file(new URL(`../public${u.pathname}`,import.meta.url)))
 return new Response(page({title:'Capacity fixture',body:renderHomeContent({url:'https://example.com',result:report}),privatePage:true}),{headers:{'content-type':'text/html'}})
}})
console.log('Capacity fixture ready at http://127.0.0.1:4337')
