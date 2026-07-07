import {
  VEHICLE_PROFILE_TABS,
  vehicleProfilePanelClass,
  type VehicleProfileTabId,
} from '@/components/vehicles/profile/vehicleProfileUi'

type VehicleProfileTabBarProps = {
  activeTab: VehicleProfileTabId
  onTabChange: (tab: VehicleProfileTabId) => void
}

export function VehicleProfileTabBar({ activeTab, onTabChange }: VehicleProfileTabBarProps) {
  return (
    <div className={`${vehicleProfilePanelClass} p-2`}>
      <div className="flex gap-1.5 overflow-x-auto">
        {VEHICLE_PROFILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 rounded-[12px] px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-[#218EE7] text-white shadow-[0_4px_12px_rgba(33,142,231,0.22)]'
                : 'text-[#5499BF] hover:bg-[#EEF6FF] hover:text-[#0B68BE]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
