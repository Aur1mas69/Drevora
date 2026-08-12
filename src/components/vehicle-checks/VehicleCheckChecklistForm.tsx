import type {
  VehicleCheckAssetScope,
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
  vehicleCheckItemMatches,
} from '@/lib/vehicleCheckUtils'
import { VehicleCheckDefectPhotoField } from '@/components/vehicle-checks/VehicleCheckDefectPhotoField'
import {
  DREVORA_RECOMMENDED_SECTION,
  DREVORA_RECOMMENDED_SECTION_HINT,
  DREVORA_RECOMMENDED_VEHICLE_HINT,
} from '@/lib/defaultDrevoraRecommendedCheckItems'
import { Camera, Check, Info, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

const RESULT_OPTIONS: VehicleCheckItemResult[] = ['Pass', 'Advisory', 'Fail']

const commentClassName =
  'worker-vc-defect-notes box-border min-h-10 min-w-0 w-full max-w-full rounded-[10px] border border-[#C5DFFB] bg-[#F8FBFF] px-3 py-2 text-sm text-[#113C69] outline-none placeholder:text-[#7FAFCC] focus:border-[#218EE7] focus:ring-2 focus:ring-[#89CFF0]/30'

/**
 * Outdoor / bright-sunlight status controls (Worker mobile first).
 * Pass = OK (green), Advisory = Defect (red), Fail = N/A (amber).
 * Selected fill is saturated so it stays obvious in sunlight.
 */
const resultButtonBaseClassName =
  'inline-flex min-h-12 items-center justify-center gap-1 rounded-[12px] border-[2.5px] px-1.5 text-[13px] font-black tracking-wide transition-[transform,background-color,border-color,box-shadow,color,ring-color] duration-100 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-45 sm:min-h-11 sm:px-2 sm:text-sm'

const resultButtonStyles: Record<VehicleCheckItemResult, string> = {
  Pass: [
    'border-green-800 bg-green-100 text-green-950',
    'hover:border-green-900 hover:bg-green-200',
    'active:bg-green-200',
    'focus-visible:ring-green-400/90',
    'data-[selected=true]:border-green-950 data-[selected=true]:bg-green-600 data-[selected=true]:text-white',
    'data-[selected=true]:ring-4 data-[selected=true]:ring-green-300',
    'data-[selected=true]:shadow-[0_2px_0_#14532d,inset_0_-2px_0_rgba(6,78,59,0.55)]',
    'data-[selected=true]:active:bg-green-700',
  ].join(' '),
  Advisory: [
    'border-red-800 bg-red-100 text-red-950',
    'hover:border-red-900 hover:bg-red-200',
    'active:bg-red-200',
    'focus-visible:ring-red-400/90',
    'data-[selected=true]:border-red-950 data-[selected=true]:bg-red-600 data-[selected=true]:text-white',
    'data-[selected=true]:ring-4 data-[selected=true]:ring-red-300',
    'data-[selected=true]:shadow-[0_2px_0_#7f1d1d,inset_0_-2px_0_rgba(127,29,29,0.5)]',
    'data-[selected=true]:active:bg-red-700',
  ].join(' '),
  Fail: [
    'border-amber-800 bg-amber-100 text-amber-950',
    'hover:border-amber-900 hover:bg-amber-200',
    'active:bg-amber-200',
    'focus-visible:ring-amber-400/90',
    'data-[selected=true]:border-amber-950 data-[selected=true]:bg-amber-400 data-[selected=true]:text-amber-950',
    'data-[selected=true]:ring-4 data-[selected=true]:ring-amber-200',
    'data-[selected=true]:shadow-[0_2px_0_#92400e,inset_0_-2px_0_rgba(120,53,15,0.45)]',
    'data-[selected=true]:active:bg-amber-500',
  ].join(' '),
}

const resultBadgeStyles: Record<VehicleCheckItemResult, string> = {
  Pass: 'border-green-900 bg-green-600 text-white',
  Advisory: 'border-red-900 bg-red-600 text-white',
  Fail: 'border-amber-900 bg-amber-400 text-amber-950',
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
    if (sections && sections.length > 0) {
      return sections.map(({ section, itemNames, assetScope }, index) => ({
        key: `${section}::${assetScope ?? 'vehicle'}::${index}`,
        category: section,
        assetScope,
        categoryItems: itemNames.map((itemName) => {
          return (
            expectedItems.find((entry) =>
              vehicleCheckItemMatches(entry, section, itemName, assetScope),
            ) ?? {
              category: section,
              itemName,
              result: 'Pass' as VehicleCheckItemResult,
              comment: '',
              isAnswered: false,
              assetScope,
            }
          )
        }),
      }))
    }

    const map = new Map<string, VehicleCheckItemInput[]>()
    for (const item of expectedItems) {
      const group = map.get(item.category) ?? []
      group.push(item)
      map.set(item.category, group)
    }

    return [...map.entries()].map(([category, categoryItems]) => ({
      key: category,
      category,
      assetScope: undefined as VehicleCheckAssetScope | undefined,
      categoryItems,
    }))
  }, [expectedItems, sections])

  const numberedItems = useMemo(() => {
    let index = 0
    const numbers = new Map<string, number>()

    for (const { categoryItems } of grouped) {
      for (const item of categoryItems) {
        index += 1
        numbers.set(getVehicleCheckItemKey(item), index)
      }
    }

    return numbers
  }, [grouped])

  const currentCheckNumber = useMemo(() => {
    if (totalCount === 0) return 0
    for (const { categoryItems } of grouped) {
      for (const item of categoryItems) {
        if (!isVehicleCheckItemAnswered(item)) {
          return numberedItems.get(getVehicleCheckItemKey(item)) ?? 1
        }
      }
    }
    return totalCount
  }, [grouped, numberedItems, totalCount])

  function clearDefectPhoto(item: VehicleCheckItemInput) {
    if (item.photoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(item.photoPreviewUrl)
    }
  }

  function updateItem(
    category: string,
    itemName: string,
    patch: Partial<VehicleCheckItemInput>,
    assetScope?: VehicleCheckAssetScope | null,
  ) {
    const index = items.findIndex((entry) =>
      vehicleCheckItemMatches(entry, category, itemName, assetScope),
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

  if (emptyMessage && grouped.length === 0) {
    return (
      <p className="rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600">
        {emptyMessage}
      </p>
    )
  }

  const helpGuidance = helpItem ? getVehicleCheckTemplateGuidance(helpItem) : null

  return (
    <div className="worker-vc-checklist min-w-0 w-full max-w-full space-y-2 sm:space-y-3">
      {!readOnly && totalCount > 0 ? (
        <div className="worker-vc-progress sticky top-0 z-10 min-w-0 rounded-[12px] border border-[#BFE3F5] bg-[#EAF4FF]/95 px-3 py-2 shadow-[0_4px_14px_rgba(33,142,231,0.12)] backdrop-blur-md">
          <div className="flex min-w-0 items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="worker-vc-progress-eyebrow text-[10px] font-bold uppercase tracking-[0.1em] text-[#0B68BE]">
                Check {currentCheckNumber} of {totalCount}
              </p>
              <p className="worker-vc-progress-value mt-0.5 text-sm font-bold tabular-nums leading-none text-[#113C69]">
                {answeredCount}
                <span className="worker-vc-muted font-semibold text-[#5499BF]"> answered</span>
                <span className="worker-vc-progress-pct ml-2 text-[#0B68BE]">{progressPercent}% complete</span>
              </p>
            </div>
            {highlightUnanswered && answeredCount < totalCount ? (
              <span className="worker-vc-left-pill shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                {totalCount - answeredCount} left
              </span>
            ) : null}
          </div>
          <div
            className="worker-vc-progress-track mt-2 h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-[#C5DFFB]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label={`Check ${currentCheckNumber} of ${totalCount}, ${progressPercent} percent complete`}
          >
            <div
              className="worker-vc-progress-fill h-full rounded-full bg-[#218EE7] transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {grouped.map(({ key, category, assetScope, categoryItems }) => (
        <section
          key={key}
          className="worker-vc-section min-w-0 max-w-full overflow-hidden rounded-[14px] border border-[#D3E9FC] bg-white shadow-[0_4px_14px_rgba(33,142,231,0.06)] dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/20"
        >
          <div className="worker-vc-section-head bg-gradient-to-r from-[#F4FAFF] to-[#E8F3FE] px-3 py-1 dark:from-slate-800/70 dark:to-slate-800/50">
            <h3 className="worker-vc-muted text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
              {category}
            </h3>
            {category === DREVORA_RECOMMENDED_SECTION ? (
              <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#7FAFCC] dark:text-slate-400">
                {assetScope === 'trailer'
                  ? DREVORA_RECOMMENDED_SECTION_HINT
                  : DREVORA_RECOMMENDED_VEHICLE_HINT}
              </p>
            ) : null}
          </div>
          <div className="min-w-0 divide-y divide-[#D3E9FC]/70 dark:divide-white/10">
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
                  className={`worker-vc-item min-w-0 max-w-full px-2.5 py-1.5 sm:px-3 sm:py-2.5 ${
                    showUnansweredHighlight
                      ? 'bg-amber-50/70 ring-1 ring-inset ring-amber-200/90'
                      : ''
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-1.5">
                    <div className="min-w-0 max-w-full flex-1">
                      <div className="flex min-w-0 items-start gap-1.5">
                        <h4 className="worker-vc-item-title min-w-0 flex-1 break-words text-[13px] font-semibold leading-5 text-[#113C69] sm:text-sm">
                          <span className="worker-vc-item-num mr-1.5 font-bold tabular-nums text-[#218EE7]">
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
                          className="worker-vc-help flex size-11 shrink-0 items-center justify-center rounded-full border border-[#C5DFFB] bg-[#F5FAFF] text-[#0B68BE] shadow-sm transition-colors hover:bg-[#E8F3FE] sm:size-9"
                          aria-label={`Show guidance for ${item.itemName}`}
                        >
                          <Info className="size-3.5" />
                        </button>
                      </div>

                      {readOnly ? (
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold ${resultBadgeStyles[item.result]}`}
                          >
                            <Check className="size-3.5 shrink-0" aria-hidden="true" />
                            {resultLabels[item.result]}
                          </span>
                          {isDefect && item.comment?.trim() ? (
                            <span className="min-w-0 break-words text-sm text-slate-600">
                              {item.comment}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <div
                            className="mt-1.5 grid min-w-0 grid-cols-3 gap-2"
                            role="group"
                            aria-label={`Status for ${item.itemName}`}
                          >
                            {RESULT_OPTIONS.map((option) => {
                              const selected = isAnswered && item.result === option
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() =>
                                    updateItem(item.category, item.itemName, {
                                      result: option,
                                      isAnswered: true,
                                      comment: option === 'Advisory' ? item.comment ?? '' : '',
                                    }, item.assetScope)
                                  }
                                  className={`${resultButtonBaseClassName} ${resultButtonStyles[option]} worker-result-${option === 'Pass' ? 'ok' : option === 'Advisory' ? 'defect' : 'na'}`}
                                  data-selected={selected}
                                  aria-pressed={selected}
                                  aria-label={`${resultLabels[option]}${selected ? ', selected' : ''}`}
                                >
                                  {selected ? (
                                    <Check
                                      className="size-4 shrink-0"
                                      strokeWidth={3.5}
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  {resultLabels[option]}
                                </button>
                              )
                            })}
                          </div>

                          {/*
                            Mount Defect extras only when needed. Avoid always-on
                            grid-rows-[0fr]/[1fr] expand wrappers: on iOS/WebKit those
                            force horizontal overflow and costly reflow across the
                            full checklist when any item becomes Defect.
                          */}
                          {shouldShowDefectNotes ? (
                            <div className="worker-vc-defect-panel mt-2 min-w-0 w-full max-w-full">
                              <textarea
                                value={item.comment ?? ''}
                                onChange={(event) =>
                                  updateItem(item.category, item.itemName, {
                                    comment: event.target.value,
                                  }, item.assetScope)
                                }
                                rows={2}
                                placeholder="Describe the defect…"
                                className={commentClassName}
                              />
                            </div>
                          ) : null}

                          {shouldShowDefectPhoto ? (
                            <div className="worker-vc-defect-panel mt-1.5 min-w-0 w-full max-w-full">
                              <p className="worker-vc-muted mb-1 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[#5499BF]">
                                <Camera className="size-3.5 shrink-0" />
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
                                  }, item.assetScope)
                                }}
                                onPhotoRemoved={() => {
                                  clearDefectPhoto(item)
                                  updateItem(item.category, item.itemName, {
                                    photoFile: null,
                                    photoPreviewUrl: null,
                                    photoUrl: null,
                                  }, item.assetScope)
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
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/35 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] backdrop-blur-[2px] sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close guidance"
            onClick={() => setHelpItem(null)}
          />
          <div
            className="relative max-h-[70vh] w-full max-w-md overflow-hidden rounded-[18px] border border-[#C5DFFB] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/50"
            role="dialog"
            aria-modal="true"
            aria-label={`${helpItem.itemName} guidance`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#D3E9FC] bg-gradient-to-r from-[#F4FAFF] to-[#E8F3FE] px-4 py-3 dark:border-white/10 dark:from-slate-800/70 dark:to-slate-800/50">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
                  Guidance
                </p>
                <h3 className="mt-1 text-sm font-semibold leading-5 text-[#113C69] dark:text-slate-100">
                  {helpItem.itemName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHelpItem(null)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0B68BE] shadow-sm dark:bg-slate-800 dark:text-blue-300 sm:size-9"
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
