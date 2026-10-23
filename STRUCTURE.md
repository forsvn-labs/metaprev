# metaprev structure

This public repository is the maintained source for `@forsvn/metaprev`.
`app/` is a subtree of this repository; npm is a distribution surface.

## Code architecture

The Node shim in [app/bin/metaprev.mjs](app/bin/metaprev.mjs) dispatches to
the Bun CLI in [app/bin/metaprev.ts](app/bin/metaprev.ts). The CLI fetches
the page and image, parses metadata, resolves fallbacks, validates facts,
and emits terminal/JSON results or a local HTML repair workspace.

```text
app/bin/                   CLI entrypoints
app/src/fetch.ts           Bounded page and image fetching
app/src/parse.ts           Metadata extraction
app/src/inputs.ts          Open Graph and X fallback resolution
app/src/validate.ts        Evidence and stable issue codes
app/src/repair.ts          Repair snippets and briefs
app/src/render.ts          Local HTML workspace and platform mocks
app/test/                  CLI and pipeline regression tests
app/skills/metaprev/       Bundled coding-agent guidance
app/CHANGELOG.md           Versioned package history
brand/                     Build-independent identity context
ops/                       Product metadata and operations entry
scripts/publish-mirror.sh  Historical export helper
```

[README.md](README.md) has source commands; [app/README.md](app/README.md)
documents the package interface. The old export helper does not make
another repository authoritative.

## External knowledge architecture

[BRAIN.md](BRAIN.md) resolves `forsvn/metaprev` to its Google Drive project
and `OPEN THIS.md` map. Drive holds platform research, original media,
review evidence, and private planning. The four root records summarize
purpose, location, structure, and state; they do not mirror those sources.
Required package assets and code remain in Git. Archived handoffs retain
their truth dates; [STATUS.md](STATUS.md) owns the current lifecycle.
