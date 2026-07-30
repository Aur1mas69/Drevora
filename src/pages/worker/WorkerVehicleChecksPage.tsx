import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  canCompleteVehicleCheck,
  VehicleCheckCompletionSection,
} from '@/components/vehicle-checks/VehicleCheckCompletionSection'
import { VehicleCheckChecklistForm } from '@/components/vehicle-checks/VehicleCheckChecklistForm'
import { WorkerVehicleCombobox } from '@/components/worker/WorkerVehicleCombobox'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import {
  formatInspectionDuration,
  isValidInspectionStartedAt,
} from '@/lib/vehicleCheckDurationUtils'
import {
  getRememberedVehicleCheckId,
  setRememberedVehicleCheckId,
} from '@/lib/vehicleCheckRememberedVehicle'
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
  createVehicleCheck,
  VehicleChecksServiceError,
} from '@/services/vehicleChecksService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
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
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

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
  return (
    <div className="rounded-[1.25rem] border border-[#C5DFFB]/80 bg-[#F5FAFF] px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5499BF]">
            Selected vehicle
          </p>
          <p className="mt-1 text-base font-bold tracking-[0.04em] text-[#113C69]">
            {vehicle.registration}
          </p>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Change vehicle"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#5499BF] transition-colors hover:bg-[#E3F0FF] hover:text-[#113C69]"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-sm font-medium text-[#3D7A9C]">{getVehicleMakeModelLabel(vehicle)}</p>
      <p className="mt-0.5 text-sm text-[#5499BF]">
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

/** Worker Vehicle Check flow — opened from Home or Vehicles. Owns vehicle selection. */
export default function WorkerVehicleChecksPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { worker, isLoading: workerLoading, error: workerError } = useCurrentWorker()
  const { companyReady, companyLoading, membershipError } = useCompanyTenantGate()

  const [step, setStep] = useState<FlowStep>('setup')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [vehiclesError, setVehiclesError] = useState<string | null>(null)

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
  /** Apply URL / default / remembered vehicle once after load — never re-lock the picker. */
  const didInitVehicleRef = useRef(false)
  const locationStatusHideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (locationStatusHideTimerRef.current != null) {
        window.clearTimeout(locationStatusHideTimerRef.current)
      }
    }
  }, [])

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

  /** Clear selection on this page — never bounce to Vehicles. */
  function clearSelectedVehicle() {
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
        return
      }

      setVehiclesLoading(true)
      setVehiclesError(null)
      try {
        const rows = await fetchVehicles()
        if (cancelled) return
        setVehicles(rows)

        // Optional initial selection only: route vehicleId, else a valid worker
        // default, else a valid device-remembered id. Never redirect when missing
        // or invalid — the in-page selector handles those cases.
        if (!didInitVehicleRef.current) {
          didInitVehicleRef.current = true
          const fromUrl = searchParams.get('vehicleId')?.trim() || ''
          const fromDefault = worker.defaultVehicleId?.trim() || ''
          const fromRemembered = getRememberedVehicleCheckId()?.trim() || ''
          const candidates = [fromUrl, fromDefault, fromRemembered].filter(Boolean)
          const matchId =
            candidates.find((id) => rows.some((row) => row.id === id)) ?? ''

          if (fromRemembered && !rows.some((row) => row.id === fromRemembered)) {
            setRememberedVehicleCheckId(null)
          }

          if (matchId) {
            setVehicleId(matchId)
            setRememberVehicle(fromRemembered === matchId)
          } else {
            setVehicleId('')
            setRememberVehicle(false)
          }
        }
      } catch (loadError) {
        if (cancelled) return
        setVehiclesError(
          loadError instanceof Error ? loadError.message : 'Unable to load vehicles.',
        )
      } finally {
        if (!cancelled) setVehiclesLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [companyLoading, companyReady, searchParams, worker, workerLoading])

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
      const checklist = await loadVehicleChecklist(vehicle.id, vehicle.vehicleType)
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

    if (!canCompleteVehicleCheck({ odometer, signatureFile })) {
      setShowCompletionValidation(true)
      setError('Please complete mileage and signature before saving.')
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
    if (Number.isNaN(parsedOdometer) || parsedOdometer < 0 || !signatureFile) {
      setShowCompletionValidation(true)
      setError('Please complete mileage and signature before saving.')
      return
    }

    const confirmedStartedAt = inspectionStartedAt as string

    submitLockRef.current = true
    setIsSaving(true)
    try {
      // One-shot GPS request immediately before the final save — part of the
      // same completion flow, never a separate/independent submission.
      const completedLocationResult = await captureVehicleCheckLocation()
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
        startedLocation:
          startedLocationResult?.status === 'success' ? startedLocationResult.location : null,
        completedLocation:
          completedLocationResult.status === 'success' ? completedLocationResult.location : null,
      })
      setCompletedResult(created.overallResult)
      setStep('done')
    } catch (submitError) {
      setError(
        submitError instanceof VehicleChecksServiceError
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

  if (isBootLoading) {
    return (
      <div className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Loading Vehicle Check…
      </div>
    )
  }

  if (!companyReady || !worker || gateError) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 pb-8">
        <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {gateError || 'Unable to start a Vehicle Check right now.'}
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === 'checklist') {
              setStep('setup')
              setInspectionStartedAt(null)
              setStartedLocationResult(null)
              setStartLocationStatus('idle')
              return
            }
            navigate('/worker/vehicles')
          }}
          className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0">
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
      </div>

      {step === 'setup' ? (
        <aside
          role="note"
          aria-label="Tachograph driver card reminder"
          className="flex items-start gap-3 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm shadow-sm"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"
            aria-hidden="true"
          >
            <CreditCard className="size-5" />
          </span>
          <div className="min-w-0 text-left">
            <p className="font-semibold text-amber-950">
              Before starting your Daily Vehicle Check
            </p>
            <p className="mt-0.5 text-amber-900/85">
              Make sure your driver card is inserted into the tachograph.
            </p>
            <p className="mt-1 text-xs text-amber-800/80">
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
                default is optional.
              </p>
            )}

            <WorkerVehicleCombobox
              id="worker-vehicle-check-vehicle"
              vehicles={vehicles}
              selectedVehicleId={vehicleId || null}
              onSelect={(vehicle) => {
                setVehicleId(vehicle.id)
                setRememberVehicle(getRememberedVehicleCheckId() === vehicle.id)
                setError(null)
              }}
              onClear={clearSelectedVehicle}
              label="Search registration"
              placeholder="Enter registration number"
              inputAriaLabel="Search company vehicles by registration number"
              required
              showAllWhenEmpty
              showSelectedSummary={false}
            />

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
        <section className="space-y-4">
          {selectedVehicle ? <VehicleSummaryCard vehicle={selectedVehicle} /> : null}

          <form
            onSubmit={(event) => void handleSave(event)}
            className="space-y-4 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm"
          >
            {isLoadingChecklist ? (
              <p className="text-sm text-slate-500">Loading checklist…</p>
            ) : null}

            {startLocationStatus !== 'idle' ? (
              <p
                role="status"
                className="flex items-center gap-1.5 rounded-[10px] bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500"
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
              <p className="rounded-[10px] bg-[#EEF6FF] px-3 py-2 text-sm text-[#0B68BE]">
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

            <label className="block text-sm font-medium text-slate-700">
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
              <p className="text-sm text-slate-600">
                Overall result:{' '}
                <span className="font-semibold text-[#2A376F]">
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
                className="h-12 rounded-2xl"
                disabled={isSaving}
                onClick={() => {
                  setStep('setup')
                  setInspectionStartedAt(null)
                  setStartedLocationResult(null)
                  setStartLocationStatus('idle')
                }}
              >
                <ChevronLeft className="mr-1 size-4" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSaving || isLoadingChecklist || !canSaveInspection}
                className="h-12 rounded-2xl bg-[#2563EB] font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
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
            <h2 className="text-xl font-semibold text-emerald-950">Vehicle Check submitted</h2>
            <p className="mt-2 text-sm text-emerald-900/80">
              Saved for Admin review.
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
    </div>
  )
}
