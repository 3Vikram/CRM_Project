import type { AssetSerialHistoryResponse } from '@/hooks/useAssets'

export type DepreciationEntry = {
  year: string
  value: number
  taxBenefit: number
}

export type ProfitSummary = {
  price: number
  totalRentalRevenue: number
  totalRentalMonths: number
  interestRate: number
  interestAmount: number
  depreciation: DepreciationEntry[]
  totalTaxBenefit: number
  soldValue: number
  profit: number
}

const roundAmount = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const parseDate = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const getAssetInvoiceDate = (data: AssetSerialHistoryResponse) => parseDate(data.asset.purchaseDate)

export const calculateTotalRentalRevenue = (data: AssetSerialHistoryResponse) =>
  (data.rentalHistory || []).reduce((total, cycle) => total + Number(cycle.rentalRevenue || 0), 0)

export const calculateTotalRentalMonths = (data: AssetSerialHistoryResponse) =>
  (data.rentalHistory || []).reduce((total, cycle) => total + Number(cycle.totalMonths || 0), 0)

export const calculateInterestRate = (totalRentalMonths: number) =>
  Math.max(0, totalRentalMonths) * 2

export const calculateInterestAmount = (price: number, totalRentalMonths: number) =>
  roundAmount(price * calculateInterestRate(totalRentalMonths) / 100)

export const calculateDepreciation = (data: AssetSerialHistoryResponse, asOf = new Date()) => {
  const price = Number(data.asset.purchasePrice || 0)
  const invoiceDate = getAssetInvoiceDate(data)

  if (!invoiceDate || !Number.isFinite(price) || price <= 0) return []

  const entries: DepreciationEntry[] = []
  const purchaseYear = invoiceDate.getFullYear()
  let remainingValue = price

  const initialValue = roundAmount(price * 0.4)
  entries.push({ year: `${purchaseYear}-${String(purchaseYear + 1).slice(-2)}`, value: initialValue, taxBenefit: roundAmount(initialValue * 0.25) })
  remainingValue = roundAmount(remainingValue - initialValue)

  for (let year = purchaseYear + 1; year <= asOf.getFullYear(); year += 1) {
    const aprilFirst = new Date(year, 3, 1)
    if (aprilFirst <= invoiceDate || aprilFirst > asOf) continue

    const value = roundAmount(remainingValue * 0.4)
    entries.push({ year: `${year}-${String(year + 1).slice(-2)}`, value, taxBenefit: roundAmount(value * 0.25) })
    remainingValue = roundAmount(remainingValue - value)
  }

  return entries
}

export const calculateTaxBenefit = (depreciation: DepreciationEntry[]) =>
  roundAmount(depreciation.reduce((total, entry) => total + entry.taxBenefit, 0))

export const calculateProfit = (data: AssetSerialHistoryResponse, asOf = new Date()): ProfitSummary => {
  const price = Number(data.asset.purchasePrice || 0)
  const totalRentalMonths = calculateTotalRentalMonths(data)
  const totalRentalRevenue = calculateTotalRentalRevenue(data)
  const interestRate = calculateInterestRate(totalRentalMonths)
  const interestAmount = calculateInterestAmount(price, totalRentalMonths)
  const depreciation = calculateDepreciation(data, asOf)
  const totalTaxBenefit = calculateTaxBenefit(depreciation)
  const soldValue = Number(data.finalSale?.saleAmount || 0)

  console.log('Profit Summary Serial Number:', data.asset.serialNumber)
  console.log('Matching Depreciation Record:', depreciation.length ? { serialNumber: data.asset.serialNumber, valuesByYear: Object.fromEntries(depreciation.map((entry) => [entry.year, entry.value])) } : null)
  console.log('Depreciation Values:', depreciation)
  console.log('Calculated Tax Benefit:', totalTaxBenefit)

  return {
    price,
    totalRentalRevenue,
    totalRentalMonths,
    interestRate,
    interestAmount,
    depreciation,
    totalTaxBenefit,
    soldValue,
    profit: roundAmount(totalRentalRevenue + totalTaxBenefit + soldValue - price - interestAmount),
  }
}