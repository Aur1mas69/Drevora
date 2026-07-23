import { Button } from '@/components/ui/button'
import { adminTabActive, adminTabInactive } from '@/lib/adminUiStyles'
import type { TyreCheckAdminSection } from '@/lib/tyreCheckTypes'

const TABS: { id: TyreCheckAdminSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'history', label: 'History & Defects' },
]

type TyreCheckAdminSectionTabsProps = {
  activeSection: TyreCheckAdminSection
  onSectionChange: (section: TyreCheckAdminSection) => void
}

export function TyreCheckAdminSectionTabs({
  activeSection,
  onSectionChange,
}: TyreCheckAdminSectionTabsProps) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-[18px] bg-[#EAF4FF] p-1 ring-1 ring-blue-100 dark:bg-slate-800/60 dark:ring-white/10">
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant="ghost"
          onClick={() => onSectionChange(tab.id)}
          className={`h-10 rounded-[14px] px-4 text-sm font-semibold transition-all duration-[250ms] ease-out ${
            activeSection === tab.id ? adminTabActive : adminTabInactive
          }`}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  )
}
