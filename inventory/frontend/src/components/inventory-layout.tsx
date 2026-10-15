'use client'

import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { InventorySidebar } from './inventory-sidebar'
import { InventoryTopBar } from './inventory-top-bar'
import { clearInventorySession, getInventorySession, getInventorySessionToken, type InventoryUser } from '@/lib/inventoryAuth'

interface InventoryLayoutProps {
  children: React.ReactNode
}

export function InventoryLayout({ children }: InventoryLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [user, setUser] = useState<InventoryUser | null>(null)
  const location = useLocation()

  useEffect(() => {
    const token = getInventorySessionToken()
    if (!token) {
      setIsAuthenticated(false)
      return
    }

    let cancelled = false
    getInventorySession(token)
      .then((sessionUser) => {
        if (cancelled) return
        setUser(sessionUser)
        setIsAuthenticated(Boolean(sessionUser))
        if (!sessionUser) clearInventorySession()
      })
      .catch(() => {
        if (cancelled) return
        clearInventorySession()
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
        <InventoryTopBar user={user} />
        <main style={{ padding: '24px 24px 32px', backgroundColor: '#F4F6F8', minHeight: 'calc(100vh - 64px)', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
