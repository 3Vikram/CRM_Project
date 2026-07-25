import { describe, it, expect } from 'vitest'
import { amountInWords } from './services/numberToWords.js'

describe('amountInWords', () => {
  it('handles whole rupees only', () => {
    expect(amountInWords(4956)).toBe('Rupees Four Thousand Nine Hundred and Fifty Six Only')
  })
  it('includes paise in words', () => {
    expect(amountInWords(100.48)).toBe(
      'Rupees One Hundred and Forty Eight Paise Only',
    )
  })
  it('renders zero as Rupees Zero Only', () => {
    expect(amountInWords(0)).toBe('Rupees Zero Only')
  })
  it('renders pure paise', () => {
    expect(amountInWords(0.5)).toBe('Rupees Zero and Fifty Paise Only')
  })
  it('prefixes Minus for negative amounts', () => {
    expect(amountInWords(-250)).toBe('Minus Rupees Two Hundred and Fifty Only')
  })
  it('indian-grouping for lakh/crore', () => {
    expect(amountInWords(150000)).toBe('Rupees One Lakh Fifty Thousand Only')
    expect(amountInWords(12345678)).toBe(
      'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred and Seventy Eight Only',
    )
  })
})