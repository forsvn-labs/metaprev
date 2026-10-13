# metaprev structure

This Git root owns the files tracked in [forsvn-labs/metaprev](https://github.com/forsvn-labs/metaprev). The repository is public. Keep private planning and external folder identities in the authorized Drive lookup.

VISION.md records purpose. ROADMAP.md owns priorities, active work, blockers, and the live handoff. CHANGELOG.md records verified delivery. STRUCTURE.md maps ownership and working commands. DRIVE.md locates external materials.

## Architecture and ownership

app/ owns the local CLI, fetch and validation pipeline, repair workspace, package tests, and package changelog. npm is a distribution. This Git root owns the maintained source; older one-way-mirror language describes the previous workspace layout.

## Source map

| Path | Purpose |
|---|---|
| `app/` | Application source |
| `brand/` | Brand / design-system |
| `CHANGELOG.md` | What has shipped |
| `ops/` | Ops scripts and local runtime |
| `ROADMAP.md` | What will ship |
| `scripts/` | Tooling |
| `VISION.md` | Why this exists |

## Working commands

- From `app`, run `bun install` before package work. Available commands: `bun run dev`, `bun run test`, `bun run lint`, `bun run typecheck`.

Use [app/README.md](app/README.md) for setup details and project-specific validation. This record migration does not re-run application release or deployment gates.

## Record history

Useful current work moved to ROADMAP.md where this is a product. Location and repository facts moved here. Earlier exact records remain in Git history:

- [PROGRESS.md at 4f4c94b](https://github.com/forsvn-labs/metaprev/blob/4f4c94ba67b102297a9e64082fdc7838dda39334/PROGRESS.md)
- [INDEX.md at 4f4c94b](https://github.com/forsvn-labs/metaprev/blob/4f4c94ba67b102297a9e64082fdc7838dda39334/INDEX.md)

## External materials and recall

Use DRIVE.md for original media, sendables, and verification evidence. Keep deployable assets needed by a build in Git with their source and license. Mem0 is optional recall through the correct Executor v2 account. Store a scope, project key, source pointer, and truth date; open the current source before using a recalled claim. Do not upload credentials, private identity, medical, finance, or employer-confidential source bodies.
