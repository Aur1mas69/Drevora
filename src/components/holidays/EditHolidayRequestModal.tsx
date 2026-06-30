import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calculateInclusiveCalendarDays } from '@/lib/holidayRequestUtils'
import type { HolidayRequest, HolidayRequestStatus } from '@/lib/holidayRequestTypes'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type EditHolidayRequestModalProps = {
  request: HolidayRequest | null
  isOpen: boolean
  isSaving?: boolean
  onClose: () => void
  onSubmit: (input: {
    startDate: string
    endDate: string
    reason: string
    status: HolidayRequestStatus
  }) => Promise<void>
}

const selectClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

const STATUS_OPTIONS: HolidayRequestStatus[] = [
  'Pending',
  'Approved',
  'Rejected',
  'Cancelled',
]

export function EditHolidayRequestModal({
  request,
  isOpen,
  isSaving = false,
  onClose,
  onSubmit,
}: EditHolidayRequestModalProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<HolidayRequestStatus>('Pending')
  const [error, setError] = useState<string | null>(null)

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    return calculateInclusiveCalendarDays(startDate, endDate)
  }, [startDate, endDate])

  useEffect(() => {
    if (!isOpen || !request) return
    setStartDate(request.startDate)
    setEndDate(request.endDate)
    setReason(request.reason ?? '')
    setStatus(request.status)
    setError(null)
  }, [isOpen, request])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen || !request) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!startDate || !endDate) {
      setError('Start and end dates are required.')
      return
    }

    if (totalDays <= 0) {
      setError('End date must be on or after start date.')
      return
    }

    try {
      await onSubmit({ startDate, endDate, reason, status })
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to update holiday request.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-[18px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-holiday-request-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="edit-holiday-request-title"
              className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]"
            >
              Edit Holiday Request
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {request.workerName}
              {request.workerRole ? ` · ${request.workerRole}` : ''}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="h-8 w-8 rounded-[10px] p-0 text-slate-500"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Start date
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              End date
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]"
                required
              />
            </label>
          </div>

          <p className="text-sm text-slate-600">
            Total days:{' '}
            <span className="font-semibold tabular-nums text-[#2A376F]">{totalDays}</span>
          </p>

          <label className="block text-sm font-medium text-slate-700">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as HolidayRequestStatus)}
              className={selectClassName}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {error ? (
            <p className="rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
