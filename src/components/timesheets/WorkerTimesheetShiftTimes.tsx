import { cn } from '@/lib/utils'
import { parseClockTime } from '@/lib/dateTimeFormat'
import { useEffect, useId, useRef, useState } from 'react'

type PickerMode = 'start' | 'finish'

type WorkerTimesheetShiftTimesProps = {
  startValue: string | null
  finishValue: string | null
  onStartChange: (value: string | null) => void
  onFinishChange: (value: string | null) => void
  startInvalid?: boolean
  finishInvalid?: boolean
  className?: string
}

function formatClock(hour24: number, minute: number): string {
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function digitsOnly(raw: string, maxLength: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLength)
}

function parseHourDraft(raw: string): number | null {
  if (!raw.trim()) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 23) return null
  return value
}

function parseMinuteDraft(raw: string): number | null {
  if (!raw.trim()) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 59) return null
  return value
}

function splitValue(value: string | null): { hourText: string; minuteText: string } {
  const parsed = value ? parseClockTime(value) : null
  if (!parsed) return { hourText: '', minuteText: '' }
  return {
    hourText: String(parsed.hours).padStart(2, '0'),
    minuteText: String(parsed.minutes).padStart(2, '0'),
  }
}

function formatDisplayValue(value: string | null): string {
  const parts = splitValue(value)
  if (!parts.hourText || !parts.minuteText) return ''
  return `${parts.hourText}:${parts.minuteText}`
}

/**
 * Worker mobile Start → Finish time flow.
 * One shared picker: Start mode uses Next; Finish mode uses Done.
 */
export function WorkerTimesheetShiftTimes({
  startValue,
  finishValue,
  onStartChange,
  onFinishChange,
  startInvalid = false,
  finishInvalid = false,
  className,
}: WorkerTimesheetShiftTimesProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const hourRef = useRef<HTMLInputElement>(null)
  const minuteRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)
  const fieldId = useId()

  const [mode, setMode] = useState<PickerMode | null>(null)
  const [hourText, setHourText] = useState('')
  const [minuteText, setMinuteText] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [panelBottom, setPanelBottom] = useState(12)
  const [focusToken, setFocusToken] = useState(0)

  const isEditing = mode !== null
  const hourValue = parseHourDraft(hourText)
  const minuteValue = parseMinuteDraft(minuteText)
  const canConfirm = hourValue !== null && minuteValue !== null

  function loadModeValue(nextMode: PickerMode) {
    const source = nextMode === 'start' ? startValue : finishValue
    const parts = splitValue(source)
    setHourText(parts.hourText)
    setMinuteText(parts.minuteText)
    setLocalError(null)
  }

  function openMode(nextMode: PickerMode) {
    if (processingRef.current) return
    loadModeValue(nextMode)
    setMode(nextMode)
    setFocusToken((token) => token + 1)
  }

  function closePicker() {
    setMode(null)
    setLocalError(null)
    setHourText('')
    setMinuteText('')
    processingRef.current = false
    hourRef.current?.blur()
    minuteRef.current?.blur()
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }

  function discardDraft() {
    if (processingRef.current) return
    closePicker()
  }

  useEffect(() => {
    if (!isEditing) return

    function updatePanelPosition() {
      const vv = window.visualViewport
      if (!vv) {
        setPanelBottom(12)
        return
      }
      const obscured = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))
      setPanelBottom(Math.max(12, obscured + 12))
    }

    updatePanelPosition()
    const vv = window.visualViewport
    vv?.addEventListener('resize', updatePanelPosition)
    vv?.addEventListener('scroll', updatePanelPosition)
    window.addEventListener('resize', updatePanelPosition)
    return () => {
      vv?.removeEventListener('resize', updatePanelPosition)
      vv?.removeEventListener('scroll', updatePanelPosition)
      window.removeEventListener('resize', updatePanelPosition)
    }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) return
    window.setTimeout(() => hourRef.current?.focus(), 0)
  }, [isEditing, mode, focusToken])

  useEffect(() => {
    if (!isEditing) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      discardDraft()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('touchstart', handlePointerDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isEditing])

  function handleHourChange(raw: string) {
    const digits = digitsOnly(raw, 2)
    if (digits.length === 2) {
      const parsed = parseHourDraft(digits)
      if (parsed === null) {
        setLocalError('Hours must be 00–23.')
        setHourText(digits.slice(0, 1))
        return
      }
      setHourText(String(parsed).padStart(2, '0'))
      setLocalError(null)
      window.setTimeout(() => minuteRef.current?.focus(), 0)
      return
    }
    setHourText(digits)
    setLocalError(null)
  }

  function handleMinuteChange(raw: string) {
    const digits = digitsOnly(raw, 2)
    if (digits.length === 2) {
      const parsed = parseMinuteDraft(digits)
      if (parsed === null) {
        setLocalError('Minutes must be 00–59.')
        setMinuteText(digits.slice(0, 1))
        return
      }
      setMinuteText(String(parsed).padStart(2, '0'))
      setLocalError(null)
      return
    }
    setMinuteText(digits)
    setLocalError(null)
  }

  function resolveValidatedTime(): string | null {
    const hour24 = parseHourDraft(hourText)
    const minute = parseMinuteDraft(minuteText)
    if (hour24 === null || minute === null) {
      setLocalError('Enter both hours and minutes.')
      return null
    }
    return formatClock(hour24, minute)
  }

  function handlePrimaryAction() {
    if (processingRef.current || !mode) return

    const nextValue = resolveValidatedTime()
    if (!nextValue) return

    processingRef.current = true

    if (mode === 'start') {
      onStartChange(nextValue)
      // Stay open and switch into Finish mode with existing Finish prefilled.
      const finishParts = splitValue(finishValue)
      setHourText(finishParts.hourText)
      setMinuteText(finishParts.minuteText)
      setLocalError(null)
      setMode('finish')
      setFocusToken((token) => token + 1)
      processingRef.current = false
      return
    }

    onFinishChange(nextValue)
    closePicker()
  }

  function handleClear() {
    if (processingRef.current || !mode) return
    processingRef.current = true

    if (mode === 'start') {
      onStartChange(null)
      setHourText('')
      setMinuteText('')
      setLocalError(null)
      processingRef.current = false
      return
    }

    onFinishChange(null)
    setHourText('')
    setMinuteText('')
    setLocalError(null)
    processingRef.current = false
  }

  const panelInputClass =
    'h-12 w-full min-w-0 rounded-[12px] border border-slate-200 bg-[#F8FBFF] px-1 text-center text-lg font-semibold tabular-nums text-slate-950 outline-none placeholder:text-slate-300 focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/25'

  const triggerClass = cn(
    'flex h-12 w-full min-w-0 max-w-full items-center justify-center truncate rounded-2xl border border-slate-200 bg-[#F8FBFF] px-2 text-sm font-semibold tabular-nums text-slate-950 outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20',
    className,
  )

  const startDisplay = formatDisplayValue(startValue)
  const finishDisplay = formatDisplayValue(finishValue)
  const headerLabel = mode === 'start' ? 'START TIME' : 'FINISH TIME'
  const primaryLabel = mode === 'start' ? 'Next' : 'Done'

  return (
    <div className="min-w-0 w-full">
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Start
          </span>
          <button
            type="button"
            onClick={() => openMode('start')}
            aria-invalid={startInvalid}
            aria-expanded={mode === 'start'}
            className={cn(
              triggerClass,
              !startDisplay && 'text-slate-400',
              startInvalid && 'ring-2 ring-rose-200',
              mode === 'start' && 'border-[#2F80ED] ring-2 ring-[#2F80ED]/20',
            )}
          >
            {startDisplay || 'HH:MM'}
          </button>
        </label>

        <label className="min-w-0 space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Finish
          </span>
          <button
            type="button"
            onClick={() => openMode('finish')}
            aria-invalid={finishInvalid}
            aria-expanded={mode === 'finish'}
            className={cn(
              triggerClass,
              !finishDisplay && 'text-slate-400',
              finishInvalid && 'ring-2 ring-rose-200',
              mode === 'finish' && 'border-[#2F80ED] ring-2 ring-[#2F80ED]/20',
            )}
          >
            {finishDisplay || 'HH:MM'}
          </button>
        </label>
      </div>

      {isEditing ? (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/25"
          aria-hidden="true"
          onMouseDown={(event) => {
            event.preventDefault()
            discardDraft()
          }}
        />
      ) : null}

      {isEditing && mode ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={headerLabel}
          className="fixed z-[90] w-auto max-w-[calc(100vw-24px)] rounded-[16px] border border-[rgba(75,120,220,0.16)] bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900"
          style={{
            left: 12,
            right: 12,
            bottom: panelBottom,
            maxHeight: 'min(320px, calc(100dvh - 24px))',
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {headerLabel}
          </p>

          <div className="mt-2 flex w-full min-w-0 items-center gap-1.5">
            <label className="min-w-0 flex-1 basis-0">
              <span className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                HH
              </span>
              <input
                ref={hourRef}
                id={`${fieldId}-hh`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={2}
                placeholder="00"
                value={hourText}
                onChange={(event) => handleHourChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (canConfirm) handlePrimaryAction()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    discardDraft()
                  }
                }}
                className={panelInputClass}
              />
            </label>

            <span
              className="mt-5 shrink-0 select-none text-xl font-bold text-slate-400"
              aria-hidden="true"
            >
              :
            </span>

            <label className="min-w-0 flex-1 basis-0">
              <span className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                MM
              </span>
              <input
                ref={minuteRef}
                id={`${fieldId}-mm`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={2}
                placeholder="00"
                value={minuteText}
                onChange={(event) => handleMinuteChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (canConfirm) handlePrimaryAction()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    discardDraft()
                  }
                }}
                className={panelInputClass}
              />
            </label>
          </div>

          {localError ? (
            <p className="mt-2 text-xs font-medium text-rose-600">{localError}</p>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">
              Hours 00–23 · Minutes 00–59
            </p>
          )}

          <div className="mt-2.5 grid w-full min-w-0 grid-cols-2 gap-2">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleClear}
              className="h-10 min-w-0 rounded-[12px] border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handlePrimaryAction}
              disabled={!canConfirm}
              className={cn(
                'h-10 min-w-0 rounded-[12px] text-sm font-semibold text-white',
                canConfirm
                  ? 'bg-[#2563EB] hover:bg-[#1d4ed8]'
                  : 'cursor-not-allowed bg-slate-300',
              )}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
