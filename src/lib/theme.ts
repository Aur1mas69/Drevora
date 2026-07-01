import type { CompanyTheme } from '@/lib/companySettingsTypes'

/** Applies light, dark, or system (prefers-color-scheme) theme to the document root. */
export function applyDocumentTheme(theme: CompanyTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme

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
