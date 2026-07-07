import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, Eye } from 'lucide-react'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  vehicleProfilePanelClass,
  vehicleProfileTableHeadClass,
  vehicleProfileTableRowClass,
} from '@/components/vehicles/profile/vehicleProfileUi'
import type { VehicleCheckListItem } from '@/lib/vehicleCheckTypes'
import {
  formatVehicleCheckResultLabel,
  getResultBadgeClass,
} from '@/lib/vehicleCheckUtils'
import { fetchVehicleChecks } from '@/services/vehicleChecksService'

const PAGE_SIZE = 25

type VehicleProfileChecksTabProps = {
  vehicleId: string
}

export function VehicleProfileChecksTab({ vehicleId }: VehicleProfileChecksTabProps) {
  const { formatDate, formatDateTime } = useCompanySettings()
  const [items, setItems] = useState<VehicleCheckListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    void fetchVehicleChecks({ vehicleId, page: 1, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setItems(result.items)
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Unable to load vehicle checks for this vehicle.')
          setItems([])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vehicleId])

  if (isLoading) {
    return (
      <div className={`${vehicleProfilePanelClass} space-y-3 p-5`}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-[#E8F3FE]/70" />
        ))}
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className={`${vehicleProfilePanelClass} px-5 py-8 text-center text-sm font-semibold text-rose-600`}>
        {errorMessage}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={`${vehicleProfilePanelClass} flex flex-col items-center px-6 py-14 text-center`}>
        <div className="flex size-11 items-center justify-center rounded-xl bg-[#EEF6FF] text-[#218EE7] ring-1 ring-[#C5DFFB]">
          <ClipboardCheck className="size-5" />
        </div>
        <p className="mt-3 text-base font-semibold text-[#113C69]">
          No vehicle checks recorded for this vehicle.
        </p>
        <Link
          to="/admin/vehicle-checks"
          className="mt-3 text-sm font-semibold text-[#218EE7] hover:underline"
        >
          Open vehicle checks
        </Link>
      </div>
    )
  }

  return (
    <div className={`${vehicleProfilePanelClass} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className={vehicleProfileTableHeadClass}>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Issues</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={vehicleProfileTableRowClass}>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold tabular-nums text-[#113C69]">
                    {formatDate(item.inspectionDate)}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5499BF]">{formatDateTime(item.createdAt)}</p>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-[#5499BF]">{item.workerName}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getResultBadgeClass(item.overallResult)}`}
                  >
                    {formatVehicleCheckResultLabel(item.overallResult)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-semibold tabular-nums text-[#113C69]">
                  {item.failCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/admin/vehicle-checks"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#218EE7] hover:text-[#0B68BE]"
                  >
                    <Eye className="size-3.5" />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[#D3E9FC]/60 px-5 py-3 text-right">
        <Link
          to="/admin/vehicle-checks"
          className="text-sm font-semibold text-[#218EE7] hover:text-[#0B68BE]"
        >
          View all vehicle checks
        </Link>
      </div>
    </div>
  )
}
