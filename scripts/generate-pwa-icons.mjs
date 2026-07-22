import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/**
 * Best existing D mark with a real alpha channel (not baked-in checkerboard).
 * Do not use src/assets/drevora-mark.png — that file has opaque checkerboard pixels.
 */
const markPath = path.join(__dirname, '../landing/images/drevora-mark.png')
const publicDir = path.join(__dirname, '../public')

/** Solid white install-icon canvas (fully opaque). */
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 }

/**
 * @param {number} size
 * @param {string} filename
 * @param {number} markRatio fraction of canvas used by the centred D mark
 */
async function createIcon(size, filename, markRatio) {
  const markBox = Math.round(size * markRatio)

  // Trim transparent padding, then fit inside the mark box (keeps aspect ratio).
  const markBuffer = await sharp(markPath)
    .trim()
    .resize(markBox, markBox, {
      fit: 'inside',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
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
    // Flatten + drop alpha so home-screen icons stay solid white (no transparency artefacts).
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, filename))
}

// Regular icons: D mark ~72% of canvas — clear presence with safe padding.
await createIcon(192, 'pwa-192x192.png', 0.72)
await createIcon(512, 'pwa-512x512.png', 0.72)
// Maskable: more safe padding — D mark ~60% (safe zone for Android masks).
await createIcon(512, 'pwa-512x512-maskable.png', 0.6)
await createIcon(180, 'apple-touch-icon.png', 0.72)

console.log('Generated PWA icons in public/ from landing/images/drevora-mark.png')
