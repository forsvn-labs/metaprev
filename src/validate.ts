import type { ImageProbe, Issue, MetaTags } from './types.ts'

const TITLE_OPTIMAL = [50, 60] as const
const DESC_OPTIMAL = [110, 160] as const
const IMAGE_OPTIMAL = { w: 1200, h: 630 } as const
const IMAGE_RATIO_OPTIMAL = 1200 / 630
const RATIO_TOLERANCE = 0.05

export function validate(meta: MetaTags, image: ImageProbe | undefined): Issue[] {
  const issues: Issue[] = []

  const title = meta.ogTitle ?? meta.twitterTitle ?? meta.title
  if (!title) {
    issues.push({ level: 'error', field: 'title', message: 'No title found (og:title, twitter:title, or <title>)' })
  } else {
    const len = title.length
    if (len < TITLE_OPTIMAL[0]) {
      issues.push({ level: 'warn', field: 'title', message: `Title is short (${len} chars). Optimal: ${TITLE_OPTIMAL[0]}–${TITLE_OPTIMAL[1]} chars` })
    } else if (len > TITLE_OPTIMAL[1]) {
      issues.push({ level: 'warn', field: 'title', message: `Title is long (${len} chars). Optimal: ${TITLE_OPTIMAL[0]}–${TITLE_OPTIMAL[1]} chars; many platforms truncate after ~70` })
    }
  }

  const desc = meta.ogDescription ?? meta.twitterDescription ?? meta.description
  if (!desc) {
    issues.push({ level: 'error', field: 'description', message: 'No description found (og:description, twitter:description, or meta description)' })
  } else {
    const len = desc.length
    if (len < DESC_OPTIMAL[0]) {
      issues.push({ level: 'warn', field: 'description', message: `Description is short (${len} chars). Optimal: ${DESC_OPTIMAL[0]}–${DESC_OPTIMAL[1]} chars` })
    } else if (len > DESC_OPTIMAL[1]) {
      issues.push({ level: 'warn', field: 'description', message: `Description is long (${len} chars). Optimal: ${DESC_OPTIMAL[0]}–${DESC_OPTIMAL[1]} chars; many platforms truncate after ~200` })
    }
  }

  if (!meta.ogImage) {
    issues.push({ level: 'error', field: 'og:image', message: 'No og:image meta tag' })
  } else if (!/^https?:\/\//i.test(meta.ogImage)) {
    issues.push({ level: 'error', field: 'og:image', message: `og:image is not an absolute URL ("${meta.ogImage}"). Many crawlers will fail to fetch it.` })
  }

  if (image) {
    if (!image.ok) {
      issues.push({ level: 'error', field: 'og:image', message: `Image did not load: ${image.error ?? 'HTTP ' + image.status}` })
    } else {
      if (image.width && image.height) {
        const ratio = image.width / image.height
        const ratioDelta = Math.abs(ratio - IMAGE_RATIO_OPTIMAL) / IMAGE_RATIO_OPTIMAL
        if (image.width !== IMAGE_OPTIMAL.w || image.height !== IMAGE_OPTIMAL.h) {
          const exactRecommended = ratioDelta <= RATIO_TOLERANCE
          issues.push({
            level: exactRecommended && image.width >= 600 ? 'info' : 'warn',
            field: 'og:image',
            message: `Image is ${image.width}×${image.height}px. Recommended: ${IMAGE_OPTIMAL.w}×${IMAGE_OPTIMAL.h}px (1.91:1).`,
          })
        }
        if (image.width < 600) {
          issues.push({ level: 'warn', field: 'og:image', message: `Image is small (${image.width}px wide). Most platforms want at least 600px.` })
        }
      }
      if (image.byteLength && image.byteLength > 8 * 1024 * 1024) {
        issues.push({ level: 'warn', field: 'og:image', message: `Image is ${(image.byteLength / 1024 / 1024).toFixed(1)} MB. Some platforms reject files over 8 MB.` })
      }
    }
  }

  if (meta.ogImage && (!meta.ogImageWidth || !meta.ogImageHeight)) {
    issues.push({ level: 'info', field: 'og:image', message: 'Missing og:image:width / og:image:height. Optional but speeds up first-render on Slack and Discord.' })
  }

  if (image?.ok && image.width && image.height && meta.ogImageWidth && meta.ogImageHeight) {
    const declaredW = Number(meta.ogImageWidth)
    const declaredH = Number(meta.ogImageHeight)
    if (!Number.isFinite(declaredW) || !Number.isFinite(declaredH)) {
      issues.push({
        level: 'warn',
        field: 'og:image',
        message: `og:image:width/height are not valid integers ("${meta.ogImageWidth}"/"${meta.ogImageHeight}"). Crawlers may ignore them.`,
      })
    } else if (Math.abs(declaredW - image.width) > 1 || Math.abs(declaredH - image.height) > 1) {
      issues.push({
        level: 'warn',
        field: 'og:image',
        message: `Declared og:image:width/height (${declaredW}×${declaredH}) does not match actual image (${image.width}×${image.height}). Slack and Discord trust the declared values for first-paint and will mis-crop.`,
      })
    }
  }

  if (!meta.twitterCard) {
    issues.push({ level: 'info', field: 'twitter:card', message: 'No twitter:card meta tag. Use "summary_large_image" for big-image cards.' })
  } else if (meta.twitterCard !== 'summary_large_image' && meta.twitterCard !== 'summary') {
    issues.push({ level: 'info', field: 'twitter:card', message: `twitter:card is "${meta.twitterCard}" — unusual; expected "summary_large_image" or "summary".` })
  }

  if (!meta.ogUrl && !meta.canonical) {
    issues.push({ level: 'info', field: 'og:url', message: 'No og:url or canonical link. Helps with deduping shares.' })
  }

  return issues
}
