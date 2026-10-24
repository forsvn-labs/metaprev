// Hosted fetching has a stricter boundary than the local CLI: public Internet
// only, checked DNS pinned to the connection, bounded bytes and total deadline.
import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { IncomingHttpHeaders } from 'node:http'
import ipaddr from 'ipaddr.js'

export class InspectionError extends Error {
  constructor(message: string, readonly status = 422) { super(message) }
}

export function assertPublicAddress(address: string): void {
  if (!ipaddr.isValid(address) || ipaddr.parse(address).range() !== 'unicast') {
    throw new InspectionError('Only public Internet addresses can be inspected.', 400)
  }
}

export function parseTarget(input: string): URL {
  const value = input.trim()
  if (!value || value.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(value)) {
    throw new InspectionError('Enter a public HTTP or HTTPS URL.', 400)
  }
  let url: URL
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`) }
  catch { throw new InspectionError('Enter a valid public URL.', 400) }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
    throw new InspectionError('Use HTTP or HTTPS on its standard port, without a username or password.', 400)
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (ipaddr.isValid(host)) assertPublicAddress(host)
  else if (!host.includes('.') || /\.(localhost|local|internal|home|lan|test|invalid)$/.test(host)) {
    throw new InspectionError('Local and private hosts are available through the CLI only.', 400)
  }
  url.hash = ''
  return url
}

type FetchKind = 'html' | 'image'
export type PublicResponse = {
  url: string
  status: number
  headers: IncomingHttpHeaders
  body: Uint8Array
  contentType: string
}

export async function fetchPublic(input: string, { kind, signal }: { kind: FetchKind; signal?: AbortSignal }): Promise<PublicResponse> {
  let current = parseTarget(input)
  const deadline = AbortSignal.any([AbortSignal.timeout(kind === 'html' ? 10_000 : 6_000), ...(signal ? [signal] : [])])
  const visited = new Set<string>()
  try {
    for (let redirect = 0; redirect <= 4; redirect++) {
      deadline.throwIfAborted()
      if (visited.has(current.href)) throw new InspectionError('The page redirects in a loop.')
      visited.add(current.href)
      const host = current.hostname.replace(/^\[|\]$/g, '')
      const addresses = await new Promise<LookupAddress[]>((resolve, reject) => {
        const abort = () => reject(new InspectionError('The host took too long to resolve.'))
        deadline.addEventListener('abort', abort, { once: true })
        lookup(host, { all: true, verbatim: true }).then(value => {
          deadline.removeEventListener('abort', abort)
          resolve(value)
        }, () => {
          deadline.removeEventListener('abort', abort)
          reject(new InspectionError('The hostname could not be resolved. Check the URL.'))
        })
      })
      if (!addresses.length) throw new InspectionError('The hostname has no public address.')
      for (const answer of addresses) assertPublicAddress(answer.address)
      const address = addresses.find(answer => answer.family === 4) ?? addresses[0]
      if (!address) throw new InspectionError('The hostname has no public address.')
      const target = current
      const result = await new Promise<PublicResponse | { location: string }>((resolve, reject) => {
        const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
          method: 'GET',
          agent: false,
          family: address.family,
          signal: deadline,
          lookup: (_hostname, options, callback) => {
            if (options.all) callback(null, [address])
            else callback(null, address.address, address.family)
          },
          headers: {
            'User-Agent': 'metaprev/0.1 (+https://github.com/forsvn-labs/metaprev)',
            Accept: kind === 'html' ? 'text/html,application/xhtml+xml;q=0.9' : 'image/png,image/jpeg,image/webp,image/gif',
            'Accept-Encoding': 'identity',
          },
        }, response => {
          const status = response.statusCode ?? 502
          if ([301, 302, 303, 307, 308].includes(status)) {
            const location = response.headers.location
            response.destroy()
            if (!location) reject(new InspectionError('The page returned a redirect without a destination.'))
            else resolve({ location })
            return
          }
          if (status < 200 || status >= 300) {
            response.destroy()
            reject(new InspectionError(`The target returned HTTP ${status}. It may block automated requests.`))
            return
          }
          const contentType = (response.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
          const encoding = response.headers['content-encoding']
          if (encoding && encoding !== 'identity') {
            response.destroy()
            reject(new InspectionError('The target ignored the uncompressed-response request. Use the local CLI for this page.'))
            return
          }
          if ((kind === 'html' && !['text/html', 'application/xhtml+xml'].includes(contentType)) ||
              (kind === 'image' && !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType))) {
            response.destroy()
            reject(new InspectionError(kind === 'html' ? 'The URL did not return an HTML page.' : 'The image must be PNG, JPEG, WebP or GIF.'))
            return
          }
          const maxBytes = kind === 'html' ? 512 * 1024 : 5 * 1024 * 1024
          const chunks: Buffer[] = []
          let size = 0
          let headTail = ''
          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            resolve({ url: target.href, status, headers: response.headers, body: Buffer.concat(chunks), contentType })
          }
          response.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > maxBytes) {
              settled = true
              response.destroy()
              reject(new InspectionError(kind === 'html' ? 'The HTML head exceeds the 512 KB inspection limit.' : 'The image exceeds the 5 MB web inspection limit.'))
              return
            }
            chunks.push(chunk)
            // Stop at the end of head. No scripts run and no page body is needed.
            if (kind === 'html') {
              const text = headTail + chunk.toString('latin1')
              headTail = text.slice(-32)
              if (/<\/head\s*>/i.test(text)) {
                finish()
                response.destroy()
              }
            }
          })
          response.on('end', finish)
          response.on('error', error => { if (!settled) reject(error) })
        })
        request.on('error', reject)
        request.end()
      })
      if ('location' in result) {
        current = parseTarget(new URL(result.location, current).href)
        continue
      }
      return result
    }
    throw new InspectionError('The page exceeded the four-redirect limit.')
  } catch (error) {
    if (error instanceof InspectionError) throw error
    if (deadline.aborted) throw new InspectionError('The target took too long to respond. Try again or use the local CLI.')
    throw new InspectionError('The target could not be fetched. Check that it is public and allows automated requests.')
  }
}
