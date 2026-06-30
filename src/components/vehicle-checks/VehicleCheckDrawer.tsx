import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { VehicleCheckChecklistForm } from '@/components/vehicle-checks/VehicleCheckChecklistForm'
import type { VehicleCheck } from '@/lib/vehicleCheckTypes'
import { getResultBadgeClass, getStatusBadgeClass } from '@/lib/vehicleCheckUtils'
import { X } from 'lucide-react'
import { useEffect } from 'react'

type VehicleCheckDrawerProps = {
  check: VehicleCheck | null
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
}

export function VehicleCheckDrawer({
  check,
  isOpen,
  onClose,
  onEdit,
}: VehicleCheckDrawerProps) {
  const { formatDate, formatDateTime } = useCompanySettings()

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !check) return null

  const checklistItems = check.items.map((item) => ({
    category: item.category,
    itemName: item.itemName,
    result: item.result,
    comment: item.comment ?? '',
  }))

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        aria-label="Close inspection drawer"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-[0_0_40px_rgba(15,23,42,0.18)]">
        <div className="border-b border-[rgba(75,120,220,0.10)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Vehicle Inspection
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
                {check.vehicleRegistration}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {check.fleetNumber ? `Fleet ${check.fleetNumber} · ` : ''}
                {check.workerName}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 rounded-[10px] p-0 text-slate-500"
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Summary
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Inspection date</dt>
                <dd className="font-medium tabular-nums text-[#2A376F]">
                  {formatDate(check.inspectionDate)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Mileage</dt>
                <dd className="font-medium tabular-nums text-slate-700">
                  {check.odometer != null ? check.odometer.toLocaleString() : '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Result</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getResultBadgeClass(check.overallResult)}`}
                  >
                    {check.overallResult}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(check.status)}`}
                  >
                    {check.status}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">Submitted</dt>
                <dd className="text-right text-slate-700">{formatDateTime(check.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Overall notes</dt>
                <dd className="mt-1 rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-slate-700">
                  {check.notes?.trim() || 'No notes'}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Checklist
            </h3>
            <div className="mt-3">
              <VehicleCheckChecklistForm
                items={checklistItems}
                onChange={() => undefined}
                readOnly
              />
            </div>
          </section>
        </div>

        {onEdit ? (
          <div className="border-t border-[rgba(75,120,220,0.10)] px-5 py-4">
            <Button
              type="button"
              onClick={onEdit}
              className="h-10 w-full rounded-[12px] bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Edit inspection
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
