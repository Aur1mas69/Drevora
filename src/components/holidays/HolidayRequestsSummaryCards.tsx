import type { HolidayRequestStatusFilter, HolidayRequestSummaryStats } from '@/lib/holidayRequestTypes'
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, ClipboardList, Clock, XCircle } from 'lucide-react'

type HolidayRequestsSummaryCardsProps = {
  stats: HolidayRequestSummaryStats
  statusFilter: HolidayRequestStatusFilter
  onStatusFilterChange: (value: HolidayRequestStatusFilter) => void
}

type HolidayKpiVisualStyle = {
  baseGradient: string
  baseBorder: string
  leftBorder: string
  baseShadow: string
  glowClass: string
  iconWrap: string
  iconClass: string
  valueClass: string
  labelClass: string
  subtitleClass: string
  hoverGradient: string
  hoverBorder: string
  hoverShadow: string
  activeGradient: string
  activeBorder: string
  activeShadow: string
  selectedGradient: string
  selectedBorder: string
  selectedShadow: string
  selectedRing: string
}

type HolidayKpiCardConfig = {
  key: keyof Pick<
    HolidayRequestSummaryStats,
    'pendingRequests' | 'approvedRequests' | 'declinedRequests' | 'totalRequests'
  >
  label: string
  helper: string
  icon: LucideIcon
  filterValue: HolidayRequestStatusFilter
  style: HolidayKpiVisualStyle
}

const holidayKpiVisualStyles = {
  pending: {
    baseGradient: 'bg-gradient-to-br from-amber-50 via-orange-50/95 to-[#FFEDD5]',
    baseBorder: 'border-amber-200',
    leftBorder: 'border-l-amber-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(245,158,11,0.14)]',
    glowClass: 'bg-amber-300',
    iconWrap: 'bg-amber-100 ring-1 ring-amber-200',
    iconClass: 'text-amber-700',
    valueClass: 'text-amber-950',
    labelClass: 'text-amber-800',
    subtitleClass: 'text-amber-800/75',
    hoverGradient:
      'hover:from-amber-100/90 hover:via-orange-100/85 hover:to-amber-200/70',
    hoverBorder: 'hover:border-amber-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(245,158,11,0.2),0_16px_36px_rgba(245,158,11,0.18)]',
    activeGradient:
      'active:from-amber-100 active:via-orange-100 active:to-amber-200/80',
    activeBorder: 'active:border-amber-500',
    activeShadow:
      'active:shadow-[0_0_0_1px_rgba(245,158,11,0.28),0_8px_22px_rgba(245,158,11,0.14)]',
    selectedGradient: 'from-amber-100 via-orange-100 to-amber-200/85',
    selectedBorder: 'border-amber-500',
    selectedShadow:
      'shadow-[0_0_0_2px_rgba(245,158,11,0.28),0_14px_34px_rgba(245,158,11,0.22)]',
    selectedRing: 'ring-2 ring-amber-300/70',
  },
  approved: {
    baseGradient: 'bg-gradient-to-br from-emerald-50 via-teal-50/95 to-[#D1FAE5]',
    baseBorder: 'border-emerald-200',
    leftBorder: 'border-l-emerald-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(16,185,129,0.14)]',
    glowClass: 'bg-emerald-300',
    iconWrap: 'bg-emerald-100 ring-1 ring-emerald-200',
    iconClass: 'text-emerald-700',
    valueClass: 'text-emerald-950',
    labelClass: 'text-emerald-800',
    subtitleClass: 'text-emerald-800/75',
    hoverGradient:
      'hover:from-emerald-100/90 hover:via-teal-100/85 hover:to-emerald-200/70',
    hoverBorder: 'hover:border-emerald-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_16px_36px_rgba(16,185,129,0.18)]',
    activeGradient:
      'active:from-emerald-100 active:via-teal-100 active:to-emerald-200/80',
    activeBorder: 'active:border-emerald-500',
    activeShadow:
      'active:shadow-[0_0_0_1px_rgba(16,185,129,0.28),0_8px_22px_rgba(16,185,129,0.14)]',
    selectedGradient: 'from-emerald-100 via-teal-100 to-emerald-200/85',
    selectedBorder: 'border-emerald-500',
    selectedShadow:
      'shadow-[0_0_0_2px_rgba(16,185,129,0.28),0_14px_34px_rgba(16,185,129,0.22)]',
    selectedRing: 'ring-2 ring-emerald-300/70',
  },
  declined: {
    baseGradient: 'bg-gradient-to-br from-rose-50 via-orange-50/85 to-[#FFE4E6]',
    baseBorder: 'border-rose-300',
    leftBorder: 'border-l-rose-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(225,29,72,0.14)]',
    glowClass: 'bg-rose-300',
    iconWrap: 'bg-rose-100 ring-1 ring-rose-200',
    iconClass: 'text-rose-700',
    valueClass: 'text-rose-950',
    labelClass: 'text-rose-800',
    subtitleClass: 'text-rose-800/75',
    hoverGradient:
      'hover:from-rose-100/90 hover:via-rose-100/80 hover:to-rose-200/70',
    hoverBorder: 'hover:border-rose-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(225,29,72,0.2),0_16px_36px_rgba(225,29,72,0.18)]',
    activeGradient:
      'active:from-rose-100 active:via-rose-100 active:to-rose-200/80',
    activeBorder: 'active:border-rose-500',
    activeShadow:
      'active:shadow-[0_0_0_1px_rgba(225,29,72,0.28),0_8px_22px_rgba(225,29,72,0.14)]',
    selectedGradient: 'from-rose-100 via-rose-100 to-rose-200/85',
    selectedBorder: 'border-rose-500',
    selectedShadow:
      'shadow-[0_0_0_2px_rgba(225,29,72,0.28),0_14px_34px_rgba(225,29,72,0.22)]',
    selectedRing: 'ring-2 ring-rose-300/70',
  },
  total: {
    baseGradient: 'bg-gradient-to-br from-[#E8F3FE] via-[#DFEEFF] to-[#D3E9FC]',
    baseBorder: 'border-[#89CFF0]',
    leftBorder: 'border-l-[#218EE7]',
    baseShadow: 'shadow-[0_8px_24px_rgba(33,142,231,0.16)]',
    glowClass: 'bg-[#89CFF0]',
    iconWrap: 'bg-[#BFE3F5] ring-1 ring-[#89CFF0]',
    iconClass: 'text-[#0B68BE]',
    valueClass: 'text-[#0B477F]',
    labelClass: 'text-[#0B68BE]',
    subtitleClass: 'text-[#3D7A9C]',
    hoverGradient:
      'hover:from-[#D3E9FC] hover:via-[#C8E4FC] hover:to-[#BFE3F5]',
    hoverBorder: 'hover:border-[#218EE7]',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(33,142,231,0.22),0_16px_36px_rgba(33,142,231,0.22)]',
    activeGradient:
      'active:from-[#C8E4FC] active:via-[#BFE3F5] active:to-[#A8D4F7]',
    activeBorder: 'active:border-[#0B68BE]',
    activeShadow:
      'active:shadow-[0_0_0_1px_rgba(33,142,231,0.32),0_8px_22px_rgba(33,142,231,0.18)]',
    selectedGradient: 'from-[#D3E9FC] via-[#C8E4FC] to-[#BFE3F5]',
    selectedBorder: 'border-[#218EE7]',
    selectedShadow:
      'shadow-[0_0_0_2px_rgba(33,142,231,0.3),0_14px_34px_rgba(33,142,231,0.24)]',
    selectedRing: 'ring-2 ring-[#89CFF0]/80',
  },
} satisfies Record<string, HolidayKpiVisualStyle>

const cards: HolidayKpiCardConfig[] = [
  {
    key: 'pendingRequests',
    label: 'Pending',
    helper: 'Awaiting review',
    icon: Clock,
    filterValue: 'Pending',
    style: holidayKpiVisualStyles.pending,
  },
  {
    key: 'approvedRequests',
    label: 'Approved',
    helper: 'Signed off',
    icon: CheckCircle2,
    filterValue: 'Approved',
    style: holidayKpiVisualStyles.approved,
  },
  {
    key: 'declinedRequests',
    label: 'Declined',
    helper: 'Not approved',
    icon: XCircle,
    filterValue: 'Rejected',
    style: holidayKpiVisualStyles.declined,
  },
  {
    key: 'totalRequests',
    label: 'Total Requests',
    helper: 'All holiday requests',
    icon: ClipboardList,
    filterValue: 'all',
    style: holidayKpiVisualStyles.total,
  },
]

function HolidayKpiCard({
  card,
  value,
  isSelected,
  onSelect,
}: {
  card: HolidayKpiCardConfig
  value: number
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = card.icon
  const { style } = card

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${card.label}: ${value}`}
      aria-pressed={isSelected}
      className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-l-4 p-4 text-left transition-all duration-[180ms] ease-out hover:-translate-y-[3px] active:-translate-y-px active:scale-[0.99] ${style.baseGradient} ${style.baseBorder} ${style.leftBorder} ${style.baseShadow} ${style.hoverGradient} ${style.hoverBorder} ${style.hoverShadow} ${style.activeGradient} ${style.activeBorder} ${style.activeShadow} ${
        isSelected
          ? `bg-gradient-to-br ${style.selectedGradient} ${style.selectedBorder} ${style.selectedShadow} ${style.selectedRing} -translate-y-[2px]`
          : ''
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 size-24 rounded-full blur-2xl transition-opacity duration-200 ${style.glowClass} ${
          isSelected ? 'opacity-55' : 'opacity-35 group-hover:opacity-50'
        }`}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3.5">
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-200 group-hover:brightness-[1.03] ${style.iconWrap} ${
            isSelected ? 'brightness-[1.05] ring-2 ring-white/70' : ''
          }`}
        >
          <Icon className={`size-5 ${style.iconClass}`} strokeWidth={2.1} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-3xl font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-4xl ${style.valueClass}`}
          >
            {value}
          </p>
          <p className={`mt-2.5 text-sm font-semibold ${style.labelClass}`}>{card.label}</p>
          <p className={`mt-1 text-xs leading-snug ${style.subtitleClass}`}>{card.helper}</p>
        </div>
      </div>
    </button>
  )
}

export function HolidayRequestsSummaryCards({
  stats,
  statusFilter,
  onStatusFilterChange,
}: HolidayRequestsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <HolidayKpiCard
          key={card.key}
          card={card}
          value={stats[card.key]}
          isSelected={statusFilter === card.filterValue}
          onSelect={() => onStatusFilterChange(card.filterValue)}
        />
      ))}
    </div>
  )
}
