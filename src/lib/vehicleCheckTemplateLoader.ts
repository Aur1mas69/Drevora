import type {
  VehicleCheckItemInput,
  VehicleCheckTrailerSource,
  VehicleChecklistSection,
} from '@/lib/vehicleCheckTypes'
import type { DefaultVehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'
import type { VehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'
import {
  findDefaultDvsaItemByLabel,
  getDefaultDvsaVehicleCheckItems,
  normalizeDvsaChecklistLabel,
} from '@/lib/defaultDvsaVehicleCheckItems'
import {
  createChecklistItemsFromTemplates,
  groupTemplatesBySection,
  isChecklistFullyAnswered,
  mergeChecklistWithExistingItems,
} from '@/lib/vehicleCheckUtils'
import { getOnlineStatus } from '@/lib/networkStatus'
import { WORKER_OFFLINE_BOOTSTRAP_FETCH_TIMEOUT_MS } from '@/lib/workerOfflineBootstrap/types'
import {
  fetchTemplateItemsByVehicleType,
  getDefaultVehicleCheckItems,
} from '@/services/vehicleCheckTemplatesService'
import { fetchVehicleTypeById } from '@/services/vehiclesService'
import { composeVehicleCheckTemplatesForTrailer } from '@/lib/vehicleCheckTrailerChecklist'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('TEMPLATE_FETCH_TIMEOUT'))
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export type VehicleChecklistLoadStatus =
  | 'ready'
  | 'missing_vehicle_type'
  | 'missing_template'

export type LoadedVehicleChecklist = {
  items: VehicleCheckItemInput[]
  sections: VehicleChecklistSection[]
  status: VehicleChecklistLoadStatus
  notice: string | null
}

export const NO_VEHICLE_TYPE_MESSAGE =
  'This vehicle has no vehicle type assigned. Please edit the vehicle and select a vehicle type.'

export const NO_TEMPLATE_MESSAGE = 'No check template found for this vehicle type.'

export const DVSA_FALLBACK_NOTICE =
  'No saved template for this vehicle type. Using the standard DVSA walkaround checklist.'

export const TEMPLATE_LOAD_ERROR_MESSAGE =
  'Unable to load vehicle check template. Please try again.'

/** Matches vehicleCheckTemplatesService extra-check sort_order threshold. */
const EXTRA_CHECKS_BASE_SORT_ORDER = 100

function mapDefaultItemsToTemplateItems(
  items: DefaultVehicleCheckTemplateItem[],
): VehicleCheckTemplateItem[] {
  return items.map((item, index) => ({
    id: `dvsa-fallback-${index}`,
    templateId: 'dvsa-fallback',
    section: item.section,
    label: item.label,
    description: item.description,
    sortOrder: item.sortOrder,
    isRequired: item.isRequired,
    allowNotes: item.allowNotes,
    allowPhoto: item.allowPhoto,
    failOnDefect: item.failOnDefect,
    isActive: item.isActive,
    isCustom: item.isCustom,
    createdAt: new Date().toISOString(),
  }))
}

function isExtraCheckTemplateItem(item: VehicleCheckTemplateItem): boolean {
  return item.isCustom || item.sortOrder > EXTRA_CHECKS_BASE_SORT_ORDER
}

function normalizeTemplateItemLabel(label: string): string {
  return normalizeDvsaChecklistLabel(label)
}

function looksLikeDvsaBasicChecklist(items: VehicleCheckTemplateItem[]): boolean {
  if (items.length < 20) return false
  const labels = items.map((item) => normalizeTemplateItemLabel(item.label))
  return (
    labels.some((label) => label.includes('front view')) &&
    labels.some((label) => label.includes('tyres and wheel')) &&
    labels.some((label) => label.includes('security of load'))
  )
}

function enrichDvsaGuidanceOnItems(
  items: VehicleCheckTemplateItem[],
): VehicleCheckTemplateItem[] {
  return items.map((item) => {
    const existing = item.description?.trim()
    if (existing) return item

    const matched =
      findDefaultDvsaItemByLabel(item.label) ??
      getDefaultDvsaVehicleCheckItems().find((entry) => entry.sortOrder === item.sortOrder)

    if (!matched) return item

    return {
      ...item,
      section: matched.section,
      label: matched.label,
      description: matched.description,
      sortOrder: matched.sortOrder,
    }
  })
}

function mergeBasicAndExtraChecklistTemplates(
  dbTemplates: VehicleCheckTemplateItem[],
): VehicleCheckTemplateItem[] {
  const basicFallback = mapDefaultItemsToTemplateItems(getDefaultVehicleCheckItems())
  const dbBasicItems = dbTemplates.filter((item) => !isExtraCheckTemplateItem(item))
  const dbExtraItems = dbTemplates.filter(isExtraCheckTemplateItem)

  const shouldUseFallback =
    dbBasicItems.length === 0 ||
    (!looksLikeDvsaBasicChecklist(dbBasicItems) &&
      dbBasicItems.every((item) => !item.description?.trim()))

  const basicItems = shouldUseFallback
    ? basicFallback
    : enrichDvsaGuidanceOnItems(dbBasicItems)

  const basicLabels = new Set(basicItems.map((item) => normalizeTemplateItemLabel(item.label)))
  const uniqueExtraItems = dbExtraItems.filter(
    (item) => !basicLabels.has(normalizeTemplateItemLabel(item.label)),
  )

  return [...basicItems, ...uniqueExtraItems]
}

function buildChecklistFromTemplates(
  templates: VehicleCheckTemplateItem[],
  existingItems?: VehicleCheckItemInput[],
  notice: string | null = null,
): LoadedVehicleChecklist {
  return {
    items: existingItems
      ? mergeChecklistWithExistingItems(templates, existingItems)
      : createChecklistItemsFromTemplates(templates),
    sections: groupTemplatesBySection(templates),
    status: 'ready',
    notice,
  }
}

export type LoadVehicleChecklistOptions = {
  /**
   * Offline bootstrap template rows for this vehicle type.
   * When the live template fetch fails offline, these are used instead of throwing.
   * Pass an empty array to allow the existing DVSA merge fallback.
   */
  offlineTemplateItems?: VehicleCheckTemplateItem[] | null
  /** When true, append Trailer Base 11 and apply trailer/combination scoping. */
  trailerAttached?: boolean
  /** Company vs third-party. Recommended packs apply to company trailers only. */
  trailerSource?: VehicleCheckTrailerSource | null
  /** `vehicles.trailer_type` of the selected company trailer. */
  trailerType?: string | null
}

export async function loadVehicleChecklist(
  vehicleId: string,
  vehicleTypeHint: string | null | undefined,
  existingItems?: VehicleCheckItemInput[],
  options?: LoadVehicleChecklistOptions,
): Promise<LoadedVehicleChecklist> {
  let vehicleType = vehicleTypeHint?.trim() || null
  if (!vehicleType) {
    try {
      vehicleType = (await fetchVehicleTypeById(vehicleId))?.trim() || null
    } catch {
      vehicleType = null
    }
  }

  if (!vehicleType) {
    return {
      items: [],
      sections: [],
      status: 'missing_vehicle_type',
      notice: NO_VEHICLE_TYPE_MESSAGE,
    }
  }

  let dbTemplates: VehicleCheckTemplateItem[] = []
  try {
    // Bound the live fetch — native Network often reports "connected" while
    // Supabase hangs, which previously left Vehicle Check on a spinner forever.
    dbTemplates = await withTimeout(
      fetchTemplateItemsByVehicleType(vehicleType),
      WORKER_OFFLINE_BOOTSTRAP_FETCH_TIMEOUT_MS,
    )
  } catch (error) {
    const offlineItems = options?.offlineTemplateItems
    // Prefer prepared bootstrap rows whenever the caller supplied them (including
    // false-"online" offline cold starts). Empty array → DVSA merge below.
    if (offlineItems != null) {
      dbTemplates = offlineItems
    } else if (!(await getOnlineStatus())) {
      // No prepared cache for this type — still allow DVSA walkaround offline.
      dbTemplates = []
    } else {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : TEMPLATE_LOAD_ERROR_MESSAGE
      throw new Error(message)
    }
  }

  const templates = composeVehicleCheckTemplatesForTrailer(
    mergeBasicAndExtraChecklistTemplates(dbTemplates),
    {
      trailerAttached: options?.trailerAttached === true,
      trailerSource: options?.trailerSource,
      trailerType: options?.trailerType,
      vehicleType,
    },
  )
  const notice = dbTemplates.length === 0 ? DVSA_FALLBACK_NOTICE : null

  return buildChecklistFromTemplates(templates, existingItems, notice)
}

export function canSubmitVehicleChecklist(
  status: VehicleChecklistLoadStatus,
  items: VehicleCheckItemInput[],
  sections?: VehicleChecklistSection[],
): boolean {
  return status === 'ready' && isChecklistFullyAnswered(items, sections)
}
