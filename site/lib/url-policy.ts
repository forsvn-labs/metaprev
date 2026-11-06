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

