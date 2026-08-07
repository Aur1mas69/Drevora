import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  formatTyrePressureDisplay,
  parseTyrePressureValue,
  parseTyreTreadDepthMm,
  type SavedTyreCheck,
  type TyrePressureUnit,
} from '@/lib/tyreCheckTypes'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

type DraftRow = {
  itemId: string
  label: string
  treadInput: string
  pressureInput: string
}

type CorrectTyreCheckModalProps = {
  check: SavedTyreCheck | null
  isOpen: boolean
  isSaving: boolean
  errorMessage: string | null
  onClose: () => void
  onConfirm: (payload: {
    reason: string
    pressureUnit: TyrePressureUnit
    items: Array<{
      itemId: string
      treadDepthMm: number | null
      pressureValue: number | null
    }>
  }) => void
}

/** Office-only measurement correction for a completed Tyre Check. */
export function CorrectTyreCheckModal({
  check,
  isOpen,
  isSaving,
  errorMessage,
  onClose,
  onConfirm,
}: CorrectTyreCheckModalProps) {
  const [reason, setReason] = useState('')
  const [pressureUnit, setPressureUnit] = useState<TyrePressureUnit>('bar')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !check) return
    setReason('')
    setLocalError(null)
    setPressureUnit(check.pressureUnit ?? 'bar')
    setRows(
      check.measurements
        .filter((item) => Boolean(item.dbItemId))
        .map((item) => ({
          itemId: item.dbItemId as string,
          label: `${item.axleLabel} · ${item.position}`,
          treadInput: item.treadDepthMm == null ? '' : String(item.treadDepthMm),
          pressureInput:
            item.pressureValue == null ? '' : String(item.pressureValue),
        })),
    )
  }, [isOpen, check])

  if (!isOpen || !check) return null

  function handleSubmit() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setLocalError('Enter a correction reason.')
      return
    }

    const items: Array<{
      itemId: string
      treadDepthMm: number | null
      pressureValue: number | null
    }> = []

    for (const row of rows) {
      const tread = parseTyreTreadDepthMm(row.treadInput)
      if (!tread.ok) {
        setLocalError(`${row.label}: ${tread.error}`)
        return
      }
      if (tread.value == null) {
        setLocalError(`${row.label}: tread depth is required.`)
        return
      }
      const pressure = parseTyrePressureValue(row.pressureInput)
      if (!pressure.ok) {
        setLocalError(`${row.label}: ${pressure.error}`)
        return
      }
      items.push({
        itemId: row.itemId,
        treadDepthMm: tread.value,
        pressureValue: pressure.value,
      })
    }

    setLocalError(null)
    onConfirm({ reason: trimmed, pressureUnit, items })
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="correct-tyre-check-title"
        className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-900/95 dark:ring-white/10 dark:shadow-black/50 sm:max-h-[90vh] sm:rounded-[20px]"
      >
        <div className="shrink-0 border-b border-[#D3E9FC] px-5 py-4 dark:border-white/10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563EB]">
            Correct Tyre Check
          </p>
          <h2
            id="correct-tyre-check-title"
            className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-100"
          >
            Correct measurement details
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Original values are kept in the audit trail. Vehicle and Worker stay
            unchanged. Pressure remains optional.
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {check.vehicleLabel}
            {check.trailerLabel ? ` + ${check.trailerLabel}` : ''} · {check.checkedBy}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Pressure unit
            </span>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pressure unit">
              {(['bar', 'psi'] as const).map((unit) => {
                const selected = pressureUnit === unit
                return (
                  <button
                    key={unit}
                    type="button"
                    disabled={isSaving}
                    aria-pressed={selected}
                    onClick={() => setPressureUnit(unit)}
                    className={cn(
                      'h-10 rounded-[12px] border text-sm font-bold uppercase tracking-[0.08em]',
                      selected
                        ? 'border-[#2563EB] bg-[#2563EB] text-white'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200',
                    )}
                  >
                    {unit}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.itemId}
                className="rounded-[14px] border border-[#D3E9FC] p-3 dark:border-white/10"
              >
                <p className="text-sm font-semibold text-[#2A376F] dark:text-slate-100">
                  {row.label}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Tread depth (mm)
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step={0.5}
                      min={0}
                      max={30}
                      disabled={isSaving}
                      value={row.treadInput}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.itemId === row.itemId
                              ? { ...item, treadInput: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="h-10 rounded-[10px]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Pressure ({pressureUnit}, optional)
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step={0.1}
                      min={0}
                      max={200}
                      disabled={isSaving}
                      value={row.pressureInput}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.itemId === row.itemId
                              ? { ...item, pressureInput: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="h-10 rounded-[10px]"
                      placeholder="Not recorded"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Correction reason (required)
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isSaving}
              rows={3}
              className="mt-2 w-full resize-y rounded-[12px] border border-[rgba(75,120,220,0.18)] bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#2563EB] dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100"
              placeholder="Describe why these measurements need correcting…"
            />
          </label>

          {localError || errorMessage ? (
            <div className="rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
              {localError || errorMessage}
            </div>
          ) : null}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current pressure display unit example:{' '}
            {formatTyrePressureDisplay(8.5, pressureUnit)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#D3E9FC] px-5 py-4 dark:border-white/10 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="h-11 rounded-[16px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-11 rounded-[16px] bg-[#2563EB] font-semibold text-white hover:bg-[#1d4ed8]"
          >
            {isSaving ? 'Saving…' : 'Save correction'}
          </Button>
        </div>
      </div>
    </div>
  )
}
