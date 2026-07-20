import { WorkerAvatar } from '@/components/workers/WorkerAvatar'
import { WorkerCodeBadge } from '@/components/workers/WorkerCodeBadge'
import { WorkerComplianceBadge } from '@/components/workers/WorkerComplianceBadge'
import {
  resolveWorkerCardAccent,
  workerCardAvatarClass,
  workerCardCompliancePanelClass,
  workerCardMetaLabelClass,
  workerCardMissingInfoBadgeClass,
  workerCardShellClass,
  workerCardTopAccentClass,
} from '@/components/workers/workerCardAccentStyles'
import {
  RowActionsMenu,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import {
  computeWorkerComplianceStatus,
  getWorkerDefaultVehicleLabel,
} from '@/lib/workerProfileUtils'
import type { Driver, DriverRole, DriverStatus } from '@/services/driversService'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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

function getDriverName(driver: Driver): string {
  return `${driver.firstName} ${driver.lastName}`.trim()
}

function getWorkerProfilePath(driver: Driver): string {
  return `/drivers/${driver.id}`
}

type WorkerCardProps = {
  driver: Driver
  onEdit: (driver: Driver) => void
  onDelete: (driver: Driver) => void
}

export function WorkerCard({ driver, onEdit, onDelete }: WorkerCardProps) {
  const navigate = useNavigate()
  const workerName = getDriverName(driver)
  const profilePath = getWorkerProfilePath(driver)
  const vehicleLabel = getWorkerDefaultVehicleLabel(driver)
  const email = driver.email?.trim() || ''
  const isArchived = driver.archivedAt != null
  const compliance = computeWorkerComplianceStatus(driver)
  const accent = resolveWorkerCardAccent({
    status: driver.status,
    compliance,
    archived: isArchived,
  })
  const metaLabelClass = workerCardMetaLabelClass[accent]

  const actions: RowAction[] = [
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      to: profilePath,
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: () => onEdit(driver),
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: Trash2,
      tone: 'danger',
      onClick: () => onDelete(driver),
    },
  ]

  function openProfile() {
    navigate(profilePath)
  }

  return (
    <article
      className={`group relative flex h-full min-h-[176px] flex-col overflow-hidden rounded-xl p-2.5 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-[#3B82F6]/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${workerCardShellClass[accent]}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${workerCardTopAccentClass[accent]}`}
      />

      <div className="relative flex items-start justify-between gap-1.5">
        <button
          type="button"
          onClick={openProfile}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/45"
          aria-label={`View worker profile for ${workerName}`}
        >
          <WorkerAvatar
            firstName={driver.firstName}
            lastName={driver.lastName}
            avatarUrl={driver.avatarUrl}
            size="sm"
            className={workerCardAvatarClass[accent]}
          />
        </button>

        <div
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <RowActionsMenu actions={actions} appearance="workers" align="end" />
        </div>
      </div>

      <button
        type="button"
        onClick={openProfile}
        className="relative mt-2 flex min-w-0 flex-1 flex-col items-stretch rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40"
        aria-label={`${workerName}, ${driver.role}, ${driver.status}${isArchived ? ', Archived' : ''}, compliance ${compliance}, vehicle ${vehicleLabel}`}
      >
        <p className="truncate text-[13px] font-semibold leading-snug tracking-[-0.02em] text-[#113C69] transition-colors group-hover:text-[#0B68BE] dark:text-slate-100 dark:group-hover:text-blue-300">
          {workerName}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {driver.workerCode ? (
            <WorkerCodeBadge
              code={driver.workerCode}
              className="px-2 py-0.5 text-[10px]"
            />
          ) : (
            <span className="text-[11px] font-medium text-[#5499BF] dark:text-slate-400">
              No Worker ID
            </span>
          )}
          {isArchived ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10">
              Archived
            </span>
          ) : null}
        </div>

        {email ? (
          <p
            className="mt-1 truncate text-[11px] font-medium text-[#3D7A9C] dark:text-slate-300"
            title={email}
          >
            <span className="sr-only">Email: </span>
            {email}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <div className="flex flex-wrap gap-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${roleClassMap[driver.role] ?? roleClassMap.Other}`}
            >
              {driver.role}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusClassMap[driver.status]}`}
            >
              {driver.status}
            </span>
          </div>

          <div
            className={`rounded-lg border px-1.5 py-1 ${workerCardCompliancePanelClass[accent]}`}
          >
            <WorkerComplianceBadge
              driver={driver}
              status={compliance}
              className={`px-2 py-0.5 text-[10px] ${
                compliance === 'Missing Info'
                  ? workerCardMissingInfoBadgeClass
                  : ''
              }`}
            />
          </div>

          <p
            className="truncate text-[11px] font-medium text-[#113C69] dark:text-slate-200"
            title={vehicleLabel}
          >
            <span className={metaLabelClass}>Vehicle: </span>
            {vehicleLabel}
          </p>
        </div>
      </button>
    </article>
  )
}
