import type { LucideIcon } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

type Accent = 'blue' | 'cyan' | 'green' | 'warning' | 'danger' | 'neutral'

const KPI_CIRCLE_SIZE_CLASS =
  'w-full max-w-[clamp(6.75rem,34vw,8.75rem)] aspect-square sm:max-w-[11.75rem] lg:max-w-[12.25rem]'

const accentStyles: Record<
  Accent,
  {
    icon: string
    iconHover: string
    glow: string
    ringStroke: string
    ringTrack: string
    baseBorder: string
    baseGradient: string
    baseShadow: string
    labelColor: string
    hoverBorder: string
    hoverShadow: string
    hoverGradient: string
    activeBorder: string
    activeGradient: string
    activeShadow: string
    focusRing: string
  }
> = {
  blue: {
    icon: 'bg-[#D3E9FC] text-[#0B68BE] border-[#BFE3F5]',
    iconHover: 'group-hover:bg-[#BFE3F5] group-hover:border-[#89CFF0]',
    glow: 'bg-[#89CFF0]/30 group-hover:bg-[#89CFF0]/45',
    ringStroke: '#218EE7',
    ringTrack: '#C5E4FC',
    baseBorder: 'border-[#89CFF0]',
    baseGradient: 'bg-gradient-to-br from-[#E8F3FE] via-[#DFEEFF] to-[#D3E9FC]',
    baseShadow: 'shadow-[0_8px_24px_rgba(33,142,231,0.14)] max-md:shadow-[0_4px_14px_rgba(33,142,231,0.1)]',
    labelColor: 'text-[#0B68BE]',
    hoverBorder: 'group-hover:border-[#218EE7]',
    hoverShadow:
      'group-hover:shadow-[0_0_0_1px_rgba(33,142,231,0.2),0_16px_36px_rgba(33,142,231,0.2)]',
    hoverGradient: 'group-hover:from-[#D3E9FC] group-hover:via-[#C8E4FC] group-hover:to-[#BFE3F5]',
    activeBorder: 'group-active:border-[#0B68BE]',
    activeGradient: 'group-active:from-[#C8E4FC] group-active:via-[#BFE3F5] group-active:to-[#A8D4F7]',
    activeShadow:
      'group-active:shadow-[0_0_0_1px_rgba(33,142,231,0.32),0_8px_22px_rgba(33,142,231,0.18)]',
    focusRing: 'focus-visible:ring-[#218EE7]/40',
  },
  cyan: {
    icon: 'bg-[#E0EBFF] text-[#3B6FD9] border-[#C5D8FF]',
    iconHover: 'group-hover:bg-[#D0E0FF] group-hover:border-[#A8C4FF]',
    glow: 'bg-[#A8C4FF]/30 group-hover:bg-[#A8C4FF]/45',
    ringStroke: '#5B8DEF',
    ringTrack: '#D0E0FF',
    baseBorder: 'border-[#A8C4FF]',
    baseGradient: 'bg-gradient-to-br from-[#EDF3FF] via-[#E4ECFF] to-[#D6E4FF]',
    baseShadow: 'shadow-[0_8px_24px_rgba(91,141,239,0.14)] max-md:shadow-[0_4px_14px_rgba(91,141,239,0.1)]',
    labelColor: 'text-[#2E5BB5]',
    hoverBorder: 'group-hover:border-[#5B8DEF]',
    hoverShadow:
      'group-hover:shadow-[0_0_0_1px_rgba(91,141,239,0.2),0_16px_36px_rgba(91,141,239,0.18)]',
    hoverGradient: 'group-hover:from-[#E0EBFF] group-hover:via-[#D0E0FF] group-hover:to-[#C5D8FF]',
    activeBorder: 'group-active:border-[#3B6FD9]',
    activeGradient: 'group-active:from-[#D0E0FF] group-active:via-[#C5D8FF] group-active:to-[#B8CCFF]',
    activeShadow:
      'group-active:shadow-[0_0_0_1px_rgba(91,141,239,0.28),0_8px_22px_rgba(91,141,239,0.16)]',
    focusRing: 'focus-visible:ring-[#5B8DEF]/40',
  },
  green: {
    icon: 'bg-emerald-100/90 text-emerald-700 border-emerald-200',
    iconHover: 'group-hover:bg-emerald-200/80 group-hover:border-emerald-300',
    glow: 'bg-emerald-300/25 group-hover:bg-emerald-300/40',
    ringStroke: '#10b981',
    ringTrack: '#BBF7D0',
    baseBorder: 'border-emerald-200',
    baseGradient: 'bg-gradient-to-br from-emerald-50 via-teal-50/90 to-[#D1FAE5]',
    baseShadow: 'shadow-[0_8px_24px_rgba(16,185,129,0.12)] max-md:shadow-[0_4px_14px_rgba(16,185,129,0.08)]',
    labelColor: 'text-emerald-800',
    hoverBorder: 'group-hover:border-emerald-400',
    hoverShadow:
      'group-hover:shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_16px_36px_rgba(16,185,129,0.16)]',
    hoverGradient: 'group-hover:from-emerald-100/80 group-hover:via-teal-100/70 group-hover:to-emerald-200/60',
    activeBorder: 'group-active:border-emerald-500',
    activeGradient: 'group-active:from-emerald-100 group-active:via-teal-100 group-active:to-emerald-200/80',
    activeShadow:
      'group-active:shadow-[0_0_0_1px_rgba(16,185,129,0.28),0_8px_22px_rgba(16,185,129,0.14)]',
    focusRing: 'focus-visible:ring-emerald-500/40',
  },
  warning: {
    icon: 'bg-amber-100/90 text-amber-700 border-amber-200',
    iconHover: 'group-hover:bg-amber-200/80 group-hover:border-amber-300',
    glow: 'bg-amber-300/25 group-hover:bg-amber-300/40',
    ringStroke: '#f59e0b',
    ringTrack: '#FDE68A',
    baseBorder: 'border-amber-200',
    baseGradient: 'bg-gradient-to-br from-amber-50 via-orange-50/90 to-[#FFEDD5]',
    baseShadow: 'shadow-[0_8px_24px_rgba(245,158,11,0.12)] max-md:shadow-[0_4px_14px_rgba(245,158,11,0.08)]',
    labelColor: 'text-amber-800',
    hoverBorder: 'group-hover:border-amber-400',
    hoverShadow:
      'group-hover:shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_16px_36px_rgba(245,158,11,0.16)]',
    hoverGradient: 'group-hover:from-amber-100/80 group-hover:via-orange-100/70 group-hover:to-amber-200/60',
    activeBorder: 'group-active:border-amber-500',
    activeGradient: 'group-active:from-amber-100 group-active:via-orange-100 group-active:to-amber-200/80',
    activeShadow:
      'group-active:shadow-[0_0_0_1px_rgba(245,158,11,0.28),0_8px_22px_rgba(245,158,11,0.14)]',
    focusRing: 'focus-visible:ring-amber-500/40',
  },
  danger: {
    icon: 'bg-rose-100/90 text-rose-700 border-rose-200',
    iconHover: 'group-hover:bg-rose-200/80 group-hover:border-rose-300',
    glow: 'bg-rose-300/30 group-hover:bg-rose-300/45',
    ringStroke: '#e11d48',
    ringTrack: '#FECDD3',
    baseBorder: 'border-rose-300',
    baseGradient: 'bg-gradient-to-br from-rose-50 via-orange-50/80 to-[#FFE4E6]',
    baseShadow: 'shadow-[0_8px_24px_rgba(225,29,72,0.14)] max-md:shadow-[0_4px_14px_rgba(225,29,72,0.1)]',
    labelColor: 'text-rose-800',
    hoverBorder: 'group-hover:border-rose-400',
    hoverShadow:
      'group-hover:shadow-[0_0_0_1px_rgba(225,29,72,0.2),0_16px_36px_rgba(225,29,72,0.18)]',
    hoverGradient: 'group-hover:from-rose-100/80 group-hover:via-orange-100/60 group-hover:to-rose-200/70',
    activeBorder: 'group-active:border-rose-500',
    activeGradient: 'group-active:from-rose-100 group-active:via-rose-100 group-active:to-rose-200/80',
    activeShadow:
      'group-active:shadow-[0_0_0_1px_rgba(225,29,72,0.3),0_8px_22px_rgba(225,29,72,0.16)]',
    focusRing: 'focus-visible:ring-rose-500/40',
  },
  neutral: {
    icon: 'bg-[#E8F3FE] text-[#5499BF] border-[#D3E9FC]',
    iconHover: 'group-hover:bg-[#D3E9FC] group-hover:border-[#BFE3F5]',
    glow: 'bg-[#BFE3F5]/25 group-hover:bg-[#BFE3F5]/40',
    ringStroke: '#89CFF0',
    ringTrack: '#E8F3FE',
    baseBorder: 'border-[#D3E9FC]',
    baseGradient: 'bg-gradient-to-br from-[#F5FAFF] via-[#EFF7FF] to-[#E8F3FE]',
    baseShadow: 'shadow-[0_8px_24px_rgba(137,207,240,0.1)] max-md:shadow-[0_4px_14px_rgba(137,207,240,0.08)]',
    labelColor: 'text-[#5499BF]',
    hoverBorder: 'group-hover:border-[#BFE3F5]',
    hoverShadow:
      'group-hover:shadow-[0_0_0_1px_rgba(137,207,240,0.16),0_16px_36px_rgba(137,207,240,0.14)]',
    hoverGradient: 'group-hover:from-[#EFF7FF] group-hover:via-[#E8F3FE] group-hover:to-[#D3E9FC]',
    activeBorder: 'group-active:border-[#89CFF0]',
    activeGradient: 'group-active:from-[#E8F3FE] group-active:via-[#D3E9FC] group-active:to-[#BFE3F5]',
    activeShadow:
      'group-active:shadow-[0_0_0_1px_rgba(137,207,240,0.24),0_8px_22px_rgba(137,207,240,0.12)]',
    focusRing: 'focus-visible:ring-[#89CFF0]/40',
  },
}

function CircularProgressRing({
  percent,
  strokeColor,
  trackColor,
}: {
  percent: number
  strokeColor: string
  trackColor: string
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))
  const radius = 47
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <svg
      className="pointer-events-none size-full -rotate-90"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r={radius} fill="none" stroke={trackColor} strokeWidth="2.5" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
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
  const showRing = ringPercent !== undefined
  const issueBadgeVisible = showIssueBadge ?? issueCount > 0

  const circleClassName = [
    'flex size-full min-h-0 flex-col items-center justify-center rounded-full border-2',
    styles.baseGradient,
    styles.baseBorder,
    styles.baseShadow,
    'px-2 text-center sm:px-4',
    'transition-all duration-300 ease-out',
    'md:group-hover:-translate-y-1',
    styles.hoverBorder,
    styles.hoverShadow,
    styles.hoverGradient,
    styles.activeBorder,
    styles.activeGradient,
    styles.activeShadow,
    'group-active:scale-[0.97]',
  ].join(' ')

  const widget = (
    <div className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center">
      <div className={`relative shrink-0 ${KPI_CIRCLE_SIZE_CLASS}`}>
        {showRing ? (
          <div className="pointer-events-none absolute inset-0">
            <CircularProgressRing
              percent={ringPercent}
              strokeColor={styles.ringStroke}
              trackColor={styles.ringTrack}
            />
          </div>
        ) : null}

        <div
          className={
            showRing
              ? 'flex size-full flex-col p-[5px]'
              : 'flex size-full flex-col'
          }
        >
          <div className={circleClassName}>
            {issueBadgeVisible ? (
              <div className="flex w-full shrink-0 justify-end px-1.5 pt-1 sm:px-2 sm:pt-1.5">
                <span
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-[9px] font-bold leading-none text-white shadow-sm sm:size-6 sm:text-[10px]"
                  aria-hidden="true"
                >
                  {issueCount > 9 ? '9+' : issueCount}
                </span>
              </div>
            ) : null}

            <div
              className={`pointer-events-none absolute inset-4 hidden rounded-full blur-xl transition-all duration-300 md:block ${styles.glow}`}
              aria-hidden="true"
            />

            <div
              className={`relative flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 px-1 sm:gap-1.5 sm:px-2 md:gap-2 ${
                issueBadgeVisible ? '-mt-1 sm:-mt-1.5' : ''
              }`}
            >
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300 sm:size-9 md:size-10 md:group-hover:scale-105 ${styles.icon} ${styles.iconHover}`}
              >
                <Icon className="size-3.5 sm:size-4 md:size-[18px]" strokeWidth={2.1} aria-hidden="true" />
              </div>

              <p className="w-full text-[clamp(1.35rem,5vw,1.65rem)] font-bold leading-none tracking-[-0.04em] text-[#113C69] sm:text-[2rem] lg:text-[2.15rem]">
                {value}
              </p>

              <p
                className={`w-full break-words px-0.5 text-[clamp(0.625rem,2.8vw,0.6875rem)] font-semibold leading-snug sm:text-xs ${styles.labelColor}`}
              >
                {title}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p
        className={`mt-2 w-full min-w-0 px-0.5 text-center text-[10px] leading-snug break-words sm:px-1 sm:text-[11px] ${
          helperTone === 'danger'
            ? 'font-semibold text-rose-600'
            : 'text-[#3D7A9C]'
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
        className={`group block min-h-11 min-w-0 overflow-hidden transition-transform duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99] ${styles.focusRing}`}
      >
        {widget}
      </Link>
    )
  }

  return <div className="group min-w-0 overflow-hidden">{widget}</div>
}
