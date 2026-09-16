'use client'

import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  MenuItem,
  Paper,
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
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import { downloadExcelReport } from '../lib/downloadExcelReport'
import { useAssets, type Asset } from '../hooks/useAssets'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const normalizeStatus = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return 'unknown'
  if (['available', 'in_stock', 'instock', 'outwarding', 'outward'].includes(raw)) return 'available'
  if (['rented', 'rent-out', 'rentout', 'rent_out', 'rent out'].includes(raw)) return 'rented'
  if (['sold', 'sold_out', 'soldout'].includes(raw)) return 'sold'
  if (['returned', 'return'].includes(raw)) return 'returned'
  if (['damaged', 'lost'].includes(raw)) return 'damaged'
  return raw
}

const parseDate = (value: string | null | undefined) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDate = (value: string | null | undefined) => {
  const date = parseDate(value)
  if (!date) return '-'
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const getFinancialYearLabel = (yearStart: number) => `${yearStart}-${String(yearStart + 1).slice(-2)}`

const getFinancialYearStart = (date: Date) => {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

const getFinancialYearFromDate = (date: Date) => {
  return getFinancialYearLabel(getFinancialYearStart(date))
}

const getFinancialYearStartFromLabel = (financialYear: string) => {
  const [startYear] = financialYear.split('-').map((value) => Number(value))
  return Number.isFinite(startYear) ? startYear : null
}

const getYearlyDepreciationValues = (asset: Asset, currentYear: number) => {
  const price = Number(asset.price ?? 0)
  const purchaseDate = parseDate(asset.purchaseDate ?? asset.invoiceDate ?? asset.inwardDate)

  if (!purchaseDate || !Number.isFinite(price) || price <= 0) {
    return { years: [], valuesByYear: {} as Record<string, number> }
  }

  const firstFinancialYearStart = getFinancialYearStart(purchaseDate)
  const years: string[] = []
  const valuesByYear: Record<string, number> = {}

  let previousValue = price

  for (let fyStartYear = firstFinancialYearStart; fyStartYear <= currentYear; fyStartYear += 1) {
    const financialYear = getFinancialYearLabel(fyStartYear)
    years.push(financialYear)

    if (fyStartYear === firstFinancialYearStart) {
      previousValue = price * 0.4
    } else {
      previousValue = previousValue * 0.6
    }

    valuesByYear[financialYear] = roundAmount(previousValue)
  }

  return { years, valuesByYear }
}

export default function DepreciationHistoryPage() {
  const currentYear = new Date().getFullYear()
  const { assets, loading } = useAssets('', '', '', '', 0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')

  const allAssetRows = useMemo(() => {
    return assets
      .map((asset) => ({
        asset,
        ...getYearlyDepreciationValues(asset, currentYear),
      }))
      .filter((row) => row.years.length > 0)
  }, [assets, currentYear])

  const allYears = useMemo(() => {
    const set = new Set<string>()
    allAssetRows.forEach((row) => {
      row.years.forEach((year) => set.add(year))
    })
    return [...set].sort((a, b) => {
      const left = getFinancialYearStartFromLabel(a) ?? 0
      const right = getFinancialYearStartFromLabel(b) ?? 0
      return left - right
    })
  }, [allAssetRows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    return allAssetRows.filter((row) => {
      const asset = row.asset
      const haystack = `${asset.serialNumber ?? ''} ${asset.productModel ?? ''} ${asset.productName ?? ''}`.toLowerCase()
      const matchesSearch = !query || haystack.includes(query)
      const matchesStatus = statusFilter === 'all' || normalizeStatus(asset.status) === statusFilter
      const matchesYear = yearFilter === 'all' || Object.prototype.hasOwnProperty.call(row.valuesByYear, String(yearFilter))
      return matchesSearch && matchesStatus && matchesYear
    })
  }, [allAssetRows, search, statusFilter, yearFilter])

  const displayYears = useMemo(() => {
    if (yearFilter === 'all') return allYears
    return allYears.filter((year) => year === String(yearFilter))
  }, [allYears, yearFilter])

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'available', label: 'In Stock' },
    { value: 'rented', label: 'Rent Out' },
  ]

  const handleDownloadReport = async () => {
    try {
      const exportHeaders = [
        'Invoice Date',
        'Product Model',
        'Serial Number',
        'Original Price',
        ...displayYears.map((year) => `${year}`),
      ]

      const rows = filteredRows.map(({ asset, valuesByYear }) => {
        const invoiceDate = parseDate(asset.purchaseDate ?? asset.invoiceDate ?? asset.inwardDate)
        const row: Array<string | number | Date | null> = [
          invoiceDate ? new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate()) : null,
          asset.productModel || asset.productName || '',
          asset.serialNumber ?? '',
          Number(asset.price ?? 0),
          ...displayYears.map((year) => {
            const value = valuesByYear[year]
            return value === undefined ? null : Number(value)
          }),
        ]

        return row
      })

      await downloadExcelReport({
        fileName: 'depreciation-history-report',
        sheetName: 'Depreciation History',
        headers: exportHeaders,
        rows,
        dateColumns: [0],
        currencyColumns: [3, ...displayYears.map((_, index) => 4 + index)],
        centerColumns: [0, 2],
        rightColumns: [3, ...displayYears.map((_, index) => 4 + index)],
        leftColumns: [1],
        wrapColumns: [1],
        columnWidths: [
          18,
          35,
          18,
          20,
          ...displayYears.map(() => 16),
        ],
        wideColumns: [1],
      })
    } catch (error) {
      console.error('Failed to generate depreciation history report:', error)
      alert('Failed to generate the Excel report.')
    }
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 1600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#0B1F33', mb: 1 }}>
          Depreciation History
        </Typography>
        <Typography variant="body1" sx={{ color: '#5F6B76' }}>
          Track the yearly depreciation value of all inventory assets.
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          border: '1px solid #E5E7EB',
          borderRadius: 4,
          p: 2.5,
          bgcolor: '#FFFFFF',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ flex: 1, alignItems: { md: 'center' } }}>
            <TextField
              label="Search Serial Number / Product Model"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              sx={{
                minWidth: { xs: '100%', md: 320 },
                '& .MuiInputBase-root': { borderRadius: 2, backgroundColor: '#FAFBFC' },
              }}
            />

            <TextField
              select
              label="Year"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              sx={{ minWidth: 170, '& .MuiInputBase-root': { borderRadius: 2, backgroundColor: '#FAFBFC' } }}
            >
              <MenuItem value="all">All Years</MenuItem>
              {allYears.map((year) => (
                <MenuItem key={year} value={String(year)}>
                  {year}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              sx={{ minWidth: 170, '& .MuiInputBase-root': { borderRadius: 2, backgroundColor: '#FAFBFC' } }}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Button
            variant="contained"
            startIcon={<DownloadOutlinedIcon />}
            onClick={handleDownloadReport}
            sx={{
              borderRadius: 2,
              px: 2.5,
              py: 1.1,
              fontWeight: 700,
              boxShadow: 'none',
              backgroundColor: '#06283D',
              '&:hover': { backgroundColor: '#041F33' },
            }}
          >
            Download Report
          </Button>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          border: '1px solid #E5E7EB',
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
        }}
      >
        <TableContainer sx={{ overflowX: 'auto', maxWidth: '100%' }}>
          <Table sx={{ minWidth: 1100, borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#EEF4F9', borderBottom: '2px solid #D5DFEB' }}>
                <TableCell sx={{ fontWeight: 800, color: '#0B1F33', whiteSpace: 'nowrap', py: 1.5, px: 1.5, borderBottom: '2px solid #D5DFEB', fontSize: '0.92rem', textAlign: 'center' }}>Invoice Date</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#0B1F33', whiteSpace: 'nowrap', py: 1.5, px: 1.5, borderBottom: '2px solid #D5DFEB', fontSize: '0.92rem' }}>Product Model</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#0B1F33', whiteSpace: 'nowrap', py: 1.5, px: 1.5, borderBottom: '2px solid #D5DFEB', fontSize: '0.92rem', textAlign: 'center' }}>Serial Number</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#0B1F33', whiteSpace: 'nowrap', py: 1.5, px: 1.5, borderBottom: '2px solid #D5DFEB', fontSize: '0.92rem', textAlign: 'right' }}>Original Price</TableCell>
                {displayYears.map((year) => (
                  <TableCell key={year} sx={{ fontWeight: 800, color: '#0B1F33', whiteSpace: 'nowrap', py: 1.5, px: 1.5, borderBottom: '2px solid #D5DFEB', fontSize: '0.92rem', textAlign: 'center' }}>
                    {year}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4 + displayYears.length} sx={{ py: 4, textAlign: 'center', color: '#5F6B76' }}>
                    Loading depreciation history...
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4 + displayYears.length} sx={{ py: 4, textAlign: 'center', color: '#5F6B76' }}>
                    No assets match the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => {
                  const { asset, valuesByYear } = row

                  return (
                    <TableRow key={asset.id || asset.serialNumber || asset.productModel} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500, px: 1.5, py: 1.25, textAlign: 'center' }}>
                        {formatDate(asset.purchaseDate ?? asset.invoiceDate ?? asset.inwardDate)}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', px: 1.5, py: 1.25 }}>{asset.productModel || asset.productName || '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500, px: 1.5, py: 1.25, textAlign: 'center' }}>{asset.serialNumber || '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, px: 1.5, py: 1.25, textAlign: 'right' }}>
                        {currencyFormatter.format(Number(asset.price ?? 0))}
                      </TableCell>

                      {displayYears.map((year) => {
                        const value = valuesByYear[year]
                        return (
                          <TableCell key={`${asset.id || asset.serialNumber}-${year}`} sx={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 500, px: 1.5, py: 1.25 }}>
                            {value === undefined ? '-' : currencyFormatter.format(value)}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
