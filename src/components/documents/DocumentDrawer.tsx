import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { Document } from '@/lib/documentTypes'
import {
  documentStatusClassMap,
  getDocumentStatusLabel,
  hasDocumentFile,
} from '@/lib/documentUtils'
import { ExternalLink, Pencil, X } from 'lucide-react'
import { createPortal } from 'react-dom'

type DocumentDrawerProps = {
  record: Document | null
  isOpen: boolean
  formatDate: (value: string) => string
  onClose: () => void
  onEdit: (document: Document) => void
  onOpenFile: (document: Document) => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[#113C69] dark:text-slate-100">{value}</dd>
    </div>
  )
}

export function DocumentDrawer({
  record,
  isOpen,
  formatDate,
  onClose,
  onEdit,
  onOpenFile,
}: DocumentDrawerProps) {
  useBodyScrollLock(isOpen)

  if (!isOpen || !record || typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="flex-1" aria-label="Close drawer" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[#D3E9FC] bg-gradient-to-b from-white to-[#F5FAFF] shadow-[-12px_0_40px_rgba(33,142,231,0.12)] dark:border-white/10 dark:from-slate-900/95 dark:to-slate-900/90 dark:shadow-black/40">
        <div className="flex items-start justify-between border-b border-[#D3E9FC] px-5 py-4 dark:border-white/10">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#218EE7]">
              {record.appliesTo}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#113C69] dark:text-slate-100">{record.documentName}</h2>
            <p className="mt-0.5 text-sm text-[#5499BF]">{record.documentType}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#5499BF] hover:bg-[#EEF6FF] dark:hover:bg-slate-800/50"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${documentStatusClassMap[record.status]}`}
          >
            {getDocumentStatusLabel(record.status)}
          </span>

          <dl className="mt-5 grid gap-4">
            {record.workerName ? (
              <DetailRow label="Worker" value={record.workerName} />
            ) : null}
            {record.vehicleLabel ? (
              <DetailRow label="Vehicle" value={record.vehicleLabel} />
            ) : null}
            <DetailRow label="Reference" value={record.referenceNumber?.trim() || '—'} />
            <DetailRow
              label="Issue date"
              value={record.issueDate ? formatDate(record.issueDate) : '—'}
            />
            <DetailRow
              label="Expiry date"
              value={record.expiryDate ? formatDate(record.expiryDate) : '—'}
            />
            <DetailRow label="Notes" value={record.notes?.trim() || '—'} />
            <DetailRow label="Created" value={formatDate(record.createdAt.slice(0, 10))} />
          </dl>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#D3E9FC] px-5 py-4 dark:border-white/10">
          {hasDocumentFile(record) ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenFile(record)}
              className="h-10 rounded-[12px] border-[#C5DFFB] text-[#0B68BE]"
            >
              <ExternalLink className="mr-1.5 size-4" />
              Open attachment
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => onEdit(record)}
            className="h-10 rounded-[12px] bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white"
          >
            <Pencil className="mr-1.5 size-4" />
            Edit document
          </Button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
