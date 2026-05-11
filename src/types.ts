export type MetaTags = {
  title?: string
  description?: string
  canonical?: string
  ogSiteName?: string
  ogTitle?: string
  ogDescription?: string
  ogUrl?: string
  ogImage?: string
  ogImageWidth?: string
  ogImageHeight?: string
  twitterCard?: string
  twitterSite?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

export type ImageProbe = {
  url: string
  resolved: string
  status: number
  ok: boolean
  contentType?: string
  byteLength?: number
  width?: number
  height?: number
  error?: string
  // base64 data URI of the fetched image bytes. Embedded in the HTML preview so the
  // browser renders exactly what was validated, not whatever stale copy it has cached
  // for the og:image URL. Stripped from --json output.
  dataUri?: string
}

export type Issue = {
  level: 'error' | 'warn' | 'info'
  field: string
  message: string
}

export type Report = {
  source: string
  fetchedAt: string
  finalUrl: string
  status: number
  meta: MetaTags
  image?: ImageProbe
  issues: Issue[]
}
