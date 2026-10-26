'use client'

import { useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { Download } from '@mui/icons-material'
import { useAssets } from '@/hooks/useAssets'
import { RentOutTable } from '@/components/inventory/RentOutTable'
import { OutStockTabs } from '@/components/inventory/OutStockTabs'
import { downloadExcelReport } from '@/lib/downloadExcelReport'

const getRentalMonths = (startDate?: string, endDate?: string) => {
  if (!startDate) return 0
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() - (end.getDate() < start.getDate() ? 1 : 0))
}

export default function OutStockPage() {
  const [activeTab, setActiveTab] = useState<'rent' | 'sold'>('rent')
  const [createdDateFilter, setCreatedDateFilter] = useState('')
  const [customerNameFilter, setCustomerNameFilter] = useState('')
  const [productModelFilter, setProductModelFilter] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const { assets, loading, error } = useAssets('', 'all', 'all', activeTab === 'rent' ? 'rented' : 'sold', 0)
  const { assets: otherTabAssets, error: otherTabError } = useAssets('', 'all', 'all', activeTab === 'rent' ? 'sold' : 'rented', 0)
  const filterAssets = useMemo(() => [...assets, ...otherTabAssets], [assets, otherTabAssets])
  const customerNames = useMemo(
    () => Array.from(new Set(filterAssets.map((asset) => asset.customerName?.trim()).filter((name): name is string => Boolean(name)))).sort((a, b) => a.localeCompare(b)),
    [filterAssets]
  )
  const productModels = useMemo(
    () => Array.from(new Set(filterAssets.map((asset) => asset.productModel?.trim()).filter((model): model is string => Boolean(model)))).sort((a, b) => a.localeCompare(b)),
    [filterAssets]
  )

  const exportRows = useMemo(() => assets.map((asset) => {
    const row = [asset.customerName || '-', asset.documentNumber || '-', asset.productSerialNumber || asset.serialNumber || '-', asset.productName || asset.name || '-', asset.productDescription || asset.description || '-', asset.productModel || '-', asset.price || 0]
    return activeTab === 'rent'
      ? [...row, asset.rentStartDate || '-', getRentalMonths(asset.rentStartDate, asset.rentEndDate), '-']
      : [...row, asset.invoiceNumber || '-', '-']
  }), [activeTab, assets])
  const handleDownload = async () => {
    const header = activeTab === 'rent'
      ? ['Customer Name', 'Document Number', 'Product Serial Number', 'Product Name', 'Product Description', 'Product Model', 'Rate / Price', 'Rent Start Date', 'Total Month', 'Remarks']
      : ['Customer Name', 'Document Number', 'Product Serial Number', 'Product Name', 'Product Description', 'Product Model', 'Sold Out Price', 'Invoice Number', 'Remarks']
    await downloadExcelReport({ fileName: `${activeTab === 'rent' ? 'rent-out' : 'sold-out'}-report.xlsx`, sheetName: activeTab === 'rent' ? 'Rent Out' : 'Sold Out', headers: header, rows: exportRows, textColumns: [1, 2, activeTab === 'rent' ? 9 : 7], wideColumns: [2, 3, 4] })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#F4F6F8', minHeight: '100%' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, color: '#06283D' }}>OUT STOCK DASHBOARD</Typography>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid #DDE4EA', bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, alignItems: { xs: 'stretch', lg: 'center' }, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, flex: 1, flexWrap: 'wrap' }}>
            <TextField
              type="date"
              label="Created Date"
              size="small"
              value={createdDateFilter}
              onChange={(event) => setCreatedDateFilter(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: { xs: '100%', sm: 200 } }}
            />
            <TextField
              select
              size="small"
              label="Customer Name"
              value={customerNameFilter}
              onChange={(event) => setCustomerNameFilter(event.target.value)}
              sx={{ width: { xs: '100%', sm: 200 } }}
            >
              <MenuItem value="">All Customers</MenuItem>
              {customerNames.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>
            <TextField
              select
              size="small"
              label="Product Model"
              value={productModelFilter}
              onChange={(event) => setProductModelFilter(event.target.value)}
              sx={{ width: { xs: '100%', sm: 200 } }}
            >
              <MenuItem value="">All Models</MenuItem>
              {productModels.map((model) => <MenuItem key={model} value={model}>{model}</MenuItem>)}
            </TextField>
          </Box>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleDownload}
            sx={{ bgcolor: '#06283D', '&:hover': { bgcolor: '#041c2d' }, minWidth: 170 }}
          >
            Download Report
          </Button>
        </Box>
      </Paper>
      {(error || otherTabError) && <Alert severity="error">{error || otherTabError}</Alert>}
      <OutStockTabs activeTab={activeTab} onChange={setActiveTab} />
      <Paper elevation={0} sx={{ border: '1px solid #DDE4EA', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <RentOutTable
            assets={assets}
            customerNameFilter={customerNameFilter}
            productModelFilter={productModelFilter}
            createdDateFilter={createdDateFilter}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            status={activeTab === 'rent' ? 'rented' : 'sold'}
          />
        )}
      </Paper>
    </Box>
  )
}
