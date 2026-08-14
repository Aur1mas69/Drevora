import {
  ADMIN_DASHBOARD_CARD_LABELS,
  ADMIN_DASHBOARD_PINNED_CARD_IDS,
  ADMIN_DASHBOARD_SORTABLE_CARD_IDS,
  type AdminDashboardCardId,
  type AdminDashboardSortableCardId,
} from '@/lib/adminDashboardLayout'
import type { AdminDashboardLayoutControls } from '@/hooks/useAdminDashboardLayout'
import { Check, ChevronLeft, ChevronRight, Pin, RotateCcw } from 'lucide-react'
import { useState } from 'react'

type DashboardCustomizeBarProps = {
  layoutControls: AdminDashboardLayoutControls
}

export function DashboardCustomizeBar({ layoutControls }: DashboardCustomizeBarProps) {
  const { layout, isHidden, toggleHidden, reorder, resetToDefault, setCustomizing } =
    layoutControls
  const [confirmReset, setConfirmReset] = useState(false)

  const visibilityIds: AdminDashboardCardId[] = [
    ...layout.order,
    ...ADMIN_DASHBOARD_PINNED_CARD_IDS,
  ]

  return (
    <section
      className="rounded-[20px] border border-[#B7D7F2] bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(240,248,255,0.95)_100%)] p-3.5 shadow-[0_8px_22px_rgba(30,64,175,0.08)] dark:border-white/10 dark:bg-slate-900/70 sm:p-4"
      aria-label="Dashboard customization"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#123A63] dark:text-slate-100">
            Customize dashboard
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[#5D7C9D] dark:text-slate-400">
            Drag cards to reorder your dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {confirmReset ? (
            <>
              <span className="text-xs font-medium text-[#5D7C9D] dark:text-slate-400">
                Restore default layout?
              </span>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-lg bg-[#3B82F6] px-2.5 text-xs font-semibold text-white hover:bg-[#2563EB]"
                onClick={() => {
                  resetToDefault()
                  setConfirmReset(false)
                }}
              >
                Confirm reset
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-lg border border-[#CFE3F5] bg-white px-2.5 text-xs font-semibold text-[#3B82F6] hover:bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CFE3F5] bg-white px-2.5 text-xs font-semibold text-[#3B82F6] hover:bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden="true" />
              Reset to default
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-2.5 text-xs font-semibold text-white hover:bg-[#2563EB]"
            onClick={() => setCustomizing(false)}
          >
            <Check className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
            Done
          </button>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Card visibility">
        {visibilityIds.map((id) => {
          const pinned = ADMIN_DASHBOARD_PINNED_CARD_IDS.includes(
            id as (typeof ADMIN_DASHBOARD_PINNED_CARD_IDS)[number],
          )
          const hidden = isHidden(id)
          const sortable = ADMIN_DASHBOARD_SORTABLE_CARD_IDS.includes(
            id as (typeof ADMIN_DASHBOARD_SORTABLE_CARD_IDS)[number],
          )
          const sortableId = sortable ? (id as AdminDashboardSortableCardId) : null
          const orderIndex = sortableId ? layout.order.indexOf(sortableId) : -1

          return (
            <li key={id}>
              <div
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${
                  hidden
                    ? 'border-[#D0E4F6] bg-white/70 text-[#7A97B5] dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-400'
                    : 'border-[#BFDBFE] bg-[#EAF4FF] text-[#163A63] dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-100'
                }`}
              >
                {sortableId ? (
                  <button
                    type="button"
                    className="inline-flex size-5 items-center justify-center rounded text-current hover:bg-white/70 disabled:opacity-30 dark:hover:bg-slate-800"
                    aria-label={`Move ${ADMIN_DASHBOARD_CARD_LABELS[id]} earlier`}
                    disabled={orderIndex <= 0}
                    onClick={() => reorder(sortableId, layout.order[orderIndex - 1])}
                  >
                    <ChevronLeft className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                  </button>
                ) : null}
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="size-3.5 rounded border-[#B7D7F2] text-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]/40"
                    checked={!hidden}
                    onChange={() => toggleHidden(id)}
                  />
                  <span>{ADMIN_DASHBOARD_CARD_LABELS[id]}</span>
                  {pinned ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B8AAB] dark:text-slate-400">
                      <Pin className="size-2.5" strokeWidth={2.2} aria-hidden="true" />
                      Pinned
                    </span>
                  ) : null}
                </label>
                {sortableId ? (
                  <button
                    type="button"
                    className="inline-flex size-5 items-center justify-center rounded text-current hover:bg-white/70 disabled:opacity-30 dark:hover:bg-slate-800"
                    aria-label={`Move ${ADMIN_DASHBOARD_CARD_LABELS[id]} later`}
                    disabled={orderIndex < 0 || orderIndex >= layout.order.length - 1}
                    onClick={() => reorder(sortableId, layout.order[orderIndex + 1])}
                  >
                    <ChevronRight className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
