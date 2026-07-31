import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

type WorkerExitVehicleCheckDialogProps = {
  open: boolean
  onContinue: () => void
  onExit: () => void
}

/**
 * Confirm leaving an in-progress Worker Vehicle Check.
 * Escape / backdrop / Continue keep the Worker in the check with form state intact.
 */
export function WorkerExitVehicleCheckDialog({
  open,
  onContinue,
  onExit,
}: WorkerExitVehicleCheckDialogProps) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onContinue()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onContinue, open])

  if (!open) return null

  return (
    <div className="worker-theme-surface fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        aria-label="Continue Vehicle Check"
        onClick={onContinue}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-exit-vehicle-check-title"
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)]"
      >
        <div className="border-b border-[color:var(--worker-border)] px-5 py-4">
          <h2
            id="worker-exit-vehicle-check-title"
            className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--worker-text)] sm:text-xl"
          >
            Exit Vehicle Check?
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--worker-text-secondary)]">
            Your current Vehicle Check is not completed. If you exit, your unsaved
            progress will be lost.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onExit}
            className="h-12 rounded-2xl border-rose-200 bg-rose-50 px-5 font-semibold text-rose-800 hover:bg-rose-100"
          >
            Exit Check
          </Button>
          <Button
            type="button"
            onClick={onContinue}
            className="worker-btn-primary h-12 rounded-2xl px-5 font-semibold"
          >
            Continue Check
          </Button>
        </div>
      </section>
    </div>
  )
}
