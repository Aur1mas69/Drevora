import { Button } from '@/components/ui/button'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

type WorkerExitVehicleCheckDialogProps = {
  open: boolean
  onContinue: () => void
  onExit: () => void
  /** Defaults preserve Vehicle Check copy; Tyre Check passes its own title/message. */
  title?: string
  message?: string
}

const DEFAULT_TITLE = 'Exit Vehicle Check?'
const DEFAULT_MESSAGE =
  'Your current Vehicle Check is not completed. If you exit, your unsaved progress will be lost.'

/**
 * Confirm leaving an in-progress Worker Vehicle / Tyre Check.
 * Escape / backdrop / Continue keep the Worker in the check with form state intact.
 */
export function WorkerExitVehicleCheckDialog({
  open,
  onContinue,
  onExit,
  title,
  message,
}: WorkerExitVehicleCheckDialogProps) {
  const { t } = useTranslation('worker')
  const resolvedTitle =
    title ?? t('vehicleChecks.exitTitle', { defaultValue: DEFAULT_TITLE })
  const resolvedMessage =
    message ?? t('vehicleChecks.exitBody', { defaultValue: DEFAULT_MESSAGE })
  const exitCheck = t('vehicleChecks.exitCheck', { defaultValue: 'Exit Check' })
  const continueCheck = t('vehicleChecks.continueCheck', {
    defaultValue: 'Continue Check',
  })
  const continueCheckAria = t('vehicleChecks.continueCheckAria', {
    defaultValue: 'Continue check',
  })
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onContinue()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onContinue, open])

  if (!open) return null

  return (
    <div className="worker-theme-surface fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        aria-label={continueCheckAria}
        onClick={onContinue}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-exit-active-check-title"
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)]"
      >
        <div className="border-b border-[color:var(--worker-border)] px-5 py-4">
          <h2
            id="worker-exit-active-check-title"
            className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--worker-text)] sm:text-xl"
          >
            {resolvedTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--worker-text-secondary)]">
            {resolvedMessage}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onExit}
            className="h-12 rounded-2xl border-rose-200 bg-rose-50 px-5 font-semibold text-rose-800 hover:bg-rose-100"
          >
            {exitCheck}
          </Button>
          <Button
            type="button"
            onClick={onContinue}
            className="worker-btn-primary h-12 rounded-2xl px-5 font-semibold"
          >
            {continueCheck}
          </Button>
        </div>
      </section>
    </div>
  )
}
