'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Add, Delete, Download, Edit, Search } from '@mui/icons-material'
import { downloadExcelReport } from '@/lib/downloadExcelReport'

interface Accessory {
  id: string
  accessoryType: string
  brand: string
  model: string
  serialNumber: string
  quantity: number
  purchasePrice: number
  vendorName: string
  purchaseDate?: string | null
  startDate?: string | null
  returnedDate?: string | null
  warrantyExpiry?: string | null
  status: string
  createdAt?: string
  updatedAt?: string
}

interface AccessoryMovement {
  id: string
  accessoryType: string
  action: string
  date: string
  quantity: number
  relatedAssetSerialNumber: string
  person: string
  remarks: string
  createdAt?: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const ACCESSORY_TYPES = [
  'ALL',
  'RAM',
  'Display',
  'Battery',
  'Base',
  'Keyboard',
  'Mouse',
  'Adapter',
  'HDD',
  'Graphic Card',
  'Panel',
  'SSD',
]

const NEW_ACCESSORY_OPTIONS = [
  'RAM',
  'Display',
  'Battery',
  'Base',
  'Keyboard',
  'Mouse',
  'Adapter',
  'HDD',
  'Graphic Card',
  'Panel',
  'SSD',
]

const STATUS_OPTIONS = ['In Stock', 'Issued', 'Sold']

const ACCESSORY_TYPE_BADGE_STYLES: Record<string, { backgroundColor: string; color: string }> = {
  ram: { backgroundColor: '#dbeafe', color: '#1d4ed8' },
  display: { backgroundColor: '#dcfce7', color: '#15803d' },
  battery: { backgroundColor: '#fef3c7', color: '#b45309' },
  base: { backgroundColor: '#fce7f3', color: '#be185d' },
  keyboard: { backgroundColor: '#ede9fe', color: '#6d28d9' },
  mouse: { backgroundColor: '#cffafe', color: '#0e7490' },
  adapter: { backgroundColor: '#ffedd5', color: '#c2410c' },
  hdd: { backgroundColor: '#e0e7ff', color: '#4338ca' },
  'graphic card': { backgroundColor: '#f3e8ff', color: '#7e22ce' },
  panel: { backgroundColor: '#ccfbf1', color: '#0f766e' },
  ssd: { backgroundColor: '#f1f5f9', color: '#334155' },
}

const getAccessoryTypeBadgeStyle = (type: string) =>
  ACCESSORY_TYPE_BADGE_STYLES[type.trim().toLowerCase()] || { backgroundColor: '#f1f5f9', color: '#334155' }

const emptyForm = {
  accessoryType: 'RAM',
  brand: '',
  model: '',
  serialNumber: '',
  quantity: '1',
  purchasePrice: '',
  vendorName: '',
  purchaseDate: '',
  warrantyExpiry: '',
  status: 'In Stock',
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-GB')
}

const today = () => new Date().toISOString().split('T')[0]

export default function AccessoriesPage() {
  const navigate = useNavigate()
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [selectedType, setSelectedType] = useState('RAM')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newMenuAnchor, setNewMenuAnchor] = useState<null | HTMLElement>(null)
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null)
  const [outwardAccessory, setOutwardAccessory] = useState<Accessory | null>(null)
  const [outwardForm, setOutwardForm] = useState({ customerName: '', serialNumber: '', startDate: today(), price: '', status: 'Issued' })
  const [returnAccessory, setReturnAccessory] = useState<Accessory | null>(null)
  const [returnForm, setReturnForm] = useState({ issuedDate: '', returnedDate: '' })
  const [form, setForm] = useState(emptyForm)

  const fetchAccessories = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      const activeType = selectedType !== 'ALL' ? selectedType : 'all'

      if (activeType !== 'all') {
        params.set('type', activeType)
      }
      if (search.trim()) {
        params.set('search', search.trim())
      }

      const response = await fetch(`${API_URL}/api/accessories?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch accessories')
      }

      const data: Accessory[] = await response.json()
      setAccessories(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch accessories')
      setAccessories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAccessories()
  }, [selectedType, typeFilter, search])

  const displayedAccessories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return accessories.filter((item) => {
      const categoryMatches = selectedType === 'ALL' || item.accessoryType === selectedType
      const typeMatches = typeFilter === 'all' || item.accessoryType === typeFilter
      const matchesSelectedStatus = selectedStatus === 'All' || item.status === selectedStatus
      const searchMatches =
        !normalizedSearch ||
        [item.serialNumber, item.brand, item.model, item.accessoryType].join(' ').toLowerCase().includes(normalizedSearch)

      return categoryMatches && typeMatches && matchesSelectedStatus && searchMatches
    })
  }, [accessories, selectedType, selectedStatus, typeFilter, search])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0, 'In Stock': 0, Issued: 0, Sold: 0 }

    accessories
      .filter((item) => selectedType === 'ALL' || item.accessoryType === selectedType)
      .forEach((item) => {
        if (!STATUS_OPTIONS.includes(item.status)) return
        counts[item.status] = (counts[item.status] || 0) + 1
      })

    counts.All = accessories.filter((item) => selectedType === 'ALL' || item.accessoryType === selectedType).length

    return counts
  }, [accessories, selectedType])

  const recordsHeading = selectedStatus === 'All' ? `${selectedType} Records` : `${selectedType} Records — ${selectedStatus}`

  const openNewDialog = (event: React.MouseEvent<HTMLButtonElement>) => {
    setNewMenuAnchor(event.currentTarget)
  }

  const handleNewAccessorySelect = (type: string) => {
    setEditingAccessory(null)
    setForm({ ...emptyForm, accessoryType: type })
    setSelectedType(type)
    setSelectedStatus('All')
    setTypeFilter(type)
    setNewMenuAnchor(null)
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: Accessory) => {
    setEditingAccessory(item)
    setForm({
      accessoryType: item.accessoryType,
      brand: item.brand,
      model: item.model,
      serialNumber: item.serialNumber,
      quantity: String(item.quantity ?? 1),
      purchasePrice: item.purchasePrice ? String(item.purchasePrice) : '',
      vendorName: item.vendorName,
      purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().slice(0, 10) : '',
      warrantyExpiry: item.warrantyExpiry ? new Date(item.warrantyExpiry).toISOString().slice(0, 10) : '',
      status: item.status,
    })
    setSelectedType(item.accessoryType)
    setIsDialogOpen(true)
  }

  const openOutwardDialog = (item: Accessory) => {
    setOutwardAccessory(item)
    setOutwardForm({ customerName: '', serialNumber: '', startDate: today(), price: item.purchasePrice ? String(item.purchasePrice) : '', status: 'Issued' })
  }

  const openReturnDialog = (item: Accessory) => {
    setReturnAccessory(item)
    setReturnForm({
      issuedDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : today(),
      returnedDate: '',
    })
  }

  const handleSaveReturn = async () => {
    if (!returnAccessory) return

    if (!returnForm.issuedDate) {
      setError('Issued date is required')
      setSuccess(null)
      return
    }

    if (returnForm.returnedDate && returnForm.returnedDate < returnForm.issuedDate) {
      setError('Returned date cannot be earlier than issued date')
      setSuccess(null)
      return
    }

    try {
      const returnedDate = returnForm.returnedDate || undefined
      const response = await fetch(`${API_URL}/api/accessories/${returnAccessory.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: returnedDate ? 'Returned' : 'Issued',
          date: returnedDate,
          startDate: returnForm.issuedDate,
          returnedDate,
          quantity: returnAccessory.quantity,
          relatedAssetSerialNumber: returnAccessory.serialNumber,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(data.error || 'Unable to save accessory dates')

      setReturnAccessory(null)
      setReturnForm({ issuedDate: '', returnedDate: '' })
      setSuccess(returnedDate ? 'Accessory returned successfully' : 'Issued date saved successfully')
      setError(null)
      await fetchAccessories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save accessory dates')
      setSuccess(null)
    }
  }

  const handleOutward = async () => {
    if (!outwardAccessory) return

    const customerName = outwardForm.customerName.trim()
    const serialNumber = outwardForm.serialNumber.trim()
    const price = Number(outwardForm.price)
    const isSold = outwardForm.status === 'Sold'

    if (!customerName) {
      setError('Customer name is required')
      setSuccess(null)
      return
    }

    if (!outwardForm.startDate.trim()) {
      setError('Start date is required')
      setSuccess(null)
      return
    }

    if (outwardForm.status === 'Issued' && !serialNumber) {
      setError('Serial Number is required.')
      setSuccess(null)
      return
    }

    if (isSold && (!outwardForm.price.trim() || !Number.isFinite(price) || price < 0)) {
      setError('Price is required and must be a valid number')
      setSuccess(null)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/accessories/${outwardAccessory.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: outwardForm.status,
          startDate: outwardForm.startDate,
          quantity: outwardAccessory.quantity,
          ...(isSold ? { price } : {}),
          relatedAssetSerialNumber: serialNumber || outwardAccessory.serialNumber,
          person: customerName,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Unable to outward accessory')
      }

      setOutwardAccessory(null)
      setOutwardForm({ customerName: '', serialNumber: '', startDate: today(), price: '', status: 'Issued' })
      setSuccess('Accessory outward completed successfully')
      setError(null)
      await fetchAccessories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to outward accessory')
      setSuccess(null)
    }
  }

  const handleSaveAccessory = async () => {
    try {
      const payload = {
        accessoryType: form.accessoryType,
        brand: form.brand,
        model: form.model,
        serialNumber: form.serialNumber,
        quantity: Number(form.quantity || 0),
        purchasePrice: Number(form.purchasePrice || 0),
        vendorName: form.vendorName,
        purchaseDate: form.purchaseDate || null,
        warrantyExpiry: form.warrantyExpiry || null,
        status: form.status,
      }

      const url = editingAccessory ? `${API_URL}/api/accessories/${editingAccessory.id}` : `${API_URL}/api/accessories`
      const method = editingAccessory ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save accessory')
      }

      const savedType = form.accessoryType || selectedType
      setSelectedType(savedType)
      setTypeFilter(savedType)
      setSuccess(editingAccessory ? 'Accessory updated successfully' : 'Accessory created successfully')
      setError(null)
      setIsDialogOpen(false)
      setEditingAccessory(null)
      setForm({ ...emptyForm, accessoryType: savedType })
      await fetchAccessories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save accessory')
      setSuccess(null)
    }
  }

  const handleDeleteAccessory = async (id: string) => {
    const confirmed = window.confirm('Delete this accessory? This action cannot be undone.')
    if (!confirmed) return

    try {
      const response = await fetch(`${API_URL}/api/accessories/${id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete accessory')
      }

      setSuccess('Accessory deleted successfully')
      setError(null)
      await fetchAccessories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete accessory')
      setSuccess(null)
    }
  }

  const handleDownloadReport = async () => {
    await downloadExcelReport({
      fileName: 'accessories-report.xlsx',
      sheetName: 'Accessories',
      headers: ['Brand', 'Model', 'Accessory Type', 'Quantity', 'Purchase Price', 'Vendor Name', 'Purchase Date', 'Warranty Date', 'Status'],
      rows: displayedAccessories.map((item) => [
        item.brand,
        item.model,
        item.accessoryType,
        item.quantity,
        item.purchasePrice,
        item.vendorName,
        item.purchaseDate ? formatDate(item.purchaseDate) : '',
        item.warrantyExpiry ? formatDate(item.warrantyExpiry) : '',
        item.status,
      ]),
      textColumns: [2],
      dateColumns: [7, 8],
      currencyColumns: [5],
      wideColumns: [6],
    })
  }

  return (
    <Box sx={{ p: 3, background: 'linear-gradient(180deg, #f8fafc 0%, #eef4f9 100%)', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ color: '#0f172a', letterSpacing: '-0.04em' }}>
          Accessories
        </Typography>

        <Box sx={{ position: 'relative' }}>
          <Stack direction="row" spacing={1.25}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => void handleDownloadReport()}
              sx={{
                borderColor: '#0f172a',
                color: '#0f172a',
                borderRadius: 2,
                textTransform: 'none',
                px: 2,
                py: 1.2,
                fontWeight: 600,
                '&:hover': { borderColor: '#1e293b', background: '#f8fafc' },
              }}
            >
              Download Report
            </Button>
            <Button
              variant="contained"
              onClick={openNewDialog}
              sx={{
                background: '#0f172a',
                borderRadius: 2,
                textTransform: 'none',
                px: 2.5,
                py: 1.2,
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': { background: '#1e293b' },
              }}
            >
              + New
            </Button>
          </Stack>

          <Menu
            anchorEl={newMenuAnchor}
            open={Boolean(newMenuAnchor)}
            onClose={() => setNewMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  minWidth: 220,
                  borderRadius: 2,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
                },
              },
            }}
          >
            {NEW_ACCESSORY_OPTIONS.map((type) => (
              <MenuItem
                key={type}
                onClick={() => handleNewAccessorySelect(type)}
                sx={{
                  py: 1,
                  px: 1.5,
                  fontWeight: 500,
                  '&:hover': { backgroundColor: '#f8fafc' },
                }}
              >
                {type}
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>

      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1.25 }}>
          {ACCESSORY_TYPES.map((type) => {
            const isActive = selectedType === type
            return (
              <Button
                key={type}
                variant={isActive ? 'contained' : 'outlined'}
                onClick={() => {
                  setSelectedType(type)
                  setSelectedStatus('All')
                  setTypeFilter(type === 'ALL' ? 'all' : type)
                }}
                sx={{
                  justifyContent: 'center',
                  borderRadius: 2,
                  minHeight: 42,
                  px: 1.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  letterSpacing: '0.01em',
                  borderColor: isActive ? '#0f172a' : '#dfe7ef',
                  backgroundColor: isActive ? '#0f172a' : '#f8fafc',
                  color: isActive ? '#ffffff' : '#0f172a',
                  boxShadow: isActive ? '0 8px 18px rgba(15, 23, 42, 0.12)' : 'none',
                  '&:hover': {
                    backgroundColor: isActive ? '#111827' : '#edf2f7',
                    borderColor: isActive ? '#111827' : '#d0dae5',
                  },
                }}
              >
                {type}
              </Button>
            )
          })}
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a', mb: 1.5 }}>
          {selectedType} Status
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            width: '100%',
            p: 1.25,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)',
          }}
        >
          {[
            { label: 'All', value: statusCounts.All },
            ...STATUS_OPTIONS.map((status) => ({ label: status, value: statusCounts[status] || 0 })),
          ].map(({ label, value }) => {
            const isActive = selectedStatus === label

            return (
              <Button
                key={label}
                onClick={() => setSelectedStatus(label)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  borderRadius: 2,
                  border: `1px solid ${isActive ? '#0f172a' : '#e2e8f0'}`,
                  backgroundColor: isActive ? '#e2e8f0' : '#ffffff',
                  color: '#0f172a',
                  px: 1.5,
                  py: 0.75,
                  minHeight: 40,
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: isActive ? '0 8px 18px rgba(15, 23, 42, 0.08)' : 'none',
                  '&:hover': {
                    backgroundColor: isActive ? '#dfe7ef' : '#f8fafc',
                    borderColor: '#cbd5e1',
                  },
                }}
              >
                <Typography sx={{ color: '#334155', fontWeight: 700 }}>{label}</Typography>
                <Chip label={value} sx={{ background: isActive ? '#ffffff' : '#f1f5f9', color: '#0f172a', fontWeight: 700, height: 24 }} />
              </Button>
            )
          })}
        </Box>
      </Box>

      <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>
            {recordsHeading}
          </Typography>
          <Chip label={displayedAccessories.length} sx={{ background: '#e2e8f0', color: '#0f172a', fontWeight: 700 }} />
        </Box>

        {loading ? (
          <Typography sx={{ color: '#475569' }}>Loading accessories...</Typography>
        ) : displayedAccessories.length === 0 ? (
          <Typography sx={{ color: '#475569' }}>
            {selectedStatus === 'All' ? 'No accessories found for this selection.' : `No accessories found for ${selectedStatus}.`}
          </Typography>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead
                  sx={{
                    '& .MuiTableCell-head': {
                      backgroundColor: '#0B1F33',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      borderBottom: 'none',
                      whiteSpace: 'nowrap',
                    },
                    '& .MuiTableCell-head:first-of-type': { borderTopLeftRadius: 10 },
                    '& .MuiTableCell-head:last-of-type': { borderTopRightRadius: 10 },
                  }}
                >
                  <TableRow>
                    <TableCell>Brand</TableCell>
                    <TableCell>Model</TableCell>
                    {selectedStatus !== 'In Stock' && <TableCell>Serial Number</TableCell>}
                    <TableCell>Qty</TableCell>
                    {selectedStatus !== 'Issued' && <TableCell>Price</TableCell>}
                    {selectedStatus !== 'In Stock' && <TableCell>Issued Date</TableCell>}
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedAccessories.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.brand || '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="text"
                          onClick={() => navigate(`/inventory/accessory-lifecycle/${item.id}`)}
                          sx={{ minWidth: 0, p: 0, color: '#0f172a', fontWeight: 700, textTransform: 'none', justifyContent: 'flex-start' }}
                        >
                          {item.model || '-'}
                        </Button>
                      </TableCell>
                      {selectedStatus !== 'In Stock' && <TableCell>{item.serialNumber || '-'}</TableCell>}
                      <TableCell>{item.quantity ?? 0}</TableCell>
                      {selectedStatus !== 'Issued' && <TableCell>{item.purchasePrice ? `₹${item.purchasePrice}` : '-'}</TableCell>}
                      {selectedStatus !== 'In Stock' && <TableCell>{formatDate(item.startDate)}</TableCell>}
                      <TableCell>
                        <Chip label={item.status || 'In Stock'} size="small" sx={{ background: '#e2e8f0', color: '#0f172a' }} />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          {selectedType !== 'ALL' && (
                            <Button
                              size="small"
                              startIcon={<Add />}
                              onClick={() => item.status === 'Issued' ? openReturnDialog(item) : openOutwardDialog(item)}
                              aria-label="Outward"
                              title="Outward"
                              sx={{ minWidth: 0, px: 1, color: '#0f172a' }}
                            >
                            </Button>
                          )}
                          {selectedType === 'ALL' ? (
                            <Button size="small" onClick={() => openEditDialog(item)} sx={{ minWidth: 0, px: 1, color: '#0f172a' }}>
                              View
                            </Button>
                          ) : (
                            <Button size="small" startIcon={<Edit />} onClick={() => openEditDialog(item)} sx={{ minWidth: 0, px: 1, color: '#0f172a' }}>
                              Edit
                            </Button>
                          )}
                          <Button size="small" startIcon={<Delete />} color="error" onClick={() => void handleDeleteAccessory(item.id)} sx={{ minWidth: 0, px: 1 }}>
                            Delete
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box
              sx={{
                mt: 2,
                pt: 1.5,
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: '#0f172a', fontWeight: 700 }}>
                Total Accessories: {displayedAccessories.length}
              </Typography>
            </Box>
          </>
        )}
      </Paper>

      <Dialog open={Boolean(returnAccessory)} onClose={() => setReturnAccessory(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#0f172a' }}>
          Accessory Return Dates
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              required
              label="Issued Date"
              type="date"
              value={returnForm.issuedDate}
              onChange={(event) => setReturnForm((current) => ({ ...current, issuedDate: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              fullWidth
              label="Returned Date"
              type="date"
              value={returnForm.returnedDate}
              onChange={(event) => setReturnForm((current) => ({ ...current, returnedDate: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setReturnAccessory(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveReturn()} sx={{ background: '#0f172a', '&:hover': { background: '#1e293b' } }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(outwardAccessory)} onClose={() => setOutwardAccessory(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#0f172a' }}>
          Outward Accessory
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              required
              label="Customer Name"
              value={outwardForm.customerName}
              onChange={(event) => setOutwardForm((current) => ({ ...current, customerName: event.target.value }))}
            />
            <TextField
              fullWidth
              required={outwardForm.status === 'Issued'}
              label={outwardForm.status === 'Issued' ? 'Serial Number *' : 'Serial Number'}
              value={outwardForm.serialNumber}
              onChange={(event) => setOutwardForm((current) => ({ ...current, serialNumber: event.target.value }))}
            />
            <TextField
              fullWidth
              required
              label="Start Date"
              type="date"
              value={outwardForm.startDate}
              onChange={(event) => setOutwardForm((current) => ({ ...current, startDate: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {outwardForm.status === 'Sold' && (
              <TextField
                fullWidth
                required
                label="Price"
                type="number"
                inputProps={{ min: 0, step: '0.01' }}
                value={outwardForm.price}
                onChange={(event) => setOutwardForm((current) => ({ ...current, price: event.target.value }))}
              />
            )}
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={outwardForm.status}
                label="Status"
                onChange={(event) => {
                  const status = String(event.target.value)
                  setOutwardForm((current) => ({ ...current, status, price: status === 'Issued' ? '' : current.price }))
                }}
              >
                <MenuItem value="Issued">Issued</MenuItem>
                <MenuItem value="Sold">Sold</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOutwardAccessory(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleOutward()} sx={{ background: '#0f172a', '&:hover': { background: '#1e293b' } }}>
            Outward
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 700, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#0f172a' }}>
          {editingAccessory ? 'Edit Accessory' : 'Add Accessory'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Box sx={{ pt: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mb: 2 }}>
              {editingAccessory ? editingAccessory.accessoryType : form.accessoryType || selectedType} Details
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Brand"
                  value={form.brand}
                  onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Model"
                  value={form.model}
                  onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Quantity *"
                  type="number"
                  value={form.quantity}
                  inputProps={{ min: 1 }}
                  onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Purchase Price"
                  type="number"
                  value={form.purchasePrice}
                  onChange={(event) => setForm((prev) => ({ ...prev, purchasePrice: event.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Vendor Name"
                  value={form.vendorName}
                  onChange={(event) => setForm((prev) => ({ ...prev, vendorName: event.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', lineHeight: 1.2 }}>
                    Purchase Date
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      minHeight: 56,
                      border: '1px solid #cbd5e1',
                      borderRadius: 2,
                      backgroundColor: '#fff',
                      px: 1.5,
                      py: 0.75,
                      boxSizing: 'border-box',
                      '&:focus-within': {
                        borderColor: '#0f172a',
                        boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.08)',
                      },
                    }}
                  >
                    <input
                      type="date"
                      value={form.purchaseDate}
                      onChange={(event) => setForm((prev) => ({ ...prev, purchaseDate: event.target.value }))}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: '#0f172a',
                        fontSize: '0.95rem',
                        lineHeight: '1.4',
                        padding: '8px 0',
                        margin: 0,
                        appearance: 'none',
                        WebkitAppearance: 'none',
                      }}
                    />
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155', lineHeight: 1.2 }}>
                    Warranty Date
                  </Typography>
                  <Box
                    sx={{
                      width: '100%',
                      minHeight: 56,
                      border: '1px solid #cbd5e1',
                      borderRadius: 2,
                      backgroundColor: '#fff',
                      px: 1.5,
                      py: 0.75,
                      boxSizing: 'border-box',
                      '&:focus-within': {
                        borderColor: '#0f172a',
                        boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.08)',
                      },
                    }}
                  >
                    <input
                      type="date"
                      value={form.warrantyExpiry}
                      onChange={(event) => setForm((prev) => ({ ...prev, warrantyExpiry: event.target.value }))}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: '#0f172a',
                        fontSize: '0.95rem',
                        lineHeight: '1.4',
                        padding: '8px 0',
                        margin: 0,
                        appearance: 'none',
                        WebkitAppearance: 'none',
                      }}
                    />
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={form.status}
                    label="Status"
                    onChange={(event) => setForm((prev) => ({ ...prev, status: String(event.target.value) }))}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <MenuItem key={status} value={status}>{status}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveAccessory()} sx={{ background: '#0f172a', '&:hover': { background: '#1e293b' } }}>
            {editingAccessory ? 'Update Accessory' : 'Save Accessory'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
