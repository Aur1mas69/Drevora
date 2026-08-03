export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong' | 'very-strong'

export type PasswordCheckId =
  | 'length'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'symbol'

export type PasswordCheck = {
  id: PasswordCheckId
  label: string
  satisfied: boolean
}

export const PASSWORD_MIN_LENGTH = 10

const SYMBOL_PATTERN = /[^A-Za-z0-9]/

export const PASSWORD_CHECK_DEFINITIONS = [
  {
    id: 'length' as const,
    label: 'At least 10 characters',
    test: (password: string) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'uppercase' as const,
    label: 'At least 1 uppercase letter',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase' as const,
    label: 'At least 1 lowercase letter',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: 'number' as const,
    label: 'At least 1 number',
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    id: 'symbol' as const,
    label: 'At least 1 special character',
    test: (password: string) => SYMBOL_PATTERN.test(password),
  },
]

export type PasswordValidationResult = {
  checks: PasswordCheck[]
  satisfiedCount: number
  isValid: boolean
  strength: PasswordStrengthLevel
}

export type PasswordMatchStatus = 'idle' | 'match' | 'mismatch'

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
  // All five requirements satisfied.
  return password.length >= 14 ? 'very-strong' : 'strong'
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword
}

export function getPasswordMatchStatus(
  password: string,
  confirmPassword: string,
): PasswordMatchStatus {
  if (confirmPassword.length === 0) return 'idle'
  return passwordsMatch(password, confirmPassword) ? 'match' : 'mismatch'
}

export function getPasswordPolicyError(
  password: string,
  confirmPassword: string,
): string | null {
  if (!password || !confirmPassword) {
    return 'Both password fields are required.'
  }

  const validation = evaluatePassword(password)
  if (!validation.isValid) {
    return 'Password does not meet all requirements.'
  }

  if (!passwordsMatch(password, confirmPassword)) {
    return 'Passwords do not match.'
  }

  return null
}

export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrengthLevel, string> = {
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
  'very-strong': 'Very Strong',
}

export const PASSWORD_STRENGTH_PROGRESS: Record<PasswordStrengthLevel, number> = {
  weak: 20,
  medium: 40,
  strong: 70,
  'very-strong': 100,
}
