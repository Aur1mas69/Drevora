import { Button } from '@/components/ui/button'
import type { ComplianceProfileTab } from '@/lib/complianceTypes'
import { adminTabActive, adminTabInactive } from '@/lib/adminUiStyles'

const PROFILE_TABS: { id: ComplianceProfileTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'documents', label: 'Documents' },
  { id: 'history', label: 'History' },
]

type ComplianceProfileTabBarProps = {
  activeTab: ComplianceProfileTab
  onTabChange: (tab: ComplianceProfileTab) => void
}

export function ComplianceProfileTabBar({
  activeTab,
  onTabChange,
}: ComplianceProfileTabBarProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[18px] bg-[#EAF4FF] p-1 ring-1 ring-blue-100 dark:bg-slate-800/60 dark:ring-white/10">
      {PROFILE_TABS.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant="ghost"
          onClick={() => onTabChange(tab.id)}
          className={`h-10 rounded-[14px] px-3.5 text-sm font-semibold transition-all duration-[250ms] ease-out ${
            activeTab === tab.id ? adminTabActive : adminTabInactive
          }`}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  )
}
