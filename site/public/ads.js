/* Public-guide-only AdSense adapter. No custom banner or stored consent flag. */
(() => {
  'use strict'
  const slot = document.querySelector('[data-metaprev-ad]')
  const initialPath = location.pathname
  const safeLocation = () => slot && location.protocol === 'https:' && location.origin === slot.dataset.origin &&
    !location.search && !location.hash && location.pathname === initialPath && /^\/guides\/[a-z-]+$/.test(location.pathname)
  if (!safeLocation()) return
  const container = slot.querySelector('[data-ad-container]')
  const purposes = [1, 2, 3, 4, 7, 9, 10]
  let started = false
  let sdkExecuted = false
  let stopped = false
  let listenerId
  let networkScript
  const shutdown = (reload = sdkExecuted) => {
    if (stopped) return
    stopped = true
    container?.remove()
    networkScript?.remove()
    // Removing a script cannot undo executed third-party code. A clean document
    // must re-evaluate current CMP consent, without reusing any local flag.
    if (started && reload) location.replace(location.pathname + '?ads=off')
  }
  const granted = (data, success) => success === true && data?.cmpStatus === 'loaded' &&
    ['tcloaded', 'useractioncomplete'].includes(data.eventStatus) && data.gdprApplies === true &&
    Number.isInteger(data.cmpId) && data.cmpId > 0 && typeof data.tcString === 'string' && data.tcString.length > 0 &&
    data.vendor?.consents?.[755] === true && purposes.every(id => data.purpose?.consents?.[id] === true)
  const timer = setTimeout(() => shutdown(), 10_000)
  const adapter = document.createElement('script')
  adapter.src = '/ads-cmp.js'
  adapter.async = true
  adapter.onerror = () => shutdown()
  adapter.onload = () => {
    if (stopped || typeof window.__tcfapi !== 'function' || typeof window.metaprevAdPrivacyChoices !== 'function') { shutdown(); return }
    try {
      window.__tcfapi('addEventListener', 2, (data, success) => {
        if (stopped) return
        if (!safeLocation()) { shutdown(started); return }
        if (Number.isInteger(data?.listenerId)) listenerId = data.listenerId
        if (!granted(data, success)) {
          // A CMP UI opening after consent is not a revocation. Hide until its
          // next completed choice; no new requests are initiated by this loader.
          if (success && data?.eventStatus === 'cmpuishown' && data.cmpStatus === 'loaded') return
          if (!started && success && data?.cmpStatus === 'loading') return
          shutdown(started); return
        }
        clearTimeout(timer)
        if (started) return
        started = true
        if (container) container.hidden = false
        networkScript = document.createElement('script')
        networkScript.async = true
        networkScript.crossOrigin = 'anonymous'
        networkScript.referrerPolicy = 'no-referrer'
        networkScript.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(slot.dataset.client)}`
        networkScript.onerror = () => shutdown()
        networkScript.onload = () => {
          if (stopped) return
          sdkExecuted = true
          if (!safeLocation()) { shutdown(); return }
          try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { shutdown() }
        }
        document.head.append(networkScript)
      })
    } catch { shutdown() }
  }
  slot.querySelector('[data-ad-privacy]')?.addEventListener('click', () => {
    // The owner-supplied certified CMP adapter must expose its actual settings UI.
    if (typeof window.metaprevAdPrivacyChoices !== 'function') { shutdown(); return }
    try { window.metaprevAdPrivacyChoices() } catch { shutdown() }
  })
  // Clean up the listener on navigation. Revocation is handled by its callback.
  addEventListener('pagehide', () => {
    stopped = true
    clearTimeout(timer)
    if (listenerId !== undefined) try { window.__tcfapi?.('removeEventListener', 2, () => {}, listenerId) } catch { /* no requests */ }
  }, { once: true })
  // BFCache can restore a document after its consent listener was removed.
  addEventListener('pageshow', event => {
    if (event.persisted) location.replace(location.pathname + '?ads=off')
  })
  for (const event of ['hashchange', 'popstate']) addEventListener(event, () => { if (!safeLocation()) shutdown(started) })
  document.head.append(adapter)
})()
