import { COMPANY_UPDATED_EVENT } from '@/lib/companyEvents'
import {
  createCompanyDateTimeFormatter,
  DEFAULT_OVERTIME_AFTER_HOURS,
  DEFAULT_TIME_FORMAT,
  type CompanyDateTimeFormatter,
  type CompanyTimeFormat,
} from '@/lib/dateTimeFormat'
import type {
  CompanyDateFormat,
  CompanySettings,
  CompanySettingsInput,
  CompanyTheme,
  CompanyWeekStarts,
  OvertimeAfterHours,
  OvertimeMode,
  OvertimeMultiplier,
} from '@/lib/companySettingsTypes'
import { DEFAULT_OVERTIME_MULTIPLIER } from '@/lib/companySettingsTypes'
import { applyGlobalCompanySettings } from '@/lib/companySettingsGlobals'
import {
  companySettingsService,
  CompanySettingsServiceError,
} from '@/services/companySettingsService'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type CompanySettingsContextValue = {
  settings: CompanySettings | null
  isLoading: boolean
  isSaving: boolean
  timeFormat: CompanyTimeFormat
  dateFormat: CompanyDateFormat
  weekStarts: CompanyWeekStarts
  timezone: string
  theme: CompanyTheme
  compactTables: boolean
  overtimeAfterHours: OvertimeAfterHours
  overtimeMode: OvertimeMode
  overtimeMultiplier: OvertimeMultiplier
  defaultBreakMinutes: number
  formatter: CompanyDateTimeFormatter
  formatDate: CompanyDateTimeFormatter['formatDate']
  formatTime: CompanyDateTimeFormatter['formatTime']
  formatTimeFromDate: CompanyDateTimeFormatter['formatTimeFromDate']
  formatDateTime: CompanyDateTimeFormatter['formatDateTime']
  formatRelativeDateTime: CompanyDateTimeFormatter['formatRelativeDateTime']
  formatOperationsDateTime: CompanyDateTimeFormatter['formatOperationsDateTime']
  updateSettings: (patch: Partial<CompanySettingsInput>) => Promise<CompanySettings>
  refreshSettings: () => void
  /** @deprecated Use settings */
  company: CompanySettings | null
}

const CompanySettingsContext = createContext<CompanySettingsContextValue | null>(null)

function applyTheme(theme: CompanyTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme

  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
}

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [version, setVersion] = useState(0)

  const loadSettings = useCallback(async () => {
    setIsLoading(true)

    try {
      const loaded = await companySettingsService.fetchCompanySettings()
      setSettings(loaded)

      if (loaded) {
        applyGlobalCompanySettings(loaded)
        applyTheme(loaded.theme)
      } else {
        applyGlobalCompanySettings(null)
        applyTheme('light')
      }
    } catch {
      setSettings(null)
      applyGlobalCompanySettings(null)
      applyTheme('light')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings, version])

  useEffect(() => {
    function handleCompanyUpdated() {
      setVersion((current) => current + 1)
    }

    window.addEventListener(COMPANY_UPDATED_EVENT, handleCompanyUpdated)
    return () => window.removeEventListener(COMPANY_UPDATED_EVENT, handleCompanyUpdated)
  }, [])

  useEffect(() => {
    if (!settings || settings.theme !== 'auto') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      applyTheme('auto')
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [settings?.theme])

  const updateSettings = useCallback(async (patch: Partial<CompanySettingsInput>) => {
    setIsSaving(true)

    try {
      const updated = await companySettingsService.updateCompanySettings(patch)
      setSettings(updated)
      applyGlobalCompanySettings(updated)
      applyTheme(updated.theme)
      window.dispatchEvent(new Event(COMPANY_UPDATED_EVENT))
      return updated
    } catch (error) {
      throw error instanceof CompanySettingsServiceError
        ? error
        : new CompanySettingsServiceError('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }, [])

  const timeFormat = settings?.timeFormat ?? DEFAULT_TIME_FORMAT
  const dateFormat = settings?.dateFormat ?? 'DMY'
  const weekStarts = settings?.weekStarts ?? 'monday'
  const timezone = settings?.timezone?.trim() || 'Europe/London'
  const theme = settings?.theme ?? 'light'
  const compactTables = settings?.compactTables ?? false
  const overtimeAfterHours = settings?.overtimeAfterHours ?? DEFAULT_OVERTIME_AFTER_HOURS
  const overtimeMode = settings?.overtimeMode ?? 'Manual'
  const overtimeMultiplier = settings?.overtimeMultiplier ?? DEFAULT_OVERTIME_MULTIPLIER
  const defaultBreakMinutes = settings?.defaultBreakMinutes ?? 30

  const value = useMemo<CompanySettingsContextValue>(() => {
    const formatter = createCompanyDateTimeFormatter(timeFormat, timezone, dateFormat)

    return {
      settings,
      company: settings,
      isLoading,
      isSaving,
      timeFormat,
      dateFormat,
      weekStarts,
      timezone,
      theme,
      compactTables,
      overtimeAfterHours,
      overtimeMode,
      overtimeMultiplier,
      defaultBreakMinutes,
      formatter,
      formatDate: formatter.formatDate,
      formatTime: formatter.formatTime,
      formatTimeFromDate: formatter.formatTimeFromDate,
      formatDateTime: formatter.formatDateTime,
      formatRelativeDateTime: formatter.formatRelativeDateTime,
      formatOperationsDateTime: formatter.formatOperationsDateTime,
      updateSettings,
      refreshSettings: () => setVersion((current) => current + 1),
    }
  }, [
    compactTables,
    dateFormat,
    defaultBreakMinutes,
    isLoading,
    isSaving,
    overtimeAfterHours,
    overtimeMode,
    overtimeMultiplier,
    settings,
    theme,
    timeFormat,
    timezone,
    updateSettings,
    weekStarts,
  ])

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  )
}

export function useCompanySettings(): CompanySettingsContextValue {
  const context = useContext(CompanySettingsContext)

  if (!context) {
    throw new Error('useCompanySettings must be used within CompanySettingsProvider')
  }

  return context
}
