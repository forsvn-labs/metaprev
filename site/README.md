# Run the Metaprev website

The website inspects public HTTP and HTTPS pages with the CLI's existing metadata
parser and validator. The browser receives escaped metadata and verified raster
images. The local CLI and its package version are unchanged.

Requires Bun 1.4.3 or later. From this folder, run:

```sh
bun install
bun run dev
```

Open `http://127.0.0.1:4323`. Enter a public URL and submit the form.
The HTML form also works with JavaScript disabled. Pages that require sign-in,
private networks, or JavaScript-rendered metadata need another inspection path.

## Verify the running website

Start the server first. Browser checks use installed Google Chrome and make real
public requests to `conquistador.app`.

```sh
bun test
bun run typecheck
bun run test:http
bun test/browser.ts
```

HTTP and browser runs write repeatable JSON evidence under ignored `artifacts/`.
[test/acceptance.md](test/acceptance.md) records the failure cases defined before
implementation. Run the unchanged CLI checks separately from `../app`.

## Configure the public host

[.env.example](.env.example) lists the configuration. `SITE_URL` sets canonical,
share, sitemap, and structured-data URLs. `HOST` defaults to loopback. Set it to
`0.0.0.0` only when the service must accept connections from the host network.
`PORT` defaults to 4323.

Indexing stays off unless `PUBLIC_INDEXING=on`. Confirm the final domain, HTTPS,
public response headers, guide output, and abuse limits before enabling it.
This source tree does not create DNS records, publish a service, register an ad
account, or establish a hosting provider's log-retention policy.

The editable share artwork is `public/og.svg`. To rebuild its committed PNG, run
`bun scripts/og.ts`. The SVG uses outlined text and does not need installed fonts.
Sharp is a development dependency and does not run in the inspection service.

## Request limits

The server checks DNS and pins the selected public address to each connection.
Redirects repeat that check. HTML reads stop at the end of the head or 512 KB.
The HTML request has a ten-second deadline. Image requests have a six-second
deadline and a 5 MB limit. Only checked PNG, JPEG, WebP, and GIF bytes reach the
browser. Image IDs expire after five minutes in a cache capped at 24 MB.

The process accepts four concurrent inspections and twenty requests per connecting
IP per minute. A reverse proxy can make users share one connecting IP. A multi-process
public deployment needs its edge to apply per-client request limits; the in-memory
counter does not coordinate between instances. Do not trust arbitrary forwarding headers.

No ad network, analytics, cookies, report database, or browser history is enabled.
The four data-driven guides answer distinct Open Graph field questions. New guide
records need a separate task, checked sources, and useful field-specific content.

## Cloudflare deployment

`edge/` serves the public pages and assets directly from Cloudflare. Only
`/api/inspect`, `/inspect`, and `/api/image` use the private Bun container.
The static build reads the real server's public routes, so the browser and
search surfaces use the same content. It never exports inspection results.

The deployment needs Docker, Bun, Node.js 22.18 or later, an authorized
Cloudflare Workers Paid account with Containers, and the `forsvn.com` zone.
Workers Paid costs $5/month plus metered usage; obtain owner approval before
upgrading an account. From `edge/`:

```sh
bun install
node node_modules/cf/bin/cf auth login
bun run typecheck
bun run build
bun run deploy
```

The provider configuration limits the inspector to one `lite` container. It
sleeps after five idle minutes. The Worker replaces the client-address header
before private ingress; `METAPREV_PRIVATE_EDGE=on` trusts that header only in
this private deployment. Standalone servers must leave that setting off.
`bun test/deployment.ts`, run from `site/`, verifies both address policies.

The first deployment keeps indexing off until the domain, HTTPS, form, metadata,
and image responses are checked. Cloudflare operational logs and traces sample
one percent of Worker requests and remove URL query strings. The application
does not log submitted URL bodies or store reports. A container rollout can
expire existing image IDs; inspect again to refresh them.

The root Dockerfile contains only the website runtime and shared parser source.
Local credentials, tests, build tools, and review captures are excluded. The
published CLI package remains separate from this hosting configuration.
