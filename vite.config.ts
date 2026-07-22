import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Network-only: never cache authenticated or company-specific API traffic. */
const networkOnlyApiPatterns = [
  /^https:\/\/.*\.supabase\.co\/.*/i,
  /\/rest\/v1\//i,
  /\/auth\/v1\//i,
  /\/storage\/v1\//i,
  /\/realtime\/v1\//i,
  /^https:\/\/api\.stripe\.com\/.*/i,
  /^https:\/\/api\.open-meteo\.com\/.*/i,
  /^https:\/\/geocoding-api\.open-meteo\.com\/.*/i,
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'favicon.png',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-512x512-maskable.png',
      ],
      manifest: {
        id: '/',
        name: 'DREVORA',
        short_name: 'DREVORA',
        description:
          'Fleet and workforce management platform for modern transport businesses.',
        lang: 'en-GB',
        dir: 'ltr',
        theme_color: '#2563EB',
        background_color: '#0B1023',
        display: 'standalone',
        orientation: 'any',
        start_url: '/login',
        scope: '/',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Static application shell — include HTML so navigateFallback stays version-matched
        // with hashed JS/CSS on cold PWA launch (avoids stale shell / layout mismatch).
        globPatterns: ['**/*.{html,js,css,ico,png,svg,woff,woff2,webmanifest}'],
        globIgnores: ['**/hero-backgrounds/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /\/rest\/v1\//,
          /\/auth\/v1\//,
          /\/storage\/v1\//,
          /\/realtime\/v1\//,
        ],
        cleanupOutdatedCaches: true,
        // Prompt-based updates: waiting SW activates only when the user chooses Update now.
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: networkOnlyApiPatterns.map((urlPattern) => ({
          urlPattern,
          handler: 'NetworkOnly' as const,
          method: 'GET' as const,
        })),
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
