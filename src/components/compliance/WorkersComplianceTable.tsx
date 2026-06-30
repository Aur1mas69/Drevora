import { useNavigate } from 'react-router-dom'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { WorkerComplianceSummary } from '@/lib/complianceTypes'
import { getScoreRingTone, getScoreTone } from '@/lib/complianceUtils'
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
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <div className="max-h-[calc(100vh-24rem)] overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#F8FBFF] shadow-[0_1px_0_rgba(75,120,220,0.10)]">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
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
          <tbody className="divide-y divide-blue-50">
            {workers.map((worker) => (
              <tr key={worker.workerId} className="text-sm transition-colors hover:bg-[#F8FBFF]">
                <td className="px-5 py-4">
                  <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-[#EAF4FF] text-xs font-semibold text-[#2563EB] ring-1 ring-blue-100">
                    {worker.avatarUrl ? (
                      <img src={worker.avatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      worker.workerName
                        .split(' ')
                        .map((part) => part.charAt(0))
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950">{worker.workerName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{worker.email}</p>
                </td>
                <td className="px-5 py-4 text-slate-600">{worker.workerRole}</td>
                <td className="px-5 py-4 text-slate-600">{worker.department ?? '—'}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getScoreRingTone(worker.complianceScore)} ${getScoreTone(worker.complianceScore)}`}
                  >
                    {worker.complianceScore}%
                  </span>
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-slate-700">
                  {worker.validCount}
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-amber-700">
                  {worker.expiringCount}
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-rose-700">
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
