import { Button } from '@/components/ui/button'
import { HolidayDateInput } from '@/components/holidays/HolidayDateInput'
import { HolidayDatePickerGroup } from '@/components/holidays/HolidayDatePickerGroup'
import { HolidayDayBreakdownSummary } from '@/components/holidays/HolidayDayBreakdownSummary'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type {
  HolidayBalanceSummary,
  HolidayCapacityWarning,
  HolidayRequest,
  HolidayRequestStatus,
} from '@/lib/holidayRequestTypes'
import {
  calculateHolidayDayBreakdown,
  DEFAULT_HOLIDAY_COUNTING_SETTINGS,
} from '@/lib/holidayRequestUtils'
import {
  calculateHolidayRequestBalance,
  checkHolidayRequestCapacity,
} from '@/services/holidayRequestsService'
import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

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

function formatCapacityWarning(warning: HolidayCapacityWarning): string {
  const datePreview = warning.overLimitDates.slice(0, 3).join(', ')
  const moreCount = warning.overLimitDates.length - 3
  return `${warning.maxWorkersOff} workers would be off on ${datePreview}${
    moreCount > 0 ? ` and ${moreCount} more day${moreCount === 1 ? '' : 's'}` : ''
  }. Limit is ${warning.maxWorkersOffPerDay}.`
}

export function EditHolidayRequestModal({
  request,
  isOpen,
  isSaving = false,
  onClose,
  onSubmit,
}: EditHolidayRequestModalProps) {
  const { settings } = useCompanySettings()
  useBodyScrollLock(isOpen)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<HolidayRequestStatus>('Pending')
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<HolidayBalanceSummary | null>(null)
  const [isBalanceLoading, setIsBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [capacityWarning, setCapacityWarning] = useState<HolidayCapacityWarning | null>(null)

  const countingSettings = useMemo(
    () =>
      settings
        ? {
            holidayCountingMethod: settings.holidayCountingMethod,
            holidayWorkingDays: settings.holidayWorkingDays,
          }
        : DEFAULT_HOLIDAY_COUNTING_SETTINGS,
    [settings],
  )

  const dayBreakdown = useMemo(() => {
    if (!startDate || !endDate) return null
    return calculateHolidayDayBreakdown(startDate, endDate, countingSettings)
  }, [countingSettings, startDate, endDate])

  useEffect(() => {
    if (!isOpen || !request) return
    setStartDate(request.startDate)
    setEndDate(request.endDate)
    setReason(request.reason ?? '')
    setStatus(request.status)
    setError(null)
    setBalance(null)
    setBalanceError(null)
    setCapacityWarning(null)
  }, [isOpen, request])

  useEffect(() => {
    if (!isOpen || !request || !startDate || !endDate || !dayBreakdown) {
      setBalance(null)
      setBalanceError(null)
      setIsBalanceLoading(false)
      return
    }

    let isCancelled = false
    setIsBalanceLoading(true)
    setBalanceError(null)

    void calculateHolidayRequestBalance({
      workerId: request.workerId,
      startDate,
      endDate,
      excludeRequestId: request.id,
    })
      .then((result) => {
        if (!isCancelled) setBalance(result)
      })
      .catch((balanceLoadError) => {
        if (!isCancelled) {
          setBalance(null)
          setBalanceError(
            balanceLoadError instanceof Error
              ? balanceLoadError.message
              : 'Unable to check remaining holiday allowance.',
          )
        }
      })
      .finally(() => {
        if (!isCancelled) setIsBalanceLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [dayBreakdown, endDate, isOpen, request, startDate])

  useEffect(() => {
    if (!isOpen || !request || !startDate || !endDate || !dayBreakdown) {
      setCapacityWarning(null)
      return
    }

    let isCancelled = false

    void checkHolidayRequestCapacity({
      workerId: request.workerId,
      startDate,
      endDate,
      excludeRequestId: request.id,
    })
      .then((warning) => {
        if (!isCancelled) {
          setCapacityWarning(warning.overLimitDates.length > 0 ? warning : null)
        }
      })
      .catch(() => {
        if (!isCancelled) setCapacityWarning(null)
      })

    return () => {
      isCancelled = true
    }
  }, [dayBreakdown, endDate, isOpen, request, startDate])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen || !request || typeof document === 'undefined') return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!startDate || !endDate) {
      setError('Start and end dates are required.')
      return
    }

    if (!dayBreakdown || dayBreakdown.calendarDaysTotal <= 0) {
      setError('End date must be on or after start date.')
      return
    }

    if (balance?.allowanceKnown && balance.remainingAfterRequest < 0) {
      setError('This request exceeds the worker holiday allowance.')
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

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[min(92vh,100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-holiday-request-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
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
              className="h-8 w-8 shrink-0 rounded-[10px] p-0 text-slate-500"
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>

          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
              <HolidayDatePickerGroup>
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block min-w-0 text-sm font-medium text-slate-700">
                    Start date
                    <HolidayDateInput
                      value={startDate}
                      onChange={(value) => {
                        setStartDate(value)
                        if (endDate && value && endDate < value) {
                          setEndDate(value)
                        }
                      }}
                      className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]"
                      layout="modal"
                      required
                      blurOnSelect
                      aria-label="Start date"
                    />
                  </label>
                  <label className="block min-w-0 text-sm font-medium text-slate-700">
                    End date
                    <HolidayDateInput
                      value={endDate}
                      onChange={setEndDate}
                      min={startDate || undefined}
                      className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]"
                      layout="modal"
                      required
                      blurOnSelect
                      aria-label="End date"
                    />
                  </label>
                </div>
              </HolidayDatePickerGroup>

              {dayBreakdown ? (
                <HolidayDayBreakdownSummary
                  breakdown={balance ?? dayBreakdown}
                  isLoadingBalance={isBalanceLoading}
                  balanceError={balanceError}
                />
              ) : null}

              {capacityWarning ? (
                <div className="flex gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    <span className="font-semibold">Capacity warning:</span>{' '}
                    {formatCapacityWarning(capacityWarning)}
                  </p>
                </div>
              ) : null}

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
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
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
    </div>,
    document.body,
  )
}
