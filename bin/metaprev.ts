#!/usr/bin/env bun
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchPage, isLocalUrl, probeImage } from '../src/fetch.ts'
import { parseMeta } from '../src/parse.ts'
import { renderHtml } from '../src/render.ts'
import type { Report } from '../src/types.ts'
import { validate } from '../src/validate.ts'

type Opts = {
  url: string
  output?: string
  open: boolean
  json: boolean
  help: boolean
  insecure: boolean
}

const VERSION = '0.1.0'

function parseArgs(argv: string[]): Opts {
  const opts: Opts = {
    url: 'http://localhost:4321',
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
  if (positional[0]) opts.url = positional[0]
  if (!/^https?:\/\//i.test(opts.url)) opts.url = `http://${opts.url}`
  return opts
}

function help(): void {
  console.log(`metaprev v${VERSION} — preview your OpenGraph cards locally

Usage:
  metaprev [url] [options]

Arguments:
  url                URL to fetch (default: http://localhost:4321)

Options:
  -o, --output FILE  Write the preview HTML to FILE
  --no-open          Don't auto-open the preview in your browser
  --json             Print machine-readable JSON to stdout (implies --no-open)
  -k, --insecure     Skip TLS cert verification (auto-on for *.localhost / *.test / 127.0.0.1)
  -v, --version      Print version and exit
  -h, --help         Show this help

Examples:
  metaprev                            # check your local dev server
  metaprev https://hungv.io           # check a deployed page
  metaprev https://hungv.io --json    # CI-friendly JSON output
`)
}

function reportColor(level: 'error' | 'warn' | 'info'): string {
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
    console.log('  \x1b[32m✓ no issues — your card is clean.\x1b[0m')
  } else {
    for (const i of report.issues) {
      const tag = i.level === 'error' ? 'ERR' : i.level === 'warn' ? 'WRN' : 'INF'
      console.log(`  ${reportColor(i.level)}${tag}${reset()} ${dim(i.field.padEnd(12))} ${i.message}`)
    }
  }
  console.log()
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

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    help()
    return
  }

  const fetchedAt = new Date().toISOString()
  let page
  try {
    page = await fetchPage(opts.url, { insecure: opts.insecure })
  } catch (err) {
    const msg = (err as Error).message
    console.error(`metaprev: failed to fetch ${opts.url}`)
    console.error(`  ${msg}`)
    if (/self[ -]?signed|certificate|unable to verify/i.test(msg) && !opts.insecure && !isLocalUrl(opts.url)) {
      console.error(`  hint: rerun with --insecure to skip TLS verification (auto-on for *.localhost / *.test / 127.0.0.1)`)
    }
    process.exit(2)
  }

  const meta = parseMeta(page.html)
  const imageRef = meta.ogImage ?? meta.twitterImage
  const image = imageRef ? await probeImage(imageRef, page.finalUrl, { insecure: opts.insecure }) : undefined
  const issues = validate(meta, image)

  const report: Report = {
    source: opts.url,
    fetchedAt,
    finalUrl: page.finalUrl,
    status: page.status,
    meta,
    image,
    issues,
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    return
  }

  printTerminal(report)

  const html = renderHtml(report)
  const outFile = opts.output ?? join(mkdtempSync(join(tmpdir(), 'metaprev-')), 'preview.html')
  writeFileSync(outFile, html, 'utf8')
  console.log(`  ${dim('preview →')} ${outFile}`)
  if (opts.open) openInBrowser(outFile)

  const hasError = issues.some((i) => i.level === 'error')
  process.exit(hasError ? 1 : 0)
}

main().catch((err) => {
  console.error('metaprev: unexpected error')
  console.error(err)
  process.exit(2)
})
