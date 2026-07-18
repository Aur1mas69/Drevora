import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { resolveCompanyTextScope } from '@/lib/companySettingsGlobals'
import type { VehicleCheckTemplateItem } from '@/lib/vehicleCheckTemplateTypes'
import {
  addExtraVehicleTypeTemplateItem,
  listExtraVehicleTypeTemplateItems,
  VehicleCheckTemplatesServiceError,
} from '@/services/vehicleCheckTemplatesService'
import { Loader2, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type VehicleTypeTemplateChecksModalProps = {
  isOpen: boolean
  vehicleType: string
  onClose: () => void
}

const formInputClass =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[#C5DFFB] bg-[#F8FBFF] px-3 text-sm text-[#113C69] outline-none focus:border-[#218EE7] focus:ring-2 focus:ring-[#89CFF0]/30'

const formTextareaClass =
  'mt-1.5 w-full rounded-[12px] border border-[#C5DFFB] bg-[#F8FBFF] px-3 py-2 text-sm text-[#113C69] outline-none focus:border-[#218EE7] focus:ring-2 focus:ring-[#89CFF0]/30'

export function VehicleTypeTemplateChecksModal({
  isOpen,
  vehicleType,
  onClose,
}: VehicleTypeTemplateChecksModalProps) {
  const { settings, isLoading: isCompanyLoading } = useCompanySettings()
  const [items, setItems] = useState<VehicleCheckTemplateItem[]>([])
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastLoadErrorRef = useRef<string | null>(null)

  const companyScope = useMemo(() => {
    const company = resolveCompanyTextScope(settings)
    if (!company) return null
    return { company }
  }, [settings])

  useEffect(() => {
    if (!isOpen) return

    setLabel('')
    setDescription('')
    setError(null)
    lastLoadErrorRef.current = null

    if (isCompanyLoading) {
      setIsLoading(true)
      return
    }

    if (!companyScope) {
      setItems([])
      setIsLoading(false)
      setError('Company settings are required to manage template checks.')
      return
    }

    const activeCompanyScope = companyScope
    let cancelled = false

    async function loadItems() {
      setIsLoading(true)
      setError(null)

      try {
        const extraItems = await listExtraVehicleTypeTemplateItems(
          vehicleType,
          activeCompanyScope,
        )
        if (cancelled) return
        setItems(extraItems)
      } catch (loadError) {
        if (cancelled) return

        const message =
          loadError instanceof VehicleCheckTemplatesServiceError
            ? loadError.message
            : 'Failed to load extra checks.'

        if (lastLoadErrorRef.current !== message) {
          console.error('Failed to load vehicle type template checks:', loadError)
          lastLoadErrorRef.current = message
        }

        setItems([])
        setError(message)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [companyScope, isCompanyLoading, isOpen, vehicleType])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  const handleAddItem = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      setError(null)

      const trimmedLabel = label.trim()
      if (!trimmedLabel) {
        setError('Enter a short label for the extra check.')
        return
      }

      const company = resolveCompanyTextScope(settings)
      if (!company) {
        setError('Company settings are required to manage template checks.')
        return
      }

      setIsSaving(true)
      try {
        const created = await addExtraVehicleTypeTemplateItem(
          vehicleType,
          {
            label: trimmedLabel,
            description: description.trim() || null,
          },
          { company },
        )
        setItems((current) =>
          [...current, created].sort(
            (a, b) =>
              a.sortOrder - b.sortOrder ||
              a.label.localeCompare(b.label),
          ),
        )
        setLabel('')
        setDescription('')
      } catch (saveError) {
        setError(
          saveError instanceof VehicleCheckTemplatesServiceError
            ? saveError.message
            : 'Failed to add extra check.',
        )
      } finally {
        setIsSaving(false)
      }
    },
    [description, label, settings, vehicleType],
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 px-3 py-4 backdrop-blur-sm sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close extra checks"
        onClick={() => {
          if (!isSaving) onClose()
        }}
      />
      <div
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[18px] border border-[#C5DFFB] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-slate-950 dark:shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-type-template-checks-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#D3E9FC] bg-gradient-to-r from-[#F4FAFF] to-[#E8F3FE] px-4 py-3 dark:border-white/10 dark:from-slate-900 dark:to-slate-900">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5499BF] dark:text-slate-400">
              Template checks
            </p>
            <h2
              id="vehicle-type-template-checks-title"
              className="mt-1 text-base font-semibold leading-5 text-[#113C69] dark:text-slate-100"
            >
              Extra checks for {vehicleType}
            </h2>
            <p className="mt-1 text-xs text-[#5499BF] dark:text-slate-400">
              Applies to all vehicles with this type. Basic DVSA checks are unchanged.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0B68BE] shadow-sm dark:bg-slate-800 dark:text-blue-300"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
              Existing extra checks
            </p>
            {isLoading ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="mt-2 rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-600">
                No extra checks added yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-[10px] border border-[#D3E9FC] bg-[#FAFCFF] px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-[#113C69]">{item.label}</p>
                    {item.description?.trim() ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[#5499BF]">{item.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={(event) => void handleAddItem(event)} className="rounded-[12px] border border-[#D3E9FC] bg-[#FAFCFF] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5499BF]">
              Add extra check
            </p>
            <label className="mt-3 block text-sm font-medium text-[#113C69]">
              Short label
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Drum wash-down completed"
                className={formInputClass}
                required
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-[#113C69]">
              Guidance <span className="font-normal text-[#5499BF]">(optional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="What should the worker check?"
                className={formTextareaClass}
              />
            </label>

            {error ? (
              <p className="mt-3 rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isSaving || isLoading || isCompanyLoading}
              className="mt-3 h-10 w-full rounded-[12px] bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Plus className="mr-2 size-4" />
                  Add extra check
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
