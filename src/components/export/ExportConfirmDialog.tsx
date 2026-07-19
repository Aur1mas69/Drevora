import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react'
import { useEffect } from 'react'

export type ExportConfirmField = {
  label: string
  value: string
}

type ExportConfirmDialogProps = {
  open: boolean
  title: string
  fields: ExportConfirmField[]
  recordCount: number
  busy?: boolean
  busyLabel?: string
  allowExcel?: boolean
  allowPdf?: boolean
  onClose: () => void
  onExportExcel?: () => void
  onExportPdf?: () => void
}

/**
 * Confirmation dialog shown before a filtered module export.
 * Does not start a download until Excel or PDF is chosen.
 */
export function ExportConfirmDialog({
  open,
  title,
  fields,
  recordCount,
  busy = false,
  busyLabel = 'Preparing export…',
  allowExcel = true,
  allowPdf = true,
  onClose,
  onExportExcel,
  onExportPdf,
}: ExportConfirmDialogProps) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose, open])

  if (!open) return null

  const recordLabel =
    recordCount === 1 ? '1 record will be exported' : `${recordCount} records will be exported`

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label="Close export dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose()
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-confirm-title"
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[#C5DFFB] bg-white shadow-[0_20px_48px_rgba(30,64,175,0.18)] dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#D2E5F5] px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5D7C9D] dark:text-slate-400">
              Export
            </p>
            <h2
              id="export-confirm-title"
              className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#163A63] dark:text-slate-100"
            >
              {title}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={onClose}
            className="size-9 shrink-0 rounded-xl text-[#5D7C9D]"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <dl className="space-y-3">
            {fields.map((field) => (
              <div key={field.label} className="flex items-start justify-between gap-4 text-sm">
                <dt className="shrink-0 font-medium text-[#5D7C9D] dark:text-slate-400">
                  {field.label}
                </dt>
                <dd className="text-right font-semibold text-[#163A63] dark:text-slate-100">
                  {field.value}
                </dd>
              </div>
            ))}
            <div className="flex items-start justify-between gap-4 text-sm">
              <dt className="shrink-0 font-medium text-[#5D7C9D] dark:text-slate-400">Format</dt>
              <dd className="text-right font-semibold text-[#163A63] dark:text-slate-100">
                {[allowExcel ? 'Excel' : null, allowPdf ? 'PDF' : null]
                  .filter(Boolean)
                  .join(' / ')}
              </dd>
            </div>
          </dl>

          <p className="rounded-xl border border-[#D2E5F5] bg-[#F5FAFF] px-3 py-2.5 text-sm font-medium text-[#0B68BE] dark:border-white/10 dark:bg-slate-800/60 dark:text-blue-300">
            {recordLabel}
          </p>

          {busy ? (
            <p className="flex items-center gap-2 text-sm font-medium text-[#5D7C9D] dark:text-slate-400">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {busyLabel}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-[#D2E5F5] px-5 py-4 sm:flex-row dark:border-white/10">
          {allowExcel && onExportExcel ? (
            <Button
              type="button"
              disabled={busy || recordCount <= 0}
              onClick={onExportExcel}
              className="h-11 flex-1 rounded-2xl border border-[#89CFF0]/70 bg-gradient-to-br from-[#218EE7] to-[#0B68BE] font-semibold text-white"
            >
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              Excel
            </Button>
          ) : null}
          {allowPdf && onExportPdf ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy || recordCount <= 0}
              onClick={onExportPdf}
              className="h-11 flex-1 rounded-2xl border border-[#BFE3F5] bg-[#E8F3FE] font-semibold text-[#0B68BE] dark:border-white/10 dark:bg-slate-800 dark:text-blue-300"
            >
              <FileText className="size-4" aria-hidden="true" />
              PDF
            </Button>
          ) : null}
          {!allowExcel && !allowPdf ? (
            <Button type="button" disabled className="h-11 flex-1 rounded-2xl">
              <Download className="size-4" aria-hidden="true" />
              Export
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
