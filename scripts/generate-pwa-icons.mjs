import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoPath = path.join(__dirname, '../public/drevora-logo.png')
const publicDir = path.join(__dirname, '../public')

const BACKGROUND = { r: 11, g: 16, b: 35, alpha: 1 }

async function createIcon(size, filename) {
  const logoSize = Math.round(size * 0.72)
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

await createIcon(192, 'pwa-192x192.png')
await createIcon(512, 'pwa-512x512.png')
await createIcon(180, 'apple-touch-icon.png')

console.log('Generated PWA icons in public/')
