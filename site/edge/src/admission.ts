// One instance per Worker isolate. No global quota or persistent IP history.
export function createAdmission(clock = Date.now) {
  const buckets = new Map<string, { until: number; count: number }>()
  let active = 0
  let last = 0
  return {
    acquire(key: string): { status: 429 | 503; retryAfter: number } | { release: () => void } {
      // A backwards wall-clock step must not extend a previously issued delay.
      const now = Math.max(last, clock())
      last = now
      if (active >= 4) return { status: 503, retryAfter: 5 }
      if (buckets.size >= 5000) {
        for (const [id, value] of buckets) if (value.until <= now) buckets.delete(id)
      }
      let bucket = buckets.get(key)
      if (!bucket || bucket.until <= now) {
        // Do not evict live callers: churn would reset their rate limits.
        if (!bucket && buckets.size >= 5000) return { status: 503, retryAfter: 60 }
        bucket = { until: now + 60000, count: 0 }
        buckets.set(key, bucket)
      }
      if (bucket.count >= 20) return { status: 429, retryAfter: Math.max(1, Math.ceil((bucket.until - now) / 1000)) }
      bucket.count++
      active++
      let released = false
      return { release() { if (!released) { released = true; active-- } } }
    },
  }
}
