import type {
  CreateVehicleCheckTemplateInput,
  CreateVehicleCheckTemplateItemInput,
  DefaultVehicleCheckTemplateItem,
  UpdateVehicleCheckTemplateInput,
  UpdateVehicleCheckTemplateItemInput,
  VehicleCheckTemplate,
  VehicleCheckTemplateCompanyScope,
  VehicleCheckTemplateItem,
  VehicleCheckTemplateWithItems,
} from '@/lib/vehicleCheckTemplateTypes'
import { getDefaultDvsaVehicleCheckItems } from '@/lib/defaultDvsaVehicleCheckItems'
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

const EXTRA_VEHICLE_TYPE_CHECKS_SECTION = 'Extra checks'
const EXTRA_VEHICLE_TYPE_CHECKS_BASE_SORT_ORDER = 100
/** Legacy flat-table header marker when section/item_name remain NOT NULL on vehicle_check_templates. */
const VEHICLE_CHECK_TEMPLATE_LEGACY_HEADER_ITEM_NAME = 'Template header'

export class VehicleCheckTemplatesServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleCheckTemplatesServiceError'
  }
}

export function getDefaultVehicleCheckItems(): DefaultVehicleCheckTemplateItem[] {
  return getDefaultDvsaVehicleCheckItems()
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isMissingVehicleCheckTemplateColumnError(error: unknown): boolean {
  const message =
    error instanceof VehicleCheckTemplatesServiceError
      ? error.message
      : error instanceof Error
        ? error.message
        : ''

  const normalized = message.toLowerCase()
  return (
    normalized.includes('could not find') ||
    normalized.includes('schema cache') ||
    (normalized.includes('column') &&
      (normalized.includes('does not exist') || normalized.includes('not found')))
  )
}

function buildVehicleCheckTemplateInsertPayload(
  payload: CreateVehicleCheckTemplateInput,
  name: string,
): Record<string, unknown> {
  const vehicleType = normalizeOptionalText(payload.vehicleType)

  return {
    company: normalizeOptionalText(payload.company),
    name,
    vehicle_type: vehicleType,
    description: normalizeOptionalText(payload.description),
    is_active: payload.isActive ?? true,
    // Legacy flat-table NOT NULL columns (safe header placeholders; real items live in vehicle_check_template_items).
    section: EXTRA_VEHICLE_TYPE_CHECKS_SECTION,
    item_name: VEHICLE_CHECK_TEMPLATE_LEGACY_HEADER_ITEM_NAME,
  }
}

function stripLegacyVehicleCheckTemplateHeaderFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const { section: _section, item_name: _itemName, ...normalized } = payload
  return normalized
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

function requireCompanyScope(
  scope?: VehicleCheckTemplateCompanyScope | null,
): VehicleCheckTemplateCompanyScope {
  const company = scope?.company?.trim()
  if (!company) {
    throw new VehicleCheckTemplatesServiceError('Company is required to manage template checks.')
  }

  return { company }
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

  const vehicleType = normalizeOptionalText(payload.vehicleType)
  if (!vehicleType) {
    throw new VehicleCheckTemplatesServiceError('Vehicle type is required.')
  }

  let insertPayload = buildVehicleCheckTemplateInsertPayload(payload, name)

  const supabase = requireSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (import.meta.env.DEV) {
    console.info('[vehicleCheckTemplatesService] insert vehicle_check_templates', {
      table: VEHICLE_CHECK_TEMPLATES_TABLE,
      payload: insertPayload,
      authUserId: user?.id ?? null,
      authEmail: user?.email ?? null,
    })
  }

  let { data, error } = await supabase
    .from(VEHICLE_CHECK_TEMPLATES_TABLE)
    .insert(insertPayload)
    .select(templateSelect)
    .single()

  if (error && isMissingVehicleCheckTemplateColumnError(error)) {
    insertPayload = stripLegacyVehicleCheckTemplateHeaderFields(insertPayload)
    ;({ data, error } = await supabase
      .from(VEHICLE_CHECK_TEMPLATES_TABLE)
      .insert(insertPayload)
      .select(templateSelect)
      .single())
  }

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[vehicleCheckTemplatesService] insert vehicle_check_templates failed', {
        payload: insertPayload,
        authUserId: user?.id ?? null,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
    }
    throw new VehicleCheckTemplatesServiceError(error.message)
  }
  return mapTemplateRow(data as unknown as VehicleCheckTemplateRow)
}

async function findTemplateByCompanyAndVehicleType(
  vehicleType?: string | null,
  company?: string | null,
): Promise<VehicleCheckTemplate | null> {
  const normalizedVehicleType = normalizeOptionalText(vehicleType)
  const normalizedCompany = normalizeOptionalText(company)

  async function runQuery(includeLegacyHeaderFilter: boolean) {
    let request = requireSupabase()
      .from(VEHICLE_CHECK_TEMPLATES_TABLE)
      .select(templateSelect)
      .limit(1)

    if (normalizedCompany) {
      request = request.eq('company', normalizedCompany)
    } else {
      request = request.is('company', null)
    }

    request = normalizedVehicleType
      ? request.eq('vehicle_type', normalizedVehicleType)
      : request.is('vehicle_type', null)

    if (includeLegacyHeaderFilter) {
      request = request.or(
        `item_name.is.null,item_name.eq.${VEHICLE_CHECK_TEMPLATE_LEGACY_HEADER_ITEM_NAME}`,
      )
    }

    return request.maybeSingle()
  }

  let { data, error } = await runQuery(true)
  if (error && isMissingVehicleCheckTemplateColumnError(error)) {
    ;({ data, error } = await runQuery(false))
  }

  if (error) throw new VehicleCheckTemplatesServiceError(error.message)
  if (!data) return null

  return mapTemplateRow(data as unknown as VehicleCheckTemplateRow)
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

  const existing = await findTemplateByCompanyAndVehicleType(vehicleType, company)
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

function isVehicleCheckTemplateSchemaMismatch(error: unknown): boolean {
  const message =
    error instanceof VehicleCheckTemplatesServiceError
      ? error.message
      : error instanceof Error
        ? error.message
        : ''

  const normalized = message.toLowerCase()
  return (
    normalized.includes('does not exist') ||
    normalized.includes('could not find the table') ||
    normalized.includes('vehicle_check_template_items') ||
    (normalized.includes('column') && normalized.includes('vehicle_check_templates'))
  )
}

type LegacyFlatTemplateRow = {
  id: string
  vehicle_type: string
  section: string
  item_name: string
  sort_order: number | null
  is_required: boolean | null
  is_active: boolean | null
  guidance?: string | null
  description?: string | null
  allow_notes?: boolean | null
  allow_photo?: boolean | null
  fail_on_defect?: boolean | null
  is_custom?: boolean | null
  created_at: string | null
}

function mapLegacyFlatTemplateRow(row: LegacyFlatTemplateRow): VehicleCheckTemplateItem {
  return {
    id: row.id,
    templateId: row.id,
    section: row.section,
    label: row.item_name,
    description: normalizeOptionalText(row.guidance ?? row.description ?? null),
    sortOrder: row.sort_order ?? 0,
    isRequired: row.is_required ?? true,
    allowNotes: row.allow_notes ?? true,
    allowPhoto: row.allow_photo ?? false,
    failOnDefect: row.fail_on_defect ?? true,
    isActive: row.is_active ?? true,
    isCustom: row.is_custom ?? false,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

async function fetchLegacyFlatTemplateItemsByVehicleType(
  vehicleType: string,
): Promise<VehicleCheckTemplateItem[]> {
  const legacySelectWithGuidance = `
    id,
    vehicle_type,
    section,
    item_name,
    sort_order,
    is_required,
    is_active,
    guidance,
    description,
    allow_notes,
    allow_photo,
    fail_on_defect,
    is_custom,
    created_at
  `

  const legacySelectWithDescription = `
    id,
    vehicle_type,
    section,
    item_name,
    sort_order,
    is_required,
    is_active,
    description,
    created_at
  `

  const legacySelectMinimal = `
    id,
    vehicle_type,
    section,
    item_name,
    sort_order,
    is_required,
    is_active,
    created_at
  `

  async function runLegacySelect(select: string) {
    return requireSupabase()
      .from(VEHICLE_CHECK_TEMPLATES_TABLE)
      .select(select)
      .eq('vehicle_type', vehicleType)
      .eq('is_active', true)
      .not('section', 'is', null)
      .not('item_name', 'is', null)
      .order('sort_order', { ascending: true })
      .order('section', { ascending: true })
      .order('item_name', { ascending: true })
  }

  let result = await runLegacySelect(legacySelectWithGuidance)
  if (result.error && result.error.message.toLowerCase().includes('does not exist')) {
    result = await runLegacySelect(legacySelectWithDescription)
  }
  if (result.error && result.error.message.toLowerCase().includes('does not exist')) {
    result = await runLegacySelect(legacySelectMinimal)
  }

  if (result.error) {
    throw new VehicleCheckTemplatesServiceError(result.error.message)
  }

  return ((result.data ?? []) as unknown as LegacyFlatTemplateRow[])
    .filter((row) => row.item_name !== VEHICLE_CHECK_TEMPLATE_LEGACY_HEADER_ITEM_NAME)
    .map(mapLegacyFlatTemplateRow)
}

async function fetchNormalizedTemplateItemsByVehicleType(
  vehicleType: string,
  company?: string | null,
): Promise<VehicleCheckTemplateItem[]> {
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
    if (templateVehicleType !== vehicleType.toLowerCase()) continue

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

export async function fetchTemplateItemsByVehicleType(
  vehicleType: string,
  company?: string | null,
): Promise<VehicleCheckTemplateItem[]> {
  const normalizedType = normalizeOptionalText(vehicleType)
  if (!normalizedType) return []

  try {
    const normalizedItems = await fetchNormalizedTemplateItemsByVehicleType(
      normalizedType,
      company,
    )
    if (normalizedItems.length > 0) {
      return normalizedItems
    }
  } catch (error) {
    if (!isVehicleCheckTemplateSchemaMismatch(error)) {
      throw error
    }
  }

  return fetchLegacyFlatTemplateItemsByVehicleType(normalizedType)
}

function isExtraVehicleTypeTemplateItem(item: VehicleCheckTemplateItem): boolean {
  return item.isCustom || item.sortOrder > EXTRA_VEHICLE_TYPE_CHECKS_BASE_SORT_ORDER
}

export async function listExtraVehicleTypeTemplateItems(
  vehicleType: string,
  scope: VehicleCheckTemplateCompanyScope,
): Promise<VehicleCheckTemplateItem[]> {
  const companyScope = requireCompanyScope(scope)
  const normalizedType = normalizeOptionalText(vehicleType)
  if (!normalizedType) return []

  const template = await findTemplateByCompanyAndVehicleType(normalizedType, companyScope.company)
  if (!template) return []

  const items = await listTemplateItems(template.id)
  return items.filter(isExtraVehicleTypeTemplateItem)
}

export async function getOrCreateVehicleTypeCheckTemplate(
  vehicleType: string,
  scope: VehicleCheckTemplateCompanyScope,
): Promise<VehicleCheckTemplate> {
  const companyScope = requireCompanyScope(scope)
  const normalizedType = normalizeOptionalText(vehicleType)
  if (!normalizedType) {
    throw new VehicleCheckTemplatesServiceError('Vehicle type is required.')
  }

  const existing = await findTemplateByCompanyAndVehicleType(normalizedType, companyScope.company)
  if (existing) return existing

  return createVehicleCheckTemplate({
    company: companyScope.company,
    name: `${normalizedType} Daily Vehicle Check`,
    vehicleType: normalizedType,
    description: 'Vehicle-type checklist template for extra checks.',
    isActive: true,
  })
}

export async function addExtraVehicleTypeTemplateItem(
  vehicleType: string,
  input: { label: string; description?: string | null },
  scope: VehicleCheckTemplateCompanyScope,
): Promise<VehicleCheckTemplateItem> {
  const companyScope = requireCompanyScope(scope)
  const label = input.label.trim()
  if (!label) {
    throw new VehicleCheckTemplatesServiceError('Check item label is required.')
  }

  const template = await getOrCreateVehicleTypeCheckTemplate(vehicleType, companyScope)
  const items = await listTemplateItems(template.id)
  const extraItems = items.filter(isExtraVehicleTypeTemplateItem)
  const nextSortOrder =
    extraItems.length === 0
      ? EXTRA_VEHICLE_TYPE_CHECKS_BASE_SORT_ORDER + 1
      : Math.max(
          EXTRA_VEHICLE_TYPE_CHECKS_BASE_SORT_ORDER + 1,
          ...extraItems.map((item) => item.sortOrder),
        ) + 1

  return createTemplateItem({
    templateId: template.id,
    section: EXTRA_VEHICLE_TYPE_CHECKS_SECTION,
    label,
    description: input.description,
    sortOrder: nextSortOrder,
    isRequired: true,
    allowNotes: true,
    allowPhoto: false,
    failOnDefect: true,
    isActive: true,
    isCustom: true,
  })
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
  listExtraVehicleTypeTemplateItems,
  getOrCreateVehicleTypeCheckTemplate,
  addExtraVehicleTypeTemplateItem,
}
