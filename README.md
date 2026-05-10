# metaprev

Preview your OpenGraph cards locally. Fetches a URL, parses every `og:*` and `twitter:*` meta tag, validates char counts and image dimensions, then opens a side-by-side mock of how the link renders on **Facebook**, **X**, **LinkedIn**, and **Discord/Slack**.

No third-party validators, no copy-paste into a debugger. Run it against your local dev server before you ship.

```bash
npx @hungv47/metaprev http://localhost:4321
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
metaprev                            # check your local dev server (http://localhost:4321)
metaprev https://hungv.io           # check a deployed page
metaprev https://hungv.io --json    # CI-friendly JSON output
metaprev https://hungv.io --no-open # don't auto-open the preview
metaprev https://hungv.io -o ./og.html  # write the preview to a specific path
```

## Options

| Flag | Effect |
|---|---|
| `-o, --output <file>` | Write preview HTML to `<file>` (default: a temp file) |
| `--no-open` | Don't auto-open the preview in your browser |
| `--json` | Print machine-readable JSON to stdout (implies `--no-open`) |
| `-v, --version` | Print version |
| `-h, --help` | Show help |

## Exit codes

- `0` — no errors (warnings allowed)
- `1` — at least one error-level issue (broken image, missing og:image, etc.)
- `2` — fetch or runtime failure

Useful in CI: fail the build when og:image breaks.

## License

MIT © Le Vinh Hung
