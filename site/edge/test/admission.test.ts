// Exact window boundaries, backwards/forward clocks, bounded identity churn,
// no live-bucket eviction, per-isolate independence, release idempotence.
import { expect, test } from 'bun:test'
import { createAdmission } from '../src/admission.ts'
function complete(g:ReturnType<typeof createAdmission>, key:string) {
 const p=g.acquire(key)
 if('release' in p)p.release()
 return p
}
test('twenty admissions; denied retries do not renew window; exact expiry resets',()=>{
 let now=100000;const g=createAdmission(()=>now)
 for(let i=0;i<20;i++)expect(complete(g,'a')).toHaveProperty('release')
 expect(complete(g,'a')).toEqual({status:429,retryAfter:60})
 now+=59999
 expect(complete(g,'a')).toEqual({status:429,retryAfter:1})
 now++
 expect(complete(g,'a')).toHaveProperty('release')
 now+=60001
 expect(complete(g,'a')).toHaveProperty('release')
})
test('clock rollback does not reset quota or emit a retry delay over sixty seconds',()=>{
 let now=100000;const g=createAdmission(()=>now)
 for(let i=0;i<20;i++)complete(g,'a')
 now=0
 expect(complete(g,'a')).toEqual({status:429,retryAfter:60})
 now=160000
 expect(complete(g,'a')).toHaveProperty('release')
})
test('5000 identities stay bounded under 20000 rejected newcomers; expired entries recover',()=>{
 let now=100000;const g=createAdmission(()=>now)
 for(let i=0;i<5000;i++)expect(complete(g,String(i))).toHaveProperty('release')
 for(let i=0;i<19;i++)complete(g,'0')
 for(let i=5000;i<25000;i++)expect(complete(g,String(i))).toEqual({status:503,retryAfter:60})
 // Live buckets were not evicted to admit churn, including the exhausted caller.
 expect(complete(g,'0')).toEqual({status:429,retryAfter:60})
 expect(complete(g,'1')).toHaveProperty('release')
 now+=60000
 for(let i=5000;i<10000;i++)expect(complete(g,String(i))).toHaveProperty('release')
 expect(complete(g,'10000')).toEqual({status:503,retryAfter:60})
})
test('four slots and idempotent releases; busy rejection does not consume caller quota',()=>{
 const g=createAdmission(()=>0);const holders=Array.from({length:4},(_,i)=>g.acquire(String(i)))
 for(let i=0;i<100;i++)expect(g.acquire('new')).toEqual({status:503,retryAfter:5})
 for(const p of holders)if('release' in p){p.release();p.release()}
 for(let i=0;i<20;i++)expect(complete(g,'new')).toHaveProperty('release')
 expect(complete(g,'new')).toEqual({status:429,retryAfter:60})
 const next=Array.from({length:4},(_,i)=>g.acquire(`next-${i}`))
 expect(g.acquire('overflow')).toEqual({status:503,retryAfter:5})
 for(const p of next)if('release' in p)p.release()
})
test('independent isolates do not claim a shared quota',()=>{
 const a=createAdmission(()=>0),b=createAdmission(()=>0)
 for(let i=0;i<20;i++)complete(a,'same')
 expect(complete(a,'same')).toHaveProperty('status',429)
 expect(complete(b,'same')).toHaveProperty('release')
})
