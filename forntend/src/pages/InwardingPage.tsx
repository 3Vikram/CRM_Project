'use client'

import { useEffect, useMemo, useState } from 'react'
import { Box, Button, CircularProgress, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material'
import { DataGrid, GridColDef, GridToolbarContainer } from '@mui/x-data-grid'
import { Search, Refresh } from '@mui/icons-material'

interface InwardMovement {
  id: string
  date: string
  assetId: string
  assetName: string
  vendor: string
  quantity: number
  invoiceNumber: string
  location: string
  createdBy: string
}

const columns: GridColDef[] = [
  { field: 'date', headerName: 'Date', flex: 1, minWidth: 130 },
  { field: 'assetId', headerName: 'Asset ID', flex: 1, minWidth: 140 },
  { field: 'assetName', headerName: 'Asset Name', flex: 1.5, minWidth: 180 },
  { field: 'vendor', headerName: 'Vendor', flex: 1.2, minWidth: 150 },
  { field: 'quantity', headerName: 'Quantity', type: 'number', flex: 0.8, minWidth: 110 },
  { field: 'invoiceNumber', headerName: 'Invoice Number', flex: 1.2, minWidth: 150 },
  { field: 'location', headerName: 'Location', flex: 1.2, minWidth: 150 },
  { field: 'createdBy', headerName: 'Created By', flex: 1, minWidth: 140 },
]

function CustomToolbar({ onRefresh }: { onRefresh: () => void }) {
  return (
    <GridToolbarContainer sx={{ justifyContent: 'flex-end', gap: 1, px: 1, py: 1 }}>
      <Button startIcon={<Refresh />} onClick={onRefresh} variant="contained" sx={{ borderRadius: 2, bgcolor: '#0B1F33', '&:hover': { bgcolor: '#142c45' } }}>
        Refresh
      </Button>
    </GridToolbarContainer>
  )
}

export default function InwardingPage() {
  const [movements, setMovements] = useState<InwardMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        setLoading(true)
        setError(null)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
        const response = await fetch(`${API_URL}/api/inventory/movements?type=INWARD&limit=200`)
        if (!response.ok) throw new Error('Failed to load inward movements')
        const data = await response.json()
        setMovements(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to fetch inward movements')
        setMovements([])
      } finally {
        setLoading(false)
      }
    }

    fetchMovements()
  }, [refreshKey])

  const filteredRows = useMemo(() => {
    return movements.filter((movement) => {
      const matchesSearch = [movement.assetId, movement.assetName, movement.vendor, movement.invoiceNumber, movement.location, movement.createdBy]
        .some((value) => value.toLowerCase().includes(searchText.toLowerCase()))
      const matchesDate = !dateFilter || movement.date === dateFilter
      return matchesSearch && matchesDate
    })
  }, [movements, searchText, dateFilter])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, backgroundColor: '#F4F6F8', minHeight: '100%' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700} color="#06283D">
            Inwarding
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View all inward movements created when new assets are added.
          </Typography>
        </Box>
      </Stack>

      <Paper elevation={0} sx={{ border: '1px solid #EBEAE6', borderRadius: 3, p: 3, backgroundColor: '#FFFFFF', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <TextField
            label="Search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#60707F' }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            onClick={() => setRefreshKey((value) => value + 1)}
            startIcon={<Refresh />}
            sx={{ borderRadius: 2, bgcolor: '#0B1F33', '&:hover': { bgcolor: '#142c45' }, minWidth: 140 }}
          >
            Refresh
          </Button>
        </Stack>

        {error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <Box sx={{ height: 660, width: '100%' }}>
            <DataGrid
              rows={filteredRows}
              columns={columns}
              loading={loading}
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
              disableRowSelectionOnClick
              slots={{ toolbar: CustomToolbar }}
              slotProps={{ toolbar: { onRefresh: () => setRefreshKey((value) => value + 1) } }}
              sx={{
                borderRadius: 3,
                borderColor: '#E7E3DD',
                '& .MuiDataGrid-toolbarContainer': { px: 0 },
                '& .MuiDataGrid-cell': { borderBottomColor: '#EBEAE6' },
                '& .MuiDataGrid-columnHeaders': { backgroundColor: '#F4F6F8', borderBottomColor: '#EBEAE6' },
              }}
            />
          </Box>
        )}
      </Paper>
    </Box>
  )
}
