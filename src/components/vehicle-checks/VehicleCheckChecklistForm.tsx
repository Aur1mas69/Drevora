import type {
  VehicleCheckItemInput,
  VehicleCheckItemResult,
  VehicleChecklistSection,
} from '@/lib/vehicleCheckTypes'
import { useMemo } from 'react'

const RESULT_OPTIONS: VehicleCheckItemResult[] = ['Pass', 'Advisory', 'Fail']

const selectClassName =
  'h-8 w-full min-w-[88px] rounded-[8px] border border-[rgba(75,120,220,0.12)] bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

const commentClassName =
  'h-8 w-full rounded-[8px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-2 text-xs text-slate-700 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

type VehicleCheckChecklistFormProps = {
  items: VehicleCheckItemInput[]
  onChange: (items: VehicleCheckItemInput[]) => void
  readOnly?: boolean
  sections?: VehicleChecklistSection[]
  emptyMessage?: string
}

export function VehicleCheckChecklistForm({
  items,
  onChange,
  readOnly = false,
  sections,
  emptyMessage,
}: VehicleCheckChecklistFormProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, VehicleCheckItemInput[]>()

    if (sections && sections.length > 0) {
      for (const { section, itemNames } of sections) {
        const categoryItems = itemNames.map((itemName) => {
          return (
            items.find(
              (entry) => entry.category === section && entry.itemName === itemName,
            ) ??
            ({
              category: section,
              itemName,
              result: 'Pass' as VehicleCheckItemResult,
              comment: '',
            } satisfies VehicleCheckItemInput)
          )
        })
        map.set(section, categoryItems)
      }
      return map
    }

    for (const item of items) {
      const group = map.get(item.category) ?? []
      group.push(item)
      map.set(item.category, group)
    }

    return map
  }, [items, sections])

  function updateItem(
    category: string,
    itemName: string,
    patch: Partial<VehicleCheckItemInput>,
  ) {
    const index = items.findIndex(
      (entry) => entry.category === category && entry.itemName === itemName,
    )

    if (index >= 0) {
      const next = items.map((entry, idx) =>
        idx === index ? { ...entry, ...patch } : entry,
      )
      onChange(next)
      return
    }

    onChange([
      ...items,
      {
        category,
        itemName,
        result: 'Pass',
        comment: '',
        ...patch,
      },
    ])
  }

  if (emptyMessage && grouped.size === 0) {
    return (
      <p className="rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([category, categoryItems]) => (
        <section
          key={category}
          className="overflow-hidden rounded-[12px] border border-[rgba(75,120,220,0.10)]"
        >
          <div className="bg-[#F4F8FF] px-3 py-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {category}
            </h3>
          </div>
          <div className="divide-y divide-[rgba(75,120,220,0.06)]">
            {categoryItems.map((item) => (
              <div
                key={`${item.category}-${item.itemName}`}
                className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(120px,1fr)_100px_minmax(0,1.5fr)] sm:items-center"
              >
                <span className="text-xs font-medium text-[#2A376F]">{item.itemName}</span>
                {readOnly ? (
                  <span className="text-xs font-semibold text-slate-700">{item.result}</span>
                ) : (
                  <select
                    value={item.result}
                    onChange={(event) =>
                      updateItem(item.category, item.itemName, {
                        result: event.target.value as VehicleCheckItemResult,
                      })
                    }
                    className={selectClassName}
                    aria-label={`${item.itemName} result`}
                  >
                    {RESULT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                {readOnly ? (
                  <span className="truncate text-xs text-slate-600">
                    {item.comment?.trim() || '—'}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={item.comment ?? ''}
                    onChange={(event) =>
                      updateItem(item.category, item.itemName, { comment: event.target.value })
                    }
                    placeholder="Comment"
                    className={commentClassName}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
