import type {
  CreateVehicleCheckTemplateInput,
  CreateVehicleCheckTemplateItemInput,
  DefaultVehicleCheckTemplateItem,
  UpdateVehicleCheckTemplateInput,
  UpdateVehicleCheckTemplateItemInput,
  VehicleCheckTemplate,
  VehicleCheckTemplateItem,
  VehicleCheckTemplateWithItems,
} from '@/lib/vehicleCheckTemplateTypes'
import { requireSupabase } from '@/lib/supabase'

export const VEHICLE_CHECK_TEMPLATE_ITEMS_TABLE = 'vehicle_check_template_items'
export const VEHICLE_CHECK_TEMPLATES_TABLE = 'vehicle_check_templates'

type VehicleCheckTemplateRow = {
  id: string
  company: string | null
  name: string
  vehicle_type: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type VehicleCheckTemplateItemRow = {
  id: string
  template_id: string
  section: string
  label: string
  description: string | null
  sort_order: number
  is_required: boolean
  allow_notes: boolean
  allow_photo: boolean
  fail_on_defect: boolean
  is_active: boolean
  is_custom: boolean
  created_at: string
}

type VehicleCheckTemplateItemWithTemplateJoinRow = VehicleCheckTemplateItemRow & {
  vehicle_check_templates: {
    id: string
    company: string | null
    vehicle_type: string | null
    is_active: boolean
  }
}

const templateSelect = `
  id,
  company,
  name,
  vehicle_type,
  description,
  is_active,
  created_at,
  updated_at
`

const templateItemSelect = `
  id,
  template_id,
  section,
  label,
  description,
  sort_order,
  is_required,
  allow_notes,
  allow_photo,
  fail_on_defect,
  is_active,
  is_custom,
  created_at
`

const templateItemWithTemplateSelect = `
  ${templateItemSelect.trim()},
  vehicle_check_templates!inner (
    id,
    company,
    vehicle_type,
    is_active
  )
`

export class VehicleCheckTemplatesServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleCheckTemplatesServiceError'
  }
}

const DEFAULT_VEHICLE_CHECK_ITEMS: DefaultVehicleCheckTemplateItem[] = [
  {
    section: 'Inside cab / front view',
    label: 'Front view, mirrors, cameras and glass',
    description:
      'Check nothing obstructs the front view. Check windscreen, side windows, mirrors and camera systems are clean, secure, working and not cracked, damaged, missing, obscured or excessively tinted.',
    sortOrder: 1,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Inside cab / front view',
    label: 'Windscreen wipers and washers',
    description:
      'Check wipers work and are not missing, damaged or worn. Check the washer system works.',
    sortOrder: 2,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Inside cab / front view',
    label: 'Dashboard warning lights and gauges',
    description:
      'Check instruments, gauges and warning lights work correctly, including engine warning, emissions system, ABS and EBS where fitted.',
    sortOrder: 3,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Inside cab / front view',
    label: 'Steering',
    description:
      'Check steering works correctly, power-assisted steering works, no excessive play, no jamming and no excessive lift or movement in the steering column.',
    sortOrder: 4,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Inside cab / front view',
    label: 'Horn',
    description: 'Check the horn works and is easily accessible from the seat.',
    sortOrder: 5,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Inside cab / front view',
    label: 'Brakes and air build-up',
    description:
      'Check air builds up correctly, warning system works, there are no air leaks, footwell is clear, service brake works, parking brake works and brake pedal condition is safe.',
    sortOrder: 6,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Inside cab / front view',
    label: 'Height marker',
    description: 'Check the correct vehicle height is displayed in the cab.',
    sortOrder: 7,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Inside cab / front view',
    label: 'Seatbelts',
    description:
      'Check seatbelts are not cut, damaged or frayed, stay secure when plugged in and retract correctly.',
    sortOrder: 8,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Inside cab / front view',
    label: 'Cab, doors and steps',
    description:
      'Check cab mountings, tilt devices, body panels, doors and steps are secure and safe to use.',
    sortOrder: 9,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Lights and indicators',
    description:
      'Check all lights and indicators work correctly. Check lenses are fitted, clean and the correct colour. Check stop lamps and marker lights work.',
    sortOrder: 10,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Fuel and oil leaks',
    description:
      'Check the fuel filler cap is fitted correctly. With the engine on, check underneath the vehicle for fuel or oil leaks.',
    sortOrder: 11,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Body, wings and guards security',
    description:
      'Check fastening devices, cab doors, trailer doors, body panels, landing legs if fitted, sideguards and rear under-run guards are secure and not damaged.',
    sortOrder: 12,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Battery security and condition',
    description: 'Check the battery is secure, in good condition and not leaking.',
    sortOrder: 13,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Diesel exhaust fluid / AdBlue',
    description: 'Check the diesel vehicle has enough AdBlue and top up if necessary.',
    sortOrder: 14,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Excessive engine exhaust smoke',
    description: 'Check the exhaust does not emit an excessive amount of smoke.',
    sortOrder: 15,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'High voltage emergency cut-off switch',
    description:
      'For electric or hybrid vehicles, check you know where the cut-off switch is located, it operates correctly and high voltage components are secure and not damaged.',
    sortOrder: 16,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Alternative fuel systems and isolation',
    description:
      'Check you know where the fuel isolation switch is located, there are no leaks and visible components are in good condition.',
    sortOrder: 17,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Spray suppression',
    description:
      'Check spray suppression flaps are fitted where required, secure, not damaged and not clogged with mud or debris.',
    sortOrder: 18,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Tyres and wheel fixing',
    description:
      'Check tyres and wheels are secure, tyre tread depth is at least 1mm, tyres are inflated correctly, there are no deep cuts, no visible cord, wheel nuts are tight and no debris is trapped between twin wheels.',
    sortOrder: 19,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Brake lines and trailer parking brake',
    description:
      'Check couplings are free from debris and correctly positioned, there are no leaks, brake lines are not damaged or worn and the trailer parking brake works.',
    sortOrder: 20,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Electrical connections',
    description:
      'Check visible wiring is insulated and safe, wiring is not likely to get caught or damaged, trailer electrical couplings are secure and switches work correctly.',
    sortOrder: 21,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Coupling security',
    description:
      'Check the vehicle and trailer are securely attached, trailer is correctly located in the fifth wheel or coupling and secondary locking devices are in the correct position.',
    sortOrder: 22,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Security of load',
    description: 'Check the load is secure and not likely to move. If unsafe, escalate before driving.',
    sortOrder: 23,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Number plate',
    description:
      'Check the number plate is not broken, incomplete, incorrect, badly spaced, dirty, faded or covered.',
    sortOrder: 24,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Reflectors',
    description:
      'Check reflectors are present, secure, not broken, correct colour and not obscured by dirt or other objects.',
    sortOrder: 25,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Markings and warning plates',
    description:
      'Check vehicle markings, including conspicuity markings, are the right colour, visible, securely fastened and not obscured by dirt or other objects. If carrying dangerous goods, check hazard information panels show the correct information, are visible, securely fastened and not obscured.',
    sortOrder: 26,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
  {
    section: 'Outside vehicle',
    label: 'Other equipment',
    description: 'Check any extra equipment specific to the vehicle, body or operation.',
    sortOrder: 27,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: false,
  },
]

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function getDefaultVehicleCheckItems(): DefaultVehicleCheckTemplateItem[] {
  return DEFAULT_VEHICLE_CHECK_ITEMS.map((item) => ({ ...item }))
}

function mapTemplateRow(row: VehicleCheckTemplateRow): VehicleCheckTemplate {
  return {
    id: row.id,
    company: row.company,
    name: row.name,
    vehicleType: row.vehicle_type,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTemplateItemRow(row: VehicleCheckTemplateItemRow): VehicleCheckTemplateItem {
  return {
    id: row.id,
    templateId: row.template_id,
    section: row.section,
    label: row.label,
    description: row.description,
    sortOrder: row.sort_order,
    isRequired: row.is_required,
    allowNotes: row.allow_notes,
    allowPhoto: row.allow_photo,
    failOnDefect: row.fail_on_defect,
    isActive: row.is_active,
    isCustom: row.is_custom,
    createdAt: row.created_at,
  }
}

function assertTemplateAccess(
  template: VehicleCheckTemplate | null,
  company?: string | null,
): VehicleCheckTemplate | null {
  if (!template) return null
  const normalizedCompany = normalizeOptionalText(company)
  if (!normalizedCompany) return template.company === null ? template : null
  return template.company === null || template.company === normalizedCompany ? template : null
}

async function fetchCompanyTemplates(company?: string | null): Promise<VehicleCheckTemplate[]> {
  const normalizedCompany = normalizeOptionalText(company)

  if (!normalizedCompany) {
    const { data, error } = await requireSupabase()
      .from(VEHICLE_CHECK_TEMPLATES_TABLE)
      .select(templateSelect)
      .is('company', null)
      .order('name', { ascending: true })

    if (error) throw new VehicleCheckTemplatesServiceError(error.message)
    return ((data ?? []) as unknown as VehicleCheckTemplateRow[]).map(mapTemplateRow)
  }

  const [companyResult, globalResult] = await Promise.all([
    requireSupabase()
      .from(VEHICLE_CHECK_TEMPLATES_TABLE)
      .select(templateSelect)
      .eq('company', normalizedCompany)
      .order('name', { ascending: true }),
    requireSupabase()
      .from(VEHICLE_CHECK_TEMPLATES_TABLE)
      .select(templateSelect)
      .is('company', null)
      .order('name', { ascending: true }),
  ])

  if (companyResult.error) {
    throw new VehicleCheckTemplatesServiceError(companyResult.error.message)
  }
  if (globalResult.error) {
    throw new VehicleCheckTemplatesServiceError(globalResult.error.message)
  }

  const rows = [
    ...((companyResult.data ?? []) as unknown as VehicleCheckTemplateRow[]),
    ...((globalResult.data ?? []) as unknown as VehicleCheckTemplateRow[]),
  ]
  const seen = new Set<string>()
  return rows
    .filter((row) => {
      if (seen.has(row.id)) return false
      seen.add(row.id)
      return true
    })
    .map(mapTemplateRow)
}

export async function listVehicleCheckTemplates(
  company?: string | null,
): Promise<VehicleCheckTemplate[]> {
  return fetchCompanyTemplates(company)
}

export async function getVehicleCheckTemplate(
  templateId: string,
  company?: string | null,
): Promise<VehicleCheckTemplateWithItems | null> {
  const { data, error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATES_TABLE)
    .select(templateSelect)
    .eq('id', templateId)
    .maybeSingle()

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)

  const template = assertTemplateAccess(
    data ? mapTemplateRow(data as unknown as VehicleCheckTemplateRow) : null,
    company,
  )
  if (!template) return null

  const items = await listTemplateItems(template.id)
  return { ...template, items }
}

export async function createVehicleCheckTemplate(
  payload: CreateVehicleCheckTemplateInput,
): Promise<VehicleCheckTemplate> {
  const name = payload.name.trim()
  if (!name) {
    throw new VehicleCheckTemplatesServiceError('Template name is required.')
  }

  const { data, error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATES_TABLE)
    .insert({
      company: normalizeOptionalText(payload.company),
      name,
      vehicle_type: normalizeOptionalText(payload.vehicleType),
      description: normalizeOptionalText(payload.description),
      is_active: payload.isActive ?? true,
    })
    .select(templateSelect)
    .single()

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)
  return mapTemplateRow(data as unknown as VehicleCheckTemplateRow)
}

async function findTemplateByCompanyAndVehicleType(
  company?: string | null,
  vehicleType?: string | null,
): Promise<VehicleCheckTemplate | null> {
  const normalizedCompany = normalizeOptionalText(company)
  const normalizedVehicleType = normalizeOptionalText(vehicleType)
  let request = requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATES_TABLE)
    .select(templateSelect)
    .limit(1)

  request = normalizedCompany
    ? request.eq('company', normalizedCompany)
    : request.is('company', null)

  request = normalizedVehicleType
    ? request.eq('vehicle_type', normalizedVehicleType)
    : request.is('vehicle_type', null)

  const { data, error } = await request.maybeSingle()
  if (error) throw new VehicleCheckTemplatesServiceError(error.message)

  return data ? mapTemplateRow(data as unknown as VehicleCheckTemplateRow) : null
}

export async function createDefaultVehicleCheckTemplate(
  company: string | null | undefined,
  vehicleType: string | null | undefined,
  name: string,
): Promise<VehicleCheckTemplateWithItems> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new VehicleCheckTemplatesServiceError('Template name is required.')
  }

  const existing = await findTemplateByCompanyAndVehicleType(company, vehicleType)
  if (existing) {
    throw new VehicleCheckTemplatesServiceError(
      'A vehicle check template already exists for this company and vehicle type.',
    )
  }

  const template = await createVehicleCheckTemplate({
    company,
    name: trimmedName,
    vehicleType,
    description: 'Default DREVORA DVSA-style daily vehicle check template.',
    isActive: true,
  })

  const rows = getDefaultVehicleCheckItems().map((item) => ({
    template_id: template.id,
    section: item.section,
    label: item.label,
    description: item.description,
    sort_order: item.sortOrder,
    is_required: item.isRequired,
    allow_notes: item.allowNotes,
    allow_photo: item.allowPhoto,
    fail_on_defect: item.failOnDefect,
    is_active: item.isActive,
    is_custom: item.isCustom,
  }))

  const { data, error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATE_ITEMS_TABLE)
    .insert(rows)
    .select(templateItemSelect)

  if (error) {
    await requireSupabase()
      .from(VEHICLE_CHECK_TEMPLATES_TABLE)
      .delete()
      .eq('id', template.id)
    throw new VehicleCheckTemplatesServiceError(error.message)
  }

  const items = ((data ?? []) as unknown as VehicleCheckTemplateItemRow[])
    .map(mapTemplateItemRow)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return { ...template, items }
}

export async function updateVehicleCheckTemplate(
  templateId: string,
  payload: UpdateVehicleCheckTemplateInput,
  company?: string | null,
): Promise<VehicleCheckTemplate> {
  const existing = await getVehicleCheckTemplate(templateId, company)
  if (!existing) {
    throw new VehicleCheckTemplatesServiceError('Template not found.')
  }

  const patch: Record<string, unknown> = {}
  if (payload.company !== undefined) patch.company = normalizeOptionalText(payload.company)
  if (payload.name !== undefined) {
    const name = payload.name.trim()
    if (!name) throw new VehicleCheckTemplatesServiceError('Template name is required.')
    patch.name = name
  }
  if (payload.vehicleType !== undefined) {
    patch.vehicle_type = normalizeOptionalText(payload.vehicleType)
  }
  if (payload.description !== undefined) {
    patch.description = normalizeOptionalText(payload.description)
  }
  if (payload.isActive !== undefined) patch.is_active = payload.isActive

  const { data, error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATES_TABLE)
    .update(patch)
    .eq('id', templateId)
    .select(templateSelect)
    .single()

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)
  return mapTemplateRow(data as unknown as VehicleCheckTemplateRow)
}

export async function deleteVehicleCheckTemplate(
  templateId: string,
  company?: string | null,
): Promise<void> {
  const existing = await getVehicleCheckTemplate(templateId, company)
  if (!existing) {
    throw new VehicleCheckTemplatesServiceError('Template not found.')
  }

  const { error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATES_TABLE)
    .delete()
    .eq('id', templateId)

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)
}

export async function listTemplateItems(templateId: string): Promise<VehicleCheckTemplateItem[]> {
  const { data, error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATE_ITEMS_TABLE)
    .select(templateItemSelect)
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })
    .order('section', { ascending: true })
    .order('label', { ascending: true })

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)
  return ((data ?? []) as unknown as VehicleCheckTemplateItemRow[]).map(mapTemplateItemRow)
}

export async function createTemplateItem(
  payload: CreateVehicleCheckTemplateItemInput,
): Promise<VehicleCheckTemplateItem> {
  const section = payload.section.trim()
  const label = payload.label.trim()

  if (!payload.templateId || !section || !label) {
    throw new VehicleCheckTemplatesServiceError('Template, section and item label are required.')
  }

  const { data, error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATE_ITEMS_TABLE)
    .insert({
      template_id: payload.templateId,
      section,
      label,
      description: normalizeOptionalText(payload.description),
      sort_order: payload.sortOrder ?? 0,
      is_required: payload.isRequired ?? true,
      allow_notes: payload.allowNotes ?? true,
      allow_photo: payload.allowPhoto ?? false,
      fail_on_defect: payload.failOnDefect ?? true,
      is_active: payload.isActive ?? true,
      is_custom: payload.isCustom ?? false,
    })
    .select(templateItemSelect)
    .single()

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)
  return mapTemplateItemRow(data as unknown as VehicleCheckTemplateItemRow)
}

export async function updateTemplateItem(
  itemId: string,
  payload: UpdateVehicleCheckTemplateItemInput,
): Promise<VehicleCheckTemplateItem> {
  const patch: Record<string, unknown> = {}
  if (payload.templateId !== undefined) patch.template_id = payload.templateId
  if (payload.section !== undefined) patch.section = payload.section.trim()
  if (payload.label !== undefined) {
    const label = payload.label.trim()
    if (!label) throw new VehicleCheckTemplatesServiceError('Item label is required.')
    patch.label = label
  }
  if (payload.description !== undefined) {
    patch.description = normalizeOptionalText(payload.description)
  }
  if (payload.sortOrder !== undefined) patch.sort_order = payload.sortOrder
  if (payload.isRequired !== undefined) patch.is_required = payload.isRequired
  if (payload.allowNotes !== undefined) patch.allow_notes = payload.allowNotes
  if (payload.allowPhoto !== undefined) patch.allow_photo = payload.allowPhoto
  if (payload.failOnDefect !== undefined) patch.fail_on_defect = payload.failOnDefect
  if (payload.isActive !== undefined) patch.is_active = payload.isActive
  if (payload.isCustom !== undefined) patch.is_custom = payload.isCustom

  const { data, error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATE_ITEMS_TABLE)
    .update(patch)
    .eq('id', itemId)
    .select(templateItemSelect)
    .single()

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)
  return mapTemplateItemRow(data as unknown as VehicleCheckTemplateItemRow)
}

export async function deleteTemplateItem(itemId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATE_ITEMS_TABLE)
    .delete()
    .eq('id', itemId)

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)
}

export async function fetchTemplateItemsByVehicleType(
  vehicleType: string,
  company?: string | null,
): Promise<VehicleCheckTemplateItem[]> {
  const normalizedType = normalizeOptionalText(vehicleType)
  if (!normalizedType) return []

  const normalizedCompany = normalizeOptionalText(company)
  const { data, error } = await requireSupabase()
    .from(VEHICLE_CHECK_TEMPLATE_ITEMS_TABLE)
    .select(templateItemWithTemplateSelect)
    .eq('is_active', true)
    .eq('vehicle_check_templates.is_active', true)

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)

  const byTemplateId = new Map<
    string,
    { company: string | null; items: VehicleCheckTemplateItemRow[] }
  >()

  for (const row of (data ?? []) as unknown as VehicleCheckTemplateItemWithTemplateJoinRow[]) {
    const template = row.vehicle_check_templates
    const templateVehicleType = template.vehicle_type?.trim().toLowerCase()
    if (templateVehicleType !== normalizedType.toLowerCase()) continue

    const bucket = byTemplateId.get(template.id) ?? {
      company: template.company,
      items: [],
    }
    const { vehicle_check_templates: _template, ...itemRow } = row
    bucket.items.push(itemRow)
    byTemplateId.set(template.id, bucket)
  }

  const templateBuckets = [...byTemplateId.values()]
  const selectedBucket =
    (normalizedCompany
      ? templateBuckets.find((bucket) => bucket.company === normalizedCompany)
      : undefined) ??
    templateBuckets.find((bucket) => bucket.company === null) ??
    templateBuckets[0]

  return (selectedBucket?.items ?? [])
    .map(mapTemplateItemRow)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.section.localeCompare(b.section) ||
        a.label.localeCompare(b.label),
    )
}

export const vehicleCheckTemplatesService = {
  getDefaultVehicleCheckItems,
  listVehicleCheckTemplates,
  getVehicleCheckTemplate,
  createVehicleCheckTemplate,
  createDefaultVehicleCheckTemplate,
  updateVehicleCheckTemplate,
  deleteVehicleCheckTemplate,
  listTemplateItems,
  createTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  fetchTemplateItemsByVehicleType,
}
