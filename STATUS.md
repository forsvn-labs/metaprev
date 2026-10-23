# metaprev status

Evidence reviewed: 2026-10-23, source baseline `bbf422c`.
This is a documentation/source review; package tests and npm availability
were not rechecked in this pass.

## Shipped / recorded release

- The latest release recorded in [app/CHANGELOG.md](app/CHANGELOG.md) is
  `0.6.0` (2026-09-19), with local tag `v0.6.0` at `c030fb3`.
  [app/package.json](app/package.json) still declares `0.6.0`.
- That history records the repair workspace, representative platform
  cards, crop/fallback evidence, independent chrome/card themes, safe
  rendering, CI exit codes, and metadata repair output.

## In source / release pending

- The package changelog's unreleased section records bounded head reads,
  cancellable image probes, an in-process Bun shim, deduplicated raster
  data in reports, and related regression/test-prune work. These are
  present in [app/src/fetch.ts](app/src/fetch.ts),
  [app/bin/metaprev.mjs](app/bin/metaprev.mjs), and
  [app/src/render.ts](app/src/render.ts). No later release is established.
- No separately active implementation branch is verified by this review.

## Planned and next steps

1. Maintain the `0.6.0` repair, security, crop, fallback, theme, and exit-code
   contracts; keep package source and bundled skill aligned.
2. Before packaging later work, run the existing tests, lint, typecheck,
   and `npm pack --dry-run` gates described in [app/README.md](app/README.md).
   Verify version/tag/npm parity after an authorized publication.
3. Establish lightweight feedback from real use and choose compatibility
   fixes from that evidence. Consider a landing page only after demand.

## Blockers and not built

A later package release and its distribution parity remain unverified.
Hosted scanning, analytics, and a generic SEO advice product are not
implemented as product scope. Rich research and verification captures
resolve through [BRAIN.md](BRAIN.md).
