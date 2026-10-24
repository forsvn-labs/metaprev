# metaprev

Inspect Open Graph metadata before sharing a page. Use the local CLI or the public URL website.

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

## Run the website

```sh
cd site
bun install
bun run dev
```

Open `http://127.0.0.1:4323`. [site/README.md](site/README.md) covers the public URL
inspector, limits, verification, and host configuration. The website is separate
from the published CLI. Deployment and advertising are not enabled by this source change.
