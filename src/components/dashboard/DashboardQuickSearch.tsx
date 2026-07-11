import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import {
  emptyQuickSearchResults,
  QUICK_SEARCH_MIN_LENGTH,
  type QuickSearchGroupedResults,
  type QuickSearchModule,
  type QuickSearchResultItem,
} from '@/lib/dashboardQuickSearchTypes'
import { searchDashboardQuick } from '@/services/dashboardQuickSearchService'

const QUICK_SEARCH_DEBOUNCE_MS = 300

const quickSearchInputClass =
  'h-12 w-full rounded-[10px] border border-[#C5D4E3]/90 bg-[#FCFDFF] pl-10 pr-10 text-sm font-medium text-[#113C69] shadow-[0_2px_10px_rgba(33,142,231,0.08)] placeholder:text-[#5499BF]/75 transition-all duration-200 hover:border-[#B8C9DC] focus-visible:border-[#89CFF0] focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/70 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:shadow-none'

const moduleBadgeClassMap: Record<QuickSearchModule, string> = {
  Workers: 'bg-[#E8F3FE] text-[#0B68BE] ring-[#C5DFFB]/70',
  Vehicles: 'bg-[#E6F9FC] text-[#0E8FA8] ring-[#B8EBF5]/70',
  Timesheets: 'bg-[#EDE9FE] text-[#6D28D9] ring-[#DDD6FE]/70',
  'Holiday Requests': 'bg-[#FCE7F3] text-[#BE185D] ring-[#FBCFE8]/70',
  'Vehicle Checks': 'bg-[#DCFCE7] text-[#15803D] ring-[#BBF7D0]/70',
  'Driver Reports': 'bg-[#FFEDD5] text-[#C45F08] ring-[#FFDDB8]/70',
  Documents: 'bg-[#EEF2F6] text-[#475569] ring-[#D5DEE8]/70',
  Contacts: 'bg-[#E0F2FE] text-[#0369A1] ring-[#BAE6FD]/70',
  Consumables: 'bg-[#FEF3D6] text-[#9A7209] ring-[#F5E6B8]/70',
}

const moduleOrder: QuickSearchModule[] = [
  'Workers',
  'Vehicles',
  'Timesheets',
  'Holiday Requests',
  'Vehicle Checks',
  'Driver Reports',
  'Documents',
  'Contacts',
  'Consumables',
]

function countResults(results: QuickSearchGroupedResults): number {
  return (
    results.workers.length +
    results.vehicles.length +
    results.timesheets.length +
    results.holidayRequests.length +
    results.vehicleChecks.length +
    results.driverReports.length +
    results.documents.length +
    results.contacts.length +
    results.consumables.length
  )
}

function getModuleResults(
  results: QuickSearchGroupedResults,
  module: QuickSearchModule,
): QuickSearchResultItem[] {
  switch (module) {
    case 'Workers':
      return results.workers
    case 'Vehicles':
      return results.vehicles
    case 'Timesheets':
      return results.timesheets
    case 'Holiday Requests':
      return results.holidayRequests
    case 'Vehicle Checks':
      return results.vehicleChecks
    case 'Driver Reports':
      return results.driverReports
    case 'Documents':
      return results.documents
    case 'Contacts':
      return results.contacts
    case 'Consumables':
      return results.consumables
  }
}

function QuickSearchResultRow({
  item,
  onSelect,
}: {
  item: QuickSearchResultItem
  onSelect: (item: QuickSearchResultItem) => void
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(item)}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#F5FAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/80"
    >
      <span
        className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${moduleBadgeClassMap[item.module]}`}
      >
        {item.module}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#113C69]">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs font-medium text-[#5499BF]/90">
          {item.subtitle}
        </span>
      </span>
    </button>
  )
}

export function DashboardQuickSearch() {
  const navigate = useNavigate()
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<QuickSearchGroupedResults>(emptyQuickSearchResults)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), QUICK_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (debouncedQuery.length < QUICK_SEARCH_MIN_LENGTH) {
      setResults(emptyQuickSearchResults)
      setIsLoading(false)
      setSearchError(null)
      if (debouncedQuery.length === 0) {
        setIsOpen(false)
      }
      return
    }

    let cancelled = false
    setIsLoading(true)
    setSearchError(null)
    setIsOpen(true)

    void searchDashboardQuick(debouncedQuery)
      .then((nextResults) => {
        if (cancelled) return
        setResults(nextResults)
      })
      .catch(() => {
        if (cancelled) return
        setResults(emptyQuickSearchResults)
        setSearchError('Search is temporarily unavailable.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const closeResults = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleSelect = useCallback(
    (item: QuickSearchResultItem) => {
      closeResults()
      setQuery('')
      setDebouncedQuery('')
      setResults(emptyQuickSearchResults)
      navigate(item.path)
    },
    [closeResults, navigate],
  )

  const handleClear = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    setResults(emptyQuickSearchResults)
    setSearchError(null)
    setIsOpen(false)
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeResults()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeResults()
        inputRef.current?.blur()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeResults, isOpen])

  const showPanel =
    isOpen && debouncedQuery.length >= QUICK_SEARCH_MIN_LENGTH
  const totalResults = countResults(results)
  const showEmpty = showPanel && !isLoading && !searchError && totalResults === 0

  return (
    <section className="mb-4 sm:mb-5 lg:mb-6" aria-label="Search">
      <div ref={rootRef} className="relative w-full lg:max-w-[620px]">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#5499BF]"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            if (event.target.value.trim().length >= QUICK_SEARCH_MIN_LENGTH) {
              setIsOpen(true)
            }
          }}
          onFocus={() => {
            if (debouncedQuery.length >= QUICK_SEARCH_MIN_LENGTH) {
              setIsOpen(true)
            }
          }}
          placeholder="Search"
          aria-label="Search"
          aria-expanded={showPanel}
          aria-controls={showPanel ? listboxId : undefined}
          aria-autocomplete="list"
          role="combobox"
          className={quickSearchInputClass}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[#5499BF] transition-colors hover:bg-[#E8F3FE] hover:text-[#0B68BE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/80"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : null}

        {showPanel ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(24rem,calc(100vh-12rem))] overflow-hidden overflow-y-auto rounded-2xl border border-[#C5DFFB]/90 bg-[#FAFCFF]/98 shadow-[0_16px_40px_rgba(33,142,231,0.14)] ring-1 ring-[#D3E9FC]/80"
          >
            {isLoading ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm font-medium text-[#3D7A9C]">
                <Loader2 className="size-4 animate-spin text-[#218EE7]" aria-hidden="true" />
                Searching…
              </div>
            ) : null}

            {!isLoading && searchError ? (
              <p className="px-4 py-4 text-sm font-medium text-rose-600">{searchError}</p>
            ) : null}

            {showEmpty ? (
              <p className="px-4 py-4 text-sm font-medium text-[#5499BF]/90">
                No results found.
              </p>
            ) : null}

            {!isLoading && !searchError && totalResults > 0 ? (
              <div className="space-y-1 p-2">
                {moduleOrder.map((module) => {
                  const moduleResults = getModuleResults(results, module)
                  if (moduleResults.length === 0) return null

                  return (
                    <div key={module} className="px-1 py-1">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5499BF]/85">
                        {module}
                      </p>
                      <div className="space-y-0.5">
                        {moduleResults.map((item) => (
                          <QuickSearchResultRow
                            key={item.id}
                            item={item}
                            onSelect={handleSelect}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
