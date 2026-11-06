# Structure

This public repository is the maintained source for `@forsvn/metaprev`.
`app/` is a subtree of this repository; npm is a distribution surface.

## At a glance

```text
app/bin/                   CLI entrypoints
app/src/fetch.ts           Bounded page and image fetching
app/src/parse.ts           Metadata extraction
app/src/inputs.ts          Open Graph and X fallback resolution
app/src/validate.ts        Evidence and stable issue codes
app/src/repair.ts          Repair snippets and briefs
app/src/render.ts          Local HTML workspace and platform mocks
app/src/messaging.ts       Shared messaging policy and source labels
app/src/messaging-render.ts Shared messaging simulations
app/test/                  CLI and pipeline regression tests
app/skills/metaprev/       Bundled coding-agent guidance
app/CHANGELOG.md           Versioned package history
site/server.ts             Public HTTP routes, request limits, and response policy
site/lib/public-fetch.ts   Public-address DNS checks and pinned, bounded requests
site/lib/inspect.ts        CLI parser/validator adapter and short-lived image cache
site/lib/compress.ts       Streaming gzip negotiation for text responses
site/lib/page.ts           HTML shell, canonical URLs, and structured data
site/data/guides.ts        Distinct Open Graph guide records
site/views/                Server-rendered website content
site/public/               CSS, browser controls, and required runtime artwork
site/scripts/og.ts         Rebuild the outlined share artwork as a raster image
site/test/                 Security contract and real HTTP/browser acceptance
brand/                     Build-independent identity context
ops/                       Product metadata and operations entry
scripts/publish-mirror.sh  Historical export helper
```

## Code

The Node shim in `app/bin/metaprev.mjs` dispatches to the Bun CLI in
`app/bin/metaprev.ts`. The CLI fetches the page and image, parses metadata,
resolves fallbacks, validates facts, and emits terminal or JSON results or a
local HTML repair workspace. The website enters through `site/server.ts`.

Commands: from `app/`, run `bun install`, `bun run dev <url> --no-open`,
`bun test`, `bun run lint`, and `bun run typecheck`. From `site/`, run
`bun install`, `bun run dev`, `bun test`, and `bun run typecheck`.
The website README owns running-service acceptance commands and host settings.

## Read before changing

- [app/README.md](app/README.md) before changing the CLI interface or CI exit codes.
- [site/README.md](site/README.md) and [site/test/acceptance.md](site/test/acceptance.md)
  before changing public URL inspection, network policy, or website hosting.
- [app/docs/messaging-surfaces.md](app/docs/messaging-surfaces.md) before
  changing messaging policy or rendering; it owns the source matrix and acceptance contract.

Where new work goes:

| To add | Put it in |
| --- | --- |
| CLI parsing, validation, or repairs | `app/src/`, with regression contracts in `app/test/` |
| Shared messaging policy or simulations | `app/src/messaging.ts` and `app/src/messaging-render.ts` |
| Website routes and inspection policy | `site/server.ts` and `site/lib/` |
| Website content and guide records | `site/views/` and `site/data/guides.ts` |
| Website acceptance checks | `site/test/` |

The old export helper does not make another repository authoritative.
Cloudflare hosting is in `site/edge/`, with the private runtime in the root
`Dockerfile`. `site/scripts/static.ts` exports public pages for the edge.
From `site/edge/`, run `bun install`, `bun run typecheck`, and `bun run build`.
`site/test/deployment.ts` checks the private-edge client-address policy.
See [PROGRESS.md](PROGRESS.md) for the current access blocker.

## Knowledge

| Location | Contents |
| --- | --- |
| Google Drive project key `forsvn/metaprev`, resolved in the owner's private registry | Platform research, original media, review evidence, and private planning; start at the resolved navigation map |
| `docs/progress-log.md` | Dated verification and historical remainders, with links to public PR evidence |

New knowledge follows the save rules in [BRAIN.md](BRAIN.md). The root records
summarize direction, knowledge homes, structure, and state; they do not mirror sources.
Required package assets and code remain in Git.

## Other documents

- [README.md](README.md): source setup entry. [app/README.md](app/README.md): package interface.
- [CHANGELOG.md](CHANGELOG.md): recorded delivery history. [app/CHANGELOG.md](app/CHANGELOG.md): detailed package history, including unreleased source changes.
- [brand/BRAND.md](brand/BRAND.md): implemented identity. Its retired STATUS link is historical; current verification and release state is in PROGRESS.
- [ops/README.md](ops/README.md): historical operations entry; its private-source and no-landing-page statements predate this repository's current map.
