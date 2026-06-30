import type { Driver } from '@/services/driversService'
import type { OffRoadReason, Vehicle, VehicleInput, VehicleStatus } from '@/services/vehiclesService'

export type VehicleFormErrors = Partial<Record<keyof VehicleInput, string>>

export const vehicleStatuses: VehicleStatus[] = [
  'Available',
  'Assigned',
  'Workshop',
  'Maintenance',
  'Out of Service',
  'Off Road',
  'Reserved',
]

export const offRoadReasons: OffRoadReason[] = [
  'Accident',
  'Mechanical Failure',
  'Awaiting Parts',
  'Insurance Expired',
  'MOT Expired',
  'SORN',
  'Other',
]

export const scheduledAvailabilityStatuses: VehicleStatus[] = [
  'Workshop',
  'Maintenance',
  'Out of Service',
  'Off Road',
  'Reserved',
]

const maintenanceReasons = ['Service', 'Repair', 'MOT', 'Inspection', 'Tyres', 'Other']

export const initialVehicleForm: VehicleInput = {
  registration: '',
  fleetNumber: '',
  vehicleType: '',
  make: '',
  model: '',
  year: '',
  vin: '',
  currentOdometer: '',
  currentDriverId: '',
  status: 'Available',
  insuranceExpiry: '',
  motExpiry: '',
  roadTaxExpiry: '',
  tachographExpiry: '',
  offRoadReason: '',
  offRoadStartDate: '',
  offRoadExpectedReturnDate: '',
  offRoadNotes: '',
  notes: '',
}

export function getDriverName(driver: Driver): string {
  return `${driver.firstName} ${driver.lastName}`.trim()
}

export function getVehicleFormValues(vehicle: Vehicle): VehicleInput {
  return {
    registration: vehicle.registration,
    fleetNumber: vehicle.fleetNumber ?? '',
    vehicleType: vehicle.vehicleType ?? '',
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year?.toString() ?? '',
    vin: vehicle.vin ?? '',
    currentOdometer: vehicle.currentOdometer?.toString() ?? '',
    currentDriverId: vehicle.currentDriverId ?? '',
    status: vehicle.baseStatus,
    insuranceExpiry: vehicle.insuranceExpiry ?? '',
    motExpiry: vehicle.motExpiry ?? '',
    roadTaxExpiry: vehicle.roadTaxExpiry ?? '',
    tachographExpiry: vehicle.tachographExpiry ?? '',
    offRoadReason: vehicle.offRoadReason ?? '',
    offRoadStartDate: vehicle.offRoadStartDate ?? '',
    offRoadExpectedReturnDate: vehicle.offRoadExpectedReturnDate ?? '',
    offRoadNotes: vehicle.offRoadNotes ?? '',
    notes: vehicle.notes ?? '',
  }
}

export function getScheduleReasonOptions(status: VehicleStatus): string[] {
  if (status === 'Off Road') return offRoadReasons
  if (status === 'Maintenance' || status === 'Workshop') return maintenanceReasons
  return []
}

export function validateVehicleForm(form: VehicleInput): VehicleFormErrors {
  const errors: VehicleFormErrors = {}

  if (!form.registration.trim()) errors.registration = 'Registration is required.'
  if (!form.vehicleType.trim()) errors.vehicleType = 'Vehicle type is required.'
  if (!form.make.trim()) errors.make = 'Make is required.'
  if (!form.model.trim()) errors.model = 'Model is required.'
  if (form.year && Number.isNaN(Number.parseInt(form.year, 10))) {
    errors.year = 'Enter a valid year.'
  }
  if (
    form.currentOdometer &&
    Number.isNaN(Number.parseInt(form.currentOdometer, 10))
  ) {
    errors.currentOdometer = 'Enter a valid odometer value.'
  }
  if (scheduledAvailabilityStatuses.includes(form.status)) {
    if (!form.offRoadReason) errors.offRoadReason = 'Reason is required.'
    if (!form.offRoadStartDate) {
      errors.offRoadStartDate = 'Start date is required.'
    }
    if (!form.offRoadNotes.trim()) errors.offRoadNotes = 'Notes are required.'
  }

  return errors
}

export function isVehicleFormDirty(
  current: VehicleInput,
  initial: VehicleInput,
): boolean {
  return (Object.keys(initial) as (keyof VehicleInput)[]).some(
    (key) => current[key] !== initial[key],
  )
}
