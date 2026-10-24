# metaprev changelog

## Unreleased, 2026-10-24

- Add the public website service under `site/`, separate from the npm CLI.
  Reuse the CLI parser and validator behind DNS checks, pinned connections,
  request limits, and short-lived verified image delivery.
- Add server-rendered pages, a no-JavaScript form path, private result responses,
  and four source-backed Open Graph guides from shared records.
- Add the Opus-authored interface, keyboard platform tabs, clipboard actions,
  self-hosted licensed fonts, share artwork, and streaming text compression.
- Add security and real HTTP/browser acceptance commands. Deployment, indexing,
  advertising, and a package release are not part of this source change.

### Public hosting preparation

- Serve public pages at the edge and retain the Bun inspector in a private,
  bounded Cloudflare container with a five-minute idle timeout.
- Add the Docker runtime, typed provider configuration, deployment dry run,
  and integration checks for per-client limits and proxy-header handling.
- Keep initial indexing off until live response checks pass. Advertising and
  npm publication remain separate.

## 2026-09-19 — 0.6.0

- Recorded release of the local repair workspace, independent report themes,
  evidence-led metadata validation, and safe rendering/CI contracts.
- Source tag: [`v0.6.0`](https://github.com/forsvn-labs/metaprev/releases/tag/v0.6.0)
  at `c030fb3`; recorded package:
  [`@forsvn/metaprev@0.6.0`](https://www.npmjs.com/package/@forsvn/metaprev/v/0.6.0).

[app/CHANGELOG.md](app/CHANGELOG.md) owns the detailed versioned package
history. [STATUS.md](STATUS.md) distinguishes later source work from releases.
