'use client'

import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Typography, Chip, Paper, Divider } from '@mui/material'
import { Close, CalendarToday } from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils'
import { getAssetSerialHistory } from '@/hooks/useAssets'

interface RentalCyclesModalProps {
  open: boolean
  serialNumber: string
  onClose: () => void
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })
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

export function RentalCyclesModal({ open, serialNumber, onClose }: RentalCyclesModalProps) {
  const [assetInfo, setAssetInfo] = useState<any>(null)
  const [rentalHistory, setRentalHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !serialNumber) {
      setLoading(true)
      setError(null)
      setAssetInfo(null)
      setRentalHistory([])
      return
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await getAssetSerialHistory(decodeURIComponent(serialNumber))
        setAssetInfo(response.asset || null)
        setRentalHistory(response.rentalHistory || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch rental cycles')
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [open, serialNumber])

  // Calculate bottom summary
  const totalRentOutPrice = rentalHistory.reduce((sum, cycle) => sum + (cycle.monthlyRentalPrice ?? 0), 0)
  const totalMonths = rentalHistory.reduce((sum, cycle) => sum + calculateMonths(cycle.rentStartDate, cycle.rentEndDate), 0)
  const totalMonthwisePrice = totalRentOutPrice * totalMonths

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth sx={{ '& .MuiDialog-paper': { minHeight: '600px' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#06283D', color: '#fff', py: 2, fontWeight: 800, fontSize: 18 }}>
        Rental Lifecycle
        <IconButton onClick={onClose} size="small" sx={{ color: '#fff' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 3 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!loading && rentalHistory.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Horizontal Cards Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
              {rentalHistory.map((cycle, index) => {
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
                    <Box sx={{ px: 2, py: 1.8, display: 'flex', flexDirection: 'column', gap: 1.2, flex: 1, fontSize: '0.85rem' }}>
                      {/* Date Icon Row */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <CalendarToday sx={{ fontSize: 16, color: '#64748B' }} />
                        <Typography sx={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                          {formatDate(cycle.rentStartDate)}
                        </Typography>
                      </Box>

                      <Divider sx={{ my: 0.3 }} />

                      {/* Customer Name */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Customer Name
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(cycle.customerName)}
                        </Typography>
                      </Box>

                      {/* Document Number */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Document Number
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(cycle.documentNumber)}
                        </Typography>
                      </Box>

                      {/* Product Serial Number */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Product Serial<br />Number
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(serialNumber)}
                        </Typography>
                      </Box>

                      {/* Product Name */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Product Name
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(assetInfo?.productName)}
                        </Typography>
                      </Box>

                      {/* Product Description */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Product<br />Description
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(assetInfo?.productDescription)}
                        </Typography>
                      </Box>

                      {/* Product Model */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Product Model
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(assetInfo?.productModel)}
                        </Typography>
                      </Box>

                      {/* Supplier */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Supplier
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {display(assetInfo?.vendorName)}
                        </Typography>
                      </Box>

                      {/* Rent Start Date */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Rent Start Date
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {formatDate(cycle.rentStartDate)}
                        </Typography>
                      </Box>

                      {/* Rent End Date */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Rent End Date
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {cycle.status === 'RETURNED' ? formatDate(cycle.rentEndDate) : '-'}
                        </Typography>
                      </Box>

                      {/* Rent Out Price */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Rent Out Price
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {formatCurrency(cycle.rentalRevenue ?? 0)}
                        </Typography>
                      </Box>

                      {/* Total Months */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Total Months
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {durationMonths}
                        </Typography>
                      </Box>

                      {/* Monthwise Total Price */}
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Monthwise Total<br />Price
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                          {durationMonths > 0 ? formatCurrency((cycle.rentalRevenue ?? 0) * durationMonths) : '-'}
                        </Typography>
                      </Box>

                      {/* Remarks */}
                      {cycle.remarks && (
                        <Box>
                          <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Remarks
                          </Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#0F172A', mt: 0.3 }}>
                            {display(cycle.remarks)}
                          </Typography>
                        </Box>
                      )}

                      {/* Status Footer */}
                      <Box sx={{ mt: 'auto', pt: 1.2, borderTop: '1px solid #E0E0E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: cycle.status === 'RETURNED' ? '#4CAF50' : '#FF9800' }}>
                          {cycle.status || 'RENTED'}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>
                          RENT_OUT
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                )
              })}
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Bottom Summary */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mt: 2 }}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#F8F9FA', border: '1px solid #DDD', borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', mb: 0.8 }}>
                  Total Rent Out Price
                </Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                  {formatCurrency(totalRentOutPrice)}
                </Typography>
              </Paper>

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
                  Total Monthwise Price
                </Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                  {totalMonths > 0 ? formatCurrency(totalMonthwisePrice) : '-'}
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}

        {!loading && rentalHistory.length === 0 && (
          <Alert severity="info">No rental history found for this serial number.</Alert>
        )}
      </DialogContent>
    </Dialog>
  )
}

