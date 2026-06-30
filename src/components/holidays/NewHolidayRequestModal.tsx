import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calculateInclusiveCalendarDays } from '@/lib/holidayRequestUtils'
import type { Driver } from '@/services/driversService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type NewHolidayRequestModalProps = {
  isOpen: boolean
  workers: Driver[]
  isSaving?: boolean
  onClose: () => void
  onSubmit: (input: {
    workerId: string
    startDate: string
    endDate: string
    reason: string
  }) => Promise<void>
}

const selectClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

export function NewHolidayRequestModal({
  isOpen,
  workers,
  isSaving = false,
  onClose,
  onSubmit,
}: NewHolidayRequestModalProps) {
  const [workerId, setWorkerId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sortedWorkers = useMemo(
    () =>
      [...workers].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [workers],
  )

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    return calculateInclusiveCalendarDays(startDate, endDate)
  }, [startDate, endDate])

  useEffect(() => {
    if (!isOpen) return
    setWorkerId(sortedWorkers[0]?.id ?? '')
    setStartDate('')
    setEndDate('')
    setReason('')
    setError(null)
  }, [isOpen, sortedWorkers])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!workerId) {
      setError('Please select a worker.')
      return
    }

    if (!startDate || !endDate) {
      setError('Start and end dates are required.')
      return
    }

    if (totalDays <= 0) {
      setError('End date must be on or after start date.')
      return
    }

    try {
      await onSubmit({ workerId, startDate, endDate, reason })
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to create holiday request.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-[18px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-holiday-request-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="new-holiday-request-title"
              className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]"
            >
              New Holiday Request
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Submit annual leave for a worker. Total days are calculated automatically.
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
          <label className="block text-sm font-medium text-slate-700">
            Worker
            <select
              value={workerId}
              onChange={(event) => setWorkerId(event.target.value)}
              className={selectClassName}
              required
            >
              {sortedWorkers.length === 0 ? (
                <option value="">No workers available</option>
              ) : (
                sortedWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.firstName} {worker.lastName}
                    {worker.role ? ` · ${worker.role}` : ''}
                  </option>
                ))
              )}
            </select>
          </label>

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

          {startDate && endDate ? (
            <p className="text-sm text-slate-600">
              Total days:{' '}
              <span className="font-semibold tabular-nums text-[#2A376F]">{totalDays}</span>
              <span className="text-slate-400"> (calendar days, inclusive)</span>
            </p>
          ) : null}

          <label className="block text-sm font-medium text-slate-700">
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Optional — e.g. family holiday, medical appointment"
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
              disabled={isSaving || sortedWorkers.length === 0}
              className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              {isSaving ? 'Submitting…' : 'Submit request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
