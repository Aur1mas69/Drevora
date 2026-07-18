import { adminKpiDarkAccent } from '@/lib/adminUiStyles'
import type { DocumentsCentreTab } from '@/lib/documentTypes'
import type { DocumentSummaryStats } from '@/lib/documentUtils'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Building2, CalendarClock, Truck, Users } from 'lucide-react'

type DocumentSummaryKey = keyof DocumentSummaryStats

type SummaryAccent = 'blue' | 'cyan' | 'purple' | 'amber' | 'red'

type SummaryCardDef = {
  key: DocumentSummaryKey
  tab: Exclude<DocumentsCentreTab, 'all'>
  label: string
  icon: LucideIcon
  accent: SummaryAccent
}

const accentStyles: Record<
  SummaryAccent,
  { card: string; iconWrap: string; hover: string; active: string }
> = {
  blue: {
    card: `border-[#CFE3F5] bg-gradient-to-br from-[#F8FBFF] to-[#E8F3FE] ${adminKpiDarkAccent.blue.compactCard}`,
    iconWrap: `border-[#BFE3F5] bg-[#DCEEFF] text-[#218EE7] ${adminKpiDarkAccent.blue.compactIconWrap}`,
    hover: `hover:border-[#89CFF0] hover:shadow-[0_8px_18px_rgba(33,142,231,0.12)] ${adminKpiDarkAccent.blue.compactHover}`,
    active: `ring-2 ring-[#218EE7]/35 border-[#89CFF0] ${adminKpiDarkAccent.blue.compactActive}`,
  },
  cyan: {
    card: `border-[#C5EAF2] bg-gradient-to-br from-[#F5FCFE] to-[#E0F5FA] ${adminKpiDarkAccent.cyan.compactCard}`,
    iconWrap: `border-[#B0E0EB] bg-[#D5F0F6] text-[#0891B2] ${adminKpiDarkAccent.cyan.compactIconWrap}`,
    hover: `hover:border-[#67E8F9] hover:shadow-[0_8px_18px_rgba(8,145,178,0.12)] ${adminKpiDarkAccent.cyan.compactHover}`,
    active: `ring-2 ring-[#0891B2]/30 border-[#67E8F9] ${adminKpiDarkAccent.cyan.compactActive}`,
  },
  purple: {
    card: `border-[#E4D9F8] bg-gradient-to-br from-[#FBF8FF] to-[#F0E9FF] ${adminKpiDarkAccent.violet.compactCard}`,
    iconWrap: `border-[#DDD0F5] bg-[#EDE4FF] text-[#7C3AED] ${adminKpiDarkAccent.violet.compactIconWrap}`,
    hover: `hover:border-[#C4B5FD] hover:shadow-[0_8px_18px_rgba(124,58,237,0.12)] ${adminKpiDarkAccent.violet.compactHover}`,
    active: `ring-2 ring-[#7C3AED]/30 border-[#C4B5FD] ${adminKpiDarkAccent.violet.compactActive}`,
  },
  amber: {
    card: `border-[#F5DFC4] bg-gradient-to-br from-[#FFFBF5] to-[#FFF1E0] ${adminKpiDarkAccent.amber.compactCard}`,
    iconWrap: `border-[#F0D2A8] bg-[#FFE8CC] text-[#D97706] ${adminKpiDarkAccent.amber.compactIconWrap}`,
    hover: `hover:border-[#FDBA74] hover:shadow-[0_8px_18px_rgba(217,119,6,0.12)] ${adminKpiDarkAccent.amber.compactHover}`,
    active: `ring-2 ring-[#D97706]/30 border-[#FDBA74] ${adminKpiDarkAccent.amber.compactActive}`,
  },
  red: {
    card: `border-[#F5C9C9] bg-gradient-to-br from-[#FFF8F8] to-[#FFE4E6] ${adminKpiDarkAccent.rose.compactCard}`,
    iconWrap: `border-[#F0B4B4] bg-[#FFE0E0] text-[#E11D48] ${adminKpiDarkAccent.rose.compactIconWrap}`,
    hover: `hover:border-[#FDA4AF] hover:shadow-[0_8px_18px_rgba(225,29,72,0.12)] ${adminKpiDarkAccent.rose.compactHover}`,
    active: `ring-2 ring-[#E11D48]/30 border-[#FDA4AF] ${adminKpiDarkAccent.rose.compactActive}`,
  },
}

const CARDS: SummaryCardDef[] = [
  {
    key: 'company',
    tab: 'company',
    label: 'Company Documents',
    icon: Building2,
    accent: 'blue',
  },
  {
    key: 'workers',
    tab: 'workers',
    label: 'Worker Documents',
    icon: Users,
    accent: 'cyan',
  },
  {
    key: 'vehicles',
    tab: 'vehicles',
    label: 'Vehicle Documents',
    icon: Truck,
    accent: 'purple',
  },
  {
    key: 'expiringSoon',
    tab: 'expiring-soon',
    label: 'Expiring Soon',
    icon: CalendarClock,
    accent: 'amber',
  },
  {
    key: 'expired',
    tab: 'expired',
    label: 'Expired',
    icon: AlertTriangle,
    accent: 'red',
  },
]

type DocumentsSummaryCardsProps = {
  stats: DocumentSummaryStats
  isLoading?: boolean
  activeTab: DocumentsCentreTab
  onSelect: (tab: DocumentsCentreTab) => void
}

export function DocumentsSummaryCards({
  stats,
  isLoading = false,
  activeTab,
  onSelect,
}: DocumentsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
      {CARDS.map(({ key, tab, label, icon: Icon, accent }, index) => {
        const styles = accentStyles[accent]
        const isActive = activeTab === tab
        const isLastOddMobile = index === CARDS.length - 1

        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            aria-label={`${label}: ${stats[key]}. ${isActive ? 'Clear filter' : 'Apply filter'}`}
            onClick={() => onSelect(isActive ? 'all' : tab)}
            className={[
              'flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left shadow-sm shadow-[rgba(22,58,99,0.05)] transition-all duration-200 sm:gap-3 sm:px-3.5 sm:py-3',
              styles.card,
              styles.hover,
              'cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218EE7]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
              isActive
                ? `${styles.active} z-[1] -translate-y-px shadow-[0_0_0_1px_rgba(17,60,105,0.1),0_10px_24px_rgba(17,60,105,0.12)] dark:shadow-[0_0_0_1px_rgba(59,130,246,0.2),0_10px_24px_rgba(0,0,0,0.35)]`
                : '',
              isLastOddMobile ? 'col-span-2 md:col-span-1' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border sm:h-10 sm:w-10 ${styles.iconWrap}`}
            >
              <Icon className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#5D7C9D] dark:text-slate-400">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-[-0.02em] text-[#163A63] dark:text-slate-100 sm:text-xl">
                {isLoading ? '—' : stats[key]}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
