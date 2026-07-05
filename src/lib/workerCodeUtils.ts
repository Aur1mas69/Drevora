/** Uppercase letters without O or I */
export const WORKER_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

/** Digits without 0 or 1 */
export const WORKER_CODE_DIGITS = '23456789'

export const WORKER_CODE_ALPHABET = `${WORKER_CODE_LETTERS}${WORKER_CODE_DIGITS}`

export const WORKER_CODE_LENGTH = 5

export function normalizeWorkerCompanyScope(
  company: string | null | undefined,
): string {
  return company?.trim() ?? ''
}

function pickRandomChar(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

function shuffleChars(chars: string[]): string[] {
  const copy = [...chars]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

/** 5 chars with at least one letter and one digit, positions shuffled. */
export function generateWorkerCodeCandidate(): string {
  const chars: string[] = [
    pickRandomChar(WORKER_CODE_LETTERS),
    pickRandomChar(WORKER_CODE_DIGITS),
  ]

  while (chars.length < WORKER_CODE_LENGTH) {
    const pool =
      Math.random() < 0.5 ? WORKER_CODE_LETTERS : WORKER_CODE_DIGITS
    chars.push(pickRandomChar(pool))
  }

  return shuffleChars(chars).join('')
}

export function isValidWorkerCode(value: string | null | undefined): boolean {
  if (!value?.trim()) return false

  const trimmed = value.trim().toUpperCase()
  if (trimmed.length !== WORKER_CODE_LENGTH) return false

  let hasLetter = false
  let hasDigit = false

  for (const char of trimmed) {
    if (WORKER_CODE_LETTERS.includes(char)) {
      hasLetter = true
      continue
    }
    if (WORKER_CODE_DIGITS.includes(char)) {
      hasDigit = true
      continue
    }
    return false
  }

  return hasLetter && hasDigit
}

export function workerNeedsWorkerCode(value: string | null | undefined): boolean {
  return !isValidWorkerCode(value)
}
