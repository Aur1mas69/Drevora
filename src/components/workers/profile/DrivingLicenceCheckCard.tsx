import { Button } from '@/components/ui/button'
import { IdCard } from 'lucide-react'

/**
 * Future-ready DVLA licence check placeholder for Admin Worker profile Documents.
 * UI only — no API, network, or simulated results.
 */
export function DrivingLicenceCheckCard() {
  return (
    <section
      className="mx-auto w-full max-w-6xl rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/88 p-4 shadow-[0_4px_16px_rgba(33,142,231,0.06)] ring-1 ring-[#C5DFFB]/35 dark:border-white/10 dark:from-slate-900/70 dark:to-slate-900/60 sm:p-5"
      aria-labelledby="driving-licence-check-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E8F3FE] text-[#0B68BE] ring-1 ring-[#C5DFFB]/60 dark:bg-slate-800/80 dark:text-blue-300 dark:ring-white/10">
            <IdCard className="size-5" strokeWidth={1.9} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="driving-licence-check-title"
                className="text-base font-semibold tracking-[-0.02em] text-[#113C69] dark:text-slate-100"
              >
                Driving Licence Check
              </h3>
              <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10">
                API Not Connected
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium leading-snug text-[#3D7A9C] dark:text-slate-400">
              Verify driving entitlement, licence status and endorsements through DVLA.
            </p>
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              No licence check has been run yet.
            </p>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-auto sm:min-w-[11.5rem] sm:items-end">
          <Button
            type="button"
            disabled
            className="h-10 w-full rounded-[14px] bg-[#2563EB] px-4 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            Run Licence Check
          </Button>
          <p className="text-center text-xs font-medium leading-snug text-slate-500 sm:max-w-[14rem] sm:text-right dark:text-slate-400">
            DVLA API integration will be connected later.
          </p>
        </div>
      </div>
    </section>
  )
}
