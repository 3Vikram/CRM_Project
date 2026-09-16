'use client'

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Alert, Box, CircularProgress, Divider, IconButton, Paper, Typography, Chip } from '@mui/material'
import { ArrowBack, CalendarToday } from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils'
import { getAssetSerialHistory } from '@/hooks/useAssets'

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const display = (value?: string | number | null) => (value === null || value === undefined || String(value).trim() === '' ? '-' : String(value))

const calculateMonths = (start?: string | null, end?: string | null) => {
  if (!start) return 0
  const from = new Date(start)
  const to = end ? new Date(end) : new Date()
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0)
  return Math.max(0, months)
}

export default function RentalLifecyclePage() {
  const { serialNumber = '' } = useParams()
  const navigate = useNavigate()
  const [assetInfo, setAssetInfo] = useState<any>(null)
  const [rentalHistory, setRentalHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await getAssetSerialHistory(decodeURIComponent(serialNumber))
        setAssetInfo(response.asset || null)
        // Reverse the order: newest/current first
        const reversed = (response.rentalHistory || []).slice().reverse()
        setRentalHistory(reversed)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch rental cycles')
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [serialNumber])

  // Calculate bottom summary from original (unreversed) order
  const originalRentalHistory = rentalHistory.slice().reverse()

  const handleBack = () => {
    navigate(-1)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#F4F6F8', minHeight: '100vh', px: { xs: 1, md: 2 }, py: 3 }}>
      {/* Header with Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={handleBack} sx={{ bgcolor: '#06283D', color: '#fff', '&:hover': { bgcolor: '#0a3d52' } }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A' }}>
          Rental Lifecycle — {display(serialNumber)}
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && (rentalHistory.length > 0 || finalSale) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Horizontal Cards Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
            {lifecycleEntries.map((cycle, index) => {
              if (cycle.isSoldOut) {
                return (
                  <Paper key={cycle.id || 'final-sale'} elevation={1} sx={{ border: '1px solid #DDD', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
                    <Box sx={{ px: 2, py: 1.5, bgcolor: '#F5F5F5', borderBottom: '1px solid #E0E0E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>CYCLE #{cycle.cycleNumber ?? index + 1}</Typography>
                      <Chip
                        label="SOLD OUT"
                        size="small"
                        sx={{ fontWeight: 700, fontSize: 11, bgcolor: '#E8D5F5', color: '#000', height: 24 }}
                      />
                    </Box>
                    <Box sx={{ p: 2.2, display: 'grid', gap: 1.25 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <CalendarToday sx={{ fontSize: 16, color: '#06283D' }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#334155' }}>
                          {formatDate(cycle.date)}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Sold To
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(cycle.customerName)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Invoice Number
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(cycle.invoiceNumber)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Selling Price
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {formatCurrency(cycle.saleAmount ?? 0)}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Remarks
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(cycle.remarks)}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                )
              }

              const durationMonths = calculateMonths(cycle.rentStartDate, cycle.rentEndDate)

              return (
                <Paper key={cycle.id} elevation={1} sx={{ border: '1px solid #DDD', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
                  {/* Card Header */}
                  <Box sx={{ px: 2, py: 1.5, bgcolor: '#F5F5F5', borderBottom: '1px solid #E0E0E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>CYCLE #{cycle.cycleNumber ?? index + 1}</Typography>
                    <Chip
                      label={cycle.status || 'RENTED'}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: 11,
                        bgcolor: cycle.status === 'RETURNED' ? '#C5E1A5' : '#FFB74D',
                        color: '#000',
                        height: 24,
                      }}
                    />
                  </Box>

                  {/* Card Body */}
                  <Box sx={{ p: 2.2, display: 'grid', gap: 1.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CalendarToday sx={{ fontSize: 16, color: '#06283D' }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#334155' }}>
                        {formatDate(cycle.date)}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Customer Name
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                        {display(cycle.customerName)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Document Number
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                        {display(cycle.documentNumber)}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Rent Start Date
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                        {formatDate(cycle.rentStartDate)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Rent End Date
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                        {cycle.status === 'RETURNED' ? formatDate(cycle.rentEndDate) : <Typography component="span" sx={{ color: '#E74C3C', fontWeight: 700 }}>CURRENTLY RENTED</Typography>}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Monthly Rental Price
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                        {formatCurrency(cycle.monthlyRentalPrice ?? 0)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Total Duration
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                        {cycle.totalMonths ?? durationMonths} months
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Total Rental Revenue
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                        {formatCurrency(cycle.rentalRevenue ?? 0)}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Remarks
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                        {display(cycle.remarks)}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              )
            })}
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Bottom Summary */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mt: 2 }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#F8F9FA', border: '1px solid #DDD', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: 11, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', mb: 0.8 }}>
                Total Months
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                {totalMonths}
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, bgcolor: '#F8F9FA', border: '1px solid #DDD', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: 11, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', mb: 0.8 }}>
                Total Rental Amount
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                {formatCurrency(totalRentalAmount)}
              </Typography>
            </Paper>
          </Box>
        </Box>
      )}

      {!loading && rentalHistory.length === 0 && (
        <Alert severity="info">No rental history found for this serial number.</Alert>
      )}
    </Box>
  )
}
