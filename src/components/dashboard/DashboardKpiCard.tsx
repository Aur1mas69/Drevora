import type { LucideIcon } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

type Accent = 'blue' | 'cyan' | 'green' | 'warning' | 'danger' | 'neutral'

const KPI_CIRCLE_SIZE_CLASS =
  'w-full max-w-[clamp(6.75rem,34vw,8.75rem)] aspect-square sm:max-w-[11.75rem] lg:max-w-[12.25rem]'

/** Soft center illumination — same strength for every accent. */
const KPI_INNER_GLOW_LAYER = 'pointer-events-none absolute inset-0 rounded-full'

/** Soft outer halo blur — lit in the default state, not hover-only. */
const KPI_BLUR_HALO_LAYER =
  'pointer-events-none absolute inset-3 rounded-full blur-2xl opacity-90 transition-opacity duration-300 md:inset-4 group-hover:opacity-100'

const accentStyles: Record<
  Accent,
  {
    icon: string
    iconHover: string
    glow: string
    innerGlow: string
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
    icon: 'bg-[#DCEEFF] text-[#3B82F6] border-[#CFE3F5]',
    iconHover: 'group-hover:bg-[#CFE3F5] group-hover:border-[#B8D4EB]',
    glow: 'bg-[#60A5FA]/35',
    innerGlow:
      'radial-gradient(circle at 50% 36%, rgba(96,165,250,0.34) 0%, rgba(59,130,246,0.16) 38%, rgba(219,234,254,0.22) 62%, rgba(248,251,255,0.08) 100%)',
    ringStroke: '#3B82F6',
    ringTrack: '#DCEEFF',
    baseBorder: 'border-[#B8D4EB]',
    baseGradient: 'bg-gradient-to-br from-[#F0F7FF] via-[#E4F0FF] to-[#C7DFFF]',
    baseShadow:
      'shadow-[0_4px_16px_rgba(59,130,246,0.14)] max-md:shadow-[0_2px_10px_rgba(59,130,246,0.10)]',
    labelColor: 'text-[#3B82F6]',
    hoverBorder: 'group-hover:border-[#93C5FD]',
    hoverShadow: 'group-hover:shadow-[0_6px_20px_rgba(59,130,246,0.18)]',
    hoverGradient:
      'group-hover:from-[#EAF4FF] group-hover:via-[#DCEEFF] group-hover:to-[#BFDBFE]',
    activeBorder: 'group-active:border-[#93C5FD]',
    activeGradient:
      'group-active:from-[#E0EFFF] group-active:via-[#D4E8FF] group-active:to-[#BFDBFE]',
    activeShadow: 'group-active:shadow-[0_2px_10px_rgba(59,130,246,0.12)]',
    focusRing: 'focus-visible:ring-[#3B82F6]/35',
  },
  cyan: {
    icon: 'bg-[#EEF7FF] text-[#3B82F6] border-[#CFE3F5]',
    iconHover: 'group-hover:bg-[#DCEEFF] group-hover:border-[#CFE3F5]',
    glow: 'bg-[#60A5FA]/35',
    innerGlow:
      'radial-gradient(circle at 50% 36%, rgba(96,165,250,0.34) 0%, rgba(59,130,246,0.16) 38%, rgba(219,234,254,0.22) 62%, rgba(248,251,255,0.08) 100%)',
    ringStroke: '#3B82F6',
    ringTrack: '#EEF7FF',
    baseBorder: 'border-[#B8D4EB]',
    baseGradient: 'bg-gradient-to-br from-[#F0F7FF] via-[#E4F0FF] to-[#C7DFFF]',
    baseShadow:
      'shadow-[0_4px_16px_rgba(59,130,246,0.14)] max-md:shadow-[0_2px_10px_rgba(59,130,246,0.10)]',
    labelColor: 'text-[#3B82F6]',
    hoverBorder: 'group-hover:border-[#93C5FD]',
    hoverShadow: 'group-hover:shadow-[0_6px_20px_rgba(59,130,246,0.18)]',
    hoverGradient:
      'group-hover:from-[#EAF4FF] group-hover:via-[#DCEEFF] group-hover:to-[#BFDBFE]',
    activeBorder: 'group-active:border-[#93C5FD]',
    activeGradient:
      'group-active:from-[#E0EFFF] group-active:via-[#D4E8FF] group-active:to-[#BFDBFE]',
    activeShadow: 'group-active:shadow-[0_2px_10px_rgba(59,130,246,0.12)]',
    focusRing: 'focus-visible:ring-[#3B82F6]/35',
  },
  green: {
    icon: 'bg-emerald-100/90 text-emerald-700 border-emerald-200',
    iconHover: 'group-hover:bg-emerald-200/80 group-hover:border-emerald-300',
    glow: 'bg-emerald-400/35',
    innerGlow:
      'radial-gradient(circle at 50% 36%, rgba(52,211,153,0.34) 0%, rgba(16,185,129,0.16) 38%, rgba(167,243,208,0.22) 62%, rgba(236,253,245,0.08) 100%)',
    ringStroke: '#10b981',
    ringTrack: '#BBF7D0',
    baseBorder: 'border-emerald-300',
    baseGradient: 'bg-gradient-to-br from-emerald-50 via-teal-50/90 to-[#A7F3D0]',
    baseShadow:
      'shadow-[0_4px_16px_rgba(16,185,129,0.14)] max-md:shadow-[0_2px_10px_rgba(16,185,129,0.10)]',
    labelColor: 'text-emerald-800',
    hoverBorder: 'group-hover:border-emerald-400',
    hoverShadow: 'group-hover:shadow-[0_6px_20px_rgba(16,185,129,0.18)]',
    hoverGradient:
      'group-hover:from-emerald-100/80 group-hover:via-teal-100/70 group-hover:to-emerald-200/60',
    activeBorder: 'group-active:border-emerald-500',
    activeGradient:
      'group-active:from-emerald-100 group-active:via-teal-100 group-active:to-emerald-200/80',
    activeShadow: 'group-active:shadow-[0_2px_10px_rgba(16,185,129,0.1)]',
    focusRing: 'focus-visible:ring-emerald-500/40',
  },
  warning: {
    icon: 'bg-amber-100/90 text-amber-700 border-amber-200',
    iconHover: 'group-hover:bg-amber-200/80 group-hover:border-amber-300',
    glow: 'bg-amber-400/35',
    innerGlow:
      'radial-gradient(circle at 50% 36%, rgba(251,191,36,0.36) 0%, rgba(245,158,11,0.18) 38%, rgba(254,215,170,0.24) 62%, rgba(255,251,235,0.08) 100%)',
    ringStroke: '#f59e0b',
    ringTrack: '#FDE68A',
    baseBorder: 'border-amber-300',
    baseGradient: 'bg-gradient-to-br from-amber-50 via-orange-50/90 to-[#FFEDD5]',
    baseShadow:
      'shadow-[0_4px_16px_rgba(245,158,11,0.16)] max-md:shadow-[0_2px_10px_rgba(245,158,11,0.12)]',
    labelColor: 'text-amber-800',
    hoverBorder: 'group-hover:border-amber-400',
    hoverShadow: 'group-hover:shadow-[0_6px_20px_rgba(245,158,11,0.18)]',
    hoverGradient:
      'group-hover:from-amber-100/80 group-hover:via-orange-100/70 group-hover:to-amber-200/60',
    activeBorder: 'group-active:border-amber-500',
    activeGradient:
      'group-active:from-amber-100 group-active:via-orange-100 group-active:to-amber-200/80',
    activeShadow: 'group-active:shadow-[0_2px_10px_rgba(245,158,11,0.1)]',
    focusRing: 'focus-visible:ring-amber-500/40',
  },
  danger: {
    icon: 'bg-rose-100/90 text-rose-700 border-rose-200',
    iconHover: 'group-hover:bg-rose-200/80 group-hover:border-rose-300',
    glow: 'bg-rose-400/35',
    innerGlow:
      'radial-gradient(circle at 50% 36%, rgba(251,113,133,0.34) 0%, rgba(244,63,94,0.16) 38%, rgba(254,205,211,0.24) 62%, rgba(255,241,242,0.08) 100%)',
    ringStroke: '#e11d48',
    ringTrack: '#FECDD3',
    baseBorder: 'border-rose-300',
    baseGradient: 'bg-gradient-to-br from-rose-50 via-orange-50/80 to-[#FECDD3]',
    baseShadow:
      'shadow-[0_4px_16px_rgba(225,29,72,0.14)] max-md:shadow-[0_2px_10px_rgba(225,29,72,0.10)]',
    labelColor: 'text-rose-800',
    hoverBorder: 'group-hover:border-rose-400',
    hoverShadow: 'group-hover:shadow-[0_6px_20px_rgba(225,29,72,0.16)]',
    hoverGradient:
      'group-hover:from-rose-100/80 group-hover:via-orange-100/60 group-hover:to-rose-200/70',
    activeBorder: 'group-active:border-rose-500',
    activeGradient:
      'group-active:from-rose-100 group-active:via-rose-100 group-active:to-rose-200/80',
    activeShadow: 'group-active:shadow-[0_2px_10px_rgba(225,29,72,0.1)]',
    focusRing: 'focus-visible:ring-rose-500/40',
  },
  neutral: {
    icon: 'bg-[#DCEEFF] text-[#5D7C9D] border-[#CFE3F5]',
    iconHover: 'group-hover:bg-[#CFE3F5] group-hover:border-[#B8D4EB]',
    glow: 'bg-[#60A5FA]/28',
    innerGlow:
      'radial-gradient(circle at 50% 36%, rgba(96,165,250,0.28) 0%, rgba(59,130,246,0.12) 38%, rgba(219,234,254,0.18) 62%, rgba(248,251,255,0.08) 100%)',
    ringStroke: '#3B82F6',
    ringTrack: '#EEF7FF',
    baseBorder: 'border-[#B8D4EB]',
    baseGradient: 'bg-gradient-to-br from-[#F0F7FF] via-[#E8F3FF] to-[#D7E8FF]',
    baseShadow:
      'shadow-[0_4px_16px_rgba(59,130,246,0.12)] max-md:shadow-[0_2px_10px_rgba(59,130,246,0.08)]',
    labelColor: 'text-[#5D7C9D]',
    hoverBorder: 'group-hover:border-[#93C5FD]',
    hoverShadow: 'group-hover:shadow-[0_6px_20px_rgba(59,130,246,0.14)]',
    hoverGradient:
      'group-hover:from-[#F8FBFF] group-hover:via-[#EEF7FF] group-hover:to-[#DCEEFF]',
    activeBorder: 'group-active:border-[#B8D4EB]',
    activeGradient:
      'group-active:from-[#EEF7FF] group-active:via-[#E6F2FF] group-active:to-[#DCEEFF]',
    activeShadow: 'group-active:shadow-[0_2px_10px_rgba(22,58,99,0.08)]',
    focusRing: 'focus-visible:ring-[#3B82F6]/35',
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
    'relative flex size-full min-h-0 flex-col items-center justify-center overflow-hidden rounded-full border-2',
    styles.baseGradient,
    styles.baseBorder,
    styles.baseShadow,
    'px-2 text-center sm:px-4',
    'transition-all duration-[200ms] ease-out',
    styles.hoverBorder,
    styles.hoverShadow,
    styles.hoverGradient,
    styles.activeBorder,
    styles.activeGradient,
    styles.activeShadow,
    'group-active:scale-[0.97]',
    'dark:from-slate-800/95 dark:via-slate-800/90 dark:to-slate-900 dark:border-slate-600/70',
    'dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]',
    'dark:group-hover:border-slate-500 dark:group-hover:from-slate-700/95 dark:group-hover:via-slate-800 dark:group-hover:to-slate-900',
    'dark:group-active:border-slate-500 dark:group-active:from-slate-800 dark:group-active:via-slate-800 dark:group-active:to-slate-900',
  ].join(' ')

  const widget = (
    <div className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center overflow-visible">
      {/* Relative shell: owns hover lift + badge so neither is clipped by the circle face */}
      <div
        className={`relative shrink-0 overflow-visible transition-transform duration-[200ms] ease-out md:group-hover:-translate-y-[3px] ${KPI_CIRCLE_SIZE_CLASS}`}
      >
        {issueBadgeVisible ? (
          <span
            className="pointer-events-none absolute top-1.5 right-1.5 z-20 inline-flex size-6 shrink-0 translate-x-[35%] -translate-y-[35%] items-center justify-center rounded-full border-2 border-white bg-rose-500 text-[10px] font-bold leading-none text-white shadow-sm sm:top-2 sm:right-2 sm:text-[11px]"
            aria-hidden="true"
          >
            {issueCount > 9 ? '9+' : issueCount}
          </span>
        ) : null}

        {showRing ? (
          <div className="pointer-events-none absolute inset-0 z-[1]">
            <CircularProgressRing
              percent={ringPercent}
              strokeColor={styles.ringStroke}
              trackColor={styles.ringTrack}
            />
          </div>
        ) : null}

        <div
          className={
            showRing ? 'relative z-0 flex size-full flex-col p-[5px]' : 'relative z-0 flex size-full flex-col'
          }
        >
          <div className={circleClassName}>
            <div
              className={KPI_INNER_GLOW_LAYER}
              style={{ background: styles.innerGlow }}
              aria-hidden="true"
            />

            <div className={`${KPI_BLUR_HALO_LAYER} ${styles.glow}`} aria-hidden="true" />

            <div className="relative z-[1] flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 px-1 sm:gap-1.5 sm:px-2 md:gap-2">
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition-all duration-[200ms] sm:size-9 md:size-10 md:group-hover:scale-105 ${styles.icon} ${styles.iconHover}`}
              >
                <Icon
                  className="size-3.5 sm:size-4 md:size-[18px]"
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
              </div>

              <p className="w-full text-[clamp(1.35rem,5vw,1.65rem)] font-bold leading-none tracking-[-0.04em] text-[#163A63] dark:text-slate-100 sm:text-[2rem] lg:text-[2.15rem]">
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
          helperTone === 'danger' ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-[#5D7C9D] dark:text-slate-400'
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
        className={`group relative block min-h-11 min-w-0 overflow-visible transition-transform duration-[200ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99] ${styles.focusRing}`}
      >
        {widget}
      </Link>
    )
  }

  return <div className="group relative min-w-0 overflow-visible">{widget}</div>
}
