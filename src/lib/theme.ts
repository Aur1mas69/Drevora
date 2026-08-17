import type { CompanyTheme } from '@/lib/companySettingsTypes'

function isWorkerLightShellActive(): boolean {
  if (typeof document === 'undefined') return false
  const root = document.documentElement
  if (root.classList.contains('worker-dark')) return false
  return Boolean(document.querySelector('.worker-mobile-layout'))
}

/** Applies light, dark, or system (prefers-color-scheme) theme to the document root. */
export function applyDocumentTheme(theme: CompanyTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme

  // Worker Light owns document appearance. Do not apply company/Admin `.dark`
  // while the Worker shell is showing Light — that activates Tailwind `dark:`
  // and shadcn tokens inside Worker screens (dark cards, inputs, gaps).
  if (isWorkerLightShellActive()) {
    root.classList.remove('dark')
    return
  }

  if (theme === 'dark') {
    root.classList.add('dark')
    return
  }

  if (theme === 'light') {
    root.classList.remove('dark')
    return
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  root.classList.toggle('dark', prefersDark)
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')

  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
