import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { resolveEffectiveTimesheetSettings } from '@/lib/resolveEffectiveTimesheetSettings'
import type { EffectiveTimesheetSettings } from '@/lib/workerTimesheetSettingsTypes'
import {
  fetchOwnDriverTimesheetSettings,
  WorkerTimesheetSettingsServiceError,
} from '@/services/workerTimesheetSettingsService'
import { useCallback, useEffect, useState } from 'react'

type Result = {
  effective: EffectiveTimesheetSettings | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/** Loads the current worker's override and resolves effective Timesheet settings. */
export function useWorkerEffectiveTimesheetSettings(
  driverId: string | null | undefined,
): Result {
  const { settings, companyLoading } = useCompanySettings()
  const [effective, setEffective] = useState<EffectiveTimesheetSettings | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!driverId) {
      setEffective(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const override = await fetchOwnDriverTimesheetSettings(driverId)
      setEffective(resolveEffectiveTimesheetSettings(settings, override))
    } catch (loadError) {
      const message =
        loadError instanceof WorkerTimesheetSettingsServiceError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : 'Unable to load Timesheet settings.'
      setError(message)
      // Still expose company/fallback so Timesheets remain usable.
      setEffective(resolveEffectiveTimesheetSettings(settings, null))
    } finally {
      setIsLoading(false)
    }
  }, [driverId, settings])

  useEffect(() => {
    if (companyLoading) return
    void refresh()
  }, [companyLoading, refresh])

  return { effective, isLoading: isLoading || companyLoading, error, refresh }
}
