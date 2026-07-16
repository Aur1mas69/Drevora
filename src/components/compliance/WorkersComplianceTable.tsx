import { useNavigate } from 'react-router-dom'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import { WorkerAvatar } from '@/components/workers/WorkerAvatar'
import type { WorkerComplianceSummary } from '@/lib/complianceTypes'
import { getScoreRingTone, getScoreTone } from '@/lib/complianceUtils'
import {
  adminHeadingLg,
  adminTableDivide,
  adminTableHeadText,
  adminTableHeaderAlt,
  adminTableRowAlt,
  adminTableShell,
  adminText,
  adminTextMuted,
  adminTextStrong,
} from '@/lib/adminUiStyles'
import { Eye } from 'lucide-react'

type WorkersComplianceTableProps = {
  workers: WorkerComplianceSummary[]
}

function WorkerRowActions({ workerId }: { workerId: string }) {
  const navigate = useNavigate()
  const actions: RowAction[] = [
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      onClick: () => navigate(`/compliance/workers/${workerId}?tab=compliance`),
    },
  ]
  return <RowActionsMenu actions={actions} />
}

export function WorkersComplianceTable({ workers }: WorkersComplianceTableProps) {
  return (
    <div className={adminTableShell}>
      <div className="max-h-[calc(100vh-24rem)] overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className={adminTableHeaderAlt}>
            <tr className={adminTableHeadText}>
              <th className="px-5 py-3.5">Avatar</th>
              <th className="px-5 py-3.5">Worker</th>
              <th className="px-5 py-3.5">Role</th>
              <th className="px-5 py-3.5">Department</th>
              <th className="px-5 py-3.5">Compliance Score</th>
              <th className="px-5 py-3.5">Valid Documents</th>
              <th className="px-5 py-3.5">Expiring</th>
              <th className="px-5 py-3.5">Expired</th>
              <TableActionsHeader className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className={adminTableDivide}>
            {workers.map((worker) => (
              <tr key={worker.workerId} className={adminTableRowAlt}>
                <td className="px-5 py-4">
                  <WorkerAvatar
                    firstName={worker.workerName.split(' ')[0] ?? ''}
                    lastName={worker.workerName.split(' ').slice(1).join(' ')}
                    avatarUrl={worker.avatarUrl}
                    size="sm"
                    className="size-10 text-xs ring-1 ring-blue-100 dark:ring-white/10"
                  />
                </td>
                <td className="px-5 py-4">
                  <p className={`font-semibold ${adminHeadingLg}`}>{worker.workerName}</p>
                  <p className={`mt-0.5 text-xs ${adminTextMuted}`}>{worker.email}</p>
                </td>
                <td className={`px-5 py-4 ${adminText}`}>{worker.workerRole}</td>
                <td className={`px-5 py-4 ${adminText}`}>{worker.department ?? '—'}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getScoreRingTone(worker.complianceScore)} ${getScoreTone(worker.complianceScore)}`}
                  >
                    {worker.complianceScore}%
                  </span>
                </td>
                <td className={`px-5 py-4 font-semibold tabular-nums ${adminTextStrong}`}>
                  {worker.validCount}
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                  {worker.expiringCount}
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                  {worker.expiredCount}
                </td>
                <TableActionsCell className="px-5 py-4">
                  <WorkerRowActions workerId={worker.workerId} />
                </TableActionsCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
