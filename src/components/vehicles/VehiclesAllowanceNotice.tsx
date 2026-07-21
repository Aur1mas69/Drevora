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

  const expired = allowance.blockReason === 'expired'

  return (
    <div
      role="status"
      className={
        expired
          ? 'rounded-2xl border border-rose-200/90 bg-rose-50/90 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-950/30'
          : 'rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/30'
      }
    >
      <p
        className={
          expired
            ? 'text-sm font-semibold text-rose-900 dark:text-rose-100'
            : 'text-sm font-semibold text-amber-900 dark:text-amber-100'
        }
      >
        {allowance.title}
      </p>
      {allowance.countLabel ? (
        <p
          className={
            expired
              ? 'mt-1 text-sm font-medium text-rose-800/90 dark:text-rose-200/90'
              : 'mt-1 text-sm font-medium text-amber-800/90 dark:text-amber-200/90'
          }
        >
          {allowance.countLabel}
        </p>
      ) : null}
      {allowance.detail ? (
        <p
          className={
            expired
              ? 'mt-1 text-sm text-rose-800/80 dark:text-rose-200/80'
              : 'mt-1 text-sm text-amber-800/80 dark:text-amber-200/80'
          }
        >
          {allowance.detail}
        </p>
      ) : null}
    </div>
  )
}
