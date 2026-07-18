import { ConsumableReceiptViewButton } from '@/components/consumables/ConsumableReceiptStatus'
import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { Consumable } from '@/lib/consumableTypes'
import {
  formatConsumableEntryDateTime,
  formatConsumableItemCost,
  formatQuantityWithUnit,
  formatSupplierSite,
  getConsumableTypeBadgeClass,
  hasReceiptAttached,
} from '@/lib/consumableUtils'
import { isImageReceiptPath } from '@/lib/consumableReceiptStorage'
import { getConsumableReceiptSignedUrl } from '@/services/consumableReceiptStorageService'
import { Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type ConsumableDrawerProps = {
  record: Consumable | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (record: Consumable) => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="min-w-[120px] text-xs font-semibold uppercase tracking-[0.06em] text-[#3D7A9C]">
        {label}
      </dt>
      <dd className="text-sm font-medium text-[#113C69]">{value}</dd>
    </div>
  )
}

export function ConsumableDrawer({
  record,
  isOpen,
  onClose,
  onEdit,
}: ConsumableDrawerProps) {
  const { formatDate, formatTime, settings } = useCompanySettings()
  const defaultPrices = settings?.consumableDefaultPrices ?? {}
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !record?.receiptUrl || !hasReceiptAttached(record.receiptUrl)) {
      setReceiptPreviewUrl(null)
      return
    }

    if (!isImageReceiptPath(record.receiptUrl)) {
      setReceiptPreviewUrl(null)
      return
    }

    let isCancelled = false

    void getConsumableReceiptSignedUrl(record.receiptUrl)
      .then((url) => {
        if (!isCancelled) setReceiptPreviewUrl(url)
      })
      .catch(() => {
        if (!isCancelled) setReceiptPreviewUrl(null)
      })

    return () => {
      isCancelled = true
    }
  }, [isOpen, record?.receiptUrl])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !record) return null

  const receiptAttached = hasReceiptAttached(record.receiptUrl)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        aria-label="Close consumable drawer"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-[0_0_40px_rgba(15,42,70,0.18)] dark:bg-slate-900/95 dark:shadow-black/40">
        <div className="border-b border-[#D3E9FC] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3D7A9C]">
                Consumable
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#113C69]">
                {record.itemName?.trim() || record.consumableType}
              </h2>
              <span
                className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getConsumableTypeBadgeClass(record.consumableType)}`}
              >
                {record.consumableType}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 rounded-[10px] p-0 text-slate-500"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="space-y-3 rounded-xl border border-[#D3E9FC] bg-[#F5FAFF]/80 p-4">
            <DetailRow
              label="Date / Time"
              value={formatConsumableEntryDateTime(
                record.entryDate,
                record.entryTime,
                formatDate,
                formatTime,
              )}
            />
            <DetailRow label="Vehicle" value={record.vehicleLabel ?? '—'} />
            <DetailRow label="Worker" value={record.workerName ?? '—'} />
            <DetailRow
              label="Quantity"
              value={formatQuantityWithUnit(record.quantity, record.unit)}
            />
            <DetailRow
              label="Cost"
              value={formatConsumableItemCost(record, defaultPrices)}
            />
            <DetailRow
              label="Supplier / Site"
              value={formatSupplierSite(record.supplier, record.site)}
            />
            <DetailRow
              label="Odometer"
              value={record.odometer === null ? '—' : String(record.odometer)}
            />
            <DetailRow label="Notes" value={record.notes?.trim() || '—'} />
          </dl>

          <div className="mt-4 rounded-xl border border-[#D3E9FC] bg-[#F5FAFF]/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#3D7A9C]">
              Receipt / Photo
            </p>
            {receiptAttached && record.receiptUrl ? (
              <div className="mt-3 space-y-3">
                {receiptPreviewUrl ? (
                  <img
                    src={receiptPreviewUrl}
                    alt="Receipt preview"
                    className="max-h-48 w-full rounded-lg border border-[#D3E9FC] object-contain bg-white dark:border-white/10 dark:bg-slate-800/60"
                  />
                ) : null}
                <ConsumableReceiptViewButton receiptUrl={record.receiptUrl} />
              </div>
            ) : (
              <p className="mt-2 text-sm font-medium text-[#3D7A9C]">No receipt attached</p>
            )}
          </div>
        </div>

        {onEdit ? (
          <div className="border-t border-[#D3E9FC] px-5 py-4">
            <Button
              type="button"
              onClick={() => onEdit(record)}
              className="h-10 w-full rounded-[12px] bg-[#218EE7] font-semibold text-white hover:bg-[#0B68BE]"
            >
              <Pencil className="mr-1.5 size-4" />
              Edit Consumable
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
