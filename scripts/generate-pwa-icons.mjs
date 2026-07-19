import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** Standalone coloured D mark (transparent PNG) — not the full wordmark. */
const markPath = path.join(__dirname, '../src/assets/drevora-mark.png')
const publicDir = path.join(__dirname, '../public')

/** Solid white install-icon canvas. */
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 }

/**
 * @param {number} size
 * @param {string} filename
 * @param {number} markRatio fraction of canvas used by the centred D mark
 */
async function createIcon(size, filename, markRatio) {
  const markBox = Math.round(size * markRatio)
  const markBuffer = await sharp(markPath)
    .resize(markBox, markBox, { fit: 'inside', withoutEnlargement: false })
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
    .composite([{ input: markBuffer, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, filename))
}

// Regular icons: D mark ~75% of canvas (within 72–78%).
await createIcon(192, 'pwa-192x192.png', 0.75)
await createIcon(512, 'pwa-512x512.png', 0.75)
// Maskable: more safe padding — D mark ~62% (within 58–65%).
await createIcon(512, 'pwa-512x512-maskable.png', 0.62)
await createIcon(180, 'apple-touch-icon.png', 0.75)

console.log('Generated PWA icons in public/ from src/assets/drevora-mark.png')
