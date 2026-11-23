import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Eye, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { hasPermission } from '@/sales/lib/permissions'

interface ActionMenuProps {
  moduleName: string
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  disabled?: boolean
  children?: (closeMenu: () => void, buttonRect?: DOMRect) => ReactNode
}

export function ActionMenu({ moduleName, onView, onEdit, onDelete, disabled = false, children }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 8, left: 8, ready: false })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const canView = Boolean(onView && hasPermission(moduleName, 'view'))
  const canEdit = Boolean(onEdit && hasPermission(moduleName, 'edit'))
  const canDelete = Boolean(onDelete && hasPermission(moduleName, 'delete'))

  const closeMenu = useCallback(() => setIsOpen(false), [])

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current || !menuRef.current) return

    const updatePosition = () => {
      const button = buttonRef.current
      const menu = menuRef.current
      if (!button || !menu) return

      const buttonRect = button.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      const viewportPadding = 8
      const availableHeight = Math.max(80, window.innerHeight - viewportPadding * 2)
      const menuHeight = Math.min(menuRect.height, availableHeight)
      const fitsBelow = buttonRect.bottom + 4 + menuHeight <= window.innerHeight - viewportPadding
      const fitsAbove = buttonRect.top - 4 - menuHeight >= viewportPadding
      const openBelow = fitsBelow || !fitsAbove
      const top = openBelow
        ? Math.min(buttonRect.bottom + 4, window.innerHeight - menuHeight - viewportPadding)
        : Math.max(viewportPadding, buttonRect.top - menuHeight - 4)
      const left = Math.max(
        viewportPadding,
        Math.min(buttonRect.right - menuRect.width, window.innerWidth - menuRect.width - viewportPadding),
      )

      setPosition({ top, left, ready: true })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, canView, canEdit, canDelete, children])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Node
        && !buttonRef.current?.contains(target)
        && !menuRef.current?.contains(target)
      ) {
        closeMenu()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, closeMenu])

  if (!canView && !canEdit && !canDelete && !children) return null

  const runAction = (action?: () => void) => {
    closeMenu()
    action?.()
  }

  const menu = isOpen && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[10000] w-48 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white py-1 text-left shadow-xl"
        style={{
          top: position.top,
          left: position.left,
          maxHeight: 'calc(100vh - 16px)',
          visibility: position.ready ? 'visible' : 'hidden',
        }}
      >
        {canView && (
          <button type="button" role="menuitem" onClick={() => runAction(onView)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]">
            <Eye className="h-4 w-4 shrink-0" /> View
          </button>
        )}
        {canEdit && (
          <button type="button" role="menuitem" onClick={() => runAction(onEdit)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]">
            <Pencil className="h-4 w-4 shrink-0" /> Edit
          </button>
        )}
        {canDelete && (
          <button type="button" role="menuitem" onClick={() => runAction(onDelete)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">
            <Trash2 className="h-4 w-4 shrink-0" /> Delete
          </button>
        )}
        {children?.(closeMenu, buttonRef.current?.getBoundingClientRect())}
      </div>,
      document.body,
    )
    : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-[#F2EFE8] focus:outline-none focus:ring-2 focus:ring-[#CEC9BD] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreVertical className="h-5 w-5" />
      </button>
      {menu}
    </>
  )
}
