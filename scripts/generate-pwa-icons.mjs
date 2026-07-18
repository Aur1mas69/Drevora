import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoPath = path.join(__dirname, '../public/drevora-logo.png')
const publicDir = path.join(__dirname, '../public')

/** DREVORA navy used for install icon canvases. */
const BACKGROUND = { r: 11, g: 16, b: 35, alpha: 1 }

/**
 * @param {number} size
 * @param {string} filename
 * @param {number} logoRatio fraction of canvas used by the centred mark
 */
async function createIcon(size, filename, logoRatio) {
  const logoSize = Math.round(size * logoRatio)
  const logoBuffer = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, filename))
}

await createIcon(192, 'pwa-192x192.png', 0.72)
await createIcon(512, 'pwa-512x512.png', 0.72)
// Maskable safe zone: keep the mark smaller so adaptive icons do not crop it.
await createIcon(512, 'pwa-512x512-maskable.png', 0.52)
await createIcon(180, 'apple-touch-icon.png', 0.72)

console.log('Generated PWA icons in public/')
