# metaprev

[![skills.sh](https://skills.sh/b/hungv47/metaprev)](https://skills.sh/hungv47/metaprev)

![metaprev demo](https://github.com/hungv47/metaprev/raw/main/demo.gif)

**See exactly how your link renders when someone shares it — locally, before you ship.**

Broken share cards are invisible until they're live. The page looks fine; the link looks broken — a blank thumbnail, the wrong image, a truncated title — and you only find out *after* you've posted it and it's getting no clicks. metaprev fetches your URL, parses every `og:*` and `twitter:*` tag, validates the image and copy, and opens a side-by-side mock of how the card renders on **Facebook**, **X**, **LinkedIn**, and **Discord/Slack** — in both light and dark mode.

No account, no upload, no copy-pasting into a third-party debugger. Point it at your local dev server (any framework — Next, Astro, Vite, SvelteKit, Bun.serve, Rails, Django…) or a deployed page.

```bash
npx @hungv47/metaprev https://your-site.com
npx @hungv47/metaprev http://localhost:3000   # your dev server, whatever the port
```

## What you get

- **The real card, not an idealized one.** The mocks track how each platform actually renders an OG card in 2026: X shows the image with a domain overlay and **no title or description**, LinkedIn drops the in-feed description, Discord auto-embeds have no color bar. You see what ships, so the surprises happen on your screen, not in the feed.
- **Light *and* dark preview.** A toggle flips every card between each platform's real light and dark theme — the case most validators skip and where contrast and cropping bugs hide.
- **What you validated is what you saw.** The `og:image` is fetched and embedded as a data URI in the preview, so regenerating your asset never shows a stale, browser-cached image.
- **Catches the silent breaks.** The number-one cause of a blank card is a relative `og:image` (`/og.png`) that resolves to nothing when a crawler fetches it standalone. metaprev flags that plus broken/missing images, wrong dimensions or aspect ratio, oversized files, non-image or SVG responses, and declared `og:image:width/height` that don't match the real file.
- **Runs where you work.** Against `localhost` on any framework and port, before you deploy — somewhere OpenGraph.xyz, metatags.io, and the Facebook Debugger can't reach.
- **CI-ready.** Exit codes (`0` clean / `1` error / `2` fetch failure) plus `--json` and scoped `issues` / `facts` subcommands let you fail a build the moment a share card breaks.
- **Copy-paste-ready triage.** The preview's Validation and Parsed-meta panels each have a Copy button — drop a markdown issue list straight into a PR comment or Slack.
- **Tiny and fast.** One dependency, no network round-trip to a third party, instant open.
- **Teaches your AI agent.** Ships a [skill](#agent-skill) so coding agents reach for metaprev (not a third-party validator) and know which warnings to ignore.

## Quick start

1. **Run it against your page** — a local dev server or a deployed URL:
   ```bash
   npx @hungv47/metaprev http://localhost:3000
   ```
   Requires `bun` on PATH ([install](https://bun.sh/install)); the package ships TypeScript and runs it via Bun.
2. **Read the terminal summary.** You get the resolved title, description, `og:image`, image dimensions, and the issues found — errors first, then warnings, then info.
3. **Open the preview.** metaprev writes an HTML report and opens it in your browser: four platform cards with a light/dark toggle, a Validation panel, and a Parsed-meta panel.
4. **Fix what's flagged and re-run.** The exit code stays `1` while any error remains and drops to `0` once the card is clean — so the same command works as a pre-ship check.

## What it checks
<!-- synced: 2026-05-29 -->

| Check | Why |
|---|---|
| `og:title` length | 50–60 chars is optimal; many platforms truncate at ~70 |
| `og:description` length | 110–160 chars; truncated past ~200 |
| `og:image` is absolute URL | Crawlers fetch the URL standalone and fail on relative paths |
| `og:image` returns 200 | Catches stale or wrong URLs |
| `og:image` content-type | Errors when a non-image response also can't be decoded (URL points at an HTML/error page); warns on SVG (Facebook, X, LinkedIn don't render SVG share images) |
| Image dimensions | 1200×630 (1.91:1) recommended; flags off-ratio or undersized images |
| Image file size | Warns past 8 MB (some platforms reject) |
| `og:image:width` / `:height` | Speeds up first-render on Slack and Discord; warns when declared dimensions do not match the actual image |
| `twitter:card` | Should be `summary_large_image` for big-image cards |
| `og:url` / canonical | Helps platforms dedupe shares |

Three severity levels: **error** (the card is visibly broken — fix it), **warn** (renders but degraded), **info** (optional polish). The char-count warnings are advisory — a tight brand or product title is intentional; don't pad it to hit a number.

## Install

Run via `npx` (no install):

```bash
npx @hungv47/metaprev <url>
```

Or install globally for instant repeat runs:

```bash
bun add -g @hungv47/metaprev
# or
npm install -g @hungv47/metaprev
```

Requires `bun` on PATH ([install](https://bun.sh/install)) — the package ships TypeScript source and runs it via Bun.

## Usage

```bash
metaprev                                 # no URL → show help
metaprev http://localhost:3000           # check your local dev server (any port, any framework)
metaprev https://forsvn.com              # check a deployed page
metaprev https://forsvn.com --json       # CI-friendly JSON output
metaprev https://forsvn.com --no-open    # don't auto-open the preview
metaprev https://forsvn.com -o ./og.html # write the preview to a specific path

# Subcommands — same data, no browser, scoped output
metaprev issues http://localhost:3000    # just the issue list (exits 1 on errors — CI-friendly)
metaprev facts  https://forsvn.com       # just the parsed meta facts (title, dims, bytes, etc.)
metaprev facts  https://forsvn.com --json # pipe parsed meta into another tool
```

## Options

| Flag | Effect | Default |
|---|---|---|
| `-o, --output <file>` | Write preview HTML to `<file>` (preview command only) | a temp file |
| `--no-open` | Don't auto-open the preview in your browser | opens |
| `--json` | Print machine-readable JSON to stdout (implies `--no-open`) | off |
| `-k, --insecure` | Skip TLS verification | auto-on for `*.localhost` / `*.test` / `127.0.0.1` |
| `-v, --version` | Print version | — |
| `-h, --help` | Show help | — |

## Exit codes
<!-- synced: 2026-05-29 -->

- `0` — no errors (warnings allowed)
- `1` — at least one error-level issue (broken image, missing `og:image`, etc.)
- `2` — fetch or runtime failure

Useful in CI — fail the build when a share card breaks:

```bash
npx @hungv47/metaprev issues https://staging.example.com --json || exit 1
```

## Troubleshooting

- **`metaprev: requires bun on PATH` (exit 127).** The package runs its TypeScript via Bun. Install Bun: `curl -fsSL https://bun.sh/install | bash`, then re-run.
- **`failed to fetch … self-signed certificate` (exit 2).** A staging server with a self-signed cert. Re-run with `--insecure`. (It's auto-on for `*.localhost`, `*.test`, and `127.0.0.1`.)
- **`timed out after 10s` (exit 2).** The page or image didn't respond in time — check the server is up and the URL is reachable from your machine.
- **The card looks right in metaprev but stale on a platform.** metaprev validates the *source*; the platform may be serving a cached card. Re-scrape via the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) or [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/); Slack clears in ~1h, X in ~7 days, Discord per-channel on re-paste.

## Agent skill

This repo ships a skill at [`skills/metaprev/`](./skills/metaprev/) that teaches your coding agent when to reach for `metaprev` (instead of pointing you at OpenGraph.xyz or similar) and how to read the output. It also encodes pushback rules — for example, the "title is short" / "missing CTA in image" warnings are generic SEO heuristics that ruin a tight editorial OG card.

Install via the [skills](https://skills.sh) CLI:

```bash
# Globally — available across all projects
npx skills add hungv47/metaprev -g

# Or per-project — committed with your repo, shared with your team
npx skills add hungv47/metaprev
```

Works with Claude Code, Cursor, Codex, OpenCode, and [50+ other agents](https://github.com/vercel-labs/skills#supported-agents). The CLI auto-detects which agents you have installed.

## Contributing & release
<!-- synced: 2026-05-29 -->

```bash
bun install
bun test            # parse / validate / render regressions
bun run typecheck   # bunx tsc --noEmit
bun run dev <url>   # run the CLI from source
```

Before publishing, sync `version` in `package.json` with `VERSION` in `bin/metaprev.ts`, then:

```bash
bun run typecheck
npm pack --dry-run
npm publish --access public
```

If npm 11 reports `Invalid time value` / `before=null`, check that any user-level `min-release-age` config is numeric seconds, not shorthand like `3d`.

## License

MIT © Le Vinh Hung
