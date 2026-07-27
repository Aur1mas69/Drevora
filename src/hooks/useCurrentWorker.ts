import { useAuth } from '@/contexts/AuthContext'
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
      if (!email) {
        setWorker(null)
        setError('Sign in to view your worker profile.')
        setIsLoading(false)
        return
      }

      try {
        const matchedWorker = await fetchDriverByEmail(email)
        if (cancelled) return

        if (!matchedWorker) {
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
      } catch (loadError) {
        if (cancelled) return
        setWorker(null)
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load your worker profile.',
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [reloadToken, session?.user.email])

  return { worker, isLoading, error, reload }
}
