import { ModuleListToolbar } from '@/components/common/ModuleListToolbar'
import { Button } from '@/components/ui/button'
import type { ContactCategoryFilter, ContactStatusFilter } from '@/lib/contactTypes'
import { CONTACT_CATEGORIES } from '@/lib/contactTypes'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { contactSelectClass } from './contactUiStyles'

type ContactsToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  categoryFilter: ContactCategoryFilter
  onCategoryFilterChange: (value: ContactCategoryFilter) => void
  statusFilter: ContactStatusFilter
  onStatusFilterChange: (value: ContactStatusFilter) => void
  onClearFilters: () => void
  onAddContact: () => void
}

const filterPanelClass =
  'absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(100vw-2rem,20rem)] rounded-[16px] border border-[#C5DFFB] bg-gradient-to-br from-white to-[#F5FAFF] p-4 shadow-[0_16px_40px_rgba(33,142,231,0.12)] ring-1 ring-[#D3E9FC]/60'

export function ContactsToolbar({
  searchTerm,
  onSearchTermChange,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  onClearFilters,
  onAddContact,
}: ContactsToolbarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  const activeFilterCount =
    (categoryFilter !== 'all' ? 1 : 0) + (statusFilter !== 'active' ? 1 : 0)

  useEffect(() => {
    if (!isFiltersOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setIsFiltersOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [isFiltersOpen])

  return (
    <ModuleListToolbar
      primaryActionLabel="Add Contact"
      onPrimaryAction={onAddContact}
      searchValue={searchTerm}
      onSearchChange={onSearchTermChange}
      searchPlaceholder="Search contacts..."
      onFilterToggle={() => setIsFiltersOpen((current) => !current)}
      filterOpen={isFiltersOpen}
      activeFilterCount={activeFilterCount}
      filterAnchorRef={filtersRef}
      filterPanel={
        isFiltersOpen ? (
          <div className={filterPanelClass}>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#5499BF]">Type / Category</span>
              <select
                value={categoryFilter}
                onChange={(event) =>
                  onCategoryFilterChange(event.target.value as ContactCategoryFilter)
                }
                className={`${contactSelectClass} w-full`}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {CONTACT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block space-y-1.5">
              <span className="text-xs font-semibold text-[#5499BF]">Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  onStatusFilterChange(event.target.value as ContactStatusFilter)
                }
                className={`${contactSelectClass} w-full`}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            {activeFilterCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onClearFilters()
                  setIsFiltersOpen(false)
                }}
                className="mt-4 h-9 w-full rounded-[12px] text-sm font-semibold text-[#0B68BE] hover:bg-[#EEF6FF]"
              >
                <X className="mr-1.5 size-4" />
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null
      }
    />
  )
}
