const CURRENCIES: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  PKR: 'Rs ',
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES[code] ?? code
}

export function formatMoney(value: number, currencyCode: string): string {
  const sym = getCurrencySymbol(currencyCode)
  return sym + value.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

export const CURRENCY_OPTIONS = ['USD', 'GBP', 'EUR', 'PKR'] as const
