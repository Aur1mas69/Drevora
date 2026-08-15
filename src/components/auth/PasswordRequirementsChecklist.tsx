import { Check, Circle } from 'lucide-react'
import {
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_STRENGTH_PROGRESS,
  type PasswordCheckId,
  type PasswordStrengthLevel,
  type PasswordValidationResult,
} from '@/lib/passwordValidation'
import { useWorkerChromeText } from '@/i18n/workerLocaleContext'
import { cn } from '@/lib/utils'

function strengthBarClass(strength: PasswordStrengthLevel): string {
  switch (strength) {
    case 'weak':
      return 'bg-gradient-to-r from-rose-500 to-orange-500'
    case 'medium':
      return 'bg-gradient-to-r from-amber-400 to-yellow-500'
    case 'strong':
      return 'bg-gradient-to-r from-emerald-500 to-green-500'
    case 'very-strong':
      return 'bg-gradient-to-r from-emerald-600 to-teal-500'
  }
}

function strengthLabelClass(strength: PasswordStrengthLevel): string {
  switch (strength) {
    case 'weak':
      return 'text-rose-600 dark:text-rose-400'
    case 'medium':
      return 'text-amber-600 dark:text-amber-400'
    case 'strong':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'very-strong':
      return 'text-teal-700 dark:text-teal-300'
  }
}

type PasswordRequirementsChecklistProps = {
  id?: string
  validation: PasswordValidationResult
  /** When false, hide strength meter and checklist until the user starts typing. */
  visible?: boolean
  className?: string
  tone?: 'settings' | 'public'
}

const CHECK_COPY: Record<PasswordCheckId, { key: string; fallback: string }> = {
  length: { key: 'security.checkLength', fallback: 'At least 10 characters' },
  uppercase: { key: 'security.checkUppercase', fallback: 'At least 1 uppercase letter' },
  lowercase: { key: 'security.checkLowercase', fallback: 'At least 1 lowercase letter' },
  number: { key: 'security.checkNumber', fallback: 'At least 1 number' },
  symbol: { key: 'security.checkSymbol', fallback: 'At least 1 special character' },
}

export function PasswordRequirementsChecklist({
  id = 'password-requirements',
  validation,
  visible = true,
  className,
  tone = 'settings',
}: PasswordRequirementsChecklistProps) {
  const strengthTitle = useWorkerChromeText('security.strength', 'Password strength')
  const strengthWeak = useWorkerChromeText('security.strengthWeak', 'Weak')
  const strengthMedium = useWorkerChromeText('security.strengthMedium', 'Medium')
  const strengthStrong = useWorkerChromeText('security.strengthStrong', 'Strong')
  const strengthVeryStrong = useWorkerChromeText(
    'security.strengthVeryStrong',
    'Very Strong',
  )
  const checkLength = useWorkerChromeText(CHECK_COPY.length.key, CHECK_COPY.length.fallback)
  const checkUppercase = useWorkerChromeText(
    CHECK_COPY.uppercase.key,
    CHECK_COPY.uppercase.fallback,
  )
  const checkLowercase = useWorkerChromeText(
    CHECK_COPY.lowercase.key,
    CHECK_COPY.lowercase.fallback,
  )
  const checkNumber = useWorkerChromeText(CHECK_COPY.number.key, CHECK_COPY.number.fallback)
  const checkSymbol = useWorkerChromeText(CHECK_COPY.symbol.key, CHECK_COPY.symbol.fallback)
  const checkCompleted = useWorkerChromeText('security.checkCompleted', 'Completed: ')
  const checkIncomplete = useWorkerChromeText('security.checkIncomplete', 'Incomplete: ')
  const strengthLabels: Record<PasswordStrengthLevel, string> = {
    weak: strengthWeak,
    medium: strengthMedium,
    strong: strengthStrong,
    'very-strong': strengthVeryStrong,
  }
  const checkLabels: Record<PasswordCheckId, string> = {
    length: checkLength,
    uppercase: checkUppercase,
    lowercase: checkLowercase,
    number: checkNumber,
    symbol: checkSymbol,
  }
  const strengthLabel =
    strengthLabels[validation.strength] || PASSWORD_STRENGTH_LABELS[validation.strength]
  const strengthAria = useWorkerChromeText(
    'security.strengthAria',
    'Password strength: {{level}}',
    { level: strengthLabel },
  )

  if (!visible) return null

  const checksPanelClass =
    tone === 'public'
      ? 'space-y-2 rounded-xl bg-sky-50/80 px-3.5 py-3 ring-1 ring-sky-100'
      : 'secure-password-form__checks space-y-2 rounded-[14px] bg-[#F1F5F9]/60 px-4 py-3 ring-1 ring-[#E2E8F0]/80 dark:bg-slate-800/60 dark:ring-slate-700/80'

  const pendingTextClass =
    tone === 'public'
      ? 'text-[#64748B]'
      : 'secure-password-form__check-pending text-slate-500 dark:text-slate-400'

  const okTextClass =
    tone === 'public'
      ? 'font-medium text-emerald-700'
      : 'secure-password-form__check-ok font-medium text-emerald-700 dark:text-emerald-300'

  const idleIconClass =
    tone === 'public'
      ? 'mt-0.5 size-4 shrink-0 text-slate-300'
      : 'secure-password-form__check-idle mt-0.5 size-4 shrink-0 text-slate-300 dark:text-slate-600'

  return (
    <div id={id} className={cn('min-w-0 space-y-3', className)} aria-live="polite">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.12em]',
              tone === 'public'
                ? 'text-[#64748B]'
                : 'text-slate-500 dark:text-slate-400',
            )}
          >
            {strengthTitle}
          </p>
          <p
            className={cn(
              'text-xs font-semibold',
              strengthLabelClass(validation.strength),
            )}
          >
            {strengthLabel}
          </p>
        </div>
        <div
          className={cn(
            'h-2 overflow-hidden rounded-full',
            tone === 'public'
              ? 'bg-sky-100'
              : 'bg-slate-200/80 dark:bg-slate-700/80',
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300 ease-out',
              strengthBarClass(validation.strength),
            )}
            style={{
              width: `${PASSWORD_STRENGTH_PROGRESS[validation.strength]}%`,
            }}
            role="progressbar"
            aria-valuenow={PASSWORD_STRENGTH_PROGRESS[validation.strength]}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={strengthAria}
          />
        </div>
      </div>

      <ul className={checksPanelClass}>
        {validation.checks.map((check) => (
          <li key={check.id} className="flex min-w-0 items-start gap-2.5 text-sm">
            {check.satisfied ? (
              <Check
                className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            ) : (
              <Circle className={idleIconClass} strokeWidth={2} aria-hidden="true" />
            )}
            <span
              className={cn(
                'min-w-0 leading-5 break-words',
                check.satisfied ? okTextClass : pendingTextClass,
              )}
            >
              <span className="sr-only">
                {check.satisfied ? checkCompleted : checkIncomplete}
              </span>
              {checkLabels[check.id] ?? check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type PasswordMatchStatusMessageProps = {
  status: 'idle' | 'match' | 'mismatch'
  tone?: 'settings' | 'public'
}

export function PasswordMatchStatusMessage({
  status,
  tone = 'settings',
}: PasswordMatchStatusMessageProps) {
  const matchLabel = useWorkerChromeText('security.passwordsMatch', 'Passwords match')
  const mismatchLabel = useWorkerChromeText(
    'security.passwordsMismatch',
    'Passwords do not match',
  )
  if (status === 'idle') return null

  return (
    <p
      aria-live="polite"
      className={cn(
        'text-sm font-medium',
        status === 'match'
          ? tone === 'public'
            ? 'text-emerald-700'
            : 'text-emerald-700 dark:text-emerald-300'
          : tone === 'public'
            ? 'text-rose-600'
            : 'text-rose-600 dark:text-rose-400',
      )}
    >
      {status === 'match' ? matchLabel : mismatchLabel}
    </p>
  )
}
