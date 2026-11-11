import { expect, test } from 'bun:test'
import { cacheOperation } from '../src/cache-operation.ts'
test('already cancelled cache operation never starts',async()=>{
 let calls=0
 await expect(cacheOperation(async()=>{calls++},AbortSignal.abort())).rejects.toThrow()
 expect(calls).toBe(0)
})
test('cancellation releases waiting work; late rejection is handled; valid retry works',async()=>{
 const c=new AbortController();const entered=Promise.withResolvers<void>();const work=Promise.withResolvers<string>()
 const result=cacheOperation(()=>{entered.resolve();return work.promise},c.signal)
 await entered.promise;c.abort()
 await expect(result).rejects.toThrow()
 work.reject(Error('late failure'))
 expect(await cacheOperation(async()=>'retry')).toBe('retry')
})
test('stalled put stops waiting at deadline; late completion cannot change returned result',async()=>{
 const work=Promise.withResolvers<string>()
 await expect(cacheOperation(()=>work.promise)).rejects.toThrow()
 work.resolve('late')
 expect(await cacheOperation(async()=>'next')).toBe('next')
})
