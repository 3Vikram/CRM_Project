'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { DataGrid, GridFooterContainer, GridPagination, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid'
import { Add, Delete, Download, Edit, KeyboardReturn, Visibility, WarningAmber } from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchableDropdown } from '@/components/ui/searchable-dropdown'
import { downloadExcelReport } from '@/lib/downloadExcelReport'
import {
  createBulkAssets,
  createOutward,
  createReturn,
  deleteAsset,
  deleteBulkAssets,
  deleteAssetDocument,
  getAssetById,
  getAssetMovements,
  uploadAssetDocument,
  type Asset,
  type AssetMovementSummary,
  updateAsset,
  useAssets,
  useFilterOptions,
} from '@/hooks/useAssets'

const statusFilterOptions = [
  { value: 'available', label: 'In Stock' },
  { value: 'rented', label: 'Rent' },
  { value: 'sold', label: 'Sold' },
  { value: 'returned', label: 'Returned' },
]

const statusLabels: Record<string, string> = {
  available: 'IN STOCK',
  rented: 'RENT OUT',
  sold: 'SOLD OUT',
}

const statusColors: Record<string, 'success' | 'info' | 'secondary' | 'default' | 'error' | 'warning'> = {
  available: 'success',
  rented: 'info',
  sold: 'secondary',
}

const normalizeStatus = (status?: string | null) => {
  const value = String(status || '').trim().toLowerCase()
  if (!value) return 'unknown'
  if (['available', 'in_stock', 'in stock', 'in stock'].includes(value)) return 'available'
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

type ProductCatalogItem = {
  id: string
  productName: string
  description: string
  productModel: string
  vendorName: string
  defaultPrice: number
  price: number
  hsnSac?: string
  gst?: string
  productId?: string | null
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const dateFieldSx = {
  '& .MuiInputBase-root': {
    minHeight: 56,
    alignItems: 'center',
    borderRadius: 12,
  },
  '& .MuiInputBase-input': {
    paddingTop: '16.5px',
    paddingBottom: '16.5px',
    fontSize: '0.95rem',
    color: '#06283D',
  },
  '& .MuiInputLabel-root': {
    color: '#5F6B76',
    '&.Mui-focused': {
      color: '#06283D',
    },
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: '#D7DEE8',
    },
    '&:hover fieldset': {
      borderColor: '#06283D',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#06283D',
      borderWidth: 1,
    },
  },
}

export default function AllAssetsPage({ initialStatus = 'all' }: { initialStatus?: string }) {
  const isInStockPage = initialStatus === 'IN_STOCK' || initialStatus === 'available' || initialStatus === 'in_stock'
  const isRentOutPage = initialStatus === 'RENTED' || initialStatus === 'rented' || initialStatus === 'RENT OUT' || initialStatus === 'rent-out'
  const enableSerialHistory = initialStatus === 'all'
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [invoiceDateFilter, setInvoiceDateFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState<string | null>(null)
  const [vendorFilter, setVendorFilter] = useState<string | null>(null)
  const [productFilter, setProductFilter] = useState<string | null>(null)
  const [modelFilter, setModelFilter] = useState<string | null>(null)
  const [inwardTypeFilter, setInwardTypeFilter] = useState('all')
  const [pageSize, setPageSize] = useState(10)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 })

  const mapDisplayToInternal = (s: string) => {
    if (!s) return 'all'
    const up = String(s).toUpperCase().replace(/\s+/g, ' ').trim()
    if (up === 'IN STOCK' || up === 'IN_STOCK') return 'available'
    if (up === 'RENT' || up === 'RENT OUT' || up === 'RENTED') return 'rented'
    if (up === 'SOLD OUT' || up === 'SOLD') return 'sold'
    if (up === 'RETURNED') return 'returned'
    if (up === 'DAMAGED') return 'damaged'
    return s.toLowerCase()
  }

  const initialInternal = initialStatus === 'all' ? 'all' : mapDisplayToInternal(initialStatus)
  const [statusFilter, setStatusFilter] = useState(initialInternal)
  const [statusQuery, setStatusQuery] = useState(initialInternal)
  const [returnedSupplierFilter, setReturnedSupplierFilter] = useState('')
  const [returnedModelFilter, setReturnedModelFilter] = useState<string | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single')
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const isAllAssetsPage = initialStatus === 'all'
  const isReturnedPage = initialStatus === 'RETURNED' || initialStatus === 'returned' || location.pathname.includes('returned-assets')
  const showAddButton = initialStatus === 'IN_STOCK'
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() })
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [productCatalog, setProductCatalog] = useState<ProductCatalogItem[]>([])
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [returnAsset, setReturnAsset] = useState<Asset | null>(null)
  const [returnSupplier, setReturnSupplier] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [returnError, setReturnError] = useState<string | null>(null)
  const [returnLoading, setReturnLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [documentAssetId, setDocumentAssetId] = useState<string | null>(null)
  const [documentAction, setDocumentAction] = useState<'upload' | 'replace' | null>(null)
  const [documentUploading, setDocumentUploading] = useState(false)
  const [quickActionAnchor, setQuickActionAnchor] = useState<null | HTMLElement>(null)
  const [quickActionAsset, setQuickActionAsset] = useState<Asset | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch assets from the backend using the current filters and status query.
  const { assets, loading, error } = useAssets(search, categoryFilter, locationFilter, statusQuery, refreshKey)
  const { options } = useFilterOptions()
  const allAssets = useMemo(() => Array.isArray(assets) ? assets : [], [assets])

  const filteredAssets = useMemo(() => {
    if (isAllAssetsPage) return allAssets

    const targetStatus = ((): string | null => {
      if (isInStockPage) return 'available'
      if (isRentOutPage) return 'rented'
      if (initialStatus === 'SOLD' || initialStatus === 'sold') return 'sold'
      if (isReturnedPage) return 'returned'
      return null
    })()

    if (!targetStatus) return allAssets

    return allAssets.filter((asset) => String(asset.status || '').toLowerCase() === targetStatus)
  }, [allAssets, initialStatus, isAllAssetsPage, isInStockPage, isRentOutPage, isReturnedPage])

  const refreshAssets = () => setRefreshKey((value) => value + 1)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`${API_URL}/api/products`)
        if (!response.ok) throw new Error('Failed to fetch products')
        const data = await response.json()
        const normalized = Array.isArray(data)
          ? Array.from(
              new Map(
                data
                  .filter((product: any) => product && String(product.productName || '').trim())
                  .map((product: any) => {
                    const productName = String(product.productName || '').trim()
                    const id = String(product.id || product._id || productName)
                    return [productName.toLowerCase(), {
                      id,
                      productName,
                      description: String(product.description || ''),
                      productModel: String(product.productModel || ''),
                      vendorName: String(product.vendorName || ''),
                      defaultPrice: Number(product.defaultPrice ?? product.price ?? 0),
                      price: Number(product.price ?? 0),
                      hsnSac: String(product.hsnSac || ''),
                      gst: String(product.gst || ''),
                      productId: product.productId || product.id || product._id || null,
                    }]
                  })
              ).values()
            ).sort((a, b) => a.productName.localeCompare(b.productName))
          : []
        setProductCatalog(normalized)
      } catch (error) {
        console.error('Error fetching product catalog:', error)
        setProductCatalog([])
      }
    }

    void fetchProducts()

    const handleProductRefresh = () => {
      void fetchProducts()
    }

    window.addEventListener('inventory:data-updated', handleProductRefresh)
    return () => {
      window.removeEventListener('inventory:data-updated', handleProductRefresh)
    }
  }, [isAddOpen])

  const customerOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => (asset as any).customerName).filter(Boolean) as string[])).sort(),
    [assets]
  )

  const vendorOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.vendorName).filter(Boolean) as string[])).sort(),
    [assets]
  )

  const productOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.productName || asset.name).filter(Boolean) as string[])).sort(),
    [assets]
  )

  const modelOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.productModel).filter(Boolean) as string[])).sort(),
    [assets]
  )

  const productModelOptions = useMemo(() => {
    return Array.from(
      new Set(
        productCatalog
          .map((product) => product.productModel)
          .filter((model): model is string => Boolean(model && model.trim()))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [productCatalog])

  const inwardTypeOptions = ['Rent In', 'Purchase']

  const normalizeFilterText = (value: unknown) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')

  useEffect(() => {
    if (isInStockPage) {
      setPaginationModel((current) => current.page === 0 ? current : { ...current, page: 0 })
    }
  }, [isInStockPage, modelFilter, inwardTypeFilter])

  // Calculate product model options from returned assets only
  const returnedModelOptions = useMemo(() => {
    const returnedAssets = assets.filter((asset) => normalizeStatus(asset.status) === 'returned')
    return Array.from(
      new Set(returnedAssets.map((asset) => asset.productModel).filter(Boolean) as string[])
    ).sort()
  }, [assets])

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

  const normalizeInwardType = (value?: string | null) => {
    const normalized = String(value || '').trim()
    if (!normalized) return ''
    if (/^new purchase$/i.test(normalized) || /^purchase$/i.test(normalized)) {
      return 'Purchase'
    }
    if (/^in stock$/i.test(normalized)) {
      return 'In Stock'
    }
    if (/^rent in$/i.test(normalized) || /^rent out$/i.test(normalized)) {
      return 'Rent In'
    }
    return normalized
  }

  const rows = useMemo(() => {
    return filteredAssets
      .map((asset, index) => {
        const formattedDate = asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '-'
        const customerName = (asset as any).customerName || '-'
        const displayPrice = Number(asset.price || 0) > 0 ? formatCurrency(asset.price) : '-'

        return {
          id: asset.id,
          index: index + 1,
          invoiceDate: formattedDate,
          invoiceNumber: asset.invoiceNumber || '-',
          serialNumber: asset.serialNumber || '-',
          vendorName: asset.vendorName || '-',
          customerName,
          productName: asset.productName || asset.name || '-',
          productDescription: asset.productDescription || asset.description || '-',
          productModel: asset.productModel || '-',
          price: displayPrice,
          depreciatedPrice: asset.depreciatedPrice || 0,
          inwardType: normalizeInwardType(asset.inwardType),
          status: statusLabels[asset.status] || asset.status || '-',
          document: asset.document || null,
          asset,
        }
      })
      .filter((row) => {
        const normalizedCustomerFilter = customerFilter?.trim().toLowerCase() || ''
        const normalizedVendorFilter = vendorFilter?.trim().toLowerCase() || ''
        const normalizedProductFilter = productFilter?.trim().toLowerCase() || ''
        const normalizedModelFilter = normalizeFilterText(modelFilter)
        const normalizedInwardTypeFilter = normalizeFilterText(inwardTypeFilter)

        const matchesInvoiceDate = !invoiceDateFilter || row.invoiceDate === invoiceDateFilter
        const matchesCustomer = !normalizedCustomerFilter || String(row.customerName || '').toLowerCase().includes(normalizedCustomerFilter)
        const matchesVendor = !normalizedVendorFilter || String(row.vendorName || '').toLowerCase().includes(normalizedVendorFilter)
        const matchesProduct = !normalizedProductFilter || String(row.productName || '').toLowerCase().includes(normalizedProductFilter)
        const modelValues = [row.productModel, row.asset.productModel]
          .map(normalizeFilterText)
          .filter(Boolean)
        const matchesModel = !normalizedModelFilter || modelValues.some((value) => value.includes(normalizedModelFilter))
        const rowInwardType = normalizeInwardType(row.asset.inwardType)
        const matchesInwardType =
          inwardTypeFilter === 'all' ||
          !normalizedInwardTypeFilter ||
          normalizeFilterText(rowInwardType).includes(normalizedInwardTypeFilter)
        const matchesSearch = !search || [
          row.invoiceNumber,
          row.serialNumber,
          row.vendorName,
          row.customerName,
          row.productName,
          row.productDescription,
          row.productModel,
          row.status,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())

        if (isInStockPage) {
          return matchesModel && matchesInwardType
        }

        return matchesInvoiceDate && matchesCustomer && matchesVendor && matchesProduct && matchesModel && matchesSearch
      })
  }, [assets, customerFilter, invoiceDateFilter, inwardTypeFilter, isInStockPage, modelFilter, productFilter, search, vendorFilter])

  const returnedDashboardRows = useMemo(() => {
    console.log('\n=== RETURNED DASHBOARD ===');
    console.log('Total assets:', assets.length);
    
    const filtered = filteredAssets.filter((asset) => {
      const normalized = normalizeStatus(asset.status);
      return normalized === 'returned';
    });
    
    console.log('Returned assets found:', filtered.length);
    if (filtered.length > 0) {
      console.log('First returned asset:', {
        id: filtered[0].id,
        name: filtered[0].name,
        status: filtered[0].status,
        normalized: normalizeStatus(filtered[0].status),
        vendorName: filtered[0].vendorName,
      });
    } else if (assets.length > 0) {
      console.log('Sample assets (all not returned):', assets.slice(0, 2).map(a => ({
        id: a.id,
        status: a.status,
        normalized: normalizeStatus(a.status),
      })));
    }
    console.log('=== END RETURNED DASHBOARD ===\n');
    
    return filtered
      .map((asset) => {
        const purchaseDate = asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '-'
        const returnedDate = asset.rentEndDate && String(asset.rentEndDate).trim() ? String(asset.rentEndDate).slice(0, 10) : '-'
        const monthCount = getRentalMonthsCount(asset.rentStartDate || asset.purchaseDate || '', asset.rentEndDate || '')

        return {
          id: asset.id,
          purchaseDate,
          supplierName: asset.vendorName || '-',
          productName: asset.productName || asset.name || '-',
          productDescription: asset.productDescription || asset.description || '-',
          serialNumber: asset.serialNumber || asset.productSerialNumber || '-',
          productModel: asset.productModel || '-',
          price: Number(asset.price || 0) > 0 ? formatCurrency(asset.price) : '-',
          returnedDate,
          rentCycle: monthCount > 0 ? `${monthCount} Months` : '-',
          months: monthCount,
          asset,
        }
      })
      .filter((row) => {
        const normalizedSupplierFilter = returnedSupplierFilter.trim().toLowerCase()
        const normalizedModelFilter = returnedModelFilter?.trim().toLowerCase() || ''
        const matchesSupplier = !normalizedSupplierFilter || row.supplierName.toLowerCase().includes(normalizedSupplierFilter)
        const matchesModel = !normalizedModelFilter || row.productModel.toLowerCase().includes(normalizedModelFilter)
        const matchesSearch = !search || [
          row.purchaseDate,
          row.supplierName,
          row.productName,
          row.productDescription,
          row.serialNumber,
          row.productModel,
          String(row.price),
          row.returnedDate,
          String(row.months),
        ]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())

        return matchesSupplier && matchesModel && matchesSearch
      })
  }, [filteredAssets, returnedSupplierFilter, returnedModelFilter, search])

  const totalDisplayedAssets = rows.length

  const returnedDashboardColumns: GridColDef[] = [
    { field: 'supplierName', headerName: 'Supplier Name', flex: 1.25, minWidth: 170, sortable: true },
    { field: 'serialNumber', headerName: 'Serial Number', flex: 1.15, minWidth: 165, sortable: true },
    { field: 'productName', headerName: 'Product Name', flex: 1.35, minWidth: 175, sortable: true },
    { field: 'productDescription', headerName: 'Description', flex: 1.7, minWidth: 220, sortable: true },
    { field: 'productModel', headerName: 'Product Model', flex: 1.15, minWidth: 155, sortable: true },
    { field: 'price', headerName: 'Rate / Price', flex: 1, minWidth: 125, sortable: true },
    { field: 'rentCycle', headerName: 'Rent Cycle', flex: 0.95, minWidth: 125, sortable: true },
    { field: 'returnedDate', headerName: 'Return Date', flex: 1, minWidth: 135, sortable: true },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1.25,
      minWidth: 220,
      sortable: false,
      renderCell: (params: any) => {
        const asset = params.row.asset as Asset
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, width: '100%', whiteSpace: 'nowrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Visibility />}
              onClick={() => void handleOpenView(asset)}
              sx={{ textTransform: 'none', borderRadius: 1.5, minWidth: 84, px: 1 }}
            >
              View
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={() => handleOpenDelete(asset)}
              sx={{ textTransform: 'none', borderRadius: 1.5, minWidth: 94, px: 1 }}
            >
              Delete
            </Button>
          </Box>
        )
      },
    },
  ]

  const columns: GridColDef[] = [
    ...(!isInStockPage
      ? [
          { field: 'index', headerName: '#', width: 70, sortable: false, renderCell: (params) => params.row.index },
        ]
      : []),
    { field: 'invoiceDate', headerName: 'Invoice Date', flex: 1.1, minWidth: 140, sortable: true },
    ...(isInStockPage
      ? []
      : [{ field: 'invoiceNumber', headerName: 'Invoice Number', flex: 1.5, minWidth: 220, sortable: true }]),
    {
      field: 'serialNumber',
      headerName: 'Serial Number',
      flex: 1.1,
      minWidth: 180,
      sortable: true,
      renderCell: (params) => {
        const serialNumber = String(params.value || '').trim()
        if (!serialNumber || serialNumber === '-') {
          return <span>-</span>
        }

        if (!enableSerialHistory) return <span>{serialNumber}</span>

        return (
          <Button
            variant="text"
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              navigate(`/inventory/serial-history/${encodeURIComponent(serialNumber)}`)
            }}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', color: '#0B63E5', fontWeight: 600, p: 0, minWidth: 0 }}
          >
            {serialNumber}
          </Button>
        )
      },
    },
    ...(isInStockPage
      ? []
      : [{ field: 'vendorName', headerName: 'Vendor Name', flex: 1.5, minWidth: 220, sortable: true }]),
    ...(isInStockPage
      ? []
      : [{ field: 'customerName', headerName: 'Customer Name', flex: 1.3, minWidth: 200, sortable: true }]),
    { field: 'productName', headerName: 'Product Name', flex: 1.6, minWidth: 240, sortable: true },
    { field: 'productDescription', headerName: 'Product Description', flex: 2.3, minWidth: 300, sortable: true },
    { field: 'productModel', headerName: 'Product Model', flex: 1.8, minWidth: 220, sortable: true },
    { field: 'price', headerName: 'Price', flex: 1.1, minWidth: 110, sortable: true },
    {
      field: 'depreciatedPrice',
      headerName: 'Actual Value',
      flex: 1.2,
      minWidth: 140,
      sortable: true,
      renderCell: (params: any) => {
        const depreciatedPrice = Number(params.value || 0)
        const asset = params.row.asset as Asset
        const normalizedStatus = String(asset.status || '').toLowerCase()
        
        // If sold, show ₹0
        if (normalizedStatus === 'sold') {
          return <span>₹0</span>
        }
        
        // If no purchase date, show the original price
        if (!asset.purchaseDate) {
          return <span>₹{asset.price?.toFixed(2) || '0.00'}</span>
        }
        
        return <span>₹{depreciatedPrice.toFixed(2)}</span>
      },
    },
    ...(isInStockPage
      ? [
          {
            field: 'inwardType',
            headerName: 'Inward Type',
            flex: 1,
            minWidth: 140,
            sortable: true,
            renderCell: (params: any) => <span>{String(params.value || '-')}</span>,
          } as GridColDef,
        ]
      : []),
    ...(isInStockPage
      ? []
      : [
          {
            field: 'status',
            headerName: 'Status',
            flex: 1,
            minWidth: 120,
            sortable: true,
            renderCell: (params: any) => {
              const displayedValue = String(params.value || params.row.asset.status || '-')
              const chipColor = getStatusChipColor(params.row.asset.status ?? String(params.value))

              return (
                <Chip
                  label={displayedValue}
                  color={chipColor}
                  size="small"
                  sx={{ borderRadius: 999, fontWeight: 600 }}
                />
              )
            },
          } as GridColDef,
          {
            field: 'document',
            headerName: 'Documents',
            flex: 1.1,
            minWidth: 180,
            sortable: false,
            renderCell: (params: any) => {
              const asset = params.row.asset as Asset
              const documentUrl = asset.document?.fileUrl

              if (documentUrl) {
                return (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => window.open(`${API_URL}${documentUrl}`, '_blank')}
                      sx={{ textTransform: 'none', borderRadius: 1 }}
                    >
                      View PDF
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleDeleteDocument(asset)}
                      sx={{ textTransform: 'none', borderRadius: 1, bgcolor: '#0B1F33', '&:hover': { bgcolor: '#142c45' } }}
                    >
                      Delete PDF
                    </Button>
                  </Stack>
                )
              }

              return (
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => handleDocumentAction(asset, 'upload')}
                  sx={{ textTransform: 'none', borderRadius: 1, bgcolor: '#0B1F33', '&:hover': { bgcolor: '#142c45' } }}
                >
                  Upload PDF
                </Button>
              )
            },
          } as GridColDef,
        ]),
    ...(isInStockPage
      ? [
          {
            field: 'actions',
            headerName: 'Actions',
            flex: 1.2,
            minWidth: 160,
            sortable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params: any) => {
              const asset = params.row.asset as Asset
              return (
                <ActionMenu
                  asset={asset}
                  onOutward={(a) => {
                    handleNavigateOutward(a)
                  }}
                  onReturn={(a) => {
                    setReturnAsset(a)
                    setIsReturnOpen(true)
                  }}
                  onEdit={(a) => {
                    setSelectedAsset(a)
                    void handleOpenEdit(a)
                  }}
                  onDelete={(a) => {
                    setSelectedAsset(a)
                    handleOpenDelete(a)
                  }}
                />
              )
            },
          } as GridColDef,
        ]
      : []),
    ...(isAllAssetsPage
      ? [
          {
            field: 'actions',
            headerName: 'Actions',
            flex: 1.2,
            minWidth: 190,
            sortable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params: any) => {
              const asset = params.row.asset as Asset
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, width: '100%', whiteSpace: 'nowrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Visibility />}
                    onClick={() => void handleOpenView(asset)}
                    sx={{ textTransform: 'none', borderRadius: 1.5, minWidth: 82, px: 1 }}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => handleOpenDelete(asset)}
                    sx={{ textTransform: 'none', borderRadius: 1.5, minWidth: 92, px: 1 }}
                  >
                    Delete
                  </Button>
                </Box>
              )
            },
          } as GridColDef,
        ]
      : []),
  ]

  const handleOpenAdd = (mode: 'single' | 'bulk' = 'single') => {
    setSelectedAsset(null)
    setAddMode(mode)
    setIsAddOpen(true)
  }

  const handleOpenView = async (asset: Asset) => {
    const fullAsset = await getAssetById(asset.id)
    setSelectedAsset(fullAsset)
    setIsViewOpen(true)
  }

  const handleOpenEdit = async (asset: Asset) => {
    if (!asset?.id) {
      setSnackbar({ open: true, message: 'Unable to edit asset: missing database ID.', severity: 'error' })
      return
    }

    try {
      const fullAsset = await getAssetById(asset.id)
      setSelectedAsset(fullAsset)
      setIsEditOpen(true)
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Unable to load asset for editing.', severity: 'error' })
    }
  }

  const handleOpenDelete = (asset: Asset) => {
    if (!asset?.id) {
      setSnackbar({ open: true, message: 'Unable to delete asset: missing database ID.', severity: 'error' })
      return
    }
    setSelectedAsset(asset)
    setIsDeleteOpen(true)
  }

  const handleNavigateOutward = (asset: Asset) => {
    console.log('Selected Asset:', asset)
    navigate('/inventory/outwarding', { state: { asset } })
  }

  const handleOpenReturn = (asset: Asset) => {
    setReturnAsset(asset)
    setReturnSupplier(asset.vendorName || '')
    setReturnDate(new Date().toISOString().split('T')[0])
    setReturnError(null)
    setIsReturnOpen(true)
  }

  const handleDeleteAsset = async () => {
    if (!selectedAsset?.id) {
      setSnackbar({ open: true, message: 'Unable to delete asset: missing database ID.', severity: 'error' })
      return
    }
    try {
      await deleteAsset(selectedAsset.id)
      setSnackbar({ open: true, message: 'Asset deleted successfully.', severity: 'success' })
      setIsDeleteOpen(false)
      setSelectedAsset(null)
      setSelectedAssetIds([])
      setRowSelectionModel({ type: 'include', ids: new Set() })
      refreshAssets()
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Unable to delete asset.', severity: 'error' })
    }
  }

  const handleDeleteSelectedAssets = async () => {
    if (!selectedAssetIds.length) return

    try {
      setBulkDeleteLoading(true)
      const result = await deleteBulkAssets(selectedAssetIds)
      setSelectedAssetIds([])
      setRowSelectionModel({ type: 'include', ids: new Set() })
      setIsBulkDeleteOpen(false)
      refreshAssets()
      setSnackbar({ open: true, message: `${result.count} assets deleted successfully.`, severity: 'success' })
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Unable to delete selected assets.', severity: 'error' })
    } finally {
      setBulkDeleteLoading(false)
    }
  }

  const handleDeleteAction = (asset: Asset) => {
    setSelectedAsset(asset)
    setIsDeleteOpen(true)
  }

  const handleSubmitReturn = async () => {
    if (!returnAsset) return
    setReturnError(null)

    console.log('\n=== SUBMIT RETURN ===');
    console.log('Asset before return:', {
      id: returnAsset.id,
      name: returnAsset.name,
      status: returnAsset.status,
      inwardType: returnAsset.inwardType,
      serialNumber: returnAsset.serialNumber,
    });

    const inwardType = normalizeInwardType(returnAsset.inwardType)
    if (inwardType === 'Purchase') {
      setReturnError('Return is only allowed for Rent In assets.')
      return
    }

    if (!returnSupplier.trim()) {
      setReturnError('Supplier is required.')
      return
    }

    if (!returnDate) {
      setReturnError('Return Date is required.')
      return
    }

    const normalizedStatus = String(returnAsset.status || '').trim().toLowerCase()
    if (normalizedStatus !== 'available' && normalizedStatus !== 'in_stock') {
      setReturnError('The asset must be available in In Stock before it can be returned to the supplier.')
      return
    }

    try {
      setReturnLoading(true)
      console.log('Calling createReturn with:', {
        assetId: returnAsset.id,
        supplierName: returnSupplier,
        returnDate,
      });
      const result = await createReturn({
        assetId: returnAsset.id,
        supplierName: returnSupplier,
        returnDate,
        quantity: 1,
        remarks: `Returned to supplier ${returnSupplier}`,
        performedBy: 'System',
        rentEndDate: returnDate,
      })
      console.log('Return API response:', result);
      setSnackbar({ open: true, message: 'Asset returned to supplier successfully.', severity: 'success' })
      setIsReturnOpen(false)
      console.log('Calling refreshAssets()');
      refreshAssets()
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Unable to record return.')
    } finally {
      setReturnLoading(false)
      console.log('=== END SUBMIT RETURN ===\n');
    }
  }

  const handleQuickActionClose = () => {
    setQuickActionAnchor(null)
    setQuickActionAsset(null)
  }

  const handleStatusAction = async (action: 'rent' | 'sold' | 'return', asset: Asset) => {
    const nextStatusMap = {
      rent: 'rented',
      sold: 'sold',
      return: 'available',
    } as const

    const nextStatus = nextStatusMap[action]
    if (asset.status === nextStatus) {
      setSnackbar({ open: true, message: 'Asset already in the requested state.', severity: 'success' })
      return
    }

    try {
      if (action === 'rent') {
        handleNavigateOutward(asset)
        return
      }

      if (action === 'return') {
        await createReturn({
          assetId: asset.id,
          customerName: asset.customerName || 'Unknown Customer',
          quantity: 1,
          remarks: 'Returned from rental',
          performedBy: 'System',
          returnDate: new Date().toISOString().split('T')[0],
          rentEndDate: new Date().toISOString().split('T')[0],
        })
      } else {
        await updateAsset(asset.id, {
          status: nextStatus,
          quantity: asset.quantity,
          availableQuantity: asset.availableQuantity ?? asset.quantity,
        })
      }

      let message = 'Asset updated successfully.'
      if (action === 'sold') {
        message = 'Asset marked as sold out.'
      } else if (action === 'return') {
        message = 'Asset returned successfully.'
      }

      setSnackbar({
        open: true,
        message,
        severity: 'success',
      })

      refreshAssets()
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Unable to update asset status.',
        severity: 'error',
      })
    }
  }

  const handleDocumentAction = (asset: Asset, action: 'upload' | 'replace') => {
    setDocumentAssetId(asset.id)
    setDocumentAction(action)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleDocumentInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !documentAssetId || !documentAction) return

    setDocumentUploading(true)

    try {
      await uploadAssetDocument(documentAssetId, file, documentAction === 'replace')
      setSnackbar({ open: true, message: 'Document saved successfully.', severity: 'success' })
      refreshAssets()
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Unable to upload document.', severity: 'error' })
    } finally {
      setDocumentUploading(false)
      setDocumentAssetId(null)
      setDocumentAction(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteDocument = async (asset: Asset) => {
    setDocumentUploading(true)

    try {
      await deleteAssetDocument(asset.id)
      setSnackbar({ open: true, message: 'Document deleted successfully.', severity: 'success' })
      refreshAssets()
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Unable to delete document.', severity: 'error' })
    } finally {
      setDocumentUploading(false)
    }
  }

  const handleDownloadReport = async () => {
    if (isReturnedPage) {
      await downloadExcelReport({
        fileName: 'returned-assets-report.xlsx',
        sheetName: 'Returned Assets',
        headers: ['Purchased Date', 'Supplier Name', 'Product Name', 'Product Description', 'Product Serial Number', 'Product Model', 'Price', 'Returned Date', 'Months'],
        rows: returnedDashboardRows.map((row) => [row.purchaseDate, row.supplierName, row.productName, row.productDescription, row.serialNumber, row.productModel, row.price, row.returnedDate, row.months]),
        textColumns: [4],
        wideColumns: [2, 3],
      })
      return
    }

    if (isInStockPage) {
      await downloadExcelReport({
        fileName: 'in-stock-report.xlsx',
        sheetName: 'In Stock',
        headers: ['Invoice Date', 'Serial Number', 'Product Name', 'Product Description', 'Product Model', 'Price', 'Depreciated Price', 'Inward Type'],
        rows: rows.map((row) => [row.invoiceDate, row.serialNumber, row.productName, row.productDescription, row.productModel, row.price, row.depreciatedPrice, row.inwardType]),
        textColumns: [1],
        wideColumns: [2, 3],
      })
      return
    }

    await downloadExcelReport({
      fileName: 'all-assets-report.xlsx',
      sheetName: 'All Assets',
      headers: ['Invoice Date', 'Invoice Number', 'Serial Number', 'Vendor Name', 'Customer Name', 'Product Name', 'Product Description', 'Product Model', 'Price', 'Depreciated Price', 'Status'],
      rows: rows.map((row) => [row.invoiceDate, row.invoiceNumber, row.serialNumber, row.vendorName, row.customerName, row.productName, row.productDescription, row.productModel, row.price, row.depreciatedPrice, row.status]),
      textColumns: [1, 2],
      wideColumns: [5, 6],
    })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, backgroundColor: '#F4F6F8', minHeight: '100%' }}>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, px: { xs: 0, md: 0.5 }, position: 'relative', zIndex: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.8rem', sm: '2.125rem' }, lineHeight: 1.2, color: '#06283D', whiteSpace: 'normal' }}>
            {isInStockPage ? 'IN STOCK' : isReturnedPage ? 'RETURNED ASSETS DASHBOARD' : 'All Assets'}
          </Typography>
        </Box>
        {showAddButton && (
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenAdd('single')}
              sx={{ bgcolor: '#0B1F33', '&:hover': { bgcolor: '#142c45' }, textTransform: 'none' }}
            >
              Add Asset
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/inventory/outward')}
              sx={{ borderColor: '#0B1F33', color: '#0B1F33', '&:hover': { borderColor: '#142c45', backgroundColor: '#F3F7FA' }, textTransform: 'none' }}
            >
              Outward
            </Button>
          </Stack>
        )}
        <Button variant="contained" startIcon={<Download />} onClick={() => void handleDownloadReport()} sx={{ bgcolor: '#0B1F33', '&:hover': { bgcolor: '#142c45' }, textTransform: 'none', minWidth: 170 }}>
          Download Report
        </Button>
      </Box>
      <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleDocumentInputChange} style={{ display: 'none' }} />

      <Paper elevation={0} sx={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', border: '1px solid #DDE4EA', borderRadius: 4, backgroundColor: '#FFFFFF', boxShadow: '0 12px 30px rgba(6, 40, 61, 0.06)', p: { xs: 1.5, sm: 2, md: 2.5 } }}>
        {isReturnedPage ? (
          <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <SearchableDropdown
                label="Supplier Name"
                options={vendorOptions}
                value={returnedSupplierFilter || null}
                onChange={setReturnedSupplierFilter}
                noOptionsText="No suppliers found"
                fullWidth={false}
                sx={{ minWidth: 220 }}
              />

              <SearchableDropdown
                label="Product Model"
                options={returnedModelOptions}
                value={returnedModelFilter || null}
                onChange={setReturnedModelFilter}
                noOptionsText="No models found"
                fullWidth={false}
                sx={{ minWidth: 220 }}
              />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: { xs: '100%', md: 260 } }}>
                <Typography variant="body2" sx={{ color: '#06283D', fontWeight: 600 }}>Search:</Typography>
                <TextField
                  size="small"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Box>
            </Box>
          </Box>
        ) : isInStockPage ? (
          <Stack spacing={2}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2, width: '100%' }}>
              <SearchableDropdown
                label="Product Model"
                options={productModelOptions}
                value={modelFilter || null}
                onChange={setModelFilter}
                noOptionsText="No models found"
              />

              <SearchableDropdown
                label="Inward Type"
                options={inwardTypeOptions}
                value={inwardTypeFilter === 'all' ? null : inwardTypeFilter}
                onChange={(value) => setInwardTypeFilter(value || 'all')}
                noOptionsText="No types found"
              />
            </Box>
            <Button
              variant="text"
              disabled={!rows.length}
              onClick={() => {
                const allSelected = rows.length > 0 && rows.every((row) => selectedAssetIds.includes(String(row.id)))
                const nextIds = allSelected ? [] : rows.map((row) => String(row.id))
                setSelectedAssetIds(nextIds)
                setRowSelectionModel({ type: 'include', ids: new Set(nextIds) })
              }}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            >
              {rows.length > 0 && rows.every((row) => selectedAssetIds.includes(String(row.id))) ? 'Clear Selection' : 'Select All'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={!selectedAssetIds.length}
              onClick={() => setIsBulkDeleteOpen(true)}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            >
              Delete Selected{selectedAssetIds.length ? ` (${selectedAssetIds.length})` : ''}
            </Button>
          </Stack>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' }, gap: 2, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              <TextField
                size="small"
                type="date"
                label="Invoice Date"
                value={invoiceDateFilter}
                onChange={(event) => setInvoiceDateFilter(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ ...dateFieldSx, width: '100%', maxWidth: '100%' }}
              />

              <SearchableDropdown
                label="Customer Name"
                options={customerOptions}
                value={customerFilter || null}
                onChange={setCustomerFilter}
                noOptionsText="No customers found"
              />

              <SearchableDropdown
                label="Status"
                options={statusFilterOptions.map((o) => o.label)}
                value={statusFilter === 'all' ? null : statusFilterOptions.find((option) => option.value === statusFilter)?.label || null}
                onChange={(value) => {
                  const nextValue = value ? mapDisplayToInternal(value) : 'all'
                  setStatusFilter(nextValue)
                  setStatusQuery(nextValue)
                }}
                noOptionsText="No status found"
              />

              <SearchableDropdown
                label="Supplier Name"
                options={vendorOptions}
                value={vendorFilter || null}
                onChange={setVendorFilter}
                noOptionsText="No suppliers found"
              />

              <SearchableDropdown
                label="Product Name"
                options={productOptions}
                value={productFilter || null}
                onChange={setProductFilter}
                noOptionsText="No products found"
              />

              <SearchableDropdown
                label="Product Model"
                options={modelOptions}
                value={modelFilter || null}
                onChange={setModelFilter}
                noOptionsText="No models found"
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 3, flexWrap: 'wrap', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              <FormControl size="small" sx={{ minWidth: 130, maxWidth: '100%' }}>
                <InputLabel id="entries-label">Show Entries</InputLabel>
                <Select
                  labelId="entries-label"
                  value={pageSize}
                  label="Show Entries"
                  onChange={(event) => {
                    const nextSize = Number(event.target.value)
                    setPageSize(nextSize)
                    setPaginationModel({ page: 0, pageSize: nextSize })
                  }}
                  sx={{ borderRadius: 2, minWidth: 130 }}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <MenuItem key={size} value={size}>{size}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                size="small"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search here..."
                sx={{ minWidth: { xs: '100%', md: 260 }, maxWidth: '100%', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Box>
          </>
        )}

        {isReturnedPage && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 2, mt: 1, mb: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Show</Typography>
              <Select
                size="small"
                value={pageSize}
                onChange={(event) => {
                  const nextSize = Number(event.target.value)
                  setPageSize(nextSize)
                  setPaginationModel({ page: 0, pageSize: nextSize })
                }}
                sx={{ minWidth: 80, borderRadius: 2 }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
              <Typography variant="body2" color="text.secondary">entries</Typography>
            </Box>

          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Box sx={{ mt: 2, width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderRadius: 3, overflow: 'hidden', border: '1px solid #E9EEF5', backgroundColor: '#FFFFFF' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : isReturnedPage ? (
            returnedDashboardRows.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h6" color="#06283D">
                  No returned assets found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  There are no returned assets matching the current filters.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'auto', boxSizing: 'border-box' }}>
                <Box sx={{ height: 640, minWidth: 1660, width: '100%' }}>
                  <DataGrid
                    rows={returnedDashboardRows}
                    columns={returnedDashboardColumns}
                    columnHeaderHeight={52}
                    pagination
                    paginationMode="client"
                    pageSizeOptions={[10, 25, 50, 100]}
                    paginationModel={paginationModel}
                    onPaginationModelChange={(model) => {
                      setPaginationModel(model)
                      setPageSize(model.pageSize)
                    }}
                    checkboxSelection={false}
                    disableRowSelectionOnClick
                    sortingMode="client"
                    rowHeight={64}
                    getRowHeight={() => 'auto'}
                    slots={{
                      footer: () => (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', px: 2, py: 1, borderTop: '1px solid #E8EDF2', backgroundColor: '#FFFFFF' }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#06283D' }}>
                            Total Assets: {returnedDashboardRows.length}
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
                        borderBottom: '1px solid #E8EDF2',
                        color: '#06283D',
                        fontSize: '13px',
                        py: 1,
                        lineHeight: 1.4,
                        whiteSpace: 'normal !important',
                        wordBreak: 'break-word',
                        alignItems: 'center',
                        display: 'flex',
                      },
                      '& .MuiDataGrid-row': {
                        backgroundColor: '#FFFFFF',
                        minHeight: 64,
                      },
                      '& .MuiDataGrid-row:nth-of-type(even)': {
                        backgroundColor: '#FAFBFD',
                      },
                      '& .MuiDataGrid-footerContainer': {
                        borderTop: '1px solid #E8EDF2',
                        backgroundColor: '#FFFFFF',
                      },
                      '& .MuiDataGrid-columnSeparator': {
                        display: 'none',
                      },
                    }}
                  />
                </Box>
              </Box>
            )
          ) : rows.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography variant="h6" color="#06283D">
                No assets found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Add an asset to start tracking it in the inventory system.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
              <Box sx={{ height: 640, minWidth: 1200, width: '100%' }}>
                <DataGrid
                  rows={rows}
                  columns={columns}
                  columnHeaderHeight={48}
                  pagination
                  checkboxSelection={isInStockPage}
                  rowSelectionModel={rowSelectionModel}
                  onRowSelectionModelChange={(selection) => {
                    setRowSelectionModel(selection)
                    const selectedIds = selection.type === 'include'
                      ? Array.from(selection.ids).map(String)
                      : rows.filter((row) => !selection.ids.has(row.id)).map((row) => String(row.id))
                    setSelectedAssetIds(selectedIds)
                  }}
                  keepNonExistentRowsSelected={false}
                  paginationMode="client"
                  pageSizeOptions={[10, 25, 50, 100]}
                  paginationModel={paginationModel}
                  onPaginationModelChange={(model) => {
                    setPaginationModel(model)
                    setPageSize(model.pageSize)
                  }}
                  disableRowSelectionOnClick
                  sortingMode="client"
                  rowHeight={70}
                  getRowHeight={() => 'auto'}
                  slots={{
                    footer: () => (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          borderTop: '1px solid #E9EEF5',
                          minHeight: 52,
                          px: 2,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#06283D',
                          }}
                        >
                          Total Assets: {totalDisplayedAssets}
                        </Typography>

                        <GridFooterContainer sx={{ borderTop: 0 }}>
                          <GridPagination />
                        </GridFooterContainer>
                      </Box>
                    ),
                    noRowsOverlay: () => (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Typography>No assets found</Typography>
                      </Box>
                    ),
                  }}
                  sx={{
  border: 0,
  backgroundColor: '#FFFFFF',

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

  '& .MuiDataGrid-cell': {
    borderBottom: '1px solid #EEF2F5',
    color: '#06283D',
    fontSize: '15px',
    py: 2,
    lineHeight: 1.5,
    whiteSpace: 'normal !important',
    wordBreak: 'break-word',
    alignItems: 'center',
    display: 'flex',
  },

  '& .MuiDataGrid-cellContent': {
    whiteSpace: 'normal !important',
    overflow: 'visible !important',
    textOverflow: 'clip',
  },

  '& .MuiDataGrid-row': {
    backgroundColor: '#FFFFFF',
    minHeight: 70,
  },
                    '& .MuiDataGrid-row:nth-of-type(even)': {
                      backgroundColor: '#F9FBFD',
                    },
                    '& .MuiDataGrid-row:hover': {
                      backgroundColor: '#F0F6FF',
                    },
                    '& .MuiDataGrid-footerContainer': {
                      borderTop: '1px solid #EEF2F5',
                      backgroundColor: '#FFFFFF',
                    },
                    '& .MuiDataGrid-columnSeparator': {
                      display: 'none',
                    },
                    '& .MuiDataGrid-cell--textLeft': {
                      alignItems: 'flex-start',
                    },
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      <AssetDialog
        open={isAddOpen}
        title="Add Asset"
        asset={null}
        mode={addMode}
        productCatalog={productCatalog}
        productModelOptions={productModelOptions}
        onClose={() => setIsAddOpen(false)}
        onSaved={(message) => {
          setIsAddOpen(false)
          refreshAssets()
          setSnackbar({ open: true, message: message || 'Asset added successfully.', severity: 'success' })
        }}
      />
      <AssetDialog
        open={isEditOpen}
        title="Edit Asset"
        asset={selectedAsset} 
        productCatalog={productCatalog}
        productModelOptions={productModelOptions}
        onClose={() => setIsEditOpen(false)}
        onSaved={() => {
          setIsEditOpen(false)
          refreshAssets()
          setSnackbar({ open: true, message: 'Asset updated successfully.', severity: 'success' })
        }}
      />
      <ViewAssetDialog
        open={isViewOpen}
        asset={selectedAsset}
        onClose={() => setIsViewOpen(false)}
        onEdit={() => {
          setIsViewOpen(false)
          void handleOpenEdit(selectedAsset as Asset)
        }}
      />
      <Menu
        anchorEl={quickActionAnchor}
        open={Boolean(quickActionAnchor && quickActionAsset)}
        onClose={handleQuickActionClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 170,
              borderRadius: 2,
              border: '1px solid #E8EDF2',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
              overflow: 'hidden',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (quickActionAsset) {
              void handleStatusAction('rent', quickActionAsset)
            }
            handleQuickActionClose()
          }}
        >
          Rent Out
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (quickActionAsset) {
              void handleStatusAction('sold', quickActionAsset)
            }
            handleQuickActionClose()
          }}
        >
          Sold Out
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (quickActionAsset) {
              void handleStatusAction('return', quickActionAsset)
            }
            handleQuickActionClose()
          }}
        >
          Return
        </MenuItem>
      </Menu>

      <ReturnDialog
        open={isReturnOpen}
        asset={returnAsset}
        supplier={returnSupplier}
        returnDate={returnDate}
        supplierOptions={vendorOptions}
        error={returnError}
        loading={returnLoading}
        onSupplierChange={setReturnSupplier}
        onReturnDateChange={setReturnDate}
        onClose={() => setIsReturnOpen(false)}
        onSubmit={handleSubmitReturn}
      />
      <DeleteConfirmDialog open={isDeleteOpen} asset={selectedAsset} onClose={() => setIsDeleteOpen(false)} onConfirm={handleDeleteAsset} />
      <BulkDeleteConfirmDialog
        open={isBulkDeleteOpen}
        count={selectedAssetIds.length}
        loading={bulkDeleteLoading}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleDeleteSelectedAssets}
      />
    </Box>
  )
}

function AssetDialog({ open, title, asset, mode = 'single', productCatalog, productModelOptions, onClose, onSaved }: { open: boolean; title: string; asset: Asset | null; mode?: 'single' | 'bulk'; productCatalog: ProductCatalogItem[]; productModelOptions: string[]; onClose: () => void; onSaved: (message?: string) => void }) {
  const initialAddForm = {
    invoiceDate: new Date().toISOString().split('T')[0],
    vendorName: '',
    productDescription: '',
    price: '',
    productModel: '',
    hsnSac: '',
    gst: '',
    productId: '',
    inwardType: 'Purchase',
    invoiceNumber: '',
    productName: '',
    quantity: '1',
    warrantyDate: '',
    productSerialNumber: '',
    rentStartDate: '',
    rentEndDate: '',
    location: 'Main Warehouse',
    serialNumbers: '',
  }

  const [form, setForm] = useState(initialAddForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleProductSelection = (productName: string | null) => {
    const selectedProduct = productCatalog.find((product: ProductCatalogItem) => product.productName === productName)
    setForm((prev) => ({
      ...prev,
      productId: selectedProduct ? String(selectedProduct.productId || selectedProduct.id || '') : '',
      productName: productName || '',
      productDescription: selectedProduct ? selectedProduct.description || prev.productDescription : prev.productDescription,
      productModel: selectedProduct ? selectedProduct.productModel || prev.productModel : prev.productModel,
      hsnSac: selectedProduct ? selectedProduct.hsnSac || prev.hsnSac : prev.hsnSac,
      gst: selectedProduct ? selectedProduct.gst || prev.gst : prev.gst,
      vendorName: selectedProduct ? selectedProduct.vendorName || prev.vendorName : prev.vendorName,
      price: selectedProduct && (!prev.price || prev.price === '') ? String(selectedProduct.defaultPrice || selectedProduct.price || '') : prev.price,
    }))
  }

  const handleProductModelSelection = (productModel: string | null) => {
    const selectedProduct = productCatalog.find((product: ProductCatalogItem) => product.productModel === productModel)
    setForm((prev) => ({
      ...prev,
      productId: selectedProduct ? String(selectedProduct.productId || selectedProduct.id || '') : prev.productId,
      productModel: productModel || '',
      productName: selectedProduct ? selectedProduct.productName || prev.productName : prev.productName,
      productDescription: selectedProduct ? selectedProduct.description || prev.productDescription : prev.productDescription,
      hsnSac: selectedProduct ? selectedProduct.hsnSac || prev.hsnSac : prev.hsnSac,
      gst: selectedProduct ? selectedProduct.gst || prev.gst : prev.gst,
      vendorName: selectedProduct ? selectedProduct.vendorName || prev.vendorName : prev.vendorName,
      price: selectedProduct && (!prev.price || prev.price === '') ? String(selectedProduct.defaultPrice || selectedProduct.price || '') : prev.price,
    }))
  }

  useEffect(() => {
    if (asset) {
      setForm({
        invoiceDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
        vendorName: asset.vendorName || '',
        productDescription: asset.productDescription || asset.description || '',
        price: asset.price ? String(asset.price) : '',
        productModel: asset.productModel || '',
        hsnSac: asset.hsnSac || '',
        gst: asset.gst || '',
        productId: asset.productId || '',
        inwardType: asset.inwardType || 'In Stock',
        invoiceNumber: asset.invoiceNumber || '',
        productName: asset.name || asset.productName || '',
        quantity: asset.quantity ? String(asset.quantity) : '1',
        warrantyDate: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : '',
        productSerialNumber: asset.productSerialNumber || asset.serialNumber || '',
        rentStartDate: asset.rentStartDate || '',
        rentEndDate: asset.rentEndDate || '',
        location: asset.location || 'Main Warehouse',
        serialNumbers: asset.productSerialNumber || asset.serialNumber || '',
      })
    } else {
      setForm(initialAddForm)
    }
    setErrors({})
    setSubmitError(null)
  }, [asset, mode])

  const isAddMode = !asset
  const isBulkMode = isAddMode && mode === 'bulk'
  const parseSerialNumbers = (value?: string | null) => (value ?? '').split(',').map((serial) => serial.trim()).filter(Boolean)
  const serialNumbers = parseSerialNumbers(form.serialNumbers)
  const duplicateSerialNumbers = [...new Set(serialNumbers.filter((serial, index) => serialNumbers.findIndex((item) => item.toLowerCase() === serial.toLowerCase()) !== index))]

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (isAddMode) {
      if (!form.invoiceDate) nextErrors.invoiceDate = 'Invoice Date is required'
      if (!form.invoiceNumber.trim()) nextErrors.invoiceNumber = 'Invoice Number is required'
      if (!form.vendorName.trim()) nextErrors.vendorName = 'Vendor Name is required'
      if (!form.productName.trim()) nextErrors.productName = 'Product Name is required'
      if (!form.quantity || Number(form.quantity) <= 0) nextErrors.quantity = 'Quantity must be greater than 0'
      if (!form.inwardType.trim()) nextErrors.inwardType = 'Inward Type is required'
      if (form.price !== '' && Number.isNaN(Number(form.price))) nextErrors.price = 'Price must be numeric'
      if (form.warrantyDate && form.invoiceDate && new Date(form.warrantyDate) < new Date(form.invoiceDate)) {
        nextErrors.warrantyDate = 'Warranty Date cannot be before Invoice Date'
      }
      if (!serialNumbers.length) nextErrors.serialNumbers = 'Enter at least one serial number'
      if (duplicateSerialNumbers.length) nextErrors.serialNumbers = `Duplicate serial numbers: ${duplicateSerialNumbers.join(', ')}`
      if (Number(form.quantity) !== serialNumbers.length) nextErrors.quantity = `Quantity must match ${serialNumbers.length} serial number${serialNumbers.length === 1 ? '' : 's'}`
    } else {
      if (!form.productName.trim()) nextErrors.productName = 'Product Name is required'
      if (!form.invoiceNumber.trim()) nextErrors.invoiceNumber = 'Invoice Number is required'

      // If this edit is closing an existing rental (asset is currently rented and a rentEndDate is provided),
      // skip all quantity validation entirely so the user can close the rental without changing Quantity.
      const isClosingRental = asset && String(asset.status || '').toLowerCase() === 'rented' && form.rentEndDate && String(form.rentEndDate).trim() !== ''
      if (!isClosingRental) {
        if (!form.quantity || Number(form.quantity) <= 0) nextErrors.quantity = 'Quantity must be greater than 0'
      } else {
        // ensure we do not accidentally keep any previous quantity error when closing a rental
        delete nextErrors.quantity
      }

      if (form.price !== '' && Number.isNaN(Number(form.price))) nextErrors.price = 'Price must be numeric'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleReset = () => {
    setForm(initialAddForm)
    setErrors({})
    setSubmitError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      if (asset) {
        // Detect closing an existing rental: asset is currently rented and user provided a rentEndDate.
        const isClosingRental = asset && String(asset.status || '').toLowerCase() === 'rented' && form.rentEndDate && String(form.rentEndDate).trim() !== ''
        if (isClosingRental) {
          await updateAsset(asset.id, {
            status: 'available',
            invoiceNumber: form.invoiceNumber,
            // include rent dates so backend can update the existing RENT_OUT movement
            rentStartDate: form.rentStartDate,
            rentEndDate: form.rentEndDate,
            description: form.productDescription,
            productDescription: form.productDescription,
            productName: form.productName,
            productSerialNumber: form.productSerialNumber,
            productModel: form.productModel,
            productId: form.productId || undefined,
            hsnSac: form.hsnSac,
            gst: form.gst,
            price: Number(form.price) || 0,
            // For serial-number assets ensure availableQuantity is at least 1
            availableQuantity: asset.quantity && Number(asset.quantity) > 0 ? Number(asset.quantity) : 1,
          })
        } else {
          await updateAsset(asset.id, {
            name: form.productName,
            productName: form.productName,
            productModel: form.productModel,
            productId: form.productId || undefined,
            hsnSac: form.hsnSac,
            gst: form.gst,
            serialNumber: form.productSerialNumber,
            productSerialNumber: form.productSerialNumber,
            manufacturer: asset.manufacturer || '',
            location: form.location,
            price: Number(form.price) || 0,
            purchaseDate: form.invoiceDate || undefined,
            description: form.productDescription,
            warrantyExpiry: form.warrantyDate || undefined,
            inwardDate: form.invoiceDate || undefined,
            invoiceNumber: form.invoiceNumber,
            vendorName: form.vendorName,
            inwardType: form.inwardType,
            quantity: Number(form.quantity) || 1,
          })
        }
      } else if (isAddMode) {
        const result = await createBulkAssets({
          invoiceDate: form.invoiceDate,
          invoiceNumber: form.invoiceNumber,
          vendorName: form.vendorName,
          productName: form.productName,
          productDescription: form.productDescription,
          warrantyDate: form.warrantyDate || undefined,
          price: Number(form.price) || 0,
          productId: form.productId || undefined,
          productModel: form.productModel,
          hsnSac: form.hsnSac,
          gst: form.gst,
          inwardType: form.inwardType,
          quantity: Number(form.quantity),
          serialNumbers,
          inwardDate: form.invoiceDate,
          location: form.location,
          status: 'available',
        })
        onSaved(`${result.count} assets created successfully.`)
        return
      }
      onSaved()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save asset.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle sx={{ pb: 1.25, color: '#06283D', fontWeight: 700 }}>{title}</DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 2.25, md: 3 }, pt: 2 }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}
          {isAddMode ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Stack spacing={2.25} sx={{ flex: 1 }}>
                <TextField
                  label="Invoice Date"
                  name="invoiceDate"
                  type="date"
                  value={form.invoiceDate}
                  onChange={handleChange}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Vendor Name"
                  name="vendorName"
                  value={form.vendorName}
                  onChange={handleChange}
                  required
                  error={Boolean(errors.vendorName)}
                  helperText={errors.vendorName}
                  fullWidth
                />
                <TextField
                  label="Product Description"
                  name="productDescription"
                  value={form.productDescription}
                  onChange={handleChange}
                  multiline
                  rows={4}
                  fullWidth
                />
                <TextField
                  label="Price"
                  name="price"
                  type="number"
                  value={form.price}
                  onChange={handleChange}
                  fullWidth
                />
                <TextField
                  label="Product Model"
                  name="productModel"
                  value={form.productModel}
                  onChange={handleChange}
                  fullWidth
                />
                <FormControl fullWidth error={Boolean(errors.inwardType)}>
                  <InputLabel>Inward Type</InputLabel>
                  <Select name="inwardType" value={form.inwardType} label="Inward Type" onChange={handleChange}>
                    <MenuItem value="Rent In">Rent In</MenuItem>
                    <MenuItem value="Purchase">Purchase</MenuItem>
                  </Select>
                  {errors.inwardType && <Typography variant="caption" color="error">{errors.inwardType}</Typography>}
                </FormControl>
              </Stack>

              <Stack spacing={2.25} sx={{ flex: 1 }}>
                <TextField label="Invoice Number" name="invoiceNumber" value={form.invoiceNumber} onChange={handleChange} fullWidth />
                <Autocomplete
                  options={productCatalog.map((product: ProductCatalogItem) => product.productName)}
                  value={form.productName || null}
                  onChange={(_, nextValue) => handleProductSelection(nextValue)}
                  noOptionsText="No Products Available"
                  isOptionEqualToValue={(option, value) => option === value}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Product Name"
                      required
                      error={Boolean(errors.productName)}
                      helperText={errors.productName}
                    />
                  )}
                  sx={{ width: '100%' }}
                />
                <TextField
                  label="Quantity"
                  name="quantity"
                  type="number"
                  value={form.quantity}
                  onChange={handleChange}
                  error={Boolean(errors.quantity)}
                  helperText={errors.quantity}
                  fullWidth
                />
                <TextField
                  label="Warranty Date"
                  name="warrantyDate"
                  type="date"
                  value={form.warrantyDate}
                  onChange={handleChange}
                  error={Boolean(errors.warrantyDate)}
                  helperText={errors.warrantyDate}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField label="Product Serial Number" name="serialNumbers" value={form.serialNumbers} onChange={handleChange} placeholder="Enter serial numbers separated by commas" error={Boolean(errors.serialNumbers)} helperText={errors.serialNumbers} fullWidth />
                <TextField name="location" value={form.location} type="hidden" sx={{ display: 'none' }} />
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2.25}>
              <TextField label="Asset Name" name="productName" value={form.productName} onChange={handleChange} error={Boolean(errors.productName)} helperText={errors.productName} required fullWidth />
              <TextField label="Category" name="location" value={form.location} onChange={handleChange} fullWidth />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField label="Product Model" name="productModel" value={form.productModel} onChange={handleChange} fullWidth />
                <TextField label="Serial Number" name="productSerialNumber" value={form.productSerialNumber} onChange={handleChange} fullWidth />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Invoice Date"
                  name="invoiceDate"
                  type="date"
                  value={form.invoiceDate}
                  onChange={handleChange}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField label="Invoice Number" name="invoiceNumber" value={form.invoiceNumber} onChange={handleChange} fullWidth />
              </Stack>
              <TextField
                label="Price"
                name="price"
                type="number"
                value={form.price}
                onChange={handleChange}
                fullWidth
              />
              <FormControl fullWidth error={Boolean(errors.inwardType)}>
                <InputLabel>Inward Type</InputLabel>
                <Select name="inwardType" value={form.inwardType} label="Inward Type" onChange={handleChange}>
                  <MenuItem value="In Stock">In Stock</MenuItem>
                  <MenuItem value="Rent Out">Rent Out</MenuItem>
                  <MenuItem value="Sold Out">Sold Out</MenuItem>
                </Select>
                {errors.inwardType && <Typography variant="caption" color="error">{errors.inwardType}</Typography>}
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2.25, md: 3 }, py: 2 }}>
          <Button type="button" onClick={onClose} sx={{ borderColor: '#D7DEE8', color: '#06283D' }} variant="outlined">
            Cancel
          </Button>
          {isAddMode && (
            <Button type="button" onClick={handleReset} sx={{ borderColor: '#D7DEE8', color: '#06283D' }} variant="outlined">
              Reset
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Submitting...' : isBulkMode ? 'Create Assets' : isAddMode ? 'Submit' : 'Save Asset'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

function ReturnDialog({
  open,
  asset,
  supplier,
  returnDate,
  supplierOptions,
  error,
  loading,
  onSupplierChange,
  onReturnDateChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  asset: Asset | null
  supplier: string
  returnDate: string
  supplierOptions: string[]
  error: string | null
  loading: boolean
  onSupplierChange: (value: string) => void
  onReturnDateChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  if (!asset) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Return Asset</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Autocomplete
            options={supplierOptions}
            freeSolo
            value={supplier}
            inputValue={supplier}
            onInputChange={(_, newValue) => onSupplierChange(newValue)}
            fullWidth
            sx={{ width: '100%' }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Supplier"
                required
                placeholder="Select Supplier"
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    minHeight: 56,
                  },
                }}
              />
            )}
          />

          <TextField
            label="Return Date"
            type="date"
            value={returnDate}
            onChange={(event) => onReturnDateChange(event.target.value)}
            placeholder="dd-mm-yyyy"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              ...dateFieldSx,
              '& .MuiOutlinedInput-root': {
                ...dateFieldSx['& .MuiOutlinedInput-root'],
                borderRadius: 2,
                minHeight: 56,
              },
              '& .MuiInputBase-input': {
                ...dateFieldSx['& .MuiInputBase-input'],
                paddingRight: '40px',
              },
            }}
          />
          {error && (
            <Alert severity="error">{error}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2.25, md: 3 }, py: 2 }}>
        <Button type="button" onClick={onClose} sx={{ borderColor: '#D7DEE8', color: '#06283D' }} variant="outlined">
          Cancel
        </Button>
        <Button type="button" onClick={onSubmit} variant="contained" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function ViewAssetDialog({ open, asset, onClose, onEdit }: { open: boolean; asset: Asset | null; onClose: () => void; onEdit: () => void }) {
  const [movements, setMovements] = useState<AssetMovementSummary[]>([])

  useEffect(() => {
    if (!asset) return

    let active = true
    getAssetMovements(asset.name)
      .then((data) => {
        if (active) setMovements(data)
      })
      .catch(() => {
        if (active) setMovements([])
      })

    return () => {
      active = false
    }
  }, [asset])

  if (!asset) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Asset Details</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2"><strong>Asset ID:</strong> {asset.assetId || '-'}</Typography>
          <Typography variant="body2"><strong>Name:</strong> {asset.name}</Typography>
          <Typography variant="body2"><strong>Category:</strong> {asset.category || '-'}</Typography>
          <Typography variant="body2"><strong>Brand:</strong> {asset.manufacturer || '-'}</Typography>
          <Typography variant="body2"><strong>Model:</strong> {asset.productModel || '-'}</Typography>
          <Typography variant="body2"><strong>Serial Number:</strong> {asset.serialNumber || '-'}</Typography>
          <Typography variant="body2"><strong>Status:</strong> {statusLabels[asset.status] || asset.status}</Typography>
          <Typography variant="body2"><strong>Location:</strong> {asset.location || '-'}</Typography>
          <Typography variant="body2"><strong>Vendor:</strong> {asset.vendorName || '-'}</Typography>
          <Typography variant="body2"><strong>Purchase Price:</strong> {asset.price ? formatCurrency(asset.price) : '-'}</Typography>
          <Typography variant="body2"><strong>Notes:</strong> {asset.description || '-'}</Typography>
          <Typography variant="body2"><strong>Created:</strong> {asset.createdAt ? new Date(asset.createdAt).toLocaleString() : '-'}</Typography>
          <Typography variant="body2"><strong>Updated:</strong> {asset.updatedAt ? new Date(asset.updatedAt).toLocaleString() : '-'}</Typography>
        </Stack>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Recent movements
          </Typography>
          {movements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No movement history found.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {movements.map((movement) => (
                <Box key={movement.id} sx={{ border: '1px solid #E7E3DD', borderRadius: 2, p: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {movement.type}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {movement.date} • {movement.quantity} unit(s) • by {movement.by}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<Edit />} onClick={onEdit}>
          Edit
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DeleteConfirmDialog({ open, asset, onClose, onConfirm }: { open: boolean; asset: Asset | null; onClose: () => void; onConfirm: () => void }) {
  if (!asset) return null

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete Asset</DialogTitle>
      <DialogContent>
        <Stack sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center' }}>
          <WarningAmber color="warning" />
          <Typography>Are you sure you want to delete this asset?</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirm}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function BulkDeleteConfirmDialog({ open, count, loading, onClose, onConfirm }: { open: boolean; count: number; loading: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose}>
      <DialogTitle>Delete Selected Assets</DialogTitle>
      <DialogContent>
        <Stack sx={{ display: 'flex', flexDirection: 'row', gap: 1.5, alignItems: 'center' }}>
          <WarningAmber color="warning" />
          <Typography>Are you sure you want to delete {count} selected asset{count === 1 ? '' : 's'}?</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
