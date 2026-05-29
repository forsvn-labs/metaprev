#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchPage, isLocalUrl, probeImage } from '../src/fetch.ts'
import { formatBytes } from '../src/format.ts'
import { parseMeta } from '../src/parse.ts'
import { renderHtml } from '../src/render.ts'
import type { ImageProbe, Report } from '../src/types.ts'
import { validate } from '../src/validate.ts'

type Cmd = 'preview' | 'issues' | 'facts'
type Issue = Report['issues'][number]
type IssueLevel = Issue['level']

type Opts = {
  cmd: Cmd
  url: string
  output?: string
  open: boolean
  json: boolean
  help: boolean
  insecure: boolean
}

const VERSION = '0.4.0'
const SUBCOMMANDS = new Set<Cmd>(['issues', 'facts'])
const ISSUE_TAGS: Record<IssueLevel, string> = {
  error: 'ERR',
  warn: 'WRN',
  info: 'INF',
}

function parseArgs(argv: string[]): Opts {
  const opts: Opts = {
    cmd: 'preview',
    url: '',
    open: true,
    json: false,
    help: false,
    insecure: false,
  }
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '-h':
      case '--help':
        opts.help = true
        break
      case '-v':
      case '--version':
        console.log(VERSION)
        process.exit(0)
        break
      case '--no-open':
        opts.open = false
        break
      case '--json':
        opts.json = true
        opts.open = false
        break
      case '-k':
      case '--insecure':
        opts.insecure = true
        break
      case '-o':
      case '--output':
        opts.output = argv[++i]
        break
      default:
        if (a && !a.startsWith('-')) positional.push(a)
    }
  }
  if (positional[0] && SUBCOMMANDS.has(positional[0] as Cmd)) {
    opts.cmd = positional.shift() as Cmd
  }
  if (positional[0]) opts.url = positional[0]
  if (opts.url && !/^https?:\/\//i.test(opts.url)) opts.url = `http://${opts.url}`
  return opts
}

function help(): void {
  console.log(`metaprev v${VERSION} — preview your OpenGraph cards locally

Usage:
  metaprev <url> [options]              # full preview + browser open
  metaprev issues <url> [options]       # print just the issues
  metaprev facts  <url> [options]       # print just the parsed meta facts

Arguments:
  url                URL to fetch (e.g. https://example.com or http://localhost:3000)

Options:
  -o, --output FILE  Write the preview HTML to FILE (preview command only)
  --no-open          Don't auto-open the preview in your browser
  --json             Print machine-readable JSON to stdout (implies --no-open)
  -k, --insecure     Skip TLS cert verification (auto-on for *.localhost / *.test / 127.0.0.1)
  -v, --version      Print version and exit
  -h, --help         Show this help

Examples:
  metaprev http://localhost:3000            # check your local dev server
  metaprev https://hungv.io                 # check a deployed page
  metaprev issues http://localhost:3000     # quick issue check, no browser
  metaprev facts https://hungv.io --json    # pipe parsed meta into another tool
`)
}

function reportColor(level: IssueLevel): string {
  if (!process.stdout.isTTY) return ''
  return level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[36m'
}

function reset(): string {
  return process.stdout.isTTY ? '\x1b[0m' : ''
}

function bold(s: string): string {
  return process.stdout.isTTY ? `\x1b[1m${s}\x1b[22m` : s
}

function dim(s: string): string {
  return process.stdout.isTTY ? `\x1b[2m${s}\x1b[22m` : s
}

function green(s: string): string {
  return process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s
}

function printTerminal(report: Report): void {
  const m = report.meta
  const title = m.ogTitle ?? m.twitterTitle ?? m.title ?? '(none)'
  const desc = m.ogDescription ?? m.twitterDescription ?? m.description ?? '(none)'
  console.log()
  console.log(bold(`metaprev — ${report.finalUrl}`))
  console.log(dim(`HTTP ${report.status} · fetched ${report.fetchedAt}`))
  console.log()
  console.log(`  ${dim('title')}        ${title} ${dim(`(${title.length} chars)`)}`)
  console.log(`  ${dim('description')}  ${truncate(desc, 100)} ${dim(`(${desc.length} chars)`)}`)
  console.log(`  ${dim('og:image')}     ${m.ogImage ?? '(none)'}`)
  if (report.image?.width && report.image?.height) {
    console.log(`  ${dim('image dims')}   ${report.image.width}×${report.image.height}px`)
  } else if (report.image?.error) {
    console.log(`  ${dim('image dims')}   ${reportColor('error')}failed: ${report.image.error}${reset()}`)
  }
  console.log()
  if (report.issues.length === 0) {
    console.log(`  ${green('✓ no issues — your card is clean.')}`)
  } else {
    for (const i of report.issues) {
      printIssue(i, '  ')
    }
  }
  console.log()
}

function printIssuesOnly(report: Report): void {
  if (report.issues.length === 0) {
    console.log(green('✓ no issues — your card is clean.'))
    return
  }
  for (const i of report.issues) {
    printIssue(i)
  }
}

function printIssue(issue: Issue, indent = ''): void {
  const tag = ISSUE_TAGS[issue.level]
  console.log(`${indent}${reportColor(issue.level)}${tag}${reset()} ${dim(issue.field.padEnd(12))} ${issue.message}`)
}

function printFactsOnly(report: Report): void {
  const m = report.meta
  const title = m.ogTitle ?? m.twitterTitle ?? m.title
  const desc = m.ogDescription ?? m.twitterDescription ?? m.description
  const rows: Array<[string, string]> = [
    ['source', report.source],
    ['final url', report.finalUrl],
    ['http', String(report.status)],
    ['title', fmt(title, true)],
    ['description', fmt(desc, true)],
    ['og:image', m.ogImage ?? '(none)'],
    ['image dims', report.image?.width && report.image?.height ? `${report.image.width}×${report.image.height}px` : report.image?.error ? `failed: ${report.image.error}` : '(unknown)'],
    ['image bytes', report.image?.byteLength != null ? formatBytes(report.image.byteLength) : '(unknown)'],
    ['twitter:card', m.twitterCard ?? '(none)'],
    ['og:site_name', m.ogSiteName ?? '(none)'],
    ['canonical', m.canonical ?? m.ogUrl ?? '(none)'],
  ]
  const labelWidth = Math.max(...rows.map((r) => r[0].length))
  for (const [label, value] of rows) {
    console.log(`${dim(label.padEnd(labelWidth))}  ${value}`)
  }
}

function fmt(s: string | undefined, withCount = false): string {
  if (!s) return '(none)'
  return withCount ? `${s} ${dim(`(${s.length} chars)`)}` : s
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

function openInBrowser(file: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  try {
    spawn(cmd, [file], { stdio: 'ignore', detached: true }).unref()
  } catch {}
}

// Strip the embedded image bytes from --json output. They're only useful for the
// HTML preview and would otherwise bloat piped output by ~100KB+.
function stripDataUri(report: Report): Report {
  if (!report.image?.dataUri) return report
  const image: ImageProbe = { ...report.image }
  delete image.dataUri
  return { ...report, image }
}

async function buildReport(opts: Opts): Promise<Report> {
  const fetchedAt = new Date().toISOString()
  const page = await fetchPage(opts.url, { insecure: opts.insecure })
  const meta = parseMeta(page.html)
  const imageRef = meta.ogImage ?? meta.twitterImage
  // The base64 data URI is only embedded in the HTML preview. Skip building it for
  // issues / facts / --json, where it would be stripped or unused anyway.
  const withDataUri = opts.cmd === 'preview' && !opts.json
  const image = imageRef
    ? await probeImage(imageRef, page.finalUrl, { insecure: opts.insecure, withDataUri })
    : undefined
  const issues = validate(meta, image)
  return {
    source: opts.url,
    fetchedAt,
    finalUrl: page.finalUrl,
    status: page.status,
    meta,
    image,
    issues,
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    help()
    return
  }
  if (!opts.url) {
    // Subcommand with no URL is a user error — scripts that forget to interpolate $URL
    // should fail loudly, not silently exit 0.
    if (opts.cmd !== 'preview') {
      console.error(`metaprev: '${opts.cmd}' needs a URL argument`)
      console.error(`  example: metaprev ${opts.cmd} https://example.com`)
      process.exit(2)
    }
    help()
    return
  }
  if (opts.output && opts.cmd !== 'preview') {
    console.error(`metaprev: --output is ignored for '${opts.cmd}' (no preview HTML is generated)`)
  }

  let report: Report
  try {
    report = await buildReport(opts)
  } catch (err) {
    const msg = (err as Error).message
    console.error(`metaprev: failed to fetch ${opts.url}`)
    console.error(`  ${msg}`)
    if (/self[ -]?signed|certificate|unable to verify/i.test(msg) && !opts.insecure && !isLocalUrl(opts.url)) {
      console.error(`  hint: rerun with --insecure to skip TLS verification (auto-on for *.localhost / *.test / 127.0.0.1)`)
    }
    process.exit(2)
  }

  const hasError = report.issues.some((i) => i.level === 'error')

  if (opts.cmd === 'issues') {
    if (opts.json) {
      process.stdout.write(JSON.stringify(report.issues, null, 2) + '\n')
    } else {
      printIssuesOnly(report)
    }
    process.exit(hasError ? 1 : 0)
  }

  if (opts.cmd === 'facts') {
    if (opts.json) {
      const facts = {
        source: report.source,
        finalUrl: report.finalUrl,
        status: report.status,
        meta: report.meta,
        image: stripDataUri(report).image,
      }
      process.stdout.write(JSON.stringify(facts, null, 2) + '\n')
    } else {
      printFactsOnly(report)
    }
    return
  }

  // default: full preview
  if (opts.json) {
    process.stdout.write(JSON.stringify(stripDataUri(report), null, 2) + '\n')
    return
  }

  printTerminal(report)

  const html = renderHtml(report)
  const outFile = opts.output ?? join(mkdtempSync(join(tmpdir(), 'metaprev-')), 'preview.html')
  writeFileSync(outFile, html, 'utf8')
  console.log(`  ${dim('preview →')} ${outFile}`)
  if (opts.open) openInBrowser(outFile)

  process.exit(hasError ? 1 : 0)
}

main().catch((err) => {
  console.error('metaprev: unexpected error')
  console.error(err)
  process.exit(2)
})
