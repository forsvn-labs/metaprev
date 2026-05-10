# CLAUDE.md — metaprev

Bun CLI that fetches a URL, parses og:* / twitter:* meta tags, validates them against social-card best practices, and opens a local HTML preview that mocks how the link renders on Facebook, X, LinkedIn, and Discord/Slack.

Published as `@hungv47/metaprev`. Mirrors the `syncthis` shape: thin `bin/*.mjs` shim spawns Bun on `bin/*.ts`.

## Layout

```
bin/
  metaprev.mjs    # node shim — spawns `bun bin/metaprev.ts`
  metaprev.ts     # Bun entry — arg parsing, orchestration, terminal output
src/
  fetch.ts        # fetchPage (HTML), probeImage (HEAD-equivalent + dimensions)
  parse.ts        # regex-based <head> meta extractor (no heavy DOM dep)
  validate.ts     # rules → Issue[]
  render.ts       # report → HTML (FB/X/LinkedIn/Discord card mocks + facts panel)
  types.ts        # MetaTags, ImageProbe, Issue, Report
```

## Commands

- `bun run dev <url>` — run the CLI from source
- `bun run typecheck` — `bunx tsc --noEmit`

## Conventions

- File imports include `.ts` extensions (Bun + bundler resolution).
- Default to **zero deps** when reasonable. Current single dep: `image-size` for reading PNG/JPEG/WebP dimensions from a buffer.
- Parse meta tags with regex on the `<head>` substring — keeps install size tiny. If the parser ever needs to handle malformed HTML or `<base href>`, swap to `node-html-parser`.
- Exit codes: `0` clean, `1` error-level issue found, `2` fetch/runtime failure. CI hooks rely on this.
- TTY detection (`process.stdout.isTTY`) gates ANSI colors so JSON output stays clean.

## Validation rules (single source of truth)

Edit `src/validate.ts`. Each rule emits `Issue { level, field, message }`. Levels:

- `error` — broken image, missing og:image, non-absolute og:image URL
- `warn` — char counts way off, image off-ratio, file too big
- `info` — missing optional helpers (og:image:width, twitter:card, canonical)

Char-count thresholds and the 1200×630 ratio are intentionally close to the OpenGraph.xyz validator so users can ditch that tool.

## Adding a card mock

`src/render.ts` → `cardMock()`. Add a new variant case for the platform; styles live in the inline `<style>` block at the top of `renderHtml`. Keep mocks visually distinct (LinkedIn = bold heavy, Discord = dark + accent border, etc.) so users can spot platform-specific issues at a glance.

## Publishing

Bump `version` in `package.json`, then:

```bash
bun test  # if/when tests exist
bunx tsc --noEmit
npm publish --access public  # publishConfig already public
```
