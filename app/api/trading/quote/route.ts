import { NextResponse } from 'next/server'

const BASE = process.env.NEXT_PUBLIC_PSX_API_URL ?? 'https://psxterminal.com/api'
const DEFAULT_MARKET = 'REG'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const market = searchParams.get('market') ?? DEFAULT_MARKET
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  }
  try {
    const res = await fetch(`${BASE}/ticks/${market}/${encodeURIComponent(symbol)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(String(res.status))
    const json = await res.json()
    const d = json.data ?? json
    if (!d) throw new Error('No data')
    const price = d.price ?? d.c ?? d.p ?? 0
    const change = d.change ?? d.ch ?? 0
    const changePercent = d.changePercent ?? d.pch ?? (price ? (change / price) * 100 : 0)
    return NextResponse.json({
      symbol: d.symbol ?? symbol,
      last: Number(price),
      open: d.open ?? price - change,
      high: d.high ?? d.h ?? price,
      low: d.low ?? d.l ?? price,
      change: Number(change),
      changePercent: Number(changePercent),
      volume: d.volume ?? d.v ?? 0,
      previousClose: d.previousClose ?? price - change,
    })
  } catch {
    return NextResponse.json(
      { error: 'Quote unavailable' },
      { status: 502 }
    )
  }
}
