// Cache API has no cancellation argument. Stop waiting after one second or
// caller cancellation; a late opaque-ID put can only live for its original TTL.
export async function cacheOperation<T>(work: (signal: AbortSignal) => Promise<T>, outer?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1000)
  const signal = outer ? AbortSignal.any([outer, controller.signal]) : controller.signal
  let abort = () => {}
  try {
    signal.throwIfAborted()
    return await Promise.race([
      new Promise<never>((_, reject) => {
        abort = () => reject(new Error('Preview cache unavailable.'))
        signal.addEventListener('abort', abort, { once: true })
      }),
      work(signal),
    ])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}
