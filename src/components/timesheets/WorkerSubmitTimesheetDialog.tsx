import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type WorkerSubmitTimesheetDialogProps = {
  open: boolean
  weekNumber: number | string
  weekRangeLabel: string
  totalHoursLabel: string
  statusLabel: string
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Worker confirmation before week submission.
 * Opening / Cancel / Escape / outside click never submit — only Confirm does.
 * Confirmation checkbox resets every time the modal opens.
 */
export function WorkerSubmitTimesheetDialog({
  open,
  weekNumber,
  weekRangeLabel,
  totalHoursLabel,
  statusLabel,
  isSubmitting,
  onCancel,
  onConfirm,
}: WorkerSubmitTimesheetDialogProps) {
  const { t } = useTranslation('worker')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (open) {
      setConfirmed(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSubmitting, onCancel, open])

  if (!open) return null

  const canSubmit = confirmed && !isSubmitting

  return (
    <div className="worker-theme-surface fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        aria-label={t('timesheets.dismissSubmit', {
          defaultValue: 'Dismiss submit confirmation',
        })}
        disabled={isSubmitting}
        onClick={() => {
          if (!isSubmitting) onCancel()
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-submit-timesheet-title"
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)]"
      >
        <div className="border-b border-[color:var(--worker-border)] px-5 py-4">
          <h2
            id="worker-submit-timesheet-title"
            className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--worker-text)] sm:text-xl"
          >
            {t('timesheets.submitConfirmTitle', { defaultValue: 'Submit Week?' })}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--worker-text-secondary)]">
            {t('timesheets.submitConfirmBody', {
              defaultValue: 'Please check all days before submitting this week.',
            })}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <dl className="space-y-3 rounded-[14px] border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 font-medium text-[color:var(--worker-text-secondary)]">
                {t('timesheets.week', { defaultValue: 'Week' })}
              </dt>
              <dd className="text-right font-semibold text-[color:var(--worker-text)]">
                {t('timesheets.weekNumber', {
                  weekNumber,
                  defaultValue: `Week ${weekNumber}`,
                })}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 font-medium text-[color:var(--worker-text-secondary)]">
                {t('timesheets.dates', { defaultValue: 'Dates' })}
              </dt>
              <dd className="text-right font-semibold text-[color:var(--worker-text)]">
                {weekRangeLabel}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 font-medium text-[color:var(--worker-text-secondary)]">
                {t('timesheets.totalHours', { defaultValue: 'Total Hours' })}
              </dt>
              <dd className="text-right font-semibold tabular-nums text-[color:var(--worker-text)]">
                {totalHoursLabel}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 font-medium text-[color:var(--worker-text-secondary)]">
                {t('timesheets.statusLabel', { defaultValue: 'Status' })}
              </dt>
              <dd className="text-right font-semibold text-[color:var(--worker-text)]">
                {statusLabel}
              </dd>
            </div>
          </dl>

          <p className="text-sm leading-6 text-[color:var(--worker-text-secondary)]">
            {t('timesheets.submitSendsToOffice', {
              defaultValue: 'Submitting sends this Timesheet to the office for review.',
            })}
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] px-4 py-3">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={isSubmitting}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 size-4 shrink-0 rounded border-[color:var(--worker-border)] accent-[#0B68BE]"
              aria-required="true"
            />
            <span className="text-sm leading-6 text-[color:var(--worker-text)]">
              {t('timesheets.submitCheckbox', {
                defaultValue:
                  'I confirm that I have reviewed this Timesheet and that all hours shown are complete and correct.',
              })}
            </span>
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[color:var(--worker-border)] px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
            className="h-12 rounded-2xl border-[color:var(--worker-border)] bg-[color:var(--worker-input)] px-5 font-semibold text-[color:var(--worker-text)] hover:bg-[color:var(--worker-elevated)]"
          >
            {t('timesheets.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={onConfirm}
            className="worker-btn-primary h-12 rounded-2xl px-5 font-semibold disabled:opacity-70"
          >
            {isSubmitting
              ? t('timesheets.submitting', { defaultValue: 'Submitting…' })
              : t('timesheets.submitWeek', { defaultValue: 'Submit Week' })}
          </Button>
        </div>
      </section>
    </div>
  )
}
