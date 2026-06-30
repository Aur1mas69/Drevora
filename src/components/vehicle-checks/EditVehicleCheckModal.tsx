import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VehicleCheckChecklistForm } from '@/components/vehicle-checks/VehicleCheckChecklistForm'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { VehicleCheck, VehicleCheckItemInput, VehicleCheckStatus, VehicleChecklistSection } from '@/lib/vehicleCheckTypes'
import {
  canSubmitVehicleChecklist,
  loadVehicleChecklist,
  type VehicleChecklistLoadStatus,
} from '@/lib/vehicleCheckTemplateLoader'
import { computeOverallResult } from '@/lib/vehicleCheckUtils'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type EditVehicleCheckModalProps = {
  check: VehicleCheck | null
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
    status: VehicleCheckStatus
    notes: string
    items: VehicleCheckItemInput[]
  }) => Promise<void>
}

const selectClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

const STATUS_OPTIONS: VehicleCheckStatus[] = ['Completed', 'Pending', 'In Progress']

export function EditVehicleCheckModal({
  check,
  isOpen,
  vehicles,
  drivers,
  isSaving = false,
  onClose,
  onSubmit,
}: EditVehicleCheckModalProps) {
  const { formatDate } = useCompanySettings()
  const [vehicleId, setVehicleId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [odometer, setOdometer] = useState('')
  const [inspectionDate, setInspectionDate] = useState('')
  const [status, setStatus] = useState<VehicleCheckStatus>('Completed')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<VehicleCheckItemInput[]>([])
  const [checklistSections, setChecklistSections] = useState<VehicleChecklistSection[]>([])
  const [checklistNotice, setChecklistNotice] = useState<string | null>(null)
  const [checklistStatus, setChecklistStatus] = useState<VehicleChecklistLoadStatus>('missing_vehicle_type')
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialVehicleIdRef = useRef<string | null>(null)
  const itemsRef = useRef<VehicleCheckItemInput[]>([])

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

  itemsRef.current = items

  useEffect(() => {
    if (!isOpen || !check) return

    const activeCheck = check
    initialVehicleIdRef.current = activeCheck.vehicleId
    setVehicleId(activeCheck.vehicleId)
    setWorkerId(activeCheck.workerId)
    setOdometer(activeCheck.odometer != null ? String(activeCheck.odometer) : '')
    setInspectionDate(activeCheck.inspectionDate)
    setStatus(activeCheck.status)
    setNotes(activeCheck.notes ?? '')
    setError(null)

    const savedItems = activeCheck.items.map((item) => ({
      category: item.category,
      itemName: item.itemName,
      result: item.result,
      comment: item.comment ?? '',
      photoUrl: item.photoUrl,
    }))
    itemsRef.current = savedItems
    setItems(savedItems)

    let cancelled = false

    async function initChecklist() {
      setIsLoadingChecklist(true)
      setChecklistSections([])
      setChecklistNotice(null)
      setChecklistStatus('missing_vehicle_type')

      try {
        const vehicle = vehicles.find((entry) => entry.id === activeCheck.vehicleId)
        const checklist = await loadVehicleChecklist(
          activeCheck.vehicleId,
          vehicle?.vehicleType,
          savedItems,
        )

        if (cancelled) return

        setItems(checklist.items)
        setChecklistSections(checklist.sections)
        setChecklistNotice(checklist.notice)
        setChecklistStatus(checklist.status)
        itemsRef.current = checklist.items
      } catch (loadError) {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load inspection checklist.',
        )
      } finally {
        if (!cancelled) setIsLoadingChecklist(false)
      }
    }

    void initChecklist()

    return () => {
      cancelled = true
    }
  }, [check, isOpen, vehicles])

  useEffect(() => {
    if (!isOpen || !vehicleId || vehicleId === initialVehicleIdRef.current) return

    let cancelled = false

    async function reloadChecklist() {
      setIsLoadingChecklist(true)
      setError(null)

      try {
        const checklist = await loadVehicleChecklist(
          vehicleId,
          selectedVehicle?.vehicleType,
          itemsRef.current,
        )

        if (cancelled) return

        setItems(checklist.items)
        setChecklistSections(checklist.sections)
        setChecklistNotice(checklist.notice)
        setChecklistStatus(checklist.status)
        itemsRef.current = checklist.items
      } catch (loadError) {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load inspection checklist.',
        )
      } finally {
        if (!cancelled) setIsLoadingChecklist(false)
      }
    }

    void reloadChecklist()

    return () => {
      cancelled = true
    }
  }, [vehicleId, isOpen, selectedVehicle?.vehicleType])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen || !check) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsedOdometer = odometer.trim() ? Number.parseInt(odometer, 10) : null
    if (odometer.trim() && (parsedOdometer === null || Number.isNaN(parsedOdometer))) {
      setError('Mileage must be a valid number.')
      return
    }

    if (!canSubmitVehicleChecklist(checklistStatus, items)) {
      setError(checklistNotice ?? 'Inspection checklist cannot be empty.')
      return
    }

    try {
      await onSubmit({
        vehicleId,
        workerId,
        inspectionDate,
        odometer: parsedOdometer,
        status,
        notes,
        items,
      })
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to update inspection.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-[18px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-vehicle-check-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[rgba(75,120,220,0.10)] px-5 py-4 sm:px-6">
          <div>
            <h2
              id="edit-vehicle-check-title"
              className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]"
            >
              Edit Inspection
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {check.vehicleRegistration} · {formatDate(check.inspectionDate)}
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

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Vehicle
                <select
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  className={selectClassName}
                  required
                >
                  {sortedVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration}
                      {vehicle.fleetNumber ? ` · ${vehicle.fleetNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Driver
                <select
                  value={workerId}
                  onChange={(event) => setWorkerId(event.target.value)}
                  className={selectClassName}
                  required
                >
                  {sortedDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.firstName} {driver.lastName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Mileage
                <Input
                  type="number"
                  min={0}
                  value={odometer}
                  onChange={(event) => setOdometer(event.target.value)}
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

              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as VehicleCheckStatus)}
                  className={selectClassName}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <VehicleCheckChecklistForm
              items={items}
              onChange={setItems}
              sections={checklistSections.length > 0 ? checklistSections : undefined}
              emptyMessage={checklistNotice ?? undefined}
            />

            {isLoadingChecklist ? (
              <p className="text-sm text-slate-500">Loading checklist…</p>
            ) : null}

            <label className="block text-sm font-medium text-slate-700">
              Overall notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <p className="text-sm text-slate-600">
              Overall result:{' '}
              <span className="font-semibold text-[#2A376F]">{overallResult}</span>
            </p>

            {error ? (
              <p className="rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[rgba(75,120,220,0.10)] px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSaving ||
                isLoadingChecklist ||
                !canSubmitVehicleChecklist(checklistStatus, items)
              }
              className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
