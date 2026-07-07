import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ContactCategoryFilter, ContactStatusFilter } from '@/lib/contactTypes'
import { CONTACT_CATEGORIES } from '@/lib/contactTypes'
import { Filter, Plus, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  contactPrimaryButtonClass,
  contactSearchInputClass,
  contactSelectClass,
  contactToolbarClass,
} from './contactUiStyles'

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
    <div className={contactToolbarClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5499BF]" />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search contacts..."
              className={contactSearchInputClass}
              aria-label="Search contacts"
            />
          </div>

          <div ref={filtersRef} className="relative shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFiltersOpen((current) => !current)}
              className="h-10 rounded-[14px] border-[#C5DFFB]/80 bg-white px-3 text-sm font-semibold text-[#0B68BE] hover:bg-[#F5FAFF]"
              aria-expanded={isFiltersOpen}
            >
              <Filter className="mr-1.5 size-4" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full bg-[#218EE7] text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            {isFiltersOpen ? (
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
            ) : null}
          </div>
        </div>

        <Button type="button" onClick={onAddContact} className={contactPrimaryButtonClass}>
          <Plus className="mr-1.5 size-4" />
          Add Contact
        </Button>
      </div>
    </div>
  )
}
