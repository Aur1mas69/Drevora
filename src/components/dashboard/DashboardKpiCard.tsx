import type { LucideIcon } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

type Accent = 'blue' | 'cyan' | 'green' | 'warning' | 'danger' | 'neutral'

/** ~135–150px mobile, ~160–180px desktop */
const KPI_CIRCLE_SIZE_CLASS =
  'w-full max-w-[clamp(8.5rem,36vw,9.375rem)] aspect-square sm:max-w-[10.5rem] lg:max-w-[11rem]'

const accentStyles: Record<
  Accent,
  {
    icon: string
    ringStroke: string
    ringTrack: string
    face: string
    labelColor: string
    focusRing: string
  }
> = {
  blue: {
    icon: 'bg-[#E8F3FE] text-[#2563EB]',
    ringStroke: '#2563EB',
    ringTrack: '#D7E8FF',
    face: 'bg-[#F4F9FF]',
    labelColor: 'text-[#1E40AF]',
    focusRing: 'focus-visible:ring-[#2563EB]/35',
  },
  cyan: {
    icon: 'bg-[#EAF4FF] text-[#3B82F6]',
    ringStroke: '#3B82F6',
    ringTrack: '#DBEAFE',
    face: 'bg-[#F7FBFF]',
    labelColor: 'text-[#1D4ED8]',
    focusRing: 'focus-visible:ring-[#3B82F6]/35',
  },
  green: {
    icon: 'bg-emerald-100 text-emerald-700',
    ringStroke: '#10B981',
    ringTrack: '#D1FAE5',
    face: 'bg-[#F3FBF7]',
    labelColor: 'text-emerald-800',
    focusRing: 'focus-visible:ring-emerald-500/40',
  },
  warning: {
    icon: 'bg-amber-100 text-amber-700',
    ringStroke: '#F59E0B',
    ringTrack: '#FDE68A',
    face: 'bg-[#FFFBF3]',
    labelColor: 'text-amber-800',
    focusRing: 'focus-visible:ring-amber-500/40',
  },
  danger: {
    icon: 'bg-rose-100 text-rose-700',
    ringStroke: '#E11D48',
    ringTrack: '#FECDD3',
    face: 'bg-[#FFF7F8]',
    labelColor: 'text-rose-800',
    focusRing: 'focus-visible:ring-rose-500/40',
  },
  neutral: {
    icon: 'bg-[#E8EEF5] text-[#5D7C9D]',
    ringStroke: '#94A3B8',
    ringTrack: '#E2E8F0',
    face: 'bg-[#F8FAFC]',
    labelColor: 'text-[#475569]',
    focusRing: 'focus-visible:ring-slate-400/40',
  },
}

function CircularStatusRing({
  percent,
  strokeColor,
  trackColor,
}: {
  percent: number
  strokeColor: string
  trackColor: string
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))
  const radius = 46.5
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <svg
      className="pointer-events-none size-full -rotate-90"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r={radius} fill="none" stroke={trackColor} strokeWidth="3" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  )
}

/** Full circular status ring when no progress percent is supplied. */
function FullCircularStatusRing({
  strokeColor,
  trackColor,
}: {
  strokeColor: string
  trackColor: string
}) {
  return (
    <svg
      className="pointer-events-none size-full -rotate-90"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r={46.5} fill="none" stroke={trackColor} strokeWidth="3" />
      <circle
        cx="50"
        cy="50"
        r={46.5}
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export type DashboardKpiCardProps = {
  title: string
  value: number
  helper: string
  icon: LucideIcon
  to?: string
  accent?: Accent
  ringPercent?: number
  issueCount?: number
  showIssueBadge?: boolean
  helperTone?: 'default' | 'danger'
  onNavigate?: () => void
}

export function DashboardKpiCard({
  title,
  value,
  helper,
  icon: Icon,
  to,
  accent = 'blue',
  ringPercent,
  issueCount = 0,
  showIssueBadge,
  helperTone = 'default',
  onNavigate,
}: DashboardKpiCardProps) {
  const styles = accentStyles[accent]
  const issueBadgeVisible = showIssueBadge ?? issueCount > 0

  const widget = (
    <div className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center overflow-visible">
      <div
        className={`relative shrink-0 overflow-visible transition-transform duration-200 ease-out md:group-hover:-translate-y-0.5 ${KPI_CIRCLE_SIZE_CLASS}`}
      >
        {issueBadgeVisible ? (
          <span
            className="pointer-events-none absolute top-1.5 right-1.5 z-20 inline-flex size-6 shrink-0 translate-x-[35%] -translate-y-[35%] items-center justify-center rounded-full border-2 border-white bg-rose-500 text-[10px] font-bold leading-none text-white shadow-sm sm:top-2 sm:right-2 sm:text-[11px]"
            aria-hidden="true"
          >
            {issueCount > 9 ? '9+' : issueCount}
          </span>
        ) : null}

        <div className="pointer-events-none absolute inset-0 z-[1]">
          {ringPercent !== undefined ? (
            <CircularStatusRing
              percent={ringPercent}
              strokeColor={styles.ringStroke}
              trackColor={styles.ringTrack}
            />
          ) : (
            <FullCircularStatusRing
              strokeColor={styles.ringStroke}
              trackColor={styles.ringTrack}
            />
          )}
        </div>

        <div className="relative z-0 flex size-full flex-col p-[7px]">
          <div
            className={`relative flex size-full min-h-0 flex-col items-center justify-center overflow-hidden rounded-full ${styles.face} px-2.5 text-center transition-colors duration-200 group-hover:brightness-[0.985] group-active:scale-[0.98] dark:bg-slate-800/90`}
          >
            <div className="relative z-[1] flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1.5 px-1 sm:gap-2">
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-full sm:size-9 ${styles.icon}`}
              >
                <Icon
                  className="size-3.5 sm:size-4"
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
              </div>

              <p className="w-full text-[1.875rem] font-bold leading-none tracking-[-0.03em] text-[#163A63] dark:text-slate-100 sm:text-[2rem] lg:text-[2.15rem]">
                {value}
              </p>

              <p
                className={`w-full break-words px-0.5 text-[12px] font-semibold leading-snug sm:text-[13px] lg:text-[14px] ${styles.labelColor}`}
              >
                {title}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p
        className={`mt-2.5 w-full min-w-0 px-0.5 text-center text-[11px] leading-snug break-words sm:text-[12px] ${
          helperTone === 'danger'
            ? 'font-semibold text-rose-600 dark:text-rose-400'
            : 'text-[#5D7C9D] dark:text-slate-400'
        }`}
      >
        {helperTone === 'danger' ? (
          <span className="inline-flex items-center justify-center gap-1">
            <AlertTriangle className="size-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            {helper}
          </span>
        ) : (
          helper
        )}
      </p>
    </div>
  )

  if (to) {
    return (
      <Link
        to={to}
        aria-label={`${title}: ${value}. ${helper}`}
        onClick={() => onNavigate?.()}
        className={`group relative block min-h-11 min-w-0 overflow-visible transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99] ${styles.focusRing}`}
      >
        {widget}
      </Link>
    )
  }

  return <div className="group relative min-w-0 overflow-visible">{widget}</div>
}
