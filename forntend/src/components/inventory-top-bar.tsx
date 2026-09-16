'use client'

import { Bell, Search, Command, HelpCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

interface InventoryTopBarProps {
  userName?: string
  userRole?: string
  userInitials?: string
}

export function InventoryTopBar({
  userName = 'Anaya Patel',
  userRole = 'Sales · Bengaluru',
  userInitials = 'AP',
}: InventoryTopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [notificationCount] = useState(2)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector('[data-search-inventory]') as HTMLInputElement
        searchInput?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="h-16 bg-white border-b border-[#DDE4EA] px-6 lg:px-8 flex items-center justify-between fixed top-0 left-60 right-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#06283D] flex items-center justify-center">
          <span className="text-white font-semibold text-sm">3V</span>
        </div>
        <div>
          <div className="font-semibold text-sm text-[#06283D]">3 Vikram Technologies</div>
          <div className="text-xs text-[#5F6B76]">Inventory Management</div>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-6 lg:mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4.5 h-4.5 text-[#5F6B76]" />
          <input
            type="text"
            placeholder="Search assets, serial number, model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-search-inventory
            className="w-full pl-10 pr-10 py-2.5 bg-[#F4F6F8] border border-[#DDE4EA] rounded-full text-sm text-[#06283D] placeholder-[#5F6B76] focus:outline-none focus:ring-2 focus:ring-[#0B3A53]/15"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#5F6B76] flex items-center gap-1 pointer-events-none">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <button className="p-2 hover:bg-[#F4F6F8] rounded-full transition-colors">
          <HelpCircle className="w-5 h-5 text-[#5F6B76]" />
        </button>

        <button className="p-2 hover:bg-[#F4F6F8] rounded-full transition-colors relative">
          <Bell className="w-5 h-5 text-[#5F6B76]" />
          {notificationCount > 0 && (
            <div className="absolute top-0 right-0 w-5 h-5 bg-[#D64545] rounded-full flex items-center justify-center">
              <span className="text-white text-[11px] font-semibold">{notificationCount}</span>
            </div>
          )}
        </button>

        <div className="flex items-center gap-3 pl-4 lg:pl-6 border-l border-[#DDE4EA] cursor-pointer hover:opacity-80 transition-opacity">
          <div className="text-right">
            <div className="text-sm font-medium text-[#06283D]">{userName}</div>
            <div className="text-xs text-[#5F6B76]">{userRole}</div>
          </div>
          <div className="w-10 h-10 bg-[#06283D] rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">{userInitials}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
