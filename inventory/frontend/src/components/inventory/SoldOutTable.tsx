'use client'

import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Snackbar, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { Delete, Edit } from '@mui/icons-material'
import { deleteAsset, type Asset } from '@/hooks/useAssets'
import { formatCurrency } from '@/lib/utils'
import type { ChipProps } from '@mui/material'

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

interface SoldOutTableProps {
  assets: Asset[]
  onEdit?: (asset: Asset) => void
}

export function SoldOutTable({ assets, onEdit }: SoldOutTableProps) {
  const [rows, setRows] = useState<Asset[]>(assets)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  useEffect(() => {
    setRows(assets)
  }, [assets])

  const totalAssets = rows.length

  const handleDeleteClick = (asset: Asset) => {
    setSelectedAsset(asset)
    setDeleteDialogOpen(true)
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setSelectedAsset(null)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedAsset) return

    setDeleting(true)
    try {
      await deleteAsset(selectedAsset.id)
      setRows((current) => current.filter((item) => item.id !== selectedAsset.id))
      setSnackbar({ open: true, message: 'Asset deleted successfully.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'Failed to delete asset.', severity: 'error' })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setSelectedAsset(null)
    }
  }

  return (
    <Box>
      <Table sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <TableHead sx={{ backgroundColor: '#F4F6F8' }}>
          <TableRow>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Customer</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Document</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Product</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Description</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Serial</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Model</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rate</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Invoice</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Remarks</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sold Date</TableCell>
            <TableCell sx={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: '#5F6B76', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((asset) => (
            <TableRow key={asset.id} sx={{ borderTop: '1px solid #EEF2F5' }}>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.customerName || '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.documentNumber || '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.productName || asset.name || '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.productDescription || asset.description || '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.productSerialNumber || asset.serialNumber || '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.productModel || '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.price ? formatCurrency(asset.price) : '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.invoiceNumber || '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.remarks || '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px', fontSize: 14, color: '#06283D' }}>{asset.updatedAt ? new Date(asset.updatedAt).toISOString().slice(0, 10) : '-'}</TableCell>
              <TableCell sx={{ padding: '14px 16px' }}>
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
                  <IconButton size="small" onClick={() => onEdit?.(asset)} aria-label="edit sold asset">
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDeleteClick(asset)} aria-label="delete sold asset">
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow sx={{ borderTop: '1px solid #E3E8EF', backgroundColor: '#FFFFFF' }}>
            <TableCell colSpan={11} sx={{ padding: '12px 16px', textAlign: 'left' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#06283D' }}>
                Total Assets: {totalAssets}
              </Typography>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Sold Asset</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this sold asset?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={deleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((current) => ({ ...current, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((current) => ({ ...current, open: false }))} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
