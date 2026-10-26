import { guides } from '../data/guides.ts'

const routes = new Set(['/', '/guides', '/about', '/privacy', ...guides.map(g => `/guides/${g.slug}`)])
type Counter = { route: string; requests: number; failures: number; latencyMs: { under100: number; under500: number; slower: number } }

// Optional operational totals, not visitor tracking. No IP, UA, cookies,
// referrers, query strings, submitted URLs, report contents or unique IDs.
// Fixed-cardinality memory, hourly aggregate output, no collector endpoint.
export class AggregateAnalytics {
  readonly enabled: boolean
  private counters = new Map<string, Counter>()
  constructor(env: Record<string, string | undefined>) {
    this.enabled = env.ANALYTICS_ENABLED === 'on' && env.ANALYTICS_OWNER_APPROVED === 'on'
  }
  record(request: Request, status: number, durationMs: number): void {
    if (!this.enabled || request.method !== 'GET' || request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return
    const url = new URL(request.url)
    if (url.search || !routes.has(url.pathname)) return
    const counter = this.counters.get(url.pathname) ?? { route: url.pathname, requests: 0, failures: 0, latencyMs: { under100: 0, under500: 0, slower: 0 } }
    counter.requests++
    if (status >= 400) counter.failures++
    counter.latencyMs[durationMs < 100 ? 'under100' : durationMs < 500 ? 'under500' : 'slower']++
    this.counters.set(url.pathname, counter)
  }
  drain(): { kind: string; routes: Counter[] } | null {
    if (!this.enabled || !this.counters.size) return null
    const snapshot = { kind: 'metaprev-public-page-totals', routes: [...this.counters.values()] }
    this.counters.clear()
    return snapshot
  }
}
