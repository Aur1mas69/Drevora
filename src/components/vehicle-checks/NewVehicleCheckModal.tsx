import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  canCompleteVehicleCheck,
  VehicleCheckCompletionSection,
} from '@/components/vehicle-checks/VehicleCheckCompletionSection'
import { VehicleCheckChecklistForm } from '@/components/vehicle-checks/VehicleCheckChecklistForm'
import type { VehicleCheckItemInput, VehicleChecklistSection, VehicleCheckOdometerUnit } from '@/lib/vehicleCheckTypes'
import { DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT } from '@/lib/vehicleCheckTypes'
import {
  formatInspectionDuration,
  isValidInspectionStartedAt,
} from '@/lib/vehicleCheckDurationUtils'
import {
  canSubmitVehicleChecklist,
  loadVehicleChecklist,
  type VehicleChecklistLoadStatus,
} from '@/lib/vehicleCheckTemplateLoader'
import {
  getRememberedVehicleCheckId,
  setRememberedVehicleCheckId,
} from '@/lib/vehicleCheckRememberedVehicle'
import { computeOverallResult, isChecklistFullyAnswered, todayIsoDate } from '@/lib/vehicleCheckUtils'
import {
  findVehicleByRegistrationQuery,
  vehicleMatchesRegistrationQuery,
} from '@/lib/vehicleRegistrationSearch'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { ChevronLeft, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type NewVehicleCheckModalProps = {
  isOpen: boolean
  vehicles: Vehicle[]
  drivers: Driver[]
  isSaving?: boolean
  onClose: () => void
  onSubmit: (input: {
    vehicleId: string
    workerId: string
    inspectionDate: string
    odometer: number
    odometerUnit: VehicleCheckOdometerUnit
    notes: string
    signatureFile: File
    inspectionStartedAt: string
    items: VehicleCheckItemInput[]
  }) => Promise<void>
}

const selectClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

function getVehicleMakeModelLabel(vehicle: Vehicle): string {
  const label = `${vehicle.make} ${vehicle.model}`.trim()
  return label || 'Make/model not set'
}

function VehicleSummaryCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="rounded-[12px] border border-[#C5DFFB]/80 bg-[#F5FAFF] px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5499BF]">
        Selected vehicle
      </p>
      <p className="mt-1 text-base font-bold tracking-[0.04em] text-[#113C69]">
        {vehicle.registration}
      </p>
      <p className="mt-1 text-sm font-medium text-[#3D7A9C]">{getVehicleMakeModelLabel(vehicle)}</p>
      <p className="mt-0.5 text-sm text-[#5499BF]">
        Type: {vehicle.vehicleType?.trim() || 'Not set on vehicle record'}
      </p>
    </div>
  )
}

export function NewVehicleCheckModal({
  isOpen,
  vehicles,
  drivers,
  isSaving = false,
  onClose,
  onSubmit,
}: NewVehicleCheckModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [vehicleId, setVehicleId] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [showVehicleResults, setShowVehicleResults] = useState(false)
  const [rememberVehicle, setRememberVehicle] = useState(false)
  const [workerId, setWorkerId] = useState('')
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
  const [checklistStatus, setChecklistStatus] = useState<VehicleChecklistLoadStatus>('missing_vehicle_type')
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showChecklistValidation, setShowChecklistValidation] = useState(false)
  const [showCompletionValidation, setShowCompletionValidation] = useState(false)
  const vehicleSearchRef = useRef<HTMLDivElement>(null)

  const sortedDrivers = useMemo(
    () =>
      [...drivers].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [drivers],
  )

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
    [vehicleId, vehicles],
  )

  const rememberedVehicle = useMemo(() => {
    const rememberedId = getRememberedVehicleCheckId()
    if (!rememberedId) return null
    return vehicles.find((vehicle) => vehicle.id === rememberedId) ?? null
  }, [vehicles, isOpen])

  const filteredVehicles = useMemo(() => {
    const matches = vehicles.filter((vehicle) =>
      vehicleMatchesRegistrationQuery(vehicle, vehicleSearch),
    )

    return [...matches].sort((a, b) => a.registration.localeCompare(b.registration))
  }, [vehicleSearch, vehicles])

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

  function selectVehicle(vehicle: Vehicle) {
    setVehicleId(vehicle.id)
    setVehicleSearch(vehicle.registration)
    setShowVehicleResults(false)
    setError(null)
  }

  useEffect(() => {
    if (!isOpen) return
    setStep(1)
    setVehicleId('')
    setVehicleSearch('')
    setShowVehicleResults(false)
    setWorkerId(sortedDrivers[0]?.id ?? '')
    setOdometer('')
    setOdometerUnit(DEFAULT_VEHICLE_CHECK_ODOMETER_UNIT)
    setSignatureFile(null)
    setInspectionStartedAt(null)
    setInspectionDate(todayIsoDate())
    setNotes('')
    setItems([])
    setChecklistSections([])
    setChecklistNotice(null)
    setChecklistStatus('missing_vehicle_type')
    setIsLoadingChecklist(false)
    setError(null)
    setShowChecklistValidation(false)
    setShowCompletionValidation(false)

    const remembered = rememberedVehicle
    setRememberVehicle(Boolean(remembered))
  }, [isOpen, rememberedVehicle, sortedDrivers])

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
    if (step !== 2 || !selectedVehicle?.currentOdometer || odometer.trim()) return
    setOdometer(String(selectedVehicle.currentOdometer))
  }, [step, selectedVehicle, odometer])

  useEffect(() => {
    if (step !== 2 || !inspectionStartedAt) return

    const intervalId = window.setInterval(() => {
      setDurationNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [step, inspectionStartedAt])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    function handlePointerDown(event: MouseEvent) {
      if (!vehicleSearchRef.current?.contains(event.target as Node)) {
        setShowVehicleResults(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isOpen, isSaving, onClose])

  if (!isOpen) return null

  async function handleContinue(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const exactMatch = findVehicleByRegistrationQuery(vehicles, vehicleSearch)
    const vehicle = selectedVehicle ?? exactMatch

    if (!vehicle) {
      setError('Search and select a vehicle by number plate.')
      return
    }

    if (vehicle.id !== vehicleId) {
      setVehicleId(vehicle.id)
      setVehicleSearch(vehicle.registration)
    }

    if (!workerId) {
      setError('Please select a worker.')
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
      setDurationNowMs(Date.now())
      setStep(2)
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

    if (!vehicleId || !workerId) {
      setError('Please select a vehicle and worker.')
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
      setError('Inspection duration could not be calculated. Return to Step 1 and open the checklist again.')
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

    try {
      await onSubmit({
        vehicleId,
        workerId,
        inspectionDate,
        odometer: parsedOdometer,
        odometerUnit,
        notes,
        signatureFile,
        inspectionStartedAt: confirmedStartedAt,
        items,
      })
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to save inspection.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-[18px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-900/95 dark:ring-white/10 dark:shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-vehicle-check-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[rgba(75,120,220,0.10)] px-5 py-4 dark:border-white/10 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Step {step} of 2
            </p>
            <h2
              id="new-vehicle-check-title"
              className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100"
            >
              {step === 1 ? 'Inspection details' : 'Inspection checklist'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {step === 1
                ? 'Search by number plate, then confirm the vehicle details.'
                : selectedVehicle
                  ? `Checklist for ${selectedVehicle.registration}${
                      selectedVehicle.vehicleType ? ` · ${selectedVehicle.vehicleType}` : ''
                    }`
                  : 'Mark each item as Pass, Advisory or Fail.'}
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

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {step === 1 ? (
            <form id="vehicle-check-step-1" onSubmit={(event) => void handleContinue(event)} className="space-y-4">
              {rememberedVehicle ? (
                <div className="rounded-[12px] border border-[#D3E9FC] bg-[#FAFCFF] p-3 dark:border-white/10 dark:bg-slate-800/60">
                  <p className="text-xs font-semibold text-[#5499BF]">Quick select</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => selectVehicle(rememberedVehicle)}
                    className="mt-2 h-10 w-full justify-start rounded-[12px] border-[#C5DFFB] bg-white px-3 text-left text-sm font-semibold text-[#113C69] hover:bg-[#F5FAFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/50"
                  >
                    {rememberedVehicle.registration}
                    <span className="ml-2 font-normal text-[#5499BF]">
                      {getVehicleMakeModelLabel(rememberedVehicle)}
                      {rememberedVehicle.vehicleType ? ` · ${rememberedVehicle.vehicleType}` : ''}
                    </span>
                  </Button>
                </div>
              ) : null}

              <div ref={vehicleSearchRef} className="relative">
                <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle-check-search">
                  Number plate
                </label>
                <div className="relative mt-1.5">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5499BF]"
                    aria-hidden="true"
                  />
                  <Input
                    id="vehicle-check-search"
                    type="search"
                    value={vehicleSearch}
                    onChange={(event) => {
                      setVehicleSearch(event.target.value)
                      setVehicleId('')
                      setShowVehicleResults(true)
                      setError(null)
                    }}
                    onFocus={() => setShowVehicleResults(true)}
                    placeholder="Search registration, e.g. PN23 JUF"
                    autoComplete="off"
                    className="h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] pl-9"
                  />
                </div>

                {showVehicleResults && vehicleSearch.trim() ? (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-[12px] border border-[#C5DFFB] bg-white py-1 shadow-lg dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40">
                    {filteredVehicles.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">No vehicles match that number plate.</p>
                    ) : (
                      filteredVehicles.map((vehicle) => (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() => selectVehicle(vehicle)}
                          className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-[#F5FAFF] dark:hover:bg-slate-800/50 ${
                            vehicle.id === vehicleId ? 'bg-[#EEF6FF]' : ''
                          }`}
                        >
                          <span className="font-semibold text-[#113C69] dark:text-slate-100">{vehicle.registration}</span>
                          <span className="text-xs text-[#5499BF]">
                            {getVehicleMakeModelLabel(vehicle)}
                            {vehicle.vehicleType ? ` · ${vehicle.vehicleType}` : ''}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              {selectedVehicle ? <VehicleSummaryCard vehicle={selectedVehicle} /> : null}

              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={rememberVehicle}
                  onChange={(event) => setRememberVehicle(event.target.checked)}
                  className="size-4 rounded border-[#C5DFFB] text-[#2563EB] focus:ring-[#89CFF0]"
                />
                Remember this vehicle on this device
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Worker
                <select
                  value={workerId}
                  onChange={(event) => setWorkerId(event.target.value)}
                  className={selectClassName}
                  required
                >
                  {sortedDrivers.length === 0 ? (
                    <option value="">No workers available</option>
                  ) : (
                    sortedDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.firstName} {driver.lastName}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Inspection date
                <Input
                  type="date"
                  value={inspectionDate}
                  onChange={(event) => setInspectionDate(event.target.value)}
                  className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]"
                  required
                />
              </label>
            </form>
          ) : (
            <form id="vehicle-check-step-2" onSubmit={(event) => void handleSave(event)}>
              {selectedVehicle ? (
                <div className="mb-4">
                  <VehicleSummaryCard vehicle={selectedVehicle} />
                </div>
              ) : null}

              {isLoadingChecklist ? (
                <p className="mb-3 text-sm text-slate-500">Loading checklist…</p>
              ) : null}

              {checklistNotice ? (
                <p className="mb-3 rounded-[10px] bg-[#EEF6FF] px-3 py-2 text-sm text-[#0B68BE]">
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

              <label className="mt-4 block text-sm font-medium text-slate-700">
                Overall notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Additional notes about this inspection"
                  className="mt-1.5 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {items.length > 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  Overall result:{' '}
                  <span className="font-semibold text-[#2A376F]">{overallResult}</span>
                  {overallResult === 'Fail' ? (
                    <span className="text-slate-400"> — one or more items failed</span>
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
            </form>
          )}

          {error ? (
            <p className="mt-4 rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-[rgba(75,120,220,0.10)] px-5 py-4 sm:px-6">
          {step === 2 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep(1)
                setInspectionStartedAt(null)
              }}
              disabled={isSaving}
              className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600"
            >
              <ChevronLeft className="mr-1 size-4" />
              Back
            </Button>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600"
            >
              Cancel
            </Button>
            {step === 1 ? (
              <Button
                type="submit"
                form="vehicle-check-step-1"
                disabled={sortedDrivers.length === 0 || isLoadingChecklist}
                className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
              >
                {isLoadingChecklist ? 'Loading checklist…' : 'Continue'}
              </Button>
            ) : (
              <Button
                type="submit"
                form="vehicle-check-step-2"
                disabled={isSaving || isLoadingChecklist || !canSaveInspection}
                className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Save Inspection'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
