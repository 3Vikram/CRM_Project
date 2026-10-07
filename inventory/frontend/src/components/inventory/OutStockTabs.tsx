'use client'

import { Box, Button } from '@mui/material'

interface OutStockTabsProps {
  activeTab: 'rent' | 'sold'
  onChange: (tab: 'rent' | 'sold') => void
}

export function OutStockTabs({ activeTab, onChange }: OutStockTabsProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'flex-start' }}>
      <Button
        variant={activeTab === 'rent' ? 'contained' : 'outlined'}
        onClick={() => onChange('rent')}
        sx={{ textTransform: 'none', borderRadius: 2, px: 3, py: 1.5, minWidth: 120 }}
      >
        Rent Out
      </Button>
      <Button
        variant={activeTab === 'sold' ? 'contained' : 'outlined'}
        onClick={() => onChange('sold')}
        sx={{ textTransform: 'none', borderRadius: 2, px: 3, py: 1.5, minWidth: 120 }}
      >
        Sold Out
      </Button>
    </Box>
  )
}
