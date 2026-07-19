import { Button } from '@/components/ui/button'
import { ChevronDown, Download, Loader2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export type ExportMenuAction = {
  id: string
  label: string
  onSelect: () => void | Promise<void>
  disabled?: boolean
}

type ExportMenuProps = {
  actions: ExportMenuAction[]
  busy?: boolean
  busyLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * Shared Export dropdown for module toolbars.
 * Does not start a download until an action is chosen.
 */
export function ExportMenu({
  actions,
  busy = false,
  busyLabel = 'Preparing export…',
  disabled = false,
  className = '',
}: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const controlsDisabled = disabled || busy || actions.length === 0

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (busy) setOpen(false)
  }, [busy])

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`.trim()}>
      <Button
        type="button"
        variant="outline"
        disabled={controlsDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={busy ? busyLabel : 'Export'}
        onClick={() => setOpen((value) => !value)}
        className="h-11 rounded-2xl border border-[#BFE3F5] bg-[#E8F3FE] px-3 font-semibold text-[#0B68BE] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#89CFF0] hover:bg-[#DCEEFF] focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/70 disabled:pointer-events-none disabled:opacity-60 dark:border-white/10 dark:bg-slate-800/70 dark:text-blue-300 dark:hover:bg-slate-800"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        <span className="max-w-[9rem] truncate sm:max-w-none">
          {busy ? busyLabel : 'Export'}
        </span>
        {!busy ? <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" /> : null}
      </Button>

      {open && !busy ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Export options"
          className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,18rem)] rounded-2xl border border-[#C5DFFB] bg-white p-1.5 shadow-[0_12px_28px_rgba(30,64,175,0.14)] dark:border-white/10 dark:bg-slate-900"
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#163A63] transition-colors hover:bg-[#E8F3FE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]/50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                setOpen(false)
                void action.onSelect()
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
