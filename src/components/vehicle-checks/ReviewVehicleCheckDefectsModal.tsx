import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import type {
  SaveVehicleCheckDefectReviewInput,
  VehicleCheck,
  VehicleCheckDefectReviewStatus,
  VehicleCheckItem,
} from '@/lib/vehicleCheckTypes'
import {
  formatDefectReviewStatusLabel,
  formatVehicleCheckItemResultLabel,
  formatVehicleCheckResultLabel,
  getDefectReviewBadgeClass,
  getResultBadgeClass,
} from '@/lib/vehicleCheckUtils'
import { formatInspectionDuration } from '@/lib/vehicleCheckDurationUtils'
import { getVehicleCheckPhotoSignedUrl } from '@/services/vehicleCheckPhotoStorageService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type ReviewVehicleCheckDefectsModalProps = {
  check: VehicleCheck | null
  isOpen: boolean
  isSaving: boolean
  onClose: () => void
  onSave: (input: SaveVehicleCheckDefectReviewInput) => Promise<void>
}

type DecisionStatus = Exclude<VehicleCheckDefectReviewStatus, 'awaiting_review'>

const DECISION_OPTIONS: { value: DecisionStatus; label: string }[] = [
  { value: 'safe_to_operate', label: 'Safe to operate' },
  { value: 'repair_required', label: 'Repair required' },
  { value: 'vehicle_off_road', label: 'Vehicle off road' },
  { value: 'resolved', label: 'Resolved' },
]

function DefectPhoto({ item }: { item: VehicleCheckItem }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!item.photoUrl?.trim()) {
        setUrl(null)
        return
      }
      try {
        const signed = await getVehicleCheckPhotoSignedUrl(item.photoUrl)
        if (!cancelled) setUrl(signed)
      } catch {
        if (!cancelled) setUrl(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [item.photoUrl])

  if (!url) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block overflow-hidden rounded-[12px] border border-amber-200/80 dark:border-amber-500/30"
    >
      <img
        src={url}
        alt={`${item.itemName} defect photo`}
        className="max-h-48 w-full object-contain bg-slate-50 dark:bg-slate-950"
      />
    </a>
  )
}

export function ReviewVehicleCheckDefectsModal({
  check,
  isOpen,
  isSaving,
  onClose,
  onSave,
}: ReviewVehicleCheckDefectsModalProps) {
  const { formatDate } = useCompanySettings()
  const { session } = useAuth()
  const [reviewStatus, setReviewStatus] = useState<DecisionStatus | ''>('')
  const [notes, setNotes] = useState('')
  const [confirmOffRoad, setConfirmOffRoad] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defectItems = useMemo(
    () => (check?.items ?? []).filter((item) => item.result === 'Advisory'),
    [check],
  )

  useEffect(() => {
    if (!isOpen || !check) return
    const current =
      check.defectReviewStatus && check.defectReviewStatus !== 'awaiting_review'
        ? check.defectReviewStatus
        : ''
    setReviewStatus(current)
    setNotes(check.defectReviewNotes ?? '')
    setConfirmOffRoad(false)
    setError(null)
  }, [check, isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen || !check) return null

  const notesRequired =
    reviewStatus === 'repair_required' || reviewStatus === 'vehicle_off_road'

  async function handleSave() {
    setError(null)
    if (!reviewStatus) {
      setError('Select a review decision.')
      return
    }
    if (notesRequired && !notes.trim()) {
      setError('Manager notes are required for this decision.')
      return
    }
    if (reviewStatus === 'vehicle_off_road' && !confirmOffRoad) {
      setError('Confirm that the vehicle should be marked Off Road.')
      return
    }

    try {
      await onSave({
        reviewStatus,
        notes,
        reviewerName: session?.user.email ?? 'Office user',
        confirmVehicleOffRoad: confirmOffRoad,
      })
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save review decision.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-defects-title"
        className="flex max-h-[min(92dvh,52rem)] w-full max-w-lg flex-col overflow-hidden rounded-[20px] border border-[#C5DFFB]/90 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(75,120,220,0.10)] px-4 py-4 dark:border-white/10 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Manager review
            </p>
            <h2
              id="review-defects-title"
              className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100"
            >
              Review defects
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {check.vehicleRegistration}
              {check.fleetNumber ? ` · Fleet ${check.fleetNumber}` : ''}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="size-10 shrink-0 rounded-[12px] p-0"
            aria-label="Close review"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          <section className="grid gap-2 rounded-[14px] border border-[#D7E8FF]/80 bg-[#F8FBFF] p-3 text-sm dark:border-white/10 dark:bg-slate-800/50">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Worker</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {check.workerName}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Inspection date</span>
              <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                {formatDate(check.inspectionDate)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Duration</span>
              <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                {check.durationSeconds != null
                  ? formatInspectionDuration(check.durationSeconds)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Inspection result</span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${getResultBadgeClass(check.overallResult)}`}
              >
                {formatVehicleCheckResultLabel(check.overallResult)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Completion</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {check.status}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Vehicle status</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {check.vehicleStatus ?? '—'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Current review</span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${getDefectReviewBadgeClass(check.defectReviewStatus, check.defectCount)}`}
              >
                {formatDefectReviewStatusLabel(
                  check.defectReviewStatus,
                  check.defectCount,
                )}
              </span>
            </div>
            {check.defectReviewedAt ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Previously reviewed by</span>
                  <span className="text-right font-medium text-slate-800 dark:text-slate-100">
                    {check.defectReviewedByName ?? 'Office user'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Previously reviewed at</span>
                  <span className="text-right tabular-nums text-slate-800 dark:text-slate-100">
                    {new Intl.DateTimeFormat('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    }).format(new Date(check.defectReviewedAt))}
                  </span>
                </div>
              </>
            ) : null}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Reported defects ({defectItems.length})
            </h3>
            <div className="mt-3 space-y-2">
              {defectItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[14px] border border-amber-200 bg-amber-50/90 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-950/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                      {item.itemName}
                    </p>
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700/50">
                      {formatVehicleCheckItemResultLabel(item.result)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/70">
                    {item.category}
                  </p>
                  {item.comment ? (
                    <p className="mt-2 text-sm leading-relaxed text-amber-950/90 dark:text-amber-50/90">
                      {item.comment}
                    </p>
                  ) : null}
                  <DefectPhoto item={item} />
                </div>
              ))}
            </div>
          </section>

          {check.notes?.trim() ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Overall inspection notes
              </h3>
              <p className="mt-2 rounded-[12px] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                {check.notes}
              </p>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Operational decision
            </h3>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Review status
              </span>
              <select
                value={reviewStatus}
                onChange={(event) => {
                  setReviewStatus(event.target.value as DecisionStatus | '')
                  setConfirmOffRoad(false)
                }}
                disabled={isSaving}
                className="h-11 w-full rounded-[12px] border border-[#C5DFFB] bg-white px-3 text-sm font-medium text-[#113C69] outline-none focus:border-[#218EE7] focus:ring-2 focus:ring-[#89CFF0]/30 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Select decision</option>
                {DECISION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Manager notes{notesRequired ? ' *' : ''}
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={isSaving}
                rows={3}
                placeholder={
                  notesRequired
                    ? 'Required for this decision'
                    : 'Optional operational notes'
                }
                className="w-full rounded-[12px] border border-[#C5DFFB] bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#218EE7] focus:ring-2 focus:ring-[#89CFF0]/30 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            {reviewStatus === 'vehicle_off_road' ? (
              <label className="flex items-start gap-3 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-950 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-100">
                <input
                  type="checkbox"
                  checked={confirmOffRoad}
                  onChange={(event) => setConfirmOffRoad(event.target.checked)}
                  disabled={isSaving}
                  className="mt-1 size-4 rounded border-rose-300"
                />
                <span>
                  Confirm: set this vehicle to <strong>Off Road</strong>. Safe to
                  operate and Repair required will not change vehicle status
                  automatically.
                </span>
              </label>
            ) : null}

            {error ? (
              <p className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-[rgba(75,120,220,0.10)] bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/95 sm:px-5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="h-11 flex-1 rounded-[12px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="h-11 flex-1 rounded-[12px] bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
          >
            {isSaving ? 'Saving…' : 'Save decision'}
          </Button>
        </div>
      </div>
    </div>
  )
}
