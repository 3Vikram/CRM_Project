'use client'

import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { INVENTORY_SESSION_KEY, verifyInventorySession } from '@/lib/inventoryAuth'
import { InventorySidebar } from './inventory-sidebar'
import { InventoryTopBar } from './inventory-top-bar'

interface InventoryLayoutProps {
  children: React.ReactNode
}

export function InventoryLayout({ children }: InventoryLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem(INVENTORY_SESSION_KEY)
    if (!token) {
      setIsAuthenticated(false)
      return
    }

    let cancelled = false
    verifyInventorySession(token)
      .then((isValid) => {
        if (cancelled) return
        setIsAuthenticated(isValid)
        if (!isValid) localStorage.removeItem(INVENTORY_SESSION_KEY)
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem(INVENTORY_SESSION_KEY)
        setIsAuthenticated(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-[#F4F6F8]" aria-label="Checking Inventory session" />
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/inventory/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: '100vw', minHeight: '100vh', backgroundColor: '#F4F6F8', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <InventorySidebar />
      <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', maxWidth: 'calc(100% - 240px)', minWidth: 0, boxSizing: 'border-box' }}>
        <InventoryTopBar />
        <main style={{ padding: '24px 24px 32px', backgroundColor: '#F4F6F8', minHeight: '100vh', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
