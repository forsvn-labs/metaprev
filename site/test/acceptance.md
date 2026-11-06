# Website acceptance contract

Recorded before implementation, 2026-10-24.

- The real homepage and guides render useful HTML without JavaScript.
- A public URL returns metadata parsed by the existing CLI parser, plus factual findings.
- Bad input, credentials, non-HTTP schemes, unusual ports, loopback, private,
  reserved, link-local and mapped/transition addresses never reach the network.
- DNS answers are checked and the connection uses the checked address. Every
  redirect and image request repeats the policy. Redirect loops stop.
- Slow DNS, headers, bodies and images have deadlines. HTML and raster bytes
  have separate bounds. Compressed responses cannot expand beyond those bounds.
- The web service never returns raw target HTML. Text, attributes and JSON data
  are escaped. Remote SVG and HTML cannot be served from the image endpoint.
- Parallel requests, rate limits, invalid JSON and large request bodies fail
  with bounded, readable responses. No arbitrary upstream errors are exposed.
- Results are private, uncached and noindex. URLs are sent by POST, never stored
  in a public result page, and never put into analytics or client storage.
- Results expose the observation time and warn that platform caches and rendered
  JavaScript are outside this inspection. Image failures preserve page findings.
- Each search page has a distinct reader task, checked source links, a canonical,
  visible answer, matching schema, hub and sibling links. No empty template pages.
- Browser verification covers desktop/mobile, errors, keyboard, platform tabs,
  copy actions, external links, no-JS form submission and no horizontal overflow.
- No third-party advertising or tracking script is loaded in the initial release.

## Content pilot acceptance (2026-11-07)

- Validate all content, reject duplicate/unsafe slugs, malformed dates, empty required
  fields and unsafe source/support URLs. Unit cases were written before implementation.
- Drafts stay out of HTML, discovery and sitemap through one shared guide selector.
- Each guide shows its actual source review date and matching structured data.
- The local CMS edits JSON; it cannot publish a deployment. Its unauthenticated
  proxy binds only to loopback and restricts the browser origin.
- Public builds exclude the editor, proxy, dependencies and raw draft JSON.
- Desktop/mobile checks verify all guides without JavaScript, support links,
  review dates, sitemap and overflow; write a JSON acceptance artifact.
