import type { VehicleCheckItemInput, VehicleChecklistSection } from '@/lib/vehicleCheckTypes'
import {
  createChecklistItemsFromTemplates,
  groupTemplatesBySection,
  mergeChecklistWithExistingItems,
} from '@/lib/vehicleCheckUtils'
import { fetchTemplatesByVehicleType } from '@/services/vehicleCheckTemplatesService'
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

export const TEMPLATE_LOAD_ERROR_MESSAGE =
  'Unable to load vehicle check template. Please try again.'

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

  let templates
  try {
    templates = await fetchTemplatesByVehicleType(vehicleType)
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : TEMPLATE_LOAD_ERROR_MESSAGE
    throw new Error(message)
  }

  if (templates.length === 0) {
    return {
      items: [],
      sections: [],
      status: 'missing_template',
      notice: NO_TEMPLATE_MESSAGE,
    }
  }

  return {
    items: existingItems
      ? mergeChecklistWithExistingItems(templates, existingItems)
      : createChecklistItemsFromTemplates(templates),
    sections: groupTemplatesBySection(templates),
    status: 'ready',
    notice: null,
  }
}

export function canSubmitVehicleChecklist(
  status: VehicleChecklistLoadStatus,
  items: VehicleCheckItemInput[],
): boolean {
  return status === 'ready' && items.length > 0
}
