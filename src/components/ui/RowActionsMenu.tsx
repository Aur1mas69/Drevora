import type { LucideIcon } from 'lucide-react'
import { MoreHorizontal } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export type RowActionTone = 'default' | 'danger' | 'success' | 'warning'

export type RowAction = {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  to?: string
  tone?: RowActionTone
}

type MenuPlacement = {
  vertical: 'top' | 'bottom'
  horizontal: 'left' | 'right'
}

type RowActionsMenuProps = {
  actions: RowAction[]
  align?: 'start' | 'center' | 'end'
}

function getToneClass(tone: RowActionTone = 'default'): string {
  switch (tone) {
    case 'danger':
      return 'text-rose-600 hover:bg-rose-50 focus:bg-rose-50'
    case 'success':
      return 'text-emerald-700 hover:bg-emerald-50 focus:bg-emerald-50'
    case 'warning':
      return 'text-amber-700 hover:bg-amber-50 focus:bg-amber-50'
    default:
      return 'text-[#2A376F] hover:bg-[#F4F8FF] focus:bg-[#F4F8FF]'
  }
}

export function TableActionsHeader({ className = '' }: { className?: string }) {
  return (
    <th className={`min-w-[72px] whitespace-nowrap px-2 py-2 ${className}`} scope="col">
      Actions
    </th>
  )
}

export function TableActionsCell({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <td className={`w-14 min-w-[56px] max-w-[56px] px-1 ${className}`}>
      <div className="flex justify-center">{children}</div>
    </td>
  )
}

export function RowActionsMenu({ actions, align = 'center' }: RowActionsMenuProps) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [placement, setPlacement] = useState<MenuPlacement>({
    vertical: 'bottom',
    horizontal: 'right',
  })
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const visibleActions = actions

  const closeMenu = useCallback(() => {
    setIsOpen(false)
    setFocusedIndex(-1)
    buttonRef.current?.focus()
  }, [])

  const updatePlacement = useCallback(() => {
    const button = buttonRef.current
    const menu = menuRef.current
    if (!button || !menu) return

    const rect = button.getBoundingClientRect()
    const menuWidth = menu.offsetWidth || 168
    const menuHeight = menu.offsetHeight || visibleActions.length * 36 + 8
    const padding = 8

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const vertical: MenuPlacement['vertical'] =
      spaceBelow < menuHeight + padding && spaceAbove > spaceBelow ? 'top' : 'bottom'

    const overflowRight = rect.right - menuWidth < padding
    const horizontal: MenuPlacement['horizontal'] = overflowRight ? 'left' : 'right'

    setPlacement({ vertical, horizontal })
  }, [visibleActions.length])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePlacement()
  }, [isOpen, updatePlacement, visibleActions.length])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
        return
      }

      if (!menuRef.current) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setFocusedIndex((current) => (current + 1) % visibleActions.length)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setFocusedIndex((current) =>
          current <= 0 ? visibleActions.length - 1 : current - 1,
        )
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        setFocusedIndex(0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        setFocusedIndex(visibleActions.length - 1)
      }
    }

    function handleScroll() {
      updatePlacement()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [closeMenu, isOpen, updatePlacement, visibleActions.length])

  useEffect(() => {
    if (!isOpen || focusedIndex < 0) return
    const item = menuRef.current?.querySelector<HTMLElement>(
      `[data-menu-index="${focusedIndex}"]`,
    )
    item?.focus()
  }, [focusedIndex, isOpen])

  if (visibleActions.length === 0) return null

  const wrapperAlign =
    align === 'end' ? 'justify-end' : align === 'start' ? 'justify-start' : 'justify-center'

  const menuPositionClass =
    placement.vertical === 'top'
      ? 'bottom-full mb-1'
      : 'top-full mt-1'

  const menuHorizontalClass =
    placement.horizontal === 'left' ? 'left-0' : 'right-0'

  function handleSelect(action: RowAction) {
    closeMenu()
    action.onClick?.()
  }

  function renderAction(action: RowAction, index: number) {
    const Icon = action.icon
    const className = `flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold outline-none transition-colors ${getToneClass(action.tone)}`

    if (action.to) {
      return (
        <Link
          key={action.id}
          to={action.to}
          role="menuitem"
          data-menu-index={index}
          tabIndex={focusedIndex === index ? 0 : -1}
          className={className}
          onClick={() => closeMenu()}
        >
          {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          {action.label}
        </Link>
      )
    }

    return (
      <button
        key={action.id}
        type="button"
        role="menuitem"
        data-menu-index={index}
        tabIndex={focusedIndex === index ? 0 : -1}
        className={className}
        onClick={() => handleSelect(action)}
      >
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        {action.label}
      </button>
    )
  }

  return (
    <div ref={rootRef} className={`relative flex ${wrapperAlign}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => {
          setIsOpen((current) => {
            const next = !current
            if (next) setFocusedIndex(0)
            return next
          })
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-slate-500 outline-none transition-colors hover:bg-[#EEF4FF] hover:text-[#2563EB] focus-visible:ring-2 focus-visible:ring-blue-100"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Row actions"
          className={`absolute z-50 min-w-[148px] overflow-hidden rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-white/95 p-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-sm ${menuPositionClass} ${menuHorizontalClass}`}
        >
          {visibleActions.map((action, index) => renderAction(action, index))}
        </div>
      ) : null}
    </div>
  )
}
