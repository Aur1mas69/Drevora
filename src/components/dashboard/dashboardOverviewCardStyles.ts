/**
 * Shared surface styles for /admin Dashboard overview cards
 * (below the circular KPI row).
 */

export const dashboardOverviewCardBase =
  'dashboard-overview-card relative overflow-hidden rounded-[22px] border border-[#B7D7F2] bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(240,248,255,0.95)_40%,rgba(224,240,255,0.92)_100%)] shadow-[0_10px_28px_rgba(30,64,175,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)]'

export const dashboardOverviewCardInteractive =
  'transition-all duration-[200ms] ease-out md:hover:-translate-y-[3px] md:hover:border-[#9CC8EA] md:hover:shadow-[0_14px_32px_rgba(30,64,175,0.14)] md:active:-translate-y-px md:active:scale-[0.99] md:active:shadow-[0_6px_16px_rgba(30,64,175,0.09)] dark:md:hover:border-slate-600 dark:md:hover:shadow-[0_14px_32px_rgba(0,0,0,0.42)]'

export const dashboardOverviewCardPadding = 'p-4 sm:p-5'

/** Clickable / hover-elevating overview cards */
export const dashboardOverviewCardClass = `${dashboardOverviewCardBase} ${dashboardOverviewCardPadding} ${dashboardOverviewCardInteractive}`

/** Non-elevating surfaces that still share the same shell (e.g. tall activity rail) */
export const dashboardOverviewCardStaticClass = `${dashboardOverviewCardBase} ${dashboardOverviewCardPadding}`

export const dashboardOverviewCardTitleClass =
  'text-[15px] font-semibold tracking-[-0.025em] text-[#123A63] dark:text-slate-100 sm:text-base'

export const dashboardOverviewCardSubtitleClass =
  'mt-0.5 text-[11px] leading-4 text-[#6B8AAB] dark:text-slate-400 sm:text-xs sm:leading-5'

export const dashboardOverviewCardActionClass =
  'shrink-0 pt-0.5 text-xs font-semibold text-[#3B82F6] transition-colors hover:text-[#2563EB] hover:underline dark:text-blue-300 dark:hover:text-blue-200'

/** Soft inner content row used across status / check cards */
export const dashboardOverviewInnerRowClass =
  'rounded-xl border border-[#D0E4F6] bg-[rgba(248,251,255,0.92)] px-3.5 py-2.5 shadow-[0_1px_4px_rgba(30,64,175,0.04)] transition-colors hover:bg-[#EEF6FE]/95 dark:border-white/10 dark:bg-slate-800/50 dark:hover:bg-slate-800/70 sm:px-4 sm:py-3'

export const dashboardOverviewDividerClass = 'border-[#D2E5F5] dark:border-white/10'

/** Primary numeric emphasis shared by Fleet Status / Checks / Driver Reports */
export const dashboardOverviewPrimaryValueClass =
  'shrink-0 text-2xl font-bold leading-none tabular-nums tracking-[-0.02em] text-[#123A63] dark:text-slate-100'

export const dashboardOverviewRowLabelClass =
  'text-sm font-semibold text-[#123A63] dark:text-slate-100'

export const dashboardOverviewRowHelperClass =
  'text-xs font-medium text-[#6B8AAB] dark:text-slate-400'

/** Compact 3-up mini KPI tiles (Consumables / Compliance) */
export const dashboardOverviewMiniStatTileClass =
  'flex min-h-[4.25rem] min-w-0 flex-col items-center justify-center rounded-xl border border-[#D0E4F6] bg-[rgba(248,251,255,0.95)] px-1.5 py-2 text-center shadow-[0_1px_4px_rgba(30,64,175,0.04)] dark:border-white/10 dark:bg-slate-800/50'

export const dashboardOverviewMiniStatLabelClass =
  'line-clamp-2 min-h-[1.5rem] text-[10px] font-semibold uppercase leading-tight tracking-[0.05em] text-[#6B8AAB] dark:text-slate-400'

export const dashboardOverviewMiniStatValueClass =
  'mt-1 text-sm font-bold tabular-nums leading-none tracking-[-0.02em] text-[#123A63] dark:text-slate-100'

/** Donut legend rows (Timesheet / Holiday) */
export const dashboardOverviewLegendListClass =
  'flex w-full min-w-0 flex-1 flex-col justify-center gap-2'

export const dashboardOverviewLegendRowClass =
  'flex items-center justify-between gap-3 rounded-lg px-1.5 py-0.5 text-xs'

export const dashboardOverviewLegendLabelClass =
  'truncate font-medium text-[#123A63] dark:text-slate-100'

export const dashboardOverviewLegendValueClass =
  'shrink-0 text-sm font-bold tabular-nums tracking-[-0.02em] text-[#123A63] dark:text-slate-100'
