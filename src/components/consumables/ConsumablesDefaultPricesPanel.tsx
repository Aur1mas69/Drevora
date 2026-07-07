import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SettingsCard,
  SettingsField,
  SettingsPageIntro,
  settingsFieldClassName,
  settingsInnerCardClassName,
  settingsSaveButtonClassName,
  settingsStatusTextClassName,
} from '@/components/settings/SettingsControls'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { ConsumableType, ConsumableUnit } from '@/lib/consumableTypes'
import { CONSUMABLE_UNITS } from '@/lib/consumableTypes'
import { DEFAULT_CURRENCY } from '@/lib/companySettingsTypes'
import {
  CONSUMABLE_DEFAULT_PRICE_TYPES,
  formatConfiguredDefaultPriceLine,
  getDefaultPriceUnitForType,
  listConfiguredDefaultPrices,
  normalizeConsumableDefaultPrices,
  type ConsumableDefaultPricesMap,
} from '@/lib/consumableDefaultPrices'
import { companySettingsService } from '@/services/companySettingsService'
import { Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const compactFieldClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[#D3E9FC] bg-[#F8FBFF] px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors focus:border-[#218EE7] focus:ring-2 focus:ring-[#E8F3FE]'

type ConsumablesDefaultPricesPanelProps = {
  compact?: boolean
  embeddedInSettings?: boolean
  showSettingsLink?: boolean
  onSaved?: () => void
}

function mergePriceForType(
  existing: ConsumableDefaultPricesMap,
  type: ConsumableType,
  unitPriceRaw: string,
  unit: ConsumableUnit,
): ConsumableDefaultPricesMap {
  const next = { ...existing }
  const trimmed = unitPriceRaw.trim()

  if (!trimmed) {
    delete next[type]
    return normalizeConsumableDefaultPrices(next)
  }

  const unitPrice = Number(trimmed)
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return existing
  }

  next[type] = { unitPrice, unit }
  return normalizeConsumableDefaultPrices(next)
}

export function ConsumablesDefaultPricesPanel({
  compact = false,
  embeddedInSettings = false,
  showSettingsLink = false,
  onSaved,
}: ConsumablesDefaultPricesPanelProps) {
  const { settings, refreshSettings } = useCompanySettings()
  const currency = settings?.currency ?? DEFAULT_CURRENCY
  const savedPrices = useMemo(
    () => settings?.consumableDefaultPrices ?? {},
    [settings?.consumableDefaultPrices],
  )

  const [selectedType, setSelectedType] = useState<ConsumableType>('Diesel')
  const [priceInput, setPriceInput] = useState('')
  const [otherUnit, setOtherUnit] = useState<ConsumableUnit>('L')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const displayUnit =
    selectedType === 'Other' ? otherUnit : getDefaultPriceUnitForType(selectedType)

  const configuredPrices = useMemo(
    () => listConfiguredDefaultPrices(savedPrices),
    [savedPrices],
  )

  useEffect(() => {
    const entry = savedPrices[selectedType]
    setPriceInput(entry ? String(entry.unitPrice) : '')
    if (selectedType === 'Other' && entry?.unit) {
      setOtherUnit(entry.unit)
    }
  }, [savedPrices, selectedType])

  const savedPriceForSelection = savedPrices[selectedType]
  const isDirty =
    priceInput.trim() !== (savedPriceForSelection ? String(savedPriceForSelection.unitPrice) : '') ||
    (selectedType === 'Other' &&
      savedPriceForSelection &&
      otherUnit !== savedPriceForSelection.unit)

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const nextPrices = mergePriceForType(savedPrices, selectedType, priceInput, displayUnit)
      await companySettingsService.updateConsumableDefaultPrices(nextPrices)
      setSuccessMessage(
        priceInput.trim()
          ? `Default price saved for ${selectedType}.`
          : `Default price removed for ${selectedType}.`,
      )
      refreshSettings()
      onSaved?.()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save default price.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleSelectConfigured(type: ConsumableType, entry: { unitPrice: number; unit: ConsumableUnit }) {
    setSelectedType(type)
    setPriceInput(String(entry.unitPrice))
    if (type === 'Other') {
      setOtherUnit(entry.unit)
    }
    setError(null)
    setSuccessMessage(null)
  }

  const fieldClassName = embeddedInSettings ? settingsFieldClassName : compactFieldClassName

  const formContent = (
    <>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,1fr)_auto] sm:items-end">
        <SettingsField label="Consumable type">
          <select
            value={selectedType}
            onChange={(event) => {
              setSelectedType(event.target.value as ConsumableType)
              setError(null)
              setSuccessMessage(null)
            }}
            className={fieldClassName}
          >
            {CONSUMABLE_DEFAULT_PRICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </SettingsField>

        <SettingsField label="Unit">
          {selectedType === 'Other' ? (
            <select
              value={otherUnit}
              onChange={(event) => setOtherUnit(event.target.value as ConsumableUnit)}
              className={fieldClassName}
            >
              {CONSUMABLE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-2 flex h-11 items-center rounded-[16px] bg-[#EEF4FF] px-3 text-sm font-semibold text-[#2563EB] ring-1 ring-[rgba(75,120,220,0.12)]">
              {displayUnit}
            </div>
          )}
        </SettingsField>

        <SettingsField label="Default unit price">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={priceInput}
            onChange={(event) => setPriceInput(event.target.value)}
            placeholder="e.g. 1.55"
            className={fieldClassName}
          />
        </SettingsField>

        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isDirty || isSaving}
          className={`${embeddedInSettings ? settingsSaveButtonClassName : 'h-10 rounded-[12px] bg-[#218EE7] px-4 font-semibold text-white hover:bg-[#0B68BE] disabled:opacity-60'} sm:mb-0`}
        >
          {isSaving ? 'Saving…' : 'Save default price'}
        </Button>
      </div>

      {error ? (
        <div className="mt-4 rounded-[12px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-[12px] bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
          {successMessage}
        </div>
      ) : null}

      {configuredPrices.length > 0 ? (
        <div className="mt-5 border-t border-[rgba(75,120,220,0.12)] pt-4 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Configured defaults
          </p>
          <ul className="mt-2 space-y-1.5">
            {configuredPrices.map(({ type, entry }) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => handleSelectConfigured(type, entry)}
                  className="text-left text-sm font-medium text-[#2A376F] transition-colors hover:text-[#2563EB] dark:text-slate-200"
                >
                  {formatConfiguredDefaultPriceLine(type, entry, currency)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )

  if (embeddedInSettings) {
    return (
      <div className="space-y-4">
        <SettingsPageIntro
          title="Consumables"
          description="Set default unit prices for commonly used consumables."
        />
        <SettingsCard title="Default consumable prices">
          <div className={settingsInnerCardClassName}>{formContent}</div>
        </SettingsCard>
      </div>
    )
  }

  return (
    <section
      className={
        compact
          ? 'rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF] to-[#F5FAFF]/95 p-4 ring-1 ring-[#C5DFFB]/35 sm:p-5'
          : 'rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF] to-[#F5FAFF]/95 p-5 ring-1 ring-[#C5DFFB]/35 sm:p-6'
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-[12px] bg-[#D3E9FC] text-[#0B68BE]">
              <Settings2 className="size-4" />
            </span>
            <h3 className="text-base font-semibold text-[#113C69]">Default Consumable Prices</h3>
          </div>
          <p className={`mt-1.5 ${embeddedInSettings ? settingsStatusTextClassName : 'text-sm text-[#5499BF]'}`}>
            Set default unit prices for commonly used consumables.
          </p>
        </div>
        {showSettingsLink ? (
          <Link
            to="/settings?tab=consumables"
            className="text-sm font-semibold text-[#218EE7] hover:underline"
          >
            Open in Settings
          </Link>
        ) : null}
      </div>

      <div className="mt-5">{formContent}</div>
    </section>
  )
}
