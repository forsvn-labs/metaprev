import type { MetaTags } from './types.ts'

const META_RE = /<meta\s+([^>]+?)\/?>/gi
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i
const LINK_RE = /<link\s+([^>]+?)\/?>/gi

const ATTR_RE = /(\w[\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  let m: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const key = m[1]?.toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    if (key) out[key] = decodeEntities(value)
  }
  return out
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
}

export function parseMeta(html: string): MetaTags {
  const head = extractHead(html)
  const tags: MetaTags = {}

  const titleMatch = TITLE_RE.exec(head)
  if (titleMatch?.[1]) tags.title = decodeEntities(titleMatch[1].trim())

  let m: RegExpExecArray | null
  META_RE.lastIndex = 0
  while ((m = META_RE.exec(head)) !== null) {
    const a = attrs(m[1] ?? '')
    const key = (a['property'] ?? a['name'] ?? '').toLowerCase()
    const content = a['content']
    if (!key || content === undefined) continue
    assign(tags, key, content)
  }

  LINK_RE.lastIndex = 0
  while ((m = LINK_RE.exec(head)) !== null) {
    const a = attrs(m[1] ?? '')
    if ((a['rel'] ?? '').toLowerCase() === 'canonical' && a['href']) {
      tags.canonical = a['href']
    }
  }

  return tags
}

function extractHead(html: string): string {
  const match = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)
  return match?.[1] ?? html
}

function assign(tags: MetaTags, key: string, value: string): void {
  switch (key) {
    case 'description':
      tags.description ??= value
      break
    case 'og:type':
      tags.ogType = value
      break
    case 'og:site_name':
      tags.ogSiteName = value
      break
    case 'og:title':
      tags.ogTitle = value
      break
    case 'og:description':
      tags.ogDescription = value
      break
    case 'og:url':
      tags.ogUrl = value
      break
    case 'og:image':
    case 'og:image:url':
    case 'og:image:secure_url':
      tags.ogImage ??= value
      break
    case 'og:image:width':
      tags.ogImageWidth = value
      break
    case 'og:image:height':
      tags.ogImageHeight = value
      break
    case 'og:image:alt':
      tags.ogImageAlt = value
      break
    case 'twitter:card':
      tags.twitterCard = value
      break
    case 'twitter:site':
      tags.twitterSite = value
      break
    case 'twitter:creator':
      tags.twitterCreator = value
      break
    case 'twitter:title':
      tags.twitterTitle = value
      break
    case 'twitter:description':
      tags.twitterDescription = value
      break
    case 'twitter:image':
    case 'twitter:image:src':
      tags.twitterImage ??= value
      break
  }
}
