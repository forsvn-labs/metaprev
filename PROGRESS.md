# metaprev progress

Updated: 2026-09-19
Owner: Hung
State: shipped and maintained; current release 0.5.0

## Resume here

Read `VISION.md`, this file, `ROADMAP.md`, `app/AGENTS.md`, then `app/CHANGELOG.md`.

## Current state

- Private source is `app/`; `forsvn-labs/metaprev` is the one-way public mirror.
- The package is published as `@forsvn/metaprev`.
- There is no dedicated landing page and no decision to build one.
- Unreleased work corrects platform evidence and severity without changing the Issue object shape or package version.
- The HTML report keeps platform card appearance separate from persistent report chrome. Workbench is the default. Five tweakcn-mapped presets add independent light and dark schemes with system fonts only.
- Muted chrome tokens are derived after every theme preset so they win the cascade. The clean-report chip uses `--ok-ink`. Facebook and LinkedIn image placeholders stay scoped to card appearance.
- Missing `og:url` warns even when a canonical link exists. Repair output labels a canonical-derived value as a candidate to verify.
- Image checks cite LinkedIn's current first-party 1200×627, 1.91:1, and 5 MB guidance. Facebook-specific format, size, ratio, and first-share claims remain unconfirmed because Meta's first-party pages returned HTTP 429 when last checked.
- All 71 tests (415 assertions) and TypeScript verification passed on 2026-09-19.
- The 2026-08-28 mirror dry-run differs only in the generated instruction surface
  (`AGENTS.md` replaces `CLAUDE.md`). Nothing was pushed.

## Next action

Review the Unreleased accuracy and report UI changes with real pages, then decide whether they and
the instruction-surface change belong in the next release. Verify package and mirror version
parity before any release work.
