// One record per distinct reader task. These records drive the HTML, Markdown,
// schema, sitemap and links; keyword variants never generate extra pages.
export type Guide = {
  reviewed?: string
  slug: string
  field: string
  title: string
  description: string
  answer: string
  intent: string
  checks: string[]
  example: string
  limitation: string
  source: { name: string; url: string }
}

export const guides: Guide[] = [
  {
    slug: 'og-image', field: 'og:image', title: 'Check and fix your Open Graph image',
    description: 'Find missing, blocked or incorrect Open Graph images. Check the URL, downloaded dimensions, alternative text and declared image metadata.',
    answer: 'og:image identifies the image that represents a page when a service reads its Open Graph metadata. The tag points to an image URL, not a page containing the image. A successful page request does not prove that the image can be downloaded.',
    intent: 'Inspect a missing, blocked or incorrectly sized share image.',
    checks: [
      'Inspect the final page URL. Read the first og:image value in the HTML head and open its absolute HTTP or HTTPS URL.',
      'Check the image response independently. Confirm it returns image bytes rather than a sign-in page, redirect loop or error document.',
      'Compare the downloaded width and height with og:image:width and og:image:height. Use the asset’s real dimensions; changing the tags does not resize the file.',
      'Add og:image:alt that describes the actual image. The Open Graph protocol recommends alternative text when og:image is present.',
    ],
    example: '<meta property="og:image" content="https://example.com/share.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="The dashboard showing a completed preview check">',
    limitation: 'The example dimensions describe one asset. Open Graph does not require a universal image size. Each consuming service can crop, cache or reject images differently. Metaprev’s web inspector accepts PNG, JPEG, WebP and GIF up to 5 MB; the local CLI supports additional inspection paths.',
    source: { name: 'Open Graph protocol: image structured properties', url: 'https://ogp.me/#structured' },
  },
  {
    slug: 'og-title', field: 'og:title', title: 'Check your Open Graph title and its fallback',
    description: 'See which share title is present, distinguish og:title from the HTML title and X overrides, and fix missing or stale share headlines.',
    answer: 'og:title supplies the title of a page as it should appear in a social graph. It is one of the four basic properties required by the Open Graph protocol. An HTML title or an X-specific title is a different field, even when a preview tool uses it as a fallback.',
    intent: 'Resolve a missing or unexpected share headline.',
    checks: [
      'Inspect the deployed URL rather than the source file. Confirm og:title exists in the initial HTML head.',
      'Compare og:title with the page title. Make each truthful for its context; the social title does not have to include every navigation or search suffix.',
      'Check twitter:title separately if X needs different copy. Metaprev shows the field it observed rather than inventing a headline.',
      'After a deployment, inspect again. If Metaprev sees the new title but a service still shows the old one, investigate that service’s cache with its own tools.',
    ],
    example: '<title>Preview inspector · Example</title>\n<meta property="og:title" content="See your link before you share it">\n<meta name="twitter:title" content="A preview check before you post">',
    limitation: 'Metaprev renders representative cards. It cannot clear a platform cache, guarantee that a consumer uses a fallback, or prove that all readers see the same headline. There is no universal Open Graph title character limit in the protocol.',
    source: { name: 'Open Graph protocol: basic metadata', url: 'https://ogp.me/#metadata' },
  },
  {
    slug: 'og-description', field: 'og:description', title: 'Check your Open Graph description',
    description: 'Inspect a missing or stale share description, compare it with the page description, and add factual supporting copy to your metadata.',
    answer: 'og:description gives a short description of the object represented by a page. The Open Graph protocol lists it as optional metadata. A consuming service may have its own requirements or choose not to display it, so a missing description and a hidden description are different problems.',
    intent: 'Find why the supporting copy is missing or unexpected.',
    checks: [
      'Read og:description from the fetched HTML head. Do not assume that a visible paragraph on the page becomes the share description.',
      'Compare og:description with meta name="description". Metaprev can use the page description as a representative fallback, while keeping the observed fields separate.',
      'Write a factual description that explains the page. Avoid adding unsupported promises or padding the text to an arbitrary target length.',
      'Inspect twitter:description if X copy differs. Recheck after deployment, then distinguish an outdated platform cache from outdated HTML.',
    ],
    example: '<meta name="description" content="Inspect the tags and image behind a public link.">\n<meta property="og:description" content="Check your share title, image and metadata before posting.">',
    limitation: 'A tag can be present while a card omits the supporting text. Card layout, available space, platform policy and caching remain outside this inspection. The Open Graph protocol does not define one universal description length.',
    source: { name: 'Open Graph protocol: optional metadata', url: 'https://ogp.me/#optional' },
  },
  {
    slug: 'og-url', field: 'og:url', title: 'Check the canonical URL in your Open Graph tags',
    description: 'Compare the inspected URL, redirects, og:url and the HTML canonical. Find staging addresses or wrong page identities before sharing.',
    answer: 'og:url identifies the canonical URL of the object represented by a page. The Open Graph protocol treats this URL as the object’s permanent identifier. It is distinct from the address originally entered into a preview tool and from the final address after HTTP redirects.',
    intent: 'Find incorrect share identities and staging URLs.',
    checks: [
      'Inspect the public URL you intend to share. Note the final URL after redirects and compare it with og:url.',
      'Check that og:url identifies the intended page. A copied homepage URL on every article can give different pages the same declared social identity.',
      'Compare the HTML rel="canonical" link as a separate field. Investigate accidental staging domains, insecure schemes or unrelated paths.',
      'When query parameters are part of the actual page identity, preserve the intended canonical policy. Do not strip all parameters just because they exist.',
    ],
    example: '<link rel="canonical" href="https://example.com/guides/share-preview">\n<meta property="og:url" content="https://example.com/guides/share-preview">',
    limitation: 'Metaprev reports observed metadata and redirects. It does not choose your canonical policy, change a search engine’s selected canonical, or prove that social services merge identities in the same way.',
    source: { name: 'Open Graph protocol: basic metadata', url: 'https://ogp.me/#metadata' },
  },
  {
    slug: 'og-video', field: 'og:video', reviewed: '2026-10-26',
    title: 'Check Open Graph video metadata and poster fallbacks',
    description: 'Inspect video URLs, HTTPS alternatives, MIME type and declared dimensions. Separate Open Graph metadata from verified playback and platform player rules.',
    answer: 'og:video declares a video resource associated with the page. The Open Graph protocol defines structured properties for its URL, secure URL, MIME type, width and height. These declarations do not prove that a platform can play or embed the resource.',
    intent: 'Find incomplete video declarations and distinguish a poster preview from tested playback.',
    checks: [
      'Declare the first intended og:video resource before its structured properties. Later video roots begin separate groups; the first has preference when values conflict.',
      'Use an absolute public URL and an HTTPS resource. A secure_url is an alternate for the selected resource, not a separate video.',
      'Set og:video:type to the actual response MIME type and use the real positive pixel dimensions. Do not copy an example’s dimensions without checking the file.',
      'Keep a useful og:image poster and descriptive og:image:alt for consumers that show a static card. Check codecs, player requirements and embedding permissions with the destination platform.',
    ],
    example: '<meta property="og:video" content="https://example.com/demo.mp4">\n<meta property="og:video:type" content="video/mp4">\n<meta property="og:video:width" content="1280">\n<meta property="og:video:height" content="720">\n<meta property="og:image" content="https://example.com/demo-poster.png">\n<meta property="og:image:alt" content="The demo dashboard with a completed inspection">',
    limitation: 'Metaprev reads declarations but does not fetch video bytes, inspect codecs, run players or verify platform playback. A representative image card is a poster simulation. Open Graph metadata does not replace a service’s player policy or clear its cache.',
    source: { name: 'Open Graph protocol: structured properties and arrays', url: 'https://ogp.me/#structured' },
  },

]
