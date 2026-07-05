import { Button } from '@/components/ui/button'
import { Package, Plus } from 'lucide-react'

type ConsumablesEmptyStateProps = {
  hasActiveFilters: boolean
  onCreateFirst: () => void
}

export function ConsumablesEmptyState({
  hasActiveFilters,
  onCreateFirst,
}: ConsumablesEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D3E9FC] bg-white/80 px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#E8F3FE] text-[#218EE7] ring-1 ring-[#D3E9FC]">
        <Package className="size-7" strokeWidth={1.8} />
      </div>
      <p className="mt-4 text-base font-semibold text-[#113C69]">
        {hasActiveFilters ? 'No consumables match your filters' : 'No consumables records yet'}
      </p>
      <p className="mt-2 text-sm text-[#3D7A9C]">
        {hasActiveFilters
          ? 'Try adjusting search or filters to find records.'
          : 'Record fuel, AdBlue, oils, fluids and other vehicle consumables.'}
      </p>
      {!hasActiveFilters ? (
        <Button
          type="button"
          onClick={onCreateFirst}
          className="mt-6 h-10 rounded-xl bg-[#218EE7] px-4 text-sm font-semibold text-white hover:bg-[#0B68BE]"
        >
          <Plus className="mr-1.5 size-4" />
          Add Consumable
        </Button>
      ) : null}
    </div>
  )
}
