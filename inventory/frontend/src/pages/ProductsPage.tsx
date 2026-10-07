'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, GridFooterContainer, GridPagination, type GridColDef } from '@mui/x-data-grid'
import { Add, Delete, Download, Edit, Search } from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils'
import { downloadExcelReport } from '@/lib/downloadExcelReport'

interface Product {
  id: string
  productName: string
  productModel?: string
  description: string
  price: number
  hsnSac: string
  gst: string
  createdAt?: string
  updatedAt?: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const GST_OPTIONS = [
  'CGST + SGST 5%',
  'IGST 5%',
  'CGST + SGST 12%',
  'IGST 12%',
  'CGST + SGST 18%',
  'IGST 18%',
  'CGST + SGST 28%',
  'IGST 28%',
  'EGST 0%',
] as const

const emptyForm = {
  productName: '',
  productModel: '',
  description: '',
  price: '',
  hsnSac: '',
  gst: '',
}

const getGstValueFromLabel = (label: string) => {
  const match = label.match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

const getGstLabelFromValue = (value: string | number | null | undefined) => {
  const numericValue = Number(value)
  const matchingOption = GST_OPTIONS.find((option) => getGstValueFromLabel(option) === numericValue)
  return matchingOption || ''
}

const formatGstForDisplay = (gstLabel: string) => {
  if (!gstLabel) return '-'
  // Replace space before percentage with hyphen for CGST + SGST options
  return gstLabel.replace(/^(CGST \+ SGST) /, '$1- ')
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [productNameFilter, setProductNameFilter] = useState('')
  const [descriptionFilter, setDescriptionFilter] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/products`)
      if (!response.ok) throw new Error('Failed to fetch products')
      const data = await response.json()
      setProducts(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchProducts()
  }, [])

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const normalizedProductName = productNameFilter.trim().toLowerCase()
    const normalizedDescription = descriptionFilter.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        [product.productName, product.productModel || '', product.description, product.hsnSac, String(product.gst), String(product.price)]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)

      const matchesProductName = !normalizedProductName || product.productName.toLowerCase().includes(normalizedProductName)
      const matchesDescription = !normalizedDescription || product.description.toLowerCase().includes(normalizedDescription)

      return matchesSearch && matchesProductName && matchesDescription
    })
  }, [products, productNameFilter, descriptionFilter, search])

  const columns: GridColDef[] = [
    {
      field: 'productName',
      headerName: 'Product Name',
      flex: 1.8,
      minWidth: 300,
      sortable: true,
      cellClassName: 'product-cell',
      renderCell: (params) => (
        <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.8, py: 1.1, display: 'block' }}>{params.value || '-'}</Box>
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2.8,
      minWidth: 450,
      sortable: true,
      cellClassName: 'description-cell',
      renderCell: (params) => (
        <Box sx={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.8, py: 1.1, display: 'block' }}>{params.value || '-'}</Box>
      ),
    },
    { field: 'hsnSac', headerName: 'HSN/SAC', flex: 1, minWidth: 120, sortable: true },
    { field: 'gst', headerName: 'GST', flex: 0.8, minWidth: 100, sortable: true },
    { field: 'price', headerName: 'Vendor Price', flex: 1, minWidth: 120, sortable: true },
    { field: 'createdDate', headerName: 'Created Date', flex: 1.1, minWidth: 150, sortable: true },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      sortable: false,
      renderCell: (params) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.25,
            width: '100%',
            minHeight: 80,
            py: 1,
            whiteSpace: 'nowrap',
          }}
        >
          <Button
            variant="outlined"
            startIcon={<Edit />}
            onClick={() => {
              setEditingProduct(params.row.product)
              setIsDialogOpen(true)
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              borderRadius: 2,
              textTransform: 'none',
              height: 38,
              minWidth: 94,
              px: 1.5,
              fontSize: '0.94rem',
              whiteSpace: 'nowrap',
            }}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            onClick={() => void deleteProduct(params.row.product.id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              borderRadius: 2,
              textTransform: 'none',
              height: 38,
              minWidth: 106,
              px: 1.5,
              fontSize: '0.94rem',
              whiteSpace: 'nowrap',
            }}
          >
            Delete
          </Button>
        </Box>
      ),
    },
  ]

  const rows = filteredRows.map((product) => ({
    id: product.id,
    productName: product.productName || '-',
    description: product.description || '-',
    hsnSac: product.hsnSac || '-',
    gst: formatGstForDisplay(String(product.gst || '')),
    price: product.price ? formatCurrency(product.price) : '-',
    createdDate: product.createdAt ? new Date(product.createdAt).toLocaleDateString() : '-',
    product,
  }))

  const deleteProduct = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/products/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unable to delete product' }))
        throw new Error(errorData.error || 'Unable to delete product')
      }

      setError(null)
      await fetchProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete product')
    }
  }

  const handleDownloadReport = async () => {
    await downloadExcelReport({
      fileName: 'products-report.xlsx',
      sheetName: 'Products',
      headers: ['Product Name', 'Description', 'HSN/SAC', 'GST', 'Price', 'Created Date'],
      rows: rows.map((row) => [row.productName, row.description, row.hsnSac, row.gst, row.price, row.createdDate]),
      wideColumns: [0, 1],
    })
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 3, backgroundColor: '#F4F6F8' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, px: { xs: 0, md: 0.5 }, position: 'relative', zIndex: 1 }}>
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, fontSize: { xs: '1.8rem', sm: '2.125rem' }, lineHeight: 1.2, color: '#06283D', whiteSpace: 'normal' }}
          >
            PRODUCTS
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' }, width: { xs: '100%', md: 'auto' } }}>
          <Button variant="contained" startIcon={<Download />} onClick={() => void handleDownloadReport()} sx={{ borderRadius: 2, px: 2.25, py: 1.1, bgcolor: '#0B1F33', '&:hover': { bgcolor: '#142c45' }, textTransform: 'none', fontWeight: 600 }}>Download Report</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setEditingProduct(null); setIsDialogOpen(true) }} sx={{ borderRadius: 2, px: 2.25, py: 1.1, bgcolor: '#0B1F33', '&:hover': { bgcolor: '#142c45' }, textTransform: 'none', fontWeight: 600 }}>Add Product</Button>
        </Box>
      </Box>

      <Paper elevation={0} sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', border: '1px solid #E8EEF5', borderRadius: 3, backgroundColor: '#FFFFFF', boxShadow: '0 12px 28px rgba(15, 36, 56, 0.04)', p: { xs: 2, md: 2.5 } }}>
        <Grid container spacing={2} alignItems="center" sx={{ width: '100%', maxWidth: '100%' }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Product Name"
              value={productNameFilter}
              onChange={(event) => setProductNameFilter(event.target.value)}
              sx={{
                '& .MuiInputBase-root': { borderRadius: 2, minHeight: 48, fontSize: '15px' },
                '& .MuiInputLabel-root': { fontSize: '15px' },
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Product Description"
              value={descriptionFilter}
              onChange={(event) => setDescriptionFilter(event.target.value)}
              sx={{
                '& .MuiInputBase-root': { borderRadius: 2, minHeight: 48, fontSize: '15px' },
                '& .MuiInputLabel-root': { fontSize: '15px' },
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="show-entries-label" sx={{ fontSize: '15px' }}>Show Entries</InputLabel>
              <Select
                labelId="show-entries-label"
                label="Show Entries"
                value={pageSize}
                onChange={(event) => {
                  const nextSize = Number(event.target.value)
                  setPageSize(nextSize)
                  setPaginationModel({ page: 0, pageSize: nextSize })
                }}
                sx={{
                  borderRadius: 2,
                  minHeight: 48,
                  '& .MuiSelect-select': { minHeight: '48px', display: 'flex', alignItems: 'center', fontSize: '15px' },
                }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}

      <Paper elevation={0} sx={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', border: '1px solid #E8EEF5', borderRadius: 3, overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: '0 12px 28px rgba(15, 36, 56, 0.04)' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
            <Box sx={{ minWidth: 980, width: '100%', height: 'auto' }}>
              <DataGrid
                rows={rows}
                columns={columns}
                pagination
                paginationMode="client"
                pageSizeOptions={[10, 25, 50, 100]}
                paginationModel={paginationModel}
                onPaginationModelChange={(model) => {
                  setPaginationModel(model)
                  setPageSize(model.pageSize)
                }}
                disableRowSelectionOnClick
                sortingMode="client"
                autoHeight
                getRowHeight={() => 'auto'}
                slots={{
                  footer: () => (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        px: 2,
                        py: 1,
                        borderTop: '1px solid #EEF2F5',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#06283D' }}>
                        Total Products: {filteredRows.length}
                      </Typography>

                      <GridFooterContainer sx={{ borderTop: 0 }}>
                        <GridPagination />
                      </GridFooterContainer>
                    </Box>
                  ),
                }}
                sx={{
                  border: 0,
                  backgroundColor: '#FFFFFF',
                  width: '100%',
                  maxWidth: '100%',
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: '#0B1F33',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '13px',
                    letterSpacing: '0.02em',
                    borderBottom: '2px solid #0B1F33',
                    minHeight: 52,
                    height: 52,
                    borderRadius: '10px 10px 0 0',
                  },
                  '& .MuiDataGrid-columnHeader': {
                    backgroundColor: '#0B1F33',
                    color: '#FFFFFF',
                    minHeight: 52,
                    height: 52,
                    py: 1,
                  },
                  '& .MuiDataGrid-columnHeaderTitleContainer': {
                    color: '#FFFFFF',
                  },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    color: '#FFFFFF !important',
                    fontWeight: 700,
                    fontSize: '13px',
                    lineHeight: 1.25,
                    whiteSpace: 'normal',
                  },
                  '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid #EEF2F5',
                    color: '#06283D',
                    fontSize: '15px',
                    fontWeight: 500,
                    lineHeight: 1.8,
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    py: 1.25,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    alignItems: 'flex-start',
                  },
                  '& .MuiDataGrid-row': {
                    backgroundColor: '#FFFFFF',
                    minHeight: '80px !important',
                  },
                  '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: '#F9FBFD' },
                  '& .MuiDataGrid-row:hover': { backgroundColor: '#EEF5FF' },
                  '& .MuiDataGrid-footerContainer': { borderTop: '1px solid #EEF2F5' },
                  '& .MuiDataGrid-virtualScroller': { overflowX: 'hidden' },
                }}
              />
            </Box>
          </Box>
        )}
      </Paper>

      <ProductDialog
        open={isDialogOpen}
        product={editingProduct}
        onClose={() => setIsDialogOpen(false)}
        onSaved={async () => {
          setIsDialogOpen(false)
          await fetchProducts()
        }}
      />
    </Box>
  )
}

function ProductDialog({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean
  product: Product | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (product) {
      // Convert old numeric GST values to new label format for backward compatibility
      let gstValue = product.gst
      
      // Check if it's already a valid GST label
      const isValidLabel = typeof gstValue === 'string' && GST_OPTIONS.includes(gstValue as any)
      
      if (!isValidLabel && gstValue) {
        // Old format: convert number to label (e.g., 5 or "5" -> "CGST + SGST 5%")
        const numericValue = typeof gstValue === 'number' ? gstValue : Number(String(gstValue).trim())
        if (!Number.isNaN(numericValue) && numericValue > 0) {
          const matchingOption = GST_OPTIONS.find((option) => getGstValueFromLabel(option) === numericValue)
          gstValue = matchingOption || ''
        }
      }
      
      setForm({
        productName: product.productName || '',
        productModel: product.productModel || '',
        description: product.description || '',
        price: String(product.price ?? ''),
        hsnSac: product.hsnSac || '',
        gst: String(gstValue ?? ''),
      })
    } else {
      setForm(emptyForm)
    }
    setErrors({})
    setSubmitError(null)
  }, [product, open])

  const handleChange = (field: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!form.productName.trim()) nextErrors.productName = 'Product Name is required'
    if (!form.price || Number(form.price) <= 0) nextErrors.price = 'Price is required'
    if (!form.gst) nextErrors.gst = 'GST is required'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        productName: form.productName.trim(),
        productModel: form.productModel.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        hsnSac: form.hsnSac.trim(),
        gst: form.gst,
      }

      // Debug logging
      console.log('=== PRODUCT UPDATE ===')
      console.log('Product ID:', product?.id)
      console.log('Current Product GST (from db):', product?.gst, `(type: ${typeof product?.gst})`)
      console.log('Form GST (from form state):', form.gst, `(type: ${typeof form.gst})`)
      console.log('Payload GST (sending to API):', payload.gst)
      console.log('Full Payload:', payload)
      console.log('=== END DEBUG ===')

      const url = `${API_URL}/api/products${product ? `/${product.id}` : ''}`
      console.log('API URL:', url)
      console.log('Method:', product ? 'PUT' : 'POST')

      const response = await fetch(url, {
        method: product ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unable to save product' }))
        const errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData)
        console.error('API Error Response:', errorData)
        throw new Error(errorMessage || 'Unable to save product')
      }

      const responseData = await response.json()
      console.log('API Success Response:', responseData)

      window.dispatchEvent(new CustomEvent('inventory:data-updated'))
      await onSaved()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save product'
      console.error('Error in handleSave:', message)
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setForm(emptyForm)
    setErrors({})
    setSubmitError(null)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ color: '#06283D', fontWeight: 700, pb: 1 }}>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Product Name"
              value={form.productName}
              onChange={(event) => handleChange('productName', event.target.value)}
              error={Boolean(errors.productName)}
              helperText={errors.productName}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Product Model"
              value={form.productModel}
              onChange={(event) => handleChange('productModel', event.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Vendor Price"
              type="number"
              value={form.price}
              onChange={(event) => handleChange('price', event.target.value)}
              error={Boolean(errors.price)}
              helperText={errors.price}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Description"
              multiline
              minRows={3}
              value={form.description}
              onChange={(event) => handleChange('description', event.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="HSN/SAC"
              value={form.hsnSac}
              onChange={(event) => handleChange('hsnSac', event.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth error={Boolean(errors.gst)}>
              <InputLabel id="gst-select-label">GST</InputLabel>
              <Select
                labelId="gst-select-label"
                label="GST"
                value={form.gst}
                onChange={(event) => {
                  handleChange('gst', String(event.target.value || ''))
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              >
                {GST_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {submitError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submitError}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, justifyContent: 'space-between' }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none' }}>
          Cancel
        </Button>

        <Stack direction="row" spacing={1}>
          <Button onClick={handleReset} variant="text" sx={{ borderRadius: 2, textTransform: 'none' }}>
            Reset
          </Button>
          <Button
            onClick={() => void handleSave()}
            variant="contained"
            disabled={submitting}
            sx={{ borderRadius: 2, textTransform: 'none', bgcolor: '#0B1F33', '&:hover': { bgcolor: '#142c45' } }}
          >
            {submitting ? 'Saving...' : 'Save Product'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
