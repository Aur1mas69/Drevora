import type {
  VehicleCheckItemInput,
  VehicleCheckItemResult,
  VehicleChecklistSection,
} from '@/lib/vehicleCheckTypes'
import {
  buildExpectedChecklistItems,
  getChecklistAnswerProgress,
  getVehicleCheckItemKey,
  getVehicleCheckTemplateGuidance,
  isVehicleCheckItemAnswered,
} from '@/lib/vehicleCheckUtils'
import { VehicleCheckDefectPhotoField } from '@/components/vehicle-checks/VehicleCheckDefectPhotoField'
import { Camera, Info, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

const RESULT_OPTIONS: VehicleCheckItemResult[] = ['Pass', 'Advisory', 'Fail']

const commentClassName =
  'min-h-10 w-full rounded-[10px] border border-[#C5DFFB] bg-[#F8FBFF] px-3 py-2 text-sm text-[#113C69] outline-none placeholder:text-[#7FAFCC] focus:border-[#218EE7] focus:ring-2 focus:ring-[#89CFF0]/30'

const resultButtonStyles: Record<VehicleCheckItemResult, string> = {
  Pass:
    'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 data-[selected=true]:border-emerald-500 data-[selected=true]:bg-emerald-100 data-[selected=true]:shadow-[0_0_0_2px_rgba(16,185,129,0.16)]',
  Advisory:
    'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-100 data-[selected=true]:shadow-[0_0_0_2px_rgba(245,158,11,0.16)]',
  Fail:
    'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 data-[selected=true]:border-slate-500 data-[selected=true]:bg-slate-100 data-[selected=true]:shadow-[0_0_0_2px_rgba(100,116,139,0.16)]',
}

const resultLabels: Record<VehicleCheckItemResult, string> = {
  Pass: 'OK',
  Advisory: 'Defect',
  Fail: 'N/A',
}

type VehicleCheckChecklistFormProps = {
  items: VehicleCheckItemInput[]
  onChange: (items: VehicleCheckItemInput[]) => void
  readOnly?: boolean
  sections?: VehicleChecklistSection[]
  emptyMessage?: string
  highlightUnanswered?: boolean
}

export function VehicleCheckChecklistForm({
  items,
  onChange,
  readOnly = false,
  sections,
  emptyMessage,
  highlightUnanswered = false,
}: VehicleCheckChecklistFormProps) {
  const [helpItem, setHelpItem] = useState<VehicleCheckItemInput | null>(null)
  const expectedItems = useMemo(
    () => buildExpectedChecklistItems(items, sections),
    [items, sections],
  )
  const { answeredCount, totalCount } = useMemo(
    () => getChecklistAnswerProgress(items, sections),
    [items, sections],
  )
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

  const grouped = useMemo(() => {
    const map = new Map<string, VehicleCheckItemInput[]>()

    if (sections && sections.length > 0) {
      for (const { section, itemNames } of sections) {
        const categoryItems = itemNames.map((itemName) => {
          return (
            expectedItems.find(
              (entry) => entry.category === section && entry.itemName === itemName,
            ) ?? {
              category: section,
              itemName,
              result: 'Pass' as VehicleCheckItemResult,
              comment: '',
              isAnswered: false,
            }
          )
        })
        map.set(section, categoryItems)
      }
      return map
    }

    for (const item of expectedItems) {
      const group = map.get(item.category) ?? []
      group.push(item)
      map.set(item.category, group)
    }

    return map
  }, [expectedItems, sections])

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

  function clearDefectPhoto(item: VehicleCheckItemInput) {
    if (item.photoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(item.photoPreviewUrl)
    }
  }

  function updateItem(
    category: string,
    itemName: string,
    patch: Partial<VehicleCheckItemInput>,
  ) {
    const index = items.findIndex(
      (entry) => entry.category === category && entry.itemName === itemName,
    )
    const currentItem =
      index >= 0
        ? items[index]
        : ({
            category,
            itemName,
            result: 'Pass' as VehicleCheckItemResult,
            comment: '',
            isAnswered: true,
          } satisfies VehicleCheckItemInput)

    if (patch.result && patch.result !== 'Advisory') {
      clearDefectPhoto(currentItem)
      patch = {
        ...patch,
        photoUrl: null,
        photoFile: null,
        photoPreviewUrl: null,
      }
    }

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
        isAnswered: true,
        ...patch,
      },
    ])
  }

  function renderGuidanceText(text: string) {
    const blocks: ReactNode[] = []
    let bulletBuffer: string[] = []

    function flushBullets(keyPrefix: string) {
      if (bulletBuffer.length === 0) return
      blocks.push(
        <ul key={`${keyPrefix}-ul`} className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
          {bulletBuffer.map((entry, index) => (
            <li key={`${keyPrefix}-li-${index}`}>{entry}</li>
          ))}
        </ul>,
      )
      bulletBuffer = []
    }

    text.split('\n').forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) {
        flushBullets(`gap-${index}`)
        blocks.push(<div key={`spacer-${index}`} className="h-2" />)
        return
      }

      if (trimmed.startsWith('- ')) {
        bulletBuffer.push(trimmed.slice(2).trim())
        return
      }

      flushBullets(`before-${index}`)
      blocks.push(
        <p key={`p-${index}`} className="text-sm leading-6 text-slate-700">
          {trimmed}
        </p>,
      )
    })

    flushBullets('end')
    return blocks
  }

  if (emptyMessage && grouped.size === 0) {
    return (
      <p className="rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600">
        {emptyMessage}
      </p>
    )
  }

  const helpGuidance = helpItem ? getVehicleCheckTemplateGuidance(helpItem) : null

  return (
    <div className="space-y-3">
      {!readOnly && totalCount > 0 ? (
        <div className="sticky top-0 z-10 rounded-[10px] border border-[#D3E9FC] bg-[#FAFCFF]/95 px-3 py-2 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#5499BF]">
              Checked{' '}
              <span className="tabular-nums text-[#113C69]">{answeredCount}</span>
              {' / '}
              <span className="tabular-nums text-[#113C69]">{totalCount}</span>
            </p>
            {highlightUnanswered && answeredCount < totalCount ? (
              <span className="text-[11px] font-semibold text-amber-700">
                {totalCount - answeredCount} left
              </span>
            ) : null}
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E8F3FE]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={answeredCount}
            aria-label={`Checklist progress: ${answeredCount} of ${totalCount} items answered`}
          >
            <div
              className="h-full rounded-full bg-[#218EE7] transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {[...grouped.entries()].map(([category, categoryItems]) => (
        <section
          key={category}
          className="overflow-hidden rounded-[14px] border border-[#D3E9FC] bg-white shadow-[0_6px_18px_rgba(33,142,231,0.06)]"
        >
          <div className="bg-gradient-to-r from-[#F4FAFF] to-[#E8F3FE] px-3 py-1.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
              {category}
            </h3>
          </div>
          <div className="divide-y divide-[#D3E9FC]/70">
            {categoryItems.map((item) => {
              const key = getVehicleCheckItemKey(item)
              const itemNumber = numberedItems.get(key) ?? 0
              const isAnswered = isVehicleCheckItemAnswered(item)
              const isDefect = item.result === 'Advisory'
              const allowNotes = item.allowNotes ?? true
              const shouldShowDefectNotes = isDefect && allowNotes
              const shouldShowDefectPhoto = isDefect && !readOnly
              const showUnansweredHighlight = highlightUnanswered && !isAnswered

              return (
                <div
                  key={key}
                  className={`px-2.5 py-2 sm:px-3 sm:py-2.5 ${
                    showUnansweredHighlight
                      ? 'bg-amber-50/70 ring-1 ring-inset ring-amber-200/90'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start gap-1.5">
                        <h4 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-[#113C69]">
                          <span className="mr-1.5 font-bold tabular-nums text-[#218EE7]">
                            {itemNumber}.
                          </span>
                          {item.itemName}
                          {showUnansweredHighlight ? (
                            <span className="ml-1.5 text-[11px] font-semibold text-amber-700">
                              Required
                            </span>
                          ) : null}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setHelpItem(item)}
                          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#C5DFFB] bg-[#F5FAFF] text-[#0B68BE] shadow-sm transition-colors hover:bg-[#E8F3FE]"
                          aria-label={`Show guidance for ${item.itemName}`}
                        >
                          <Info className="size-3.5" />
                        </button>
                      </div>

                      {readOnly ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${resultButtonStyles[item.result]}`}
                            data-selected="true"
                          >
                            {resultLabels[item.result]}
                          </span>
                          {isDefect && item.comment?.trim() ? (
                            <span className="text-sm text-slate-600">{item.comment}</span>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:gap-2">
                            {RESULT_OPTIONS.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() =>
                                  updateItem(item.category, item.itemName, {
                                    result: option,
                                    isAnswered: true,
                                    comment: option === 'Advisory' ? item.comment ?? '' : '',
                                  })
                                }
                                className={`min-h-11 rounded-[10px] border px-1.5 text-xs font-bold transition-all active:scale-[0.98] sm:min-h-10 sm:px-2 sm:text-sm ${resultButtonStyles[option]}`}
                                data-selected={isAnswered && item.result === option}
                                aria-pressed={isAnswered && item.result === option}
                              >
                                {resultLabels[option]}
                              </button>
                            ))}
                          </div>

                          {shouldShowDefectNotes ? (
                            <div className="mt-2">
                              <textarea
                                value={item.comment ?? ''}
                                onChange={(event) =>
                                  updateItem(item.category, item.itemName, {
                                    comment: event.target.value,
                                  })
                                }
                                rows={2}
                                placeholder="Describe the defect…"
                                className={commentClassName}
                              />
                            </div>
                          ) : null}

                          {shouldShowDefectPhoto ? (
                            <div className="mt-2">
                              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#5499BF]">
                                <Camera className="size-3.5" />
                                Defect photo
                              </p>
                              <VehicleCheckDefectPhotoField
                                storagePath={
                                  item.photoFile ? null : item.photoUrl ?? null
                                }
                                previewBlobUrl={item.photoPreviewUrl ?? null}
                                selectedFile={item.photoFile ?? null}
                                onPhotoSelected={(file, previewUrl) => {
                                  clearDefectPhoto(item)
                                  updateItem(item.category, item.itemName, {
                                    photoFile: file,
                                    photoPreviewUrl: previewUrl,
                                    photoUrl: null,
                                  })
                                }}
                                onPhotoRemoved={() => {
                                  clearDefectPhoto(item)
                                  updateItem(item.category, item.itemName, {
                                    photoFile: null,
                                    photoPreviewUrl: null,
                                    photoUrl: null,
                                  })
                                }}
                              />
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
            className="relative max-h-[70vh] w-full max-w-md overflow-hidden rounded-[18px] border border-[#C5DFFB] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
            role="dialog"
            aria-modal="true"
            aria-label={`${helpItem.itemName} guidance`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#D3E9FC] bg-gradient-to-r from-[#F4FAFF] to-[#E8F3FE] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
                  Guidance
                </p>
                <h3 className="mt-1 text-sm font-semibold leading-5 text-[#113C69]">
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
            <div className="max-h-[50vh] space-y-2 overflow-y-auto px-4 py-3">
              {helpGuidance ? (
                renderGuidanceText(helpGuidance)
              ) : (
                <p className="text-sm text-slate-600">No guidance added yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
