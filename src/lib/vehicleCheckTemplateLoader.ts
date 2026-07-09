import type { VehicleCheckItemInput, VehicleChecklistSection } from '@/lib/vehicleCheckTypes'
import type { DefaultVehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'
import type { VehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'
import {
  createChecklistItemsFromTemplates,
  groupTemplatesBySection,
  isChecklistFullyAnswered,
  mergeChecklistWithExistingItems,
} from '@/lib/vehicleCheckUtils'
import {
  fetchTemplateItemsByVehicleType,
  getDefaultVehicleCheckItems,
} from '@/services/vehicleCheckTemplatesService'
import { fetchVehicleTypeById } from '@/services/vehiclesService'

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
  return label.trim().toLowerCase()
}

function mergeBasicAndExtraChecklistTemplates(
  dbTemplates: VehicleCheckTemplateItem[],
): VehicleCheckTemplateItem[] {
  const basicFallback = mapDefaultItemsToTemplateItems(getDefaultVehicleCheckItems())
  const dbBasicItems = dbTemplates.filter((item) => !isExtraCheckTemplateItem(item))
  const dbExtraItems = dbTemplates.filter(isExtraCheckTemplateItem)

  const basicItems = dbBasicItems.length > 0 ? dbBasicItems : basicFallback

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

export async function loadVehicleChecklist(
  vehicleId: string,
  vehicleTypeHint: string | null | undefined,
  existingItems?: VehicleCheckItemInput[],
): Promise<LoadedVehicleChecklist> {
  const vehicleType = vehicleTypeHint?.trim() || (await fetchVehicleTypeById(vehicleId))

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
    dbTemplates = await fetchTemplateItemsByVehicleType(vehicleType)
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : TEMPLATE_LOAD_ERROR_MESSAGE
    throw new Error(message)
  }

  const templates = mergeBasicAndExtraChecklistTemplates(dbTemplates)
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
