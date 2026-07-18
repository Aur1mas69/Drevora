import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

export function PwaOfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  )

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
    }

    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))] motion-reduce:transition-none"
    >
      <div className="pointer-events-auto flex max-w-lg items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/95 px-3 py-2.5 text-sm text-amber-950 shadow-lg shadow-amber-900/10 backdrop-blur-md dark:border-amber-500/30 dark:bg-amber-950/95 dark:text-amber-50 dark:shadow-black/40">
        <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 leading-snug">
          You’re offline. Live DREVORA data is unavailable.
        </p>
      </div>
    </div>
  )
}
