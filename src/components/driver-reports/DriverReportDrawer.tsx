import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { DriverReport } from '@/lib/driverReportTypes'
import {
  driverReportPriorityClassMap,
  driverReportStatusClassMap,
  getDriverReportStatusLabel,
  hasDriverReportAttachment,
} from '@/lib/driverReportUtils'
import { Download, ExternalLink, Loader2, Pencil, X } from 'lucide-react'
import { createPortal } from 'react-dom'

type DriverReportDrawerProps = {
  record: DriverReport | null
  isOpen: boolean
  formatDateTime: (value: string) => string
  isDownloadingPdf?: boolean
  onClose: () => void
  onEdit: (report: DriverReport) => void
  onOpenAttachment: (report: DriverReport) => void
  onDownloadPdf?: () => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-[#113C69] dark:text-slate-100">{value}</dd>
    </div>
  )
}

export function DriverReportDrawer({
  record,
  isOpen,
  formatDateTime,
  isDownloadingPdf = false,
  onClose,
  onEdit,
  onOpenAttachment,
  onDownloadPdf,
}: DriverReportDrawerProps) {
  useBodyScrollLock(isOpen)

  if (!isOpen || !record || typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="flex-1" aria-label="Close drawer" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[#D3E9FC] bg-gradient-to-b from-white to-[#F5FAFF] shadow-[-12px_0_40px_rgba(33,142,231,0.12)] dark:border-white/10 dark:from-slate-900/95 dark:to-slate-900/90 dark:shadow-black/40">
        <div className="flex items-start justify-between border-b border-[#D3E9FC] px-5 py-4 dark:border-white/10">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#218EE7]">
              Driver Report
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#113C69] dark:text-slate-100">{record.title}</h2>
            <p className="mt-0.5 text-sm text-[#5499BF]">{record.reportType}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onDownloadPdf ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDownloadingPdf}
                onClick={onDownloadPdf}
                className="h-8 rounded-[10px] border-[#C5DFFB] px-2.5 text-xs font-semibold text-[#0B68BE]"
                aria-label="Download driver report PDF"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-3.5" aria-hidden="true" />
                )}
                PDF
              </Button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[#5499BF] hover:bg-[#EEF6FF] dark:hover:bg-slate-800/50"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${driverReportStatusClassMap[record.status]}`}
            >
              {getDriverReportStatusLabel(record.status)}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${driverReportPriorityClassMap[record.priority]}`}
            >
              {record.priority}
            </span>
          </div>

          <dl className="mt-5 grid gap-4">
            <DetailRow label="Worker" value={record.workerName ?? '—'} />
            <DetailRow label="Vehicle" value={record.vehicleLabel ?? '—'} />
            <DetailRow label="Description" value={record.description?.trim() || '—'} />
            <DetailRow label="Location / site" value={record.location?.trim() || '—'} />
            <DetailRow
              label="Date/time of issue"
              value={
                record.issueDatetime ? formatDateTime(record.issueDatetime) : '—'
              }
            />
            <DetailRow label="Office notes" value={record.officeNotes?.trim() || '—'} />
            <DetailRow
              label="Created"
              value={formatDateTime(record.createdAt)}
            />
            <DetailRow
              label="Updated"
              value={formatDateTime(record.updatedAt)}
            />
          </dl>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#D3E9FC] px-5 py-4 dark:border-white/10">
          {hasDriverReportAttachment(record) ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenAttachment(record)}
              className="h-10 rounded-[12px] border-[#C5DFFB] text-[#0B68BE]"
            >
              <ExternalLink className="mr-1.5 size-4" />
              Open attachment
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => onEdit(record)}
            className="h-10 rounded-[12px] bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white"
          >
            <Pencil className="mr-1.5 size-4" />
            Edit / update status
          </Button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
