import data from '../data/guides.json'
import { parseGuides, publishedGuides } from '../lib/content.ts'
import { supportUrl } from '../data/support.ts'
const all = parseGuides(data.guides)
console.log(JSON.stringify({ total: all.length, published: publishedGuides(all).length, drafts: all.filter(g => g.status === 'draft').length, supportUrl }, null, 2))
