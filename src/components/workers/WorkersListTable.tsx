import { Card, CardContent } from '@/components/ui/card'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import { WorkerAvatar } from '@/components/workers/WorkerAvatar'
import { WorkerCodeBadge } from '@/components/workers/WorkerCodeBadge'
import { WorkerComplianceBadge } from '@/components/workers/WorkerComplianceBadge'
import {
  WorkersPagination,
} from '@/components/workers/WorkersPagination'
import {
  adminSkeletonPulse,
  adminTableEntityName,
} from '@/lib/adminUiStyles'
import { getWorkerDefaultVehicleLabel } from '@/lib/workerProfileUtils'
import type { Driver, DriverRole, DriverStatus } from '@/services/driversService'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

const statusClassMap: Record<DriverStatus, string> = {
  Working:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
  'Off Duty':
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
  Holiday:
    'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900/60',
  Suspended:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
}

const roleClassMap: Record<DriverRole, string> = {
  Admin:
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60',
  Driver:
    'bg-[#E8F3FE] text-[#0B68BE] ring-[#C5DFFB]/70 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60',
  Yardman:
    'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-900/60',
  Cleaner:
    'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900/60',
  Supervisor:
    'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:ring-purple-900/60',
  Mechanic:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  'Transport Manager':
    'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900/60',
  Planner:
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900/60',
  'Office Staff':
    'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
  Warehouse:
    'bg-[#EEF6FF] text-[#3D7A9C] ring-[#C5DFFB]/70 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-900/60',
  Other:
    'bg-[#F1F5F9] text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
}

const workersTableCardClass =
  'overflow-hidden rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/92 shadow-[0_8px_24px_rgba(33,142,231,0.1),0_0_0_1px_rgba(197,223,251,0.35)] ring-1 ring-[#C5DFFB]/45 dark:border-white/10 dark:from-slate-900/70 dark:to-slate-900/60 dark:ring-white/10'

function getDriverName(driver: Driver): string {
  return `${driver.firstName} ${driver.lastName}`.trim()
}

function getWorkerProfilePath(driver: Driver): string {
  return `/drivers/${driver.id}`
}

function WorkerProfileLink({
  driver,
  className,
  children,
}: {
  driver: Driver
  className?: string
  children: ReactNode
}) {
  const workerName = getDriverName(driver)

  return (
    <Link
      to={getWorkerProfilePath(driver)}
      aria-label={`View worker profile for ${workerName}`}
      className={className}
    >
      {children}
    </Link>
  )
}

function DriverStatusBadge({ status }: { status: DriverStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClassMap[status]}`}
    >
      {status}
    </span>
  )
}

function WorkerRoleBadge({ role }: { role: DriverRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${roleClassMap[role] ?? roleClassMap.Other}`}
    >
      {role}
    </span>
  )
}

function DriverRowActions({
  driver,
  onEdit,
  onDelete,
}: {
  driver: Driver
  onEdit: () => void
  onDelete: () => void
}) {
  const actions: RowAction[] = [
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      to: getWorkerProfilePath(driver),
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: onEdit,
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: Trash2,
      tone: 'danger',
      onClick: onDelete,
    },
  ]

  return <RowActionsMenu actions={actions} appearance="workers" />
}

type WorkersListTableProps = {
  drivers: Driver[]
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onEditDriver: (driver: Driver) => void
  onDeleteDriver: (driver: Driver) => void
}

export function WorkersListTable({
  drivers,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  onEditDriver,
  onDeleteDriver,
}: WorkersListTableProps) {
  return (
    <Card className={workersTableCardClass}>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse">
            <thead>
              <tr className="border-b border-[#D3E9FC] bg-[#F5FAFF]/90 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B68BE] dark:bg-slate-800/70 dark:text-blue-300">
                <th className="px-6 py-4">Avatar</th>
                <th className="px-6 py-4">Worker ID</th>
                <th className="px-6 py-4">Worker</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Default Vehicle</th>
                <th className="px-6 py-4">Compliance</th>
                <th className="px-6 py-4">Status</th>
                <TableActionsHeader className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr
                  key={driver.id}
                  className="group border-b border-[#D3E9FC]/55 transition-all duration-200 last:border-b-0 hover:bg-[#F5FAFF]/95 hover:shadow-[inset_0_0_0_1px_rgba(191,227,245,0.45),0_4px_14px_rgba(33,142,231,0.06)] dark:hover:bg-slate-800/40"
                >
                  <td className="px-6 py-4">
                    <WorkerProfileLink
                      driver={driver}
                      className="inline-flex rounded-full no-underline transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/45 [&>div]:cursor-pointer [&>div]:transition-all [&>div]:duration-200 hover:[&>div]:-translate-y-0.5 hover:[&>div]:ring-[#218EE7] hover:[&>div]:shadow-[0_6px_16px_rgba(33,142,231,0.16)]"
                    >
                      <WorkerAvatar
                        firstName={driver.firstName}
                        lastName={driver.lastName}
                        avatarUrl={driver.avatarUrl}
                        size="sm"
                      />
                    </WorkerProfileLink>
                  </td>
                  <td className="px-6 py-4">
                    {driver.workerCode ? (
                      <WorkerProfileLink
                        driver={driver}
                        className="inline-flex rounded-full no-underline transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/45 [&>span]:cursor-pointer [&>span]:transition-all [&>span]:duration-200 hover:[&>span]:bg-[#E8F3FE] hover:[&>span]:ring-[#89CFF0]/80"
                      >
                        <WorkerCodeBadge code={driver.workerCode} />
                      </WorkerProfileLink>
                    ) : (
                      <WorkerCodeBadge code={driver.workerCode} />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="min-w-0">
                      <WorkerProfileLink
                        driver={driver}
                        className="block max-w-full rounded-sm no-underline transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40"
                      >
                        <p
                          className={`truncate ${adminTableEntityName} transition-colors duration-200 hover:text-[#0B68BE] dark:hover:text-blue-300`}
                        >
                          {getDriverName(driver)}
                        </p>
                      </WorkerProfileLink>
                      <p className="mt-1 truncate text-xs font-medium text-[#5499BF]/90 dark:text-slate-400">
                        {driver.email}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <WorkerRoleBadge role={driver.role} />
                  </td>
                  <td className="px-6 py-4">
                    <p className="max-w-[180px] truncate text-sm font-medium text-[#3D7A9C] dark:text-slate-300">
                      {getWorkerDefaultVehicleLabel(driver)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <WorkerComplianceBadge driver={driver} />
                  </td>
                  <td className="px-6 py-4">
                    <DriverStatusBadge status={driver.status} />
                  </td>
                  <TableActionsCell className="px-4 py-4">
                    <div className="rounded-lg opacity-70 transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 [&_button[aria-haspopup=menu]]:group-hover:bg-[rgba(59,130,246,0.08)] [&_button[aria-haspopup=menu]]:group-hover:text-[#0B68BE] [&_button[aria-haspopup=menu]]:group-hover:ring-1 [&_button[aria-haspopup=menu]]:group-hover:ring-[rgba(147,197,253,0.45)]">
                      <DriverRowActions
                        driver={driver}
                        onEdit={() => onEditDriver(driver)}
                        onDelete={() => onDeleteDriver(driver)}
                      />
                    </div>
                  </TableActionsCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <WorkersPagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </CardContent>
    </Card>
  )
}

export function WorkersListTableSkeleton() {
  return (
    <Card className={workersTableCardClass}>
      <CardContent className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={`flex items-center gap-4 rounded-2xl p-4 ${adminSkeletonPulse} bg-[#F8FBFF] dark:bg-slate-800/60`}
          >
            <div className="size-11 rounded-[15px] bg-blue-100 dark:bg-slate-700/60" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 rounded-full bg-blue-100 dark:bg-slate-700/60" />
              <div className="h-3 w-64 max-w-full rounded-full bg-blue-50 dark:bg-slate-700/40" />
            </div>
            <div className="hidden h-8 w-24 rounded-full bg-blue-100 dark:bg-slate-700/60 sm:block" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
