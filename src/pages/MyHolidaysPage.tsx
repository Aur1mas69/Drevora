import { MyHolidayBalanceHero } from '@/components/worker-holidays/MyHolidayBalanceHero'
import { MyHolidayBookCard } from '@/components/worker-holidays/MyHolidayBookCard'
import { MyHolidayCalendar } from '@/components/worker-holidays/MyHolidayCalendar'
import { MyHolidayRequestsList } from '@/components/worker-holidays/MyHolidayRequestsList'
import { myHolidayPageClass } from '@/components/worker-holidays/myHolidayUiStyles'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import {
  resolveSelfServiceHolidayLeaveType,
  workerHasPaidHolidayEntitlement,
} from '@/lib/workerHolidaySelfService'
import type { HolidayBalanceSummary, HolidayDayPortion, HolidayRequest } from '@/lib/holidayRequestTypes'
import {
  isSingleHolidayRequestDay,
  normalizeHolidayRequestPortions,
} from '@/lib/holidayRequestUtils'
import {
  calculateHolidayRequestBalance,
  createHolidayRequest,
  fetchHolidayCalendarRequests,
  fetchHolidayRequests,
  fetchWorkerHolidayBalanceSummary,
  HolidayRequestsServiceError,
} from '@/services/holidayRequestsService'
import { translateHolidayServiceError } from '@/i18n/workerPhase3bDisplay'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MY_REQUESTS_PAGE_SIZE = 50

export default function MyHolidaysPage() {
  const { t } = useTranslation('worker')
  const { worker, isLoading: isWorkerLoading, error: workerError } = useCurrentWorker()
  const [balance, setBalance] = useState<HolidayBalanceSummary | null>(null)
  const [requests, setRequests] = useState<HolidayRequest[]>([])
  const [calendarRequests, setCalendarRequests] = useState<HolidayRequest[]>([])
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startDayPortion, setStartDayPortion] = useState<HolidayDayPortion>('full')
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<HolidayBalanceSummary | null>(null)
  const isSingleDay = isSingleHolidayRequestDay(startDate, endDate)
  const requestPortions = useMemo(
    () => normalizeHolidayRequestPortions(startDate, endDate, startDayPortion),
    [endDate, startDate, startDayPortion],
  )
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showManagedMessage = worker ? !workerHasPaidHolidayEntitlement(worker) : false
  const leaveType = worker ? resolveSelfServiceHolidayLeaveType(worker.paidHolidayEnabled) : 'paid_holiday'

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  const loadWorkerData = useCallback(async (workerId: string) => {
    const now = new Date()
    const calendarFrom = `${now.getFullYear() - 1}-01-01`
    const calendarTo = `${now.getFullYear() + 1}-12-31`
    const [balanceResult, requestsResult, calendarResult] = await Promise.all([
      fetchWorkerHolidayBalanceSummary(workerId),
      fetchHolidayRequests({
        workerId,
        page: 1,
        pageSize: MY_REQUESTS_PAGE_SIZE,
      }),
      fetchHolidayCalendarRequests({
        workerId,
        dateFrom: calendarFrom,
        dateTo: calendarTo,
        statuses: ['Approved', 'Pending', 'Rejected'],
      }),
    ])

    setBalance(balanceResult)
    setRequests(requestsResult.items)
    setCalendarRequests(calendarResult)
  }, [])

  useEffect(() => {
    if (!worker) {
      setBalance(null)
      setRequests([])
      setCalendarRequests([])
      return
    }

    let cancelled = false
    setIsDataLoading(true)
    setDataError(null)

    void loadWorkerData(worker.id)
      .catch((error) => {
        if (cancelled) return
        setDataError(
          error instanceof HolidayRequestsServiceError
            ? error.message
            : error instanceof Error
              ? error.message
              : t('holidays.loadFailed'),
        )
      })
      .finally(() => {
        if (!cancelled) setIsDataLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadWorkerData, t, worker])

  const isLoading = isWorkerLoading || isDataLoading
  const loadError = workerError ?? dataError

  useEffect(() => {
    if (!isSingleDay && startDayPortion !== 'full') {
      setStartDayPortion('full')
    }
  }, [isSingleDay, startDayPortion])

  useEffect(() => {
    if (!worker || !startDate || !endDate) {
      setPreview(null)
      return
    }

    let cancelled = false
    setIsPreviewLoading(true)

    void calculateHolidayRequestBalance({
      workerId: worker.id,
      startDate,
      endDate,
      startDayPortion: requestPortions.startDayPortion,
      endDayPortion: requestPortions.endDayPortion,
      leaveType,
    })
      .then((result) => {
        if (!cancelled) setPreview(result)
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
      .finally(() => {
        if (!cancelled) setIsPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [endDate, leaveType, requestPortions, startDate, worker])

  async function handleSubmit() {
    if (!worker || !startDate || !endDate) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await createHolidayRequest({
        workerId: worker.id,
        startDate,
        endDate,
        startDayPortion: requestPortions.startDayPortion,
        endDayPortion: requestPortions.endDayPortion,
        leaveType,
        reason: reason.trim() || null,
      })
      setStartDate('')
      setEndDate('')
      setStartDayPortion('full')
      setReason('')
      setPreview(null)
      showToast(t('holidays.submitted'))
      await loadWorkerData(worker.id)
    } catch (error) {
      setSubmitError(
        error instanceof HolidayRequestsServiceError
          ? translateHolidayServiceError(error.message, t)
          : t('holidays.submitFailed'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={myHolidayPageClass}>
      <header className="space-y-1">
        <p className="my-holiday-eyebrow text-xs font-bold uppercase tracking-[0.14em] text-[#218EE7]">
          {t('holidays.eyebrow')}
        </p>
        <h1 className="my-holiday-title text-2xl font-semibold tracking-[-0.03em] text-[#113C69]">
          {t('holidays.title')}
        </h1>
        <p className="my-holiday-muted text-sm text-[#5499BF]">
          {t('holidays.subtitle')}
        </p>
      </header>

      {loadError ? (
        <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="my-holiday-card my-holiday-muted rounded-[1.75rem] border border-[#D3E9FC] bg-white px-4 py-10 text-center text-sm text-[#5499BF]">
          {t('holidays.loading')}
        </div>
      ) : worker ? (
        <>
          <MyHolidayBalanceHero balance={balance} showManagedMessage={showManagedMessage} />

          <MyHolidayBookCard
            startDate={startDate}
            endDate={endDate}
            startDayPortion={startDayPortion}
            reason={reason}
            preview={preview}
            isPreviewLoading={isPreviewLoading}
            isSubmitting={isSubmitting}
            showManagedMessage={showManagedMessage}
            onStartDateChange={(value) => {
              setStartDate(value)
              if (endDate && value && endDate < value) {
                setEndDate(value)
              }
              if (value && endDate && value !== endDate) {
                setStartDayPortion('full')
              }
            }}
            onEndDateChange={(value) => {
              setEndDate(value)
              if (startDate && value && startDate !== value) {
                setStartDayPortion('full')
              }
            }}
            onStartDayPortionChange={setStartDayPortion}
            onReasonChange={setReason}
            onSubmit={() => void handleSubmit()}
          />

          {submitError ? (
            <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <MyHolidayCalendar requests={calendarRequests} />

          <MyHolidayRequestsList requests={requests} />
        </>
      ) : null}

      {toastMessage ? (
        <div className="worker-toast-success fixed bottom-24 left-1/2 z-[60] w-[min(100vw-2rem,20rem)] -translate-x-1/2 rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  )
}
