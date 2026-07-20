import type { VehicleAllowanceSnapshot } from '@/lib/vehicleAllowance'

type VehiclesAllowanceNoticeProps = {
  allowance: VehicleAllowanceSnapshot
}

/**
 * Compact allowance status for Grid and List.
 * Not a large Plan Usage banner.
 */
export function VehiclesAllowanceNotice({
  allowance,
}: VehiclesAllowanceNoticeProps) {
  if (allowance.canAddVehicle) {
    if (!allowance.countLabel) return null
    return (
      <p
        className="text-sm font-medium text-[#5499BF] dark:text-slate-400"
        aria-live="polite"
      >
        {allowance.countLabel}
      </p>
    )
  }

  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/30"
    >
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
        {allowance.title}
      </p>
      {allowance.countLabel ? (
        <p className="mt-1 text-sm font-medium text-amber-800/90 dark:text-amber-200/90">
          {allowance.countLabel}
        </p>
      ) : null}
      {allowance.detail ? (
        <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
          {allowance.detail}
        </p>
      ) : null}
    </div>
  )
}
