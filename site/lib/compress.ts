// Stream text compression without buffering a second copy of a report. Font
// and raster files already use compressed formats and pass through unchanged.
export function compressResponse(response: Response, request: Request): Response {
  const type = response.headers.get('content-type') ?? ''
  if (!response.body || response.headers.has('content-encoding') || !/^(text\/|application\/(json|javascript|xml))/.test(type)) return response
  const headers = new Headers(response.headers)
  headers.set('Vary', [headers.get('Vary'), 'Accept-Encoding'].filter(Boolean).join(', '))
  const gzip = (request.headers.get('accept-encoding') ?? '').split(',').some(value => {
    const match = /^\s*gzip\s*(?:;\s*q=(0(?:\.\d{1,3})?|1(?:\.0{1,3})?))?\s*$/i.exec(value)
    return match !== null && Number(match[1] ?? 1) > 0
  })
  if (gzip && request.method !== 'HEAD') {
    headers.set('Content-Encoding', 'gzip')
    headers.delete('Content-Length')
    return new Response(response.body.pipeThrough(new CompressionStream('gzip')), { status: response.status, headers })
  }
  return new Response(response.body, { status: response.status, headers })
}
