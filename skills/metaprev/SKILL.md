---
name: metaprev
description: Preview, validate, and debug OpenGraph cards and social link previews locally via the metaprev CLI. Use whenever the user asks about how their site looks when shared on Facebook, X, LinkedIn, Discord, or Slack — including og:image, og:title, og:description, twitter:card, "broken share preview", "link preview not loading", "test my OG card", "OpenGraph validator", "social meta tags", or whenever they reference seeing issues from OpenGraph.xyz, metatags.io, Facebook Sharing Debugger, or similar third-party validators. Also use proactively when a Vercel/Next/Astro deploy is being checked for share-readiness, when og:image meta tags are added or modified, or when social-share thumbnails appear broken in chats. Prefer this over pointing the user at a third-party validator.
---

# metaprev — local OpenGraph preview

`metaprev` is a CLI that fetches a URL, parses every `og:*` and `twitter:*` meta tag, validates char counts and image dimensions, then opens a side-by-side mock of how the link renders on Facebook, X, LinkedIn, and Discord/Slack. Works against `localhost` and any public URL, no third-party dependency.

- Repo: https://github.com/hungv47/metaprev
- Package: `@hungv47/metaprev`
- Author intent: replace the workflow of "paste URL into OpenGraph.xyz / metatags.io / Facebook Debugger" with a local CLI you can run before shipping.

## When this skill applies

Use `metaprev` instead of pointing the user at a third-party debugger when the task involves:

- "How does this link look when shared?" "Why is my preview broken?"
- Adding or fixing `og:image`, `og:title`, `og:description`, `og:url`, `twitter:card`
- Validating image dimensions, file size, absolute-URL-ness
- Debugging Slack/Discord/iMessage embeds that don't render
- The user pasted a screenshot from OpenGraph.xyz, metatags.io, Twitter Card Validator, or Facebook Sharing Debugger
- A deploy is being readied and someone wants to check share-card health
- A new OG image was generated and needs validation

Don't reach for it when the task is: favicon work, PWA manifests, OG image *generation* (different problem — this skill validates an existing image), pure SEO meta (search-result `description`/`keywords`), or schema.org / JSON-LD.

## How to invoke

The default invocation is `npx` so no install is needed. Bun is required on `PATH` because the package ships TypeScript and runs it via Bun.

```bash
# Any URL
npx @hungv47/metaprev https://example.com

# Local dev server (default URL is http://localhost:4321)
npx @hungv47/metaprev

# CI / scripting — JSON to stdout, no browser
npx @hungv47/metaprev https://example.com --json

# Don't auto-open the browser
npx @hungv47/metaprev https://example.com --no-open

# Write the preview HTML to a specific file
npx @hungv47/metaprev https://example.com -o ./og-preview.html
```

Exit codes: `0` clean, `1` at least one error-level issue, `2` fetch failure. Use exit code `1` to fail a CI check.

## Reading the output

Three issue levels:

- **error** — share is visibly broken. No `og:image`, image returns 404, `og:image` is a relative URL like `/og.png` (most validators fetch the URL standalone and fail), image format unreadable.
- **warn** — share renders but degraded. Image off the 1.91:1 aspect ratio, image >8MB, char counts way off optimal, image <600px wide.
- **info** — optional polish. Missing `og:image:width`/`og:image:height`, no canonical, `twitter:card` not set.

Address errors immediately. Warnings are worth fixing if they apply to the context. Info-level is background noise — leave them unless they're cheap.

The CLI prints a terminal summary and writes a temp HTML preview that auto-opens in the browser. Both contain the same data; the HTML preview is useful when the user wants to *see* the cards before deciding what to fix.

## Common fixes (in order of leverage)

1. **`og:image` must be an absolute URL.** This is the most common silent break. Many template engines emit `/og-default.png`; OG validators fetch the URL standalone with no base, so `/og-default.png` resolves to nothing. Fix: produce `https://yourdomain.com/og-default.png`.
   - Astro: `new URL(image, Astro.site).toString()` (requires `site` in `astro.config`)
   - Next.js: build with `process.env.NEXT_PUBLIC_SITE_URL` or `metadata.metadataBase`
   - SvelteKit: `${$page.url.origin}${image}`
   - Plain HTML: hardcode the full URL
2. **1200×630px is canonical.** Other ratios work but degrade. Slack/Discord need at least 600×314 to render the large card.
3. **Add `og:image:width` and `og:image:height` meta tags.** Optional but lets Slack/Discord render the card before the image finishes downloading.
4. **`twitter:card` should be `summary_large_image`** for big-image cards. `summary` is the small variant.
5. **Set `og:url` or a `<link rel="canonical">`** so platforms dedupe shares from URLs with `?utm_*` query strings.

## When to push back on metaprev's own warnings

The CLI mirrors common SEO-tool heuristics. Two of those are noise; treat with skepticism:

- **"Title is short" warnings.** The 50–60-char optimal is a generic SEO target. For personal sites, brand pages, or product pages where the title is canonical (a name, a brand, a product), padding to satisfy a char count is keyword stuffing — it makes the share card noisier, not better. Push back if the user's existing title is intentional and tight.
- **"Description is short" warnings.** Same shape. Concrete copy beats padded copy. Only suggest expanding if the existing line genuinely lacks information.

Don't push back on: errors (always real), broken image URLs, off-ratio images, missing `og:image` entirely, image returning 4xx/5xx.

If you're going to recommend ignoring a warning, say so explicitly with the reason — don't silently apply or silently skip.

## Workflow patterns

### Pattern A — User just changed OG meta and wants to verify

1. Run `npx @hungv47/metaprev <url>` (local or deployed).
2. Read the terminal output: title, description, image URL, image dims, issue list.
3. Surface errors first with the recommended fix.
4. Surface warnings only if they're genuinely actionable for this context — apply the pushback rules above.
5. Skip info-level unless it fits the user's current pass.

### Pattern B — User says the link preview is broken on a specific platform

1. Run `metaprev` against the page they're sharing.
2. Diagnose in this order: (a) `og:image` not absolute? (b) image returns 4xx? (c) image too big or wrong format? (d) `og:image` missing entirely?
3. If everything looks fine in `metaprev`, the platform may be serving cached metadata. The fix depends on the platform:
   - Facebook: scrape again via the Sharing Debugger (https://developers.facebook.com/tools/debug/)
   - Twitter / X: cache invalidates in ~7 days; no manual refresh
   - Slack: cache purges in ~1 hour
   - LinkedIn: use the Post Inspector (https://www.linkedin.com/post-inspector/)
   - Discord: cache invalidates per-channel; re-pasting the link in a different channel often refreshes

### Pattern C — Pre-deploy CI check

Add a smoke test to a pre-deploy script:

```bash
npx @hungv47/metaprev https://staging.example.com --json > /dev/null || exit 1
```

Exit code `1` fails the deploy when any error-level issue exists. The `--json` output is machine-readable for further checks (e.g., assert image content-type is `image/png`).

### Pattern D — User pastes a screenshot from OpenGraph.xyz or similar

The third-party validators flag the same things `metaprev` does, plus a couple of bad heuristics ("missing CTA in image", "title 50-60 chars"). Walk through the user's screenshot, run `metaprev` against the same URL to confirm, then apply the pushback rules:

- "Image is 2400×1260, recommended 1200×630" → resize, real fix.
- "Image is broken in preview" → almost certainly relative `og:image` URL, fix to absolute.
- "Missing CTA in image" → push back. Editorial OG cards (clean typography, brand name, tagline) don't need "Visit example.com →" buttons. The buttons make the card look like an ad. The tagline IS the CTA.
- "Title is short, description is short" → user's call. Recommend keeping if intentional.

## Output reading reference

Terminal:

```
metaprev — https://example.com/
HTTP 200 · fetched 2026-05-10T16:45:13Z

  title        Example Inc. (12 chars)
  description  We build... (58 chars)
  og:image     https://example.com/og.png
  image dims   1200×630px

  WRN title        Title is short (12 chars). Optimal: 50–60 chars
  ...
  preview → /var/folders/.../preview.html
```

`--json` output has every parsed `og:*` / `twitter:*` tag plus the image probe (status, content-type, byte length, width, height) and a typed `issues[]` array with `level`, `field`, `message`. Useful for piping into scripts or follow-up agents.

The HTML preview has four card mocks (Facebook, X, LinkedIn, Discord/Slack), an Issues panel with a Copy button (copies a markdown-formatted issue list ready for PR comments / Slack), and a Facts panel with every meta tag value and char count.

## Limitations to know

- Bun must be on `PATH`; users without Bun get a clear error pointing to https://bun.sh/install.
- Currently parses meta tags via regex on the `<head>` substring. Handles standard cases; pages that use `<base href>` or that emit meta tags outside `<head>` may parse imperfectly. If a page has weird structure, fall back to viewing raw HTML.
- The preview renders cards using HTML/CSS approximations of each platform — pixel-perfect to the platform style is not the goal; correctness of the meta data is.
- No JavaScript rendering. If the page sets meta tags via client-side JS (rare; bad practice for shared content), `metaprev` won't see them. Recommend the user emit meta tags server-side / at build.
