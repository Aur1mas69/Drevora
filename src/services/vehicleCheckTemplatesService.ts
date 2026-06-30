import type {
  CreateVehicleCheckTemplateInput,
  UpdateVehicleCheckTemplateInput,
  VehicleCheckTemplate,
} from '@/lib/vehicleCheckTemplateTypes'
import { supabase } from '@/lib/supabase'

type VehicleCheckTemplateRow = {
  id: string
  created_at: string
  vehicle_type: string
  section: string
  item_name: string
  sort_order: number
  is_required: boolean
  is_active: boolean
}

const templateSelect = `
  id,
  created_at,
  vehicle_type,
  section,
  item_name,
  sort_order,
  is_required,
  is_active
`

export class VehicleCheckTemplatesServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleCheckTemplatesServiceError'
  }
}

function mapRow(row: VehicleCheckTemplateRow): VehicleCheckTemplate {
  return {
    id: row.id,
    createdAt: row.created_at,
    vehicleType: row.vehicle_type,
    section: row.section,
    itemName: row.item_name,
    sortOrder: row.sort_order,
    isRequired: row.is_required,
    isActive: row.is_active,
  }
}

export async function fetchTemplatesByVehicleType(
  vehicleType: string,
): Promise<VehicleCheckTemplate[]> {
  const normalizedType = vehicleType.trim()
  if (!normalizedType) return []

  const { data, error } = await supabase
    .from('vehicle_check_templates')
    .select(templateSelect)
    .eq('vehicle_type', normalizedType)
    .eq('is_active', true)
    .order('section', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('item_name', { ascending: true })

  if (error) {
    throw new VehicleCheckTemplatesServiceError(error.message)
  }

  return ((data ?? []) as unknown as VehicleCheckTemplateRow[]).map(mapRow)
}

export async function fetchActiveTemplates(): Promise<VehicleCheckTemplate[]> {
  const { data, error } = await supabase
    .from('vehicle_check_templates')
    .select(templateSelect)
    .eq('is_active', true)
    .order('vehicle_type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('section', { ascending: true })
    .order('item_name', { ascending: true })

  if (error) {
    throw new VehicleCheckTemplatesServiceError(error.message)
  }

  return ((data ?? []) as unknown as VehicleCheckTemplateRow[]).map(mapRow)
}

export async function createTemplateItem(
  input: CreateVehicleCheckTemplateInput,
): Promise<VehicleCheckTemplate> {
  const vehicleType = input.vehicleType.trim()
  const section = input.section.trim()
  const itemName = input.itemName.trim()

  if (!vehicleType || !section || !itemName) {
    throw new VehicleCheckTemplatesServiceError(
      'Vehicle type, section, and item name are required.',
    )
  }

  const { data, error } = await supabase
    .from('vehicle_check_templates')
    .insert({
      vehicle_type: vehicleType,
      section,
      item_name: itemName,
      sort_order: input.sortOrder ?? 0,
      is_required: input.isRequired ?? true,
      is_active: input.isActive ?? true,
    })
    .select(templateSelect)
    .single()

  if (error) {
    throw new VehicleCheckTemplatesServiceError(error.message)
  }

  return mapRow(data as unknown as VehicleCheckTemplateRow)
}

export async function updateTemplateItem(
  id: string,
  input: UpdateVehicleCheckTemplateInput,
): Promise<VehicleCheckTemplate> {
  const patch: Record<string, unknown> = {}

  if (input.vehicleType !== undefined) patch.vehicle_type = input.vehicleType.trim()
  if (input.section !== undefined) patch.section = input.section.trim()
  if (input.itemName !== undefined) patch.item_name = input.itemName.trim()
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder
  if (input.isRequired !== undefined) patch.is_required = input.isRequired
  if (input.isActive !== undefined) patch.is_active = input.isActive

  const { data, error } = await supabase
    .from('vehicle_check_templates')
    .update(patch)
    .eq('id', id)
    .select(templateSelect)
    .single()

  if (error) {
    throw new VehicleCheckTemplatesServiceError(error.message)
  }

  return mapRow(data as unknown as VehicleCheckTemplateRow)
}

export async function deleteTemplateItem(id: string): Promise<void> {
  const { error } = await supabase.from('vehicle_check_templates').delete().eq('id', id)

  if (error) {
    throw new VehicleCheckTemplatesServiceError(error.message)
  }
}

export const vehicleCheckTemplatesService = {
  fetchTemplatesByVehicleType,
  fetchActiveTemplates,
  createTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
}
