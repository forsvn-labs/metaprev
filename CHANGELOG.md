# Changelog

## 0.3.2 — 2026-05-12

### Fixed
- `metaprev --version` now matches the published package version.
- Shared byte formatting between terminal and HTML output so image byte display stays consistent.

### Compared to 0.3.1
- Publish-ready maintenance release for the cleanup pass.

## 0.3.0 — 2026-05-11

### Fixed
- `og:image:width`/`og:image:height` now validates against actual image dimensions. Warns when declared dimensions don't match real file dimensions — Slack and Discord trust the declared values for first-paint and will mis-crop when they don't match.

### Compared to 0.2.0
- `src/validate.ts`: +18 lines — new dimension consistency check

## 0.2.0 — 2025-11-19

### Added
- `issues` subcommand — CI-friendly, exits 1 on errors, no browser
- `facts` subcommand — raw parsed meta, plain or JSON
- `data-URI` cache-bust — og:image embedded as base64 so regenerating the asset always shows the fresh image
- Auto-relax TLS for `*.localhost` / `*.test` / `127.0.0.1` (`--insecure` still available)
- Framework-agnostic defaults (no hardcoded og:type)

## 0.1.0 — 2025-09-27

### Added
- Core preview: fetches URL, parses og:* / twitter:* meta, validates char counts and image dimensions, opens side-by-side mock for Facebook, X, LinkedIn, Discord/Slack
- `-o, --output` flag to write preview HTML to a specific path
- `--no-open` and `--json` flags
- `image-size` dep for PNG/JPEG/WebP dimension reading
