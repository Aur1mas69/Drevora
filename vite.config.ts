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
export default defineConfig(({ mode }) => {
  const isNative = mode === 'native'

  return {
    // Capacitor loads bundled assets from the WebView filesystem; relative base is required.
    // Browser / PWA production builds keep Vite's default absolute base ('/').
    base: isNative ? './' : '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Native Capacitor builds must not emit or register a service worker.
        // Browser builds keep the existing PWA configuration unchanged.
        disable: isNative,
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
          // Matches the approved Light AuthSplashScreen background exactly, so
          // the native Android splash (built from these two values) is visually
          // continuous with the in-app Light loader instead of flashing dark
          // navy before the app icon/UI appears.
          theme_color: '#F6F9FF',
          background_color: '#F6F9FF',
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
      alias: [
        // Exact `@/lib/offlineQueue/storage` must win over the general `@` prefix.
        // Web → localStorage fallback; native → Capacitor Preferences.
        {
          find: '@/lib/offlineQueue/storage',
          replacement: isNative
            ? path.resolve(__dirname, './src/lib/offlineQueue/storage.native.ts')
            : path.resolve(__dirname, './src/lib/offlineQueue/storage.ts'),
        },
        // Exact `@/lib/networkStatus` must win over the general `@` prefix.
        // Web → navigator.onLine; native → @capacitor/network.
        {
          find: '@/lib/networkStatus',
          replacement: isNative
            ? path.resolve(__dirname, './src/lib/networkStatus.native.ts')
            : path.resolve(__dirname, './src/lib/networkStatus.ts'),
        },
        // Exact `@/lib/offlineMedia/offlineMediaStorage` must win over the general `@` prefix.
        // Web/PWA → IndexedDB Blobs; native → Capacitor Filesystem Directory.Data.
        {
          find: '@/lib/offlineMedia/offlineMediaStorage',
          replacement: isNative
            ? path.resolve(__dirname, './src/lib/offlineMedia/offlineMediaStorage.native.ts')
            : path.resolve(__dirname, './src/lib/offlineMedia/offlineMediaStorage.ts'),
        },
        // Exact `@/lib/appLockNative` must win over the general `@` prefix.
        // Web → unsupported no-op; native → AppLockBiometric plugin bridge.
        {
          find: '@/lib/appLockNative',
          replacement: isNative
            ? path.resolve(__dirname, './src/lib/appLockNative.native.ts')
            : path.resolve(__dirname, './src/lib/appLockNative.ts'),
        },
        // Exact `@/lib/nativeBackButton` must win over the general `@` prefix.
        // Web → no-op; native → Capacitor App backButton listener.
        {
          find: '@/lib/nativeBackButton',
          replacement: isNative
            ? path.resolve(__dirname, './src/lib/nativeBackButton.native.ts')
            : path.resolve(__dirname, './src/lib/nativeBackButton.ts'),
        },
        // Exact `@/lib/supabaseAuthStorage` must win over the general `@` prefix.
        // Web → browser localStorage defaults; native → SecureAuthStorage plugin adapter.
        {
          find: '@/lib/supabaseAuthStorage',
          replacement: isNative
            ? path.resolve(__dirname, './src/lib/supabaseAuthStorage.native.ts')
            : path.resolve(__dirname, './src/lib/supabaseAuthStorage.ts'),
        },
        // Exact `@/lib/nativeAuthSessionRecover` must win over the general `@` prefix.
        // Web → no-op; native → SecureAuthStorage offline session restore.
        {
          find: '@/lib/nativeAuthSessionRecover',
          replacement: isNative
            ? path.resolve(__dirname, './src/lib/nativeAuthSessionRecover.native.ts')
            : path.resolve(__dirname, './src/lib/nativeAuthSessionRecover.ts'),
        },
        // Exact `@/lib/nativeOfflineMembership` must win over the general `@` prefix.
        // Web → no-op; native → Preferences snapshot for offline Worker shell.
        {
          find: '@/lib/nativeOfflineMembership',
          replacement: isNative
            ? path.resolve(__dirname, './src/lib/nativeOfflineMembership.native.ts')
            : path.resolve(__dirname, './src/lib/nativeOfflineMembership.ts'),
        },
        // Exact `@/lib/workerOfflineBootstrap/storage` must win over the general `@` prefix.
        // Web/PWA → IndexedDB; native → Capacitor Preferences.
        {
          find: '@/lib/workerOfflineBootstrap/storage',
          replacement: isNative
            ? path.resolve(
                __dirname,
                './src/lib/workerOfflineBootstrap/storage.native.ts',
              )
            : path.resolve(__dirname, './src/lib/workerOfflineBootstrap/storage.ts'),
        },
        // Exact `@/App` must win over the general `@` prefix.
        // Web → App.tsx (full Admin + Worker router); native → App.native.tsx (Worker-only).
        {
          find: '@/App',
          replacement: isNative
            ? path.resolve(__dirname, './src/App.native.tsx')
            : path.resolve(__dirname, './src/App.tsx'),
        },
        {
          find: '@',
          replacement: path.resolve(__dirname, './src'),
        },
        // When VitePWA is disabled, `virtual:pwa-register` is not provided — stub it
        // so PwaRuntime still compiles for Capacitor without registering a SW.
        ...(isNative
          ? [
              {
                find: 'virtual:pwa-register',
                replacement: path.resolve(
                  __dirname,
                  './src/lib/pwaRegisterNativeStub.ts',
                ),
              },
            ]
          : []),
      ],
    },
  }
})
