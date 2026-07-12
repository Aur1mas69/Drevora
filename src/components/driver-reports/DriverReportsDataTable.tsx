import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { DriverReport } from '@/lib/driverReportTypes'
import {
  driverReportPriorityClassMap,
  driverReportStatusClassMap,
  getDriverReportStatusLabel,
  getReportDescriptionSnippet,
} from '@/lib/driverReportUtils'
import { adminTableEntityName } from '@/lib/adminUiStyles'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import {
  driverReportMobileCardClass,
  driverReportTableHeadClass,
  driverReportTableRowClass,
  driverReportTableShellClass,
} from './driverReportUiStyles'

type DriverReportsDataTableProps = {
  reports: DriverReport[]
  formatDate: (value: string) => string
  formatDateTime: (value: string) => string
  onView: (report: DriverReport) => void
  onEdit: (report: DriverReport) => void
  onDelete: (report: DriverReport) => void
}

function StatusBadge({ status }: { status: DriverReport['status'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${driverReportStatusClassMap[status]}`}
    >
      {getDriverReportStatusLabel(status)}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: DriverReport['priority'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${driverReportPriorityClassMap[priority]}`}
    >
      {priority}
    </span>
  )
}

function ReportActionsMenu({
  onView,
  onEdit,
  onDelete,
}: {
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const actions: RowAction[] = [
    { id: 'view', label: 'View', icon: Eye, onClick: onView },
    { id: 'edit', label: 'Edit / Update status', icon: Pencil, onClick: onEdit },
    { id: 'delete', label: 'Delete', icon: Trash2, tone: 'danger', onClick: onDelete },
  ]

  return <RowActionsMenu actions={actions} align="end" />
}

export function DriverReportsDataTable({
  reports,
  formatDate,
  formatDateTime,
  onView,
  onEdit,
  onDelete,
}: DriverReportsDataTableProps) {
  return (
    <>
      <div className={`hidden lg:block ${driverReportTableShellClass}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                <th className={`${driverReportTableHeadClass} px-4 py-3`}>Report</th>
                <th className={`${driverReportTableHeadClass} px-4 py-3`}>Type</th>
                <th className={`${driverReportTableHeadClass} px-4 py-3`}>Worker</th>
                <th className={`${driverReportTableHeadClass} px-4 py-3`}>Vehicle</th>
                <th className={`${driverReportTableHeadClass} px-4 py-3`}>Priority</th>
                <th className={`${driverReportTableHeadClass} px-4 py-3`}>Status</th>
                <th className={`${driverReportTableHeadClass} px-4 py-3`}>Reported date</th>
                <TableActionsHeader className={`${driverReportTableHeadClass} px-2 py-3 text-center`} />
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className={driverReportTableRowClass}>
                  <td className="max-w-[240px] px-4 py-3">
                    <p className={`truncate ${adminTableEntityName}`}>{report.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#5499BF]">
                      {getReportDescriptionSnippet(report.description)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#113C69]">{report.reportType}</td>
                  <td className="max-w-[160px] px-4 py-3">
                    <span className={`block truncate ${adminTableEntityName}`}>
                      {report.workerName ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#113C69]">
                    {report.vehicleLabel ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={report.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-[#5499BF]">
                    {formatDateTime(report.createdAt)}
                  </td>
                  <TableActionsCell className="px-2 py-3">
                    <ReportActionsMenu
                      onView={() => onView(report)}
                      onEdit={() => onEdit(report)}
                      onDelete={() => onDelete(report)}
                    />
                  </TableActionsCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {reports.map((report) => (
          <article key={report.id} className={driverReportMobileCardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`truncate ${adminTableEntityName}`}>{report.title}</p>
                <p className="mt-1 text-xs text-[#5499BF]">
                  {getReportDescriptionSnippet(report.description, 96)}
                </p>
              </div>
              <ReportActionsMenu
                onView={() => onView(report)}
                onEdit={() => onEdit(report)}
                onDelete={() => onDelete(report)}
              />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Type</dt>
                <dd className="mt-0.5 font-medium text-[#113C69]">{report.reportType}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Worker</dt>
                <dd className={`mt-0.5 truncate ${adminTableEntityName}`}>
                  {report.workerName ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Vehicle</dt>
                <dd className="mt-0.5 font-medium text-[#113C69]">{report.vehicleLabel ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-[0.06em] text-[#5499BF]">Reported</dt>
                <dd className="mt-0.5 font-medium text-[#113C69]">
                  {formatDate(report.createdAt.slice(0, 10))}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              <PriorityBadge priority={report.priority} />
              <StatusBadge status={report.status} />
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
