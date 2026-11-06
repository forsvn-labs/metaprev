# Public deployment acceptance

Recorded before deployment implementation, 24 October 2026.

- The homepage, guides, discovery files, fonts, and share artwork come from the
  existing server output and load at the edge without starting a container.
- Public pages use the confirmed canonical hostname and permit indexing only
  after the live domain and response checks pass. Private results stay noindex.
- Only inspection and inspected-image routes reach the private Bun container.
  Both API and no-JavaScript form submissions use the existing fetch policy.
- One bounded container preserves inspected-image IDs across related requests.
  Idle shutdown limits resource use. There is no persistent report database.
- The edge replaces client-address headers. The container trusts that address
  only in the private container deployment; ordinary local servers ignore it.
  Client-supplied forwarding headers cannot bypass request limits.
- Oversized requests, cross-origin forms, unsafe targets, and expired image IDs
  return bounded responses with no-store and noindex headers.
- Container or network failures return a readable error while public pages and
  guides continue to work. No target scripts run in either runtime.
- Production checks exercise actual public URL inspection, image display,
  clipboard actions, keyboard tabs, and the HTML form without JavaScript.
- No credentials, local test evidence, node_modules, or unrelated source enter
  the container image. Required runtime files and font licenses are included.
- The release records the exact source commit, image, Worker version, live
  response checks, and screenshots. Advertising stays off.
