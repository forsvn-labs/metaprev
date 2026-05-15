import { formatBytes } from './format.ts'
import type { Report } from './types.ts'

function escapeHtml(s: string | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function host(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

const ICONS = {
  error: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warn: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
} as const

export function renderHtml(report: Report): string {
  const m = report.meta
  const title = m.ogTitle ?? m.twitterTitle ?? m.title ?? '(no title)'
  const desc = m.ogDescription ?? m.twitterDescription ?? m.description ?? ''
  const image = m.ogImage ?? m.twitterImage
  const finalImageUrl = report.image?.resolved ?? image
  const previewImageSrc = report.image?.dataUri ?? finalImageUrl
  const siteName = m.ogSiteName ?? host(report.finalUrl)
  const pageHost = host(report.finalUrl)

  const errorCount = report.issues.filter((i) => i.level === 'error').length
  const warnCount = report.issues.filter((i) => i.level === 'warn').length
  const infoCount = report.issues.filter((i) => i.level === 'info').length

  const issuesHtml = report.issues
    .map(
      (i) => `
      <li class="issue issue--${i.level}">
        <span class="issue__icon">${ICONS[i.level]}</span>
        <div class="issue__content">
          <span class="issue__field">${escapeHtml(i.field)}</span>
          <span class="issue__msg">${escapeHtml(i.message)}</span>
        </div>
      </li>`,
    )
    .join('')

  const safeImg = finalImageUrl ? escapeHtml(finalImageUrl) : ''
  const safePreviewImg = previewImageSrc ? escapeHtml(previewImageSrc) : ''
  const titleEsc = escapeHtml(title)
  const descEsc = escapeHtml(desc)
  const sourceEsc = escapeHtml(report.source)
  const finalUrlEsc = escapeHtml(report.finalUrl)
  const siteEsc = escapeHtml(siteName)
  const hostEsc = escapeHtml(pageHost)

  const copyPayloads = buildCopyPayloads(report)
  const totalIssues = report.issues.length

  const statusBadge = totalIssues === 0
    ? `<span class="badge badge--ok">All clear</span>`
    : errorCount > 0
      ? `<span class="badge badge--error">${errorCount} error${errorCount !== 1 ? 's' : ''}</span>`
      : warnCount > 0
        ? `<span class="badge badge--warn">${warnCount} warning${warnCount !== 1 ? 's' : ''}</span>`
        : `<span class="badge badge--info">${infoCount} note${infoCount !== 1 ? 's' : ''}</span>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>metaprev — ${titleEsc}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  html, body { margin: 0; padding: 0; }

  :root {
    --bg: #f2f0eb;
    --surface: #ffffff;
    --elevated: #ffffff;
    --border: #e6e3dc;
    --border-soft: #eeebe5;
    --text: #1c1b18;
    --text-secondary: #787570;
    --text-tertiary: #a5a19a;
    --accent: #2563eb;
    --accent-soft: #eef2ff;
    --error: #dc2626;
    --error-soft: #fef2f2;
    --error-border: #fecaca;
    --warn: #d97706;
    --warn-soft: #fffbeb;
    --warn-border: #fde68a;
    --info: #6366f1;
    --info-soft: #eef2ff;
    --info-border: #c7d2fe;
    --success: #16a34a;
    --success-soft: #f0fdf4;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.03);
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif;
    --font-mono: ui-monospace, 'SF Mono', 'Cascadia Code', 'JetBrains Mono', monospace;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    line-height: 1.5;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  @keyframes fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes scale-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Header ── */
  .header {
    padding: 40px 32px 0;
    animation: fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .header__inner {
    max-width: 1140px;
    margin: 0 auto;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }
  .header__left { min-width: 0; flex: 1; }
  .header__label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    margin-bottom: 8px;
  }
  .header__label svg { opacity: 0.7; }
  .header__url {
    font-size: 20px;
    font-weight: 500;
    word-break: break-all;
    line-height: 1.3;
  }
  .header__url a {
    color: var(--text);
    text-decoration: none;
    transition: color 0.2s ease;
    border-bottom: 1px solid transparent;
  }
  .header__url a:hover {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
  }
  .badge--error { background: var(--error-soft); color: var(--error); }
  .badge--warn { background: var(--warn-soft); color: var(--warn); }
  .badge--info { background: var(--info-soft); color: var(--info); }
  .badge--ok {
    background: var(--success-soft);
    color: var(--success);
  }
  .badge--ok::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success);
    animation: pulse-dot 1.5s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.8); }
  }

  .header__meta {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    font-variant-numeric: tabular-nums;
  }
  .header__meta-divider {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--text-tertiary);
    opacity: 0.4;
  }
  .header__meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .header__meta-item strong { font-weight: 500; }

  /* ── Main grid ── */
  .main {
    max-width: 1140px;
    margin: 0 auto;
    padding: 32px;
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  /* ── Card mocks grid ── */
  .cards-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    animation: fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
  }
  @media (max-width: 820px) {
    .cards-grid { grid-template-columns: 1fr; }
  }

  /* ── Panel ── */
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.3s ease;
  }
  .panel:hover {
    box-shadow: var(--shadow-md);
  }
  .panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .panel__title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-tertiary);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Platform cards ── */
  .mock {
    overflow: hidden;
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .mock:hover { transform: translateY(-1px); }

  /* Facebook */
  .mock--fb {
    border-radius: var(--radius-sm);
    border: 1px solid #dadbe1;
    overflow: hidden;
    background: #fff;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .mock--fb .mock__img {
    aspect-ratio: 1.91 / 1;
    background-color: #e4e6eb;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    border-bottom: 1px solid #dadbe1;
  }
  .mock--fb .mock__body { padding: 10px 12px 12px; }
  .mock--fb .mock__site {
    font-size: 12px;
    color: #65676b;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin-bottom: 2px;
    line-height: 1.3;
  }
  .mock--fb .mock__title {
    font-size: 15px;
    font-weight: 600;
    color: #1c1e21;
    margin: 0 0 3px;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .mock--fb .mock__desc {
    font-size: 13px;
    color: #606770;
    margin: 0;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* X / Twitter */
  .mock--x {
    border-radius: 12px;
    border: 1px solid #e1e8ed;
    overflow: hidden;
    background: #fff;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .mock--x .mock__img {
    aspect-ratio: 2 / 1;
    background-color: #e1e8ed;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    border-bottom: 1px solid #e1e8ed;
  }
  .mock--x .mock__body { padding: 10px 14px; }
  .mock--x .mock__title {
    font-size: 14px;
    font-weight: 600;
    color: #0f1419;
    margin: 0 0 2px;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .mock--x .mock__desc {
    font-size: 13px;
    color: #536471;
    margin: 0 0 8px;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .mock--x .mock__foot {
    border-top: 1px solid #e1e8ed;
    padding: 8px 14px;
    margin: 0 -14px -10px;
  }
  .mock--x .mock__site {
    font-size: 13px;
    color: #536471;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .mock--x .mock__site svg { opacity: 0.6; flex-shrink: 0; }

  /* LinkedIn */
  .mock--li {
    border-radius: var(--radius-sm);
    border: 1px solid #e0e0e0;
    overflow: hidden;
    background: #fff;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .mock--li .mock__img {
    aspect-ratio: 1.91 / 1;
    background-color: #e4e6eb;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    border-bottom: 1px solid #e0e0e0;
  }
  .mock--li .mock__body { padding: 12px 14px; }
  .mock--li .mock__title {
    font-size: 14px;
    font-weight: 700;
    color: #191919;
    margin: 0 0 2px;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .mock--li .mock__desc {
    font-size: 13px;
    color: #5e5e5e;
    margin: 0;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .mock--li .mock__site {
    font-size: 12px;
    color: #5e5e5e;
    margin-top: 6px;
    font-weight: 400;
  }

  /* Discord */
  .mock--dc {
    border-radius: 4px;
    border: 1px solid #1f2024;
    border-left: 4px solid #5865f2;
    overflow: hidden;
    background: #2f3136;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .mock--dc .mock__body { padding: 10px 14px 12px; }
  .mock--dc .mock__site {
    font-size: 12px;
    font-weight: 400;
    color: #b9bbbe;
    margin-bottom: 2px;
    line-height: 1.3;
  }
  .mock--dc .mock__title {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    margin: 0 0 2px;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .mock--dc .mock__desc {
    font-size: 12px;
    color: #b9bbbe;
    margin: 0;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .mock--dc .mock__img {
    aspect-ratio: 1.91 / 1;
    max-width: 400px;
    margin: 8px 14px 12px;
    border: 1px solid #1f2024;
    border-radius: 4px;
    background-color: #202225;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  /* No image placeholder */
  .mock__img--missing {
    aspect-ratio: 1.91 / 1;
    background: linear-gradient(135deg, #f5f3f0 0%, #eae6e0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 500;
  }
  .mock--dc .mock__img--missing {
    background: linear-gradient(135deg, #202225 0%, #2a2c30 100%);
    color: #6a6c70;
  }

  /* ── Bottom row ── */
  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    animation: fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
  }
  @media (max-width: 820px) {
    .bottom-grid { grid-template-columns: 1fr; }
  }

  /* ── Copy button ── */
  .copy-btn {
    font: inherit;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .copy-btn:hover {
    color: var(--text);
    background: var(--elevated);
    border-color: var(--text-tertiary);
  }
  .copy-btn[data-state="copied"] {
    background: var(--success-soft);
    color: var(--success);
    border-color: var(--success);
  }

  /* ── Issues ── */
  .issues { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .issue {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 10px;
    align-items: start;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    line-height: 1.4;
    animation: slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .issue--error {
    background: var(--error-soft);
    border: 1px solid var(--error-border);
    color: var(--error);
  }
  .issue--warn {
    background: var(--warn-soft);
    border: 1px solid var(--warn-border);
    color: var(--warn);
  }
  .issue--info {
    background: var(--info-soft);
    border: 1px solid var(--info-border);
    color: var(--info);
  }
  .issue__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .issue--error .issue__icon {
    background: rgba(220,38,38,0.1);
  }
  .issue--warn .issue__icon {
    background: rgba(217,119,6,0.1);
  }
  .issue--info .issue__icon {
    background: rgba(99,102,241,0.1);
  }
  .issue__content { min-width: 0; }
  .issue__field {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    display: block;
    margin-bottom: 2px;
    opacity: 0.75;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .issue__msg { display: block; }

  .no-issues {
    text-align: center;
    padding: 24px 16px;
    color: var(--success);
  }
  .no-issues svg {
    display: block;
    margin: 0 auto 8px;
  }
  .no-issues__text {
    font-size: 13px;
    font-weight: 500;
    margin: 0;
  }

  /* ── Facts ── */
  .facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
  .fact {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-soft);
    font-size: 13px;
    line-height: 1.4;
    align-items: baseline;
  }
  .fact:last-child { border-bottom: 0; }
  .fact__key {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-tertiary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .fact__val {
    word-break: break-word;
    overflow-wrap: break-word;
    color: var(--text);
    min-width: 0;
  }
  .fact__val--empty {
    color: var(--text-tertiary);
    font-style: italic;
  }
  .fact__count {
    font-variant-numeric: tabular-nums;
    color: var(--text-tertiary);
    font-size: 12px;
    margin-left: 4px;
  }

  /* ── Footer ── */
  .footer {
    max-width: 1140px;
    margin: 0 auto;
    padding: 0 32px 40px;
    width: 100%;
    animation: fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
  }
  .footer__inner {
    padding-top: 24px;
    border-top: 1px solid var(--border-soft);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--text-tertiary);
  }
  .footer__meta { font-variant-numeric: tabular-nums; }
  .footer__brand {
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .footer__brand code {
    background: rgba(0,0,0,0.04);
    padding: 1px 6px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
  }

  @media (max-width: 600px) {
    .header { padding: 24px 16px 0; }
    .main { padding: 20px 16px; }
    .footer { padding: 0 16px 32px; }
    .header__url { font-size: 17px; }
    .cards-grid { gap: 16px; }
    .bottom-grid { gap: 16px; }
    .badge { font-size: 12px; padding: 5px 12px; }
    .fact { grid-template-columns: 100px 1fr; gap: 8px; }
  }
</style>
</head>
<body>

  <header class="header">
    <div class="header__inner">
      <div class="header__left">
        <div class="header__label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          OpenGraph preview
        </div>
        <div class="header__url"><a href="${/^https?:\/\//i.test(report.finalUrl) ? finalUrlEsc : '#'}" target="_blank" rel="noopener" aria-label="Open ${hostEsc} in new tab">${finalUrlEsc}</a></div>
        <div class="header__meta">
          <span class="header__meta-item">
            <strong>${errorCount} error${errorCount !== 1 ? 's' : ''}</strong>
          </span>
          <span class="header__meta-divider"></span>
          <span class="header__meta-item">
            ${warnCount} warning${warnCount !== 1 ? 's' : ''}
          </span>
          <span class="header__meta-divider"></span>
          <span class="header__meta-item">
            ${infoCount} note${infoCount !== 1 ? 's' : ''}
          </span>
          <span class="header__meta-divider"></span>
          <span class="header__meta-item">HTTP ${report.status}</span>
        </div>
      </div>
      ${statusBadge}
    </div>
  </header>

  <main class="main">

    <section class="cards-grid">
      ${cardMock('Facebook', 'fb', { hostEsc, titleEsc, descEsc, safeImg: safePreviewImg, siteEsc })}
      ${cardMock('X (Twitter)', 'x', { hostEsc, titleEsc, descEsc, safeImg: safePreviewImg, siteEsc })}
      ${cardMock('LinkedIn', 'li', { hostEsc, titleEsc, descEsc, safeImg: safePreviewImg, siteEsc })}
      ${cardMock('Discord / Slack', 'dc', { hostEsc, titleEsc, descEsc, safeImg: safePreviewImg, siteEsc })}
    </section>

    <section class="bottom-grid">
      <div class="panel">
        <div class="panel__head">
          <span class="panel__title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Issues (${totalIssues})
          </span>
          ${totalIssues > 0 ? `<button class="copy-btn" data-copy-target="issues">Copy</button>` : ''}
        </div>
        ${totalIssues === 0
          ? `<div class="no-issues">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p class="no-issues__text">No issues — your card is clean.</p>
            </div>`
          : `<ul class="issues">${issuesHtml}</ul>`
        }
      </div>
      <div class="panel">
        <div class="panel__head">
          <span class="panel__title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Facts
          </span>
        </div>
        <ul class="facts">
          ${factRow('Source', sourceEsc)}
          ${factRow('Final URL', finalUrlEsc)}
          ${factRow('HTTP', String(report.status))}
          ${factRow('og:title', titleEsc, count(title))}
          ${factRow('og:description', descEsc, count(desc))}
          ${factRow('og:image', safeImg || '(none)')}
          ${factRow('Image dims', report.image?.width && report.image?.height ? `${report.image.width}×${report.image.height}px` : report.image?.error ? `Failed: ${escapeHtml(report.image.error)}` : '(unknown)')}
          ${factRow('Image bytes', report.image?.byteLength ? formatBytes(report.image.byteLength) : '(unknown)')}
          ${factRow('twitter:card', escapeHtml(m.twitterCard) || '(none)')}
          ${factRow('og:site_name', escapeHtml(m.ogSiteName) || '(none)')}
          ${factRow('Canonical', escapeHtml(m.canonical ?? m.ogUrl) || '(none)')}
        </ul>
      </div>
    </section>

  </main>

  <footer class="footer">
    <div class="footer__inner">
      <span class="footer__meta">${escapeHtml(report.fetchedAt)}</span>
      <span class="footer__brand">Rendered by <code>metaprev</code></span>
    </div>
  </footer>

  <script id="metaprev-copy" type="application/json">${escapeForScriptJson(copyPayloads)}</script>
  <script>
    (function () {
      var node = document.getElementById('metaprev-copy');
      if (!node) return;
      var payloads;
      try { payloads = JSON.parse(node.textContent || '{}'); } catch (e) { return; }
      document.addEventListener('click', function (event) {
        var btn = event.target && event.target.closest && event.target.closest('.copy-btn');
        if (!btn) return;
        var key = btn.getAttribute('data-copy-target');
        var text = key && payloads[key];
        if (!text) return;
        var done = function () {
          var original = btn.textContent;
          btn.setAttribute('data-state', 'copied');
          btn.textContent = 'Copied';
          setTimeout(function () {
            btn.removeAttribute('data-state');
            btn.textContent = original;
          }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
        } else {
          fallback(text, done);
        }
      });
      function fallback(text, done) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {} finally { document.body.removeChild(ta); }
      }
    })();
  </script>
</body>
</html>`
}

function cardMock(
  label: string,
  variant: 'fb' | 'x' | 'li' | 'dc',
  parts: { hostEsc: string; titleEsc: string; descEsc: string; safeImg: string; siteEsc: string },
): string {
  const hasImage = !!parts.safeImg

  if (variant === 'dc') {
    return `
    <div class="panel">
      <div class="panel__head">
        <span class="panel__title">${label}</span>
      </div>
      <div class="mock mock--dc">
        <div class="mock__body">
          <div class="mock__site">${parts.siteEsc}</div>
          <div class="mock__title">${parts.titleEsc}</div>
          <div class="mock__desc">${parts.descEsc}</div>
        </div>
        ${hasImage
          ? `<div class="mock__img" style="background-image: url('${parts.safeImg}')"></div>`
          : `<div class="mock__img--missing">No og:image</div>`}
      </div>
    </div>`
  }

  const imgBlock = hasImage
    ? `<div class="mock__img" style="background-image: url('${parts.safeImg}')"></div>`
    : `<div class="mock__img--missing">No og:image</div>`

  if (variant === 'x') {
    return `
    <div class="panel">
      <div class="panel__head">
        <span class="panel__title">${label}</span>
      </div>
      <div class="mock mock--x">
        ${imgBlock}
        <div class="mock__body">
          <div class="mock__title">${parts.titleEsc}</div>
          <div class="mock__desc">${parts.descEsc}</div>
        </div>
        <div class="mock__foot">
          <span class="mock__site">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            ${parts.hostEsc}
          </span>
        </div>
      </div>
    </div>`
  }

  return `
    <div class="panel">
      <div class="panel__head">
        <span class="panel__title">${label}</span>
      </div>
      <div class="mock mock--${variant}">
        ${imgBlock}
        <div class="mock__body">
          <div class="mock__site">${parts.hostEsc}</div>
          <div class="mock__title">${parts.titleEsc}</div>
          <div class="mock__desc">${parts.descEsc}</div>
        </div>
      </div>
    </div>`
}

function factRow(label: string, value: string, count?: string): string {
  const isEmpty = !value || value === '(none)' || value === '(unknown)'
  return `<li class="fact"><span class="fact__key">${escapeHtml(label)}</span><span class="fact__val${isEmpty ? ' fact__val--empty' : ''}">${escapeHtml(value) || '—'}${count ? ` <span class="fact__count">${count}</span>` : ''}</span></li>`
}

function count(s: string | undefined): string {
  if (!s) return ''
  return `· ${s.length} chars`
}

function buildCopyPayloads(report: Report): Record<string, string> {
  if (report.issues.length === 0) return {}
  const header = `metaprev — ${report.finalUrl}\nfetched ${report.fetchedAt}\n\nIssues (${report.issues.length}):`
  const lines = report.issues.map((i) => `- [${i.level.toUpperCase()}] ${i.field}: ${i.message}`)
  return { issues: `${header}\n${lines.join('\n')}\n` }
}

function escapeForScriptJson(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .replace(/-->/g, '--\\>')
}
