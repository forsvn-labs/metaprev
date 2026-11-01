# Progress history

Dated evidence and historical remainders for the paused project. These are
recorded checks, not checks rerun during the 2026-11-01 migration.
[PROGRESS.md](../PROGRESS.md) owns current state and gates.

## 2026-10-26

Messaging simulations merged in [PR #9](https://github.com/forsvn-labs/metaprev/pull/9).
Messenger, iMessage, Telegram, WhatsApp, and Slack have shared adapters;
X Chat is explicitly unverified and URL-only. Existing feed cards and
JSON/CI contracts remain. No messaging accounts, credentials, API calls,
or live-client/cache verification were added. The implementation contract
is [app/docs/messaging-surfaces.md](../app/docs/messaging-surfaces.md).

Recorded local results: 82/82 CLI tests, 32/32 public-fetch security tests,
42/42 real HTTP checks, and 114/114 offline browser checks at 320, 390, 768,
and 1440 CSS pixels. Both typechecks and targeted lint passed. Full CLI lint
retained 21 errors and five warnings. Two independent-review findings,
supplied image descriptions and CLI card appearance, were reproduced,
fixed, and re-reviewed without remaining findings. No release or deployment
was claimed. Live-client comparison remains outstanding.

## 2026-10-24

### Launch hold and historical remainders

[draft PR #8](https://github.com/forsvn-labs/metaprev/pull/8), branch
`ops/public-launch-20261024`, records the owner's approval to ship and later
instruction to stop on this date. It remains separate from this migration.

The attempt uploaded a Cloudflare Worker and static assets. Container
provisioning failed on the Workers Free account. The PR recorded Workers
Paid as a prerequisite, at $5/month plus metered usage on this date. Checkout
reached payment; no payment or subscription confirmation was submitted.
The hosting upgrade was not completed. No public hostname or backend launch
was established. The intended canonical address is `metaprev.forsvn.com`.

The unmerged hosting code puts public pages, guides, and assets at the edge
and inspection and private images in one private Bun container. It retains
DNS checks and address pinning. The edge replaces client identity headers.
The prepared backend is limited to one lite instance, sleeps after five idle
minutes, and is not woken by public pages.

PR #8 recorded 32 security checks, seven deployment integration checks,
42 HTTP checks against the built Linux container, site and edge typechecks,
a static build, and a provider deployment dry run. The integration checks
covered per-client limits and spoofed proxy headers on standalone servers.
These local checks do not establish a working public backend. The local test
container and preview servers were stopped; the clean launch worktree was
retained for resumption. Its current filesystem state was not checked here.

Historical remainders: hosting choice and upgrade, HTTPS, edge limits,
operational logging, public inspection, image delivery, and HTML-form checks.
Indexing and the FORSVN project-link change wait for an authorized launch.
Advertising needs a publisher account and a separate decision after the tool
is live. Search indexing, field performance, and AI citations have no recorded
post-deployment outcome. Pre-existing unreleased CLI source changes have no
later npm publication or version-parity evidence.

### Website source moved from the root changelog

The following unshipped entry moved unchanged from the root CHANGELOG.md.

- Add the public website service under `site/`, separate from the npm CLI.
  Reuse the CLI parser and validator behind DNS checks, pinned connections,
  request limits, and short-lived verified image delivery.
- Add server-rendered pages, a no-JavaScript form path, private result responses,
  and four source-backed Open Graph guides from shared records.
- Add the Opus-authored interface, keyboard platform tabs, clipboard actions,
  self-hosted licensed fonts, share artwork, and streaming text compression.
- Add security and real HTTP/browser acceptance commands. Deployment, indexing,
  advertising, and a package release are not part of this source change.

### Retired status snapshot

The following snapshot keeps its original date, wording, and measurements.
Heading levels and the relative BRAIN link are adjusted for this location.
Its draft-PR and release-review statements describe the then-recorded state.
PR #7 subsequently merged on this date; the launch hold above supersedes its
next steps. The latest messaging checks are recorded under 2026-10-26.

### Metaprev status

Updated 24 October 2026. Baseline `706052b`.
The new website is in [draft PR #7](https://github.com/forsvn-labs/metaprev/pull/7).
No website or package release is deployed.

#### Website work

The owner authorized a public URL inspector and confirmed `metaprev.forsvn.com`
as its intended canonical address. `site/` owns this separate Bun web service.
The CLI remains at the recorded `0.6.0` package version.

The server uses the existing metadata parser, fallback rules, validator, and
repair helpers. It rejects local, private, reserved, and credentialed targets.
Each connection uses a checked DNS address; redirects repeat that policy.
HTML, image bytes, request duration, concurrency, and request count have bounds.
Verified raster image IDs expire from memory after five minutes. Reports have
no-store and noindex responses; the application has no report database or history.

The search implementation has four field-specific Open Graph guides, unique
metadata, linked primary sources, canonical URLs, Article and breadcrumb data,
a sitemap, and Markdown discovery files. The same records drive these outputs.
Conquistador informed the positioning and bounded search-page approach. Its
marketing check passed for the guide copy. No ranking or AI citation outcome is claimed.

Opus 5.5 authored the visual design, browser controls, fonts, and share artwork.
Its task reached a provider rate limit after those files were saved. The parent
completed integration, compressed text responses, rebuilt the outlined share
artwork as PNG, and verified the real pages. Advertising and tracking scripts are off.

#### Verification

- The new security contract passes 32/32 tests. Tests were written before the implementation.
- The running service passes 42/42 HTTP checks, including a real fetch of
  `conquistador.app`, unsafe input rejection, private image handling, and search-page output.
- Browser acceptance passes 56/56 checks at 320, 390, 768, and 1440 CSS pixels.
  It covers real inspections, keyboard tabs, actual clipboard values, visible
  errors, external links, overflow, and submission with JavaScript disabled.
- Site typecheck passes. The unchanged CLI passes 74/74 tests and its typecheck.
- The unchanged CLI baseline has 21 lint errors and five warnings under its
  existing anti-slop configuration. This website change does not modify CLI code.
- The own-site PNG is 1200 × 630. Iris captured the desktop and phone homepage,
  a guide, and the actual server-rendered result from a public inspection.
- One local mobile Lighthouse run with production indexing enabled scored
  performance 99, accessibility 100, best practices 100, and SEO 100. FCP was
  1.7 seconds, LCP 1.8 seconds, TBT 0 ms, and CLS 0. This is lab evidence, not
  deployed or field performance. Text responses negotiate gzip.
- Conquistador checked the four guides and homepage copy. The guides passed.
  The homepage has two explained numeric warnings: an explicitly illustrated
  crop calculation and port 3000 in a CLI example. Neither is a customer or
  performance claim. Dated evidence and receipts belong in the existing
  personal Drive project resolved through [BRAIN.md](../BRAIN.md).

#### Release and next steps

The existing recorded package release is `0.6.0`, tag `v0.6.0` at `c030fb3`.
The pre-existing unreleased package changes remain separate from this website.
No npm publication or later version parity is established by this work.

Source and acceptance checks are ready for review in the draft PR. The
canonical hostname is a configuration value, not proof of DNS or hosting.
Indexing stays off by default. Before a public launch, confirm hosting, HTTPS,
per-client rate limits at the edge, and operational log settings. A multi-process
host does not share the process-local request counters or image cache.

Advertising needs a publisher account and a separate owner decision after the
tool is live. Search indexing, field performance, and AI citations need observations
after an authorized public deployment. No such outcome is established here.
