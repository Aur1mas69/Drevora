import workerHolidayBgUrl from '@/assets/worker-holiday-bg.png'
import {
  buildWorkerHolidayBalanceView,
  formatWorkerHolidayDayCount,
  type WorkerHolidayBalanceView,
} from '@/lib/workerHolidaySelfService'
import type { HolidayBalanceSummary } from '@/lib/holidayRequestTypes'
import { useTranslation } from 'react-i18next'
import {
  myHolidayCardClass,
  myHolidaySectionEyebrowClass,
} from './myHolidayUiStyles'

type MyHolidayBalanceHeroProps = {
  balance: HolidayBalanceSummary | null
  showManagedMessage: boolean
}

/** Green = used/total, blue = days-left/total. Centre shows remaining days. */
function DonutRing({
  used,
  remaining,
  total,
  daysLeftLabel,
}: {
  used: number
  remaining: number | null
  total: number | null
  daysLeftLabel: string
}) {
  const size = 168
  const stroke = 15
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  const safeTotal = total !== null && total > 0 ? total : 0
  const safeUsed = Math.max(0, Number.isFinite(used) ? used : 0)
  const safeRemaining =
    remaining !== null && Number.isFinite(remaining) ? Math.max(0, remaining) : 0

  const usedLen =
    safeTotal > 0 ? Math.min(1, safeUsed / safeTotal) * circumference : 0
  const leftLen =
    safeTotal > 0 ? Math.min(1, safeRemaining / safeTotal) * circumference : 0
  // Cap combined arcs to one full ring if data overshoots.
  const cappedLeft =
    usedLen + leftLen > circumference
      ? Math.max(0, circumference - usedLen)
      : leftLen

  return (
    <div className="relative mx-auto flex size-[168px] items-center justify-center">
      <div
        className="pointer-events-none absolute inset-3 rounded-full opacity-30 blur-2xl"
        style={{
          background:
            'radial-gradient(circle, rgba(33,142,231,0.35) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {/* Soft track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--worker-holiday-donut-track)"
          strokeWidth={stroke}
        />
        {/* Green = USED (starts at top) */}
        {usedLen > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#22C55E"
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${usedLen} ${circumference - usedLen}`}
            strokeDashoffset={0}
            className="transition-[stroke-dasharray] duration-500 ease-out"
          />
        ) : null}
        {/* Blue = DAYS LEFT (continues after used) */}
        {cappedLeft > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#218EE7"
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${cappedLeft} ${circumference - cappedLeft}`}
            strokeDashoffset={-usedLen}
            className="transition-[stroke-dasharray,stroke-dashoffset] duration-500 ease-out"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p
          className="text-4xl font-bold tracking-[-0.05em] tabular-nums"
          style={{ color: 'var(--worker-holiday-donut-text)' }}
        >
          {formatWorkerHolidayDayCount(remaining)}
        </p>
        <p
          className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'var(--worker-holiday-donut-label)' }}
        >
          {daysLeftLabel}
        </p>
      </div>
    </div>
  )
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'green' | 'amber' | 'blue'
}) {
  const styles =
    accent === 'green'
      ? {
          chip: 'my-holiday-stat-chip--green border-emerald-200/80 bg-emerald-50/90',
          label: 'text-emerald-700',
          dot: 'bg-emerald-500',
        }
      : accent === 'amber'
        ? {
            chip: 'my-holiday-stat-chip--amber border-amber-200/80 bg-amber-50/90',
            label: 'text-amber-800',
            dot: 'bg-amber-500',
          }
        : {
            chip: 'my-holiday-stat-chip--blue border-[#BFE3F5] bg-[#E8F3FE]/95',
            label: 'text-[#0B68BE]',
            dot: 'bg-[#218EE7]',
          }

  return (
    <div
      className={`my-holiday-stat-chip flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2.5 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${styles.chip}`}
    >
      <span
        className={`my-holiday-stat-label flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] ${styles.label}`}
      >
        <span className={`my-holiday-stat-dot size-1.5 shrink-0 rounded-full ${styles.dot}`} aria-hidden />
        {label}
      </span>
      <span className="my-holiday-stat-value text-sm font-bold leading-tight tabular-nums text-[#0F172A]">
        {value}
      </span>
    </div>
  )
}

/** Subtle holiday photo bg — island/palms on the right; white wash keeps chart readable. */
function HolidayBalanceDecor() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.65]"
        style={{
          backgroundImage: `url(${workerHolidayBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div
        className="my-holiday-balance-wash absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.48) 34%, rgba(255,255,255,0.12) 58%, rgba(255,255,255,0) 100%)',
        }}
      />
    </div>
  )
}

export function MyHolidayBalanceHero({
  balance,
  showManagedMessage,
}: MyHolidayBalanceHeroProps) {
  const { t } = useTranslation('worker')
  const view: WorkerHolidayBalanceView = buildWorkerHolidayBalanceView(balance)

  return (
    <section className={`relative ${myHolidayCardClass} overflow-hidden`}>
      <HolidayBalanceDecor />

      <div className="relative z-10">
        <p className={myHolidaySectionEyebrowClass}>{t('holidays.balanceEyebrow')}</p>

        {showManagedMessage ? (
          <p className="my-holiday-notice mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
            {t('holidays.managed')}
          </p>
        ) : null}

        <div className="mt-5">
          <DonutRing
            used={view.usedDays}
            remaining={view.remainingDays}
            total={view.totalEntitlement}
            daysLeftLabel={t('holidays.daysLeft')}
          />
        </div>

        <div className="mt-5 flex gap-2.5">
          <StatChip
            label={t('holidays.used')}
            value={formatWorkerHolidayDayCount(view.usedDays)}
            accent="green"
          />
          <StatChip
            label={t('holidays.pending')}
            value={formatWorkerHolidayDayCount(view.pendingDays)}
            accent="amber"
          />
          <StatChip
            label={t('holidays.total')}
            value={formatWorkerHolidayDayCount(view.totalEntitlement)}
            accent="blue"
          />
        </div>
      </div>
    </section>
  )
}
