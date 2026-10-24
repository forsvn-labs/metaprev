// Rasterize the editable, outlined artwork. The production server serves the
// committed PNG and does not need Sharp or an installed font at runtime.
import sharp from 'sharp'

const source = new URL('../public/og.svg', import.meta.url)
const output = new URL('../public/og.png', import.meta.url)
await sharp(source.pathname, { density: 144 }).resize(1200, 630).png({ compressionLevel: 9 }).toFile(output.pathname)
const info = await sharp(output.pathname).metadata()
if (info.width !== 1200 || info.height !== 630 || info.format !== 'png') throw new Error('Invalid Open Graph image')
console.info(JSON.stringify({ asset: 'og.png', width: info.width, height: info.height, format: info.format }))
