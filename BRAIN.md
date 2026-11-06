# Brain

Knowledge home: Google Drive, personal scope, project key `forsvn/metaprev` · Confirmed: 2026-10-23 (recorded route verification)

Visibility: public

## Where knowledge lives

| Knowledge | Home | Access |
| --- | --- | --- |
| Platform references, source images, compatibility research, review captures | Google Drive project `forsvn/metaprev` | Owner's private registry, existing authorized personal account |
| Code, build configuration, runtime assets, licenses, code-dependent documentation | This repository | Git |
| Work tracking | [PROGRESS.md](PROGRESS.md) | Git |
| Dated verification and historical remainders | [docs/progress-log.md](docs/progress-log.md) | Git; original captures remain in Drive |

Application data retains its existing store. Drive is the knowledge provider,
not a new runtime database.

## Retrieve

1. Resolve `forsvn/metaprev` through the owner's private project registry in
   the personal tools repository with `python3 drive_projects.py forsvn/metaprev`.
2. Open the resolved project's `OPEN THIS.md` map first. Follow its existing
   source, resource, evidence, and archive routes.
3. Open the original. Keep each source's truth date; an archived handoff is
   history, not current state.

## Save

- Keep platform references, source images, compatibility research, and review
  captures in the existing Drive project. Keep code-dependent material in Git.
- Link to the original rather than copying whole documents between Git and Drive.
- Keep folder IDs, mounted paths, credentials, and private discussions in the
  private resolver or Drive. This public repository retains only the neutral key.
- No automatic Drive write authority is recorded here. Follow the task's authorization.

## Access rules

- Account and scope: use the existing authorized personal account.
- Approved route: the private registry and its existing resolver above. The
  verified folder identity and access scope stay in that private resolver.
- The 2026-10-23 route verification matched the registered folder identity and
  confirmed its navigation map. This migration does not verify access again.
- A folder locator does not grant access or prove cloud sync.

## Access problems

- If access fails, request the folder from its owner and record the access
  blocker in the private work record.
- Do not change accounts, providers, sharing, credentials, permissions, or
  network settings to make a link work. Continue work that does not need access.

## Public hosting

Approved 2026-11-06: Cloudflare Free at `metaprev.forsvn.com`, Worker `metaprev-free`.
Executor is the connected API route; deployment uses the owner-authorized local
Cloudflare CLI OAuth login. Credentials stay in its OS-backed storage. No paid
upgrade or Containers. Code/build commands live in `site/README.md`.
