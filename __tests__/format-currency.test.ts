import { describe, it, expect } from 'vitest'
import { formatMoney, getCurrencySymbol, CURRENCY_OPTIONS } from '@/lib/format-currency'

describe('getCurrencySymbol', () => {
  it('returns $ for USD', () => {
    expect(getCurrencySymbol('USD')).toBe('$')
  })

  it('returns £ for GBP', () => {
    expect(getCurrencySymbol('GBP')).toBe('£')
  })

  it('returns € for EUR', () => {
    expect(getCurrencySymbol('EUR')).toBe('€')
  })

  it('returns Rs for PKR', () => {
    expect(getCurrencySymbol('PKR')).toBe('Rs ')
  })

  it('returns code as fallback for unknown currencies', () => {
    expect(getCurrencySymbol('XYZ')).toBe('XYZ')
    expect(getCurrencySymbol('')).toBe('')
  })
})

describe('formatMoney', () => {
  it('formats positive amounts correctly', () => {
    expect(formatMoney(1234.56, 'USD')).toBe('$1,234.56')
  })

  it('formats zero correctly', () => {
    expect(formatMoney(0, 'USD')).toBe('$0.00')
  })

  it('formats negative amounts correctly', () => {
    expect(formatMoney(-500, 'EUR')).toBe('€-500.00')
  })

  it('formats large numbers with commas', () => {
    expect(formatMoney(1000000, 'PKR')).toBe('Rs 1,000,000.00')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatMoney(99.999, 'USD')).toBe('$100.00')
  })
})

describe('CURRENCY_OPTIONS', () => {
  it('contains expected currencies', () => {
    expect(CURRENCY_OPTIONS).toContain('USD')
    expect(CURRENCY_OPTIONS).toContain('GBP')
    expect(CURRENCY_OPTIONS).toContain('EUR')
    expect(CURRENCY_OPTIONS).toContain('PKR')
  })

  it('has exactly 4 options', () => {
    expect(CURRENCY_OPTIONS.length).toBe(4)
  })
})
