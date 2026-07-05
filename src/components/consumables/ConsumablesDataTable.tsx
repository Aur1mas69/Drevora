import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import { ConsumableReceiptStatus } from '@/components/consumables/ConsumableReceiptStatus'
import type { Consumable } from '@/lib/consumableTypes'
import {
  formatConsumableCost,
  formatQuantityWithUnit,
  formatSupplierSite,
  getConsumableTypeBadgeClass,
} from '@/lib/consumableUtils'
import {
  adminHeading,
  adminTableHeader,
  adminTableRow,
  adminText,
  adminTextStrong,
} from '@/lib/adminUiStyles'
import { Eye, Pencil, Trash2 } from 'lucide-react'

type ConsumablesDataTableProps = {
  items: Consumable[]
  onView: (item: Consumable) => void
  onEdit: (item: Consumable) => void
  onDelete: (item: Consumable) => void
}

function ConsumableRowActions({
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
    { id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit },
    { id: 'delete', label: 'Delete', icon: Trash2, tone: 'danger', onClick: onDelete },
  ]

  return <RowActionsMenu actions={actions} />
}

function ConsumableMobileCard({
  item,
  onView,
  onEdit,
  onDelete,
}: {
  item: Consumable
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { formatDate } = useCompanySettings()

  return (
    <article className="rounded-xl border border-[#D3E9FC] bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getConsumableTypeBadgeClass(item.consumableType)}`}
          >
            {item.consumableType}
          </span>
          <p className="mt-2 truncate text-base font-semibold text-[#113C69]">
            {item.itemName?.trim() || item.consumableType}
          </p>
          <p className="mt-1 text-sm text-[#3D7A9C]">{item.vehicleLabel ?? '—'}</p>
        </div>
        <ConsumableRowActions onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-[#3D7A9C]">Quantity</dt>
          <dd className="font-semibold text-[#113C69]">
            {formatQuantityWithUnit(item.quantity, item.unit)}
          </dd>
        </div>
        <div>
          <dt className="text-[#3D7A9C]">Date</dt>
          <dd className="font-semibold text-[#113C69]">{formatDate(item.entryDate)}</dd>
        </div>
        <div>
          <dt className="text-[#3D7A9C]">Cost</dt>
          <dd className="font-semibold text-[#113C69]">{formatConsumableCost(item.cost)}</dd>
        </div>
        <div>
          <dt className="text-[#3D7A9C]">Receipt</dt>
          <dd>
            <ConsumableReceiptStatus receiptUrl={item.receiptUrl} />
          </dd>
        </div>
      </dl>
    </article>
  )
}

export function ConsumablesDataTable({
  items,
  onView,
  onEdit,
  onDelete,
}: ConsumablesDataTableProps) {
  const { formatDate } = useCompanySettings()
  const rowPadding = 'py-4'
  const headerCellClass = 'px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#3D7A9C]'

  return (
    <>
      <div className="hidden md:block">
        <div className="max-h-[calc(100vh-22rem)] overflow-x-auto">
          <table className="w-full min-w-[1500px] border-collapse text-left">
            <colgroup>
              <col className="w-[120px]" />
              <col className="w-[140px]" />
              <col className="w-[140px]" />
              <col className="w-[130px]" />
              <col className="w-[220px]" />
              <col className="w-[110px]" />
              <col className="w-[100px]" />
              <col className="w-[200px]" />
              <col className="w-[150px]" />
              <col className="w-[72px]" />
            </colgroup>
            <thead className={adminTableHeader}>
              <tr>
                <th className={headerCellClass}>Date</th>
                <th className={headerCellClass}>Vehicle</th>
                <th className={headerCellClass}>Worker</th>
                <th className={headerCellClass}>Type</th>
                <th className={headerCellClass}>Item / Fluid</th>
                <th className={headerCellClass}>Quantity</th>
                <th className={headerCellClass}>Cost</th>
                <th className={headerCellClass}>Supplier / Site</th>
                <th className={headerCellClass}>Receipt</th>
                <TableActionsHeader />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={`${adminTableRow} text-sm`}>
                  <td className={`px-4 ${rowPadding} whitespace-nowrap tabular-nums text-sm ${adminTextStrong}`}>
                    {formatDate(item.entryDate)}
                  </td>
                  <td className={`px-4 ${rowPadding} whitespace-nowrap text-base font-semibold ${adminHeading}`}>
                    {item.vehicleLabel ?? '—'}
                  </td>
                  <td className={`max-w-[180px] truncate px-4 ${rowPadding} text-sm ${adminText}`}>
                    {item.workerName ?? '—'}
                  </td>
                  <td className={`px-4 ${rowPadding}`}>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getConsumableTypeBadgeClass(item.consumableType)}`}
                    >
                      {item.consumableType}
                    </span>
                  </td>
                  <td className={`max-w-[240px] truncate px-4 ${rowPadding} text-sm ${adminText}`}>
                    {item.itemName?.trim() || '—'}
                  </td>
                  <td className={`px-4 ${rowPadding} whitespace-nowrap tabular-nums text-base font-semibold ${adminTextStrong}`}>
                    {formatQuantityWithUnit(item.quantity, item.unit)}
                  </td>
                  <td className={`px-4 ${rowPadding} whitespace-nowrap tabular-nums text-base font-semibold ${adminTextStrong}`}>
                    {formatConsumableCost(item.cost)}
                  </td>
                  <td className={`max-w-[220px] truncate px-4 ${rowPadding} text-sm ${adminText}`}>
                    {formatSupplierSite(item.supplier, item.site)}
                  </td>
                  <td className={`px-4 ${rowPadding}`}>
                    <ConsumableReceiptStatus receiptUrl={item.receiptUrl} />
                  </td>
                  <TableActionsCell className={rowPadding}>
                    <ConsumableRowActions
                      onView={() => onView(item)}
                      onEdit={() => onEdit(item)}
                      onDelete={() => onDelete(item)}
                    />
                  </TableActionsCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <ConsumableMobileCard
            key={item.id}
            item={item}
            onView={() => onView(item)}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
          />
        ))}
      </div>
    </>
  )
}
