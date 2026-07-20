import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  EXPORT_DATE_RANGE_OPTIONS,
  type ExportDateRangePreset,
  type ExportDateRangeSelection,
  validateExportCustomDateRange,
} from '@/lib/export/exportDateRange'

const selectClassName =
  'h-9 w-full rounded-xl border border-[#BFE3F5] bg-white px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors hover:border-[#218EE7] focus:border-[#218EE7] focus:ring-2 focus:ring-[#218EE7]/20 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600'

type ExportDateRangeControlsProps = {
  value: ExportDateRangeSelection
  onChange: (value: ExportDateRangeSelection) => void
  onCancel?: () => void
  /** When true, show Cancel for the custom-range panel. */
  showCancel?: boolean
  className?: string
}

/**
 * Shared Admin export date-range selector (This week / month / last month / custom / all time).
 * State is owned by the parent page and kept only while mounted.
 */
export function ExportDateRangeControls({
  value,
  onChange,
  onCancel,
  showCancel = true,
  className = '',
}: ExportDateRangeControlsProps) {
  const customError = validateExportCustomDateRange(value)

  return (
    <div className={`space-y-2.5 ${className}`.trim()}>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-[#5499BF]">Date range</span>
        <select
          value={value.preset}
          onChange={(event) =>
            onChange({
              ...value,
              preset: event.target.value as ExportDateRangePreset,
            })
          }
          className={selectClassName}
          aria-label="Export date range"
        >
          {EXPORT_DATE_RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {value.preset === 'custom' ? (
        <div className="space-y-2 rounded-xl border border-[#D3E9FC] bg-[#F5FAFF] p-2.5 dark:border-white/10 dark:bg-slate-800/50">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#5499BF]">Start date</span>
            <Input
              type="date"
              value={value.customFrom}
              onChange={(event) =>
                onChange({
                  ...value,
                  customFrom: event.target.value,
                })
              }
              className="h-9 rounded-xl border-[#BFE3F5] bg-white text-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
              aria-label="Export start date"
              aria-invalid={Boolean(customError)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#5499BF]">End date</span>
            <Input
              type="date"
              value={value.customTo}
              onChange={(event) =>
                onChange({
                  ...value,
                  customTo: event.target.value,
                })
              }
              className="h-9 rounded-xl border-[#BFE3F5] bg-white text-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
              aria-label="Export end date"
              aria-invalid={Boolean(customError)}
            />
          </label>
          {customError ? (
            <p className="text-xs font-medium text-rose-600" role="alert">
              {customError}
            </p>
          ) : null}
          {showCancel && onCancel ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="h-8 w-full rounded-xl text-xs font-semibold text-[#0B68BE] hover:bg-[#EEF6FF] dark:text-blue-300 dark:hover:bg-slate-800"
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
