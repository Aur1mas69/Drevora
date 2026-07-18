/**
 * Shared surface styles for /admin Dashboard overview cards
 * (below the circular KPI row).
 */

export const dashboardOverviewCardBase =
  'dashboard-overview-card relative overflow-hidden rounded-[20px] border border-[#C6DFF4] bg-[linear-gradient(145deg,rgba(255,255,255,0.97)_0%,rgba(245,250,255,0.94)_42%,rgba(232,244,255,0.90)_100%)] shadow-[0_8px_24px_rgba(30,64,175,0.08)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_10px_28px_rgba(0,0,0,0.35)]'

export const dashboardOverviewCardInteractive =
  'transition-all duration-[200ms] ease-out md:hover:-translate-y-[3px] md:hover:border-[#A8CCEA] md:hover:shadow-[0_12px_28px_rgba(30,64,175,0.12)] md:active:-translate-y-px md:active:scale-[0.99] md:active:shadow-[0_6px_16px_rgba(30,64,175,0.09)] dark:md:hover:border-slate-600 dark:md:hover:shadow-[0_14px_32px_rgba(0,0,0,0.42)]'

export const dashboardOverviewCardPadding = 'p-[18px] sm:p-5'

/** Clickable / hover-elevating overview cards */
export const dashboardOverviewCardClass = `${dashboardOverviewCardBase} ${dashboardOverviewCardPadding} ${dashboardOverviewCardInteractive}`

/** Non-elevating surfaces that still share the same shell (e.g. tall activity rail) */
export const dashboardOverviewCardStaticClass = `${dashboardOverviewCardBase} ${dashboardOverviewCardPadding}`

export const dashboardOverviewCardTitleClass =
  'text-[15px] font-semibold tracking-[-0.02em] text-[#163A63] dark:text-slate-100 sm:text-base'

export const dashboardOverviewCardSubtitleClass =
  'mt-0.5 text-xs leading-5 text-[#5D7C9D] dark:text-slate-400 sm:text-[13px]'

export const dashboardOverviewCardActionClass =
  'shrink-0 text-xs font-semibold text-[#3B82F6] transition-colors hover:text-[#2563EB] hover:underline dark:text-blue-300 dark:hover:text-blue-200'

export const dashboardOverviewInnerRowClass =
  'rounded-xl border border-[#D2E5F5] bg-[rgba(244,249,255,0.9)] px-4 py-3 transition-colors hover:bg-[#E8F3FE]/90 dark:border-white/10 dark:bg-slate-800/50 dark:hover:bg-slate-800/70'

export const dashboardOverviewDividerClass = 'border-[#D2E5F5] dark:border-white/10'
