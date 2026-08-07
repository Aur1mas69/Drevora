import { TyreCheckDiagram } from '@/components/vehicle-checks/TyreCheckDiagram'
import {
  formatTyrePressureDisplay,
  summarizeAxleLayoutFromMeasurements,
  tyreStatusLabel,
  tyreTreadVisualClasses,
  type TyreCheckCorrectionRecord,
  type TyreMeasurement,
  type TyrePressureUnit,
} from '@/lib/tyreCheckTypes'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

export type TyreCheckAdminReportProps = {
  id: string
  vehicleLabel: string
  trailerLabel?: string | null
  checkedBy: string
  completedLabel: string
  summaryLabel: string
  notes?: string | null
  measurements: TyreMeasurement[]
  pressureUnit?: TyrePressureUnit | null
  corrections?: TyreCheckCorrectionRecord[]
  /** Force light pastel styling for PDF capture. */
  forPdfCapture?: boolean
  className?: string
}

function formatMm(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)} mm`
}

/** Shared Admin Tyre Check report body (detail modal + PDF capture). */
export function TyreCheckAdminReport({
  id,
  vehicleLabel,
  trailerLabel,
  checkedBy,
  completedLabel,
  summaryLabel,
  notes,
  measurements,
  pressureUnit = null,
  corrections = [],
  forPdfCapture = false,
  className,
}: TyreCheckAdminReportProps) {
  const axleLayout = summarizeAxleLayoutFromMeasurements(measurements)
  const vehicleTitle = trailerLabel
    ? `${vehicleLabel} · top view`
    : `${vehicleLabel} · top view`
  const hasCorrections = corrections.length > 0

  return (
    <div
      data-tyre-check-report={id}
      className={cn(
        'space-y-4 bg-white',
        forPdfCapture ? 'p-1 text-[#0B1F3A]' : 'dark:bg-transparent',
        className,
      )}
    >
      <dl
        data-pdf-block="summary"
        className={cn(
          'grid grid-cols-2 gap-3 rounded-[14px] bg-[#F8FBFF] p-3 text-sm sm:grid-cols-4',
          !forPdfCapture && 'dark:bg-slate-800/60',
        )}
      >
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
            Vehicle
          </dt>
          <dd
            className={cn(
              'mt-0.5 font-semibold text-[#2A376F]',
              !forPdfCapture && 'dark:text-slate-100',
            )}
          >
            {vehicleLabel}
            {trailerLabel ? ` + ${trailerLabel}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
            Worker
          </dt>
          <dd
            className={cn(
              'mt-0.5 font-semibold text-[#2A376F]',
              !forPdfCapture && 'dark:text-slate-100',
            )}
          >
            {checkedBy}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
            Completed
          </dt>
          <dd
            className={cn(
              'mt-0.5 font-semibold text-[#2A376F]',
              !forPdfCapture && 'dark:text-slate-100',
            )}
          >
            {completedLabel}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
            Axle layout
          </dt>
          <dd
            className={cn(
              'mt-0.5 font-semibold text-[#2A376F]',
              !forPdfCapture && 'dark:text-slate-100',
            )}
          >
            {axleLayout}
          </dd>
        </div>
      </dl>

      {hasCorrections ? (
        <div
          data-pdf-block="corrected-badge"
          className={cn(
            'inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200',
            !forPdfCapture && 'dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50',
          )}
        >
          Corrected · {corrections.length}{' '}
          {corrections.length === 1 ? 'correction' : 'corrections'} on record
        </div>
      ) : null}

      <p
        data-pdf-block="summary-label"
        className={cn(
          'text-sm text-slate-600',
          !forPdfCapture && 'dark:text-slate-400',
        )}
      >
        {summaryLabel}
        {pressureUnit ? ` · Pressure unit ${pressureUnit.toUpperCase()}` : ''}
      </p>
      {notes?.trim() ? (
        <p
          data-pdf-block="notes"
          className={cn(
            'rounded-[12px] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600',
            !forPdfCapture && 'dark:bg-slate-800/60 dark:text-slate-400',
          )}
        >
          {notes}
        </p>
      ) : null}

      <TyreCheckDiagram
        measurements={measurements}
        selectedTyreId={null}
        onSelectTyre={() => {}}
        palette="pastel"
        vehicleUnitTitle={vehicleTitle}
      />

      <div className="space-y-2">
        <h4
          data-pdf-block="detail-heading"
          className={cn(
            'text-sm font-semibold text-[#2A376F]',
            !forPdfCapture && 'dark:text-slate-100',
          )}
        >
          Per-tyre detail
        </h4>
        {measurements.map((tyre) => (
          <div
            key={tyre.id}
            data-pdf-block="tyre-row"
            className={cn(
              'flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#D3E9FC] px-3 py-2 text-sm',
              !forPdfCapture && 'dark:border-white/10',
            )}
          >
            <p
              className={cn(
                'font-semibold text-[#2A376F]',
                !forPdfCapture && 'dark:text-slate-100',
              )}
            >
              {tyre.axleLabel} · {tyre.position}
            </p>
            <div
              className={cn(
                'flex flex-wrap items-center gap-2 text-slate-600',
                !forPdfCapture && 'dark:text-slate-400',
              )}
            >
              <span>
                {tyre.treadDepthMm == null
                  ? '—'
                  : `${tyre.treadDepthMm.toFixed(1)} mm`}
              </span>
              <span>
                Pressure:{' '}
                {formatTyrePressureDisplay(tyre.pressureValue, pressureUnit)}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  tyreTreadVisualClasses(tyre.treadDepthMm, {
                    dirty: Boolean(tyre.isDirty) || tyre.status === 'dirty',
                    palette: 'pastel',
                  }).badge,
                )}
              >
                {tyreStatusLabel(tyre.status)}
              </span>
              {tyre.hasDefect ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700',
                    !forPdfCapture && 'dark:bg-rose-950/40 dark:text-rose-300',
                  )}
                >
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  Defect
                </span>
              ) : null}
              {tyre.defectNotes || tyre.notes ? (
                <span
                  className={cn(
                    'text-xs text-slate-500',
                    !forPdfCapture && 'dark:text-slate-400',
                  )}
                >
                  {tyre.defectNotes || tyre.notes}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {hasCorrections ? (
        <div className="space-y-3" data-pdf-block="correction-history">
          <h4
            className={cn(
              'text-sm font-semibold text-[#2A376F]',
              !forPdfCapture && 'dark:text-slate-100',
            )}
          >
            Correction history
          </h4>
          {corrections.map((correction) => (
            <div
              key={correction.id}
              className={cn(
                'rounded-[12px] border border-amber-200 bg-amber-50/70 px-3 py-3 text-sm',
                !forPdfCapture &&
                  'dark:border-amber-800/40 dark:bg-amber-950/20',
              )}
            >
              <p
                className={cn(
                  'font-semibold text-amber-950',
                  !forPdfCapture && 'dark:text-amber-100',
                )}
              >
                {new Date(correction.correctedAt).toLocaleString()} · Reason:{' '}
                {correction.correctionReason}
              </p>
              <p
                className={cn(
                  'mt-1 text-xs text-amber-900/80',
                  !forPdfCapture && 'dark:text-amber-200/80',
                )}
              >
                Corrected by {correction.correctedBy}
                {correction.oldPressureUnit !== correction.newPressureUnit
                  ? ` · Unit ${correction.oldPressureUnit ?? '—'} → ${correction.newPressureUnit ?? '—'}`
                  : ''}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {correction.changes.map((change) => {
                  const axleLabel =
                    change.unit === 'trailer'
                      ? `Trailer Axle ${change.axleNumber}`
                      : change.axleNumber === 1
                        ? 'Steer Axle 1'
                        : `Drive Axle ${change.axleNumber}`
                  return (
                    <li key={change.id}>
                      {axleLabel} · {change.position}: tread{' '}
                      {formatMm(change.oldTreadDepthMm)} →{' '}
                      {formatMm(change.newTreadDepthMm)}; pressure{' '}
                      {formatTyrePressureDisplay(
                        change.oldPressureValue,
                        correction.oldPressureUnit ?? pressureUnit,
                      )}{' '}
                      →{' '}
                      {formatTyrePressureDisplay(
                        change.newPressureValue,
                        correction.newPressureUnit ?? pressureUnit,
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
