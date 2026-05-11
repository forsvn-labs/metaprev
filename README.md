# metaprev

[![skills.sh](https://skills.sh/b/hungv47/metaprev)](https://skills.sh/hungv47/metaprev)

![metaprev demo](https://github.com/hungv47/metaprev/raw/main/demo.gif)

Preview your OpenGraph cards locally. Fetches a URL, parses every `og:*` and `twitter:*` meta tag, validates char counts and image dimensions, then opens a side-by-side mock of how the link renders on **Facebook**, **X**, **LinkedIn**, and **Discord/Slack**.

No third-party validators, no copy-paste into a debugger. Run it against your local dev server (any framework — Next, Astro, Vite, SvelteKit, Bun.serve, Rails, Django…) or a deployed page before you ship.

```bash
npx @hungv47/metaprev https://your-site.com
# or against a local dev server on whatever port your framework uses
npx @hungv47/metaprev http://localhost:3000
```

## What it checks

| Check | Why |
|---|---|
| `og:title` length | 50–60 chars is optimal; many platforms truncate at ~70 |
| `og:description` length | 110–160 chars; truncated past ~200 |
| `og:image` is absolute URL | Crawlers fetch the URL standalone and fail on relative paths |
| `og:image` returns 200 | Catches stale or wrong URLs |
| Image dimensions | 1200×630 (1.91:1) recommended; flags off-ratio or undersized images |
| Image file size | Warns past 8 MB (some platforms reject) |
| `og:image:width` / `:height` | Speeds up first-render on Slack and Discord |
| `twitter:card` | Should be `summary_large_image` for big-image cards |
| `og:url` / canonical | Helps platforms dedupe shares |

## Install

Run via `npx` (no install):

```bash
npx @hungv47/metaprev <url>
```

Or install globally:

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
metaprev https://forsvn.com                # check a deployed page
metaprev https://forsvn.com --json         # CI-friendly JSON output
metaprev https://forsvn.com --no-open      # don't auto-open the preview
metaprev https://forsvn.com -o ./og.html   # write the preview to a specific path

# Subcommands — same data, no browser, scoped output
metaprev issues http://localhost:3000    # just the issue list (exits 1 on errors — CI-friendly)
metaprev facts  https://forsvn.com         # just the parsed meta facts (title, dims, bytes, etc.)
metaprev facts  https://forsvn.com --json  # pipe parsed meta into another tool
```

The og:image is embedded as a base64 data URI in the preview HTML, so the browser always shows exactly what was just fetched — no stale cached image when you regenerate your OG asset.

## Options

| Flag | Effect |
|---|---|
| `-o, --output <file>` | Write preview HTML to `<file>` (default: a temp file; preview command only) |
| `--no-open` | Don't auto-open the preview in your browser |
| `--json` | Print machine-readable JSON to stdout (implies `--no-open`) |
| `-k, --insecure` | Skip TLS verification (auto-on for `*.localhost` / `*.test` / `127.0.0.1`) |
| `-v, --version` | Print version |
| `-h, --help` | Show help |

## Exit codes

- `0` — no errors (warnings allowed)
- `1` — at least one error-level issue (broken image, missing og:image, etc.)
- `2` — fetch or runtime failure

Useful in CI: fail the build when og:image breaks.

## Agent skill

This repo ships a skill at [`skills/metaprev/`](./skills/metaprev/) that teaches your coding agent when to reach for `metaprev` (instead of pointing you at OpenGraph.xyz or similar) and how to interpret the output. It also encodes pushback rules — for example, the validator's "missing CTA in image" warning is generic clickbait wisdom that ruins editorial OG cards.

Install via the [skills](https://skills.sh) CLI:

```bash
# Globally — available across all projects
npx skills add hungv47/metaprev -g

# Or per-project — committed with your repo, shared with team
npx skills add hungv47/metaprev
```

Works with Claude Code, Cursor, Codex, OpenCode, and [50+ other agents](https://github.com/vercel-labs/skills#supported-agents). The CLI auto-detects which agents you have installed.

## License

MIT © Le Vinh Hung
