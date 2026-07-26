import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  isFutureIsoDate,
  isVehicleArchiveReason,
  todayIsoDateUtc,
  VEHICLE_ARCHIVE_REASONS,
  type VehicleArchiveReason,
} from '@/lib/vehicleArchive'
import type { Vehicle } from '@/services/vehiclesService'
import { useState } from 'react'

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

type ArchiveVehicleModalProps = {
  vehicle: Vehicle
  errorMessage: string | null
  isArchiving: boolean
  onCancel: () => void
  onConfirm: (input: { reason: VehicleArchiveReason; archiveDate: string }) => void
}

export function ArchiveVehicleModal({
  vehicle,
  errorMessage,
  isArchiving,
  onCancel,
  onConfirm,
}: ArchiveVehicleModalProps) {
  const [reason, setReason] = useState<VehicleArchiveReason | ''>('')
  const [archiveDate, setArchiveDate] = useState(todayIsoDateUtc())
  const [localError, setLocalError] = useState<string | null>(null)

  function handleConfirm() {
    setLocalError(null)
    if (!isVehicleArchiveReason(reason)) {
      setLocalError('Select an archive reason.')
      return
    }
    if (!archiveDate.trim()) {
      setLocalError('Archive date is required.')
      return
    }
    if (isFutureIsoDate(archiveDate)) {
      setLocalError('Archive date cannot be in the future.')
      return
    }
    onConfirm({ reason, archiveDate })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-950 dark:ring-white/10 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-500 dark:text-rose-400">
          Archive Vehicle
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-100">
          Archive this vehicle?
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
          {vehicle.registration || getVehicleName(vehicle)} will be archived and
          will no longer occupy an active Vehicle seat. Historical checks,
          consumables, reports and documents stay intact.
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-amber-700 dark:text-amber-300">
          Archiving this vehicle will remove its current Worker assignment.
          Historical records will be kept.
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {vehicle.registration}
          {getVehicleName(vehicle) ? ` · ${getVehicleName(vehicle)}` : ''}
        </p>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Archive reason <span className="text-rose-500">*</span>
            <select
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as VehicleArchiveReason | '')
              }
              disabled={isArchiving}
              className="mt-1.5 h-11 w-full rounded-[14px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-blue-100 outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/10"
            >
              <option value="">Select reason</option>
              {VEHICLE_ARCHIVE_REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Archive date <span className="text-rose-500">*</span>
            <Input
              type="date"
              value={archiveDate}
              max={todayIsoDateUtc()}
              disabled={isArchiving}
              onChange={(event) => setArchiveDate(event.target.value)}
              className="mt-1.5 h-11 rounded-[14px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium shadow-sm ring-1 ring-blue-100 dark:bg-slate-900/70 dark:ring-white/10"
            />
          </label>
        </div>

        {localError || errorMessage ? (
          <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50">
            {localError || errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isArchiving}
            className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB] dark:bg-slate-900/70 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-800/50 dark:hover:text-blue-300"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isArchiving}
            className="h-11 rounded-[16px] bg-rose-600 px-5 font-semibold text-white shadow-[0_14px_28px_rgba(225,29,72,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-rose-700 disabled:translate-y-0 disabled:opacity-70"
          >
            {isArchiving ? 'Archiving...' : 'Archive Vehicle'}
          </Button>
        </div>
      </div>
    </div>
  )
}
