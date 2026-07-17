import { Button } from '@/components/ui/button'
import { adminTabActive, adminTabInactive } from '@/lib/adminUiStyles'

export type VehicleChecksModuleTab = 'vehicle-checks' | 'tyre-check'

const TABS: { id: VehicleChecksModuleTab; label: string }[] = [
  { id: 'vehicle-checks', label: 'Vehicle Checks' },
  { id: 'tyre-check', label: 'Tyre Check' },
]

type VehicleChecksModuleTabsProps = {
  activeTab: VehicleChecksModuleTab
  onTabChange: (tab: VehicleChecksModuleTab) => void
}

export function VehicleChecksModuleTabs({
  activeTab,
  onTabChange,
}: VehicleChecksModuleTabsProps) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-[18px] bg-[#EAF4FF] p-1 ring-1 ring-blue-100 dark:bg-slate-800/60 dark:ring-white/10">
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant="ghost"
          onClick={() => onTabChange(tab.id)}
          className={`h-10 rounded-[14px] px-4 text-sm font-semibold transition-all duration-[250ms] ease-out ${
            activeTab === tab.id ? adminTabActive : adminTabInactive
          }`}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  )
}
