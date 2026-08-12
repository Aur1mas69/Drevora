import {
  DREVORA_RECOMMENDED_PACKS,
  DREVORA_RECOMMENDED_SECTION,
  DREVORA_RECOMMENDED_SECTION_HINT,
  DREVORA_RECOMMENDED_VEHICLE_HINT,
  DREVORA_RECOMMENDED_VEHICLE_PACKS,
} from '@/lib/defaultDrevoraRecommendedCheckItems'
import {
  getDefaultDvsaVehicleCheckItems,
  normalizeDvsaChecklistLabel,
} from '@/lib/defaultDvsaVehicleCheckItems'
import {
  getDefaultTrailerBaseCheckItems,
  TRAILER_CHECKLIST_SECTION,
} from '@/lib/defaultTrailerBaseCheckItems'
import type {
  VehicleCheck,
  VehicleCheckAssetScope,
  VehicleCheckItem,
  VehicleCheckItemInput,
  VehicleCheckItemResult,
  VehicleCheckListItem,
  VehicleChecklistSection,
  VehicleCheckTrailerSource,
} from '@/lib/vehicleCheckTypes'

export const VEHICLE_CHECK_REPORT_INSIDE_CAB_SECTION = 'Inside cab / front view'
export const VEHICLE_CHECK_REPORT_OUTSIDE_VEHICLE_SECTION = 'Outside vehicle'
export const VEHICLE_CHECK_REPORT_COMBINATION_SECTION = 'Combination'
export const VEHICLE_CHECK_REPORT_RECOMMENDED_TRAILER_TITLE =
  'DREVORA Recommended — Trailer'

export type VehicleCheckReportSectionKind =
  | 'inside_cab'
  | 'outside_vehicle'
  | 'recommended_vehicle'
  | 'combination'
  | 'trailer'
  | 'recommended_trailer'
  | 'company_custom'

export const VEHICLE_CHECK_REPORT_SECTION_KIND_ORDER: readonly VehicleCheckReportSectionKind[] =
  [
    'inside_cab',
    'outside_vehicle',
    'recommended_vehicle',
    'combination',
    'trailer',
    'recommended_trailer',
    'company_custom',
  ]

export type VehicleCheckReportItem = Pick<
  VehicleCheckItem,
  'id' | 'category' | 'itemName' | 'result' | 'comment' | 'photoUrl' | 'assetScope'
> &
  Partial<
    Pick<
      VehicleCheckItem,
      | 'description'
      | 'templateItem'
      | 'allowNotes'
      | 'allowPhoto'
      | 'failOnDefect'
      | 'vehicleCheckId'
    >
  >

export type VehicleCheckReportSection<T extends VehicleCheckReportItem = VehicleCheckReportItem> =
  {
    kind: VehicleCheckReportSectionKind
    title: string
    subtitle: string | null
    /** Category the Admin checklist form uses to match rows. */
    formCategory: string
    formAssetScope?: VehicleCheckAssetScope
    items: T[]
  }

export type VehicleCheckReportNumberedItem<
  T extends VehicleCheckReportItem = VehicleCheckReportItem,
> = {
  displayNumber: number
  item: T
  section: VehicleCheckReportSection<T>
}

export type VehicleCheckReportChecklistSummary = {
  ok: number
  defect: number
  na: number
  total: number
}

export type VehicleCheckReportModel<T extends VehicleCheckReportItem = VehicleCheckReportItem> =
  {
    sections: Array<VehicleCheckReportSection<T>>
    numberedItems: Array<VehicleCheckReportNumberedItem<T>>
    summary: VehicleCheckReportChecklistSummary
  }

export type VehicleCheckReportTrailerIdentity = {
  source: Exclude<VehicleCheckTrailerSource, 'none'>
  isThirdParty: boolean
  number: string | null
  registration: string | null
  trailerType: string | null
  label: string | null
}

export type VehicleCheckReportIdentity = {
  vehicle: {
    registration: string
    fleetNumber: string | null
    makeModel: string | null
    vehicleType: string | null
  }
  workerName: string
  trailer: VehicleCheckReportTrailerIdentity | null
}

const KIND_RANK = new Map(
  VEHICLE_CHECK_REPORT_SECTION_KIND_ORDER.map((kind, index) => [kind, index]),
)

let knownItemSortOrders: Map<string, number> | null = null

function labelKey(label: string): string {
  return normalizeDvsaChecklistLabel(label)
}

function isRecommendedCategory(category: string): boolean {
  const normalized = labelKey(category)
  return (
    normalized === labelKey(DREVORA_RECOMMENDED_SECTION) ||
    normalized.startsWith('drevora recommended')
  )
}

function getKnownItemSortOrders(): Map<string, number> {
  if (knownItemSortOrders) return knownItemSortOrders

  const map = new Map<string, number>()
  const remember = (label: string, order: number) => {
    const key = labelKey(label)
    const existing = map.get(key)
    if (existing == null || order < existing) map.set(key, order)
  }

  for (const item of getDefaultDvsaVehicleCheckItems()) {
    remember(item.label, item.sortOrder)
  }
  for (const item of getDefaultTrailerBaseCheckItems()) {
    remember(item.label, 200 + item.sortOrder)
  }
  for (const pack of Object.values(DREVORA_RECOMMENDED_VEHICLE_PACKS)) {
    for (const item of pack) remember(item.label, 150 + item.sortOrder)
  }
  for (const pack of Object.values(DREVORA_RECOMMENDED_PACKS)) {
    for (const item of pack) remember(item.label, 300 + item.sortOrder)
  }

  knownItemSortOrders = map
  return map
}

function itemSortRank(itemName: string, originalIndex: number): number {
  return getKnownItemSortOrders().get(labelKey(itemName)) ?? 10_000 + originalIndex
}

function classifyReportItem(item: VehicleCheckReportItem): {
  kind: VehicleCheckReportSectionKind
  bucketKey: string
  title: string
  subtitle: string | null
  formCategory: string
  formAssetScope?: VehicleCheckAssetScope
} {
  const category = item.category.trim() || 'Checklist'
  const scope = item.assetScope ?? 'vehicle'

  if (isRecommendedCategory(category) && scope === 'trailer') {
    return {
      kind: 'recommended_trailer',
      bucketKey: 'recommended_trailer',
      title: VEHICLE_CHECK_REPORT_RECOMMENDED_TRAILER_TITLE,
      subtitle: DREVORA_RECOMMENDED_SECTION_HINT,
      formCategory: DREVORA_RECOMMENDED_SECTION,
      formAssetScope: 'trailer',
    }
  }

  if (isRecommendedCategory(category)) {
    return {
      kind: 'recommended_vehicle',
      bucketKey: 'recommended_vehicle',
      title: DREVORA_RECOMMENDED_SECTION,
      subtitle: DREVORA_RECOMMENDED_VEHICLE_HINT,
      formCategory: DREVORA_RECOMMENDED_SECTION,
      formAssetScope: 'vehicle',
    }
  }

  if (scope === 'combination') {
    return {
      kind: 'combination',
      bucketKey: 'combination',
      title: VEHICLE_CHECK_REPORT_COMBINATION_SECTION,
      subtitle: null,
      formCategory: VEHICLE_CHECK_REPORT_COMBINATION_SECTION,
      formAssetScope: 'combination',
    }
  }

  if (scope === 'trailer' || category === TRAILER_CHECKLIST_SECTION) {
    return {
      kind: 'trailer',
      bucketKey: 'trailer',
      title: TRAILER_CHECKLIST_SECTION,
      subtitle: null,
      formCategory: TRAILER_CHECKLIST_SECTION,
      formAssetScope: 'trailer',
    }
  }

  if (category === VEHICLE_CHECK_REPORT_INSIDE_CAB_SECTION) {
    return {
      kind: 'inside_cab',
      bucketKey: 'inside_cab',
      title: VEHICLE_CHECK_REPORT_INSIDE_CAB_SECTION,
      subtitle: null,
      formCategory: VEHICLE_CHECK_REPORT_INSIDE_CAB_SECTION,
      formAssetScope: 'vehicle',
    }
  }

  if (category === VEHICLE_CHECK_REPORT_OUTSIDE_VEHICLE_SECTION) {
    return {
      kind: 'outside_vehicle',
      bucketKey: 'outside_vehicle',
      title: VEHICLE_CHECK_REPORT_OUTSIDE_VEHICLE_SECTION,
      subtitle: null,
      formCategory: VEHICLE_CHECK_REPORT_OUTSIDE_VEHICLE_SECTION,
      formAssetScope: 'vehicle',
    }
  }

  return {
    kind: 'company_custom',
    bucketKey: `company_custom::${category}::${scope}`,
    title: category,
    subtitle: null,
    formCategory: category,
    formAssetScope: scope,
  }
}

function summarizeStoredItems(
  items: Array<Pick<VehicleCheckReportItem, 'result'>>,
): VehicleCheckReportChecklistSummary {
  let ok = 0
  let defect = 0
  let na = 0
  for (const item of items) {
    if (item.result === 'Pass') ok += 1
    else if (item.result === 'Advisory') defect += 1
    else na += 1
  }
  return { ok, defect, na, total: items.length }
}

/**
 * Shared completed-check report grouping.
 * Never filters stored rows. Never alphabetises the whole checklist.
 */
export function groupVehicleCheckReportItems<T extends VehicleCheckReportItem>(
  items: T[],
): VehicleCheckReportModel<T> {
  type Bucket = {
    kind: VehicleCheckReportSectionKind
    title: string
    subtitle: string | null
    formCategory: string
    formAssetScope?: VehicleCheckAssetScope
    firstIndex: number
    entries: Array<{ item: T; originalIndex: number }>
  }

  const buckets = new Map<string, Bucket>()

  items.forEach((item, originalIndex) => {
    const classified = classifyReportItem(item)
    const existing = buckets.get(classified.bucketKey)
    if (existing) {
      existing.entries.push({ item, originalIndex })
      return
    }
    buckets.set(classified.bucketKey, {
      kind: classified.kind,
      title: classified.title,
      subtitle: classified.subtitle,
      formCategory: classified.formCategory,
      formAssetScope: classified.formAssetScope,
      firstIndex: originalIndex,
      entries: [{ item, originalIndex }],
    })
  })

  const sections = [...buckets.values()]
    .sort((left, right) => {
      const kindDelta =
        (KIND_RANK.get(left.kind) ?? 99) - (KIND_RANK.get(right.kind) ?? 99)
      if (kindDelta !== 0) return kindDelta
      return left.firstIndex - right.firstIndex
    })
    .map((bucket) => {
      const orderedItems = [...bucket.entries]
        .sort((left, right) => {
          const rankDelta =
            itemSortRank(left.item.itemName, left.originalIndex) -
            itemSortRank(right.item.itemName, right.originalIndex)
          if (rankDelta !== 0) return rankDelta
          return left.originalIndex - right.originalIndex
        })
        .map((entry) => entry.item)

      return {
        kind: bucket.kind,
        title: bucket.title,
        subtitle: bucket.subtitle,
        formCategory: bucket.formCategory,
        formAssetScope: bucket.formAssetScope,
        items: orderedItems,
      } satisfies VehicleCheckReportSection<T>
    })

  const numberedItems: Array<VehicleCheckReportNumberedItem<T>> = []
  let displayNumber = 0
  for (const section of sections) {
    for (const item of section.items) {
      displayNumber += 1
      numberedItems.push({ displayNumber, item, section })
    }
  }

  return {
    sections,
    numberedItems,
    summary: summarizeStoredItems(items),
  }
}

export function toVehicleChecklistSectionsFromReport<
  T extends VehicleCheckReportItem,
>(sections: Array<VehicleCheckReportSection<T>>): VehicleChecklistSection[] {
  return sections.map((section) => ({
    section: section.formCategory,
    itemNames: section.items.map((item) => item.itemName),
    assetScope: section.formAssetScope,
  }))
}

export function toVehicleCheckReportChecklistView<T extends VehicleCheckReportItem>(
  items: T[],
): {
  model: VehicleCheckReportModel<T>
  formItems: VehicleCheckItemInput[]
  formSections: VehicleChecklistSection[]
} {
  const model = groupVehicleCheckReportItems(items)
  const formItems: VehicleCheckItemInput[] = model.sections.flatMap((section) =>
    section.items.map((item) => ({
      category: section.formCategory,
      itemName: item.itemName,
      result: item.result,
      comment: item.comment ?? '',
      photoUrl: item.photoUrl,
      description: item.description,
      templateItem: item.templateItem,
      allowNotes: item.allowNotes ?? true,
      allowPhoto: item.allowPhoto ?? false,
      failOnDefect: item.failOnDefect ?? true,
      assetScope: section.formAssetScope ?? item.assetScope,
      isAnswered: true,
    })),
  )

  return {
    model,
    formItems,
    formSections: toVehicleChecklistSectionsFromReport(model.sections),
  }
}

function firstNonEmpty(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return null
}

export function getVehicleCheckReportIdentity(
  check: Pick<
    VehicleCheckListItem,
    | 'vehicleRegistration'
    | 'fleetNumber'
    | 'vehicleMake'
    | 'vehicleModel'
    | 'vehicleType'
    | 'workerName'
    | 'trailerSource'
    | 'vehicleRegistrationSnapshot'
    | 'vehicleFleetNumberSnapshot'
    | 'trailerNumberSnapshot'
    | 'trailerRegistrationSnapshot'
    | 'trailerTypeSnapshot'
    | 'trailerLabelSnapshot'
  >,
): VehicleCheckReportIdentity {
  const makeModel =
    [check.vehicleMake, check.vehicleModel].filter(Boolean).join(' ').trim() ||
    null

  const trailerSource = check.trailerSource
  const trailer: VehicleCheckReportTrailerIdentity | null =
    trailerSource === 'company' || trailerSource === 'third_party'
      ? {
          source: trailerSource,
          isThirdParty: trailerSource === 'third_party',
          number: firstNonEmpty(check.trailerNumberSnapshot, check.trailerLabelSnapshot),
          registration: firstNonEmpty(check.trailerRegistrationSnapshot),
          trailerType: firstNonEmpty(check.trailerTypeSnapshot),
          label: firstNonEmpty(check.trailerLabelSnapshot),
        }
      : null

  return {
    vehicle: {
      registration:
        firstNonEmpty(check.vehicleRegistrationSnapshot, check.vehicleRegistration) ??
        'Unknown',
      fleetNumber: firstNonEmpty(
        check.vehicleFleetNumberSnapshot,
        check.fleetNumber,
      ),
      makeModel,
      vehicleType: firstNonEmpty(check.vehicleType),
    },
    workerName: check.workerName,
    trailer,
  }
}

export function formatVehicleCheckReportAssetOwner(
  assetScope: VehicleCheckAssetScope | null | undefined,
): 'Vehicle' | 'Combination' | 'Trailer' {
  if (assetScope === 'trailer') return 'Trailer'
  if (assetScope === 'combination') return 'Combination'
  return 'Vehicle'
}

export function formatVehicleCheckReportDefectLabel(
  item: Pick<VehicleCheckReportItem, 'itemName' | 'assetScope'>,
): string {
  return `${formatVehicleCheckReportAssetOwner(item.assetScope)} — ${item.itemName}`
}

export function countVehicleCheckReportResults(
  items: Array<Pick<VehicleCheckReportItem, 'result'>>,
): VehicleCheckReportChecklistSummary {
  return summarizeStoredItems(items)
}

export function isVehicleCheckItemResult(
  value: string,
): value is VehicleCheckItemResult {
  return value === 'Pass' || value === 'Advisory' || value === 'Fail'
}

/** Test helper: section kinds in report order, omitting empty groups. */
export function getVehicleCheckReportSectionKinds(
  items: VehicleCheckReportItem[],
): VehicleCheckReportSectionKind[] {
  return groupVehicleCheckReportItems(items).sections.map((section) => section.kind)
}

export function getVehicleCheckReportItemNamesInOrder(
  items: VehicleCheckReportItem[],
): string[] {
  return groupVehicleCheckReportItems(items).numberedItems.map(
    (entry) => entry.item.itemName,
  )
}

export type VehicleCheckReportCheck = Pick<
  VehicleCheck,
  | 'items'
  | 'vehicleRegistration'
  | 'fleetNumber'
  | 'vehicleMake'
  | 'vehicleModel'
  | 'vehicleType'
  | 'workerName'
  | 'trailerSource'
  | 'vehicleRegistrationSnapshot'
  | 'vehicleFleetNumberSnapshot'
  | 'trailerNumberSnapshot'
  | 'trailerRegistrationSnapshot'
  | 'trailerTypeSnapshot'
  | 'trailerLabelSnapshot'
>
