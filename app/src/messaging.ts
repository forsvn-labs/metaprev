import { resolvePlatformInput, type ResolvedInputValue } from './inputs.ts'
import type { MetaTags } from './types.ts'

export type MessagingSurfaceId = 'messenger' | 'imessage' | 'telegram' | 'x-chat' | 'whatsapp' | 'slack'
export type MessagingSurface = {
  id: MessagingSurfaceId; label: string; status: 'simulated' | 'unverified'
  layout: 'image-first' | 'text-first' | 'compact' | 'link-only'; description: boolean
  note: string; source: { label: string; url: string }; integration: string
}

// Workspace OG policy: this is not undocumented vendor fallback precedence.
export const messagingSurfaces: readonly MessagingSurface[] = [
  {
    id: 'messenger', label: 'Messenger', status: 'simulated', layout: 'image-first', description: true,
    note: 'Previews depend on chat settings and cached content. This OG layout is illustrative.',
    source: { label: 'Meta: encrypted chat previews', url: 'https://about.fb.com/news/2023/01/expanding-features-for-end-to-end-encryption-on-messenger/' },
    integration: 'Messenger business templates and Send API are separate from consumer link previews.',
  },
  {
    id: 'imessage', label: 'iMessage', status: 'simulated', layout: 'image-first', description: false,
    note: 'Ordinary web-link treatment: image, title and domain. Apple does not run page JavaScript. Icons, video and specialized social-post descriptions are not modeled.',
    source: { label: 'Apple: rich previews for Messages', url: 'https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages' },
    integration: 'Native Link Presentation is not a remote Messages renderer or cache inspector.',
  },
  {
    id: 'telegram', label: 'Telegram', status: 'simulated', layout: 'text-first', description: true,
    note: 'Senders can choose a link, media size and preview position. These local examples do not change Telegram settings.',
    source: { label: 'Telegram: adjustable link previews', url: 'https://telegram.org/blog/reply-revolution' },
    integration: 'Bot API LinkPreviewOptions require a bot connection; no bot is connected here.',
  },
  {
    id: 'x-chat', label: 'X Chat', status: 'unverified', layout: 'link-only', description: false,
    note: 'External-site rich preview behavior has not been verified. This URL-only placeholder does not predict the live client. X feed Cards are a different surface.',
    source: { label: 'X: about Chat', url: 'https://help.x.com/en/using-x/about-chat' },
    integration: 'The authenticated DM API is not an anonymous Chat preview validator.',
  },
  {
    id: 'whatsapp', label: 'WhatsApp', status: 'simulated', layout: 'compact', description: true,
    note: 'Users can disable link previews in Privacy settings. A valid page cannot force a preview to appear.',
    source: { label: 'WhatsApp: disable link previews', url: 'https://faq.whatsapp.com/445453537819972' },
    integration: 'A WhatsApp Business or Cloud API message is a separate integration.',
  },
  {
    id: 'slack', label: 'Slack', status: 'simulated', layout: 'text-first', description: true,
    note: 'Classic metadata unfurl simulation. Workspace restrictions and user preferences can suppress it; app unfurls may replace it.',
    source: { label: 'Slack: classic and app unfurls', url: 'https://docs.slack.dev/messaging/unfurling-links-in-messages/' },
    integration: 'App unfurls require a Slack app and authorization; chat.unfurl is not connected.',
  },
]

export type MessagingPreview = {
  surface: MessagingSurface; title: ResolvedInputValue
  description: ResolvedInputValue | null; imageUrl?: string
}

export function resolveMessagingPreview(meta: MetaTags, id: MessagingSurfaceId): MessagingPreview {
  const surface = messagingSurfaces.find(surface => surface.id === id)
  if (!surface) throw new Error(`Unknown messaging surface: ${id}`)
  return {
    surface,
    title: surface.status === 'unverified' ? { source: 'none', fallback: false } : resolvePlatformInput(meta, 'Open Graph', 'title'),
    description: surface.description ? resolvePlatformInput(meta, 'Open Graph', 'description') : null,
    imageUrl: surface.status === 'unverified' ? undefined : meta.ogImage,
  }
}
