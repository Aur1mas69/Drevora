import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, FileWarning } from 'lucide-react'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  vehicleProfilePanelClass,
  vehicleProfileTableHeadClass,
  vehicleProfileTableRowClass,
} from '@/components/vehicles/profile/vehicleProfileUi'
import type { DriverReport } from '@/lib/driverReportTypes'
import {
  driverReportPriorityClassMap,
  driverReportStatusClassMap,
  getDriverReportStatusLabel,
} from '@/lib/driverReportUtils'
import { fetchDriverReportsForVehicle } from '@/services/driverReportsService'

type VehicleProfileDriverReportsTabProps = {
  vehicleId: string
}

export function VehicleProfileDriverReportsTab({
  vehicleId,
}: VehicleProfileDriverReportsTabProps) {
  const { formatDate, formatDateTime } = useCompanySettings()
  const [items, setItems] = useState<DriverReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    void fetchDriverReportsForVehicle(vehicleId)
      .then((reports) => {
        if (!cancelled) setItems(reports)
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load driver reports for this vehicle.',
          )
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
          <FileWarning className="size-5" />
        </div>
        <p className="mt-3 text-base font-semibold text-[#113C69]">
          No driver reports linked to this vehicle.
        </p>
        <Link
          to="/admin/driver-reports"
          className="mt-3 text-sm font-semibold text-[#218EE7] hover:underline"
        >
          Open driver reports
        </Link>
      </div>
    )
  }

  return (
    <div className={`${vehicleProfilePanelClass} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className={vehicleProfileTableHeadClass}>
              <th className="px-4 py-3">Report title</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3">Reported date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((report) => (
              <tr key={report.id} className={vehicleProfileTableRowClass}>
                <td className="px-4 py-3 text-sm font-semibold text-[#113C69]">{report.title}</td>
                <td className="px-4 py-3 text-sm text-[#5499BF]">{report.reportType}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${driverReportPriorityClassMap[report.priority]}`}
                  >
                    {report.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${driverReportStatusClassMap[report.status]}`}
                  >
                    {getDriverReportStatusLabel(report.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#5499BF]">
                  {report.workerName ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium tabular-nums text-[#113C69]">
                    {report.issueDatetime
                      ? formatDate(report.issueDatetime.slice(0, 10))
                      : formatDate(report.createdAt.slice(0, 10))}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5499BF]">
                    {formatDateTime(report.createdAt)}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/admin/driver-reports"
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
          to="/admin/driver-reports"
          className="text-sm font-semibold text-[#218EE7] hover:text-[#0B68BE]"
        >
          View all driver reports
        </Link>
      </div>
    </div>
  )
}
