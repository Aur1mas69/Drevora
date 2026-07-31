import { useAuth } from '@/contexts/AuthContext'
import { getOnlineStatus } from '@/lib/networkStatus'
import { readNativeOfflineMembershipSnapshot } from '@/lib/nativeOfflineMembership'
import {
  readWorkerOfflineBootstrap,
  saveWorkerOfflineBootstrap,
  touchBootstrapHeartbeat,
  warmWorkerOfflineBootstrap,
  WORKER_OFFLINE_BOOTSTRAP_FETCH_TIMEOUT_MS,
  WORKER_OFFLINE_BOOTSTRAP_VERSION,
} from '@/lib/workerOfflineBootstrap'
import { fetchDriverByEmail, type Driver } from '@/services/driversService'
import { useCallback, useEffect, useState } from 'react'

export const WORKER_ACCOUNT_ARCHIVED_MESSAGE =
  'Your Worker account has been archived. Contact your company administrator.'

type UseCurrentWorkerResult = {
  worker: Driver | null
  isLoading: boolean
  error: string | null
  /** Re-fetch the Worker profile (e.g. after updating default_vehicle_id). */
  reload: () => void
}

function workerFromBootstrap(
  cacheWorker: Driver,
  email: string,
): { worker: Driver } | { error: string } | null {
  if (cacheWorker.email.trim().toLowerCase() !== email.toLowerCase()) {
    return null
  }
  if (cacheWorker.archivedAt != null) {
    return { error: WORKER_ACCOUNT_ARCHIVED_MESSAGE }
  }
  return { worker: cacheWorker }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('WORKER_PROFILE_FETCH_TIMEOUT'))
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export function useCurrentWorker(): UseCurrentWorkerResult {
  const { session } = useAuth()
  const [worker, setWorker] = useState<Driver | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      const email = session?.user.email?.trim()
      const userId = session?.user.id?.trim()
      if (!email) {
        setWorker(null)
        setError('Sign in to view your worker profile.')
        setIsLoading(false)
        return
      }

      // Start cache read immediately. Native Network often reports "connected"
      // without working internet — hung fetches must not leave Home blank.
      const cachePromise = userId
        ? readWorkerOfflineBootstrap(userId)
        : Promise.resolve(null)

      const applyCache = async (): Promise<boolean> => {
        const cache = await cachePromise
        if (!cache?.worker) return false
        const restored = workerFromBootstrap(cache.worker, email)
        if (restored && 'worker' in restored) {
          if (!cancelled) {
            setWorker(restored.worker)
            setError(null)
          }
          return true
        }
        if (restored && 'error' in restored) {
          if (!cancelled) {
            setWorker(null)
            setError(restored.error)
          }
          return true
        }
        return false
      }

      const online = await getOnlineStatus()
      if (!online) {
        const restored = await applyCache()
        if (!cancelled) {
          if (!restored) {
            setWorker(null)
            setError(null)
          }
          setIsLoading(false)
        }
        return
      }

      // Online (or false-"online"): paint cached Worker shell immediately so Home
      // is not blank while the live profile fetch runs or times out.
      const paintedFromCache = await applyCache()
      if (paintedFromCache && !cancelled) {
        setIsLoading(false)
      }

      try {
        const matchedWorker = await withTimeout(
          fetchDriverByEmail(email),
          WORKER_OFFLINE_BOOTSTRAP_FETCH_TIMEOUT_MS,
        )
        if (cancelled) return

        if (!matchedWorker) {
          // Live says missing — still prefer a prepared offline profile over a blank Home.
          if (await applyCache()) {
            if (!cancelled) setIsLoading(false)
            return
          }
          setWorker(null)
          setError(
            'We could not find a worker profile linked to your account. Please contact your manager.',
          )
          return
        }

        if (matchedWorker.archivedAt != null) {
          setWorker(null)
          setError(WORKER_ACCOUNT_ARCHIVED_MESSAGE)
          return
        }

        setWorker(matchedWorker)

        // Persist Worker shell as soon as live profile loads — do not wait for
        // Dashboard companyId/effect timing (native warm was skipping entirely).
        void (async () => {
          try {
            await touchBootstrapHeartbeat('worker-live')
            const uid = userId || matchedWorker.id
            const snap = uid
              ? await readNativeOfflineMembershipSnapshot(uid)
              : null
            await touchBootstrapHeartbeat(snap ? 'snap-ok' : 'snap-null')
            const companyId = snap?.companyId?.trim()
            if (!uid || !companyId) return
            await saveWorkerOfflineBootstrap({
              version: WORKER_OFFLINE_BOOTSTRAP_VERSION,
              userId: uid,
              companyId,
              savedAt: new Date().toISOString(),
              worker: matchedWorker,
              vehicles: [],
              templateItemsByVehicleType: {},
            })
            await warmWorkerOfflineBootstrap({
              userId: uid,
              companyId,
              worker: matchedWorker,
              vehicles: [],
              skipOnlineCheck: true,
            })
          } catch {
            // Best-effort only.
          }
        })()
      } catch {
        if (cancelled) return
        // Timeout or network failure (including false "online"): restore bootstrap.
        if (await applyCache()) return
        setWorker(null)
        setError('Unable to load your worker profile.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [reloadToken, session?.user.email, session?.user.id])

  return { worker, isLoading, error, reload }
}
