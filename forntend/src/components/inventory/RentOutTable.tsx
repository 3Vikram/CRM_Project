'use client'

import React, { forwardRef, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Snackbar, Typography } from '@mui/material'
import { DataGrid, GridFooterContainer, GridPagination, type GridColDef } from '@mui/x-data-grid'
import { Delete, Edit } from '@mui/icons-material'
import type { Asset } from '@/hooks/useAssets'
import type { RentOutRow } from '@/components/inventory/rentOutTypes'
import type { ChipProps } from '@mui/material'
import { formatCurrency } from '@/lib/utils'
import { RentOutDialog } from '@/components/inventory/RentOutDialog'
import { createOutward, deleteAsset, getAssetSerialHistory, updateAsset } from '@/hooks/useAssets'

interface RentOutTableProps {
  assets: Asset[]
  customerNameFilter: string
  productModelFilter: string
  createdDateFilter: string
  search?: string
  pageSize?: number
  status?: 'rented' | 'sold'
}

const statusLabels: Record<string, string> = {
  available: 'IN_STOCK',
  outwarding: 'OUTWARDING',
  rented: 'RENTED',
  sold: 'SOLD',
  returned: 'RETURNED',
  damaged: 'DAMAGED',
  lost: 'LOST',
  unknown: 'UNKNOWN',
}

const statusColors: Record<string, ChipProps['color']> = {
  available: 'success',
  outwarding: 'warning',
  rented: 'info',
  sold: 'secondary',
  returned: 'default',
  damaged: 'error',
  lost: 'default',
  unknown: 'default',
}

const normalizeStatus = (status?: string | null) => {
  const value = String(status || '').trim().toLowerCase()
  if (!value) return 'unknown'
  if (['available', 'in_stock', 'in stock', 'outwarding', 'outward'].includes(value)) return 'available'
  if (['rented', 'rent_out', 'rent out', 'rentout'].includes(value)) return 'rented'
  if (['sold', 'sold_out', 'sold out', 'soldout'].includes(value)) return 'sold'
  if (['returned', 'return'].includes(value)) return 'returned'
  if (['damaged'].includes(value)) return 'damaged'
  if (['lost'].includes(value)) return 'lost'
  return value
}

const getStatusChipColor = (status?: string | null) => {
  const normalized = normalizeStatus(status)
  return statusColors[normalized] ?? 'default'
}

const getRentalMonthsCount = (startDate?: string | null, endDate?: string | null) => {
  if (!startDate || !String(startDate).trim()) return 0

  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return 0

  const end = endDate && String(endDate).trim() !== '' ? new Date(endDate) : null
  const comparison = end && !Number.isNaN(end.getTime()) ? end : new Date()

  if (Number.isNaN(comparison.getTime())) return 0
  if (comparison.getTime() < start.getTime()) return 0

  const months = (comparison.getFullYear() - start.getFullYear()) * 12 + (comparison.getMonth() - start.getMonth())
  const dayAdjustedMonths = comparison.getDate() < start.getDate() ? months - 1 : months

  return Math.max(0, dayAdjustedMonths)
}

type RentOutFooterTotals = {
  totalRentOutPrice: number
  totalMonths: number
  totalMonthwisePrice: number
}

function buildRows(assets: Asset[], status: 'rented' | 'sold', transactionRates: Record<string, number> = {}): RentOutRow[] {
  return assets
    .filter((asset) => {
      const normalizedStatus = String(asset.status || '').toLowerCase()
      return normalizedStatus === status
    })
    .map((asset) => {
      const totalMonths = getRentalMonthsCount(asset.rentStartDate || '', asset.rentEndDate || '')
      const monthwiseTotalPrice = totalMonths * (asset.price || 0)

      return {
        id: asset.id,
        assetId: asset.assetId || '-',
        customerName: asset.customerName || '',
        documentNumber: asset.documentNumber || '',
        productSerialNumber: asset.productSerialNumber || asset.serialNumber || '',
        productName: asset.productName || asset.name || '',
        productDescription: asset.productDescription || asset.description || '',
        productModel: asset.productModel || '',
        ratePerMonth: transactionRates[asset.id] ?? 0,
        rentStartDate: asset.rentStartDate || '',
        rentEndDate: asset.rentEndDate || '',
        totalMonths,
        monthwiseTotalPrice,
        invoiceNumber: asset.invoiceNumber || '',
        remarks: '-',
        status: asset.status,
        originalAsset: asset,
      }
    })
}

export function RentOutTable({ assets, customerNameFilter, productModelFilter, createdDateFilter, search = '', pageSize = 8, status = 'rented' }: RentOutTableProps) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<RentOutRow[]>([])
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const [paginationModel, setPaginationModel] = useState({ pageSize, page: 0 })
  const [transactionRates, setTransactionRates] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false

    const loadRows = async () => {
      if (status !== 'rented') {
        const rateEntries = await Promise.all(assets.map(async (asset) => {
          try {
            const history = await getAssetSerialHistory(asset.productSerialNumber || asset.serialNumber)
            return [asset.id, Number(history.finalSale?.saleAmount || 0)] as const
          } catch {
            return [asset.id, 0] as const
          }
        }))

        if (cancelled) return
        const nextRates = Object.fromEntries(rateEntries)
        setTransactionRates(nextRates)
        setRows(buildRows(assets, status, nextRates))
        return
      }

      const rateEntries = await Promise.all(assets.map(async (asset) => {
        try {
          const history = await getAssetSerialHistory(asset.productSerialNumber || asset.serialNumber)
          const latestRental = history.rentalHistory?.[history.rentalHistory.length - 1]
          return [asset.id, Number(latestRental?.monthlyRentalPrice || 0)] as const
        } catch {
          return [asset.id, 0] as const
        }
      }))

      if (cancelled) return
      const nextRates = Object.fromEntries(rateEntries)
      setTransactionRates(nextRates)
      setRows(buildRows(assets, status, nextRates))
    }

    void loadRows()
    setPaginationModel({ pageSize, page: 0 })
    return () => {
      cancelled = true
    }
  }, [assets, pageSize, status])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const customerMatch = !customerNameFilter || row.customerName.toLowerCase().includes(customerNameFilter.toLowerCase())
      const productMatch = !productModelFilter || row.productModel.toLowerCase().includes(productModelFilter.toLowerCase())
      const createdDateMatch = !createdDateFilter || (row.originalAsset.createdAt || '').slice(0, 10) === createdDateFilter
      const searchMatch = !search || [row.customerName, row.documentNumber, row.productSerialNumber, row.productName, row.productDescription, row.productModel, String(row.ratePerMonth), row.rentStartDate, row.rentEndDate, String(row.totalMonths), row.invoiceNumber, row.remarks].join(' ').toLowerCase().includes(search.toLowerCase())
      return customerMatch && productMatch && createdDateMatch && searchMatch
    })
  }, [rows, customerNameFilter, productModelFilter, createdDateFilter, search])

  const totals = useMemo(
    () => ({
      totalRentOutPrice: filteredRows.reduce((sum, row) => sum + (row.ratePerMonth || 0), 0),
      totalMonths: filteredRows.reduce((sum, row) => sum + (row.totalMonths || 0), 0),
      totalMonthwisePrice: filteredRows.reduce((sum, row) => sum + (row.monthwiseTotalPrice || 0), 0),
    }),
    [filteredRows]
  )

  const totalRentOutAssets = filteredRows.length

  const totalsRow = useMemo(
    () => ({
      id: 'totals',
      customerName: 'Totals',
      documentNumber: '',
      productSerialNumber: '',
      productName: '',
      productDescription: '',
      productModel: '',
      ratePerMonth: totals.totalRentOutPrice,
      rentStartDate: '',
      rentEndDate: '',
      totalMonths: totals.totalMonths,
      monthwiseTotalPrice: totals.totalMonthwisePrice,
      invoiceNumber: '',
      remarks: '',
      status: '',
    }),
    [totals]
  )

  const handleOpenDialog = (asset: Asset) => {
    setSelectedAsset({ ...asset, price: transactionRates[asset.id] ?? asset.price })
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setSelectedAsset(null)
  }

  const handleDeleteClick = (asset: Asset) => {
    setSelectedAsset(asset)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false)
    setSelectedAsset(null)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedAsset) return

    setDeleting(true)
    try {
      await deleteAsset(selectedAsset.id)
      setRows((current) => current.filter((row) => row.id !== selectedAsset.id))
      setSnackbar({ open: true, message: 'Rent Out record deleted successfully.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'Failed to delete Rent Out record.', severity: 'error' })
    } finally {
      setDeleting(false)
      setDeleteConfirmOpen(false)
      setSelectedAsset(null)
    }
  }

  const handleSubmit = async (values: {
    customerName: string
    documentNumber: string
    productName: string
    productDescription: string
    productSerialNumber: string
    outwardType: 'Rent' | 'Sell'
    productModel: string
    quantity: number
    ratePerMonth: number
    rentStartDate: string
    rentEndDate: string
    invoiceNumber: string
    remarks: string
  }) => {
    if (!selectedAsset) return

    const isReturnCompletion = Boolean(
      values.rentEndDate &&
      String(values.rentEndDate).trim() &&
      selectedAsset.status === 'rented' &&
      (!selectedAsset.rentEndDate || String(selectedAsset.rentEndDate).trim() === '')
    )

    setSubmitting(true)
    try {
      if (isReturnCompletion) {
        await updateAsset(selectedAsset.id, {
          status: 'available',
          invoiceNumber: values.invoiceNumber,
          customerName: values.customerName,
          documentNumber: values.documentNumber,
          rentStartDate: values.rentStartDate,
          rentEndDate: values.rentEndDate,
          description: values.productDescription,
          productDescription: values.productDescription,
          productName: values.productName,
          productSerialNumber: values.productSerialNumber,
          productModel: values.productModel,
          price: values.ratePerMonth,
          // For serial-number assets ensure availableQuantity is at least 1
          availableQuantity: selectedAsset.quantity && Number(selectedAsset.quantity) > 0 ? Number(selectedAsset.quantity) : 1,
        })

        setRows((current) => current.filter((row) => row.id !== selectedAsset.id))
        setSnackbar({ open: true, message: 'Rental marked as returned and moved back to In Stock.', severity: 'success' })
        handleCloseDialog()
        return
      }

      await updateAsset(selectedAsset.id, {
        invoiceNumber: values.invoiceNumber,
        quantity: Number(values.quantity) || 1,
        remarks: values.remarks,
        customerName: values.customerName,
        documentNumber: values.documentNumber,
        rentStartDate: values.rentStartDate,
        rentEndDate: values.rentEndDate,
        description: values.productDescription,
        productDescription: values.productDescription,
        productName: values.productName,
        productSerialNumber: values.productSerialNumber,
        productModel: values.productModel,
        price: values.ratePerMonth,
      })

      setRows((current) => {
        const isSoldAsset = String(selectedAsset.status || '').trim().toLowerCase() === 'sold'

        if (values.outwardType === 'Sell' && !isSoldAsset) {
          return current.filter((row) => row.id !== selectedAsset.id)
        }

        return current.map((row) =>
          row.id === selectedAsset.id
            ? {
                ...row,
                customerName: values.customerName,
                documentNumber: values.documentNumber,
                productSerialNumber: values.productSerialNumber,
                productName: values.productName,
                productDescription: values.productDescription,
                productModel: values.productModel,
                ratePerMonth: values.ratePerMonth,
                rentStartDate: values.rentStartDate,
                rentEndDate: values.rentEndDate,
                invoiceNumber: values.invoiceNumber,
                remarks: values.remarks,
                status: isSoldAsset ? 'sold' : 'rented',
              }
            : row
        )
      })

      handleCloseDialog()
    } catch (error) {
      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'Failed to save rent out record.', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const columns: GridColDef[] = [
    { field: 'customerName', headerName: 'Customer Name', flex: 1.2, minWidth: 170, renderCell: (params) => <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>{params.value || ''}</Box> },
    { field: 'documentNumber', headerName: 'Document Number', flex: 1.1, minWidth: 170, renderCell: (params) => <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>{params.value || ''}</Box> },
    { field: 'productSerialNumber', headerName: 'Serial Number', flex: 1.1, minWidth: 220, renderCell: (params) => {
      const serialNumber = String(params.value || '').trim()
      if (!serialNumber) {
        return <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>-</Box>
      }
      return (
        <Box
          component="button"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            navigate(`/inventory/rental-lifecycle/${encodeURIComponent(serialNumber)}`)
          }}
          sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75, border: 0, padding: 0, background: 'none', color: '#0B63E5', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
        >
          {serialNumber}
        </Box>
      )
    } },
    { field: 'productName', headerName: 'Product Name', flex: 1.4, minWidth: 260, renderCell: (params) => <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>{params.value || ''}</Box> },
    { field: 'productDescription', headerName: 'Description', flex: 1.7, minWidth: 350, renderCell: (params) => <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>{params.value || ''}</Box> },
    { field: 'productModel', headerName: 'Product Model', flex: 1, minWidth: 160, renderCell: (params) => <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>{params.value || ''}</Box> },
    { field: 'ratePerMonth', headerName: status === 'sold' ? 'Sold Out Price' : 'Rate / Price', flex: 1, minWidth: 120, valueGetter: (_, row) => (row.ratePerMonth ? formatCurrency(row.ratePerMonth) : '—') },
    ...(status === 'rented' ? [
      { field: 'rentStartDate', headerName: 'Rent Start Date', flex: 1, minWidth: 130, renderCell: (params: any) => <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>{params.value || ''}</Box> },
      { field: 'totalMonths', headerName: 'Total Month', flex: 0.9, minWidth: 115, renderCell: (params: any) => <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>{params.value ?? 0}</Box> },
    ] : [
      { field: 'invoiceNumber', headerName: 'Invoice Number', flex: 1.1, minWidth: 150, renderCell: (params: any) => <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>{params.value || ''}</Box> },
    ]),
    { field: 'remarks', headerName: 'Remarks', flex: 1.1, minWidth: 160, renderCell: (params) => <Box sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 }}>{params.value || ''}</Box> },
    {
      field: 'action',
      headerName: 'Action',
      sortable: false,
      flex: 0.8,
      minWidth: 110,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
          <IconButton size="small" onClick={() => handleOpenDialog(params.row.originalAsset as Asset)} aria-label="edit rent out record">
            <Edit fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => handleDeleteClick(params.row.originalAsset as Asset)} aria-label="delete rent out record">
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, p: 2, borderBottom: '1px solid #E3E8EF', alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }} color="#06283D">
          Rent Out Records
        </Typography>
      </Box>

      <Box sx={{ height: 560, width: '100%', position: 'relative' }}>
        {filteredRows.length === 0 ? (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.94)' }}>
            <Typography variant="subtitle1" color="#06283D" sx={{ fontWeight: 600 }}>
              No Rent Out Records Found
            </Typography>
          </Box>
        ) : null}
        <DataGrid
          rows={filteredRows}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[5, 8, 12]}
          disableRowSelectionOnClick
          getRowHeight={() => 'auto'}
          pinnedRows={{ bottom: [totalsRow] }}
          getRowClassName={(params) => (params.id === 'totals' ? 'rentout-totals-row' : '')}
          slots={{
            footer: () => (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', px: 2, py: 1, borderTop: '1px solid #E3E8EF', backgroundColor: '#FFFFFF' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#06283D' }}>
                  Total Assets: {totalRentOutAssets}
                </Typography>
                <GridFooterContainer sx={{ borderTop: 0 }}>
                  <GridPagination />
                </GridFooterContainer>
              </Box>
            ),
          }}
          sx={{
            '& .rentout-totals-row .MuiDataGrid-cell': {
              fontWeight: 700,
              backgroundColor: '#F7F9FC',
            },
            border: 0,
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#0B1F33 !important',
              color: '#FFFFFF !important',
              minHeight: '48px !important',
              maxHeight: '48px !important',
              height: '48px !important',
            },
            '& .MuiDataGrid-columnHeadersInner': {
              backgroundColor: '#0B1F33 !important',
            },
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: '#0B1F33 !important',
              color: '#FFFFFF !important',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              color: '#FFFFFF !important',
              fontWeight: 700,
              opacity: '1 !important',
            },
            '& .MuiDataGrid-cell': { borderBottom: '1px solid #F0F3F6', fontSize: '14px', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4, py: 0.75 },
            '& .MuiDataGrid-cellContent': { whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.4 },
          }}
        />
      </Box>

      <RentOutDialog open={dialogOpen} asset={selectedAsset} onClose={handleCloseDialog} onSubmit={handleSubmit} submitLabel={submitting ? 'Saving...' : 'Update'} />

      <Dialog open={deleteConfirmOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Rent Out Record</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this Rent Out record?
            <br />
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Box>
  )
}
