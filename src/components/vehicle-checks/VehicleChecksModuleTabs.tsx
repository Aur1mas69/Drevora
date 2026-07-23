import { Button } from '@/components/ui/button'

export type VehicleChecksModuleTab = 'vehicle-checks' | 'tyre-check'

const TABS: { id: VehicleChecksModuleTab; label: string }[] = [
  { id: 'vehicle-checks', label: 'Vehicle Checks' },
  { id: 'tyre-check', label: 'Tyre Check' },
]

const tabActiveClassName =
  'bg-[#2563EB] text-white shadow-sm hover:bg-[#1d4ed8] hover:text-white dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500'

const tabInactiveClassName =
  'bg-transparent text-slate-500 hover:bg-[#EAF4FF] hover:text-[#2563EB] dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-blue-300'

type VehicleChecksModuleTabsProps = {
  activeTab: VehicleChecksModuleTab
  onTabChange: (tab: VehicleChecksModuleTab) => void
}

export function VehicleChecksModuleTabs({
  activeTab,
  onTabChange,
}: VehicleChecksModuleTabsProps) {
  return (
    <div className="inline-flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant="ghost"
          onClick={() => onTabChange(tab.id)}
          className={`h-10 rounded-[14px] px-4 text-sm font-semibold transition-all duration-[250ms] ease-out ${
            activeTab === tab.id ? tabActiveClassName : tabInactiveClassName
          }`}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  )
}
