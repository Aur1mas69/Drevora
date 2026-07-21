import { useState } from 'react'

type TimesheetDecimalHoursInputProps = {
  value: number
  onChange: (hours: number) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
  'data-entry-index'?: number
  'data-field'?: string
  placeholder?: string
}

/**
 * Decimal payroll-hours input (Basic / OT / Additional).
 * Empty draft while editing so clearing to 0 works (no Number(x) || fallback).
 */
export function TimesheetDecimalHoursInput({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = '0',
  ...rest
}: TimesheetDecimalHoursInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft !== null ? draft : value > 0 ? String(value) : ''

  function commit(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed === '.') {
      onChange(0)
      setDraft(null)
      return
    }
    const parsed = Number.parseFloat(trimmed)
    onChange(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
    setDraft(null)
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={0.25}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={display}
      onFocus={() => {
        setDraft(value > 0 ? String(value) : '')
      }}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        if (next.trim() === '' || next.trim() === '.') return
        const parsed = Number.parseFloat(next)
        if (Number.isFinite(parsed)) {
          onChange(Math.max(0, parsed))
        }
      }}
      onBlur={() => {
        commit(draft ?? '')
      }}
      {...rest}
    />
  )
}
