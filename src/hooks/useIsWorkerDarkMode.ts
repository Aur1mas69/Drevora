import { useSyncExternalStore } from 'react'

function subscribeWorkerDarkMode(onChange: () => void): () => void {
  const root = document.documentElement
  const observer = new MutationObserver(onChange)
  observer.observe(root, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function getWorkerDarkModeSnapshot(): boolean {
  return document.documentElement.classList.contains('worker-dark')
}

function getWorkerDarkModeServerSnapshot(): boolean {
  return false
}

/**
 * Reactive read of the `worker-dark` class toggled by `src/lib/workerAppearance.ts`
 * (Worker Settings → Appearance).
 */
export function useIsWorkerDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeWorkerDarkMode,
    getWorkerDarkModeSnapshot,
    getWorkerDarkModeServerSnapshot,
  )
}
