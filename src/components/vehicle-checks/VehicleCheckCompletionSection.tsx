import { Input } from '@/components/ui/input'
import type { VehicleCheckOdometerUnit } from '@/lib/vehicleCheckTypes'
import { VehicleCheckSignaturePad } from '@/components/vehicle-checks/VehicleCheckSignaturePad'

type VehicleCheckCompletionSectionProps = {
  odometer: string
  odometerUnit: VehicleCheckOdometerUnit
  signatureFile: File | null
  durationLabel?: string | null
  lastRecordedOdometer?: number | null
  showValidation?: boolean
  disabled?: boolean
  onOdometerChange: (value: string) => void
  onOdometerUnitChange: (unit: VehicleCheckOdometerUnit) => void
  onSignatureChange: (file: File | null) => void
}

const unitOptions: { value: VehicleCheckOdometerUnit; label: string }[] = [
  { value: 'miles', label: 'Miles' },
  { value: 'km', label: 'Km' },
]

export function VehicleCheckCompletionSection({
  odometer,
  odometerUnit,
  signatureFile,
  durationLabel,
  lastRecordedOdometer,
  showValidation = false,
  disabled = false,
  onOdometerChange,
  onOdometerUnitChange,
  onSignatureChange,
}: VehicleCheckCompletionSectionProps) {
  const parsedOdometer = odometer.trim() ? Number.parseInt(odometer, 10) : null
  const isOdometerMissing = !odometer.trim()
  const isOdometerInvalid =
    odometer.trim().length > 0 &&
    (parsedOdometer === null || Number.isNaN(parsedOdometer) || parsedOdometer < 0)
  const isSignatureMissing = !signatureFile

  return (
    <section className="mt-4 rounded-[14px] border border-[#D3E9FC] bg-[#FAFCFF] p-3 sm:p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#113C69]">Complete inspection</h3>
          <p className="mt-0.5 text-xs text-[#5499BF]">
            Mileage and worker signature are required before saving.
          </p>
        </div>
        {durationLabel ? (
          <p className="shrink-0 text-[11px] font-semibold text-[#5499BF]">
            Duration{' '}
            <span className="tabular-nums text-[#113C69]">{durationLabel}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle-check-odometer">
            Odometer / mileage
          </label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id="vehicle-check-odometer"
              type="number"
              min={0}
              inputMode="numeric"
              value={odometer}
              onChange={(event) => onOdometerChange(event.target.value)}
              placeholder={`Enter reading in ${odometerUnit}`}
              disabled={disabled}
              className="h-11 min-w-0 flex-1 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-white"
              aria-invalid={showValidation && (isOdometerMissing || isOdometerInvalid)}
            />
            <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-[12px] border border-[#C5DFFB] bg-white p-0.5">
              {unitOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onOdometerUnitChange(option.value)}
                  className={`min-h-10 min-w-[3.5rem] rounded-[10px] px-2 text-xs font-semibold transition-colors ${
                    odometerUnit === option.value
                      ? 'bg-[#218EE7] text-white'
                      : 'text-[#5499BF] hover:bg-[#F5FAFF]'
                  }`}
                  aria-pressed={odometerUnit === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {lastRecordedOdometer != null ? (
            <p className="mt-1.5 text-[11px] text-[#5499BF]">
              Last recorded on vehicle: {lastRecordedOdometer.toLocaleString()} {odometerUnit}
            </p>
          ) : null}
          {showValidation && isOdometerMissing ? (
            <p className="mt-1.5 text-[11px] font-medium text-rose-600">
              Odometer / mileage is required.
            </p>
          ) : null}
          {showValidation && isOdometerInvalid ? (
            <p className="mt-1.5 text-[11px] font-medium text-rose-600">
              Enter a valid number greater than or equal to 0.
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700">Worker signature</p>
          <div className="mt-1.5">
            <VehicleCheckSignaturePad
              onChange={onSignatureChange}
              disabled={disabled}
            />
          </div>
          {showValidation && isSignatureMissing ? (
            <p className="mt-1.5 text-[11px] font-medium text-rose-600">
              Worker signature is required.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function isVehicleCheckOdometerValid(value: string): boolean {
  if (!value.trim()) return false
  const parsed = Number.parseInt(value, 10)
  return !Number.isNaN(parsed) && parsed >= 0
}

export function canCompleteVehicleCheck(input: {
  odometer: string
  signatureFile: File | null
}): boolean {
  return isVehicleCheckOdometerValid(input.odometer) && input.signatureFile !== null
}
