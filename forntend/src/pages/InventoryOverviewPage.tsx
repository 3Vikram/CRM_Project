'use client'

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inventory2, Inventory2Outlined, LocalShipping, RotateLeft, Sell } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useInventoryData } from '@/hooks/useInventoryData'
import { createInward, createOutward } from '@/hooks/useAssets'

export default function InventoryOverviewPage() {
  const { stats, overview, loading, error } = useInventoryData()
  const navigate = useNavigate()
  const [isInwardDrawerOpen, setIsInwardDrawerOpen] = useState(false)
  const [isOutwardDrawerOpen, setIsOutwardDrawerOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const summaryCards = useMemo(
    () => [
      {
        label: 'All Assets',
        value: overview?.summary.totalAssets ?? stats?.allAssets ?? 0,
        icon: <Inventory2 sx={{ fontSize: 22 }} />,
        path: '/inventory/assets',
        iconBackground: '#EEF2F7',
        iconColor: '#0B1F33',
      },
      {
        label: 'In Stock',
        value: overview?.summary.inStock ?? stats?.inStock ?? 0,
        icon: <Inventory2Outlined sx={{ fontSize: 22 }} />,
        path: '/inventory/in-stock',
        iconBackground: '#E9F7ED',
        iconColor: '#2E7D32',
      },
      {
        label: 'Rent Out',
        value: overview?.summary.rentedOut ?? stats?.rentOut ?? 0,
        icon: <LocalShipping sx={{ fontSize: 22 }} />,
        path: '/inventory/rent-out',
        iconBackground: '#F3ECFF',
        iconColor: '#7B1FA2',
      },
      {
        label: 'Sold Out',
        value: overview?.summary.soldOut ?? stats?.soldOut ?? 0,
        icon: <Sell sx={{ fontSize: 22 }} />,
        path: '/inventory/sold-out',
        iconBackground: '#FFF2E8',
        iconColor: '#C06B00',
      },
      {
        label: 'Returned',
        value: overview?.summary.returned ?? stats?.returned ?? 0,
        icon: <RotateLeft sx={{ fontSize: 22 }} />,
        path: '/inventory/returned',
        iconBackground: '#FDEDED',
        iconColor: '#B42318',
      },
    ],
    [overview, stats]
  )

  const handleSuccess = (message: string) => {
    setSuccessMessage(message)
    window.setTimeout(() => setSuccessMessage(null), 2400)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: '100%', backgroundColor: '#F5F6F8' }}>
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error">Unable to load inventory overview. Please try again in a moment.</Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#0B1F33', mb: 0.5 }}>
              Inventory Overview
            </Typography>
          </Box>
        </Box>
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid #EBEAE6', borderRadius: 3, p: { xs: 2.5, md: 3 }, backgroundColor: '#FFFFFF', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0B1F33' }}>
              Inventory Summary
            </Typography>
          </Box>
        </Box>
        {loading ? (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} variant="outlined" sx={{ borderRadius: 3, minHeight: 132, borderColor: '#EBEAE6' }}>
                <CardContent sx={{ py: 2 }}>
                  <CircularProgress size={18} sx={{ mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Loading…</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
            {summaryCards.map((card) => (
              <Card
                key={card.label}
                variant="outlined"
                onClick={() => navigate(card.path)}
                sx={{ borderRadius: 3, minHeight: 132, cursor: 'pointer', borderColor: '#EBEAE6', backgroundColor: '#FFFFFF', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.03)', '&:hover': { borderColor: '#0B1F33', boxShadow: '0 12px 24px rgba(15, 23, 42, 0.06)' } }}
              >
                <CardContent sx={{ py: 2.25, '&:last-child': { pb: 2.25 } }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: card.iconBackground, color: card.iconColor, mb: 1.5 }}>
                    {card.icon}
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#0B1F33', lineHeight: 1.1 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>
                    {card.label}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Paper>

      {isInwardDrawerOpen && (
        <InwardAssetDrawer onClose={() => setIsInwardDrawerOpen(false)} onSuccess={handleSuccess} />
      )}

      {isOutwardDrawerOpen && (
        <OutwardAssetDrawer onClose={() => setIsOutwardDrawerOpen(false)} onSuccess={handleSuccess} />
      )}
    </Box>
  )
}

function SkeletonRow() {
  return (
    <Box sx={{ border: '1px solid #E7E3DD', borderRadius: 2, p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        <CircularProgress size={14} sx={{ mr: 1 }} />
        Loading…
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Fetching latest stock alerts.
      </Typography>
    </Box>
  )
}

function InwardAssetDrawer({ onClose, onSuccess }: { onClose: () => void; onSuccess: (message: string) => void }) {
  const [form, setForm] = useState({
    name: '',
    vendorName: '',
    invoiceNumber: '',
    inwardType: 'New Purchase',
    inwardDate: new Date().toISOString().split('T')[0],
    quantity: '',
    price: '',
    productModel: '',
    serialNumber: '',
    warrantyExpiry: '',
    location: '',
    description: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = 'Asset name is required'
    if (!form.vendorName.trim()) newErrors.vendorName = 'Vendor name is required'
    if (!form.serialNumber.trim()) newErrors.serialNumber = 'Serial number is required'
    if (!form.inwardDate.trim()) newErrors.inwardDate = 'Inward date is required'
    if (!form.inwardType.trim()) newErrors.inwardType = 'Inward type is required'
    if (!form.location.trim()) newErrors.location = 'Location is required'

    if (!form.quantity) {
      newErrors.quantity = 'Quantity is required'
    } else {
      const qty = Number(form.quantity)
      if (!Number.isFinite(qty) || qty <= 0) newErrors.quantity = 'Quantity must be greater than 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setSubmitError(null)

    try {
      await createInward({
        name: form.name,
        vendorName: form.vendorName,
        invoiceNumber: form.invoiceNumber || undefined,
        inwardType: form.inwardType,
        inwardDate: form.inwardDate,
        description: form.description,
        productModel: form.productModel,
        serialNumber: form.serialNumber,
        quantity: Number(form.quantity),
        price: form.price ? Number(form.price) : 0,
        warrantyExpiry: form.warrantyExpiry || undefined,
        location: form.location,
        createdBy: 'System',
      })

      onSuccess('Inward recorded successfully.')
      onClose()
      window.setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save inward movement.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-3xl flex-col bg-white shadow-xl">
        <div className="border-b border-[#DDE4EA] p-6">
          <h2 className="text-xl font-semibold text-[#06283D]">Inward Asset</h2>
          <p className="mt-1 text-sm text-[#5F6B76]">Record a new stock arrival and keep inventory counts current.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {submitError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{submitError}</div>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FieldRow label="Inward Date" required error={errors.inwardDate}>
                <input type="date" name="inwardDate" value={form.inwardDate} onChange={handleChange} className={`min-h-11 w-full rounded-xl border bg-[#F8FBFD] px-3 py-2.5 ${errors.inwardDate ? 'border-red-500' : 'border-[#DDE4EA]'}`} />
              </FieldRow>
              <FieldRow label="Invoice Number" error={errors.invoiceNumber}>
                <input type="text" name="invoiceNumber" value={form.invoiceNumber} onChange={handleChange} placeholder="Enter invoice number" className="w-full rounded-lg border border-[#E7E3DD] px-3 py-2.5" />
              </FieldRow>
              <FieldRow label="Vendor Name" required error={errors.vendorName}>
                <input type="text" name="vendorName" value={form.vendorName} onChange={handleChange} placeholder="Enter vendor name" className={`w-full rounded-lg border px-3 py-2.5 ${errors.vendorName ? 'border-red-500' : 'border-[#E7E3DD]'}`} />
              </FieldRow>
              <FieldRow label="Asset Name" required error={errors.name}>
                <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Enter asset name" className={`w-full rounded-lg border px-3 py-2.5 ${errors.name ? 'border-red-500' : 'border-[#E7E3DD]'}`} />
              </FieldRow>
              <FieldRow label="Description" error={errors.description}>
                <textarea name="description" value={form.description} onChange={handleChange} placeholder="Brief description" rows={3} className="w-full rounded-lg border border-[#E7E3DD] px-3 py-2.5" />
              </FieldRow>
              <FieldRow label="Quantity" required error={errors.quantity}>
                <input type="number" name="quantity" value={form.quantity} onChange={handleChange} min="1" placeholder="Enter quantity" className={`w-full rounded-lg border px-3 py-2.5 ${errors.quantity ? 'border-red-500' : 'border-[#E7E3DD]'}`} />
              </FieldRow>
              <FieldRow label="Price" error={errors.price}>
                <input type="number" name="price" value={form.price} onChange={handleChange} step="0.01" min="0" placeholder="Enter price" className="w-full rounded-lg border border-[#E7E3DD] px-3 py-2.5" />
              </FieldRow>
              <FieldRow label="Product Model" error={errors.productModel}>
                <input type="text" name="productModel" value={form.productModel} onChange={handleChange} placeholder="Enter model" className="w-full rounded-lg border border-[#E7E3DD] px-3 py-2.5" />
              </FieldRow>
              <FieldRow label="Serial Number" required error={errors.serialNumber}>
                <input type="text" name="serialNumber" value={form.serialNumber} onChange={handleChange} placeholder="Enter serial number" className={`w-full rounded-lg border px-3 py-2.5 ${errors.serialNumber ? 'border-red-500' : 'border-[#E7E3DD]'}`} />
              </FieldRow>
              <FieldRow label="Warranty Date" error={errors.warrantyExpiry}>
                <input type="date" name="warrantyExpiry" value={form.warrantyExpiry} onChange={handleChange} className="w-full rounded-lg border border-[#E7E3DD] px-3 py-2.5" />
              </FieldRow>
              <FieldRow label="Inward Type" required error={errors.inwardType}>
                <select name="inwardType" value={form.inwardType} onChange={handleChange} className={`w-full rounded-lg border px-3 py-2.5 ${errors.inwardType ? 'border-red-500' : 'border-[#E7E3DD]'}`}>
                  <option value="New Purchase">New Purchase</option>
                  <option value="Customer Return">Customer Return</option>
                  <option value="Internal Transfer">Internal Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </FieldRow>
              <FieldRow label="Location" required error={errors.location}>
                <input type="text" name="location" value={form.location} onChange={handleChange} placeholder="Enter location" className={`w-full rounded-lg border px-3 py-2.5 ${errors.location ? 'border-red-500' : 'border-[#E7E3DD]'}`} />
              </FieldRow>
            </div>

            <div className="flex gap-3 border-t border-[#DDE4EA] pt-4">
              <button type="button" onClick={onClose} className="flex-1 rounded-full border border-[#D7DEE8] bg-white px-4 py-2.5 font-medium text-[#06283D] hover:bg-[#F3F7FA]">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 rounded-full bg-[#06283D] px-4 py-2.5 font-medium text-white hover:bg-[#0B3A53] disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Inward'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

function OutwardAssetDrawer({ onClose, onSuccess }: { onClose: () => void; onSuccess: (message: string) => void }) {
  const [form, setForm] = useState({
    assetName: '',
    quantity: '',
    destination: '',
    purpose: '',
    notes: '',
    outwardDate: new Date().toISOString().split('T')[0],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!form.assetName.trim()) newErrors.assetName = 'Asset name is required'
    if (!form.outwardDate.trim()) newErrors.outwardDate = 'Outward date is required'
    if (!form.quantity) {
      newErrors.quantity = 'Quantity is required'
    } else {
      const qty = Number(form.quantity)
      if (!Number.isFinite(qty) || qty <= 0) newErrors.quantity = 'Quantity must be greater than 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setSubmitError(null)

    try {
      await createOutward({
        assetName: form.assetName,
        customerName: 'System',
        outwardType: 'Sell',
        quantity: Number(form.quantity),
        performedBy: 'System',
        outwardDate: form.outwardDate,
      })

      onSuccess('Outward recorded successfully.')
      onClose()
      window.setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save outward movement.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-3xl flex-col bg-white shadow-xl">
        <div className="border-b border-[#DDE4EA] p-6">
          <h2 className="text-xl font-semibold text-[#06283D]">Outward Asset</h2>
          <p className="mt-1 text-sm text-[#5F6B76]">Deduct stock for transfers, deliveries, or other outbound movement.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {submitError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{submitError}</div>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FieldRow label="Outward Date" required error={errors.outwardDate}>
                <input type="date" name="outwardDate" value={form.outwardDate} onChange={handleChange} className={`min-h-11 w-full rounded-xl border bg-[#F8FBFD] px-3 py-2.5 ${errors.outwardDate ? 'border-red-500' : 'border-[#DDE4EA]'}`} />
              </FieldRow>
              <FieldRow label="Asset Name" required error={errors.assetName}>
                <input type="text" name="assetName" value={form.assetName} onChange={handleChange} placeholder="Enter asset name" className={`w-full rounded-lg border px-3 py-2.5 ${errors.assetName ? 'border-red-500' : 'border-[#E7E3DD]'}`} />
              </FieldRow>
              <FieldRow label="Quantity" required error={errors.quantity}>
                <input type="number" name="quantity" value={form.quantity} onChange={handleChange} min="1" placeholder="Enter quantity" className={`w-full rounded-lg border px-3 py-2.5 ${errors.quantity ? 'border-red-500' : 'border-[#E7E3DD]'}`} />
              </FieldRow>
              <FieldRow label="Destination" error={errors.destination}>
                <input type="text" name="destination" value={form.destination} onChange={handleChange} placeholder="Enter destination" className="w-full rounded-lg border border-[#E7E3DD] px-3 py-2.5" />
              </FieldRow>
              <FieldRow label="Purpose" error={errors.purpose}>
                <input type="text" name="purpose" value={form.purpose} onChange={handleChange} placeholder="Enter purpose" className="w-full rounded-lg border border-[#E7E3DD] px-3 py-2.5" />
              </FieldRow>
              <FieldRow label="Notes" error={errors.notes}>
                <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Add notes" rows={4} className="w-full rounded-lg border border-[#E7E3DD] px-3 py-2.5" />
              </FieldRow>
            </div>

            <div className="flex gap-3 border-t border-[#DDE4EA] pt-4">
              <button type="button" onClick={onClose} className="flex-1 rounded-full border border-[#D7DEE8] bg-white px-4 py-2.5 font-medium text-[#06283D] hover:bg-[#F3F7FA]">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 rounded-full bg-[#06283D] px-4 py-2.5 font-medium text-white hover:bg-[#0B3A53] disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Outward'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

function FieldRow({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <label className="w-full pt-2.5 text-sm font-medium text-[#152238] sm:w-36">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      <div className="flex-1">
        {children}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
