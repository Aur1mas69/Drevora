import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { COMPLIANCE_CENTRE_TABS, type ComplianceCentreTab } from '@/lib/complianceTypes'
import { Plus, Search } from 'lucide-react'

type ComplianceCentreToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  onAddRecord: () => void
}

export function ComplianceCentreToolbar({
  searchTerm,
  onSearchTermChange,
  onAddRecord,
}: ComplianceCentreToolbarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[20px] bg-white p-4 shadow-[0_18px_45px_rgba(59,130,246,0.08)] ring-1 ring-blue-100/70 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative min-w-0 lg:max-w-md lg:flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Search workers, vehicles, roles or documents…"
          className="h-11 rounded-[16px] border-0 bg-[#F8FBFF] pl-10 pr-4 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 placeholder:text-slate-400 focus-visible:ring-3 focus-visible:ring-blue-200"
        />
      </div>
      <Button
        type="button"
        onClick={onAddRecord}
        className="h-10 rounded-[14px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
      >
        <Plus className="mr-1.5 size-4" />
        Add Compliance Record
      </Button>
    </div>
  )
}

type ComplianceCentreTabBarProps = {
  activeTab: ComplianceCentreTab
  onTabChange: (tab: ComplianceCentreTab) => void
}

export function ComplianceCentreTabBar({ activeTab, onTabChange }: ComplianceCentreTabBarProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[18px] bg-[#EAF4FF] p-1 ring-1 ring-blue-100">
      {COMPLIANCE_CENTRE_TABS.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant="ghost"
          onClick={() => onTabChange(tab.id)}
          className={`h-10 rounded-[14px] px-3.5 text-sm font-semibold transition-all duration-[250ms] ease-out ${
            activeTab === tab.id
              ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-blue-100'
              : 'text-slate-500 hover:bg-white/60 hover:text-slate-900'
          }`}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  )
}
