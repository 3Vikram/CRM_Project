'use client'

import { Bell } from 'lucide-react'
import { useState } from 'react'
import synovLogo from "../assets.png";

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
  const [notificationCount] = useState(3)

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

      <div className="flex items-center gap-6">
        {/* Bell Notification */}
        <button className="relative cursor-pointer rounded-lg p-2 transition-colors hover:bg-[#E7E3DA]">
          <Bell className="h-5 w-5 text-[#6B6657]" />
          {notificationCount > 0 && (
            <div className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
              <span className="text-xs font-bold text-white">{notificationCount}</span>
            </div>
          )}
        </button>

        {/* User Profile */}
        <div className="flex cursor-pointer items-center gap-3 border-l border-[#E7E3DA] pl-4 transition-opacity hover:opacity-80">
          <div className="text-right">
            <div className="text-sm font-medium text-[#1F1D1A]">{userName}</div>
            <div className="text-xs text-[#6B6657]">{userRole}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E7E3DA]">
            <span className="text-sm font-semibold text-[#1F1D1A]">{userInitials}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
