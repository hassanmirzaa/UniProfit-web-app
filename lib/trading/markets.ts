import type { Market } from './types'

export const MARKETS: Market[] = [
  { id: 'PSX', name: 'Pakistan Stock Exchange', logo: undefined }, // Add logo: '/psx-logo.png' when you have the file
]

export function getMarket(id: string): Market | undefined {
  return MARKETS.find((m) => m.id === id)
}
