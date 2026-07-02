export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong' | 'very-strong'

export type PasswordCheckId = 'length' | 'case' | 'number' | 'symbol'

export type PasswordCheck = {
  id: PasswordCheckId
  label: string
  satisfied: boolean
}

const SYMBOL_PATTERN = /[^A-Za-z0-9]/

export const PASSWORD_CHECK_DEFINITIONS = [
  {
    id: 'length' as const,
    label: 'A minimum of 8 characters',
    test: (password: string) => password.length >= 8,
  },
  {
    id: 'case' as const,
    label: 'Lower and uppercase letters',
    test: (password: string) => /[a-z]/.test(password) && /[A-Z]/.test(password),
  },
  {
    id: 'number' as const,
    label: 'At least 1 number',
    test: (password: string) => /\d/.test(password),
  },
  {
    id: 'symbol' as const,
    label: 'At least 1 symbol',
    test: (password: string) => SYMBOL_PATTERN.test(password),
  },
]

export type PasswordValidationResult = {
  checks: PasswordCheck[]
  satisfiedCount: number
  isValid: boolean
  strength: PasswordStrengthLevel
}

export function evaluatePassword(password: string): PasswordValidationResult {
  const checks = PASSWORD_CHECK_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    satisfied: definition.test(password),
  }))

  const satisfiedCount = checks.filter((check) => check.satisfied).length
  const isValid = satisfiedCount === checks.length

  return {
    checks,
    satisfiedCount,
    isValid,
    strength: getPasswordStrength(password, satisfiedCount),
  }
}

export function getPasswordStrength(
  password: string,
  satisfiedCount: number,
): PasswordStrengthLevel {
  if (!password) return 'weak'
  if (satisfiedCount <= 2) return 'weak'
  if (satisfiedCount === 3) return 'medium'
  if (satisfiedCount === 4) return 'strong'
  return password.length >= 12 ? 'very-strong' : 'strong'
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword
}

export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrengthLevel, string> = {
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
  'very-strong': 'Very Strong',
}

export const PASSWORD_STRENGTH_PROGRESS: Record<PasswordStrengthLevel, number> = {
  weak: 25,
  medium: 50,
  strong: 75,
  'very-strong': 100,
}
