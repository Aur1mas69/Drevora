import { StarRatingInput } from '@/components/worker/help/StarRatingInput'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { Button } from '@/components/ui/button'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import { getGooglePlayStoreUrl } from '@/lib/storeLinks'
import {
  submitAppRating,
  SupportRequestsServiceError,
} from '@/services/supportRequestsService'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const fieldClass =
  'mt-1.5 w-full rounded-2xl border border-[#BFE3F5] bg-white px-3 py-3 text-sm text-[color:var(--worker-text)] outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20 dark:border-slate-600 dark:bg-slate-900/50'

export default function WorkerSupportRatePage() {
  const location = useLocation()
  const { worker, isLoading: workerLoading } = useCurrentWorker()
  const [isOnline, setIsOnline] = useState(true)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successRef, setSuccessRef] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const playUrl = getGooglePlayStoreUrl()
  const isAndroid = import.meta.env.MODE === 'native'
  const showPlayCta = isAndroid && Boolean(playUrl)

  useEffect(() => {
    let cancelled = false
    let removeListener: (() => Promise<void>) | null = null
    void getOnlineStatus().then((online) => {
      if (!cancelled) setIsOnline(online)
    })
    void addOnlineStatusListener((online) => {
      if (!cancelled) setIsOnline(online)
    }).then((handle) => {
      if (cancelled) {
        void handle.remove()
        return
      }
      removeListener = () => handle.remove()
    })
    return () => {
      cancelled = true
      if (removeListener) void removeListener()
    }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (isSubmitting || !worker) return
    if (!isOnline) {
      setError('You’re offline. Reconnect to send this report.')
      return
    }
    if (rating < 1) {
      setError('Please choose a rating from 1 to 5 stars.')
      return
    }
    if (comment.trim().length > 500) {
      setError('Comment must be 500 characters or fewer.')
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      const created = await submitAppRating({
        driverId: worker.id,
        rating,
        comment,
        route: location.pathname,
      })
      setSuccessRef(created.reference)
      setSuccessId(created.id)
      setComment('')
      setRating(0)
    } catch (submitError) {
      setError(
        submitError instanceof SupportRequestsServiceError
          ? submitError.message
          : 'Unable to save your rating. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function openPlayStore() {
    if (!playUrl) return
    window.open(playUrl, '_blank', 'noopener,noreferrer')
  }

  if (successRef && successId) {
    return (
      <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
        <WorkerSettingsBackLink to="/worker/settings/help" label="Help & Support" />
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-5 space-y-3">
          <h1 className="text-xl font-semibold text-emerald-900">Thanks for rating DREVORA</h1>
          <p className="text-sm text-emerald-800">
            Reference <span className="font-semibold">{successRef}</span>
          </p>
          <Link
            to={`/worker/settings/help/requests/${successId}`}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#2F80ED] px-4 text-sm font-semibold text-white"
          >
            View request
          </Link>
          {showPlayCta ? (
            <button
              type="button"
              onClick={openPlayStore}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#89CFF0] bg-white text-sm font-semibold text-[#0B68BE]"
            >
              Rate on Google Play
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-2">
        <WorkerSettingsBackLink to="/worker/settings/help" label="Help & Support" />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          Rate DREVORA
        </h1>
        <p className="text-sm text-[color:var(--worker-text-secondary)]">
          Your rating is stored in DREVORA Support to help improve the app.
        </p>
      </header>

      {!isOnline ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          You’re offline. Reconnect to send this report.
        </p>
      ) : null}

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <StarRatingInput
          value={rating}
          onChange={setRating}
          disabled={isSubmitting}
          label="Your rating"
        />

        <div>
          <label htmlFor="rate-comment" className="text-sm font-semibold text-[color:var(--worker-text)]">
            Short comment{' '}
            <span className="font-normal text-[color:var(--worker-text-muted)]">(optional)</span>
          </label>
          <textarea
            id="rate-comment"
            className={`${fieldClass} min-h-[5rem] resize-y`}
            value={comment}
            maxLength={500}
            disabled={isSubmitting}
            onChange={(event) => setComment(event.target.value)}
          />
        </div>

        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting || workerLoading || !worker || !isOnline}
          className="h-12 w-full rounded-2xl bg-[#2F80ED] text-base font-semibold hover:bg-[#2569C7]"
        >
          {isSubmitting ? 'Saving…' : 'Submit rating'}
        </Button>
      </form>
    </div>
  )
}
