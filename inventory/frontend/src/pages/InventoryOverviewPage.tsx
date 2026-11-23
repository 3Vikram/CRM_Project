'use client'

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inventory2, Inventory2Outlined, LocalShipping, RotateLeft, Sell } from '@mui/icons-material'
import { Alert, Box, Card, CardContent, CircularProgress, Paper, Typography } from '@mui/material'
import { useInventoryData } from '@/hooks/useInventoryData'

export default function InventoryOverviewPage() {
  const { stats, overview, loading, error } = useInventoryData()
  const navigate = useNavigate()

  const summaryCards = useMemo(
    () => [
      {
        label: 'All Assets',
        value: overview?.summary.totalAssets ?? stats?.allAssets ?? 0,
        icon: <Inventory2 sx={{ fontSize: 22 }} />,
        path: '/inventory/assets',
        iconBackground: '#E8F0FB',
        iconColor: '#315E9E',
      },
      {
        label: 'In Stock',
        value: overview?.summary.inStock ?? stats?.inStock ?? 0,
        icon: <Inventory2Outlined sx={{ fontSize: 22 }} />,
        path: '/inventory/in-stock',
        iconBackground: '#E8F5EF',
        iconColor: '#26835A',
      },
      {
        label: 'Rent Out',
        value: overview?.summary.rentedOut ?? stats?.rentOut ?? 0,
        icon: <LocalShipping sx={{ fontSize: 22 }} />,
        path: '/inventory/rent-out',
        iconBackground: '#F0ECFA',
        iconColor: '#7557AA',
      },
      {
        label: 'Sold Out',
        value: overview?.summary.soldOut ?? stats?.soldOut ?? 0,
        icon: <Sell sx={{ fontSize: 22 }} />,
        path: '/inventory/sold-out',
        iconBackground: '#FFF2E6',
        iconColor: '#BD6B25',
      },
      {
        label: 'Returned',
        value: overview?.summary.returned ?? stats?.returned ?? 0,
        icon: <RotateLeft sx={{ fontSize: 22 }} />,
        path: '/inventory/returned',
        iconBackground: '#FCEDEE',
        iconColor: '#B34D57',
      },
    ],
    [overview, stats]
  )

  return (
    <Box
      className="inventory-overview"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: 0,
      }}
    >
      {error && <Alert severity="error" sx={{ mb: 2 }}>Unable to load inventory summary. Please try again in a moment.</Alert>}

      <Typography
        variant="h4"
        sx={{ mb: 2.5, color: '#102F43', fontSize: { xs: 25, md: 30 }, fontWeight: 700, letterSpacing: '-0.025em' }}
      >
        Inventory Overview
      </Typography>

      <Paper
        elevation={0}
        sx={{
          width: '100%',
          my: 0,
          border: '1px solid #E1E6EB',
          borderRadius: 3,
          p: { xs: 2, sm: 2.5, lg: 3 },
          backgroundColor: '#FFFFFF',
          boxShadow: '0 8px 24px rgba(19, 47, 66, 0.045)',
        }}
      >
        <Typography variant="h6" sx={{ mb: 2.5, color: '#18394D', fontWeight: 700 }}>
          Inventory Summary
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1.5, md: 2 },
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
            },
          }}
        >
          {summaryCards.map((card) => (
            <Card
              key={card.label}
              variant="outlined"
              component="button"
              type="button"
              aria-label={`${card.label}: ${card.value}`}
              disabled={loading}
              onClick={() => navigate(card.path)}
              sx={{
                width: '100%',
                minWidth: 0,
                minHeight: { xs: 136, md: 148 },
                textAlign: 'left',
                cursor: loading ? 'default' : 'pointer',
                borderRadius: 2.5,
                borderColor: '#E1E6EB',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(19, 47, 66, 0.035)',
                transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                '&:active': loading ? {} : { transform: 'translateY(-1px)' },
                '&:hover': loading ? {} : {
                  borderColor: '#BCCAD3',
                  boxShadow: '0 9px 18px rgba(19, 47, 66, 0.075)',
                  transform: 'translateY(-2px)',
                },
                '&:focus-visible': { outline: '2px solid #6F9DB5', outlineOffset: 2 },
              }}
            >
              <CardContent sx={{ display: 'flex', height: '100%', alignItems: 'center', gap: 2, p: { xs: 2, md: 2.25 }, '&:last-child': { pb: { xs: 2, md: 2.25 } } }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    flexShrink: 0,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: card.iconBackground,
                    color: card.iconColor,
                  }}
                >
                  {loading ? <CircularProgress size={19} sx={{ color: card.iconColor }} /> : card.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      color: '#18394D',
                      fontSize: { xs: 28, md: 32 },
                      fontWeight: 700,
                      lineHeight: 1.1,
                      letterSpacing: '-0.025em',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {loading ? '—' : card.value.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.55, color: '#173D54', fontWeight: 600 }}>
                    {card.label}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Paper>
    </Box>
  )
}
