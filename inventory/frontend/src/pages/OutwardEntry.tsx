'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { formatCurrency } from '@/lib/utils'
import { createOutward, updateAsset, type Asset, triggerInventoryRefresh } from '@/hooks/useAssets'

const outwardTypes = ['Rent', 'Sell'] as const

type OutwardType = (typeof outwardTypes)[number]

export default function OutwardEntry() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state ?? {}) as { asset?: Asset }
  const asset = locationState.asset

  console.log('Location State:', location.state)
  console.log('Received Asset:', asset)

  const [customerName, setCustomerName] = useState('')
  const [outwardType, setOutwardType] = useState<OutwardType>('Rent')
  const [quantity, setQuantity] = useState('1')
  const [rate, setRate] = useState<number>(asset?.price ?? 0)
  const [rentStartDate, setRentStartDate] = useState(new Date().toISOString().split('T')[0])
  const [rentEndDate, setRentEndDate] = useState('')
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split('T')[0])
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [remarks, setRemarks] = useState('')
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productModel, setProductModel] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!asset) return
    if (asset.productDescription) setRemarks('')
    setRate(Number(asset.price || 0))
    setQuantity(String(asset.quantity ?? 1))
    setProductName(asset.productName || asset.name || '')
    setProductDescription(asset.productDescription || asset.description || '')
    setProductModel(asset.productModel || '')
  }, [asset])

  const assetPrice = useMemo(() => asset?.price ?? 0, [asset])
  const availableQuantity = useMemo(() => asset?.availableQuantity ?? asset?.quantity ?? 0, [asset])
  const total = useMemo(() => {
    const q = Number(quantity) || 0
    const r = Number(rate) || 0
    return q * r
  }, [quantity, rate])
  const isSell = outwardType === 'Sell'
  const isRent = outwardType === 'Rent'

  const handleSubmit = async () => {
    setSubmitError(null)
    if (!asset) {
      setSubmitError('No asset selected for outward movement.')
      return
    }

    const isClosingExistingRental =
      !!asset &&
      String(asset.status || '').toLowerCase() === 'rented' &&
      !!rentEndDate &&
      String(rentEndDate).trim() !== ''

    console.log('RENTAL DEBUG', {
      assetId: asset?.id,
      assetStatus: asset?.status,
      quantity,
      availableQuantity,
      rentEndDate,
      isClosingExistingRental,
    })

    if (!customerName.trim()) {
      setSubmitError('Customer Name is required.')
      return
    }

    if (!isClosingExistingRental) {
      if (!quantity.trim() || Number(quantity) <= 0) {
        setSubmitError('Quantity must be greater than 0.')
        return
      }

      if (Number(quantity) > availableQuantity) {
        setSubmitError(`Quantity cannot exceed available stock of ${availableQuantity}.`)
        return
      }
    }

    if (outwardType === 'Sell' && !invoiceNumber.trim()) {
      setSubmitError('Invoice Number is required for Sell.')
      return
    }
    if (outwardType === 'Rent' && (!rentStartDate || !rentStartDate.trim())) {
      setSubmitError('Rent Start Date is required for Rent.')
      return
    }

    const outwardData = {
      assetId: asset.id,
      assetName: asset.productName || asset.name,
      customerName: customerName.trim(),
      outwardType,
      quantity: Number(quantity),
      documentNumber: documentNumber.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      remarks: remarks.trim() || undefined,
      outwardDate: new Date().toISOString().split('T')[0],
      rentStartDate: outwardType === 'Rent' ? rentStartDate : undefined,
      rentEndDate: outwardType === 'Rent' ? (rentEndDate || '') : undefined,
      productName: productName.trim(),
      productDescription: productDescription.trim(),
      productModel: productModel.trim(),
      productSerialNumber: asset.productSerialNumber || asset.serialNumber || '',
      price: Number(rate) || 0,
    }

    console.log('Submitting Outward:', outwardData)

    try {
      setLoading(true)
      if (isClosingExistingRental) {
        const updatePayload: Partial<Asset> = {
          status: 'available',
          rentEndDate: rentEndDate,
          rentStartDate: rentStartDate,
          productSerialNumber: asset.productSerialNumber || asset.serialNumber,
          availableQuantity: 1,
        }

        await updateAsset(asset.id, updatePayload)
        setSuccessMessage('Rental closed successfully.')
        setTimeout(() => {
          triggerInventoryRefresh()
          navigate('/inventory/in-stock')
        }, 800)
      } else {
        await createOutward(outwardData)
        setSuccessMessage('Outward movement recorded successfully.')
        setTimeout(() => {
          triggerInventoryRefresh()
          if (outwardType === 'Sell') {
            navigate('/inventory/sold-out')
          } else {
            navigate('/inventory/out-stock')
          }
        }, 800)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit outward movement.')
    } finally {
      setLoading(false)
    }
  }

  if (!asset) {
    return (
      <Box sx={{ width: '100%', bgcolor: '#F4F6F8', minHeight: '100vh', py: 5 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <Box>
              <Typography sx={{ fontSize: 34, fontWeight: 700 }}>Input Outward Details</Typography>
              <Typography sx={{ fontSize: 16, color: '#637381', mt: 1 }}>Enter outward movement details for the selected asset.</Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/inventory/in-stock')}
              sx={{ minWidth: 140, minHeight: 48, borderRadius: 3, borderColor: '#D7DEE8', color: '#0B1F33' }}
            >
              Back
            </Button>
          </Box>

          <Card sx={{ borderRadius: 4, p: 4, boxShadow: '0px 12px 34px rgba(15, 23, 42, 0.08)', bgcolor: '#ffffff', mt: 3 }}>
            <Typography sx={{ fontSize: 16, color: '#475569' }}>
              No asset selected. Please return to the In Stock page and select an asset.
            </Typography>
          </Card>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%', bgcolor: '#F4F6F8', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 600, textTransform: 'uppercase', color: '#2F2F2F' }}>INPUT OUT WARD DETAILS</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Box sx={{ width: 56, height: 6, bgcolor: '#1976d2', borderRadius: 1 }} />
              <Typography sx={{ fontSize: 12, color: '#1976d2', fontWeight: 600 }}>Insert</Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
            sx={{ minWidth: 140, minHeight: 40, borderRadius: 1, borderColor: '#D7DEE8', color: '#0B1F33' }}
          >
            Back
          </Button>
        </Box>

        <Card sx={{ borderRadius: 1, p: '30px', boxShadow: '0px 4px 10px rgba(0,0,0,0.04)', bgcolor: '#ffffff', mt: 1, width: '95%', mx: 'auto' }}>
          <CardContent sx={{ p: 0 }}>
            <Box component="form" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: '14px 24px' }}>
              {/* LEFT COLUMN */}
              <Box sx={{ display: 'grid', gap: '14px' }}>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Customer Name <Box component="span" sx={{ color: 'red' }}>*</Box></Typography>
                  <TextField
                    variant="outlined"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    placeholder=""
                    sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14, color: '#000' } }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Product Name <Box component="span" sx={{ color: 'red' }}>*</Box></Typography>
                  <TextField
                    variant="outlined"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    placeholder=""
                    sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14, color: '#000' } }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Product Serial Number <Box component="span" sx={{ color: 'red' }}>*</Box></Typography>
                  <TextField
                    variant="outlined"
                    value={asset.productSerialNumber || asset.serialNumber}
                    fullWidth
                    disabled
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Outward Type <Box component="span" sx={{ color: 'red' }}>*</Box></Typography>
                  <FormControl fullWidth>
                    <Select
                      value={outwardType}
                      onChange={(event) => setOutwardType(event.target.value as OutwardType)}
                      sx={{ '& .MuiSelect-select': { height: 40, display: 'flex', alignItems: 'center', padding: '8px 10px' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' } }}
                    >
                      {outwardTypes.map((type) => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Product Model</Typography>
                  <TextField
                    variant="outlined"
                    value={productModel}
                    onChange={(event) => setProductModel(event.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                  />
                </Box>

                {isRent && (
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Rent Start Date</Typography>
                    <TextField
                      variant="outlined"
                      type="date"
                      value={rentStartDate}
                      onChange={(event) => setRentStartDate(event.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                    />
                  </Box>
                )}

                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Remarks</Typography>
                  <TextField
                    variant="outlined"
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, textarea: { padding: '8px 10px', fontSize: 14 } }}
                  />
                </Box>
              </Box>

              {/* RIGHT COLUMN */}
              <Box sx={{ display: 'grid', gap: '14px' }}>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Document Number</Typography>
                  <TextField
                    variant="outlined"
                    value={documentNumber}
                    onChange={(event) => setDocumentNumber(event.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Product Description</Typography>
                  <TextField
                    variant="outlined"
                    value={productDescription}
                    onChange={(event) => setProductDescription(event.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, textarea: { padding: '8px 10px', fontSize: 14 } }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Total</Typography>
                  <TextField
                    variant="outlined"
                    value={total > 0 ? formatCurrency(total) : '-'}
                    fullWidth
                    disabled
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>{isSell ? 'Price' : 'Rate Per Month'} <Box component="span" sx={{ color: 'red' }}>*</Box></Typography>
                  <TextField
                    variant="outlined"
                    value={rate}
                    type="number"
                    onChange={(e) => setRate(Number(e.target.value))}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Quantity <Box component="span" sx={{ color: 'red' }}>*</Box></Typography>
                  <TextField
                    variant="outlined"
                    type="number"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    inputProps={{ min: 1, max: availableQuantity }}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                  />
                </Box>

                {isRent && (
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Rent End Date</Typography>
                    <TextField
                      variant="outlined"
                      type="date"
                      value={rentEndDate}
                      onChange={(event) => setRentEndDate(event.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                    />
                  </Box>
                )}

                {isSell && (
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1F2937', mb: '6px' }}>Invoice Number</Typography>
                    <TextField
                      variant="outlined"
                      value={invoiceNumber}
                      onChange={(event) => setInvoiceNumber(event.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                    />
                  </Box>
                )}

                <Box>
                  <TextField
                    variant="outlined"
                    label="Available Quantity"
                    value={String(availableQuantity)}
                    fullWidth
                    disabled
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1, backgroundColor: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' }, input: { padding: '8px 10px', fontSize: 14 } }}
                  />
                </Box>
              </Box>
            </Box>

            {(submitError || successMessage) && (
              <Box sx={{ mt: 3 }}>
                {submitError && <Alert severity="error">{submitError}</Alert>}
                {successMessage && <Alert severity="success">{successMessage}</Alert>}
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1 }}>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                sx={{ width: 70, height: 38, bgcolor: '#3f51b5', '&:hover': { bgcolor: '#364db0' }, color: '#fff', fontWeight: 600, borderRadius: 1 }}
              >
                {loading ? <CircularProgress size={16} color="inherit" /> : 'Update'}
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/inventory/in-stock')}
                sx={{ width: 70, height: 38, bgcolor: '#f2f2f2', color: '#222', fontWeight: 600, borderRadius: 1 }}
              >
                Reset
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
