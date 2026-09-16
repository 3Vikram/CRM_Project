import { useEffect, useState } from 'react'

export interface Asset {
  id: string
  name: string
  productName?: string
  assetId: string
  serialNumber: string
  productSerialNumber?: string
  category: string
  location: string
  status: string
  quantity: number
  availableQuantity?: number
  price: number
  depreciatedPrice?: number
  minStockLevel: number
  productModel: string
  manufacturer: string
  purchaseDate: string | null
  invoiceDate?: string | null
  warrantyExpiry: string | null
  warrantyDate?: string | null
  description: string
  productDescription?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  bulkUploadId?: string | null
  vendorName?: string
  invoiceNumber?: string
  customerName?: string
  documentNumber?: string
  rentStartDate?: string
  rentEndDate?: string
  inwardType?: string
  inwardDate?: string | null
  document?: {
    fileName: string
    fileUrl: string
    uploadedAt: string | null
  }
}

export interface FilterOptions {
  categories: string[]
  locations: string[]
  statuses: string[]
}

export interface AssetMovementSummary {
  id: string
  asset: string
  type: 'INWARD' | 'OUTWARD' | 'RENT_OUT' | 'RETURNED' | 'SOLD' | 'SOLD_OUT'
  quantity: number
  date: string
  by: string
}

export interface AssetSerialHistoryEntry {
  id: string
  date: string | null
  inwardInvoiceNumber: string
  outwardInvoiceNumber: string
  documentNumber: string
  productSerialNumber: string
  productModel: string
  vendorName: string
  customerName: string
  productName: string
  productDescription: string
  movementType: string
  rentStartDate: string
  rentEndDate: string
  rentOutPrice: number
  cycleNumber?: number
  totalMonths?: number
  monthwiseTotalPrice?: number
  remarks: string
}

export interface AssetSerialHistoryResponse {
  asset: {
    id: string
    productName: string
    productDescription: string
    productModel: string
    serialNumber: string
    vendorName: string
    invoiceNumber: string
    customerName: string
    status: string
    purchasePrice: number
    purchaseDate: string | null
  }
  history: AssetSerialHistoryEntry[]
  rentalHistory: (AssetSerialHistoryEntry & {
    cycleNumber: number
    monthlyRentalPrice: number
    rentalRevenue: number
    status: 'RETURNED' | 'RENTED'
  })[]
  finalSale: {
    customerName: string
    invoiceNumber: string
    saleDate: string | null
    saleAmount: number
    remarks: string
  } | null
  financialSummary: {
    purchasePrice: number
    totalRentalRevenue: number
    saleAmount: number
    saleProfit: number
    completeAssetProfit: number
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export function triggerInventoryRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('inventory:data-updated'))
  }
}

export function useAssets(search: string = '', category: string = '', location: string = '', status: string = '', refreshKey: number = 0) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        if (search) params.append('search', search)
        if (category && category !== 'all') params.append('category', category)
        if (location && location !== 'all') params.append('location', location)
        if (status && status !== 'all') params.append('status', status)

        const queryString = params.toString()
        console.log('\n=== useAssets FETCH ===');
        console.log('Query string:', queryString || '(empty)');

        const response = await fetch(`${API_URL}/api/inventory/assets?${queryString}`)
        if (!response.ok) throw new Error('Failed to fetch assets')

        const data = await response.json()
        console.log('API returned:', data.length, 'assets');
        if (data.length > 0 && status === 'returned') {
          console.log('Sample returned asset:', {
            id: data[0].id,
            name: data[0].name,
            status: data[0].status,
            inwardType: data[0].inwardType,
          });
        }
        setAssets(data)
        console.log('=== END useAssets FETCH ===\n');
      } catch (err) {
        console.error('Error fetching assets:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch assets')
        setAssets([])
      } finally {
        setLoading(false)
      }
    }

    fetchAssets()

    const handleRefresh = () => {
      console.log('Inventory refresh event triggered, refetching...');
      fetchAssets()
    }

    window.addEventListener('inventory:data-updated', handleRefresh)
    return () => {
      window.removeEventListener('inventory:data-updated', handleRefresh)
    }
  }, [search, category, location, status, refreshKey])

  return { assets, loading, error }
}

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions>({
    categories: [],
    locations: [],
    statuses: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${API_URL}/api/inventory/filter-options`)
        if (!response.ok) throw new Error('Failed to fetch filter options')

        const data = await response.json()
        setOptions(data)
      } catch (err) {
        console.error('Error fetching filter options:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch options')
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
  }, [])

  return { options, loading, error }
}

export async function createAsset(asset: Partial<Asset> & { mode?: string }) {
  console.log('createAsset() payload:', asset)
  const response = await fetch(`${API_URL}/api/inventory/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...asset, mode: asset.mode || 'asset' }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create asset' }))
    throw new Error(error.error || 'Failed to create asset')
  }

  const result = await response.json()
  triggerInventoryRefresh()
  return result
}

export async function createBulkAssets(common: Partial<Asset> & { quantity: number; serialNumbers: string[] }) {
  const response = await fetch(`${API_URL}/api/inventory/assets/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(common),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create bulk assets' }))
    throw new Error(error.error || 'Failed to create bulk assets')
  }

  const result = await response.json()
  triggerInventoryRefresh()
  return result
}

export async function createInward(inwardData: {
  name: string
  vendorName: string
  invoiceNumber?: string
  inwardType: string
  inwardDate: string
  description?: string
  productModel?: string
  serialNumber: string
  quantity: number
  price?: number
  warrantyExpiry?: string
  location: string
  createdBy?: string
}) {
  const response = await fetch(`${API_URL}/api/inventory/inward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...inwardData, mode: 'inward' }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create inward')
  }

  return response.json()
}

export async function getAssetMovements(assetName: string) {
  const response = await fetch(`${API_URL}/api/inventory/movements?assetName=${encodeURIComponent(assetName)}&limit=20`)

  if (!response.ok) {
    throw new Error('Failed to fetch asset movements')
  }

  return response.json() as Promise<AssetMovementSummary[]>
}

export async function getAssetSerialHistory(serialNumber: string) {
  const response = await fetch(`${API_URL}/api/inventory/assets/serial/${encodeURIComponent(serialNumber)}/history`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch serial history' }))
    throw new Error(error.error || 'Failed to fetch serial history')
  }

  return response.json() as Promise<AssetSerialHistoryResponse>
}

export async function createOutward(outwardData: {
  assetId?: string
  assetName?: string
  customerName: string
  outwardType: 'Rent' | 'Sell'
  quantity: number
  documentNumber?: string
  invoiceNumber?: string
  remarks?: string
  performedBy?: string
  outwardDate?: string
  rentStartDate?: string
  rentEndDate?: string
  productName?: string
  productDescription?: string
  productSerialNumber?: string
  productModel?: string
  price?: number
}) {
  console.log('Submitting Outward:', outwardData)
  const response = await fetch(`${API_URL}/api/inventory/outward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(outwardData),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create outward movement' }))
    throw new Error(error.error || 'Failed to create outward movement')
  }

  const result = await response.json()
  triggerInventoryRefresh()
  return result
}

export async function createReturn(returnData: {
  assetId: string
  customerName?: string
  supplierName?: string
  supplier?: string
  quantity?: number
  remarks?: string
  performedBy?: string
  returnDate?: string
  rentEndDate?: string
  documentNumber?: string
  invoiceNumber?: string
}) {
  console.log('\n=== CREATE RETURN (Frontend) ===');
  console.log('Request data:', returnData);
  
  const response = await fetch(`${API_URL}/api/inventory/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(returnData),
  })

  console.log('Response status:', response.status, response.statusText);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create return movement' }))
    console.error('Return failed:', error);
    throw new Error(error.error || 'Failed to create return movement')
  }

  const result = await response.json()
  console.log('Return success response:', result);
  triggerInventoryRefresh()
  console.log('Triggered inventory refresh event');
  console.log('=== END CREATE RETURN ===\n');
  return result
}

export async function updateAsset(id: string, asset: Partial<Asset>) {
  const response = await fetch(`${API_URL}/api/inventory/assets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asset),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update asset')
  }

  const result = await response.json()
  triggerInventoryRefresh()
  return result
}

export async function deleteAsset(id: string) {
  const response = await fetch(`${API_URL}/api/inventory/assets/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete asset')
  }

  const result = await response.json()
  triggerInventoryRefresh()
  return result
}

export async function deleteBulkAssets(assetIds: string[], bulkUploadId?: string) {
  const response = await fetch(`${API_URL}/api/inventory/assets/bulk`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetIds, bulkUploadId }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete selected assets' }))
    throw new Error(error.error || 'Failed to delete selected assets')
  }

  const result = await response.json()
  triggerInventoryRefresh()
  return result
}

export async function deleteAssetDocument(id: string) {
  const response = await fetch(`${API_URL}/api/assets/${id}/document`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete document')
  }

  return response.json()
}

export async function getAssetById(id: string) {
  const response = await fetch(`${API_URL}/api/inventory/assets/${id}`)

  if (!response.ok) {
    throw new Error('Failed to fetch asset')
  }

  return response.json()
}

export async function uploadAssetDocument(id: string, file: File, replace = false) {
  const formData = new FormData()
  formData.append('document', file)

  const response = await fetch(`${API_URL}/api/assets/${id}/document`, {
    method: replace ? 'PUT' : 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload document')
  }

  return response.json()
}
