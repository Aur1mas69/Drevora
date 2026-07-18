import { useAuth } from '@/contexts/AuthContext'
import { fetchDriverByEmail, type Driver } from '@/services/driversService'
import { useEffect, useState } from 'react'

type UseCurrentWorkerResult = {
  worker: Driver | null
  isLoading: boolean
  error: string | null
}

export function useCurrentWorker(): UseCurrentWorkerResult {
  const { session } = useAuth()
  const [worker, setWorker] = useState<Driver | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [session?.user.email])

  return { worker, isLoading, error }
}
