import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut, UserRound } from 'lucide-react'
import { clearInventorySession, type InventoryUser } from '@/lib/inventoryAuth'

interface InventoryTopBarProps {
  user: InventoryUser | null
}

export function InventoryTopBar({ user }: InventoryTopBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  const handleProfile = () => {
    setIsMenuOpen(false)
    setIsProfileOpen(true)
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    setIsProfileOpen(false)
    clearInventorySession()
    navigate('/inventory/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-end border-b border-[#DDE4EA] bg-white px-6">
      <div className="relative" ref={menuRef}>
        <button
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label="Open Inventory profile menu"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D7DEE8] bg-[#F4F6F8] text-[#06283D] transition hover:bg-[#E7EDF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A53]"
          onClick={() => {
            setIsProfileOpen(false)
            setIsMenuOpen((open) => !open)
          }}
          type="button"
        >
          <UserRound aria-hidden="true" size={20} />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-lg border border-[#DDE4EA] bg-white py-1 shadow-lg" role="menu">
            <button
              className="flex w-full items-center px-3 py-2 text-left text-sm text-[#06283D] transition hover:bg-[#F4F6F8] focus-visible:outline-none focus-visible:bg-[#F4F6F8]"
              onClick={handleProfile}
              role="menuitem"
              type="button"
            >
              Profile
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#06283D] transition hover:bg-[#F4F6F8] focus-visible:outline-none focus-visible:bg-[#F4F6F8]"
              onClick={handleLogout}
              role="menuitem"
              type="button"
            >
              <LogOut aria-hidden="true" size={15} />
              Logout
            </button>
          </div>
        )}

        {isProfileOpen && (
          <section
            aria-label="Inventory profile"
            className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-[#DDE4EA] bg-white p-4 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#06283D]">Profile</h2>
              <button
                aria-label="Close profile"
                className="rounded p-1 text-[#5F6B76] hover:bg-[#F4F6F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3A53]"
                onClick={() => setIsProfileOpen(false)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="rotate-180" size={18} />
              </button>
            </div>
            {user ? (
              <dl className="space-y-2 text-sm">
                {user.name ? (
                  <div>
                    <dt className="text-xs text-[#5F6B76]">Name</dt>
                    <dd className="break-words font-medium text-[#06283D]">{user.name}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs text-[#5F6B76]">Email</dt>
                  <dd className="break-words font-medium text-[#06283D]">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#5F6B76]">Account type</dt>
                  <dd className="font-medium capitalize text-[#06283D]">{user.role}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-[#5F6B76]">Profile details are unavailable.</p>
            )}
          </section>
        )}
      </div>
    </header>
  )
}
