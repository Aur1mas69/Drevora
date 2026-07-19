import { timesheetKpiVisualStyles } from '@/components/timesheets/timesheetSummaryKpiStyles'
import { Check } from 'lucide-react'
import { useId } from 'react'

const STATUS_ITEMS = [
  {
    key: 'total',
    title: 'Total',
    explanation: 'All weekly timesheets',
    style: timesheetKpiVisualStyles.total,
  },
  {
    key: 'draft',
    title: 'Draft',
    explanation: 'Worker has not submitted the timesheet yet',
    style: timesheetKpiVisualStyles.drafts,
  },
  {
    key: 'submitted',
    title: 'Submitted',
    explanation: 'Waiting for Office review',
    style: timesheetKpiVisualStyles.submitted,
  },
  {
    key: 'approved',
    title: 'Approved',
    explanation: 'Reviewed and signed off',
    style: timesheetKpiVisualStyles.approved,
  },
  {
    key: 'rejected',
    title: 'Rejected',
    explanation: 'Returned to the Worker for correction',
    style: timesheetKpiVisualStyles.rejected,
  },
] as const

const HOURS_ITEMS = [
  {
    label: 'Worked',
    explanation: 'Regular worked hours',
  },
  {
    label: 'OT',
    explanation: 'Overtime hours',
  },
  {
    label: 'Add. Hrs',
    explanation: 'Additional payable hours',
  },
  {
    label: 'Total',
    explanation: 'Worked + OT + Additional Hours',
  },
] as const

const TIP_ITEMS = [
  'Use filters to find workers, weeks or statuses.',
  'Click a row to view full details.',
  'Approved timesheets are locked unless company settings allow editing.',
  'Totals are shown using the verified hours and minutes format.',
] as const

/**
 * Legend & Help for Timesheets — placed at the bottom of the Office page.
 * Desktop: three equal columns. Mobile: stacked.
 */
export function TimesheetsLegendPanel() {
  const baseId = useId()
  const statusHeadingId = `${baseId}-status`
  const hoursHeadingId = `${baseId}-hours`
  const tipsHeadingId = `${baseId}-tips`

  return (
    <aside
      className="rounded-[18px] border border-[#C5DFFB]/70 bg-transparent p-5 dark:border-white/10 sm:p-6"
      aria-label="Legend and help"
    >
      <header className="mb-4 sm:mb-5">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-[#113C69] dark:text-slate-100">
          Legend &amp; Help
        </h2>
        <p className="mt-1 text-xs text-[#5499BF] dark:text-slate-400">
          Quick guide to timesheet statuses, hours columns and Office tips.
        </p>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3 lg:gap-8">
        <section aria-labelledby={statusHeadingId} className="min-w-0">
          <h3
            id={statusHeadingId}
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5499BF] dark:text-sky-300/90"
          >
            Status Legend
          </h3>
          <ul className="mt-3 space-y-2">
            {STATUS_ITEMS.map((item) => (
              <li
                key={item.key}
                className={`flex min-w-0 items-start gap-2.5 rounded-[12px] border border-l-[3px] px-2.5 py-2 ${item.style.baseGradient} ${item.style.baseBorder} ${item.style.leftBorder}`}
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${item.style.glowClass}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${item.style.labelClass}`}>
                    {item.title}
                  </p>
                  <p className={`mt-0.5 text-xs leading-snug ${item.style.subtitleClass}`}>
                    {item.explanation}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={hoursHeadingId} className="min-w-0">
          <h3
            id={hoursHeadingId}
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5499BF] dark:text-sky-300/90"
          >
            Hours Explained
          </h3>
          <ul className="mt-3 divide-y divide-[#E8F3FE] dark:divide-white/10">
            {HOURS_ITEMS.map((item) => (
              <li key={item.label} className="flex min-w-0 items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="shrink-0 text-sm font-semibold text-[#113C69] dark:text-slate-100">
                  {item.label}
                </span>
                <span className="min-w-0 text-right text-xs leading-snug text-[#3D7A9C] dark:text-slate-400">
                  {item.explanation}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={tipsHeadingId} className="min-w-0">
          <h3
            id={tipsHeadingId}
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5499BF] dark:text-sky-300/90"
          >
            Quick Tips
          </h3>
          <ul className="mt-3 space-y-2.5">
            {TIP_ITEMS.map((tip) => (
              <li key={tip} className="flex min-w-0 items-start gap-2.5">
                <span
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E8F3FE] text-[#0B68BE] ring-1 ring-[#BFE3F5] dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/50"
                  aria-hidden
                >
                  <Check className="size-3 stroke-[2.5]" />
                </span>
                <p className="min-w-0 text-xs leading-snug text-[#2A376F] dark:text-slate-200">
                  {tip}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  )
}
