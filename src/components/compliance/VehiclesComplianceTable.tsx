import { useNavigate } from 'react-router-dom'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { VehicleComplianceSummary } from '@/lib/complianceTypes'
import { getScoreRingTone, getScoreTone } from '@/lib/complianceUtils'
import { Eye } from 'lucide-react'

type VehiclesComplianceTableProps = {
  vehicles: VehicleComplianceSummary[]
}

function VehicleRowActions({ vehicleId }: { vehicleId: string }) {
  const navigate = useNavigate()
  const actions: RowAction[] = [
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      onClick: () => navigate(`/compliance/vehicles/${vehicleId}?tab=compliance`),
    },
  ]
  return <RowActionsMenu actions={actions} />
}

export function VehiclesComplianceTable({ vehicles }: VehiclesComplianceTableProps) {
  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <div className="max-h-[calc(100vh-24rem)] overflow-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#F8FBFF] shadow-[0_1px_0_rgba(75,120,220,0.10)]">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <th className="px-5 py-3.5">Registration</th>
              <th className="px-5 py-3.5">Fleet Number</th>
              <th className="px-5 py-3.5">Compliance Score</th>
              <th className="px-5 py-3.5">Expiring</th>
              <th className="px-5 py-3.5">Expired</th>
              <TableActionsHeader className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.vehicleId} className="text-sm transition-colors hover:bg-[#F8FBFF]">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950">{vehicle.registration}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{vehicle.vehicleName}</p>
                </td>
                <td className="px-5 py-4 tabular-nums text-slate-600">
                  {vehicle.fleetNumber ?? '—'}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getScoreRingTone(vehicle.complianceScore)} ${getScoreTone(vehicle.complianceScore)}`}
                  >
                    {vehicle.complianceScore}%
                  </span>
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-amber-700">
                  {vehicle.expiringCount}
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-rose-700">
                  {vehicle.expiredCount}
                </td>
                <TableActionsCell className="px-5 py-4">
                  <VehicleRowActions vehicleId={vehicle.vehicleId} />
                </TableActionsCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
