# Messaging preview increment · 26 October 2026

## Goal and implementation plan

Inspect the same fetched page in Messenger, iMessage, Telegram, X Chat,
WhatsApp and Slack contexts. Add a shared surface policy and safe renderer to
the CLI report and public inspector. Preserve existing feed cards, fetch limits,
stable issue codes and JSON shape. Do not add messaging credentials, send
messages, or change ads, consent, hosting or deployment.

1. Write fixtures and behavioral contracts before implementation.
2. Add adapters with explicit metadata sources and evidence boundaries.
3. Add a separate messaging section to both reports, with distinct treatments,
   no-JavaScript access, local preview-size controls and preview-disabled state.
4. Test fallback, hostile text, image failures and X Chat's unverified state.
5. Verify browser behavior at phone and desktop sizes; obtain independent
   standards and requirements reviews against baseline `e6088d2`.

## Evidence and limits

All cards are simulations. No messaging account or platform cache is inspected.
Open Graph followed by page-level text is the workspace's fallback policy;
unless a source explicitly documents it, it is not a vendor precedence promise.
Frames and colors are illustrative, not certified client screenshots.

| Surface | Verified official behavior | Increment and integration boundary |
| --- | --- | --- |
| Messenger | [Meta's announcement](https://about.fb.com/news/2023/01/expanding-features-for-end-to-end-encryption-on-messenger/) confirms link previews in encrypted chats. [Help](https://www.facebook.com/help/messenger-app/820841429347610) describes a preview preference; direct retrieval was login gated. | Image-first OG simulation. User settings and cached content can change the result. A [Messenger generic template](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/template/generic) is a structured business message, not a consumer unfurl. No Send API connection. |
| iMessage | [Apple TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages) documents `og:title`, `og:image`, static metadata and server redirects. Its official JSON was read on this date. Apple recommends image width at least 900px; these are guidelines. | Ordinary web-link image/title/domain simulation. No general description; Apple separately documents post text via `og:description` for social pages with a supported `twitter:card` and ActivityPub alternate link. Icon, video and that specialized post treatment are not modeled. Apple's native Link Presentation API is not a web service that verifies Messages. |
| Telegram | [Telegram's update](https://telegram.org/blog/reply-revolution) documents selectable link, image size and position. [Bot API](https://core.telegram.org/bots/api#linkpreviewoptions) documents disable, explicit URL, media preferences and above-text options. Preferences may be ignored when unsupported. | Text-first simulation with local large/compact choices. One inspected URL; no composer, bot token, Bot API call or Secret Chat guarantee. |
| X Chat | [X Chat help](https://help.x.com/en/using-x/about-chat) describes encrypted messaging but does not establish external-site card rendering. [DM API docs](https://docs.x.com/x-api/direct-messages/manage/integrate) describe user-authenticated messages, not an anonymous preview oracle. | Explicit unverified URL-only state. Do not reuse X feed Cards, assume `twitter:*` behavior, or claim that rich previews never work. No X API usage or new permissions. |
| WhatsApp | [Meta's announcement](https://about.fb.com/news/2023/02/new-whatsapp-status-features/) confirms visual previews in messages and status. [WhatsApp help](https://faq.whatsapp.com/445453537819972) documents disabling link previews. | Compact OG simulation. Consumer settings can suppress it. No Cloud API connection or business-message template. |
| Slack | [Slack developer docs](https://docs.slack.dev/messaging/unfurling-links-in-messages/) distinguish classic metadata unfurls from app unfurls with registered domains/events and `chat.unfurl`. [User help](https://slack.com/help/articles/204399343-Share-links-and-set-preview-preferences) describes preview preferences. | Separate classic-unfurl OG simulation; does not stand in for Discord or an app unfurl. No Slack app installation, token or API call. |

Additional surfaces (Zalo, Teams, Signal and Instagram DMs) need their own
official-source research and live-client evidence before adding a treatment.
In particular, business messaging APIs do not establish consumer preview rules.

## Failure modes and acceptance contract

- A feed's `twitter:*` overrides leak into messaging cards.
- Missing OG text falsely appears as vendor-verified fallback behavior.
- X Chat is drawn as a working X feed card without evidence.
- Missing, failed, unsafe or unvalidated images trigger external requests.
- Hostile metadata executes markup or injects links in either report.
- A client preference is presented as a server setting or integration.
- A Telegram size control changes other cards or implies a Bot API call.
- A disabled-preview scenario hides the URL or loses keyboard access.
- Six added surfaces overflow phone screens or disappear without JavaScript.
- New UI disrupts existing feed tabs, image expiry, report CSP or CLI copy tools.

The repeatable tests use illustrative fixtures, not recorded platform captures.
Live-client comparison remains outstanding and requires an authorized real
conversation; no test sends messages automatically.

## Verification commands

- `cd app && bun test`: CLI, parser, renderer and messaging contracts.
- `cd app && bun run typecheck`: CLI typecheck.
- `cd site && bun run test && bun run typecheck`: public-fetch security and site types.
- `cd site && bun test/messaging-browser.ts`: repeatable offline browser fixtures;
  results JSON and screenshots default to `/tmp/metaprev-messaging-evidence`.

The browser fixture uses the existing bundled Metaprev share artwork. Screenshots
are illustrative test reports, not Messenger, Messages, Telegram, X, WhatsApp or
Slack captures. Artifacts stay outside Git.

## Verified increment

The first implementation passed 82 CLI tests, 32 public-fetch security tests,
42 real HTTP acceptance checks and both package typechecks. Offline browser
acceptance passed 114 checks at 320, 390, 768 and 1440 CSS pixels, including
no-JavaScript behavior and both image modes. These results are local evidence.

Independent standards and requirements review found supplied image descriptions
were dropped and the CLI messaging cards followed report chrome instead of the
card appearance setting. Both were reproduced in browser regressions before the
fixes; the final browser artifact passes those regressions.

Full CLI lint retains the pre-existing 21 errors and five warnings recorded in
STATUS; targeted lint on the new modules and fixtures passes. The local
`no-mistakes` executable is unavailable; independent review and direct checks
provide the validation for this increment. No release or deployment is claimed.
