import { Button } from '@/components/ui/button'

type CleanCurrentViewModalProps = {
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  confirming?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function CleanCurrentViewModal({
  open,
  title = 'Clean current view?',
  description = 'This will clean the current view only. Records will remain saved and searchable in history.',
  confirmLabel = 'Clean current view',
  confirming = false,
  onCancel,
  onConfirm,
}: CleanCurrentViewModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clean-current-view-title"
        className="w-full max-w-md rounded-[20px] border border-[#D3E9FC] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.24)] ring-1 ring-[#E8F3FE] dark:border-white/10 dark:bg-slate-950 dark:ring-white/10"
      >
        <p
          id="clean-current-view-title"
          className="text-lg font-semibold tracking-[-0.03em] text-[#113C69] dark:text-slate-100"
        >
          {title}
        </p>
        <p className="mt-2 text-sm leading-6 text-[#3D7A9C] dark:text-slate-400">
          {description}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={confirming}
            onClick={onCancel}
            className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600 hover:bg-[#F5FAFF] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className="h-10 rounded-[12px] bg-[#218EE7] px-4 text-sm font-semibold text-white hover:bg-[#0B68BE] disabled:opacity-70"
          >
            {confirming ? 'Cleaning…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
