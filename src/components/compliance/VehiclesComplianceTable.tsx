import { useNavigate } from 'react-router-dom'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { VehicleComplianceSummary } from '@/lib/complianceTypes'
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
} from '@/lib/adminUiStyles'
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
    <div className={adminTableShell}>
      <div className="max-h-[calc(100vh-24rem)] overflow-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className={adminTableHeaderAlt}>
            <tr className={adminTableHeadText}>
              <th className="px-5 py-3.5">Registration</th>
              <th className="px-5 py-3.5">Fleet Number</th>
              <th className="px-5 py-3.5">Compliance Score</th>
              <th className="px-5 py-3.5">Expiring</th>
              <th className="px-5 py-3.5">Expired</th>
              <TableActionsHeader className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className={adminTableDivide}>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.vehicleId} className={adminTableRowAlt}>
                <td className="px-5 py-4">
                  <p className={`font-semibold ${adminHeadingLg}`}>{vehicle.registration}</p>
                  <p className={`mt-0.5 text-xs ${adminTextMuted}`}>{vehicle.vehicleName}</p>
                </td>
                <td className={`px-5 py-4 tabular-nums ${adminText}`}>
                  {vehicle.fleetNumber ?? '—'}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getScoreRingTone(vehicle.complianceScore)} ${getScoreTone(vehicle.complianceScore)}`}
                  >
                    {vehicle.complianceScore}%
                  </span>
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                  {vehicle.expiringCount}
                </td>
                <td className="px-5 py-4 font-semibold tabular-nums text-rose-700 dark:text-rose-300">
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
