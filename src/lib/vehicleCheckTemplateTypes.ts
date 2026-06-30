export type VehicleCheckTemplate = {
  id: string
  createdAt: string
  vehicleType: string
  section: string
  itemName: string
  sortOrder: number
  isRequired: boolean
  isActive: boolean
}

export type CreateVehicleCheckTemplateInput = {
  vehicleType: string
  section: string
  itemName: string
  sortOrder?: number
  isRequired?: boolean
  isActive?: boolean
}

export type UpdateVehicleCheckTemplateInput = {
  vehicleType?: string
  section?: string
  itemName?: string
  sortOrder?: number
  isRequired?: boolean
  isActive?: boolean
}
