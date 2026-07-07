import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VehicleCheckChecklistForm } from '@/components/vehicle-checks/VehicleCheckChecklistForm'
import type { VehicleCheckItemInput, VehicleChecklistSection } from '@/lib/vehicleCheckTypes'
import {
  canSubmitVehicleChecklist,
  loadVehicleChecklist,
  type VehicleChecklistLoadStatus,
} from '@/lib/vehicleCheckTemplateLoader'
import { computeOverallResult, todayIsoDate } from '@/lib/vehicleCheckUtils'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
    odometer: number | null
    notes: string
    items: VehicleCheckItemInput[]
  }) => Promise<void>
}

const selectClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

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
  const [workerId, setWorkerId] = useState('')
  const [odometer, setOdometer] = useState('')
  const [inspectionDate, setInspectionDate] = useState(todayIsoDate())
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<VehicleCheckItemInput[]>([])
  const [checklistSections, setChecklistSections] = useState<VehicleChecklistSection[]>([])
  const [checklistNotice, setChecklistNotice] = useState<string | null>(null)
  const [checklistStatus, setChecklistStatus] = useState<VehicleChecklistLoadStatus>('missing_vehicle_type')
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => a.registration.localeCompare(b.registration)),
    [vehicles],
  )

  const sortedDrivers = useMemo(
    () =>
      [...drivers].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [drivers],
  )

  const selectedVehicle = useMemo(
    () => sortedVehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
    [sortedVehicles, vehicleId],
  )

  const overallResult = useMemo(() => computeOverallResult(items), [items])

  useEffect(() => {
    if (!isOpen) return
    setStep(1)
    setVehicleId(sortedVehicles[0]?.id ?? '')
    setWorkerId(sortedDrivers[0]?.id ?? '')
    setOdometer('')
    setInspectionDate(todayIsoDate())
    setNotes('')
    setItems([])
    setChecklistSections([])
    setChecklistNotice(null)
    setChecklistStatus('missing_vehicle_type')
    setIsLoadingChecklist(false)
    setError(null)
  }, [isOpen, sortedDrivers, sortedVehicles])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen) return null

  async function handleContinue(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!vehicleId || !workerId) {
      setError('Please select a vehicle and worker.')
      return
    }

    if (!inspectionDate) {
      setError('Inspection date is required.')
      return
    }

    setIsLoadingChecklist(true)
    try {
      const checklist = await loadVehicleChecklist(
        vehicleId,
        selectedVehicle?.vehicleType,
      )
      setItems(checklist.items)
      setChecklistSections(checklist.sections)
      setChecklistNotice(checklist.notice)
      setChecklistStatus(checklist.status)
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

    if (!canSubmitVehicleChecklist(checklistStatus, items)) {
      setError(checklistNotice ?? 'Inspection checklist cannot be empty.')
      return
    }

    const parsedOdometer = odometer.trim() ? Number.parseInt(odometer, 10) : null
    if (odometer.trim() && (parsedOdometer === null || Number.isNaN(parsedOdometer))) {
      setError('Mileage must be a valid number.')
      return
    }

    try {
      await onSubmit({
        vehicleId,
        workerId,
        inspectionDate,
        odometer: parsedOdometer,
        notes,
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
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-[18px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-vehicle-check-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[rgba(75,120,220,0.10)] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Step {step} of 2
            </p>
            <h2
              id="new-vehicle-check-title"
              className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#2A376F]"
            >
              {step === 1 ? 'Inspection details' : 'Inspection checklist'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {step === 1
                ? 'Select the vehicle, worker and inspection date.'
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
              <label className="block text-sm font-medium text-slate-700">
                Vehicle
                <select
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  className={selectClassName}
                  required
                >
                  {sortedVehicles.length === 0 ? (
                    <option value="">No vehicles available</option>
                  ) : (
                    sortedVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.registration}
                        {vehicle.fleetNumber ? ` · ${vehicle.fleetNumber}` : ''}
                      </option>
                    ))
                  )}
                </select>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Mileage
                  <Input
                    type="number"
                    min={0}
                    value={odometer}
                    onChange={(event) => setOdometer(event.target.value)}
                    placeholder="Odometer reading"
                    className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]"
                  />
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
              </div>
            </form>
          ) : (
            <form id="vehicle-check-step-2" onSubmit={(event) => void handleSave(event)}>
              {isLoadingChecklist ? (
                <p className="mb-3 text-sm text-slate-500">Loading checklist…</p>
              ) : null}

              <VehicleCheckChecklistForm
                items={items}
                onChange={setItems}
                sections={checklistSections}
                emptyMessage={checklistNotice ?? undefined}
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
              onClick={() => setStep(1)}
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
                disabled={
                  sortedVehicles.length === 0 ||
                  sortedDrivers.length === 0 ||
                  isLoadingChecklist
                }
                className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
              >
                {isLoadingChecklist ? 'Loading checklist…' : 'Continue'}
              </Button>
            ) : (
              <Button
                type="submit"
                form="vehicle-check-step-2"
                disabled={
                  isSaving ||
                  isLoadingChecklist ||
                  !canSubmitVehicleChecklist(checklistStatus, items)
                }
                className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
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
