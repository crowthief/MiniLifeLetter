// Builds build/icon.png (512) and build/icon.ico from build/icon-source.png, with rounded corners.
// Run: npm run icons   (uses Electron's canvas, so no extra dependency)
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..', 'build')
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const RADIUS = 0.22 // fraction of the side

function buildIco(pngs) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(pngs.length, 4)
  let offset = 6 + 16 * pngs.length
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e[0] = size === 256 ? 0 : size
    e[1] = size === 256 ? 0 : size
    e.writeUInt16LE(1, 4) // planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([head, ...entries, ...pngs.map((p) => p.data)])
}

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false })
  await w.loadURL('data:text/html,<body></body>')
  const src = fs.readFileSync(path.join(dir, 'icon-source.png')).toString('base64')
  const sizes = [512, ...ICO_SIZES]
  const out = await w.webContents.executeJavaScript(`(async () => {
    const img = new Image()
    img.src = 'data:image/png;base64,${src}'
    await img.decode()
    const render = (n) => {
      const c = document.createElement('canvas')
      c.width = c.height = n
      const x = c.getContext('2d')
      x.imageSmoothingQuality = 'high'
      x.beginPath()
      x.roundRect(0, 0, n, n, n * ${RADIUS})
      x.clip()
      x.drawImage(img, 0, 0, n, n)
      return c.toDataURL('image/png').split(',')[1]
    }
    return Object.fromEntries(${JSON.stringify(sizes)}.map((n) => [n, render(n)]))
  })()`)
  const buf = (n) => Buffer.from(out[n], 'base64')
  fs.writeFileSync(path.join(dir, 'icon.png'), buf(512))
  fs.writeFileSync(path.join(dir, 'icon.ico'), buildIco(ICO_SIZES.map((size) => ({ size, data: buf(size) }))))
  console.log('ICONS written:', sizes.join(','))
  app.exit(0)
})
