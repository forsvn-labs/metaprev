# Advertising failure contract — 26 October 2026

Define these failures before implementation. All network ads are off by default.

- Missing enable, owner/site approval, privacy review, certified CMP readiness,
  local CMP adapter, publisher, slot, ads.txt authorization, or a public HTTPS
  origin must keep the integration off. Malformed IDs must not enter HTML.
- An authorized ads.txt entry can be served before site approval; disabled or
  invalid publisher configuration must never invent an account relationship.
- Only existing individual public guides can contain an ad slot. Home, forms,
  reports, errors, API, privacy and about pages stay ad-free, including their CSP.
- Before a successful current TCF callback there are no ad network requests.
  Absent, timed out, failed, incomplete, ambiguous or denied consent stays off.
  Non-GDPR signals also stay off until a separate regional policy is reviewed.
- A query, fragment, untrusted origin or non-HTTPS document must not even load
  the CMP adapter. Submitted URLs and report metadata never reach the ad loader.
- Consent revocation removes the ad and navigates to the same guide with ads
  disabled to terminate the document that ran third-party code. A later consent callback must not reinsert an ad there.
- Repeated valid callbacks load one script and one slot. A blocked SDK does not cause a reload loop. SDK initialization failure and
  BFCache restoration terminate the ad document at its ad-free guide URL.
  Ad failure does not affect guide content or the inspector. Ad blocking has no access penalty.
- Browser tests intercept all third-party requests; no real impressions are sent.

The local CMP adapter and publisher IDs are deliberately absent from source.
Passing these checks does not certify a CMP, approve a publisher, establish a
privacy policy, or authorize deployment.
