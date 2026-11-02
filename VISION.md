# Vision

Owner: Hung · Confirmed: 2026-10-24 (accepted in PR #7; restructured 2026-11-01)

metaprev helps developers, content authors, and coding agents catch broken
share metadata before sharing a page.

## Why it exists

It inspects the actual page and image, explains observed compatibility risks,
and creates a local repair workspace.

## Who it is for

Developers, content authors, and coding agents.

## The outcome that matters most

Evidence-led fixes and consistent findings across CLI, JSON, HTML, and a
public web inspector. The CLI keeps local inspection on the user's machine.

## What done looks like

Fetch local or deployed HTTP(S) pages; parse Open Graph and X metadata;
validate image facts and fallbacks; show representative platform cards,
crop evidence, themes, and copy-ready repairs.

Visitors to the public website enter a public URL and receive observed
Open Graph and X metadata, representative social cards, and factual findings.

## Principles

- Keep stable issue codes and exit behavior suitable for CI.
- Treat page-controlled input as untrusted.
- The website rejects private networks and credentials. It does not execute
  page scripts or promise a platform's final rendering.
- The landing page and field-specific guides explain the tool in
  server-rendered HTML. Search and answer engines receive the same visible
  facts and source links.
- The first website release has no advertising or tracking scripts.

## Out of scope

Exact third-party rendering or cache guarantees, generic SEO copy-length
advice, invented metadata, and social-media management.

## Direction changes

- 2026-11-01: Restructured the accepted vision; lifecycle moves to
  [PROGRESS.md](PROGRESS.md). Product intent is unchanged.
- 2026-10-24: Authorized a public website, extending the local CLI scope
  ([PR #7](https://github.com/forsvn-labs/metaprev/pull/7)). Advertising is a
  later revenue option after the public tool and hosting are established.
