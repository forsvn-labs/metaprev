import settings from './support.json'
import { parseSupportUrl } from '../lib/content.ts'
export const supportUrl = parseSupportUrl(settings.url)
