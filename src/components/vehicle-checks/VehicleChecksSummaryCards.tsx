import type { VehicleCheckResultFilter, VehicleCheckSummaryStats } from '@/lib/vehicleCheckTypes'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ShieldQuestion,
  XCircle,
} from 'lucide-react'

export type VehicleChecksKpiFilter =
  | 'checksToday'
  | 'passedToday'
  | 'failedToday'
  | 'defectsReported'
  | 'vehiclesNotChecked'
  | null

type VehicleChecksSummaryCardsProps = {
  stats: VehicleCheckSummaryStats
  vehiclesNotChecked: number | null
  activeFilter: VehicleChecksKpiFilter
  onFilterChange: (value: VehicleChecksKpiFilter) => void
}

type VehicleCheckKpiStyle = {
  gradient: string
  border: string
  leftBorder: string
  shadow: string
  hover: string
  selected: string
  iconWrap: string
  iconClass: string
  valueClass: string
  labelClass: string
  subtitleClass: string
}

type VehicleCheckKpiCard = {
  id: NonNullable<VehicleChecksKpiFilter>
  label: string
  subtitle: string
  icon: LucideIcon
  value: (stats: VehicleCheckSummaryStats, vehiclesNotChecked: number | null) => number | null
  resultFilter?: VehicleCheckResultFilter
  style: VehicleCheckKpiStyle
}

const styles = {
  blue: {
    gradient: 'bg-gradient-to-br from-[#E8F3FE] via-[#DFEEFF] to-[#D3E9FC]',
    border: 'border-[#89CFF0]',
    leftBorder: 'border-l-[#218EE7]',
    shadow: 'shadow-[0_8px_24px_rgba(33,142,231,0.16)]',
    hover:
      'hover:-translate-y-0.5 hover:border-[#218EE7] hover:shadow-[0_0_0_1px_rgba(33,142,231,0.22),0_16px_36px_rgba(33,142,231,0.22)]',
    selected:
      'border-[#218EE7] ring-2 ring-[#89CFF0]/80 shadow-[0_0_0_2px_rgba(33,142,231,0.3),0_14px_34px_rgba(33,142,231,0.24)]',
    iconWrap: 'bg-[#BFE3F5] ring-[#89CFF0]',
    iconClass: 'text-[#0B68BE]',
    valueClass: 'text-[#0B477F]',
    labelClass: 'text-[#0B68BE]',
    subtitleClass: 'text-[#3D7A9C]',
  },
  green: {
    gradient: 'bg-gradient-to-br from-emerald-50 via-teal-50/95 to-[#D1FAE5]',
    border: 'border-emerald-200',
    leftBorder: 'border-l-emerald-500',
    shadow: 'shadow-[0_8px_24px_rgba(16,185,129,0.14)]',
    hover:
      'hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_16px_36px_rgba(16,185,129,0.18)]',
    selected:
      'border-emerald-500 ring-2 ring-emerald-300/70 shadow-[0_0_0_2px_rgba(16,185,129,0.28),0_14px_34px_rgba(16,185,129,0.22)]',
    iconWrap: 'bg-emerald-100 ring-emerald-200',
    iconClass: 'text-emerald-700',
    valueClass: 'text-emerald-950',
    labelClass: 'text-emerald-800',
    subtitleClass: 'text-emerald-800/75',
  },
  rose: {
    gradient: 'bg-gradient-to-br from-rose-50 via-orange-50/85 to-[#FFE4E6]',
    border: 'border-rose-300',
    leftBorder: 'border-l-rose-500',
    shadow: 'shadow-[0_8px_24px_rgba(225,29,72,0.14)]',
    hover:
      'hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-[0_0_0_1px_rgba(225,29,72,0.2),0_16px_36px_rgba(225,29,72,0.18)]',
    selected:
      'border-rose-500 ring-2 ring-rose-300/70 shadow-[0_0_0_2px_rgba(225,29,72,0.28),0_14px_34px_rgba(225,29,72,0.22)]',
    iconWrap: 'bg-rose-100 ring-rose-200',
    iconClass: 'text-rose-700',
    valueClass: 'text-rose-950',
    labelClass: 'text-rose-800',
    subtitleClass: 'text-rose-800/75',
  },
  amber: {
    gradient: 'bg-gradient-to-br from-amber-50 via-orange-50/95 to-[#FFEDD5]',
    border: 'border-amber-200',
    leftBorder: 'border-l-amber-500',
    shadow: 'shadow-[0_8px_24px_rgba(245,158,11,0.14)]',
    hover:
      'hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.2),0_16px_36px_rgba(245,158,11,0.18)]',
    selected:
      'border-amber-500 ring-2 ring-amber-300/70 shadow-[0_0_0_2px_rgba(245,158,11,0.28),0_14px_34px_rgba(245,158,11,0.22)]',
    iconWrap: 'bg-amber-100 ring-amber-200',
    iconClass: 'text-amber-700',
    valueClass: 'text-amber-950',
    labelClass: 'text-amber-800',
    subtitleClass: 'text-amber-800/75',
  },
  purple: {
    gradient: 'bg-gradient-to-br from-violet-50 via-slate-50 to-[#EDE9FE]',
    border: 'border-violet-200',
    leftBorder: 'border-l-violet-500',
    shadow: 'shadow-[0_8px_24px_rgba(109,40,217,0.12)]',
    hover:
      'hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-[0_0_0_1px_rgba(109,40,217,0.18),0_16px_36px_rgba(109,40,217,0.16)]',
    selected:
      'border-violet-500 ring-2 ring-violet-300/70 shadow-[0_0_0_2px_rgba(109,40,217,0.24),0_14px_34px_rgba(109,40,217,0.2)]',
    iconWrap: 'bg-violet-100 ring-violet-200',
    iconClass: 'text-violet-700',
    valueClass: 'text-violet-950',
    labelClass: 'text-violet-800',
    subtitleClass: 'text-violet-800/75',
  },
} satisfies Record<string, VehicleCheckKpiStyle>

const cards: VehicleCheckKpiCard[] = [
  {
    id: 'checksToday',
    label: 'Checks Today',
    subtitle: 'Completed today',
    icon: CalendarCheck,
    value: (stats) => stats.checksToday,
    style: styles.blue,
  },
  {
    id: 'passedToday',
    label: 'Passed Today',
    subtitle: 'Passed inspections',
    icon: CheckCircle2,
    value: (stats) => stats.passedToday,
    resultFilter: 'Pass',
    style: styles.green,
  },
  {
    id: 'failedToday',
    label: 'Failed Today',
    subtitle: 'Failed inspections',
    icon: XCircle,
    value: (stats) => stats.failedToday,
    resultFilter: 'Fail',
    style: styles.rose,
  },
  {
    id: 'defectsReported',
    label: 'Defects Reported',
    subtitle: 'Failed or advisory items',
    icon: AlertTriangle,
    value: (stats) => stats.defectsReported,
    resultFilter: 'Defects',
    style: styles.amber,
  },
  {
    id: 'vehiclesNotChecked',
    label: 'Vehicles Not Checked',
    subtitle: 'Outstanding today',
    icon: ShieldQuestion,
    value: (_stats, vehiclesNotChecked) => vehiclesNotChecked,
    style: styles.purple,
  },
]

export function VehicleChecksSummaryCards({
  stats,
  vehiclesNotChecked,
  activeFilter,
  onFilterChange,
}: VehicleChecksSummaryCardsProps) {
  const visibleCards = cards.filter((card) => card.value(stats, vehiclesNotChecked) !== null)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {visibleCards.map((card) => {
        const Icon = card.icon
        const value = card.value(stats, vehiclesNotChecked) ?? 0
        const isSelected = activeFilter === card.id

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onFilterChange(isSelected ? null : card.id)}
            className={`group relative overflow-hidden rounded-[18px] border border-l-4 p-4 text-left transition-all duration-200 active:translate-y-0 ${card.style.gradient} ${card.style.border} ${card.style.leftBorder} ${card.style.shadow} ${card.style.hover} ${isSelected ? card.style.selected : ''}`}
            aria-pressed={isSelected}
          >
            <span
              className={`pointer-events-none absolute -right-8 -top-8 size-20 rounded-full blur-2xl transition-opacity ${card.style.iconWrap} opacity-40 group-hover:opacity-70`}
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold ${card.style.labelClass}`}>{card.label}</p>
                <p className={`mt-1 text-3xl font-bold tabular-nums tracking-[-0.04em] ${card.style.valueClass}`}>
                  {value}
                </p>
                <p className={`mt-1 text-xs ${card.style.subtitleClass}`}>{card.subtitle}</p>
              </div>
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-[13px] ring-1 ${card.style.iconWrap}`}
              >
                <Icon className={`size-4 ${card.style.iconClass}`} aria-hidden="true" />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
