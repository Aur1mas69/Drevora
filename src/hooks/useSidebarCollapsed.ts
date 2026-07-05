import { useCallback, useState } from 'react'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'drevora-sidebar-collapsed'

function readSidebarCollapsedPreference(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(readSidebarCollapsedPreference)

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value))
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return { collapsed, setCollapsed, toggleCollapsed }
}
