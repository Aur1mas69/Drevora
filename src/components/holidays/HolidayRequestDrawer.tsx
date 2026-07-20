import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { HolidayRequest } from '@/lib/holidayRequestTypes'
import {
  canApproveHolidayRequest,
  canDeleteHolidayRequest,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/holidayRequestUtils'
import { Check, Download, Loader2, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type HolidayRequestDrawerProps = {
  request: HolidayRequest | null
  isOpen: boolean
  isSaving?: boolean
  isDownloadingPdf?: boolean
  onClose: () => void
  onDownloadPdf?: () => void
  onApprove?: (managerNote: string) => Promise<void>
  onReject?: (managerNote: string) => Promise<void>
  onDelete?: () => void
}

export function HolidayRequestDrawer({
  request,
  isOpen,
  isSaving = false,
  isDownloadingPdf = false,
  onClose,
  onDownloadPdf,
  onApprove,
  onReject,
  onDelete,
}: HolidayRequestDrawerProps) {
  const { formatDate, formatDateTime } = useCompanySettings()
  const [managerNote, setManagerNote] = useState('')

  useEffect(() => {
    if (!request) return
    setManagerNote(request.managerNote ?? '')
  }, [request])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen || !request) return null

  const canApprove = canApproveHolidayRequest(request.status)
  const canDelete = canDeleteHolidayRequest(request.status) && Boolean(onDelete)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        aria-label="Close holiday request drawer"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-[0_0_40px_rgba(15,23,42,0.18)] dark:bg-slate-900/95">
        <div className="border-b border-[rgba(75,120,220,0.10)] px-5 py-4 dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Holiday Request
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">
                {request.workerName}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {request.workerRole ?? 'No role assigned'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onDownloadPdf ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving || isDownloadingPdf}
                  onClick={onDownloadPdf}
                  className="h-8 rounded-[10px] px-2.5 text-xs font-semibold"
                  aria-label="Download holiday request PDF"
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
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Request details
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(request.status)}`}
                  >
                    {getStatusLabel(request.status)}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Start date</dt>
                <dd className="font-medium tabular-nums text-[#2A376F] dark:text-slate-100">
                  {formatDate(request.startDate)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">End date</dt>
                <dd className="font-medium tabular-nums text-[#2A376F] dark:text-slate-100">
                  {formatDate(request.endDate)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Calendar days away</dt>
                <dd className="font-semibold tabular-nums text-[#2A376F] dark:text-slate-100">
                  {request.calendarDaysTotal}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Holiday days deducted</dt>
                <dd className="font-semibold tabular-nums text-[#2A376F] dark:text-slate-100">
                  {request.holidayDaysDeducted}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Non-working days excluded</dt>
                <dd className="font-semibold tabular-nums text-[#2A376F] dark:text-slate-100">
                  {request.nonWorkingDaysExcluded}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Reason</dt>
                <dd className="mt-1 rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-slate-700 dark:bg-slate-900/70 dark:text-slate-100">
                  {request.reason?.trim() || 'No reason provided'}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Approval
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Submitted</dt>
                <dd className="text-right text-slate-700">{formatDateTime(request.createdAt)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Last updated</dt>
                <dd className="text-right text-slate-700">{formatDateTime(request.updatedAt)}</dd>
              </div>
              <div>
                <dt className="mb-1.5 text-slate-500">Manager note</dt>
                <dd>
                  {canApprove ? (
                    <textarea
                      value={managerNote}
                      onChange={(event) => setManagerNote(event.target.value)}
                      rows={3}
                      placeholder="Optional note for the worker or audit trail"
                      className="w-full rounded-[10px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:ring-blue-900/40"
                    />
                  ) : (
                    <p className="rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-slate-700 dark:bg-slate-900/70 dark:text-slate-100">
                      {request.managerNote?.trim() || 'No manager note'}
                    </p>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {canApprove || canDelete ? (
          <div className="border-t border-[rgba(75,120,220,0.10)] px-5 py-4 dark:border-white/10">
            {canApprove ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void onApprove?.(managerNote)}
                  className="h-10 flex-1 rounded-[12px] bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Check className="mr-1.5 size-4" />
                  Approve
                </Button>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void onReject?.(managerNote)}
                  className="h-10 flex-1 rounded-[12px] bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  <X className="mr-1.5 size-4" />
                  Decline
                </Button>
              </div>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                disabled={isSaving}
                onClick={onDelete}
                variant="outline"
                className={`h-10 w-full rounded-[12px] border-rose-200 bg-rose-50/70 text-sm font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50 ${canApprove ? 'mt-2' : ''}`}
              >
                <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
                Delete request
              </Button>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  )
}
