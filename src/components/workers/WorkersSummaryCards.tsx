import type { WorkerRoleQuickFilter, WorkerRoleSummaryStats } from '@/lib/workerRoleSummary'
import type { LucideIcon } from 'lucide-react'
import { Building2, Truck, UserCog, UsersRound, Wrench } from 'lucide-react'

type WorkerKpiVisualStyle = {
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
  selectedGradient: string
  selectedBorder: string
  selectedShadow: string
  selectedRing: string
}

const workerKpiVisualStyles = {
  total: {
    baseGradient: 'bg-gradient-to-br from-[#F5FAFF] via-[#E8F3FE]/95 to-[#D3E9FC]',
    baseBorder: 'border-[#BFE3F5]',
    leftBorder: 'border-l-[#218EE7]',
    baseShadow: 'shadow-[0_8px_24px_rgba(33,142,231,0.14)]',
    glowClass: 'bg-[#89CFF0]',
    iconWrap: 'bg-[#E8F3FE] ring-1 ring-[#C5DFFB]',
    iconClass: 'text-[#0B68BE]',
    valueClass: 'text-[#113C69]',
    labelClass: 'text-[#0B68BE]',
    subtitleClass: 'text-[#3D7A9C]',
    hoverGradient: 'hover:from-[#E8F3FE] hover:via-[#D3E9FC]/90 hover:to-[#BFE3F5]/80',
    hoverBorder: 'hover:border-[#89CFF0]',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(33,142,231,0.2),0_16px_36px_rgba(33,142,231,0.18)]',
    selectedGradient: 'from-[#E8F3FE] via-[#D3E9FC] to-[#BFE3F5]',
    selectedBorder: 'border-[#218EE7]',
    selectedShadow:
      'shadow-[0_0_0_2px_rgba(33,142,231,0.3),0_14px_34px_rgba(33,142,231,0.24)]',
    selectedRing: 'ring-2 ring-[#89CFF0]/80',
  },
  drivers: {
    baseGradient: 'bg-gradient-to-br from-cyan-50 via-sky-50/95 to-[#CFFAFE]',
    baseBorder: 'border-cyan-200',
    leftBorder: 'border-l-cyan-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(6,182,212,0.14)]',
    glowClass: 'bg-cyan-300',
    iconWrap: 'bg-cyan-100 ring-1 ring-cyan-200',
    iconClass: 'text-cyan-700',
    valueClass: 'text-cyan-950',
    labelClass: 'text-cyan-800',
    subtitleClass: 'text-cyan-800/75',
    hoverGradient: 'hover:from-cyan-100/90 hover:via-sky-100/85 hover:to-cyan-200/70',
    hoverBorder: 'hover:border-cyan-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(6,182,212,0.2),0_16px_36px_rgba(6,182,212,0.18)]',
    selectedGradient: 'from-cyan-100 via-sky-100 to-cyan-200/85',
    selectedBorder: 'border-cyan-500',
    selectedShadow:
      'shadow-[0_0_0_2px_rgba(6,182,212,0.28),0_14px_34px_rgba(6,182,212,0.22)]',
    selectedRing: 'ring-2 ring-cyan-300/70',
  },
  office: {
    baseGradient: 'bg-gradient-to-br from-violet-50 via-purple-50/95 to-[#EDE9FE]',
    baseBorder: 'border-violet-200',
    leftBorder: 'border-l-violet-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(139,92,246,0.14)]',
    glowClass: 'bg-violet-300',
    iconWrap: 'bg-violet-100 ring-1 ring-violet-200',
    iconClass: 'text-violet-700',
    valueClass: 'text-violet-950',
    labelClass: 'text-violet-800',
    subtitleClass: 'text-violet-800/75',
    hoverGradient:
      'hover:from-violet-100/90 hover:via-purple-100/85 hover:to-violet-200/70',
    hoverBorder: 'hover:border-violet-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_16px_36px_rgba(139,92,246,0.18)]',
    selectedGradient: 'from-violet-100 via-purple-100 to-violet-200/85',
    selectedBorder: 'border-violet-500',
    selectedShadow:
      'shadow-[0_0_0_2px_rgba(139,92,246,0.28),0_14px_34px_rgba(139,92,246,0.22)]',
    selectedRing: 'ring-2 ring-violet-300/70',
  },
  garage: {
    baseGradient: 'bg-gradient-to-br from-orange-50 via-amber-50/95 to-[#FFEDD5]',
    baseBorder: 'border-orange-200',
    leftBorder: 'border-l-orange-500',
    baseShadow: 'shadow-[0_8px_24px_rgba(249,115,22,0.14)]',
    glowClass: 'bg-orange-300',
    iconWrap: 'bg-orange-100 ring-1 ring-orange-200',
    iconClass: 'text-orange-700',
    valueClass: 'text-orange-950',
    labelClass: 'text-orange-800',
    subtitleClass: 'text-orange-800/75',
    hoverGradient:
      'hover:from-orange-100/90 hover:via-amber-100/85 hover:to-orange-200/70',
    hoverBorder: 'hover:border-orange-400',
    hoverShadow:
      'hover:shadow-[0_0_0_1px_rgba(249,115,22,0.2),0_16px_36px_rgba(249,115,22,0.18)]',
    selectedGradient: 'from-orange-100 via-amber-100 to-orange-200/85',
    selectedBorder: 'border-orange-500',
    selectedShadow:
      'shadow-[0_0_0_2px_rgba(249,115,22,0.28),0_14px_34px_rgba(249,115,22,0.22)]',
    selectedRing: 'ring-2 ring-orange-300/70',
  },
  managers: {
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
    selectedGradient: 'from-emerald-100 via-teal-100 to-emerald-200/85',
    selectedBorder: 'border-emerald-500',
    selectedShadow:
      'shadow-[0_0_0_2px_rgba(16,185,129,0.28),0_14px_34px_rgba(16,185,129,0.22)]',
    selectedRing: 'ring-2 ring-emerald-300/70',
  },
} satisfies Record<WorkerRoleQuickFilter, WorkerKpiVisualStyle>

type CardConfig = {
  key: WorkerRoleQuickFilter
  label: string
  helper: string
  icon: LucideIcon
  style: WorkerKpiVisualStyle
}

const cards: CardConfig[] = [
  {
    key: 'total',
    label: 'Total Workers',
    helper: 'All workers',
    icon: UsersRound,
    style: workerKpiVisualStyles.total,
  },
  {
    key: 'drivers',
    label: 'Drivers',
    helper: 'Driver role',
    icon: Truck,
    style: workerKpiVisualStyles.drivers,
  },
  {
    key: 'office',
    label: 'Office',
    helper: 'Office & admin',
    icon: Building2,
    style: workerKpiVisualStyles.office,
  },
  {
    key: 'garage',
    label: 'Garage / Workshop',
    helper: 'Mechanic roles',
    icon: Wrench,
    style: workerKpiVisualStyles.garage,
  },
  {
    key: 'managers',
    label: 'Managers',
    helper: 'Managers & supervisors',
    icon: UserCog,
    style: workerKpiVisualStyles.managers,
  },
]

type WorkersSummaryCardsProps = {
  stats: WorkerRoleSummaryStats
  isLoading?: boolean
  activeKey?: WorkerRoleQuickFilter | null
  onSelect?: (key: WorkerRoleQuickFilter) => void
}

function WorkerKpiCard({
  card,
  value,
  isLoading,
  isActive,
  onSelect,
}: {
  card: CardConfig
  value: number
  isLoading: boolean
  isActive: boolean
  onSelect?: (key: WorkerRoleQuickFilter) => void
}) {
  const Icon = card.icon
  const { style } = card
  const interactive = typeof onSelect === 'function'

  const className = [
    'group relative overflow-hidden rounded-2xl border border-l-4 p-3.5 text-left transition-all duration-[180ms] ease-out sm:p-4',
    style.baseGradient,
    style.baseBorder,
    style.leftBorder,
    style.baseShadow,
    interactive
      ? `cursor-pointer hover:-translate-y-[3px] active:-translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218EE7]/45 focus-visible:ring-offset-2 ${style.hoverGradient} ${style.hoverBorder} ${style.hoverShadow}`
      : '',
    isActive
      ? `bg-gradient-to-br ${style.selectedGradient} ${style.selectedBorder} ${style.selectedShadow} ${style.selectedRing} -translate-y-[2px]`
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <div
        className={`pointer-events-none absolute -right-5 -top-5 size-20 rounded-full blur-2xl transition-opacity duration-200 ${style.glowClass} ${
          isActive ? 'opacity-70' : 'opacity-35 group-hover:opacity-50'
        }`}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 group-hover:brightness-[1.03] sm:size-11 sm:rounded-2xl ${style.iconWrap} ${
            isActive ? 'ring-2 ring-white/70' : ''
          }`}
        >
          <Icon className={`size-4 sm:size-[1.125rem] ${style.iconClass}`} strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="h-8 w-12 animate-pulse rounded-md bg-white/60" />
          ) : (
            <p
              className={`text-2xl font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-3xl ${style.valueClass}`}
            >
              {value}
            </p>
          )}
          <p className={`mt-2 text-xs font-semibold leading-snug sm:text-sm ${style.labelClass}`}>
            <span className="line-clamp-2">{card.label}</span>
          </p>
          <p className={`mt-0.5 hidden text-[11px] leading-snug sm:block ${style.subtitleClass}`}>
            {card.helper}
          </p>
        </div>
      </div>
    </>
  )

  if (!interactive) {
    return <article className={className}>{content}</article>
  }

  return (
    <button
      type="button"
      className={className}
      aria-pressed={isActive}
      aria-label={`${card.label}: ${value}. ${isActive ? 'Clear filter' : 'Apply filter'}`}
      onClick={() => onSelect(card.key)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(card.key)
        }
      }}
    >
      {content}
    </button>
  )
}

export function WorkersSummaryCards({
  stats,
  isLoading = false,
  activeKey = null,
  onSelect,
}: WorkersSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <WorkerKpiCard
          key={card.key}
          card={card}
          value={stats[card.key]}
          isLoading={isLoading}
          isActive={activeKey === card.key}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
