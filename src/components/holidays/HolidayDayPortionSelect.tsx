import type { HolidayDayPortion } from '@/lib/holidayRequestTypes'
import { HOLIDAY_DAY_PORTION_OPTIONS } from '@/lib/timesheetHoliday'

type HolidayDayPortionSelectProps = {
  value: HolidayDayPortion
  onChange: (value: HolidayDayPortion) => void
  label: string
  className?: string
  id?: string
  disabled?: boolean
}

export function HolidayDayPortionSelect({
  value,
  onChange,
  label,
  className,
  id,
  disabled = false,
}: HolidayDayPortionSelectProps) {
  return (
    <label className={`block text-sm font-medium text-slate-700 dark:text-slate-300 ${className ?? ''}`}>
      {label}
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as HolidayDayPortion)}
        className="mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:ring-blue-900/40"
        aria-label={label}
      >
        {HOLIDAY_DAY_PORTION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
