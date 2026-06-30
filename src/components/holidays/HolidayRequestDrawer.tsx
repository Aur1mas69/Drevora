import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { HolidayRequest } from '@/lib/holidayRequestTypes'
import {
  canApproveHolidayRequest,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/holidayRequestUtils'
import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type HolidayRequestDrawerProps = {
  request: HolidayRequest | null
  isOpen: boolean
  isSaving?: boolean
  onClose: () => void
  onApprove?: (managerNote: string) => Promise<void>
  onReject?: (managerNote: string) => Promise<void>
}

export function HolidayRequestDrawer({
  request,
  isOpen,
  isSaving = false,
  onClose,
  onApprove,
  onReject,
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        aria-label="Close holiday request drawer"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-[0_0_40px_rgba(15,23,42,0.18)]">
        <div className="border-b border-[rgba(75,120,220,0.10)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Holiday Request
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
                {request.workerName}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {request.workerRole ?? 'No role assigned'}
              </p>
            </div>
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
                <dd className="font-medium tabular-nums text-[#2A376F]">
                  {formatDate(request.startDate)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">End date</dt>
                <dd className="font-medium tabular-nums text-[#2A376F]">
                  {formatDate(request.endDate)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Total days</dt>
                <dd className="font-semibold tabular-nums text-[#2A376F]">{request.totalDays}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Reason</dt>
                <dd className="mt-1 rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-slate-700">
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
                      className="w-full rounded-[10px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                    />
                  ) : (
                    <p className="rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-slate-700">
                      {request.managerNote?.trim() || 'No manager note'}
                    </p>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {canApprove ? (
          <div className="border-t border-[rgba(75,120,220,0.10)] px-5 py-4">
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
                Reject
              </Button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
