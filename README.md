# metaprev

Inspect and repair Open Graph cards locally before sharing a page.

- [VISION.md](VISION.md): intended users, outcomes, and scope.
- [BRAIN.md](BRAIN.md): external knowledge key and authorized Drive access.
- [STRUCTURE.md](STRUCTURE.md): architecture and repository map.
- [STATUS.md](STATUS.md): dated state, blockers, and next steps.

## Run from source

Requires Bun on PATH.

```bash
cd app
bun install
bun run dev http://localhost:3000 --no-open
bun run test
bun run lint
bun run typecheck
```

For the published CLI, use `npx @forsvn/metaprev <url>` with Bun installed.
[app/README.md](app/README.md) covers usage and CI exit codes;
[CHANGELOG.md](CHANGELOG.md) links the versioned release history.
