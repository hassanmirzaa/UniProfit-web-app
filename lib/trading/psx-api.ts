/**
 * PSX / market API client.
 * Configure base URL and endpoints via env:
 * - NEXT_PUBLIC_PSX_API_URL (e.g. https://your-psx-api.com)
 * Endpoints below can be overridden to match psx_apis.docx once you paste the exact paths.
 */

import type { Quote, Candle, CompanyDetail, SymbolSearchResult } from './types'

const BASE = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_PSX_API_URL ?? '') : ''

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, BASE || 'https://api.example.com')
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { next: { revalidate: 30 } })
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json() as Promise<T>
}

/** Search symbols – adapt path/response to your PSX API (see psx_apis.docx) */
export async function searchSymbols(
  market: string,
  query: string
): Promise<SymbolSearchResult[]> {
  if (!query.trim()) return []
  if (!BASE) {
    // Mock for development when no API URL set
    return mockSearch(query)
  }
  try {
    const data = await fetchApi<{ symbols?: SymbolSearchResult[]; data?: SymbolSearchResult[] }>(
      `/search`,
      { q: query, market }
    )
    return (data.symbols ?? data.data ?? []) as SymbolSearchResult[]
  } catch {
    return mockSearch(query)
  }
}

/** Get quote (last price, change, etc.) – adapt to your API */
export async function getQuote(market: string, symbol: string): Promise<Quote | null> {
  if (!BASE) {
    return mockQuote(symbol)
  }
  try {
    const data = await fetchApi<Quote | { quote?: Quote }>(`/quote/${encodeURIComponent(symbol)}`)
    return (data && 'symbol' in data ? data : (data as { quote?: Quote }).quote) ?? null
  } catch {
    return mockQuote(symbol)
  }
}

/** Get OHLCV for candles – adapt to your API */
export async function getCandles(
  market: string,
  symbol: string,
  from: string,
  to: string
): Promise<Candle[]> {
  if (!BASE) {
    return mockCandles(symbol, from, to)
  }
  try {
    const data = await fetchApi<{ candles?: Candle[]; data?: Candle[] }>(`/history`, {
      symbol,
      from,
      to,
    })
    return (data.candles ?? data.data ?? []) as Candle[]
  } catch {
    return mockCandles(symbol, from, to)
  }
}

/** Get company detail – adapt to your API */
export async function getCompanyDetail(market: string, symbol: string): Promise<CompanyDetail | null> {
  if (!BASE) {
    return mockCompany(symbol)
  }
  try {
    const data = await fetchApi<CompanyDetail | { company?: CompanyDetail }>(
      `/company/${encodeURIComponent(symbol)}`
    )
    return (data && 'symbol' in data ? data : (data as { company?: CompanyDetail }).company) ?? null
  } catch {
    return mockCompany(symbol)
  }
}

// —— Mocks for when API is not configured or request fails ——
function mockSearch(query: string): SymbolSearchResult[] {
  const q = query.toUpperCase()
  return [
    { symbol: `${q}1`, name: `${q} Company 1`, market: 'PSX' },
    { symbol: `${q}2`, name: `${q} Company 2`, market: 'PSX' },
  ]
}

function mockQuote(symbol: string): Quote {
  const last = 100 + Math.random() * 50
  const change = (Math.random() - 0.5) * 10
  return {
    symbol,
    name: `${symbol} Ltd`,
    last: Math.round(last * 100) / 100,
    open: last - change,
    high: last + Math.random() * 5,
    low: last - Math.random() * 5,
    change,
    changePercent: (change / last) * 100,
    volume: Math.floor(Math.random() * 1e6),
  }
}

function mockCandles(symbol: string, from: string, to: string): Candle[] {
  const candles: Candle[] = []
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  const day = 86400 * 1000
  let open = 100
  for (let t = start; t <= end; t += day) {
    const high = open + Math.random() * 4
    const low = open - Math.random() * 4
    const close = low + Math.random() * (high - low)
    candles.push({
      date: new Date(t).toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 500000),
    })
    open = close
  }
  return candles
}

function mockCompany(symbol: string): CompanyDetail {
  return {
    symbol,
    name: `${symbol} Limited`,
    sector: 'Technology',
    industry: 'Software',
    description: 'Company description will appear when API is connected.',
    marketCap: 50000000000,
    high52: 150,
    low52: 80,
  }
}
