/**
 * Process-local flag: Worker has an in-progress Vehicle/Tyre check.
 * Used by the legal gate to defer Terms interruption until the check finishes.
 * Not persisted — intentional (session only).
 */

type Listener = () => void

let active = false
const listeners = new Set<Listener>()

export function isWorkerActiveCheckSession(): boolean {
  return active
}

export function setWorkerActiveCheckSession(next: boolean): void {
  const value = Boolean(next)
  if (active === value) return
  active = value
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeWorkerActiveCheckSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
