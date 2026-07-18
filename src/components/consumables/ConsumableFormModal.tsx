import { Button } from '@/components/ui/button'
import { CompanyTimeInput } from '@/components/ui/CompanyTimeInput'
import { Input } from '@/components/ui/input'
import { ConsumableReceiptField } from '@/components/consumables/ConsumableReceiptField'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type {
  Consumable,
  ConsumableFormSubmitPayload,
  ConsumableFormValues,
} from '@/lib/consumableTypes'
import { CONSUMABLE_TYPES, CONSUMABLE_UNITS } from '@/lib/consumableTypes'
import {
  getDefaultUnitForType,
  parseOptionalNumber,
  validateConsumableForm,
} from '@/lib/consumableUtils'
import {
  formatCalculatedCost,
  resolveDefaultUnitPrice,
  resolveConsumableEntryCost,
  type ConsumableDefaultPricesMap,
} from '@/lib/consumableDefaultPrices'
import { validateConsumableReceiptFile } from '@/lib/consumableReceiptStorage'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type ConsumableFormModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  record: Consumable | null
  vehicles: Vehicle[]
  workers: Driver[]
  isSaving?: boolean
  onClose: () => void
  onSubmit: (payload: ConsumableFormSubmitPayload) => Promise<void>
}

const fieldClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[#D3E9FC] bg-[#F8FBFF] px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors focus:border-[#218EE7] focus:ring-2 focus:ring-[#E8F3FE]'

const textareaClassName =
  'mt-1.5 min-h-[88px] w-full rounded-[12px] border border-[#D3E9FC] bg-[#F8FBFF] px-3 py-2 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors focus:border-[#218EE7] focus:ring-2 focus:ring-[#E8F3FE]'

function withCalculatedCost(
  values: ConsumableFormValues,
  defaultPrices: ConsumableDefaultPricesMap,
): ConsumableFormValues {
  const quantity = Number(values.quantity)
  const defaultPrice = resolveDefaultUnitPrice(defaultPrices, values.consumableType)
  const cost = resolveConsumableEntryCost(values.consumableType, quantity, defaultPrices)

  return {
    ...values,
    unitPrice: defaultPrice ? formatCalculatedCost(defaultPrice.unitPrice) : '',
    cost: cost !== null ? formatCalculatedCost(cost) : '',
  }
}

function buildInitialValues(
  record: Consumable | null,
  defaultPrices: ConsumableDefaultPricesMap,
): ConsumableFormValues {
  if (!record) {
    const dieselDefault = resolveDefaultUnitPrice(defaultPrices, 'Diesel')

    return withCalculatedCost(
      {
        entryDate: new Date().toISOString().slice(0, 10),
        entryTime: '',
        vehicleId: '',
        workerId: '',
        consumableType: 'Diesel',
        itemName: '',
        quantity: '',
        unit: dieselDefault?.unit ?? 'L',
        unitPrice: '',
        cost: '',
        supplier: '',
        site: '',
        odometer: '',
        notes: '',
      },
      defaultPrices,
    )
  }

  return withCalculatedCost(
    {
      entryDate: record.entryDate,
      entryTime: record.entryTime?.slice(0, 5) ?? '',
      vehicleId: record.vehicleId ?? '',
      workerId: record.workerId ?? '',
      consumableType: record.consumableType,
      itemName: record.itemName ?? '',
      quantity: String(record.quantity),
      unit: record.unit,
      unitPrice: '',
      cost: '',
      supplier: record.supplier ?? '',
      site: record.site ?? '',
      odometer: record.odometer === null ? '' : String(record.odometer),
      notes: record.notes ?? '',
    },
    defaultPrices,
  )
}

export function consumableFormValuesToInput(
  values: ConsumableFormValues,
  defaultPrices?: ConsumableDefaultPricesMap,
) {
  const quantity = Number(values.quantity)
  const cost = resolveConsumableEntryCost(
    values.consumableType,
    quantity,
    defaultPrices,
  )

  return {
    entryDate: values.entryDate,
    entryTime: values.entryTime.trim() || null,
    vehicleId: values.vehicleId,
    workerId: values.workerId.trim() || null,
    consumableType: values.consumableType,
    itemName: values.itemName.trim() || null,
    quantity,
    unit: values.unit,
    cost,
    supplier: values.supplier.trim() || null,
    site: values.site.trim() || null,
    odometer: parseOptionalNumber(values.odometer),
    notes: values.notes.trim() || null,
  }
}

export function ConsumableFormModal({
  isOpen,
  mode,
  record,
  vehicles,
  workers,
  isSaving = false,
  onClose,
  onSubmit,
}: ConsumableFormModalProps) {
  const { timeFormat, settings } = useCompanySettings()
  const defaultPrices = settings?.consumableDefaultPrices ?? {}
  const [values, setValues] = useState<ConsumableFormValues>(() =>
    buildInitialValues(record, defaultPrices),
  )
  const [error, setError] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => a.registration.localeCompare(b.registration)),
    [vehicles],
  )

  const sortedWorkers = useMemo(
    () =>
      [...workers].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [workers],
  )

  useEffect(() => {
    if (!isOpen) return
    setValues(buildInitialValues(record, defaultPrices))
    setError(null)
    setReceiptFile(null)
    setRemoveReceipt(false)
  }, [defaultPrices, isOpen, record])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen) return null

  function updateField<K extends keyof ConsumableFormValues>(key: K, value: ConsumableFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value }
      if (key === 'quantity') {
        return withCalculatedCost(next, defaultPrices)
      }
      return next
    })
  }

  function handleTypeChange(nextType: ConsumableFormValues['consumableType']) {
    const defaultPrice = resolveDefaultUnitPrice(defaultPrices, nextType)

    setValues((current) =>
      withCalculatedCost(
        {
          ...current,
          consumableType: nextType,
          unit: defaultPrice?.unit ?? getDefaultUnitForType(nextType),
        },
        defaultPrices,
      ),
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const validationError = validateConsumableForm(values)
    if (validationError) {
      setError(validationError)
      return
    }

    if (receiptFile) {
      const fileError = validateConsumableReceiptFile(receiptFile)
      if (fileError) {
        setError(fileError)
        return
      }
    }

    try {
      await onSubmit({
        values: withCalculatedCost(values, defaultPrices),
        receiptFile,
        removeReceipt,
      })
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to save consumable record.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[18px] border border-[#D3E9FC] bg-white p-5 shadow-[0_30px_80px_rgba(11,38,70,0.18)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/50 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consumable-form-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="consumable-form-title"
              className="text-lg font-semibold tracking-[-0.03em] text-[#113C69]"
            >
              {mode === 'create' ? 'Add Consumable' : 'Edit Consumable'}
            </h2>
            <p className="mt-1 text-sm text-[#3D7A9C]">
              Record fuel, fluids, AdBlue, oils and other vehicle consumables.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="h-8 w-8 rounded-[10px] p-0 text-slate-500"
          >
            <X className="size-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[#113C69]">
              Date <span className="text-rose-500">*</span>
              <Input
                type="date"
                required
                value={values.entryDate}
                onChange={(event) => updateField('entryDate', event.target.value)}
                className={fieldClassName}
              />
            </label>

            <label className="block text-sm font-medium text-[#113C69]">
              Time
              <CompanyTimeInput
                value={values.entryTime || null}
                onChange={(nextValue) => updateField('entryTime', nextValue ?? '')}
                timeFormat={timeFormat}
                className={fieldClassName}
              />
            </label>

            <label className="block text-sm font-medium text-[#113C69] sm:col-span-2">
              Vehicle <span className="text-rose-500">*</span>
              <select
                required
                value={values.vehicleId}
                onChange={(event) => updateField('vehicleId', event.target.value)}
                className={fieldClassName}
              >
                <option value="">Select vehicle</option>
                {sortedVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration}
                    {vehicle.make || vehicle.model
                      ? ` · ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#113C69]">
              Type <span className="text-rose-500">*</span>
              <select
                required
                value={values.consumableType}
                onChange={(event) =>
                  handleTypeChange(event.target.value as ConsumableFormValues['consumableType'])
                }
                className={fieldClassName}
              >
                {CONSUMABLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#113C69]">
              Worker
              <select
                value={values.workerId}
                onChange={(event) => updateField('workerId', event.target.value)}
                className={fieldClassName}
              >
                <option value="">No worker selected</option>
                {sortedWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.firstName} {worker.lastName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#113C69] sm:col-span-2">
              Item / Fluid name
              <Input
                value={values.itemName}
                onChange={(event) => updateField('itemName', event.target.value)}
                placeholder="e.g. Shell Diesel, 5W-30 Engine Oil"
                className={fieldClassName}
              />
            </label>

            <label className="block text-sm font-medium text-[#113C69]">
              Quantity <span className="text-rose-500">*</span>
              <Input
                type="number"
                min="0"
                step="any"
                required
                value={values.quantity}
                onChange={(event) => updateField('quantity', event.target.value)}
                className={fieldClassName}
              />
            </label>

            <label className="block text-sm font-medium text-[#113C69]">
              Unit <span className="text-rose-500">*</span>
              <select
                required
                value={values.unit}
                onChange={(event) =>
                  updateField('unit', event.target.value as ConsumableFormValues['unit'])
                }
                className={fieldClassName}
              >
                {CONSUMABLE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#113C69]">
              Odometer / Mileage
              <Input
                type="number"
                min="0"
                step="1"
                value={values.odometer}
                onChange={(event) => updateField('odometer', event.target.value)}
                className={fieldClassName}
              />
            </label>

            <label className="block text-sm font-medium text-[#113C69]">
              Supplier
              <Input
                value={values.supplier}
                onChange={(event) => updateField('supplier', event.target.value)}
                placeholder="e.g. Shell, BP"
                className={fieldClassName}
              />
            </label>

            <label className="block text-sm font-medium text-[#113C69]">
              Site / Depot
              <Input
                value={values.site}
                onChange={(event) => updateField('site', event.target.value)}
                placeholder="e.g. Yard, North Depot"
                className={fieldClassName}
              />
            </label>

            <ConsumableReceiptField
              existingReceiptPath={record?.receiptUrl ?? null}
              selectedFile={receiptFile}
              removeExistingReceipt={removeReceipt}
              disabled={isSaving}
              onSelectFile={(file) => {
                setReceiptFile(file)
                if (file) setRemoveReceipt(false)
              }}
              onRemoveExisting={() => {
                setRemoveReceipt(true)
                setReceiptFile(null)
              }}
              onUndoRemoveExisting={() => setRemoveReceipt(false)}
              onClearSelectedFile={() => setReceiptFile(null)}
            />

            <label className="block text-sm font-medium text-[#113C69] sm:col-span-2">
              Notes
              <textarea
                value={values.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                className={textareaClassName}
              />
            </label>
          </div>

          {error ? (
            <div className="rounded-[12px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[#D3E9FC] pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 rounded-[12px] border-[#D3E9FC] bg-white px-4 font-semibold text-[#0B68BE] hover:bg-[#F5FAFF] dark:border-white/10 dark:bg-slate-800/70 dark:text-blue-300 dark:hover:bg-slate-800/50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="h-10 rounded-[12px] bg-[#218EE7] px-4 font-semibold text-white hover:bg-[#0B68BE]"
            >
              {isSaving ? 'Saving…' : mode === 'create' ? 'Add Consumable' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
