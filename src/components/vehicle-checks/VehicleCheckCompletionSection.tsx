import { Input } from '@/components/ui/input'
import { useWorkerChromeText } from '@/i18n/workerLocaleContext'
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
  const completeInspection = useWorkerChromeText(
    'vehicleChecks.completeInspection',
    'Complete inspection',
  )
  const mileageSignatureHint = useWorkerChromeText(
    'vehicleChecks.mileageSignatureHint',
    'Mileage and signature required.',
  )
  const durationLabelText = useWorkerChromeText('vehicleChecks.duration', 'Duration')
  const odometerLabel = useWorkerChromeText('vehicleChecks.odometer', 'Odometer / mileage')
  const enterReading = useWorkerChromeText(
    'vehicleChecks.enterReading',
    'Enter reading in {{unit}}',
    { unit: odometerUnit },
  )
  const milesLabel = useWorkerChromeText('vehicleChecks.miles', 'Miles')
  const kmLabel = useWorkerChromeText('vehicleChecks.km', 'Km')
  const lastRecorded = useWorkerChromeText(
    'vehicleChecks.lastRecorded',
    'Last recorded: {{value}} {{unit}}',
    {
      value: lastRecordedOdometer != null ? lastRecordedOdometer.toLocaleString() : '',
      unit: odometerUnit,
    },
  )
  const odometerRequired = useWorkerChromeText(
    'vehicleChecks.odometerRequired',
    'Odometer / mileage is required.',
  )
  const odometerInvalid = useWorkerChromeText(
    'vehicleChecks.odometerInvalid',
    'Enter a valid number greater than or equal to 0.',
  )
  const workerSignature = useWorkerChromeText(
    'vehicleChecks.workerSignature',
    'Worker signature',
  )
  const signatureRequired = useWorkerChromeText(
    'vehicleChecks.signatureRequired',
    'Worker signature is required.',
  )

  const unitOptions: { value: VehicleCheckOdometerUnit; label: string }[] = [
    { value: 'miles', label: milesLabel },
    { value: 'km', label: kmLabel },
  ]

  const parsedOdometer = odometer.trim() ? Number.parseInt(odometer, 10) : null
  const isOdometerMissing = !odometer.trim()
  const isOdometerInvalid =
    odometer.trim().length > 0 &&
    (parsedOdometer === null || Number.isNaN(parsedOdometer) || parsedOdometer < 0)
  const isSignatureMissing = !signatureFile

  return (
    <section className="worker-vc-completion mt-3 rounded-[14px] border border-[#D3E9FC] bg-[#FAFCFF] p-2.5 sm:mt-4 sm:p-3.5">
      <div className="mb-2 flex items-start justify-between gap-3 sm:mb-3">
        <div>
          <h3 className="worker-vc-title text-sm font-semibold text-[#113C69]">{completeInspection}</h3>
          <p className="worker-vc-muted mt-0.5 text-[11px] text-[#5499BF] sm:text-xs">
            {mileageSignatureHint}
          </p>
        </div>
        {durationLabel ? (
          <p className="worker-vc-muted shrink-0 text-[11px] font-semibold text-[#5499BF]">
            {durationLabelText}{' '}
            <span className="worker-vc-title tabular-nums text-[#113C69]">{durationLabel}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        <div>
          <label
            className="worker-vc-label block text-sm font-medium text-slate-700"
            htmlFor="vehicle-check-odometer"
          >
            {odometerLabel}
          </label>
          <div className="mt-1 flex gap-2 sm:mt-1.5">
            <Input
              id="vehicle-check-odometer"
              type="number"
              min={0}
              inputMode="numeric"
              value={odometer}
              onChange={(event) => onOdometerChange(event.target.value)}
              placeholder={enterReading}
              disabled={disabled}
              className="h-11 min-w-0 flex-1 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-white"
              aria-invalid={showValidation && (isOdometerMissing || isOdometerInvalid)}
            />
            <div className="worker-vc-unit-toggle grid shrink-0 grid-cols-2 overflow-hidden rounded-[12px] border border-[#C5DFFB] bg-white p-0.5">
              {unitOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onOdometerUnitChange(option.value)}
                  className={`worker-vc-unit min-h-11 min-w-[3.25rem] rounded-[10px] px-2 text-xs font-semibold transition-colors sm:min-h-10 ${
                    odometerUnit === option.value
                      ? 'worker-vc-unit-selected bg-[#218EE7] text-white'
                      : 'worker-vc-unit-idle text-[#5499BF] hover:bg-[#F5FAFF]'
                  }`}
                  aria-pressed={odometerUnit === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {lastRecordedOdometer != null ? (
            <p className="worker-vc-muted mt-1 text-[11px] text-[#5499BF]">
              {lastRecorded}
            </p>
          ) : null}
          {showValidation && isOdometerMissing ? (
            <p className="mt-1 text-[11px] font-medium text-rose-600">
              {odometerRequired}
            </p>
          ) : null}
          {showValidation && isOdometerInvalid ? (
            <p className="mt-1 text-[11px] font-medium text-rose-600">
              {odometerInvalid}
            </p>
          ) : null}
        </div>

        <div>
          <p className="worker-vc-label text-sm font-medium text-slate-700">{workerSignature}</p>
          <div className="mt-1 sm:mt-1.5">
            <VehicleCheckSignaturePad
              onChange={onSignatureChange}
              disabled={disabled}
            />
          </div>
          {showValidation && isSignatureMissing ? (
            <p className="mt-1 text-[11px] font-medium text-rose-600">
              {signatureRequired}
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
