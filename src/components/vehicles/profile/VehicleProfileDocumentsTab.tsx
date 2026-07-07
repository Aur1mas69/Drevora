import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, FileText } from 'lucide-react'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  vehicleProfilePanelClass,
  vehicleProfileTableHeadClass,
  vehicleProfileTableRowClass,
} from '@/components/vehicles/profile/vehicleProfileUi'
import type { Document } from '@/lib/documentTypes'
import { documentStatusClassMap, getDocumentStatusLabel } from '@/lib/documentUtils'
import { fetchDocumentsByVehicleId } from '@/services/documentsService'
import type { Vehicle } from '@/services/vehiclesService'

type VehicleProfileDocumentsTabProps = {
  vehicle: Vehicle
}

function formatDate(value: string | null): string {
  if (!value) return 'No expiry'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function VehicleProfileDocumentsTab({ vehicle }: VehicleProfileDocumentsTabProps) {
  const { formatDate: formatCompanyDate } = useCompanySettings()
  const [items, setItems] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    void fetchDocumentsByVehicleId(vehicle.id)
      .then((records) => {
        if (!cancelled) setItems(records)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [vehicle.id])

  if (isLoading) {
    return (
      <div className={`${vehicleProfilePanelClass} space-y-3 p-5`}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-[#E8F3FE]/70" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={`${vehicleProfilePanelClass} flex flex-col items-center px-6 py-14 text-center`}>
        <div className="flex size-11 items-center justify-center rounded-xl bg-[#EEF6FF] text-[#218EE7] ring-1 ring-[#C5DFFB]">
          <FileText className="size-5" />
        </div>
        <p className="mt-3 text-base font-semibold text-[#113C69]">
          No documents for this vehicle yet.
        </p>
        <Link
          to={`/documents?tab=vehicles&vehicleId=${vehicle.id}`}
          className="mt-3 text-sm font-semibold text-[#218EE7] hover:underline"
        >
          Add vehicle documents
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
              <th className="px-4 py-3">Document name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Expiry date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((document) => (
              <tr key={document.id} className={vehicleProfileTableRowClass}>
                <td className="px-4 py-3 text-sm font-semibold text-[#113C69]">
                  {document.documentName}
                </td>
                <td className="px-4 py-3 text-sm text-[#5499BF]">{document.documentType}</td>
                <td className="px-4 py-3 text-sm text-[#5499BF]">
                  {document.referenceNumber ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm tabular-nums text-[#113C69]">
                  {document.expiryDate ? formatCompanyDate(document.expiryDate) : formatDate(null)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${documentStatusClassMap[document.status]}`}
                  >
                    {getDocumentStatusLabel(document.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {document.fileUrl ? (
                    <a
                      href={document.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[#218EE7] hover:underline"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-[#5499BF]/70">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/documents?tab=vehicles&vehicleId=${vehicle.id}`}
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
    </div>
  )
}
