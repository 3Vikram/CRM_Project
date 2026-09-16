import { useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid'
import { useNavigate } from 'react-router-dom'
import { createOutward, type Asset, useAssets } from '@/hooks/useAssets'

const today = () => new Date().toISOString().split('T')[0]

type MovementType = 'Rent' | 'Sell'

export default function OutwardDashboardPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [modelFilter, setModelFilter] = useState('all')
  const [inwardFilter, setInwardFilter] = useState('all')
  const [pageSize, setPageSize] = useState(10)
  const [selection, setSelection] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() })
  const [movementType, setMovementType] = useState<MovementType | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [requiresAssetSelection, setRequiresAssetSelection] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [rentStartDate, setRentStartDate] = useState(today())
  const [rentEndDate, setRentEndDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { assets, loading } = useAssets('', '', '', 'available')
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selection.ids.has(asset.id)),
    [assets, selection]
  )
  const modelOptions = useMemo(() => Array.from(new Set(assets.map((asset) => asset.productModel).filter(Boolean))).sort(), [assets])
  const inwardOptions = useMemo(() => Array.from(new Set(assets.map((asset) => asset.inwardType).filter(Boolean))).sort(), [assets])
  const rows = useMemo(
    () => assets
      .filter((asset) => modelFilter === 'all' || asset.productModel === modelFilter)
      .filter((asset) => inwardFilter === 'all' || asset.inwardType === inwardFilter)
      .filter((asset) => !search || [
        asset.purchaseDate,
        asset.productName || asset.name,
        asset.productDescription || asset.description,
        asset.productSerialNumber || asset.serialNumber,
        asset.productModel,
        asset.price,
        asset.inwardType,
      ].join(' ').toLowerCase().includes(search.toLowerCase())),
    [assets, inwardFilter, modelFilter, search]
  )

  const exportReport = () => {
    const header = ['Purchased Date', 'Product Name', 'Product Description', 'Product Serial Number', 'Product Model', 'Price', 'Depreciated Value', 'Inward Type', 'Returned Date', 'Warranty Details']
    const values = rows.map((asset) => [
      asset.purchaseDate || '', asset.productName || asset.name, asset.productDescription || asset.description,
      asset.productSerialNumber || asset.serialNumber, asset.productModel, asset.price, asset.depreciatedPrice || 0,
      asset.inwardType || '', '', asset.warrantyExpiry || '',
    ])
    const csv = [header, ...values].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'outward-dashboard.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const openDetails = () => {
    setError(null)
    setMovementType(null)
    setRequiresAssetSelection(selectedAssets.length === 0)
    setDetailsOpen(true)
  }

  const chooseMovement = (type: MovementType) => {
    setMovementType(type)
    setError(null)
    setDetailsOpen(true)
  }

  const closeDialogs = () => {
    setDetailsOpen(false)
    setMovementType(null)
    setRequiresAssetSelection(false)
    setError(null)
  }

  const submitMovement = async () => {
    if (!movementType || !selectedAssets.length) return
    if (!customerName.trim()) return setError('Customer Name is required.')
    if (!documentNumber.trim()) return setError('Document Number is required.')
    if (movementType === 'Rent' && !rentStartDate) return setError('Rent Start Date is required.')
    if (movementType === 'Sell' && !invoiceNumber.trim()) return setError('Invoice Number is required for Sell.')

    try {
      setSaving(true)
      await Promise.all(selectedAssets.map((asset) => createOutward({
        assetId: asset.id,
        assetName: asset.productName || asset.name,
        customerName: customerName.trim(),
        outwardType: movementType,
        quantity: 1,
        documentNumber: documentNumber.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
        outwardDate: today(),
        rentStartDate: movementType === 'Rent' ? rentStartDate : undefined,
        rentEndDate: movementType === 'Rent' ? rentEndDate || undefined : undefined,
        productName: asset.productName || asset.name,
        productDescription: asset.productDescription || asset.description,
        productModel: asset.productModel,
        productSerialNumber: asset.productSerialNumber || asset.serialNumber,
        price: asset.price,
      })))
      closeDialogs()
      setSelection({ type: 'include', ids: new Set() })
      window.location.reload()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to move selected assets.')
    } finally {
      setSaving(false)
    }
  }

  const columns: GridColDef[] = [
    { field: 'purchaseDate', headerName: 'Purchased Date', flex: 1, minWidth: 130 },
    { field: 'productName', headerName: 'Product Name', flex: 1.3, minWidth: 170 },
    { field: 'productDescription', headerName: 'Product Description', flex: 1.6, minWidth: 220 },
    { field: 'serialNumber', headerName: 'Product Serial Number', flex: 1.2, minWidth: 180 },
    { field: 'productModel', headerName: 'Product Model', flex: 1, minWidth: 140 },
    { field: 'price', headerName: 'Price', flex: 0.8, minWidth: 100 },
    { field: 'depreciatedPrice', headerName: 'Depreciated Value', flex: 1, minWidth: 140 },
    { field: 'inwardType', headerName: 'Inward Type', flex: 0.9, minWidth: 130 },
    { field: 'returnedDate', headerName: 'Returned Date', flex: 0.9, minWidth: 130, valueGetter: () => '-' },
    { field: 'warrantyExpiry', headerName: 'Warranty Details', flex: 1, minWidth: 140, valueGetter: (value) => value || '-' },
    { field: 'actions', headerName: 'Action', flex: 0.8, minWidth: 100, sortable: false, renderCell: (params) => <Button size="small" onClick={() => navigate('/inventory/outwarding', { state: { asset: params.row.asset } })}>Open</Button> },
  ]

  const gridRows = rows.map((asset) => ({
    id: asset.id,
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '-',
    productName: asset.productName || asset.name,
    productDescription: asset.productDescription || asset.description || '-',
    serialNumber: asset.productSerialNumber || asset.serialNumber || '-',
    productModel: asset.productModel || '-',
    price: asset.price,
    depreciatedPrice: asset.depreciatedPrice || 0,
    inwardType: asset.inwardType || '-',
    warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.slice(0, 10) : '-',
    asset,
  }))

  const selectedDescriptions = Array.from(new Set(selectedAssets.map((asset) => asset.productDescription || asset.description).filter(Boolean))).join(', ')
  const selectedModels = Array.from(new Set(selectedAssets.map((asset) => asset.productModel).filter(Boolean))).join(', ')

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#F4F6F8', minHeight: '100vh' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box><Typography variant="h4" sx={{ fontWeight: 700, color: '#06283D' }}>OUTWARD DASHBOARD</Typography><Typography color="text.secondary">Select available In Stock assets to move outward.</Typography></Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="contained" onClick={openDetails}>Move Outward</Button>
          <Button variant="outlined" onClick={() => navigate('/inventory/in-stock')}>Back to In Stock</Button>
        </Stack>
      </Stack>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: '1px solid #DDE4EA', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2, alignItems: { md: 'center' } }}>
          <TextField size="small" label="Search" value={search} onChange={(event) => setSearch(event.target.value)} fullWidth />
          <TextField select size="small" label="Product Model" value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} sx={{ minWidth: 190 }}><MenuItem value="all">All</MenuItem>{modelOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</TextField>
          <TextField select size="small" label="Inward Type" value={inwardFilter} onChange={(event) => setInwardFilter(event.target.value)} sx={{ minWidth: 170 }}><MenuItem value="all">All</MenuItem>{inwardOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</TextField>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 150 }}>
            <Typography variant="body2" color="text.secondary">Show entries</Typography>
            <Select size="small" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} inputProps={{ 'aria-label': 'Show entries' }}>
              {[10, 25, 50].map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
            </Select>
          </Stack>
          <Button variant="outlined" onClick={exportReport} disabled={!rows.length}>Download Report</Button>
        </Stack>
        <Box sx={{ height: 620, width: '100%' }}>
          <DataGrid rows={gridRows} columns={columns} loading={loading} checkboxSelection rowSelectionModel={selection} onRowSelectionModelChange={setSelection} pageSizeOptions={[10, 25, 50]} paginationModel={{ page: 0, pageSize }} onPaginationModelChange={(model) => { setPageSize(model.pageSize) }} disableRowSelectionOnClick />
        </Box>
      </Paper>
      {selectedAssets.length > 0 && <Paper sx={{ position: 'fixed', bottom: 20, left: { xs: 16, md: 280 }, right: 16, zIndex: 10, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, border: '1px solid #B9C9D6' }}><Typography fontWeight={700}>{selectedAssets.length} Assets Selected</Typography><Button variant="contained" onClick={() => { openDetails(); setDetailsOpen(true) }}>Move Outward</Button></Paper>}
      <Dialog open={detailsOpen && !movementType} onClose={closeDialogs} maxWidth="xs" fullWidth><DialogTitle>MOVE SELECTED ASSETS</DialogTitle><DialogContent><Typography sx={{ mb: 2 }}>Selected Assets: {selectedAssets.length}</Typography><Stack direction="row" spacing={2}><Button fullWidth variant="contained" onClick={() => chooseMovement('Rent')}>RENT</Button><Button fullWidth variant="contained" onClick={() => chooseMovement('Sell')}>SELL</Button></Stack></DialogContent><DialogActions><Button onClick={closeDialogs}>Cancel</Button></DialogActions></Dialog>
      <Dialog open={detailsOpen && Boolean(movementType)} onClose={closeDialogs} maxWidth="md" fullWidth><DialogTitle>{movementType === 'Rent' ? 'RENT OUT DETAILS' : 'SELL OUT DETAILS'}</DialogTitle><DialogContent><Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ pt: 1 }}><Stack spacing={2} sx={{ flex: 1 }}>{requiresAssetSelection && <Autocomplete multiple options={assets} value={selectedAssets} onChange={(_, nextAssets) => setSelection({ type: 'include', ids: new Set(nextAssets.map((asset) => asset.id)) })} getOptionLabel={(asset) => asset.productSerialNumber || asset.serialNumber || asset.assetId} isOptionEqualToValue={(option, value) => option.id === value.id} renderInput={(params) => <TextField {...params} label="Select Product Serial Numbers / Assets" placeholder="Select available assets" />} />}<TextField label="Customer Name" required value={customerName} onChange={(event) => setCustomerName(event.target.value)} /><TextField label="Document Number" required value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} /><TextField label="Product Description" value={selectedDescriptions || '-'} InputProps={{ readOnly: true }} /><TextField label="Product Model" value={selectedModels || '-'} InputProps={{ readOnly: true }} />{movementType === 'Rent' && <><TextField label="Rent Start Date" required type="date" value={rentStartDate} onChange={(event) => setRentStartDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="Rent End Date" type="date" value={rentEndDate} onChange={(event) => setRentEndDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></>}{movementType === 'Sell' && <TextField label="Invoice Number" required value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />}<TextField label="Remarks" multiline minRows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />{error && <Alert severity="error">{error}</Alert>}</Stack><Paper variant="outlined" sx={{ p: 2, minWidth: { md: 240 }, maxHeight: 280, overflow: 'auto' }}><Typography fontWeight={700} sx={{ mb: 1 }}>Selected Assets: {selectedAssets.length}</Typography>{selectedAssets.map((asset) => <Typography key={asset.id} variant="body2">{asset.productSerialNumber || asset.serialNumber}</Typography>)}</Paper></Stack></DialogContent><DialogActions><Button onClick={closeDialogs}>Cancel</Button><Button variant="contained" disabled={saving || !selectedAssets.length} onClick={submitMovement}>{saving ? 'Saving...' : 'Submit'}</Button></DialogActions></Dialog>
    </Box>
  )
}
