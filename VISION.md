# metaprev vision

metaprev makes social-card breakage visible before a page is shared. It inspects the real page and
image, explains observed compatibility risk, and produces a local review surface without sending
site content to a hosted service.

## How we play

- Report evidence and actionable repair facts, not generic copy-length folklore.
- Keep CLI, JSON, and HTML behavior consistent and safe for CI.
- Label platform cards as representative; never promise exact third-party rendering.
- Preserve page-controlled data as untrusted input.
- Stay a focused local tool rather than a social-media management suite.

## Source map

- [app/bin/metaprev.mjs](app/bin/metaprev.mjs) is the Node CLI shim.
- [app/bin/metaprev.ts](app/bin/metaprev.ts) is the Bun entrypoint.
- [app/src/validate.ts](app/src/validate.ts) contains metadata validation.
- [app/src/render.ts](app/src/render.ts) renders the preview workspace.
