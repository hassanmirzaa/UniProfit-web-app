export type MarketId = 'PSX'

export interface Market {
  id: MarketId
  name: string
  logo?: string
}

export interface SymbolSearchResult {
  symbol: string
  name: string
  market?: string
}

export interface Quote {
  symbol: string
  name?: string
  last: number
  open?: number
  high?: number
  low?: number
  change?: number
  changePercent?: number
  volume?: number
  previousClose?: number
}

export interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface CompanyDetail {
  symbol: string
  name: string
  sector?: string
  industry?: string
  description?: string
  marketCap?: number
  high52?: number
  low52?: number
  keyPeople?: Array<{ name: string; position: string }>
}
