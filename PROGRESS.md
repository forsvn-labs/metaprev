# metaprev progress

Updated: 2026-09-20
Owner: Hung
State: shipped and maintained; current release 0.6.0. Unreleased fetch/preview speed work is in the worktree, not committed.

## Resume here

Read `VISION.md`, this file, `ROADMAP.md`, `app/AGENTS.md`, then `app/CHANGELOG.md`.

## Current state

- Private source is `app/`; `forsvn-labs/metaprev` is the one-way public mirror.
- The package is published as `@forsvn/metaprev`.
- There is no dedicated landing page and no decision to build one.
- `0.6.0` shipped from `c030fb3` as tag [`v0.6.0`](https://github.com/forsvn-labs/metaprev/releases/tag/v0.6.0) and npm [`@forsvn/metaprev@0.6.0`](https://www.npmjs.com/package/@forsvn/metaprev/v/0.6.0).
- The 2026-08-28 mirror dry-run differs only in the generated instruction surface
  (`AGENTS.md` replaces `CLAUDE.md`). That rename is not part of `0.6.0`.
- Unreleased (not a version bump): `fetchPage` stops at `</head>`, facts-path `probeImage` cancels after dimensions, the Node shim skips nested Bun spawn for `--help`/`--version` and runs in-process under Bun, and preview HTML emits each raster data URI once.

## Next action

Review the unreleased performance work, then ship from this worktree if the gates hold. Collect real use
feedback from `0.6.0` for any later compatibility fixes. Verify package and mirror version parity after
each publish.
