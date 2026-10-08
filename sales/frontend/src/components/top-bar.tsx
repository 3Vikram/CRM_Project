'use client'

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import synovLogo from "../assets.png";
import { clearStoredAuth } from '@/lib/auth'

interface TopBarProps {
  userName?: string
  userRole?: string
  userInitials?: string
}

export function TopBar({
  userName = 'Anaya Patel',
  userRole = 'Sales · Bengaluru',
  userInitials = 'AP',
}: TopBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleProfile = () => {
    setIsMenuOpen(false)
    navigate('/sales/profile')
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    localStorage.removeItem('sales_logged_in')
    clearStoredAuth()
    navigate('/sales', { replace: true })
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-[#E7E3DA] bg-[#F0EEE7] px-6">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={synovLogo}
          alt="Synov IT Services logo"
          className="h-10 w-auto object-contain"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-wide text-[#1F1D1A]">Synov IT Services</div>
        </div>
      </div>

      <div className="relative flex items-center" ref={menuRef}>
        <button
          type="button"
          aria-label="Open profile menu"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D6D1C7] bg-[#F8F7F3] text-[#1F1D1A] transition hover:bg-[#EAE5DC]"
        >
          <span aria-hidden="true" className="text-2xl leading-none">👤</span>
        </button>

        {isMenuOpen ? (
          <div className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-lg border border-[#E7E3DA] bg-white shadow-lg">
            <button
              type="button"
              onClick={handleProfile}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-[#1F1D1A] transition hover:bg-[#F8F7F3]"
            >
              Profile
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-[#1F1D1A] transition hover:bg-[#F8F7F3]"
            >
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
