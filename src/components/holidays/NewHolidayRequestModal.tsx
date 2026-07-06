import { Button } from '@/components/ui/button'
import { HolidayDateInput } from '@/components/holidays/HolidayDateInput'
import { HolidayDatePickerGroup } from '@/components/holidays/HolidayDatePickerGroup'
import { HolidayDayBreakdownSummary } from '@/components/holidays/HolidayDayBreakdownSummary'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type {
  HolidayBalanceSummary,
  HolidayCapacityWarning,
  HolidayLeaveType,
} from '@/lib/holidayRequestTypes'
import {
  calculateHolidayDayBreakdown,
  DEFAULT_HOLIDAY_COUNTING_SETTINGS,
} from '@/lib/holidayRequestUtils'
import { DEFAULT_HOLIDAY_ENTITLEMENT_RULES } from '@/lib/companySettingsTypes'
import type { Driver } from '@/services/driversService'
import {
  calculateHolidayRequestBalance,
  checkHolidayRequestCapacity,
} from '@/services/holidayRequestsService'
import { AlertTriangle, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type NewHolidayRequestModalProps = {
  isOpen: boolean
  workers: Driver[]
  isSaving?: boolean
  onClose: () => void
  onSubmit: (input: {
    workerId: string
    startDate: string
    endDate: string
    leaveType: HolidayLeaveType
    reason: string
  }) => Promise<void>
}

const selectClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

const holidayDateInputClassName =
  'mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] text-sm font-medium text-slate-700 shadow-sm focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-blue-100'

function formatCapacityWarning(warning: HolidayCapacityWarning): string {
  const datePreview = warning.overLimitDates.slice(0, 3).join(', ')
  const moreCount = warning.overLimitDates.length - 3
  return `${warning.maxWorkersOff} workers would be off on ${datePreview}${
    moreCount > 0 ? ` and ${moreCount} more day${moreCount === 1 ? '' : 's'}` : ''
  }. Limit is ${warning.maxWorkersOffPerDay}.`
}

function hasValidDateRange(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false
  return endDate >= startDate
}

export function NewHolidayRequestModal({
  isOpen,
  workers,
  isSaving = false,
  onClose,
  onSubmit,
}: NewHolidayRequestModalProps) {
  const { settings } = useCompanySettings()
  useBodyScrollLock(isOpen)

  const [workerId, setWorkerId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [leaveType, setLeaveType] = useState<HolidayLeaveType>('paid_holiday')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<HolidayBalanceSummary | null>(null)
  const [isBalanceLoading, setIsBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [capacityWarning, setCapacityWarning] = useState<HolidayCapacityWarning | null>(null)

  const wasOpenRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const sortedWorkers = useMemo(
    () =>
      [...workers].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [workers],
  )

  const selectedWorker = useMemo(
    () => sortedWorkers.find((worker) => worker.id === workerId) ?? null,
    [sortedWorkers, workerId],
  )
  const selectedWorkerRule =
    settings?.holidayEntitlementRules[
      selectedWorker?.employmentType && selectedWorker.employmentType in DEFAULT_HOLIDAY_ENTITLEMENT_RULES
        ? selectedWorker.employmentType
        : 'Other'
    ] ?? DEFAULT_HOLIDAY_ENTITLEMENT_RULES.Other
  const paidHolidayEnabled =
    selectedWorker?.paidHolidayEnabled ?? selectedWorkerRule.paidHolidayEnabled

  const holidayCountingMethod =
    settings?.holidayCountingMethod ?? DEFAULT_HOLIDAY_COUNTING_SETTINGS.holidayCountingMethod
  const holidayWorkingDays =
    settings?.holidayWorkingDays ?? DEFAULT_HOLIDAY_COUNTING_SETTINGS.holidayWorkingDays
  const holidayWorkingDaysKey = holidayWorkingDays.join(',')

  const countingSettings = useMemo(
    () => ({
      holidayCountingMethod,
      holidayWorkingDays,
    }),
    [holidayCountingMethod, holidayWorkingDaysKey, holidayWorkingDays],
  )

  const dayBreakdown = useMemo(() => {
    if (!hasValidDateRange(startDate, endDate)) return null
    return calculateHolidayDayBreakdown(startDate, endDate, countingSettings)
  }, [countingSettings, endDate, startDate])

  const resetForm = useCallback(() => {
    setWorkerId(sortedWorkers[0]?.id ?? '')
    setStartDate('')
    setEndDate('')
    setLeaveType('paid_holiday')
    setReason('')
    setError(null)
    setBalance(null)
    setBalanceError(null)
    setCapacityWarning(null)
    setIsBalanceLoading(false)
  }, [sortedWorkers])

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false
      return
    }

    if (wasOpenRef.current) return
    wasOpenRef.current = true
    resetForm()
  }, [isOpen, resetForm])

  useEffect(() => {
    if (!isOpen || !selectedWorker) return
    setLeaveType(paidHolidayEnabled ? 'paid_holiday' : 'unpaid_leave')
  }, [isOpen, paidHolidayEnabled, selectedWorker])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !workerId || !hasValidDateRange(startDate, endDate)) {
      setBalance(null)
      setBalanceError(null)
      setIsBalanceLoading(false)
      setCapacityWarning(null)
      return
    }

    let isCancelled = false
    const timer = window.setTimeout(() => {
      setIsBalanceLoading(true)
      setBalanceError(null)

      void calculateHolidayRequestBalance({ workerId, startDate, endDate, leaveType })
        .then((result) => {
          if (!isCancelled) {
            setBalance(result)
          }
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

      void checkHolidayRequestCapacity({ workerId, startDate, endDate })
        .then((warning) => {
          if (!isCancelled) {
            setCapacityWarning(warning.overLimitDates.length > 0 ? warning : null)
          }
        })
        .catch(() => {
          if (!isCancelled) setCapacityWarning(null)
        })
    }, 300)

    return () => {
      isCancelled = true
      window.clearTimeout(timer)
    }
  }, [endDate, isOpen, leaveType, startDate, workerId])

  const handleClose = useCallback(() => {
    onCloseRef.current()
  }, [])

  const handleCancel = useCallback(() => {
    onCloseRef.current()
  }, [])

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

    if (!dayBreakdown || dayBreakdown.calendarDaysTotal <= 0) {
      setError('End date must be on or after start date.')
      return
    }

    if (leaveType === 'paid_holiday' && dayBreakdown.holidayDaysDeducted <= 0) {
      setError(
        'This date range has no holiday days to deduct. Choose dates that include working days.',
      )
      return
    }

    const payload = { workerId, startDate, endDate, leaveType, reason }

    try {
      await onSubmit(payload)
      onCloseRef.current()
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to create holiday request.',
      )
    }
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose()
      }}
    >
      <div
        className="flex max-h-[min(92vh,100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-holiday-request-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="new-holiday-request-title"
              className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]"
            >
              New Holiday Request
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Submit annual leave for a worker. Holiday days are calculated from company settings.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            <label className="block text-sm font-medium text-slate-700">
              Worker
              <select
                value={workerId}
                onChange={(event) => setWorkerId(event.target.value)}
                className={selectClassName}
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
                    className={holidayDateInputClassName}
                    layout="modal"
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
                    className={holidayDateInputClassName}
                    layout="modal"
                    blurOnSelect
                    aria-label="End date"
                  />
                </label>
              </div>
            </HolidayDatePickerGroup>

            <label className="block text-sm font-medium text-slate-700">
              Leave type
              <select
                value={leaveType}
                onChange={(event) => setLeaveType(event.target.value as HolidayLeaveType)}
                className={selectClassName}
              >
                <option value="paid_holiday">Paid holiday</option>
                <option value="unpaid_leave">Unpaid leave</option>
              </select>
            </label>

            {!paidHolidayEnabled ? (
              <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                This worker is not eligible for paid holiday. This request can be recorded as unpaid leave.
              </div>
            ) : null}

            {dayBreakdown ? (
              <HolidayDayBreakdownSummary
                breakdown={balance ?? dayBreakdown}
                isLoadingBalance={isBalanceLoading}
                balanceError={balanceError}
              />
            ) : null}

            {leaveType === 'paid_holiday' &&
            !isBalanceLoading &&
            balance?.allowanceKnown &&
            balance.remainingAfterRequest < 0 ? (
              <div className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                This request exceeds the worker paid holiday allowance. You can still submit it.
              </div>
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
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
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
    </div>,
    document.body,
  )
}
