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

  useEffect(() => {
    if (!import.meta.env.PROD) {
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
