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
  format.ts       # shared terminal/HTML formatting helpers
  parse.ts        # regex-based <head> meta extractor (no heavy DOM dep)
  validate.ts     # rules → Issue[]
  render.ts       # report → HTML (FB/X/LinkedIn/Discord card mocks + facts panel)
  types.ts        # MetaTags, ImageProbe, Issue, Report
test/
  metaprev.test.ts # bun:test — parse / validate / render regressions
```

## Commands

- `bun run dev <url>` — run the CLI from source
- `bun test` — run the test suite
- `bun run typecheck` — `bunx tsc --noEmit`

## Conventions

- File imports include `.ts` extensions (Bun + bundler resolution).
- Default to **zero deps** when reasonable. Current single dep: `image-size` for reading PNG/JPEG/WebP dimensions from a buffer.
- Parse meta tags with regex on the `<head>` substring — keeps install size tiny. If the parser ever needs to handle malformed HTML or `<base href>`, swap to `node-html-parser`.
- Exit codes: `0` clean, `1` error-level issue found, `2` fetch/runtime failure. CI hooks rely on this.
- TTY detection (`process.stdout.isTTY`) gates ANSI colors so JSON output stays clean.

## Validation rules (single source of truth)

Edit `src/validate.ts`. Each rule emits `Issue { level, field, message }`. Levels:

- `error` — broken image, missing og:image, non-absolute og:image URL, non-image content-type
- `warn` — char counts way off, image off-ratio, file too big, SVG og:image
- `info` — missing optional helpers (og:image:width, twitter:card, canonical)

Char counts use the *decoded* tag value (entities resolved in `parse.ts`), so thresholds match what users actually see. Char-count thresholds and the 1200×630 ratio are intentionally close to the OpenGraph.xyz validator so users can ditch that tool.

## Adding a card mock

`src/render.ts` → `cardMock()`. Add a new variant case for the platform; styles live in the inline `<style>` block at the top of `renderHtml` (OKLCH tokens + per-platform light/dark variants gated on `[data-appearance]`). Mocks track each platform's *current* rendering — fidelity is the feature. Only the validated image data URI is ever placed into a CSS `url()`; never interpolate a page-controlled URL into inline styles. `probeImage` only builds that data URI when `withDataUri` is set (preview command), so `issues` / `facts` / `--json` stay cheap.

## Publishing
<!-- synced: 2026-05-12 -->

Sync `version` in `package.json` with `VERSION` in `bin/metaprev.ts`, then:

```bash
bunx tsc --noEmit
npm pack --dry-run
npm publish --access public  # publishConfig already public
```

On npm 11, a user-level `min-release-age` setting can make publish checks fail
with `Invalid time value` / `before=null` if it uses shorthand like `3d`. Use
numeric seconds instead, for example `min-release-age=259200` for three days.
