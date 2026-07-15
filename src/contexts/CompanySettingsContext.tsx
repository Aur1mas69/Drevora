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
import { applyDocumentTheme, subscribeToSystemTheme } from '@/lib/theme'
import {
  applyGlobalCompanySettings,
  clearGlobalCompanySettings,
} from '@/lib/companySettingsGlobals'
import { useAuth } from '@/contexts/AuthContext'
import {
  clearCompanyMembershipCache,
  resolveCurrentCompanyMembership,
} from '@/services/companyMembershipService'
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
  useRef,
  useState,
  type ReactNode,
} from 'react'

type CompanySettingsContextValue = {
  settings: CompanySettings | null
  companySettings: CompanySettings | null
  companyId: string | null
  companyName: string | null
  membershipRole: string | null
  /** True while Supabase auth session restoration is in progress. */
  authLoading: boolean
  /** True while company membership / settings are resolving. */
  companyLoading: boolean
  /**
   * True only when auth is restored, membership finished, and a verified
   * companyId is available. Tenant queries must wait for this.
   */
  companyReady: boolean
  isLoading: boolean
  loading: boolean
  isSaving: boolean
  error: string | null
  /** Alias for membership/setup errors (same as error). */
  membershipError: string | null
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
  refreshCompanySettings: () => void
  /** @deprecated Use settings */
  company: CompanySettings | null
}

const CompanySettingsContext = createContext<CompanySettingsContextValue | null>(null)

function clearCompanyContextState(
  setSettings: (value: CompanySettings | null) => void,
  setCompanyId: (value: string | null) => void,
  setCompanyName: (value: string | null) => void,
  setMembershipRole: (value: string | null) => void,
  setError: (value: string | null) => void,
): void {
  clearCompanyMembershipCache()
  clearGlobalCompanySettings()
  setSettings(null)
  setCompanyId(null)
  setCompanyName(null)
  setMembershipRole(null)
  setError(null)
  applyDocumentTheme('light')
}

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const { session, isAuthLoading } = useAuth()
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [membershipRole, setMembershipRole] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [version, setVersion] = useState(0)
  const loadGenerationRef = useRef(0)
  const sessionUserId = session?.user.id ?? null

  const loadSettings = useCallback(async (userId: string | null) => {
    const generation = ++loadGenerationRef.current
    setIsLoading(true)

    if (!userId) {
      clearCompanyContextState(
        setSettings,
        setCompanyId,
        setCompanyName,
        setMembershipRole,
        setError,
      )
      if (generation === loadGenerationRef.current) {
        setIsLoading(false)
      }
      return
    }

    try {
      // Prevent flashing another company's settings while membership resolves.
      clearCompanyMembershipCache()
      clearGlobalCompanySettings()
      setSettings(null)
      setCompanyId(null)
      setCompanyName(null)
      setMembershipRole(null)
      setError(null)

      const resolution = await resolveCurrentCompanyMembership({ force: true })

      if (generation !== loadGenerationRef.current) {
        return
      }

      if (resolution.status === 'ready') {
        setSettings(resolution.companySettings)
        setCompanyId(resolution.companyId)
        setCompanyName(resolution.companyName)
        setMembershipRole(resolution.membershipRole)
        setError(null)
        applyGlobalCompanySettings(resolution.companySettings, {
          companyId: resolution.companyId,
        })
        applyDocumentTheme(resolution.companySettings.theme)
        return
      }

      setSettings(null)
      setCompanyId(null)
      setCompanyName(null)
      setMembershipRole(null)
      clearGlobalCompanySettings()
      applyDocumentTheme('light')

      if (resolution.status === 'unauthenticated') {
        setError(null)
        return
      }

      setError(resolution.message)
    } catch (loadError) {
      console.error('Failed to load company membership/settings:', loadError)
      if (generation !== loadGenerationRef.current) {
        return
      }
      setSettings(null)
      setCompanyId(null)
      setCompanyName(null)
      setMembershipRole(null)
      clearGlobalCompanySettings()
      applyDocumentTheme('light')
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load company membership.',
      )
    } finally {
      if (generation === loadGenerationRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    void loadSettings(sessionUserId)
  }, [isAuthLoading, loadSettings, sessionUserId, version])

  useEffect(() => {
    function handleCompanyUpdated() {
      setVersion((current) => current + 1)
    }

    window.addEventListener(COMPANY_UPDATED_EVENT, handleCompanyUpdated)
    return () => window.removeEventListener(COMPANY_UPDATED_EVENT, handleCompanyUpdated)
  }, [])

  useEffect(() => {
    if (!settings || settings.theme !== 'system') return

    return subscribeToSystemTheme(() => {
      applyDocumentTheme('system')
    })
  }, [settings?.theme])

  const updateSettings = useCallback(async (patch: Partial<CompanySettingsInput>) => {
    setIsSaving(true)

    try {
      const updated = await companySettingsService.updateCompanySettings(patch)
      setSettings(updated)
      setCompanyId(updated.id)
      setCompanyName(updated.name?.trim() || null)
      applyGlobalCompanySettings(updated, { companyId: updated.id })
      applyDocumentTheme(updated.theme)
      window.dispatchEvent(new Event(COMPANY_UPDATED_EVENT))
      return updated
    } catch (saveError) {
      throw saveError instanceof CompanySettingsServiceError
        ? saveError
        : new CompanySettingsServiceError('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }, [])

  const refreshCompanySettings = useCallback(() => {
    setVersion((current) => current + 1)
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

  // Keep companyLoading true while auth is still restoring so consumers never
  // treat the pre-membership window as a finished empty tenant.
  const companyLoading = isAuthLoading || isLoading
  const companyReady =
    !isAuthLoading &&
    !isLoading &&
    Boolean(sessionUserId) &&
    Boolean(companyId) &&
    !error

  const value = useMemo<CompanySettingsContextValue>(() => {
    const formatter = createCompanyDateTimeFormatter(timeFormat, timezone, dateFormat)

    return {
      settings,
      companySettings: settings,
      company: settings,
      companyId,
      companyName,
      membershipRole,
      authLoading: isAuthLoading,
      companyLoading,
      companyReady,
      isLoading: companyLoading,
      loading: companyLoading,
      isSaving,
      error,
      membershipError: error,
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
      refreshSettings: refreshCompanySettings,
      refreshCompanySettings,
    }
  }, [
    companyId,
    companyLoading,
    companyName,
    companyReady,
    compactTables,
    dateFormat,
    defaultBreakMinutes,
    error,
    isAuthLoading,
    isSaving,
    membershipRole,
    overtimeAfterHours,
    overtimeMode,
    overtimeMultiplier,
    refreshCompanySettings,
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
