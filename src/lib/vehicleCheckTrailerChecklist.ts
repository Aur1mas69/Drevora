import { getDefaultTrailerBaseCheckItems, TRAILER_CHECKLIST_SECTION } from '@/lib/defaultTrailerBaseCheckItems'
import {
  DREVORA_RECOMMENDED_SECTION,
  getDrevoraRecommendedCheckItems,
  getDrevoraRecommendedVehicleCheckItems,
  inferDrevoraRecommendedTrailerTypeFromLabels,
} from '@/lib/defaultDrevoraRecommendedCheckItems'
import { normalizeDvsaChecklistLabel } from '@/lib/defaultDvsaVehicleCheckItems'
import type { VehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'
import type {
  VehicleCheckAssetScope,
  VehicleCheckTrailerSource,
} from '@/lib/vehicleCheckTypes'

/**
 * DVSA 27 items whose physical trailer check is owned by Trailer Base
 * when a trailer is attached. Source file is not rewritten — filtered here.
 */
const DVSA_LABELS_REPLACED_BY_TRAILER_BASE = [
  'Brake lines and trailer parking brake',
  'Electrical connections',
] as const

/**
 * Trailer-only DVSA items hidden at runtime when no trailer is attached
 * (`trailer_source = 'none'`). Protected DVSA source stays 27.
 */
const DVSA_LABELS_HIDDEN_WHEN_NO_TRAILER = [
  'Brake lines and trailer parking brake',
  'Electrical connections',
  'Coupling security',
] as const

/** Existing DVSA 27 items that apply once to the whole tractor/trailer combination. */
const DVSA_COMBINATION_ITEM_LABELS = [
  'Brakes and air build-up',
  'Coupling security',
  'Security of load',
] as const

const TRAILER_BASE_SORT_OFFSET = 200
const DREVORA_RECOMMENDED_VEHICLE_SORT_OFFSET = 150
const DREVORA_RECOMMENDED_TRAILER_SORT_OFFSET = 300
/** Matches vehicleCheckTemplatesService extra-check sort_order threshold. */
const EXTRA_CHECKS_BASE_SORT_ORDER = 100

function labelKey(label: string): string {
  return normalizeDvsaChecklistLabel(label)
}

const replacedLabelKeys = new Set(
  DVSA_LABELS_REPLACED_BY_TRAILER_BASE.map((label) => labelKey(label)),
)

const noTrailerHiddenLabelKeys = new Set(
  DVSA_LABELS_HIDDEN_WHEN_NO_TRAILER.map((label) => labelKey(label)),
)

const combinationLabelKeys = new Set(
  DVSA_COMBINATION_ITEM_LABELS.map((label) => labelKey(label)),
)

function isCompanyCustomExtra(item: VehicleCheckTemplateItem): boolean {
  return item.isCustom || item.sortOrder > EXTRA_CHECKS_BASE_SORT_ORDER
}

function mapTrailerBaseToTemplateItems(): VehicleCheckTemplateItem[] {
  const createdAt = new Date().toISOString()
  return getDefaultTrailerBaseCheckItems().map((item, index) => ({
    id: `trailer-base-${index + 1}`,
    templateId: 'trailer-base',
    section: item.section,
    label: item.label,
    description: item.description,
    sortOrder: TRAILER_BASE_SORT_OFFSET + item.sortOrder,
    isRequired: item.isRequired,
    allowNotes: item.allowNotes,
    allowPhoto: item.allowPhoto,
    failOnDefect: item.failOnDefect,
    isActive: item.isActive,
    isCustom: item.isCustom,
    createdAt,
    assetScope: 'trailer' as const,
    source: 'trailer_base' as const,
  }))
}

function mapTrailerRecommendedToTemplateItems(
  trailerType: string | null | undefined,
): VehicleCheckTemplateItem[] {
  const createdAt = new Date().toISOString()
  return getDrevoraRecommendedCheckItems(trailerType).map((item, index) => ({
    id: `drevora-recommended-trailer-${index + 1}`,
    templateId: 'drevora-recommended',
    section: item.section,
    label: item.label,
    description: item.description,
    sortOrder: DREVORA_RECOMMENDED_TRAILER_SORT_OFFSET + item.sortOrder,
    isRequired: item.isRequired,
    allowNotes: item.allowNotes,
    allowPhoto: item.allowPhoto,
    failOnDefect: item.failOnDefect,
    isActive: item.isActive,
    isCustom: item.isCustom,
    createdAt,
    assetScope: 'trailer' as const,
    source: 'drevora_recommended' as const,
  }))
}

function mapPoweredRecommendedToTemplateItems(
  vehicleType: string | null | undefined,
): VehicleCheckTemplateItem[] {
  const createdAt = new Date().toISOString()
  return getDrevoraRecommendedVehicleCheckItems(vehicleType).map((item, index) => ({
    id: `drevora-recommended-vehicle-${index + 1}`,
    templateId: 'drevora-recommended',
    section: item.section,
    label: item.label,
    description: item.description,
    sortOrder: DREVORA_RECOMMENDED_VEHICLE_SORT_OFFSET + item.sortOrder,
    isRequired: item.isRequired,
    allowNotes: item.allowNotes,
    allowPhoto: item.allowPhoto,
    failOnDefect: item.failOnDefect,
    isActive: item.isActive,
    isCustom: item.isCustom,
    createdAt,
    assetScope: 'vehicle' as const,
    source: 'drevora_recommended' as const,
  }))
}

function scopeForDvsaItem(item: VehicleCheckTemplateItem): VehicleCheckAssetScope {
  if (item.assetScope) return item.assetScope
  if (combinationLabelKeys.has(labelKey(item.label))) return 'combination'
  return 'vehicle'
}

export type ComposeVehicleCheckTrailerOptions = {
  trailerAttached: boolean
  trailerSource?: VehicleCheckTrailerSource | null
  trailerType?: string | null
  /** Powered `vehicles.vehicle_type` — used for powered Recommended packs. */
  vehicleType?: string | null
}

export function composeOptionsFromExistingChecklistItems(
  items: Array<{ category?: string | null; itemName?: string | null; assetScope?: string | null }>,
): ComposeVehicleCheckTrailerOptions {
  const hasTrailer = items.some(
    (item) =>
      item.assetScope === 'trailer' || item.category === TRAILER_CHECKLIST_SECTION,
  )
  if (!hasTrailer) {
    return { trailerAttached: false }
  }

  const recommendedLabels = items
    .filter(
      (item) =>
        item.category === DREVORA_RECOMMENDED_SECTION && item.assetScope === 'trailer',
    )
    .map((item) => item.itemName?.trim() || '')
    .filter(Boolean)

  const trailerType = inferDrevoraRecommendedTrailerTypeFromLabels(recommendedLabels)

  return {
    trailerAttached: true,
    trailerSource: trailerType ? 'company' : 'third_party',
    trailerType,
  }
}

/**
 * Compose the live Vehicle Check list.
 *
 * No trailer (`trailer_source = 'none'`):
 * DVSA minus the 3 trailer-only items → powered DREVORA Recommended (if any)
 * → company extras. Protected DVSA source stays 27; runtime base is 24.
 *
 * Trailer attached:
 * Vehicle/Combination → powered Recommended → Trailer Base 11
 * → trailer Recommended (company + pack) → company extras.
 */
export function composeVehicleCheckTemplatesForTrailer(
  templates: VehicleCheckTemplateItem[],
  trailerAttachedOrOptions: boolean | ComposeVehicleCheckTrailerOptions,
): VehicleCheckTemplateItem[] {
  const options: ComposeVehicleCheckTrailerOptions =
    typeof trailerAttachedOrOptions === 'boolean'
      ? { trailerAttached: trailerAttachedOrOptions }
      : trailerAttachedOrOptions

  const extras = templates.filter(isCompanyCustomExtra)
  const basic = templates.filter((item) => !isCompanyCustomExtra(item))
  const poweredRecommended = mapPoweredRecommendedToTemplateItems(options.vehicleType)
  const companyExtras = extras.map((item) => ({
    ...item,
    assetScope: item.assetScope ?? 'vehicle',
    source: item.source ?? ('company_custom' as const),
  }))

  if (!options.trailerAttached) {
    return [
      ...basic
        .filter((item) => !noTrailerHiddenLabelKeys.has(labelKey(item.label)))
        .map((item) => ({
          ...item,
          assetScope: item.assetScope ?? 'vehicle',
          source: item.source ?? ('dvsa' as const),
        })),
      ...poweredRecommended,
      ...companyExtras,
    ]
  }

  const vehicleAndCombination = basic
    .filter((item) => !replacedLabelKeys.has(labelKey(item.label)))
    .map((item) => ({
      ...item,
      assetScope: scopeForDvsaItem(item),
      source: item.source ?? ('dvsa' as const),
    }))

  const trailerRecommended =
    options.trailerSource === 'company'
      ? mapTrailerRecommendedToTemplateItems(options.trailerType)
      : []

  return [
    ...vehicleAndCombination,
    ...poweredRecommended,
    ...mapTrailerBaseToTemplateItems(),
    ...trailerRecommended,
    ...companyExtras,
  ]
}
