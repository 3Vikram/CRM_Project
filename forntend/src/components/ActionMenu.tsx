'use client'

import { Stack, IconButton, Tooltip } from '@mui/material'
import { Add, Delete, Edit, KeyboardReturn } from '@mui/icons-material'
import type { Asset } from '@/hooks/useAssets'

interface ActionMenuProps {
  asset: Asset
  onRentOut?: (asset: Asset) => void
  onSoldOut?: (asset: Asset) => void
  onReturn: (asset: Asset) => void
  onEdit: (asset: Asset) => void
  onDelete: (asset: Asset) => void
  onOutward?: (asset: Asset) => void
}

export function ActionMenu({ asset, onReturn, onEdit, onDelete, onOutward }: ActionMenuProps) {
  const buttonStyle = {
    width: 32,
    height: 32,
    borderRadius: '6px',
    border: '1px solid #D7DEE8',
    backgroundColor: '#FFFFFF',
    color: '#06283D',
    boxShadow: '0 2px 8px rgba(6, 40, 61, 0.06)',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#F3F7FA',
      borderColor: '#B5C7D6',
      boxShadow: '0 4px 12px rgba(6, 40, 61, 0.12)',
    },
  }

  const normalizedInwardType = String(asset.inwardType || '').trim().toLowerCase()
  const isReturnAllowed = normalizedInwardType === 'rent in' || normalizedInwardType === 'rent_in' || normalizedInwardType === 'rent-in'

  return (
    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-start">
      <Tooltip title="Outward">
        <IconButton
          size="small"
          onClick={() => onOutward?.(asset)}
          sx={buttonStyle}
        >
          <Add sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Edit">
        <IconButton
          size="small"
          onClick={() => onEdit(asset)}
          sx={buttonStyle}
        >
          <Edit sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title={isReturnAllowed ? 'Return' : 'Return not allowed for Purchase assets'}>
        <span>
          <IconButton
            size="small"
            onClick={() => isReturnAllowed && onReturn(asset)}
            disabled={!isReturnAllowed}
            sx={{
              ...buttonStyle,
              opacity: isReturnAllowed ? 1 : 0.45,
              cursor: isReturnAllowed ? 'pointer' : 'not-allowed',
              '&:hover': isReturnAllowed ? buttonStyle['&:hover'] : {},
            }}
          >
            <KeyboardReturn sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Delete">
        <IconButton
          size="small"
          onClick={() => onDelete(asset)}
          sx={buttonStyle}
        >
          <Delete sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}
