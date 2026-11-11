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

## Inspection bounds and states (2026-11-11)

Failure cases for this change: long valueless attributes; repeated incomplete
meta/link/head/title tags; whitespace-only tags; cancellation during request or
upstream body reads; cleanup that never settles; all four inspection slots busy;
retry after failure; malformed JSON; corrupt image bytes; cache rejection; and
concurrent reports with different cache outcomes.

- A tag scan must not retry every suffix of an untrusted attribute or incomplete
  element. Preserve first-image selection, entity handling and CLI issue/exit contracts.
- A cancelled request must stop new DNS/upstream calls and release its slot.
  Body cancellation is best effort and must not delay rejection indefinitely.
- Cache failure removes the preview URL only. Keep decoded image facts and
  findings. A corrupt image remains a failed probe. Reports do not share state.
- All failure responses remain no-store/noindex. Public URL, DNS, redirect,
  raster-type, byte and time bounds remain in force; there is no DNS-result cache.

Repeat with `bun run test` from `site/`, and `bun test` from `app/`.
`bash site/test/inspection-browser.sh` from the root checks a running local server
with isolated agent-browser: private input, correction/retry, repeated submit,
platform tabs, JSON copy, storage, support link, two widths and the HTML form.
It uses example.com, with no logged-in browser or third-party account writes.

Limits: this is a targeted regression set, not exhaustive parser or network
safety proof. The parser remains a small metadata extractor, not a full HTML
parser. Cancellation depends on the runtime signalling disconnects; existing
fetch deadlines still apply. Edge image cache expiry/location misses and global
free-tier capacity remain deployment constraints.

## Lint and error-boundary cleanup (2026-11-11)

Failure cases checked before cleanup: string/null fetch rejections losing their
message or throwing during error handling; ASCII control runs leaking into repair
snippets; altered printable Unicode or attribute escaping. The two non-Error
rejection tests failed before the fix. Existing CLI, entity-collision, host policy,
copy-payload and null-body tests protect the type-only changes.

Repeat with `cd app && bun run lint && bun test && bun run typecheck`.
Lint rules are unchanged. The response reader accepts only the three response
members it uses; metadata maps and copy targets have explicit value contracts.
The TCP-address test assertion follows a completed listen on an IP and port.
