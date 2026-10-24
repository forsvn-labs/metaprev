// metaprev client. Progressive enhancement only: the form posts to /inspect
// without JavaScript. Result HTML comes from the same-origin /api/inspect
// endpoint, which escapes every page-controlled value on the server.
;(() => {
  'use strict'

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const CLIENT_TIMEOUT_MS = 25000
  const SLOW_NOTICE_MS = 5000

  // ── announcements ─────────────────────────────────────────────────────
  const live = document.createElement('div')
  live.className = 'sr-only'
  live.setAttribute('aria-live', 'polite')
  document.body.append(live)
  let liveTimer = 0
  const announce = message => {
    clearTimeout(liveTimer)
    live.textContent = ''
    liveTimer = window.setTimeout(() => { live.textContent = message }, 60)
  }

  // ── tabs (WAI-ARIA tabs with automatic activation) ────────────────────
  function setupTabs(container) {
    if (container.dataset.enhanced === 'true') return
    const tablist = container.querySelector('[data-tablist]')
    const tabs = Array.from(container.querySelectorAll('[data-tab]'))
    const panels = Array.from(container.querySelectorAll('[data-tabpanel]'))
    if (!tablist || !tabs.length || tabs.length !== panels.length) return
    container.dataset.enhanced = 'true'
    container.classList.add('is-tabbed')
    tablist.hidden = false
    tablist.setAttribute('role', 'tablist')

    const select = (index, focus) => {
      tabs.forEach((tab, i) => {
        const selected = i === index
        tab.setAttribute('aria-selected', String(selected))
        tab.tabIndex = selected ? 0 : -1
        panels[i].hidden = !selected
      })
      if (focus) tabs[index].focus()
    }

    tabs.forEach((tab, i) => {
      const panel = panels[i]
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-controls', panel.id)
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('aria-labelledby', tab.id)
      panel.tabIndex = 0
      tab.addEventListener('click', () => select(i, false))
      tab.addEventListener('keydown', event => {
        const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }
        if (!(event.key in keys)) return
        event.preventDefault()
        select((keys[event.key] + tabs.length) % tabs.length, true)
      })
    })
    select(0, false)
  }

  // ── preview images expire from the server cache after a few minutes ───
  function watchImage(img) {
    if (img.dataset.watched === 'true') return
    img.dataset.watched = 'true'
    const fail = () => {
      const message = 'Image preview expired. Check the link again to reload it.'
      const proof = img.classList.contains('trim__img') ? img.closest('.proof') : null
      const box = document.createElement('div')
      if (proof) {
        box.className = 'asset-empty'
        const label = document.createElement('span')
        label.textContent = message
        box.append(label)
        proof.replaceWith(box)
        return
      }
      const holder = img.parentElement
      if (!holder) return
      holder.classList.add('is-empty')
      const label = document.createElement('span')
      label.className = 'mock__empty'
      label.textContent = 'Preview expired'
      img.replaceWith(label)
    }
    img.addEventListener('error', fail, { once: true })
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) fail()
  }

  function enhance(root) {
    root.querySelectorAll('[data-copy]').forEach(button => { button.hidden = false })
    root.querySelectorAll('[data-appearance-group]').forEach(group => { group.hidden = false })
    root.querySelectorAll('[data-tabs]').forEach(setupTabs)
    root.querySelectorAll('img[data-preview-img]').forEach(watchImage)
  }

  // ── card appearance (light or dark card mocks) ────────────────────────
  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-appearance]') : null
    if (!button) return
    const group = button.closest('[data-appearance-group]')
    const section = button.closest('section')
    const previews = section && section.querySelector('[data-card-appearance]')
    if (!group || !previews) return
    const mode = button.getAttribute('data-appearance') === 'dark' ? 'dark' : 'light'
    previews.setAttribute('data-card-appearance', mode)
    group.querySelectorAll('[data-appearance]').forEach(b => {
      b.setAttribute('aria-pressed', String(b === button))
    })
  })

  // ── copy actions ──────────────────────────────────────────────────────
  function findSource(button, key) {
    const selector = `[data-copy-source="${CSS.escape(key)}"]`
    const scope = button.closest('[data-copy-scope]')
    return (scope && scope.querySelector(selector))
      || (button.closest('[data-results-content]') || document).querySelector(selector)
  }

  function legacyCopy(text) {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.className = 'sr-only'
    document.body.append(area)
    area.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    area.remove()
    return ok
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); return true } catch { /* fall through */ }
    }
    return legacyCopy(text)
  }

  document.addEventListener('click', async event => {
    const button = event.target instanceof Element ? event.target.closest('[data-copy]') : null
    if (!button) return
    const key = button.getAttribute('data-copy') || ''
    const source = findSource(button, key)
    const label = button.querySelector('[data-copy-label]')
    const original = label ? label.textContent : ''
    const ok = source ? await copyText(source.textContent || '') : false
    button.setAttribute('data-state', ok ? 'copied' : 'failed')
    if (label) label.textContent = ok ? 'Copied' : 'Copy failed'
    announce(ok ? `${original} done. The text is on your clipboard.` : 'Copy failed. Select the text and copy it manually.')
    window.setTimeout(() => {
      button.removeAttribute('data-state')
      if (label) label.textContent = original
    }, ok ? 1600 : 2600)
  })

  enhance(document)

  // ── inspect form ──────────────────────────────────────────────────────
  const form = document.querySelector('form[data-inspect-form]')
  const results = document.querySelector('[data-results]')
  if (!form || !results) return

  const input = form.querySelector('input[name="url"]')
  const submit = form.querySelector('[data-submit]') || form.querySelector('button[type="submit"]')
  const submitLabel = form.querySelector('[data-submit-label]')
  const status = form.querySelector('[data-status]')
  const errorBox = form.querySelector('[data-error]')
  const errorText = form.querySelector('[data-error-text]')
  if (!input || !submit) return

  form.noValidate = true
  if (errorBox) errorBox.setAttribute('role', 'alert')
  let busy = false

  const hostFrom = value => {
    try { return new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`).hostname || value } catch { return value.slice(0, 80) }
  }

  const setStatus = text => { if (status) status.textContent = text }

  // The server refuses local and private hosts; point those people to the CLI.
  const LOCAL_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$|\[?f[cd])|\.(localhost|local|test|internal|lan|home)$/i
  const cliHint = value => LOCAL_HOST.test(hostFrom(value))
    ? ' For local and private pages, run npx @forsvn/metaprev on your machine.'
    : ''

  function showError(message) {
    if (errorText) errorText.textContent = message
    if (errorBox) errorBox.hidden = false
    input.setAttribute('aria-invalid', 'true')
    input.setAttribute('aria-describedby', 'mp-url-help mp-url-error')
  }

  function clearError() {
    if (errorBox) errorBox.hidden = true
    if (errorText) errorText.textContent = ''
    input.removeAttribute('aria-invalid')
    input.setAttribute('aria-describedby', 'mp-url-help')
  }

  function setBusy(on) {
    busy = on
    form.classList.toggle('is-loading', on)
    submit.setAttribute('aria-disabled', String(on))
    if (submitLabel) submitLabel.textContent = on ? 'Checking…' : 'Check link'
    results.classList.toggle('is-busy', on)
    results.setAttribute('aria-busy', String(on))
  }

  function messageFor(status, data) {
    if (data && typeof data.error === 'string' && data.error.trim()) return data.error.trim()
    if (status === 400) return 'Enter a public HTTP or HTTPS URL.'
    if (status === 403) return 'This request was refused. Reload the page and try again.'
    if (status === 413) return 'The request was too large. Enter one URL.'
    if (status === 422) return 'This page could not be inspected. Try another public URL.'
    if (status === 429) return 'Too many checks in a short time. Wait a minute, then try again.'
    return 'The check failed on the server. Try again in a moment.'
  }

  class CheckError extends Error {}

  function showReport(html) {
    results.innerHTML = html
    const report = results.querySelector('[data-results-content]')
    enhance(results)
    if (!report) return null
    if (!reduceMotion.matches) {
      report.classList.add('is-new')
      window.setTimeout(() => report.classList.remove('is-new'), 1200)
    }
    report.focus({ preventScroll: true })
    report.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' })
    return report
  }

  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true') clearError()
  })

  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (busy) return
    const value = input.value.trim()
    if (!value) {
      showError('Enter a public page URL to check.')
      input.focus()
      return
    }
    clearError()
    const host = hostFrom(value)
    setBusy(true)
    setStatus(`Fetching ${host}…`)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)
    const slow = window.setTimeout(() => setStatus(`Still fetching ${host}. Slow pages can take up to 20 seconds.`), SLOW_NOTICE_MS)
    let outcome
    try {
      const response = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ url: value }),
        credentials: 'same-origin',
        signal: controller.signal,
      })
      let data = null
      try { data = await response.json() } catch { data = null }
      if (!response.ok || !data || data.ok !== true || typeof data.html !== 'string') {
        throw new CheckError(messageFor(response.status, data))
      }
      outcome = { html: data.html }
    } catch (error) {
      outcome = {
        error: error instanceof CheckError
          ? error.message
          : error && error.name === 'AbortError'
            ? 'The check took longer than 25 seconds. Try again, or run the CLI for slow pages.'
            : 'metaprev could not be reached. Check your connection and try again.',
      }
    } finally {
      window.clearTimeout(timeout)
      window.clearTimeout(slow)
      setBusy(false)
    }

    if (outcome.html !== undefined) {
      const report = showReport(outcome.html)
      const title = report && report.querySelector('.report__title')
      setStatus(title ? `Checked ${host}: ${title.textContent}.` : `Checked ${host}.`)
    } else {
      setStatus('')
      showError(outcome.error + cliHint(value))
      input.focus()
    }
  })
})()
