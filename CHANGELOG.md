# metaprev changelog

## 2026-11-11 — Capacity recovery and guide support

- Distinguish caller rate limits from busy service capacity, with retry guidance.
- Bound temporary image cache waits and keep private errors and image facts.
- Add explicit manual recovery for unavailable previews without automatic refetch.
- Add a voluntary GitHub Sponsors call to action to all ten guides, without tracking.
- Verified the free Worker deployment, 60 live HTTP checks, browser flows and image delivery.
- Source is pushed in PR #16; repository merge is blocked by GitHub integration access.

## 2026-11-11 — Bounded public inspection

- Deployed bounded metadata parsing and request cancellation to the free Worker.
- Keep verified image facts when temporary preview storage fails.
- Verified 60 live HTTP checks, the browser flow, and private image delivery.
- The npm package remains at its previously published version.

## 2026-11-07 — Content and sponsorship pilot

- Published six additional guides, bringing the public guide library to ten.
- Added a footer link to Hung’s GitHub Sponsors page and repository funding configuration.
- Added a local Decap editor, draft exclusion and build-time content validation.
- Fixed Worker startup by keeping review-date checks in the static build.

## 2026-11-07 — Performance update

- Read the HTML head without downloading a large body or rejecting its full Content-Length.
- Compressed private inspection JSON and preloaded the primary UI font.

## 2026-11-07 — Public web app

- Published Open Graph review, feedback and repair UI at https://metaprev.forsvn.com.
- Runs on Cloudflare Free without Containers; CLI remains available.

## 2026-09-19 — 0.6.0

- Recorded release of the local repair workspace, independent report themes,
  evidence-led metadata validation, and safe rendering/CI contracts.
- Source tag: [`v0.6.0`](https://github.com/forsvn-labs/metaprev/releases/tag/v0.6.0)
  at `c030fb3`; recorded package:
  [`@forsvn/metaprev` version `0.6.0`](https://www.npmjs.com/package/@forsvn/metaprev/v/0.6.0).

[app/CHANGELOG.md](app/CHANGELOG.md) owns the detailed versioned package
history. [PROGRESS.md](PROGRESS.md) distinguishes later source work from releases.
