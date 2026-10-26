// Small streaming head boundary scanner, not a DOM parser. Ignore closing-head
// text inside comments, quoted attributes and raw-text elements. The caller
// bounds input bytes; this class retains only the current token prefix.
export class HeadBoundary {
  private token = ''
  private quote = ''
  private comment = false
  private tail = ''
  private raw = ''
  private rawTail = ''
  private templateDepth = 0
  private offset = 0
  end: number | undefined
  push(text: string): number | undefined {
    for (const char of text) {
      this.offset++
      if (this.end !== undefined) break
      if (this.raw) {
        this.rawTail = (this.rawTail + char).slice(-40)
        if (char === '>' && new RegExp(`</${this.raw}\\s*>$`, 'i').test(this.rawTail)) { this.raw = ''; this.rawTail = ''; this.token = '' }
        continue
      }
      if (this.comment) {
        this.tail = (this.tail + char).slice(-3)
        if (this.tail === '-->') { this.comment = false; this.token = ''; this.tail = '' }
        continue
      }
      if (!this.token) { if (char === '<') this.token = '<'; continue }
      if (this.quote) { if (char === this.quote) this.quote = ''; continue }
      if (char === '"' || char === "'") { this.quote = char; continue }
      if (char === '>') {
        const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)\b/i.exec(this.token)
        const name = match?.[2]?.toLowerCase()
        const closing = match?.[1] === '/'
        if (name === 'template') this.templateDepth = Math.max(0, this.templateDepth + (closing ? -1 : 1))
        else if (closing && name === 'head' && !this.templateDepth) this.end = this.offset
        else if (!closing && name && ['script', 'style', 'title', 'textarea'].includes(name)) this.raw = name
        this.token = ''
        continue
      }
      if (char === '<') this.token = '<'
      else if (this.token.length < 64) this.token += char
      if (this.token === '<!--' && !this.raw) { this.comment = true; this.tail = '' }
    }
    return this.end
  }
}

// Extract only real tags. Quotes delimit attributes, comments and raw text are
// inert, and templates do not contribute metadata. This is intentionally a head
// metadata tokenizer, not browser error recovery or a full HTML DOM.
export function metadataHead(html: string): string {
  let output = ''
  let index = 0
  let templates = 0
  while (index < html.length) {
    const start = html.indexOf('<', index)
    if (start < 0) break
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4)
      if (end < 0) break
      index = end + 3
      continue
    }
    let end = start + 1
    let quote = ''
    for (; end < html.length; end++) {
      const char = html[end]!
      if (quote) { if (char === quote) quote = '' }
      else if (char === '"' || char === "'") quote = char
      else if (char === '>') break
    }
    if (end === html.length) break
    const tag = html.slice(start, end + 1)
    const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)\b/i.exec(tag)
    const name = match?.[2]?.toLowerCase()
    const closing = match?.[1] === '/'
    index = end + 1
    if (name === 'template') { templates = Math.max(0, templates + (closing ? -1 : 1)); continue }
    if (!closing && name && ['script', 'style', 'title', 'textarea'].includes(name)) {
      const close = new RegExp(`</${name}\\s*>`, 'gi')
      close.lastIndex = index
      const found = close.exec(html)
      if (name === 'title' && !templates) output += '<title>' + html.slice(index, found?.index ?? html.length).replace(/</g, '&lt;') + '</title>'
      if (!found) break
      index = close.lastIndex
      continue
    }
    if (templates) continue
    if (closing && name === 'head' || !closing && name === 'body') break
    if (name === 'meta' || name === 'link') output += tag
  }
  return output
}
