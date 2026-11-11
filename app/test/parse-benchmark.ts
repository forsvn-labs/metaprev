// Run from app/: bun test/parse-benchmark.ts. PARSER_SOURCE can select a saved
// baseline module. Synthetic CPU measurements do not predict network latency.
const { parseMeta } = await import(process.env.PARSER_SOURCE ?? '../src/parse.ts')
const rows = []
for (const bytes of [8000, 16000, 32000]) {
  const html = '<head><meta ' + 'x'.repeat(bytes) + '></head>'
  const samples = []
  for (let run = 0; run < 5; run++) {
    const start = performance.now()
    parseMeta(html)
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  rows.push({ bytes, medianMs: samples[2], samplesMs: samples })
}
console.log(JSON.stringify({ runtime: Bun.version, scenario: 'valueless attribute', rows }, null, 2))
