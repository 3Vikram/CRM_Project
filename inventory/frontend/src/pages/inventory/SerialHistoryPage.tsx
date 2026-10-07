'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Box, Chip, CircularProgress, Divider, Paper, Typography } from '@mui/material'
import { CalendarToday } from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils'
import { getAssetSerialHistory, type AssetSerialHistoryResponse } from '@/hooks/useAssets'
import { calculateProfit } from '@/lib/profitSummary'

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const display = (value?: string | number | null) => value === null || value === undefined || String(value).trim() === '' ? '-' : String(value)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.35, color: '#0F172A', fontWeight: 700 }}>
        {children}
      </Typography>
    </Box>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #E2E8F0', bgcolor: '#EFF6FB' }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color: '#06283D' }}>
        {title}
      </Typography>
    </Box>
  )
}

export default function SerialHistoryPage() {
  const { serialNumber = '' } = useParams()
  const [assetFound, setAssetFound] = useState(false)
  const [data, setData] = useState<AssetSerialHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getAssetSerialHistory(decodeURIComponent(serialNumber))
      .then((response) => {
        setAssetFound(Boolean(response.asset))
        setData(response)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to fetch serial history'))
      .finally(() => setLoading(false))
  }, [serialNumber])

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  if (error || !assetFound) return <Alert severity="error">{error || 'Serial number history was not found.'}</Alert>

  const rentalHistory = data?.rentalHistory || []
  const finalSale = data?.finalSale
  const profitSummary = data ? calculateProfit(data) : null
  const profitPercentage = profitSummary ? (profitSummary.price === 0 ? 0 : (profitSummary.profit / profitSummary.price) * 100) : 0
  const profitStatus = profitSummary ? (profitSummary.profit > 0 ? 'PROFIT' : profitSummary.profit < 0 ? 'LOSS' : 'BREAK-EVEN') : 'BREAK-EVEN'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#F4F6F8', minHeight: '100%', px: { xs: 1, md: 0 }, pb: 3 }}>
      {/* Rental History Section */}
      {(rentalHistory.length > 0 || finalSale) && (
        <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid #DDE4EA', bgcolor: '#fff', overflow: 'hidden' }}>
          <SectionHeader title="Rental History" />
          <Box sx={{ p: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5 }}>
            {rentalHistory.map((entry, index) => (
              <Paper key={entry.id} elevation={0} sx={{ borderRadius: 3, border: '1px solid #CBD5E1', overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.5, bgcolor: '#06283D', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '.06em' }}>
                    CYCLE #{entry.cycleNumber ?? index + 1}
                  </Typography>
                  <Chip
                    label={entry.status || 'RENTED'}
                    size="small"
                    sx={{ bgcolor: entry.status === 'RETURNED' ? '#C5E1A5' : '#FFB74D', color: '#000', fontWeight: 800, fontSize: 10 }}
                  />
                </Box>
                <Box sx={{ p: 2.2, display: 'grid', gap: 1.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CalendarToday sx={{ fontSize: 16, color: '#06283D' }} />
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#334155' }}>
                      {formatDate(entry.date)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Field label="Customer Name">{display(entry.customerName)}</Field>
                  <Field label="Document Number">{display(entry.documentNumber)}</Field>
                  <Divider />
                  <Field label="Rent Start Date">{formatDate(entry.rentStartDate)}</Field>
                  <Field label="Rent End Date">{entry.status === 'RETURNED' ? formatDate(entry.rentEndDate) : <Typography sx={{ color: '#E74C3C', fontWeight: 700 }}>CURRENTLY RENTED</Typography>}</Field>
                  <Divider />
                  <Field label="Monthly Rental Price">{formatCurrency(entry.monthlyRentalPrice ?? 0)}</Field>
                  <Field label="Total Duration">{entry.totalMonths ?? 0} months</Field>
                  <Field label="Total Rental Revenue">{formatCurrency(entry.rentalRevenue ?? 0)}</Field>
                  <Divider />
                  <Field label="Remarks">{display(entry.remarks)}</Field>
                </Box>
              </Paper>
            ))}

            {finalSale && (
              <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #CBD5E1', overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.5, bgcolor: '#F5F5F5', borderBottom: '1px solid #E0E0E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>
                    CYCLE #{rentalHistory.length + 1}
                  </Typography>
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
                      {formatDate(finalSale.saleDate)}
                    </Typography>
                  </Box>
                  <Divider />
                  <Field label="Sold To">{display(finalSale.customerName)}</Field>
                  <Field label="Invoice Number">{display(finalSale.invoiceNumber)}</Field>
                  <Field label="Selling Price">{formatCurrency(finalSale.saleAmount || 0)}</Field>
                  <Divider />
                  <Field label="Remarks">{display(finalSale.remarks)}</Field>
                </Box>
              </Paper>
            )}
          </Box>
        </Paper>
      )}

      {/* Financial Summary Section */}
      {profitSummary && (
        <Paper elevation={0} sx={{ borderRadius: 4, border: '2px solid #0B63E5', bgcolor: '#F0F7FF', overflow: 'hidden' }}>
          <SectionHeader title="Profit Summary" />
          <Box sx={{ p: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
            <SummaryCard label="Price / Actual Cost" value={formatCurrency(profitSummary.price)} />
            <SummaryCard label="Total Rental Revenue" value={formatCurrency(profitSummary.totalRentalRevenue)} />
            <SummaryCard label="Total Rental Duration" value={`${profitSummary.totalRentalMonths} months`} />
            <SummaryCard label="Interest Rate" value={`${profitSummary.interestRate}%`} />
            <SummaryCard label="Interest Amount" value={formatCurrency(profitSummary.interestAmount)} />
          </Box>

          <Divider sx={{ my: 2.5 }} />

          <Box sx={{ px: 3, pb: 3 }}>
            <Typography sx={{ color: '#06283D', fontWeight: 800, fontSize: 16, mb: 1.5 }}>Depreciation</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
              {profitSummary.depreciation.map((entry, index) => (
                <SummaryCard key={`${entry.year}-${index}`} label={`${entry.year} Depreciation`} value={formatCurrency(entry.value)} />
              ))}
            </Box>
            <Typography sx={{ color: '#06283D', fontWeight: 800, fontSize: 16, mb: 1.5 }}>Tax Benefit</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2, mb: 2.5 }}>
              {profitSummary.depreciation.map((entry, index) => (
                <SummaryCard key={`tax-${entry.year}-${index}`} label={`${entry.year} Tax Benefit`} value={formatCurrency(entry.taxBenefit)} />
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mb: 2.5 }}>
              <SummaryCard label="Total Tax Benefit" value={formatCurrency(profitSummary.totalTaxBenefit)} />
              <SummaryCard label="Sold Value" value={formatCurrency(profitSummary.soldValue)} />
            </Box>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: '#E3F2FD', border: '2px solid #0B63E5', textAlign: 'center' }}>
              <Typography sx={{ color: '#0B63E5', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', mb: 0.75 }}>
                Total Lifetime Profit
              </Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#0B63E5' }}>
                {formatCurrency(profitSummary.profit)}
              </Typography>
            </Paper>

            <Box sx={{ mt: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
              <SummaryCard label="Profit/Loss Percentage" value={`${profitPercentage.toFixed(2)}%`} />
              <SummaryCard label="Profit/Loss Status" value={profitStatus} />
            </Box>

            <Paper elevation={0} sx={{ mt: 2.5, p: 2.5, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#fff' }}>
              <Typography sx={{ color: '#06283D', fontWeight: 800, fontSize: 14, textAlign: 'center', mb: 1.5 }}>
                Profit Breakdown
              </Typography>

              <Box sx={{ width: '100%', overflow: 'visible' }}>
                {(() => {
                  const waterfallBars = [
                    { label: 'Rental Revenue', value: profitSummary.totalRentalRevenue, color: '#16A34A' },
                    { label: 'Tax Benefit', value: profitSummary.totalTaxBenefit, color: '#16A34A' },
                    { label: 'Sold Value', value: profitSummary.soldValue, color: '#16A34A' },
                    { label: 'Purchase Price', value: -profitSummary.price, color: '#DC2626' },
                    { label: 'Interest Amount', value: -profitSummary.interestAmount, color: '#DC2626' },
                    { label: 'Final Profit', value: profitSummary.profit, color: '#2563EB' },
                  ]

                  const chartMax = Math.max(
                    Math.abs(profitSummary.totalRentalRevenue),
                    Math.abs(profitSummary.totalTaxBenefit),
                    Math.abs(profitSummary.soldValue),
                    Math.abs(profitSummary.price),
                    Math.abs(profitSummary.interestAmount),
                    Math.abs(profitSummary.profit),
                    1,
                  )

                  const chartWidth = 900
                  const chartHeight = 360
                  const padding = { top: 26, right: 28, bottom: 86, left: 28 }
                  const innerWidth = chartWidth - padding.left - padding.right
                  const innerHeight = chartHeight - padding.top - padding.bottom
                  const zeroY = padding.top + innerHeight / 2
                  const barWidth = 80
                  const gap = 26
                  const xStart = padding.left + 18

                  let runningTotal = 0
                  const mappedBars = waterfallBars.map((item, index) => {
                    const start = runningTotal
                    const end = runningTotal + item.value
                    const x = xStart + index * (barWidth + gap)
                    const startY = zeroY - (start / chartMax) * (innerHeight / 2)
                    const endY = zeroY - (end / chartMax) * (innerHeight / 2)
                    const y = Math.min(startY, endY)
                    const height = Math.max(Math.abs(endY - startY), 10)
                    const valueY = item.value >= 0 ? Math.max(y - 12, padding.top + 10) : Math.min(y + height + 18, chartHeight - 52)
                    runningTotal = end

                    return { ...item, x, y, height, start, end, valueY }
                  })

                  return (
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 360, display: 'block' }} preserveAspectRatio="xMidYMid meet">
                      <line x1={padding.left} x2={chartWidth - padding.right} y1={zeroY} y2={zeroY} stroke="#94A3B8" strokeWidth="2" />

                      {mappedBars.map((bar, index) => {
                        const nextBar = mappedBars[index + 1]
                        if (!nextBar) return null

                        const connectorY = zeroY - (bar.end / chartMax) * (innerHeight / 2)
                        const lineStartX = bar.x + barWidth + 6
                        const lineEndX = nextBar.x - 6

                        return (
                          <line
                            key={`connector-${bar.label}`}
                            x1={lineStartX}
                            x2={lineEndX}
                            y1={connectorY}
                            y2={connectorY}
                            stroke="#94A3B8"
                            strokeWidth="2"
                            strokeDasharray="5 5"
                          />
                        )
                      })}

                      {mappedBars.map((bar) => (
                        <g key={bar.label}>
                          <rect
                            x={bar.x}
                            y={bar.y}
                            width={barWidth}
                            height={bar.height}
                            rx={10}
                            fill={bar.color}
                            opacity={0.96}
                          />
                          <text
                            x={bar.x + barWidth / 2}
                            y={bar.valueY}
                            textAnchor="middle"
                            fill="#0F172A"
                            fontSize="11"
                            fontWeight="700"
                          >
                            {formatCurrency(bar.value)}
                          </text>
                          <text
                            x={bar.x + barWidth / 2}
                            y={chartHeight - 22}
                            textAnchor="middle"
                            fill="#334155"
                            fontSize="10"
                            fontWeight="700"
                          >
                            {bar.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  )
                })()}
              </Box>
            </Paper>
          </Box>
        </Paper>
      )}
    </Box>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, minHeight: 108, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <Typography sx={{ color: '#64748B', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#06283D' }}>
        {value}
      </Typography>
    </Paper>
  )
}
