import type { Asset } from '@/hooks/useAssets'

export interface RentOutFormValues {
  customerName: string
  documentNumber: string
  productName: string
  productDescription: string
  productSerialNumber: string
  outwardType: 'Rent' | 'Sell'
  productModel: string
  quantity: number
  ratePerMonth: number
  rentStartDate: string
  rentEndDate: string
  invoiceNumber: string
  remarks: string
}

export interface RentOutRow {
  id: string
  assetId: string
  customerName: string
  documentNumber: string
  productSerialNumber: string
  productName: string
  productDescription: string
  productModel: string
  ratePerMonth: number
  rentStartDate: string
  rentEndDate: string
  totalMonths: number
  monthwiseTotalPrice: number
  invoiceNumber: string
  remarks: string
  status: string
  originalAsset: Asset
}
