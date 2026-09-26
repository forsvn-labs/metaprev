# metaprev progress

Updated: 2026-09-25
Owner: Hung
State: shipped and maintained; current release 0.6.0. Post-0.6.0 performance and test-maintenance work does not change the release version.

## Resume here

Read `VISION.md`, this file, `ROADMAP.md`, `app/AGENTS.md`, then `app/CHANGELOG.md`.

## Current state

- Private source is `app/`; `forsvn-labs/metaprev` is the one-way public mirror.
- The package is published as `@forsvn/metaprev`.
- There is no dedicated landing page and no decision to build one.
- `0.6.0` shipped from `c030fb3` as tag [`v0.6.0`](https://github.com/forsvn-labs/metaprev/releases/tag/v0.6.0) and npm [`@forsvn/metaprev@0.6.0`](https://www.npmjs.com/package/@forsvn/metaprev/v/0.6.0).
- The 2026-08-28 mirror dry-run differs only in the generated instruction surface
  (`AGENTS.md` replaces `CLAUDE.md`). That rename is not part of `0.6.0`.
- Post-0.6.0 fetch/preview performance work is committed in `af81583`: `fetchPage` stops at `</head>`, facts-path `probeImage` cancels after dimensions, the Node shim skips nested Bun spawn for `--help`/`--version` and runs in-process under Bun, and preview HTML emits each raster data URI once.
- This test cleanup removes three direct cases already covered by process-level CLI checks. The remaining suite keeps its distinct parsing, validation, host-safety, rendering, repair, fetch-limit, CLI, and security coverage.

## Next action

Run the package release gates when preparing the next version. Collect real use feedback from `0.6.0`
for later compatibility fixes. Verify package and mirror version parity after each publish.
