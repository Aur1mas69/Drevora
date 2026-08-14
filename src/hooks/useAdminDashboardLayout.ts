import { useCallback, useState } from 'react'
import {
  DEFAULT_ADMIN_DASHBOARD_LAYOUT,
  isAdminDashboardCardHidden,
  moveSortableCard,
  readAdminDashboardLayout,
  visibleSortableCardIds,
  writeAdminDashboardLayout,
  type AdminDashboardCardId,
  type AdminDashboardLayoutV1,
  type AdminDashboardSortableCardId,
} from '@/lib/adminDashboardLayout'

export function useAdminDashboardLayout() {
  const [layout, setLayout] = useState<AdminDashboardLayoutV1>(readAdminDashboardLayout)
  const [customizing, setCustomizing] = useState(false)

  const persist = useCallback((next: AdminDashboardLayoutV1) => {
    setLayout(next)
    writeAdminDashboardLayout(next)
  }, [])

  const reorder = useCallback(
    (fromId: AdminDashboardSortableCardId, toId: AdminDashboardSortableCardId) => {
      setLayout((current) => {
        const next = {
          ...current,
          order: moveSortableCard(current.order, fromId, toId),
        }
        writeAdminDashboardLayout(next)
        return next
      })
    },
    [],
  )

  const toggleHidden = useCallback((id: AdminDashboardCardId) => {
    setLayout((current) => {
      const hidden = current.hidden.includes(id)
        ? current.hidden.filter((item) => item !== id)
        : [...current.hidden, id]
      const next = { ...current, hidden }
      writeAdminDashboardLayout(next)
      return next
    })
  }, [])

  const resetToDefault = useCallback(() => {
    persist({
      ...DEFAULT_ADMIN_DASHBOARD_LAYOUT,
      order: [...DEFAULT_ADMIN_DASHBOARD_LAYOUT.order],
      hidden: [],
    })
  }, [persist])

  return {
    layout,
    customizing,
    setCustomizing,
    visibleSortableIds: visibleSortableCardIds(layout),
    isHidden: (id: AdminDashboardCardId) => isAdminDashboardCardHidden(layout, id),
    reorder,
    toggleHidden,
    resetToDefault,
  }
}

export type AdminDashboardLayoutControls = ReturnType<typeof useAdminDashboardLayout>
