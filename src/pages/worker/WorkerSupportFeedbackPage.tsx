import { StarRatingInput } from '@/components/worker/help/StarRatingInput'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { Button } from '@/components/ui/button'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import {
  FEEDBACK_TYPES,
  type FeedbackType,
  validateFeedbackComment,
} from '@/lib/supportRequestTypes'
import {
  createFeedbackSupportRequest,
  SupportRequestsServiceError,
} from '@/services/supportRequestsService'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const fieldClass =
  'mt-1.5 w-full rounded-2xl border border-[#BFE3F5] bg-white px-3 py-3 text-sm text-[color:var(--worker-text)] outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20 dark:border-slate-600 dark:bg-slate-900/50'

export default function WorkerSupportFeedbackPage() {
  const location = useLocation()
  const { worker, isLoading: workerLoading } = useCurrentWorker()
  const [isOnline, setIsOnline] = useState(true)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('Suggestion')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successRef, setSuccessRef] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

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
    const commentError = validateFeedbackComment(comment, rating)
    if (commentError) {
      setError(commentError)
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      const created = await createFeedbackSupportRequest({
        driverId: worker.id,
        feedbackType,
        rating,
        comment,
        route: location.pathname,
      })
      setSuccessRef(created.reference)
      setSuccessId(created.id)
      setComment('')
      setRating(0)
      setFeedbackType('Suggestion')
    } catch (submitError) {
      setError(
        submitError instanceof SupportRequestsServiceError
          ? submitError.message
          : 'Unable to send your feedback. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successRef && successId) {
    return (
      <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
        <WorkerSettingsBackLink to="/worker/settings/help" label="Help & Support" />
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-5">
          <h1 className="text-xl font-semibold text-emerald-900">Feedback sent</h1>
          <p className="mt-2 text-sm text-emerald-800">
            Reference <span className="font-semibold">{successRef}</span>
          </p>
          <Link
            to={`/worker/settings/help/requests/${successId}`}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-[#2F80ED] px-4 text-sm font-semibold text-white"
          >
            View request
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-2">
        <WorkerSettingsBackLink to="/worker/settings/help" label="Help & Support" />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          Send Feedback
        </h1>
        <p className="text-sm text-[color:var(--worker-text-secondary)]">
          Share suggestions and ideas with DREVORA Support.
        </p>
      </header>

      {!isOnline ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          You’re offline. Reconnect to send this report.
        </p>
      ) : null}

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label htmlFor="feedback-type" className="text-sm font-semibold text-[color:var(--worker-text)]">
            Feedback type
          </label>
          <select
            id="feedback-type"
            className={fieldClass}
            value={feedbackType}
            disabled={isSubmitting}
            onChange={(event) => setFeedbackType(event.target.value as FeedbackType)}
          >
            {FEEDBACK_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <StarRatingInput
          value={rating}
          onChange={setRating}
          disabled={isSubmitting}
          label="Rating"
        />

        <div>
          <label htmlFor="feedback-comment" className="text-sm font-semibold text-[color:var(--worker-text)]">
            Comment
            {rating === 1 || rating === 2 ? (
              <span className="font-normal text-rose-600"> (required for 1–2 stars)</span>
            ) : (
              <span className="font-normal text-[color:var(--worker-text-muted)]"> (optional for 3–5)</span>
            )}
          </label>
          <textarea
            id="feedback-comment"
            className={`${fieldClass} min-h-[7rem] resize-y`}
            value={comment}
            maxLength={2000}
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
          {isSubmitting ? 'Sending…' : 'Send feedback'}
        </Button>
      </form>
    </div>
  )
}
