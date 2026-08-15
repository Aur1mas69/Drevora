import { SupportMetadataNotice } from '@/components/worker/help/SupportMetadataNotice'
import { SupportScreenshotField } from '@/components/worker/help/SupportScreenshotField'
import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { Button } from '@/components/ui/button'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import {
  BUG_CATEGORIES,
  type BugCategory,
  validateSupportDescription,
  validateSupportSteps,
  validateSupportTitle,
} from '@/lib/supportRequestTypes'
import {
  createBugSupportRequest,
  SupportRequestsServiceError,
} from '@/services/supportRequestsService'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { bugCategoryDisplayLabel } from '@/i18n/workerFinalDisplay'

const fieldClass =
  'mt-1.5 w-full rounded-2xl border border-[#BFE3F5] bg-white px-3 py-3 text-sm text-[color:var(--worker-text)] outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20 dark:border-slate-600 dark:bg-slate-900/50'

export default function WorkerSupportBugPage() {
  const { t } = useTranslation('worker')
  const location = useLocation()
  const { worker, isLoading: workerLoading } = useCurrentWorker()
  const [isOnline, setIsOnline] = useState(true)
  const [category, setCategory] = useState<BugCategory>('Other')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
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
      setSubmitError(
        t('support.offlineSend', {
          defaultValue: 'You’re offline. Reconnect to send this report.',
        }),
      )
      return
    }

    const titleError = validateSupportTitle(title)
    if (titleError) {
      setFieldError(titleError)
      return
    }
    const descriptionError = validateSupportDescription(description)
    if (descriptionError) {
      setFieldError(descriptionError)
      return
    }
    const stepsError = validateSupportSteps(steps)
    if (stepsError) {
      setFieldError(stepsError)
      return
    }

    setFieldError(null)
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const created = await createBugSupportRequest({
        driverId: worker.id,
        category,
        title,
        description,
        stepsToReproduce: steps,
        files,
        route: location.pathname,
      })
      setSuccessRef(created.reference)
      setSuccessId(created.id)
      setTitle('')
      setDescription('')
      setSteps('')
      setFiles([])
      setCategory('Other')
    } catch (error) {
      setSubmitError(
        error instanceof SupportRequestsServiceError
          ? error.message
          : t('support.bugSendFailed', {
              defaultValue: 'Unable to send your bug report. Please try again.',
            }),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successRef && successId) {
    return (
      <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
        <WorkerSettingsBackLink
          to="/worker/settings/help"
          label={t('support.backHelp', { defaultValue: 'Help & Support' })}
        />
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <h1 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
            {t('support.bugSent', { defaultValue: 'Bug report sent' })}
          </h1>
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
            {t('support.reference', {
              ref: successRef,
              defaultValue: 'Reference {{ref}}',
            })}
          </p>
          <Link
            to={`/worker/settings/help/requests/${successId}`}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-[#2F80ED] px-4 text-sm font-semibold text-white"
          >
            {t('support.viewRequest', { defaultValue: 'View request' })}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-2">
        <WorkerSettingsBackLink
          to="/worker/settings/help"
          label={t('support.backHelp', { defaultValue: 'Help & Support' })}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          {t('support.bugTitle', { defaultValue: 'Report a Bug' })}
        </h1>
        <p className="text-sm text-[color:var(--worker-text-secondary)]">
          {t('support.bugIntro', {
            defaultValue:
              'Tell DREVORA about app errors or unexpected behaviour. Work and rota questions should go to Contact Office.',
          })}
        </p>
      </header>

      {!isOnline ? (
        <p
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          {t('support.offlineSend', {
            defaultValue: 'You’re offline. Reconnect to send this report.',
          })}
        </p>
      ) : null}

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <label htmlFor="bug-category" className="text-sm font-semibold text-[color:var(--worker-text)]">
            {t('support.category', { defaultValue: 'Category' })}
          </label>
          <select
            id="bug-category"
            className={fieldClass}
            value={category}
            disabled={isSubmitting || workerLoading}
            onChange={(event) => setCategory(event.target.value as BugCategory)}
          >
            {BUG_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {bugCategoryDisplayLabel(option, t)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bug-title" className="text-sm font-semibold text-[color:var(--worker-text)]">
            {t('support.shortTitle', { defaultValue: 'Short title' })}
          </label>
          <input
            id="bug-title"
            className={fieldClass}
            value={title}
            maxLength={120}
            disabled={isSubmitting}
            onChange={(event) => setTitle(event.target.value)}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="bug-description" className="text-sm font-semibold text-[color:var(--worker-text)]">
            {t('support.description', { defaultValue: 'Description' })}
          </label>
          <textarea
            id="bug-description"
            className={`${fieldClass} min-h-[8rem] resize-y`}
            value={description}
            maxLength={4000}
            disabled={isSubmitting}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="bug-steps" className="text-sm font-semibold text-[color:var(--worker-text)]">
            {t('support.steps', { defaultValue: 'Steps to reproduce' })}{' '}
            <span className="font-normal text-[color:var(--worker-text-muted)]">
              {t('support.optional', { defaultValue: '(optional)' })}
            </span>
          </label>
          <textarea
            id="bug-steps"
            className={`${fieldClass} min-h-[6rem] resize-y`}
            value={steps}
            maxLength={4000}
            disabled={isSubmitting}
            onChange={(event) => setSteps(event.target.value)}
          />
        </div>

        <SupportScreenshotField
          files={files}
          onChange={setFiles}
          error={fileError}
          onError={setFileError}
          disabled={isSubmitting}
        />

        <SupportMetadataNotice />

        {fieldError || submitError ? (
          <p className="text-sm text-rose-600" role="alert">
            {fieldError ?? submitError}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting || workerLoading || !worker || !isOnline}
          className="h-12 w-full rounded-2xl bg-[#2F80ED] text-base font-semibold hover:bg-[#2569C7]"
        >
          {isSubmitting
            ? t('support.sending', { defaultValue: 'Sending…' })
            : t('support.sendBug', { defaultValue: 'Send bug report' })}
        </Button>
      </form>
    </div>
  )
}
