import type {
  VehicleCheckItemInput,
  VehicleCheckItemResult,
  VehicleChecklistSection,
} from '@/lib/vehicleCheckTypes'
import { resolveVehicleCheckItemDescription } from '@/lib/vehicleCheckUtils'
import { Camera, Info, X } from 'lucide-react'
import { useMemo, useState } from 'react'

const RESULT_OPTIONS: VehicleCheckItemResult[] = ['Pass', 'Advisory', 'Fail']

const commentClassName =
  'min-h-10 w-full rounded-[10px] border border-[#C5DFFB] bg-[#F8FBFF] px-3 py-2 text-sm text-[#113C69] outline-none placeholder:text-[#7FAFCC] focus:border-[#218EE7] focus:ring-2 focus:ring-[#89CFF0]/30'

const resultButtonStyles: Record<VehicleCheckItemResult, string> = {
  Pass:
    'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 data-[selected=true]:border-emerald-500 data-[selected=true]:bg-emerald-100 data-[selected=true]:shadow-[0_0_0_2px_rgba(16,185,129,0.16)]',
  Advisory:
    'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-100 data-[selected=true]:shadow-[0_0_0_2px_rgba(245,158,11,0.16)]',
  Fail:
    'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400 data-[selected=true]:border-rose-500 data-[selected=true]:bg-rose-100 data-[selected=true]:shadow-[0_0_0_2px_rgba(225,29,72,0.16)]',
}

const resultLabels: Record<VehicleCheckItemResult, string> = {
  Pass: 'OK',
  Advisory: 'Defect',
  Fail: 'Fail',
}

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
  const [helpItem, setHelpItem] = useState<VehicleCheckItemInput | null>(null)
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
              description: null,
              allowNotes: true,
              allowPhoto: false,
              failOnDefect: true,
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

  const numberedItems = useMemo(() => {
    let index = 0
    const numbers = new Map<string, number>()

    for (const [, categoryItems] of grouped) {
      for (const item of categoryItems) {
        index += 1
        numbers.set(`${item.category}-${item.itemName}`, index)
      }
    }

    return numbers
  }, [grouped])

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

  function renderGuidanceText(text: string) {
    return text.split('\n').map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return <br key={index} />
      return (
        <p key={index} className="text-sm leading-6 text-slate-700">
          {trimmed}
        </p>
      )
    })
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
          className="overflow-hidden rounded-[16px] border border-[#D3E9FC] bg-white shadow-[0_8px_24px_rgba(33,142,231,0.08)]"
        >
          <div className="bg-gradient-to-r from-[#F4FAFF] to-[#E8F3FE] px-3 py-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
              {category}
            </h3>
          </div>
          <div className="divide-y divide-[#D3E9FC]/70">
            {categoryItems.map((item) => {
              const key = `${item.category}-${item.itemName}`
              const itemNumber = numberedItems.get(key) ?? 0
              const guidanceText = resolveVehicleCheckItemDescription(item)
              const hasGuidance = Boolean(guidanceText)
              const shouldShowDefectFields = item.result !== 'Pass'
              const allowNotes = item.allowNotes ?? true
              const allowPhoto = item.allowPhoto ?? false

              return (
                <div key={key} className="px-3 py-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 min-w-6 text-sm font-bold tabular-nums text-[#218EE7]">
                      {itemNumber}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold leading-5 text-[#113C69]">
                          {item.itemName}
                        </h4>
                        {hasGuidance ? (
                          <button
                            type="button"
                            onClick={() => setHelpItem(item)}
                            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#C5DFFB] bg-[#F5FAFF] text-[#0B68BE] shadow-sm transition-colors hover:bg-[#E8F3FE]"
                            aria-label={`Show guidance for ${item.itemName}`}
                          >
                            <Info className="size-4" />
                          </button>
                        ) : null}
                      </div>

                      {readOnly ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${resultButtonStyles[item.result]}`}
                            data-selected="true"
                          >
                            {resultLabels[item.result]}
                          </span>
                          {item.comment?.trim() ? (
                            <span className="text-sm text-slate-600">{item.comment}</span>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {RESULT_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() =>
                                  updateItem(item.category, item.itemName, {
                                    result: option,
                                  })
                                }
                                className={`min-h-10 rounded-[12px] border px-2 text-sm font-bold transition-all ${resultButtonStyles[option]}`}
                                data-selected={item.result === option}
                                aria-pressed={item.result === option}
                              >
                                {resultLabels[option]}
                              </button>
                            ))}
                          </div>

                          {shouldShowDefectFields ? (
                            <div className="mt-3 space-y-2">
                              {allowNotes ? (
                                <textarea
                                  value={item.comment ?? ''}
                                  onChange={(event) =>
                                    updateItem(item.category, item.itemName, {
                                      comment: event.target.value,
                                    })
                                  }
                                  rows={2}
                                  placeholder="Add defect notes"
                                  className={commentClassName}
                                />
                              ) : null}
                              {allowPhoto ? (
                                <label className="block">
                                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#5499BF]">
                                    <Camera className="size-3.5" />
                                    Photo URL
                                  </span>
                                  <input
                                    type="url"
                                    value={item.photoUrl ?? ''}
                                    onChange={(event) =>
                                      updateItem(item.category, item.itemName, {
                                        photoUrl: event.target.value,
                                      })
                                    }
                                    placeholder="Paste photo URL"
                                    className={commentClassName}
                                  />
                                </label>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {helpItem ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/35 px-3 pb-3 backdrop-blur-[2px] sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close guidance"
            onClick={() => setHelpItem(null)}
          />
          <div
            className="relative max-h-[78vh] w-full max-w-lg overflow-hidden rounded-[20px] border border-[#C5DFFB] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
            role="dialog"
            aria-modal="true"
            aria-label={`${helpItem.itemName} guidance`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#D3E9FC] bg-gradient-to-r from-[#F4FAFF] to-[#E8F3FE] px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
                  Guidance
                </p>
                <h3 className="mt-1 text-base font-semibold text-[#113C69]">
                  {helpItem.itemName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHelpItem(null)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0B68BE] shadow-sm"
                aria-label="Close guidance"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto px-4 py-4">
              {helpItem && resolveVehicleCheckItemDescription(helpItem) ? (
                renderGuidanceText(resolveVehicleCheckItemDescription(helpItem)!)
              ) : (
                <p className="text-sm text-slate-600">No guidance added for this item.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
