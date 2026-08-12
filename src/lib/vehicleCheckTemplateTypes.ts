import type { VehicleCheckAssetScope } from '@/lib/vehicleCheckTypes'

export type VehicleCheckTemplate = {
  id: string
  company: string | null
  companyId: string | null
  name: string
  vehicleType: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type VehicleCheckTemplateItem = {
  id: string
  templateId: string
  section: string
  label: string
  description: string | null
  sortOrder: number
  isRequired: boolean
  allowNotes: boolean
  allowPhoto: boolean
  failOnDefect: boolean
  isActive: boolean
  isCustom: boolean
  createdAt: string
  /** Client composition only — not a vehicle_check_template_items column. */
  assetScope?: VehicleCheckAssetScope
  /** Client composition only — not a DB column. */
  source?: 'dvsa' | 'trailer_base' | 'drevora_recommended' | 'company_custom'
}

export type VehicleCheckTemplateWithItems = VehicleCheckTemplate & {
  items: VehicleCheckTemplateItem[]
}

export type CreateVehicleCheckTemplateInput = {
  company?: string | null
  name: string
  vehicleType?: string | null
  description?: string | null
  isActive?: boolean
}

export type VehicleCheckTemplateCompanyScope = {
  company: string
}

export type UpdateVehicleCheckTemplateInput = {
  company?: string | null
  name?: string
  vehicleType?: string | null
  description?: string | null
  isActive?: boolean
}

export type CreateVehicleCheckTemplateItemInput = {
  templateId: string
  section: string
  label: string
  description?: string | null
  sortOrder?: number
  isRequired?: boolean
  allowNotes?: boolean
  allowPhoto?: boolean
  failOnDefect?: boolean
  isActive?: boolean
  isCustom?: boolean
}

export type DefaultVehicleCheckTemplateItem = {
  section: string
  label: string
  description: string
  sortOrder: number
  isRequired: true
  allowNotes: true
  allowPhoto: false
  failOnDefect: true
  isActive: true
  isCustom: false
}

export type UpdateVehicleCheckTemplateItemInput = {
  templateId?: string
  section?: string
  label?: string
  description?: string | null
  sortOrder?: number
  isRequired?: boolean
  allowNotes?: boolean
  allowPhoto?: boolean
  failOnDefect?: boolean
  isActive?: boolean
  isCustom?: boolean
}
