import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import type { Asset } from '@/hooks/useAssets'
import type { RentOutFormValues } from '@/components/inventory/rentOutTypes'

interface RentOutDialogProps {
  open: boolean
  asset?: Asset | null
  onClose: () => void
  onSubmit: (values: RentOutFormValues) => Promise<void> | void
  submitLabel?: string
}

const initialValues = (asset?: Asset | null): RentOutFormValues => {
  // For serial-numbered assets default quantity to 1 when quantity is missing or zero
  const isSerial = Boolean(asset?.productSerialNumber || asset?.serialNumber)
  const qty = asset && asset.quantity !== undefined && asset.quantity !== null ? Number(asset.quantity) : undefined
  const initialQuantity = qty && Number(qty) > 0 ? Number(qty) : (isSerial ? 1 : 1)
  const isSold = String(asset?.status || '').trim().toLowerCase() === 'sold'

  return {
  customerName: asset?.customerName || '',
  documentNumber: asset?.documentNumber || '',
  productName: asset?.productName || asset?.name || '',
  productDescription: asset?.productDescription || asset?.description || '',
  productSerialNumber: asset?.productSerialNumber || asset?.serialNumber || '',
  outwardType: isSold ? 'Sell' : 'Rent',
  productModel: asset?.productModel || '',
  quantity: initialQuantity,
  ratePerMonth: asset?.price ? Number(asset.price) : 0,
  rentStartDate: asset?.rentStartDate || '',
  rentEndDate: asset?.rentEndDate || '',
  invoiceNumber: asset?.invoiceNumber || '',
  remarks: '',
  }
}

export function RentOutDialog({ open, asset, onClose, onSubmit, submitLabel = 'Update' }: RentOutDialogProps) {
  const [values, setValues] = useState<RentOutFormValues>(initialValues(asset))

  useEffect(() => {
    setValues(initialValues(asset))
  }, [asset, open])

  const handleChange = <K extends keyof RentOutFormValues>(field: K, value: RentOutFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const isRent = values.outwardType === 'Rent'

  const formFields = useMemo(
    () => [
      { key: 'customerName' as const, label: 'Customer Name *', required: true, md: 6 },
      { key: 'documentNumber' as const, label: 'Document Number', required: false, md: 6 },
      { key: 'productName' as const, label: 'Product Name *', required: true, md: 6 },
      { key: 'productDescription' as const, label: 'Product Description', md: 6 },
      { key: 'productSerialNumber' as const, label: 'Product Serial Number *', required: true, md: 6 },
      { key: 'outwardType' as const, label: 'Outward Type *', required: true, md: 6 },
      { key: 'productModel' as const, label: 'Product Model', md: 6 },
      { key: 'quantity' as const, label: 'Quantity', md: 6 },
      { key: 'ratePerMonth' as const, label: 'Rate Per Month / Price *', required: true, md: 6 },
      { key: 'rentStartDate' as const, label: 'Rent Start Date', md: 6 },
      { key: 'rentEndDate' as const, label: 'Rent End Date', md: 6 },
      { key: 'invoiceNumber' as const, label: 'Invoice Number', md: 6 },
      { key: 'remarks' as const, label: 'Remarks', md: 12 },
    ],
    []
  )

  const handleSubmit = async () => {
    await onSubmit(values)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography component="div" variant="h5" fontWeight={700} color="#06283D">
          Rent Out Details
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Update the current asset status and capture the rental or sale record.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {formFields.map((field) => {
            if (field.key === 'outwardType') {
              return (
                <Grid key={field.key} size={{ xs: 12, md: field.md }}>
                  <FormControl fullWidth>
                    <InputLabel>Outward Type *</InputLabel>
                    <Select
                      value={values.outwardType}
                      label="Outward Type *"
                      onChange={(event) => handleChange('outwardType', event.target.value as RentOutFormValues['outwardType'])}
                    >
                      <MenuItem value="Rent">Rent</MenuItem>
                      <MenuItem value="Sell">Sell</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )
            }

            if (field.key === 'remarks') {
              return (
                <Grid key={field.key} size={{ xs: 12, md: field.md }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label={field.label}
                    value={values[field.key]}
                    onChange={(event) => handleChange(field.key, event.target.value as never)}
                  />
                </Grid>
              )
            }

            if (field.key === 'quantity' || field.key === 'ratePerMonth') {
              return (
                <Grid key={field.key} size={{ xs: 12, md: field.md }}>
                  <TextField
                    fullWidth
                    name={String(field.key)}
                    type="number"
                    label={field.label}
                    value={values[field.key] as any}
                    onChange={(event) => {
                      const raw = event.target.value
                      // allow intermediate empty string so user can edit the number
                      if (field.key === 'quantity') {
                        handleChange(field.key, (raw === '' ? ('' as unknown as number) : Number(raw)) as never)
                      } else {
                        handleChange(field.key, Number(raw) as never)
                      }
                    }}
                  />
                </Grid>
              )
            }

            return (
              <Grid key={field.key} size={{ xs: 12, md: field.md }}>
                <TextField
                  fullWidth
                  label={field.label}
                  value={values[field.key]}
                  required={field.required}
                  onChange={(event) => handleChange(field.key, event.target.value as never)}
                />
              </Grid>
            )
          })}
        </Grid>

        <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: '#F7F9FC', border: '1px solid #E3E8EF' }}>
          <Typography variant="subtitle2" fontWeight={700} color="#06283D" sx={{ mb: 1 }}>
            Update Summary
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {isRent ? 'Status will be set to RENTED.' : 'Status will be set to SOLD.'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Existing asset will be updated without creating a duplicate record.
            </Typography>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: '#06283D', '&:hover': { bgcolor: '#041c2d' } }}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
