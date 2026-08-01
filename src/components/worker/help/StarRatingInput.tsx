import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type StarRatingInputProps = {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  label?: string
}

/** Accessible 1–5 star rating control. */
export function StarRatingInput({
  value,
  onChange,
  disabled = false,
  label = 'Rating',
}: StarRatingInputProps) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold text-[color:var(--worker-text)]">
        {label}
      </legend>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => {
          const selected = star <= value
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              disabled={disabled}
              onClick={() => onChange(star)}
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-xl transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F80ED]/50',
                disabled && 'opacity-60',
              )}
            >
              <Star
                className={cn(
                  'size-7',
                  selected
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-transparent text-slate-300',
                )}
                aria-hidden
              />
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
