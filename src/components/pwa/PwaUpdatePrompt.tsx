import { RefreshCw } from 'lucide-react'

type PwaUpdatePromptProps = {
  open: boolean
  onUpdate: () => void
  onLater: () => void
}

export function PwaUpdatePrompt({ open, onUpdate, onLater }: PwaUpdatePromptProps) {
  if (!open) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-[85] mx-auto max-w-md motion-reduce:transition-none sm:inset-x-auto sm:right-4 sm:bottom-6 sm:mx-0"
    >
      <div className="rounded-2xl border border-[#C5DFFB]/90 bg-[#FAFCFF]/98 p-3.5 shadow-[0_16px_40px_rgba(33,142,231,0.16)] ring-1 ring-[#D3E9FC]/80 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40 dark:ring-white/10">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-[#2563EB] dark:bg-blue-500/15 dark:text-blue-300">
            <RefreshCw className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              A new DREVORA version is available.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onUpdate}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#2563EB] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFCFF] dark:focus-visible:ring-offset-slate-900"
              >
                Update now
              </button>
              <button
                type="button"
                onClick={onLater}
                className="inline-flex min-h-10 items-center justify-center rounded-xl px-3.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFCFF] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
