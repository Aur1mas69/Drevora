import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt'
import { PwaOfflineBanner } from '@/components/pwa/PwaOfflineBanner'
import { PwaUpdatePrompt } from '@/components/pwa/PwaUpdatePrompt'

/**
 * Registers the reviewed production service worker once and hosts
 * install / update / offline UI at the application root.
 */
export function PwaRuntime() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateSWRef = useRef<
    ((reloadPage?: boolean) => Promise<void>) | undefined
  >(undefined)

  // A service worker registered by an earlier web/dev load of this WebView keeps
  // serving its own precache, shadowing every APK update — offline the Worker
  // then runs stale code. Native builds ship no SW, so drop any leftover one.
  useEffect(() => {
    if (import.meta.env.MODE !== 'native') return

    void (async () => {
      if (!('serviceWorker' in navigator)) return

      const registrations = await navigator.serviceWorker
        .getRegistrations()
        .catch(() => [])
      if (registrations.length === 0) return

      await Promise.all(
        registrations.map((registration) =>
          registration.unregister().catch(() => false),
        ),
      )

      if (typeof caches !== 'undefined') {
        const keys = await caches.keys().catch(() => [])
        await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)))
      }

      // Reload once so the page stops being controlled by the removed worker.
      if (navigator.serviceWorker.controller) {
        window.location.reload()
      }
    })()
  }, [])

  useEffect(() => {
    // Capacitor native builds (`vite build --mode native`) must not register a SW.
    if (!import.meta.env.PROD || import.meta.env.MODE === 'native') {
      return
    }

    let updateCheckIntervalId: number | undefined

    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) {
          return
        }

        updateCheckIntervalId = window.setInterval(() => {
          void registration.update().catch(() => {
            // Update checks are best-effort and must not interrupt the UI.
          })
        }, 60 * 60 * 1000)
      },
    })

    return () => {
      if (updateCheckIntervalId !== undefined) {
        window.clearInterval(updateCheckIntervalId)
      }
    }
  }, [])

  return (
    <>
      <PwaOfflineBanner />
      {!needRefresh ? <PwaInstallPrompt /> : null}
      <PwaUpdatePrompt
        open={needRefresh}
        onUpdate={() => {
          void updateSWRef.current?.(true)
        }}
        onLater={() => {
          setNeedRefresh(false)
        }}
      />
    </>
  )
}
