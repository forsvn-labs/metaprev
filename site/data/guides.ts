// One record per reader task. Drafts never enter public discovery or HTML.
import content from './guides.json'
import { parseGuides, publishedGuides } from '../lib/content.ts'
export type { Guide } from '../lib/content.ts'
export const guides = publishedGuides(parseGuides(content.guides))
