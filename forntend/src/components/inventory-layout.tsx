'use client'

import { InventorySidebar } from './inventory-sidebar'
import { InventoryTopBar } from './inventory-top-bar'

interface InventoryLayoutProps {
  children: React.ReactNode
}

export function InventoryLayout({ children }: InventoryLayoutProps) {
  return (
    <div style={{ width: '100%', maxWidth: '100vw', minHeight: '100vh', backgroundColor: '#F4F6F8', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <InventorySidebar />
      <div style={{ marginLeft: '240px', width: 'calc(100% - 240px)', maxWidth: 'calc(100% - 240px)', minWidth: 0, boxSizing: 'border-box' }}>
        <InventoryTopBar />
        <main style={{ marginTop: '64px', padding: '24px 24px 32px', backgroundColor: '#F4F6F8', minHeight: 'calc(100vh - 64px)', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
