'use client'

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Typography,
} from '@mui/material'
import { ArrowBack, CalendarToday } from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils'

interface AccessoryDetails {
  id: string
  accessoryType: string
  brand: string
  model: string
  serialNumber: string
  purchasePrice: number
  status: string
}

interface AccessoryMovement {
  id: string
  action: string
  date?: string
  startDate?: string | null
  price?: number
  relatedAssetSerialNumber?: string
  person?: string
  remarks?: string
  quantity?: number
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const display = (value?: string | number | null) => (
  value === null || value === undefined || String(value).trim() === '' ? '-' : String(value)
)

const statusForAction = (action: string) => {
  if (action === 'Purchased') return 'In Stock'
  if (action === 'Issued') return 'Issued'
  if (action === 'Returned') return 'Returned'
  if (action === 'Sold') return 'Sold'
  return 'In Stock'
}

export default function AccessoryLifecyclePage() {
  const { accessoryId = '' } = useParams()
  const navigate = useNavigate()
  const [accessory, setAccessory] = useState<AccessoryDetails | null>(null)
  const [history, setHistory] = useState<AccessoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadLifecycle = async () => {
      setLoading(true)
      setError(null)

      try {
        const [accessoryResponse, historyResponse] = await Promise.all([
          fetch(`${API_URL}/api/accessories/${accessoryId}`),
          fetch(`${API_URL}/api/accessories/${accessoryId}/history`),
        ])

        if (!accessoryResponse.ok || !historyResponse.ok) {
          throw new Error('Failed to load accessory lifecycle')
        }

        const accessoryData: AccessoryDetails = await accessoryResponse.json()
        const historyData: AccessoryMovement[] = await historyResponse.json()
        setAccessory(accessoryData)
        setHistory(historyData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load accessory lifecycle')
      } finally {
        setLoading(false)
      }
    }

    if (accessoryId) void loadLifecycle()
  }, [accessoryId])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#F4F6F8', minHeight: '100vh', px: { xs: 1, md: 2 }, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
          sx={{ bgcolor: '#06283D', color: '#fff', '&:hover': { bgcolor: '#0a3d52' }, textTransform: 'none', fontWeight: 700 }}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A' }}>
            Accessory Lifecycle - {display(accessory?.serialNumber)}
          </Typography>
          {accessory && (
            <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
              {display(accessory.brand)} {display(accessory.model)} | {accessory.accessoryType} | Current status: {accessory.status}
            </Typography>
          )}
        </Box>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && history.length === 0 && (
        <Alert severity="info">No lifecycle history found for this accessory.</Alert>
      )}

      {!loading && !error && history.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5 }}>
          {history.slice().reverse().map((entry, index) => {
            const status = statusForAction(entry.action)
            const isReturned = entry.action === 'Returned'
            const isSold = entry.action === 'Sold'

            return (
              <Paper key={entry.id} elevation={1} sx={{ border: '1px solid #CBD5E1', borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
                <Box sx={{ px: 2, py: 1.5, bgcolor: '#06283D', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 14 }}>CYCLE #{index + 1}</Typography>
                  <Chip label={status} size="small" sx={{ bgcolor: status === 'In Stock' ? '#C5E1A5' : isSold ? '#E8D5F5' : '#FFB74D', color: '#000', fontWeight: 800, fontSize: 10 }} />
                </Box>

                <Box sx={{ p: 2.2, display: 'grid', gap: 1.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CalendarToday sx={{ fontSize: 16, color: '#06283D' }} />
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#334155' }}>{formatDate(entry.date)}</Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Action</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{display(entry.action)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Customer / Person</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{display(entry.person)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Serial Number</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{display(entry.relatedAssetSerialNumber || accessory?.serialNumber)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>{isReturned ? 'Return Date' : isSold ? 'Sold Date' : 'Issue Date'}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{formatDate(entry.date)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Start Date</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{formatDate(entry.startDate)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Price</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      {entry.price ? formatCurrency(entry.price) : entry.action === 'Purchased' ? formatCurrency(accessory?.purchasePrice || 0) : '-'}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Remarks</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{display(entry.remarks)}</Typography>
                  </Box>
                </Box>
              </Paper>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
