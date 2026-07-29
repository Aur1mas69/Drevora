import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { VehicleCheckChecklistForm } from '@/components/vehicle-checks/VehicleCheckChecklistForm'
import type {
  VehicleCheck,
  VehicleCheckItem,
  VehicleCheckListItem,
} from '@/lib/vehicleCheckTypes'
import {
  formatDefectReviewStatusLabel,
  formatVehicleCheckItemResultLabel,
  formatVehicleCheckReference,
  formatVehicleCheckResultLabel,
  getDefectReviewBadgeClass,
  getItemResultBadgeClass,
  getResultBadgeClass,
  getStatusBadgeClass,
  getVehicleCheckCorrectionBadgeClassName,
  isVehicleCheckEditable,
  isVehicleCheckFinal,
  vehicleCheckCorrectionLinkClassName,
  vehicleCheckSemanticBadge,
} from '@/lib/vehicleCheckUtils'
import { formatInspectionDuration } from '@/lib/vehicleCheckDurationUtils'
import {
  formatVehicleCheckAccuracy,
  formatVehicleCheckCoordinate,
  formatVehicleCheckCoordinatePair,
} from '@/lib/vehicleCheckLocation'
import type { VehicleCheckLocationSnapshot } from '@/lib/vehicleCheckTypes'
import {
  collectVehicleCheckDownloadableFiles,
} from '@/lib/export/modules/vehicleChecksExport'
import { getVehicleCheckPhotoSignedUrl } from '@/services/vehicleCheckPhotoStorageService'
import { Check, Copy, Download, Loader2, MapPin, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type VehicleCheckDrawerProps = {
  check: VehicleCheck | null
  isOpen: boolean
  isDownloadingPdf?: boolean
  isDownloadingFiles?: boolean
  corrections?: VehicleCheckListItem[]
  onClose: () => void
  onEdit?: () => void
  onCreateCorrection?: () => void
  onViewCorrection?: (correctionId: string) => void
  onViewOriginal?: (originalCheckId: string) => void
  onDownloadPdf?: () => void
  onDownloadFiles?: () => void
}

function VehicleCheckPhotoThumb({ item }: { item: VehicleCheckItem }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPhoto() {
      if (!item.photoUrl?.trim()) {
        setPhotoUrl(null)
        return
      }

      try {
        const signedUrl = await getVehicleCheckPhotoSignedUrl(item.photoUrl)
        if (!cancelled) setPhotoUrl(signedUrl)
      } catch {
        if (!cancelled) setPhotoUrl(null)
      }
    }

    void loadPhoto()

    return () => {
      cancelled = true
    }
  }, [item.photoUrl])

  if (!photoUrl) return null

  return (
    <a
      href={photoUrl}
      target="_blank"
      rel="noreferrer"
      className="overflow-hidden rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-800/60"
    >
      <img
        src={photoUrl}
        alt={`${item.itemName} defect`}
        className="h-28 w-full object-cover"
      />
      <span className="block truncate px-2 py-1.5 text-xs font-medium text-slate-600">
        {item.itemName}
      </span>
    </a>
  )
}

function CopyCoordinatesButton({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const [copied, setCopied] = useState(false)
  const pair = formatVehicleCheckCoordinatePair(latitude, longitude)
  if (!pair) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pair!)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied/unavailable — this is an optional convenience only.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
      aria-label="Copy coordinates"
    >
      {copied ? (
        <Check className="size-3" aria-hidden="true" />
      ) : (
        <Copy className="size-3" aria-hidden="true" />
      )}
      {copied ? 'Copied' : 'Copy coordinates'}
    </button>
  )
}

function VehicleCheckLocationSubsection({
  title,
  location,
  unavailableLabel,
  formatDateTime,
}: {
  title: string
  location: VehicleCheckLocationSnapshot
  unavailableLabel: string
  formatDateTime: (iso: string) => string
}) {
  const hasLocation = location.latitude != null && location.longitude != null

  return (
    <div className="rounded-[10px] bg-[#F8FBFF] px-3 py-2.5 dark:bg-slate-800/60">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {title}
        </p>
        {hasLocation ? (
          <CopyCoordinatesButton latitude={location.latitude} longitude={location.longitude} />
        ) : null}
      </div>
      {hasLocation ? (
        <dl className="mt-1.5 space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Latitude</dt>
            <dd className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
              {formatVehicleCheckCoordinate(location.latitude)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Longitude</dt>
            <dd className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
              {formatVehicleCheckCoordinate(location.longitude)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Accuracy</dt>
            <dd className="text-right text-slate-700 dark:text-slate-200">
              {formatVehicleCheckAccuracy(location.accuracy)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Recorded</dt>
            <dd className="text-right tabular-nums text-slate-700 dark:text-slate-200">
              {location.locationAt ? formatDateTime(location.locationAt) : '—'}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-1 text-sm text-slate-500">{unavailableLabel}</p>
      )}
    </div>
  )
}

export function VehicleCheckDrawer({
  check,
  isOpen,
  isDownloadingPdf = false,
  isDownloadingFiles = false,
  corrections = [],
  onClose,
  onEdit,
  onCreateCorrection,
  onViewCorrection,
  onViewOriginal,
  onDownloadPdf,
  onDownloadFiles,
}: VehicleCheckDrawerProps) {
  const { formatDate, formatDateTime } = useCompanySettings()

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDownloadingPdf) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDownloadingPdf, onClose])

  if (!isOpen || !check) return null

  const editable = isVehicleCheckEditable(check)
  const isFinal = isVehicleCheckFinal(check)
  const isCorrection = Boolean(check.originalCheckId)

  const checklistItems = check.items.map((item) => ({
    category: item.category,
    itemName: item.itemName,
    result: item.result,
    comment: item.comment ?? '',
    templateItem: item.templateItem,
    description: item.description,
    allowNotes: item.allowNotes,
    allowPhoto: item.allowPhoto,
    failOnDefect: item.failOnDefect,
  }))
  const passedItems = check.items.filter((item) => item.result === 'Pass')
  const naItems = check.items.filter((item) => item.result === 'Fail')
  const defectItems = check.items.filter((item) => item.result === 'Advisory')
  const photoItems = check.items.filter(
    (item) => item.photoUrl && item.result === 'Advisory',
  )
  const downloadableFiles = collectVehicleCheckDownloadableFiles(check)
  const downloadFilesLabel =
    downloadableFiles.length > 1 ? 'Download files (.zip)' : 'Download file'
  const submittedAt = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(check.createdAt))

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        aria-label="Close inspection drawer"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-[0_0_40px_rgba(15,23,42,0.18)] dark:bg-slate-900/95 dark:shadow-black/40">
        <div className="border-b border-[rgba(75,120,220,0.10)] px-5 py-4 dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {isCorrection ? 'Correction' : 'Vehicle Inspection'}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">
                {check.vehicleRegistration}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {check.fleetNumber ? `Fleet ${check.fleetNumber} · ` : ''}
                {check.workerName}
              </p>
              {isFinal ? (
                <p
                  className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${vehicleCheckSemanticBadge.neutral}`}
                >
                  Completed — read only
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onDownloadFiles && downloadableFiles.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDownloadingFiles}
                  onClick={onDownloadFiles}
                  className="h-8 rounded-[10px] px-2.5 text-xs font-semibold"
                  aria-label={downloadFilesLabel}
                >
                  {isDownloadingFiles ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="size-3.5" aria-hidden="true" />
                  )}
                  {downloadableFiles.length > 1 ? 'Files' : 'File'}
                </Button>
              ) : null}
              {onDownloadPdf ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDownloadingPdf}
                  onClick={onDownloadPdf}
                  className="h-8 rounded-[10px] px-2.5 text-xs font-semibold"
                  aria-label="Download vehicle check PDF"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="size-3.5" aria-hidden="true" />
                  )}
                  PDF
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 rounded-[10px] p-0 text-slate-500"
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isCorrection && check.originalCheckId ? (
            <section className="rounded-[12px] border border-violet-200 bg-violet-50/70 px-3 py-3 dark:border-violet-900/50 dark:bg-violet-950/30">
              <p className={getVehicleCheckCorrectionBadgeClassName()}>↳ Correction</p>
              <p className="mt-2 text-sm font-semibold text-violet-900 dark:text-violet-200">
                Correction of Vehicle Check{' '}
                {formatVehicleCheckReference(check.originalCheckId)}
              </p>
              {check.correctionReason ? (
                <p className="mt-1 text-sm text-violet-800/80 dark:text-violet-200/80">
                  {check.correctionReason}
                </p>
              ) : null}
              {onViewOriginal ? (
                <button
                  type="button"
                  onClick={() => onViewOriginal(check.originalCheckId!)}
                  className={`mt-2 text-sm font-semibold ${vehicleCheckCorrectionLinkClassName}`}
                  aria-label="Open original vehicle check"
                >
                  View original inspection
                </button>
              ) : null}
            </section>
          ) : null}

          {!isCorrection && corrections.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Corrections
              </h3>
              <ul className="mt-3 space-y-2">
                {corrections.map((correction) => (
                  <li
                    key={correction.id}
                    className="rounded-[12px] border border-[rgba(75,120,220,0.12)] px-3 py-2 dark:border-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#2A376F] dark:text-slate-100">
                          {formatVehicleCheckReference(correction.id)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {correction.status} ·{' '}
                          {formatDate(correction.createdAt.slice(0, 10))}
                        </p>
                        {correction.correctionReason ? (
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {correction.correctionReason}
                          </p>
                        ) : null}
                      </div>
                      {onViewCorrection ? (
                        <button
                          type="button"
                          onClick={() => onViewCorrection(correction.id)}
                          className="shrink-0 text-sm font-semibold text-[#2563EB] hover:underline"
                        >
                          View
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Summary
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Inspection date</dt>
                <dd className="font-medium tabular-nums text-[#2A376F] dark:text-slate-100">
                  {formatDate(check.inspectionDate)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Mileage</dt>
                <dd className="font-medium tabular-nums text-slate-700">
                  {check.odometer != null ? check.odometer.toLocaleString() : '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Inspection result</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getResultBadgeClass(check.overallResult)}`}
                  >
                    {formatVehicleCheckResultLabel(check.overallResult)}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Completion</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(check.status)}`}
                  >
                    {check.status}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Manager review</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getDefectReviewBadgeClass(check.defectReviewStatus, check.defectCount)}`}
                  >
                    {formatDefectReviewStatusLabel(
                      check.defectReviewStatus,
                      check.defectCount,
                    )}
                  </span>
                </dd>
              </div>
              {check.defectReviewedAt ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Reviewed by</dt>
                    <dd className="text-right text-slate-700 dark:text-slate-200">
                      {check.defectReviewedByName ?? 'Office user'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Reviewed at</dt>
                    <dd className="text-right tabular-nums text-slate-700 dark:text-slate-200">
                      {new Intl.DateTimeFormat('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      }).format(new Date(check.defectReviewedAt))}
                    </dd>
                  </div>
                </>
              ) : null}
              {check.defectReviewNotes?.trim() ? (
                <div>
                  <dt className="text-slate-500">Manager notes</dt>
                  <dd className="mt-1 rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                    {check.defectReviewNotes}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Submitted</dt>
                <dd className="text-right text-slate-700">{submittedAt}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Checklist summary</dt>
                <dd className="text-right text-slate-700">
                  {passedItems.length} OK · {defectItems.length} defect
                  {defectItems.length === 1 ? '' : 's'} · {naItems.length} N/A
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Duration</dt>
                <dd className="text-right tabular-nums text-slate-700">
                  {check.durationSeconds != null
                    ? formatInspectionDuration(check.durationSeconds)
                    : 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Overall notes</dt>
                <dd className="mt-1 rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-slate-700">
                  {check.notes?.trim() || 'No notes'}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              <MapPin className="size-3.5" aria-hidden="true" />
              Check location
            </h3>
            {check.startedLocation.latitude == null && check.completedLocation.latitude == null ? (
              <p className="mt-3 rounded-[10px] bg-[#F8FBFF] px-3 py-2.5 text-sm text-slate-500 dark:bg-slate-800/60">
                Location was not available for this Vehicle Check.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <VehicleCheckLocationSubsection
                  title="Started"
                  location={check.startedLocation}
                  unavailableLabel="Start location unavailable"
                  formatDateTime={formatDateTime}
                />
                <VehicleCheckLocationSubsection
                  title="Completed"
                  location={check.completedLocation}
                  unavailableLabel="Completion location unavailable"
                  formatDateTime={formatDateTime}
                />
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Defects
            </h3>
            <div className="mt-3 space-y-2">
              {defectItems.length === 0 ? (
                <div className="rounded-[12px] border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  No defects
                </div>
              ) : (
                defectItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-amber-950">{item.itemName}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getItemResultBadgeClass(item.result)}`}
                      >
                        {formatVehicleCheckItemResultLabel(item.result)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-800/80">{item.category}</p>
                    {item.comment ? (
                      <p className="mt-2 text-sm text-amber-950/80">{item.comment}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          {photoItems.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Photos
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {photoItems.map((item) => (
                  <VehicleCheckPhotoThumb key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Checklist
            </h3>
            <div className="mt-3">
              <VehicleCheckChecklistForm
                items={checklistItems}
                onChange={() => undefined}
                readOnly
              />
            </div>
          </section>
        </div>

        {editable && onEdit ? (
          <div className="border-t border-[rgba(75,120,220,0.10)] px-5 py-4 dark:border-white/10">
            <Button
              type="button"
              onClick={onEdit}
              className="h-10 w-full rounded-[12px] bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Edit inspection
            </Button>
          </div>
        ) : null}

        {isFinal && onCreateCorrection ? (
          <div className="border-t border-[rgba(75,120,220,0.10)] px-5 py-4 dark:border-white/10">
            <Button
              type="button"
              onClick={onCreateCorrection}
              className="h-10 w-full rounded-[12px] bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Create Correction
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
