import type { Driver, DriverRole } from '@/services/driversService'

export type WorkerRoleQuickFilter =
  | 'total'
  | 'drivers'
  | 'office'
  | 'garage'
  | 'managers'

export type WorkerRoleSummaryStats = {
  total: number
  drivers: number
  office: number
  garage: number
  managers: number
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase()
}

/** Exact DriverRole values used by Office / Admin card. */
export const WORKER_OFFICE_ROLES: DriverRole[] = ['Admin', 'Office Staff']

/** Exact DriverRole values used by Garage / Workshop card. */
export const WORKER_GARAGE_ROLES: DriverRole[] = ['Mechanic']

/** Exact DriverRole values used by Managers card. */
export const WORKER_MANAGER_ROLES: DriverRole[] = ['Transport Manager', 'Supervisor']

export function workerMatchesRoleQuickFilter(
  role: DriverRole,
  filter: WorkerRoleQuickFilter | null,
): boolean {
  if (!filter || filter === 'total') return true

  const normalized = normalizeRole(role)

  switch (filter) {
    case 'drivers':
      return normalized === 'driver'
    case 'office':
      return (
        normalized === 'admin' ||
        normalized === 'office staff' ||
        normalized.includes('office')
      )
    case 'garage':
      return (
        normalized === 'mechanic' ||
        normalized.includes('garage') ||
        normalized.includes('workshop') ||
        normalized.includes('mechanic')
      )
    case 'managers':
      return (
        normalized === 'transport manager' ||
        normalized === 'supervisor' ||
        normalized.includes('manager') ||
        normalized.includes('director')
      )
    default:
      return true
  }
}

export function computeWorkerRoleSummaryStats(
  workers: Pick<Driver, 'role'>[],
): WorkerRoleSummaryStats {
  return {
    total: workers.length,
    drivers: workers.filter((worker) => workerMatchesRoleQuickFilter(worker.role, 'drivers'))
      .length,
    office: workers.filter((worker) => workerMatchesRoleQuickFilter(worker.role, 'office'))
      .length,
    garage: workers.filter((worker) => workerMatchesRoleQuickFilter(worker.role, 'garage'))
      .length,
    managers: workers.filter((worker) =>
      workerMatchesRoleQuickFilter(worker.role, 'managers'),
    ).length,
  }
}
