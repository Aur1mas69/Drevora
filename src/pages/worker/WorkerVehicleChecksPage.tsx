import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WorkerVehicleCombobox } from '@/components/worker/WorkerVehicleCombobox'
import {
  canCompleteVehicleCheck,
  VehicleCheckCompletionSection,
} from '@/components/vehicle-checks/VehicleCheckCompletionSection'
import { VehicleCheckChecklistForm } from '@/components/vehicle-checks/VehicleCheckChecklistForm'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { useOfflineVehicleChecksQueue } from '@/hooks/useOfflineVehicleChecksQueue'
import { addOnlineStatusListener, getOnlineStatus } from '@/lib/networkStatus'
import { cn } from '@/lib/utils'
import { workerAccentCardClass } from '@/lib/workerDarkAccent'
import {
  formatInspectionDuration,
  isValidInspectionStartedAt,
} from '@/lib/vehicleCheckDurationUtils'
import {
  getRememberedVehicleCheckId,
  setRememberedVehicleCheckId,
} from '@/lib/vehicleCheckRememberedVehicle'
import {
  isVehicleInFleet,
  resolvePreferredWorkerVehicle,
} from '@/lib/vehicleRegistrationSearch'
import {
  canSubmitVehicleChecklist,
  loadVehicleChecklist,
  type VehicleChecklistLoadStatus,
} from '@/lib/vehicleCheckTemplateLoader'
import type {
  VehicleCheckItemInput,
  VehicleChecklistSection,
  VehicleCheckOdometerUnit,
  VehicleCheckResult,
} from '@/lib/vehicleCheckTypes'
import { DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT } from '@/lib/vehicleCheckTypes'
import { computeOverallResult, isChecklistFullyAnswered, todayIsoDate } from '@/lib/vehicleCheckUtils'
import {
  captureVehicleCheckLocation,
  type VehicleCheckLocationResult,
} from '@/lib/vehicleCheckLocation'
import {
  getCachedTemplateItemsForVehicleType,
  loadWorkerCompanyFleet,
  OFFLINE_VEHICLE_CHECKS_NOT_PREPARED_MESSAGE,
  readWorkerOfflineBootstrap,
} from '@/lib/workerOfflineBootstrap'
import {
  createVehicleCheck,
  VehicleChecksServiceError,
} from '@/services/vehicleChecksService'
import { OfflineMediaStorageError } from '@/lib/offlineMedia/offlineMediaStorage'
import {
  saveOfflineCheck,
  syncOfflineVehicleChecks,
} from '@/services/offlineVehicleChecksService'
import type { Vehicle } from '@/services/vehiclesService'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  CreditCard,
  Loader2,
  MapPin,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { WorkerExitVehicleCheckDialog } from '@/components/worker/WorkerExitVehicleCheckDialog'
import { useWorkerVehicleCheckExitGuard } from '@/hooks/useWorkerVehicleCheckExitGuard'

type FlowStep = 'setup' | 'checklist' | 'done'

function getVehicleMakeModelLabel(vehicle: Vehicle): string {
  const label = `${vehicle.make} ${vehicle.model}`.trim()
  return label || 'Make/model not set'
}

function VehicleSummaryCard({
  vehicle,
  onClear,
}: {
  vehicle: Vehicle
  /** Omit to render a read-only summary (e.g. once the checklist is in progress). */
  onClear?: () => void
}) {
  const isDark = useIsWorkerDarkMode()

  return (
    <div
      className={cn(
        workerAccentCardClass(
          0,
          isDark,
          'rounded-[1.25rem] border px-3.5 py-3',
        ),
        !isDark && 'border-[#C5DFFB]/80 bg-[#F5FAFF]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              'worker-accent-muted text-[10px] font-semibold uppercase tracking-[0.1em]',
              !isDark && 'text-[#5499BF]',
            )}
          >
            Selected vehicle
          </p>
          <p
            className={cn(
              'worker-accent-title mt-1 text-base font-bold tracking-[0.04em]',
              !isDark && 'text-[#113C69]',
            )}
          >
            {vehicle.registration}
          </p>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Change vehicle"
            className={cn(
              'worker-accent-icon-well flex size-8 shrink-0 items-center justify-center rounded-full transition-colors',
              !isDark &&
                'text-[#5499BF] hover:bg-[#E3F0FF] hover:text-[#113C69]',
            )}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <p
        className={cn(
          'worker-accent-secondary mt-1 text-sm font-medium',
          !isDark && 'text-[#3D7A9C]',
        )}
      >
        {getVehicleMakeModelLabel(vehicle)}
      </p>
      <p
        className={cn(
          'worker-accent-muted mt-0.5 text-sm',
          !isDark && 'text-[#5499BF]',
        )}
      >
        Type: {vehicle.vehicleType?.trim() || 'Not set on vehicle record'}
      </p>
    </div>
  )
}

function tyreCheckHref(vehicleId: string): string {
  return vehicleId
    ? `/worker/tyre-checks/new?vehicleId=${encodeURIComponent(vehicleId)}`
    : '/worker/tyre-checks/new'
}

function formatLastSyncAt(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

/** Worker entry point from Vehicles → Start Vehicle Check. */
export default function WorkerVehicleChecksPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const { worker, isLoading: workerLoading, error: workerError } = useCurrentWorker()
  const {
    companyId,
    companyReady,
    companyLoading,
    membershipError,
  } = useCompanyTenantGate()
  const offlineQueue = useOfflineVehicleChecksQueue()
  const [isOnline, setIsOnline] = useState(true)
  const [offlineBootstrapReady, setOfflineBootstrapReady] = useState(false)
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null)
  const lastSeenSyncAtRef = useRef<string | null | undefined>(undefined)

  const [step, setStep] = useState<FlowStep>('setup')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [vehiclesError, setVehiclesError] = useState<string | null>(null)
  const [fleetReconnecting, setFleetReconnecting] = useState(false)
  const [fleetReloadToken, setFleetReloadToken] = useState(0)
  const [savedOffline, setSavedOffline] = useState(false)
  const [isRetryingSync, setIsRetryingSync] = useState(false)

  const [vehicleId, setVehicleId] = useState(searchParams.get('vehicleId')?.trim() || '')
  const [rememberVehicle, setRememberVehicle] = useState(false)
  const [odometer, setOdometer] = useState('')
  const [odometerUnit, setOdometerUnit] = useState<VehicleCheckOdometerUnit>(
    DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT,
  )
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [inspectionStartedAt, setInspectionStartedAt] = useState<string | null>(null)
  const [durationNowMs, setDurationNowMs] = useState(() => Date.now())
  const [inspectionDate, setInspectionDate] = useState(todayIsoDate())
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<VehicleCheckItemInput[]>([])
  const [checklistSections, setChecklistSections] = useState<VehicleChecklistSection[]>([])
  const [checklistNotice, setChecklistNotice] = useState<string | null>(null)
  const [checklistStatus, setChecklistStatus] =
    useState<VehicleChecklistLoadStatus>('missing_vehicle_type')
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showChecklistValidation, setShowChecklistValidation] = useState(false)
  const [showCompletionValidation, setShowCompletionValidation] = useState(false)
  const [completedResult, setCompletedResult] = useState<VehicleCheckResult | null>(null)
  const [startedLocationResult, setStartedLocationResult] =
    useState<VehicleCheckLocationResult | null>(null)
  const [startLocationStatus, setStartLocationStatus] = useState<
    'idle' | 'capturing' | 'success' | 'unavailable'
  >('idle')
  const submitLockRef = useRef(false)
  /** True after the Worker explicitly clears selection — never re-apply default. */
  const userClearedSelectionRef = useRef(false)
  const locationStatusHideTimerRef = useRef<number | null>(null)

  const discardActiveCheckToSetup = useCallback(() => {
    setStep('setup')
    setInspectionStartedAt(null)
    setStartedLocationResult(null)
    setStartLocationStatus('idle')
  }, [])

  const {
    exitOpen,
    handleContinueCheck,
    handleExitCheck,
    requestExitToSetup,
  } = useWorkerVehicleCheckExitGuard({
    isCheckActive: step === 'checklist',
    onDiscardToSetup: discardActiveCheckToSetup,
  })

  useEffect(() => {
    return () => {
      if (locationStatusHideTimerRef.current != null) {
        window.clearTimeout(locationStatusHideTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let removeListener: (() => Promise<void>) | null = null

    void getOnlineStatus().then((online) => {
      if (!cancelled) setIsOnline(online)
    })

    void addOnlineStatusListener((online) => {
      if (!cancelled) setIsOnline(online)
    }).then((handle) => {
      if (cancelled) {
        void handle.remove()
        return
      }
      removeListener = () => handle.remove()
    })

    // Sync pending checks when the Vehicle Checks page opens (no-op when offline).
    void syncOfflineVehicleChecks()

    return () => {
      cancelled = true
      if (removeListener) void removeListener()
    }
  }, [])

  // After a successful sync empties the active queue, briefly confirm success then
  // hide — do not keep the Offline Queue panel open for Completed / lastSyncAt alone.
  useEffect(() => {
    const queueIdle =
      !offlineQueue.isSyncing &&
      offlineQueue.pending === 0 &&
      offlineQueue.uploading === 0 &&
      offlineQueue.syncing === 0 &&
      offlineQueue.failed === 0

    if (lastSeenSyncAtRef.current === undefined) {
      lastSeenSyncAtRef.current = offlineQueue.lastSyncAt
      return
    }

    const lastSyncChanged =
      offlineQueue.lastSyncAt != null &&
      offlineQueue.lastSyncAt !== lastSeenSyncAtRef.current

    if (lastSyncChanged && queueIdle) {
      setSyncSuccessMessage('Vehicle Check synced successfully')
    }

    lastSeenSyncAtRef.current = offlineQueue.lastSyncAt
  }, [
    offlineQueue.failed,
    offlineQueue.isSyncing,
    offlineQueue.lastSyncAt,
    offlineQueue.pending,
    offlineQueue.syncing,
    offlineQueue.uploading,
  ])

  useEffect(() => {
    if (!syncSuccessMessage) return
    const timer = window.setTimeout(() => setSyncSuccessMessage(null), 3500)
    return () => window.clearTimeout(timer)
  }, [syncSuccessMessage])

  /**
   * One-shot capture when the Worker starts the Vehicle Check. Never blocks —
   * the checklist is already usable while this resolves in the background.
   */
  function beginStartLocationCapture() {
    if (locationStatusHideTimerRef.current != null) {
      window.clearTimeout(locationStatusHideTimerRef.current)
      locationStatusHideTimerRef.current = null
    }
    setStartedLocationResult(null)
    setStartLocationStatus('capturing')

    void captureVehicleCheckLocation().then((result) => {
      setStartedLocationResult(result)
      setStartLocationStatus(result.status === 'success' ? 'success' : 'unavailable')
      locationStatusHideTimerRef.current = window.setTimeout(() => {
        setStartLocationStatus('idle')
      }, 4000)
    })
  }

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
    [vehicleId, vehicles],
  )

  // A remembered vehicle id that no longer matches an active company vehicle
  // (archived, deleted, or from another company) is stale local storage —
  // drop it so it never resurfaces as a convenience default.
  useEffect(() => {
    if (vehicles.length === 0) return
    const rememberedId = getRememberedVehicleCheckId()
    if (!rememberedId) return
    const stillValid = vehicles.some((vehicle) => vehicle.id === rememberedId)
    if (!stillValid) {
      setRememberedVehicleCheckId(null)
    }
  }, [vehicles])

  const overallResult = useMemo(() => computeOverallResult(items), [items])

  const isChecklistReady = useMemo(
    () => canSubmitVehicleChecklist(checklistStatus, items, checklistSections),
    [checklistStatus, items, checklistSections],
  )

  const isCompletionReady = useMemo(
    () => canCompleteVehicleCheck({ odometer, signatureFile }),
    [odometer, signatureFile],
  )

  const isDurationReady = isValidInspectionStartedAt(inspectionStartedAt)

  const elapsedDurationSeconds = useMemo(() => {
    if (!inspectionStartedAt) return null
    const startedMs = new Date(inspectionStartedAt).getTime()
    if (Number.isNaN(startedMs)) return null
    return Math.max(0, Math.floor((durationNowMs - startedMs) / 1000))
  }, [durationNowMs, inspectionStartedAt])

  const canSaveInspection =
    isChecklistReady &&
    isCompletionReady &&
    isDurationReady &&
    checklistStatus === 'ready' &&
    items.length > 0

  /** Clear in-page selection only — do not bounce Home/CTA traffic to Vehicles. */
  function clearSelectedVehicle() {
    userClearedSelectionRef.current = true
    setVehicleId('')
    setRememberVehicle(false)
    setError(null)
    window.setTimeout(() => {
      document.getElementById('worker-vehicle-check-vehicle')?.focus()
    }, 0)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (companyLoading || workerLoading) return

      if (!companyReady || !worker) {
        setVehicles([])
        setVehiclesLoading(false)
        setOfflineBootstrapReady(false)
        setFleetReconnecting(false)
        return
      }

      setVehiclesLoading(true)
      setVehiclesError(null)
      const userId = session?.user.id?.trim() || ''
      if (!userId) {
        setVehicles([])
        setVehiclesLoading(false)
        setOfflineBootstrapReady(false)
        setFleetReconnecting(false)
        return
      }

      try {
        const result = await loadWorkerCompanyFleet({
          userId,
          companyId,
          worker,
        })
        if (cancelled) return
        setVehicles(result.vehicles)
        setOfflineBootstrapReady(result.vehicles.length > 0)
        setFleetReconnecting(result.reconnecting)
        setVehiclesError(null)
      } catch (loadError) {
        if (cancelled) return
        setVehicles([])
        setOfflineBootstrapReady(false)
        setFleetReconnecting(false)
        setVehiclesError(
          loadError instanceof Error &&
            loadError.message.trim() &&
            !/^TypeError:/i.test(loadError.message)
            ? loadError.message
            : 'Unable to load vehicles.',
        )
      } finally {
        if (!cancelled) setVehiclesLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    companyId,
    companyLoading,
    companyReady,
    fleetReloadToken,
    session?.user.id,
    worker,
    workerLoading,
  ])

  // When a live fetch failed with an empty cache, retry when connectivity returns.
  useEffect(() => {
    if (!fleetReconnecting) return
    let cancelled = false
    let removeListener: (() => Promise<void>) | null = null

    void addOnlineStatusListener((online) => {
      if (!cancelled && online) {
        setFleetReloadToken((token) => token + 1)
      }
    }).then((handle) => {
      if (cancelled) {
        void handle.remove()
        return
      }
      removeListener = () => handle.remove()
    })

    const timer = window.setInterval(() => {
      void getOnlineStatus().then((online) => {
        if (!cancelled && online) {
          setFleetReloadToken((token) => token + 1)
        }
      })
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (removeListener) void removeListener()
    }
  }, [fleetReconnecting])

  // Preselect URL / valid default / remembered vehicle once the fleet is ready.
  // Keep retrying while selection is empty so a late-arriving defaultVehicleId
  // still applies — but never after the Worker explicitly clears the field.
  useEffect(() => {
    if (step !== 'setup' || workerLoading || vehiclesLoading) return
    if (!worker || vehicles.length === 0) return
    if (userClearedSelectionRef.current) {
      if (vehicleId && !isVehicleInFleet(vehicles, vehicleId)) {
        setVehicleId('')
      }
      return
    }

    if (isVehicleInFleet(vehicles, vehicleId)) return

    // Stale id (archived / other company / missing from cache) — drop it.
    if (vehicleId && !isVehicleInFleet(vehicles, vehicleId)) {
      setVehicleId('')
    }

    const fromUrl = searchParams.get('vehicleId')?.trim() || ''
    const fromDefault = worker.defaultVehicleId?.trim() || ''
    const fromRemembered = getRememberedVehicleCheckId()?.trim() || ''
    const match = resolvePreferredWorkerVehicle(vehicles, [
      fromUrl,
      fromDefault,
      fromRemembered,
    ])

    if (match) {
      setVehicleId(match.id)
      setRememberVehicle(fromRemembered === match.id)
    } else if (fromRemembered && !fromUrl && !fromDefault) {
      setRememberedVehicleCheckId(null)
    }
  }, [
    searchParams,
    step,
    vehicleId,
    vehicles,
    vehiclesLoading,
    worker,
    workerLoading,
  ])

  useEffect(() => {
    if (isChecklistFullyAnswered(items, checklistSections)) {
      setShowChecklistValidation(false)
    }
  }, [items, checklistSections])

  useEffect(() => {
    if (isCompletionReady) {
      setShowCompletionValidation(false)
    }
  }, [isCompletionReady])

  useEffect(() => {
    if (step !== 'checklist' || !selectedVehicle?.currentOdometer || odometer.trim()) return
    setOdometer(String(selectedVehicle.currentOdometer))
  }, [step, selectedVehicle, odometer])

  useEffect(() => {
    if (step !== 'checklist' || !inspectionStartedAt) return

    const intervalId = window.setInterval(() => {
      setDurationNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [step, inspectionStartedAt])

  async function handleContinue(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!worker) {
      setError('Worker profile is required.')
      return
    }

    const vehicle = selectedVehicle
    if (!vehicle) {
      setError('Search and select a vehicle from your company fleet.')
      return
    }

    if (!inspectionDate) {
      setError('Inspection date is required.')
      return
    }

    setRememberedVehicleCheckId(rememberVehicle ? vehicle.id : null)

    setIsLoadingChecklist(true)
    try {
      const userId = session?.user.id?.trim() || ''
      let offlineTemplateItems: Awaited<
        ReturnType<typeof getCachedTemplateItemsForVehicleType>
      > = null
      // Always attach bootstrap templates when present so false-"online" native
      // status still falls back after a hung live template fetch.
      if (userId) {
        const cache = await readWorkerOfflineBootstrap(userId, companyId)
        if (cache) {
          offlineTemplateItems =
            getCachedTemplateItemsForVehicleType(cache, vehicle.vehicleType) ?? []
        }
      }

      const checklist = await loadVehicleChecklist(
        vehicle.id,
        vehicle.vehicleType,
        undefined,
        { offlineTemplateItems },
      )
      setItems(checklist.items)
      setChecklistSections(checklist.sections)
      setChecklistNotice(checklist.notice)
      setChecklistStatus(checklist.status)
      setInspectionStartedAt(new Date().toISOString())
      beginStartLocationCapture()
      setDurationNowMs(Date.now())
      setOdometer('')
      setOdometerUnit(DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT)
      setSignatureFile(null)
      setNotes('')
      setShowChecklistValidation(false)
      setShowCompletionValidation(false)
      setStep('checklist')
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load inspection checklist.',
      )
    } finally {
      setIsLoadingChecklist(false)
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (submitLockRef.current || isSaving) return

    if (!worker) {
      setError('Worker profile is required.')
      return
    }

    if (!vehicleId) {
      setError('Please select a vehicle.')
      return
    }

    if (!canSubmitVehicleChecklist(checklistStatus, items, checklistSections)) {
      if (checklistStatus !== 'ready' || items.length === 0) {
        setError(checklistNotice ?? 'Inspection checklist cannot be empty.')
        return
      }

      setShowChecklistValidation(true)
      setError('Please answer every checklist item before saving.')
      return
    }

    if (!isValidInspectionStartedAt(inspectionStartedAt)) {
      setError(
        'Inspection duration could not be calculated. Return to setup and open the checklist again.',
      )
      return
    }

    setShowChecklistValidation(false)
    setShowCompletionValidation(false)

    const parsedOdometer = Number.parseInt(odometer.trim(), 10)
    if (Number.isNaN(parsedOdometer) || parsedOdometer < 0) {
      setShowCompletionValidation(true)
      setError('Please complete mileage before saving.')
      return
    }

    const confirmedStartedAt = inspectionStartedAt as string

    submitLockRef.current = true
    setIsSaving(true)
    try {
      const online = await getOnlineStatus()
      setIsOnline(online)

      if (!canCompleteVehicleCheck({ odometer, signatureFile }) || !signatureFile) {
        setShowCompletionValidation(true)
        setError('Please complete mileage and signature before saving.')
        return
      }

      if (!online) {
        if (!companyId) {
          setError('Company context is required to save offline.')
          return
        }

        // One-shot GPS request immediately before the final save — part of the
        // same completion flow, never a separate/independent submission.
        const completedLocationResult = await captureVehicleCheckLocation()
        const startedLocation =
          startedLocationResult?.status === 'success' ? startedLocationResult.location : null
        const completedLocation =
          completedLocationResult.status === 'success' ? completedLocationResult.location : null

        // Full offline save: checklist + photos + signature to private filesystem.
        // No Supabase calls until sync.
        await saveOfflineCheck({
          companyId,
          vehicleId,
          workerId: worker.id,
          inspectionDate,
          odometer: parsedOdometer,
          odometerUnit,
          notes,
          inspectionStartedAt: confirmedStartedAt,
          items,
          signatureFile,
          startedLocation,
          completedLocation,
        })
        setCompletedResult(computeOverallResult(items))
        setSavedOffline(true)
        setStep('done')
        return
      }

      // One-shot GPS request immediately before the final save — part of the
      // same completion flow, never a separate/independent submission.
      const completedLocationResult = await captureVehicleCheckLocation()
      const startedLocation =
        startedLocationResult?.status === 'success' ? startedLocationResult.location : null
      const completedLocation =
        completedLocationResult.status === 'success' ? completedLocationResult.location : null

      const created = await createVehicleCheck({
        vehicleId,
        workerId: worker.id,
        inspectionDate,
        odometer: parsedOdometer,
        odometerUnit,
        notes,
        signatureFile,
        inspectionStartedAt: confirmedStartedAt,
        items,
        startedLocation,
        completedLocation,
      })
      setCompletedResult(created.overallResult)
      setSavedOffline(false)
      setStep('done')
    } catch (submitError) {
      setError(
        submitError instanceof OfflineMediaStorageError
          ? submitError.message
          : submitError instanceof VehicleChecksServiceError
            ? submitError.message
            : submitError instanceof Error
              ? submitError.message
              : 'Failed to save inspection.',
      )
    } finally {
      submitLockRef.current = false
      setIsSaving(false)
    }
  }

  const gateError = membershipError || workerError || vehiclesError
  const isBootLoading = companyLoading || workerLoading || vehiclesLoading
  const showOfflineNotPrepared =
    !isOnline && !offlineBootstrapReady && !vehiclesError && Boolean(worker) && companyReady

  if (isBootLoading) {
    return (
      <div className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Loading Vehicle Check…
      </div>
    )
  }

  if (!companyReady || !worker || gateError) {
    const offlinePrepareOnly =
      !isOnline &&
      !membershipError &&
      !vehiclesError &&
      (!worker || Boolean(workerError))

    return (
      <div className="mx-auto w-full max-w-lg space-y-4 pb-8">
        <div
          className={
            offlinePrepareOnly
              ? 'rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700'
              : 'rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'
          }
        >
          {offlinePrepareOnly
            ? OFFLINE_VEHICLE_CHECKS_NOT_PREPARED_MESSAGE
            : gateError || 'Unable to start a Vehicle Check right now.'}
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full rounded-2xl"
          onClick={() => navigate('/worker/vehicles')}
        >
          Back to Vehicles
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-8">
      {showOfflineNotPrepared ? (
        <div
          role="status"
          className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          {OFFLINE_VEHICLE_CHECKS_NOT_PREPARED_MESSAGE}
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === 'checklist') {
              requestExitToSetup()
              return
            }
            navigate('/worker/vehicles')
          }}
          className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">Vehicle Check</h1>
          <p className="text-sm text-slate-500">
            {step === 'setup'
              ? 'Select vehicle and start walkaround'
              : step === 'checklist'
                ? selectedVehicle
                  ? `Checklist for ${selectedVehicle.registration}`
                  : 'Mark each item as OK, Defect, or N/A'
                : 'Submitted'}
          </p>
        </div>
        {offlineQueue.pending > 0 ||
        offlineQueue.uploading > 0 ||
        offlineQueue.failed > 0 ||
        offlineQueue.syncing > 0 ||
        offlineQueue.isSyncing ? (
          <span
            role="status"
            aria-live="polite"
            className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-900"
          >
            Offline Queue ({offlineQueue.total})
          </span>
        ) : null}
      </div>

      {syncSuccessMessage ? (
        <aside
          role="status"
          aria-live="polite"
          className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-sm"
        >
          {syncSuccessMessage}
        </aside>
      ) : null}

      {offlineQueue.pending > 0 ||
      offlineQueue.uploading > 0 ||
      offlineQueue.failed > 0 ||
      offlineQueue.syncing > 0 ||
      offlineQueue.isSyncing ||
      isRetryingSync ? (
        <aside
          role="status"
          aria-live="polite"
          className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">Offline Queue</p>
              <p className="text-amber-900/85">
                {offlineQueue.pending} Pending
                {' · '}
                {Math.max(offlineQueue.uploading, offlineQueue.syncing, offlineQueue.isSyncing ? 1 : 0)}{' '}
                Uploading
                {' · '}
                {offlineQueue.failed} Failed
                {' · '}
                {offlineQueue.completed} Completed
              </p>
              {offlineQueue.progressLabel ? (
                <p className="text-xs text-amber-800/90">
                  {offlineQueue.currentItemId
                    ? `Syncing item ${offlineQueue.currentItemId.slice(0, 8)}… `
                    : ''}
                  {offlineQueue.progressLabel}
                  {offlineQueue.progressPercent != null
                    ? ` (${offlineQueue.progressPercent}%)`
                    : ''}
                </p>
              ) : null}
              {formatLastSyncAt(offlineQueue.lastSyncAt) ? (
                <p className="text-xs text-amber-800/80">
                  Last sync: {formatLastSyncAt(offlineQueue.lastSyncAt)}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 rounded-xl border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100/70"
              disabled={offlineQueue.isSyncing || isRetryingSync}
              onClick={() => {
                setIsRetryingSync(true)
                void offlineQueue
                  .retrySync()
                  .catch(() => {
                    // Errors stay on queue items; avoid sensitive console logs.
                  })
                  .finally(() => setIsRetryingSync(false))
              }}
            >
              {offlineQueue.isSyncing || isRetryingSync ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Retry
            </Button>
          </div>
          {offlineQueue.progressPercent != null && offlineQueue.isSyncing ? (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-300"
                style={{
                  width: `${Math.max(0, Math.min(100, offlineQueue.progressPercent))}%`,
                }}
              />
            </div>
          ) : null}
        </aside>
      ) : null}

      {!isOnline ? (
        <p
          role="status"
          className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
        >
          You are offline. Complete the full Vehicle Check with photos and signature — it will
          sync automatically when you are back online.
        </p>
      ) : null}

      {step === 'setup' ? (
        <aside
          role="note"
          aria-label="Tachograph driver card reminder"
          className="worker-vc-tacho-reminder flex items-start gap-3 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm shadow-sm"
        >
          <span
            className="worker-vc-tacho-icon flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"
            aria-hidden="true"
          >
            <CreditCard className="size-5" />
          </span>
          <div className="min-w-0 text-left">
            <p className="worker-vc-tacho-title font-semibold text-amber-950">
              Before starting your Daily Vehicle Check
            </p>
            <p className="worker-vc-tacho-body mt-0.5 text-amber-900/85">
              Make sure your driver card is inserted into the tachograph.
            </p>
            <p className="worker-vc-tacho-hint mt-1 text-xs text-amber-800/80">
              Do this before beginning the walkaround inspection.
            </p>
          </div>
        </aside>
      ) : null}

      {error ? (
        <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {step === 'setup' ? (
        <section className="space-y-4 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">
            Signed in as{' '}
            <span className="font-semibold text-slate-800">
              {worker.firstName} {worker.lastName}
            </span>
          </p>

          <form onSubmit={(event) => void handleContinue(event)} className="space-y-4">
            {selectedVehicle ? (
              <VehicleSummaryCard vehicle={selectedVehicle} onClear={clearSelectedVehicle} />
            ) : (
              <p className="text-sm text-slate-500">
                Search and select an active company vehicle to continue. A saved
                default is applied automatically when available.
              </p>
            )}

            {vehicles.length > 0 ? (
              <WorkerVehicleCombobox
                id="worker-vehicle-check-vehicle"
                vehicles={vehicles}
                selectedVehicleId={vehicleId || null}
                onSelect={(vehicle) => {
                  userClearedSelectionRef.current = false
                  setVehicleId(vehicle.id)
                  setRememberVehicle(getRememberedVehicleCheckId() === vehicle.id)
                  setError(null)
                }}
                onClear={clearSelectedVehicle}
                label="Select vehicle"
                placeholder="Search registration"
                inputAriaLabel="Search company vehicles by registration number"
                showSelectedSummary={false}
                required
              />
            ) : fleetReconnecting ? (
              <p
                role="status"
                className="flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800"
              >
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                Reconnecting… Loading company vehicles.
              </p>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No active company vehicles are available right now.
              </p>
            )}

            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={rememberVehicle}
                onChange={(event) => setRememberVehicle(event.target.checked)}
                className="size-4 rounded border-[#C5DFFB] text-[#2563EB] focus:ring-[#89CFF0]"
              />
              Remember this vehicle on this device
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Inspection date
              </span>
              <Input
                type="date"
                value={inspectionDate}
                onChange={(event) => setInspectionDate(event.target.value)}
                className="h-12 rounded-2xl"
                required
              />
            </label>

            <p className="flex items-start gap-1.5 text-xs text-slate-400">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Your location is recorded when this Vehicle Check starts and when it is completed.
            </p>

            <Button
              type="submit"
              disabled={isLoadingChecklist || vehicles.length === 0 || !selectedVehicle}
              className="h-12 w-full rounded-2xl bg-[#2563EB] text-base font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
            >
              {isLoadingChecklist ? <Loader2 className="size-4 animate-spin" /> : null}
              {isLoadingChecklist ? 'Loading checklist…' : 'Continue'}
            </Button>
          </form>
        </section>
      ) : null}

      {step === 'checklist' ? (
        <section className="worker-vc-flow min-w-0 w-full max-w-full space-y-4">
          {selectedVehicle ? <VehicleSummaryCard vehicle={selectedVehicle} /> : null}

          <form
            onSubmit={(event) => void handleSave(event)}
            className="worker-vc-panel space-y-4 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm"
          >
            {isLoadingChecklist ? (
              <p className="worker-vc-muted text-sm text-slate-500">Loading checklist…</p>
            ) : null}

            {startLocationStatus !== 'idle' ? (
              <p
                role="status"
                className="worker-vc-muted flex items-center gap-1.5 rounded-[10px] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500"
              >
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                {startLocationStatus === 'capturing'
                  ? 'Recording location…'
                  : startLocationStatus === 'success'
                    ? 'Location recorded'
                    : 'Location unavailable — you can continue'}
              </p>
            ) : null}

            {checklistNotice ? (
              <p className="worker-vc-notice rounded-[10px] bg-[#EEF6FF] px-3 py-2 text-sm text-[#0B68BE]">
                {checklistNotice}
              </p>
            ) : null}

            <VehicleCheckChecklistForm
              items={items}
              onChange={setItems}
              sections={checklistSections}
              emptyMessage={checklistNotice ?? undefined}
              highlightUnanswered={showChecklistValidation}
            />

            <label className="worker-vc-label block text-sm font-medium text-slate-700">
              Overall notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Additional notes about this inspection"
                className="mt-1.5 min-h-[4.5rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
              />
            </label>

            {items.length > 0 ? (
              <p className="worker-vc-muted text-sm text-slate-600">
                Overall result:{' '}
                <span className="worker-vc-title font-semibold text-[#2A376F]">
                  {overallResult === 'Advisory' ? 'Defects found' : 'Passed'}
                </span>
                {overallResult === 'Advisory' ? (
                  <span className="text-slate-400"> — one or more defects reported</span>
                ) : null}
              </p>
            ) : null}

            <VehicleCheckCompletionSection
              odometer={odometer}
              odometerUnit={odometerUnit}
              signatureFile={signatureFile}
              durationLabel={
                elapsedDurationSeconds != null
                  ? formatInspectionDuration(elapsedDurationSeconds)
                  : null
              }
              lastRecordedOdometer={selectedVehicle?.currentOdometer ?? null}
              showValidation={showCompletionValidation}
              disabled={isSaving || isLoadingChecklist}
              onOdometerChange={setOdometer}
              onOdometerUnitChange={setOdometerUnit}
              onSignatureChange={setSignatureFile}
            />

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="worker-vc-btn-back h-12 rounded-2xl"
                disabled={isSaving}
                onClick={() => {
                  requestExitToSetup()
                }}
              >
                <ChevronLeft className="mr-1 size-4" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSaving || isLoadingChecklist || !canSaveInspection}
                className="worker-vc-btn-complete h-12 rounded-2xl bg-[#2563EB] font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                {isSaving ? 'Completing Vehicle Check…' : 'Complete'}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 'done' ? (
        <section className="space-y-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-emerald-950">
              {savedOffline ? 'Vehicle Check saved offline' : 'Vehicle Check submitted'}
            </h2>
            <p className="mt-2 text-sm text-emerald-900/80">
              {savedOffline
                ? 'Vehicle Check saved offline. It will sync automatically.'
                : 'Saved for Admin review.'}
              {completedResult ? (
                <>
                  {' '}
                  Result:{' '}
                  <span className="font-bold">
                    {completedResult === 'Advisory' ? 'Defects found' : 'Passed'}
                  </span>
                </>
              ) : null}
            </p>
            {selectedVehicle ? (
              <p className="mt-1 text-sm text-emerald-900/80">{selectedVehicle.registration}</p>
            ) : null}
          </div>

          <Button
            type="button"
            className="h-12 w-full rounded-2xl bg-[#2563EB] font-semibold text-white"
            onClick={() => navigate('/worker/vehicles')}
          >
            Back to Vehicles
          </Button>

          <Link
            to={tyreCheckHref(vehicleId)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-100/70"
          >
            <CircleDot className="size-4" />
            Start Tyre Check
          </Link>
        </section>
      ) : null}

      <WorkerExitVehicleCheckDialog
        open={exitOpen}
        onContinue={handleContinueCheck}
        onExit={handleExitCheck}
      />
    </div>
  )
}
