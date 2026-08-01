import {
  ConsumableFormModal,
  consumableFormValuesToInput,
} from '@/components/consumables/ConsumableFormModal'
import { Button } from '@/components/ui/button'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import type { Consumable, ConsumableFormSubmitPayload } from '@/lib/consumableTypes'
import { workerAccentCardClass } from '@/lib/workerDarkAccent'
import { cn } from '@/lib/utils'
import {
  formatConsumableEntryDateTime,
  formatConsumableItemCost,
  formatQuantityWithUnit,
  formatSupplierSite,
  getConsumableTypeBadgeClass,
} from '@/lib/consumableUtils'
import {
  createConsumable,
  fetchConsumables,
  updateConsumable,
  ConsumablesServiceError,
} from '@/services/consumablesService'
import {
  applyConsumableReceiptChanges,
  ConsumableReceiptStorageError,
  deleteConsumableReceipt,
} from '@/services/consumableReceiptStorageService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function WorkerConsumablesPage() {
  const isDark = useIsWorkerDarkMode()
  const { formatDate, formatTime, settings } = useCompanySettings()
  const { companyReady, companyId, companyLoading, membershipError } = useCompanyTenantGate()
  const { worker, isLoading: workerLoading, error: workerError } = useCurrentWorker()
  const [searchParams] = useSearchParams()
  const preselectedVehicleId = searchParams.get('vehicleId')?.trim() || null

  const [items, setItems] = useState<Consumable[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editRecord, setEditRecord] = useState<Consumable | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const workerName = worker
    ? `${worker.firstName} ${worker.lastName}`.trim()
    : null

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  const loadData = useCallback(async () => {
    if (!worker?.id) {
      setItems([])
      setVehicles([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)
    try {
      const [result, vehicleRows] = await Promise.all([
        fetchConsumables({
          workerId: worker.id,
          viewMode: 'current',
          page: 1,
          pageSize: 50,
        }),
        fetchVehicles(),
      ])
      setItems(result.items)
      setVehicles(vehicleRows)
    } catch (error) {
      setItems([])
      setLoadError(
        error instanceof ConsumablesServiceError
          ? error.message
          : 'Unable to load your consumables.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [worker])

  useEffect(() => {
    let cancelled = false

    void Promise.resolve().then(async () => {
      if (cancelled) return

      if (!companyReady || !companyId) {
        if (!companyLoading) {
          setIsLoading(false)
          setItems([])
          setVehicles([])
          if (membershipError) setLoadError(membershipError)
        }
        return
      }

      await loadData()
    })

    return () => {
      cancelled = true
    }
  }, [companyId, companyLoading, companyReady, loadData, membershipError])

  function openCreate() {
    setFormMode('create')
    setEditRecord(null)
    setIsFormOpen(true)
  }

  function openEdit(record: Consumable) {
    if (!worker?.id || record.workerId !== worker.id) {
      showToast('You can only edit your own consumable entries.')
      return
    }
    setFormMode('edit')
    setEditRecord(record)
    setIsFormOpen(true)
  }

  async function handleFormSubmit(payload: ConsumableFormSubmitPayload) {
    if (!worker?.id) {
      throw new ConsumablesServiceError('Unable to identify your worker profile.')
    }

    setIsSaving(true)
    const companySettingsId = settings?.id

    try {
      const input = {
        ...consumableFormValuesToInput(
          payload.values,
          settings?.consumableDefaultPrices ?? {},
        ),
        workerId: worker.id,
      }
      const existingReceiptPath = editRecord?.receiptUrl ?? null

      if (formMode === 'create') {
        const created = await createConsumable(input)

        if (companySettingsId && payload.receiptFile) {
          const receiptPath = await applyConsumableReceiptChanges({
            companyId: companySettingsId,
            consumableId: created.id,
            existingReceiptPath: null,
            receiptFile: payload.receiptFile,
            removeReceipt: false,
          })
          await updateConsumable(created.id, { receiptUrl: receiptPath })
        }

        showToast('Consumable entry saved')
      } else if (editRecord) {
        if (editRecord.workerId !== worker.id) {
          throw new ConsumablesServiceError('You can only edit your own consumable entries.')
        }

        await updateConsumable(editRecord.id, { ...input, workerId: worker.id })

        if (payload.removeReceipt) {
          if (existingReceiptPath) {
            try {
              await deleteConsumableReceipt(existingReceiptPath)
            } catch {
              /* clear DB even if storage delete fails */
            }
          }
          await updateConsumable(editRecord.id, { receiptUrl: null })
        } else if (companySettingsId && payload.receiptFile) {
          const receiptPath = await applyConsumableReceiptChanges({
            companyId: companySettingsId,
            consumableId: editRecord.id,
            existingReceiptPath,
            receiptFile: payload.receiptFile,
            removeReceipt: false,
          })
          await updateConsumable(editRecord.id, { receiptUrl: receiptPath })
        }

        showToast('Consumable entry updated')
      }

      await loadData()
    } catch (error) {
      if (
        error instanceof ConsumableReceiptStorageError ||
        error instanceof ConsumablesServiceError
      ) {
        throw error
      }
      throw new ConsumablesServiceError('Failed to save consumable entry.')
    } finally {
      setIsSaving(false)
    }
  }

  if (workerLoading || companyLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <Loader2 className="size-6 animate-spin text-[color:var(--worker-accent)]" />
      </div>
    )
  }

  if (workerError || !worker) {
    return (
      <div className="px-4 py-8">
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {workerError || 'Worker profile required to add consumables.'}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--worker-text)]">
            Consumables
          </h1>
          <p className="mt-1 text-sm text-[color:var(--worker-text-muted)]">
            Log fuel and fluids with the real pump price from your receipt.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="h-10 shrink-0 rounded-2xl bg-[color:var(--worker-accent)] px-3 text-sm font-semibold text-white"
        >
          <Plus className="mr-1 size-4" />
          Add
        </Button>
      </div>

      {loadError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="size-6 animate-spin text-[color:var(--worker-accent)]" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[color:var(--worker-text)]">
            No consumable entries yet
          </p>
          <p className="mt-1 text-sm text-[color:var(--worker-text-muted)]">
            Add Diesel, AdBlue or other fluids with quantity and unit price.
          </p>
          <Button
            type="button"
            onClick={openCreate}
            className="mt-4 h-10 rounded-2xl bg-[color:var(--worker-accent)] px-4 text-sm font-semibold text-white"
          >
            Add entry
          </Button>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={workerAccentCardClass(
                index,
                isDark,
                'rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-4',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={cn(
                      'worker-accent-badge inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                      !isDark && getConsumableTypeBadgeClass(item.consumableType),
                    )}
                  >
                    {item.consumableType}
                  </span>
                  <p
                    className={cn(
                      'worker-accent-title mt-2 truncate text-base font-semibold',
                      !isDark && 'text-[color:var(--worker-text)]',
                    )}
                  >
                    {item.itemName?.trim() || item.consumableType}
                  </p>
                  <p
                    className={cn(
                      'worker-accent-muted mt-0.5 text-sm',
                      !isDark && 'text-[color:var(--worker-text-muted)]',
                    )}
                  >
                    {item.vehicleLabel ?? 'No vehicle'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className={cn(
                    'worker-accent-muted inline-flex size-9 items-center justify-center rounded-xl',
                    !isDark &&
                      'text-[color:var(--worker-text-muted)] hover:bg-[color:var(--worker-input)] hover:text-[color:var(--worker-text)]',
                  )}
                  aria-label="Edit consumable"
                >
                  <Pencil className="size-4" />
                </button>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt
                    className={cn(
                      'worker-accent-muted',
                      !isDark && 'text-[color:var(--worker-text-muted)]',
                    )}
                  >
                    Quantity
                  </dt>
                  <dd
                    className={cn(
                      'worker-accent-value font-semibold',
                      !isDark && 'text-[color:var(--worker-text)]',
                    )}
                  >
                    {formatQuantityWithUnit(item.quantity, item.unit)}
                  </dd>
                </div>
                <div>
                  <dt
                    className={cn(
                      'worker-accent-muted',
                      !isDark && 'text-[color:var(--worker-text-muted)]',
                    )}
                  >
                    Total
                  </dt>
                  <dd
                    className={cn(
                      'worker-accent-value font-semibold',
                      !isDark && 'text-[color:var(--worker-text)]',
                    )}
                  >
                    {formatConsumableItemCost(
                      item,
                      settings?.consumableDefaultPrices ?? {},
                      settings?.currency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt
                    className={cn(
                      'worker-accent-muted',
                      !isDark && 'text-[color:var(--worker-text-muted)]',
                    )}
                  >
                    When
                  </dt>
                  <dd
                    className={cn(
                      'worker-accent-value font-medium',
                      !isDark && 'text-[color:var(--worker-text)]',
                    )}
                  >
                    {formatConsumableEntryDateTime(
                      item.entryDate,
                      item.entryTime,
                      formatDate,
                      formatTime,
                    )}
                  </dd>
                </div>
                <div>
                  <dt
                    className={cn(
                      'worker-accent-muted',
                      !isDark && 'text-[color:var(--worker-text-muted)]',
                    )}
                  >
                    Location
                  </dt>
                  <dd
                    className={cn(
                      'worker-accent-value truncate font-medium',
                      !isDark && 'text-[color:var(--worker-text)]',
                    )}
                  >
                    {formatSupplierSite(item.supplier, item.site)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {toastMessage ? (
        <div className="worker-toast-success fixed bottom-24 left-1/2 z-[70] w-[min(92vw,24rem)] -translate-x-1/2 rounded-xl bg-[color:var(--worker-text)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--worker-bg)] shadow-lg">
          {toastMessage}
        </div>
      ) : null}

      <ConsumableFormModal
        isOpen={isFormOpen}
        mode={formMode}
        record={editRecord}
        vehicles={vehicles}
        workers={worker ? [worker] : []}
        lockedWorkerId={worker.id}
        lockedWorkerName={workerName}
        initialVehicleId={
          formMode === 'create'
            ? preselectedVehicleId &&
              vehicles.some((vehicle) => vehicle.id === preselectedVehicleId)
              ? preselectedVehicleId
              : worker.defaultVehicleId &&
                  vehicles.some((vehicle) => vehicle.id === worker.defaultVehicleId)
                ? worker.defaultVehicleId
                : null
            : null
        }
        isSaving={isSaving}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />
    </div>
  )
}
