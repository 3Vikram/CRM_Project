'use client'

import { Bell, Search, Command } from 'lucide-react'
import { useState, useEffect } from 'react'

interface TopBarProps {
  searchPlaceholder?: string
  userName?: string
  userRole?: string
  userInitials?: string
}

export function TopBar({
  searchPlaceholder = 'Search customers, leads, DCs...',
  userName = 'Anaya Patel',
  userRole = 'Sales · Bengaluru',
  userInitials = 'AP',
}: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [notificationCount, setNotificationCount] = useState(3)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector('[data-search-global]') as HTMLInputElement
        searchInput?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="h-16 bg-[#F0EEE7] border-b border-[#E7E3DA] px-8 flex items-center justify-between fixed top-0 left-56 right-0 z-40">
      {/* Search Bar */}
      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-search-global
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E7E3DA] rounded-full text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 flex items-center gap-1 pointer-events-none">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-6 ml-8">
        {/* Bell Notification */}
        <button className="p-2 hover:bg-black/5 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-gray-600" />
          {notificationCount > 0 && (
            <div className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">{notificationCount}</span>
            </div>
          )}
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-[#E7E3DA] cursor-pointer hover:opacity-80 transition-opacity">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">{userName}</div>
            <div className="text-xs text-gray-500">{userRole}</div>
          </div>
          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">{userInitials}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
