import { adminKpiDarkAccent } from '@/lib/adminUiStyles'
import type { ContactCategory, ContactCategoryFilter, ContactSummaryCounts } from '@/lib/contactTypes'
import type { LucideIcon } from 'lucide-react'
import { Building2, HardHat, LifeBuoy, ShieldCheck, Wrench } from 'lucide-react'

type SummaryAccent = 'blue' | 'purple' | 'orange' | 'cyan' | 'green'

type SummaryCardDef = {
  key: keyof ContactSummaryCounts
  label: string
  icon: LucideIcon
  accent: SummaryAccent
  filterCategory: ContactCategoryFilter
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
  purple: {
    card: `border-[#E4D9F8] bg-gradient-to-br from-[#FBF8FF] to-[#F0E9FF] ${adminKpiDarkAccent.violet.compactCard}`,
    iconWrap: `border-[#DDD0F5] bg-[#EDE4FF] text-[#7C3AED] ${adminKpiDarkAccent.violet.compactIconWrap}`,
    hover: `hover:border-[#C4B5FD] hover:shadow-[0_8px_18px_rgba(124,58,237,0.12)] ${adminKpiDarkAccent.violet.compactHover}`,
    active: `ring-2 ring-[#7C3AED]/30 border-[#C4B5FD] ${adminKpiDarkAccent.violet.compactActive}`,
  },
  orange: {
    card: `border-[#F5DFC4] bg-gradient-to-br from-[#FFFBF5] to-[#FFF1E0] ${adminKpiDarkAccent.orange.compactCard}`,
    iconWrap: `border-[#F0D2A8] bg-[#FFE8CC] text-[#C2410C] ${adminKpiDarkAccent.orange.compactIconWrap}`,
    hover: `hover:border-[#FDBA74] hover:shadow-[0_8px_18px_rgba(194,65,12,0.12)] ${adminKpiDarkAccent.orange.compactHover}`,
    active: `ring-2 ring-[#EA580C]/30 border-[#FDBA74] ${adminKpiDarkAccent.orange.compactActive}`,
  },
  cyan: {
    card: `border-[#C5EAF2] bg-gradient-to-br from-[#F5FCFE] to-[#E0F5FA] ${adminKpiDarkAccent.cyan.compactCard}`,
    iconWrap: `border-[#B0E0EB] bg-[#D5F0F6] text-[#0891B2] ${adminKpiDarkAccent.cyan.compactIconWrap}`,
    hover: `hover:border-[#67E8F9] hover:shadow-[0_8px_18px_rgba(8,145,178,0.12)] ${adminKpiDarkAccent.cyan.compactHover}`,
    active: `ring-2 ring-[#0891B2]/30 border-[#67E8F9] ${adminKpiDarkAccent.cyan.compactActive}`,
  },
  green: {
    card: `border-[#C9EBD8] bg-gradient-to-br from-[#F6FDF9] to-[#E4F6EC] ${adminKpiDarkAccent.green.compactCard}`,
    iconWrap: `border-[#B5E0CB] bg-[#D8F3E5] text-[#059669] ${adminKpiDarkAccent.green.compactIconWrap}`,
    hover: `hover:border-[#6EE7B7] hover:shadow-[0_8px_18px_rgba(5,150,105,0.12)] ${adminKpiDarkAccent.green.compactHover}`,
    active: `ring-2 ring-[#059669]/30 border-[#6EE7B7] ${adminKpiDarkAccent.green.compactActive}`,
  },
}

const CARDS: SummaryCardDef[] = [
  {
    key: 'workerContacts',
    label: 'Worker Contacts',
    icon: HardHat,
    accent: 'blue',
    filterCategory: 'worker',
  },
  {
    key: 'support',
    label: 'Support / Help',
    icon: LifeBuoy,
    accent: 'purple',
    filterCategory: 'emergency',
  },
  {
    key: 'service',
    label: 'Service / Garage',
    icon: Wrench,
    accent: 'orange',
    filterCategory: 'garage_workshop',
  },
  {
    key: 'office',
    label: 'Office',
    icon: Building2,
    accent: 'cyan',
    filterCategory: 'accountant',
  },
  {
    key: 'insurance',
    label: 'Insurance',
    icon: ShieldCheck,
    accent: 'green',
    filterCategory: 'insurance',
  },
]

const EMPTY_COUNTS: ContactSummaryCounts = {
  workerContacts: 0,
  support: 0,
  service: 0,
  office: 0,
  insurance: 0,
}

type ContactsSummaryCardsProps = {
  counts: ContactSummaryCounts | null
  isLoading?: boolean
  activeCategory?: ContactCategoryFilter
  onSelectCategory?: (category: ContactCategoryFilter) => void
}

export function ContactsSummaryCards({
  counts,
  isLoading = false,
  activeCategory = 'all',
  onSelectCategory,
}: ContactsSummaryCardsProps) {
  const values = counts ?? EMPTY_COUNTS
  const interactive = typeof onSelectCategory === 'function'

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
      {CARDS.map(({ key, label, icon: Icon, accent, filterCategory }, index) => {
        const styles = accentStyles[accent]
        const isActive = activeCategory === filterCategory
        const isLastOddMobile = index === CARDS.length - 1

        const className = [
          'flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 shadow-sm shadow-[rgba(22,58,99,0.05)] transition-all duration-200 sm:gap-3 sm:px-3.5 sm:py-3',
          styles.card,
          styles.hover,
          isActive
            ? `${styles.active} dark:shadow-[0_0_0_1px_rgba(59,130,246,0.2),0_10px_24px_rgba(0,0,0,0.35)]`
            : '',
          interactive
            ? 'cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218EE7]/35 dark:focus-visible:ring-offset-slate-900'
            : '',
          isLastOddMobile ? 'col-span-2 md:col-span-1' : '',
        ]
          .filter(Boolean)
          .join(' ')

        const content = (
          <>
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border sm:h-10 sm:w-10 ${styles.iconWrap}`}
            >
              <Icon className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#5D7C9D] dark:text-slate-400">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-[-0.02em] text-[#163A63] dark:text-slate-100 sm:text-xl">
                {isLoading ? '—' : values[key]}
              </p>
            </div>
          </>
        )

        if (!interactive) {
          return (
            <div key={key} className={className}>
              {content}
            </div>
          )
        }

        return (
          <button
            key={key}
            type="button"
            className={`${className} text-left`}
            aria-pressed={isActive}
            onClick={() => {
              onSelectCategory(
                activeCategory === filterCategory
                  ? 'all'
                  : (filterCategory as ContactCategory),
              )
            }}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
