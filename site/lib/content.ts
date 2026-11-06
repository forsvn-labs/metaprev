import { z } from 'zod'
const text = z.string().trim().min(1)
const https = text.refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}, 'Use an HTTPS URL without credentials.')
const date = text.regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}, 'Use a valid review date.')
const guideSchema = z.object({
  slug: text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), field: text,
  title: text, description: text, answer: text, intent: text,
  checks: z.array(text).min(1), example: text, limitation: text,
  source: z.object({ name: text, url: https }).strict(),
  status: z.enum(['draft', 'published']), reviewed: date,
}).strict()
export type Guide = z.infer<typeof guideSchema>
export function parseGuides(input: unknown): Guide[] {
  const guides = z.array(guideSchema).parse(input)
  const slugs = new Set<string>()
  for (const guide of guides) {
    if (slugs.has(guide.slug)) throw new Error(`Duplicate guide slug: ${guide.slug}`)
    slugs.add(guide.slug)
  }
  return guides
}
export function publishedGuides(guides: Guide[], today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())): Guide[] {
  return guides.filter(guide => {
    if (guide.status !== 'published') return false
    if (guide.reviewed > today) throw new Error(`Published guide has a future review date: ${guide.slug}`)
    return true
  })
}
export function parseSupportUrl(value: string): string {
  if (!value) return ''
  const url = new URL(https.parse(value))
  const allowed = (url.hostname === 'github.com' && /^\/sponsors\/[A-Za-z0-9-]+\/?$/.test(url.pathname))
    || (['ko-fi.com', 'buymeacoffee.com', 'www.buymeacoffee.com'].includes(url.hostname) && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname))
  if (!allowed || url.port || url.search || url.hash) throw new Error('Use a public support profile URL.')
  return url.href
}
