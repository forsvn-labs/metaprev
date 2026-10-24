# Metaprev status

Updated 24 October 2026. Baseline `706052b`.
The new website source merged in [PR #7](https://github.com/forsvn-labs/metaprev/pull/7).
The owner approved shipping on 24 October. Public deployment is in progress;
no package release is part of this work.

## Website work

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

## Verification

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
  personal Drive project resolved through [BRAIN.md](BRAIN.md).

## Release and next steps

The existing recorded package release is `0.6.0`, tag `v0.6.0` at `c030fb3`.
The pre-existing unreleased package changes remain separate from this website.
No npm publication or later version parity is established by this work.

The Cloudflare deployment serves public pages as edge assets and routes the
inspection API and private images to one bounded Bun container. The container
keeps the verified DNS and connection policy. A new seven-case integration
check verifies per-client limits and rejection of spoofed proxy headers on
standalone servers. The container passes all 42 HTTP checks. Site and edge
typechecks and the provider deployment dry run pass.

The canonical hostname still needs live verification. Indexing stays off for
the initial deployment until HTTPS, inspection, images, and public routes pass.

Advertising needs a publisher account and a separate owner decision after the
tool is live. Search indexing, field performance, and AI citations need observations
after an authorized public deployment. No such outcome is established here.
