# Edit and publish Metaprev guides

This is the main operating guide for the content pilot. It explains the local
editor, publication checks, and manual deployment. It does not create traffic,
rankings, a remote login, or an automatic daily publishing job.

## Start the editor

From `site/`, run `bun install`, then `bun run cms`. Open
`http://127.0.0.1:4340/admin/` and select **Login**. This opens the local file
editor; it does not authenticate to GitHub. Keep this service on your computer.
Stop it with Ctrl+C when finished. Ports 4340 and 8081 must be available.

Select **Metaprev content → Guides**. Expand a guide to edit its fields, or add
an item. Save changes with the editor's Publish control. That control saves the
local JSON file only. The record's **Status** determines public inclusion:

- `draft`: excluded from the site, sitemap, guide links and Markdown discovery.
- `published`: included in the next build after validation.

Review dates use Hung's Asia/Ho_Chi_Minh calendar. Enter the date you actually
checked the source. Published records cannot have a future review date.
All records, including drafts, must contain the required fields.

Do not store private notes in draft records: this is a public Git repository.

## Review and publish

1. Confirm the page answers a distinct reader task. Check the primary source.
2. Exercise the example in the relevant environment. Framework snippets must
   be tested in that framework before claiming runtime compatibility.
3. Check title, answer, steps, limitations and source date. Mark it published.
4. Run `bun run check:content`, `bun test`, and `bun run typecheck` from `site/`.
5. Run the local website with `PORT=4336 bun server.ts` and the CMS in separate
   terminals. Run `bun test/content-browser.ts` for desktop/mobile acceptance.
   Its artifact is `site/artifacts/content-pilot/results.json`.
6. Review the Git diff, commit, and use the existing free edge build and
   deployment steps in `site/README.md`. Saving alone never changes the live site.

No automatic content generation or deployment is configured. The daily operating
loop is: inspect query evidence, draft or improve one useful page, review it,
and deploy only approved changes. Skip publication when no useful change is ready.

## Files and boundaries

- `site/data/guides.json`: the single content source. The editor changes this.
- `site/data/guides.ts`: validates and selects published records for all outputs.
- `site/lib/content.ts`: validates dates, URLs, fields and duplicate slugs.
- `site/data/support.json`: the public support destination, editable in the CMS.
  An empty URL hides the support link. No payment processing runs on Metaprev.
- `.github/FUNDING.yml`: enables GitHub's repository Sponsor button for hungv47.
- `site/cms/config.json`: Decap field definitions. JSON is valid YAML for Decap.
- `site/scripts/cms.ts`: loopback editor and file proxy; never bundled publicly.

The six added guides are source-reviewed diagnostic guidance. Their rendered
pages are tested; the Next.js snippet has not been exercised in a separate
Next.js application. Keyword volume and ranking opportunity remain unverified.

## Measure the pilot

Restore the existing SEO CLI Google authorization with `seo auth login`, then
use `seo sites --json` to find the correct Search Console property. Capture the
baseline before judging changes. Follow the project's BRAIN route for private
analytics and revenue records; do not commit them here.

Each week, compare indexed guides, search impressions and clicks, queries,
completed inspections if measurable, and actual sponsorship receipts. No click
tracking or analytics was added by this pilot, so support clicks and completions
are not currently measured. GitHub manages sponsorships and payouts.

AdSense/Journey applications, consent configuration, remote CMS OAuth, automated
publishing, and paid tools remain separate setup work. Ads stay disabled.
