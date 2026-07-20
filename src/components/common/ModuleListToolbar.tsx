import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminSearchInputLg } from '@/lib/adminUiStyles'
import { Filter, Plus, Search, X, type LucideIcon } from 'lucide-react'
import type { ReactNode, Ref } from 'react'

/** Primary create/add action — matches Workers “Add Worker” styling. */
export const moduleListPrimaryButtonClass =
  'h-11 rounded-2xl border border-[#89CFF0]/70 bg-gradient-to-br from-[#218EE7] to-[#0B68BE] px-4 font-semibold text-white shadow-[0_8px_24px_rgba(33,142,231,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BFE3F5] hover:from-[#1A7FD4] hover:to-[#095FA8] hover:shadow-[0_12px_32px_rgba(33,142,231,0.28)] focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/70 disabled:pointer-events-none disabled:opacity-60 active:translate-y-0 active:scale-[0.98] active:shadow-[0_6px_18px_rgba(33,142,231,0.18)]'

const searchInputClass =
  `${adminSearchInputLg} pl-10 transition-all duration-200 hover:ring-[#BFE3F5] focus-visible:border-[#89CFF0] focus-visible:ring-[#BFE3F5]/70`

/** Soft DREVORA baby-blue Filter button; stronger when open / has active filters. */
function filterButtonClassName(options: {
  open: boolean
  hasActiveFilters: boolean
}): string {
  const { open, hasActiveFilters } = options
  const emphasized = open || hasActiveFilters
  return [
    'h-11 shrink-0 rounded-2xl px-4 font-semibold shadow-sm transition-all duration-200',
    'focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/70',
    'disabled:pointer-events-none disabled:opacity-60',
    'active:translate-y-0 active:scale-[0.98]',
    emphasized
      ? 'border border-[#89CFF0]/80 bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white shadow-[0_8px_20px_rgba(33,142,231,0.2)] hover:-translate-y-0.5 hover:from-[#1A7FD4] hover:to-[#095FA8]'
      : 'border border-[#BFE3F5] bg-[#E8F3FE] text-[#0B68BE] hover:-translate-y-0.5 hover:border-[#89CFF0] hover:bg-[#DCEEFF] hover:shadow-[0_8px_20px_rgba(33,142,231,0.12)]',
  ].join(' ')
}

export type ModuleListToolbarProps = {
  primaryActionLabel?: string
  primaryActionIcon?: LucideIcon
  onPrimaryAction?: () => void
  searchValue?: string
  onSearchChange?: (value: string) => void
  /** When set, shows a clear control while the search field has a value. */
  onSearchClear?: () => void
  searchPlaceholder?: string
  onFilterToggle?: () => void
  filterOpen?: boolean
  activeFilterCount?: number
  filterButtonLabel?: string
  /** Rendered beside the Filter button (absolute/portal panels attach here). */
  filterPanel?: ReactNode
  /** Ref to the Filter button wrapper — for portal panel positioning. */
  filterAnchorRef?: Ref<HTMLDivElement>
  /** Optional actions after Filter (e.g. Export CSV). */
  secondaryActions?: ReactNode
  hideSearch?: boolean
  hidePrimaryAction?: boolean
  hideFilter?: boolean
  disabled?: boolean
  /** Disables only the primary action (e.g. Add Worker at plan limit). */
  primaryActionDisabled?: boolean
  loading?: boolean
  className?: string
}

/**
 * Shared list-page toolbar shell (Workers visual reference).
 * Layout only — page-specific filter panels and handlers stay in callers.
 *
 * Desktop: [ Primary ] ………… [ Search ] [ Filter ]
 * Mobile: wraps; ~44px control heights; no outer white card.
 */
export function ModuleListToolbar({
  primaryActionLabel = 'Add',
  primaryActionIcon: PrimaryIcon = Plus,
  onPrimaryAction,
  searchValue = '',
  onSearchChange,
  onSearchClear,
  searchPlaceholder = 'Search…',
  onFilterToggle,
  filterOpen = false,
  activeFilterCount = 0,
  filterButtonLabel = 'Filter',
  filterPanel,
  filterAnchorRef,
  secondaryActions,
  hideSearch = false,
  hidePrimaryAction = false,
  hideFilter = false,
  disabled = false,
  primaryActionDisabled = false,
  loading = false,
  className = '',
}: ModuleListToolbarProps) {
  const controlsDisabled = disabled || loading
  const hasActiveFilters = activeFilterCount > 0
  const filterLabel =
    hasActiveFilters ? `${filterButtonLabel} (${activeFilterCount})` : filterButtonLabel

  return (
    <div
      className={`flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
    >
      {!hidePrimaryAction ? (
        <Button
          type="button"
          onClick={onPrimaryAction}
          disabled={controlsDisabled || primaryActionDisabled || !onPrimaryAction}
          className={`w-full sm:w-auto ${moduleListPrimaryButtonClass}`}
        >
          <PrimaryIcon className="size-4" aria-hidden />
          {primaryActionLabel}
        </Button>
      ) : null}

      <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        {!hideSearch ? (
          <div className="relative min-w-0 w-full sm:w-[280px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#5499BF]" />
            <Input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder={searchPlaceholder}
              disabled={controlsDisabled}
              className={`${searchInputClass} ${onSearchClear && searchValue ? 'pr-10' : 'pr-4'}`}
              aria-label={searchPlaceholder}
            />
            {onSearchClear && searchValue ? (
              <button
                type="button"
                onClick={onSearchClear}
                disabled={controlsDisabled}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[8px] p-1 text-[#5499BF] transition-colors hover:bg-[#EEF6FF] hover:text-[#0B68BE] disabled:opacity-60"
                aria-label="Clear search"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}

        {!hideFilter ? (
          <div ref={filterAnchorRef} className="relative w-full shrink-0 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onFilterToggle}
              disabled={controlsDisabled || !onFilterToggle}
              className={`w-full sm:w-auto ${filterButtonClassName({
                open: filterOpen,
                hasActiveFilters,
              })}`}
              aria-expanded={filterOpen}
              aria-haspopup="dialog"
            >
              <Filter className="size-4" aria-hidden />
              {filterLabel}
            </Button>
            {filterPanel}
          </div>
        ) : null}

        {secondaryActions ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {secondaryActions}
          </div>
        ) : null}
      </div>
    </div>
  )
}
