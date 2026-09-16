import { Autocomplete, TextField } from '@mui/material'

interface SearchableDropdownProps {
  label: string
  options: string[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  noOptionsText?: string
  fullWidth?: boolean
  sx?: any
}

/**
 * Reusable searchable dropdown component with real-time filtering
 * - Shows all options on open
 * - Filters options as user types
 * - Always shows "All" option at top
 * - Case-insensitive partial matching
 */
export function SearchableDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = 'Search or select...',
  noOptionsText = 'No options found',
  fullWidth = true,
  sx,
}: SearchableDropdownProps) {
  // Add "All" option to the beginning
  const optionsWithAll = ['All', ...options]

  // Filter function: show "All" always, filter others by input
  const filterOptions = (opts: string[], { inputValue }: { inputValue: string }) => {
    if (!inputValue) {
      return opts
    }
    const searchLower = inputValue.toLowerCase()
    return opts.filter((option) => {
      if (option === 'All') return true // Always include "All"
      return String(option).toLowerCase().includes(searchLower)
    })
  }

  return (
    <Autocomplete
      size="small"
      options={optionsWithAll}
      value={value ?? 'All'}
      onChange={(_, selectedValue) => {
        const selected = String(selectedValue || '')
        onChange(selected === 'All' ? null : selected)
      }}
      filterOptions={filterOptions}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          sx={{
            '& .MuiOutlinedInput-root': { borderRadius: 2 },
            ...sx,
          }}
        />
      )}
      sx={{ width: fullWidth ? '100%' : 'auto', maxWidth: '100%', ...sx }}
      noOptionsText={noOptionsText}
    />
  )
}
