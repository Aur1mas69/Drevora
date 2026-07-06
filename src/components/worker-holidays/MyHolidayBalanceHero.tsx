import {
  buildWorkerHolidayBalanceView,
  formatWorkerHolidayDayCount,
  type WorkerHolidayBalanceView,
} from '@/lib/workerHolidaySelfService'
import type { HolidayBalanceSummary } from '@/lib/holidayRequestTypes'
import { myHolidayCardClass, myHolidayChipClass, myHolidaySectionEyebrowClass } from './myHolidayUiStyles'

type MyHolidayBalanceHeroProps = {
  balance: HolidayBalanceSummary | null
  showManagedMessage: boolean
}

function DonutRing({
  remaining,
  total,
}: {
  remaining: number | null
  total: number | null
}) {
  const size = 168
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const safeTotal = total && total > 0 ? total : 1
  const safeRemaining =
    remaining !== null && Number.isFinite(remaining) ? Math.max(0, remaining) : 0
  const progress = total && total > 0 ? Math.min(1, safeRemaining / safeTotal) : 0.65
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="relative mx-auto flex size-[168px] items-center justify-center">
      <div
        className="pointer-events-none absolute inset-0 rounded-full bg-[#89CFF0]/25 blur-2xl"
        aria-hidden
      />
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8F3FE"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#myHolidayDonutGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
        <defs>
          <linearGradient id="myHolidayDonutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#218EE7" />
            <stop offset="100%" stopColor="#7DB8FF" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-4xl font-bold tracking-[-0.05em] text-[#0B477F] tabular-nums">
          {formatWorkerHolidayDayCount(remaining)}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#5499BF]">
          days left
        </p>
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${myHolidayChipClass} flex min-w-0 flex-1 flex-col items-center gap-0.5`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums text-[#113C69]">{value}</span>
    </div>
  )
}

export function MyHolidayBalanceHero({
  balance,
  showManagedMessage,
}: MyHolidayBalanceHeroProps) {
  const view: WorkerHolidayBalanceView = buildWorkerHolidayBalanceView(balance)

  return (
    <section className={`${myHolidayCardClass} overflow-hidden`}>
      <p className={myHolidaySectionEyebrowClass}>Holiday balance</p>

      {showManagedMessage ? (
        <p className="mt-3 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
          Your holiday balance is managed by your company.
        </p>
      ) : null}

      <div className="mt-4">
        <DonutRing remaining={view.remainingDays} total={view.totalEntitlement} />
      </div>

      <div className="mt-4 flex gap-2">
        <StatChip label="Used" value={formatWorkerHolidayDayCount(view.usedDays)} />
        <StatChip label="Pending" value={formatWorkerHolidayDayCount(view.pendingDays)} />
        <StatChip
          label="Total"
          value={formatWorkerHolidayDayCount(view.totalEntitlement)}
        />
      </div>
    </section>
  )
}
