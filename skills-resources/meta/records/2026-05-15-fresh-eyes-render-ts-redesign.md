---
skill: fresh-eyes
version: 1
date: 2026-05-15
status: done
---

# Review Chain Report

**Artifact**: `src/render.ts` — HTML preview page redesign
**Date**: 2026-05-15
**Rounds**: 1

## Verdict: FIXED

## Issues Found
| # | Severity | Confidence | Location | Problem | Status |
|---|----------|------------|----------|---------|--------|
| 1 | major | 10/10 | `summaryLine` function + `summary` variable | Dead code — function called and assigned but never referenced in template | Fixed |
| 2 | major | 10/10 | `<a href="${finalUrlEsc}">` in header | XSS vector: `javascript:` URLs not filtered. `escapeHtml` doesn't strip dangerous protocols | Fixed |
| 3 | major | 9/10 | `hostEsc` computed via `toUpperCase()`, X card reverses with `.toLowerCase()` | Wasted transform; Facebook shows caps but other platforms get wrong casing | Fixed |
| 4 | minor | 8/10 | `.fact__val { word-break: break-word }` | `break-word` is non-standard/deprecated | Fixed |
| 5 | minor | 7/10 | External link in header | Missing `aria-label` for screen readers | Fixed |
| 6 | minor | 6/10 | `<div class="main">` used instead of `<main>` | Missing landmark element for accessibility | Fixed |
| 7 | nit | 10/10 | `factRow` `isEmpty` check includes `'(empty)'` | Dead condition — never passed as input | Fixed |
| 8 | nit | 10/10 | Discord card mock — no "no image" state | Other 3 variants show placeholder; Discord showed nothing | Fixed |
| 9 | nit | 8/10 | `count` parameter name in `factRow` shadows `count()` function | Cosmetic only — declined | Declined |

## Input Quality Assessment
| Input | Rating | Evidence |
|-------|--------|----------|
| Product/domain context | Rich | Full types.ts and format.ts available; existing render.ts implementation to redesign |
| Requirements clarity | Precise | "improve design output, it's generic, single HTML page, make it nice" — clear intent |
| Upstream artifacts | Fresh | Code written in same session |

## Simplifications Applied
- Removed `summaryLine` function (28 lines of dead code) and its unused `summary` variable
- Removed `hostEsc` `toUpperCase()` → `toLowerCase()` round-trip: keep natural case, present per-card as needed
- Removed `'(empty)'` from `factRow` dead condition check

## Changes Made
1. **Dead code removal**: Deleted `summaryLine()` function and `summary` variable
2. **Security**: Added `^https?:\/\/` protocol validation on `report.finalUrl` before inserting into `href`; falls back to `#` on non-HTTP URLs
3. **Casing fix**: `hostEsc` now stores natural case; X card mock no longer reverses with `.toLowerCase()`
4. **CSS standards**: Added `overflow-wrap: break-word` alongside `word-break: break-word`
5. **Accessibility**: Changed `<div class="main">` to `<main class="main">`; added `aria-label` to external link
6. **Consistency**: Added dark-themed "No og:image" placeholder to Discord card mock when image is missing
7. **Cleanup**: Removed `'(empty)'` stale condition from `factRow`

## Reviewer's Summary
Code is well-structured with good attention to card mock details and CSS quality. Two meaningful issues found: missing URL protocol validation (defense-in-depth for `href`) and dead code. The cleanup items (casings, CSS standards, accessibility) were all straightforward fixes.

## Resolver's Notes
- `count` parameter shadowing (nit, 8/10): Declined — functional impact is zero; renaming would need call-site updates for cosmetic benefit only.
