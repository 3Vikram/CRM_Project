import { useEffect, useState } from 'react'

interface InventoryStats {
  allAssets: number
  inStock: number
  outwarding: number
  rentOut: number
  soldOut: number
  returned?: number
  totalAssetValue: string
}

interface AssetMovement {
  id: string
  asset: string
  type: 'INWARD' | 'OUTWARD' | 'RENT_OUT' | 'RETURNED' | 'SOLD' | 'SOLD_OUT'
  quantity: number
  date: string
  by: string
}

interface LowStockItem {
  id: string
  asset: string
  available: number
  minStock: number
  status: 'LOW' | 'CRITICAL'
}

interface QuickSummary {
  todayInward: number
  todayOutward: number
  dueReturns: number
  overdueRentals: number
}

interface OverviewSummary {
  totalAssets: number
  inStock: number
  rentedOut: number
  soldOut: number
  returned?: number
}

interface OverviewActivityItem {
  id: string
  name: string
  quantity: number
  status: string
  createdAt?: string
}

interface OverviewData {
  summary: OverviewSummary
  recentAssets: OverviewActivityItem[]
  recentInward: AssetMovement[]
  recentRentals: AssetMovement[]
  recentSales: AssetMovement[]
}

export function useInventoryData() {
  const [stats, setStats] = useState<InventoryStats | null>(null)
  const [movements, setMovements] = useState<AssetMovement[]>([])
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const [quickSummary, setQuickSummary] = useState<QuickSummary | null>(null)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

        const [statsRes, movementsRes, lowStockRes, summaryRes, overviewRes] = await Promise.all([
          fetch(`${API_URL}/api/inventory/stats`),
          fetch(`${API_URL}/api/inventory/movements?limit=5`),
          fetch(`${API_URL}/api/inventory/low-stock`),
          fetch(`${API_URL}/api/inventory/quick-summary`),
          fetch(`${API_URL}/api/inventory/overview`),
        ])

        if (!statsRes.ok || !movementsRes.ok || !lowStockRes.ok || !summaryRes.ok || !overviewRes.ok) {
          throw new Error('Failed to fetch inventory data')
        }

        const statsData = await statsRes.json()
        const movementsData = await movementsRes.json()
        const lowStockData = await lowStockRes.json()
        const summaryData = await summaryRes.json()
        const overviewData = await overviewRes.json()

        setStats(statsData)
        setMovements(movementsData)
        setLowStock(lowStockData)
        setQuickSummary(summaryData)
        setOverview(overviewData)
      } catch (err) {
        console.error('Error fetching inventory data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
        setStats(null)
        setMovements([])
        setLowStock([])
        setQuickSummary(null)
        setOverview(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    const handleRefresh = () => {
      fetchData()
    }

    window.addEventListener('inventory:data-updated', handleRefresh)
    return () => {
      window.removeEventListener('inventory:data-updated', handleRefresh)
    }
  }, [])

  return {
    stats,
    movements,
    lowStock,
    quickSummary,
    overview,
    loading,
    error,
  }
}
