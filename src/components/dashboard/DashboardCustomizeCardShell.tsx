import type { AdminDashboardSortableCardId } from '@/lib/adminDashboardLayout'
import { GripVertical } from 'lucide-react'
import { useState, type ReactNode } from 'react'

type DashboardCustomizeCardShellProps = {
  id: AdminDashboardSortableCardId
  label: string
  customizing: boolean
  onReorder: (fromId: AdminDashboardSortableCardId, toId: AdminDashboardSortableCardId) => void
  children: ReactNode
}

export function DashboardCustomizeCardShell({
  id,
  label,
  customizing,
  onReorder,
  children,
}: DashboardCustomizeCardShellProps) {
  const [handleArmed, setHandleArmed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isDropTarget, setIsDropTarget] = useState(false)

  if (!customizing) {
    return <div className="min-h-0 min-w-0 [&_>_*]:h-full">{children}</div>
  }

  return (
    <div
      className={`relative min-h-0 min-w-0 ${isDropTarget ? 'ring-2 ring-[#3B82F6]/45 ring-offset-2 ring-offset-transparent' : ''}`}
      draggable={handleArmed}
      onDragStart={(event) => {
        if (!handleArmed) {
          event.preventDefault()
          return
        }
        event.dataTransfer.setData('text/plain', id)
        event.dataTransfer.effectAllowed = 'move'
        setIsDragging(true)
      }}
      onDragEnd={() => {
        setIsDragging(false)
        setHandleArmed(false)
        setIsDropTarget(false)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setIsDropTarget(true)
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDropTarget(false)
        const fromId = event.dataTransfer.getData('text/plain')
        if (fromId && fromId !== id) {
          onReorder(fromId as AdminDashboardSortableCardId, id)
        }
      }}
    >
      <button
        type="button"
        data-drag-handle
        aria-label={`Drag to reorder ${label}`}
        className="absolute left-2 top-2 z-20 inline-flex size-8 items-center justify-center rounded-lg border border-[#B7D7F2] bg-white/95 text-[#5D7C9D] shadow-sm hover:bg-[#F8FBFF] hover:text-[#163A63] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]/40 dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800"
        onPointerDown={() => setHandleArmed(true)}
        onPointerUp={() => setHandleArmed(false)}
        onPointerCancel={() => setHandleArmed(false)}
      >
        <GripVertical className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>
      <div
        className={`min-h-0 [&_>_*]:h-full ${isDragging ? 'opacity-60' : ''} pointer-events-none`}
      >
        {children}
      </div>
    </div>
  )
}
