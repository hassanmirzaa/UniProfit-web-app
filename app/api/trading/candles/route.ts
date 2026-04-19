import { NextResponse } from 'next/server'

const BASE = process.env.NEXT_PUBLIC_PSX_API_URL ?? 'https://psxterminal.com/api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const tf = searchParams.get('tf') ?? '1d'
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  }
  const validTf = ['1m', '5m', '15m', '30m', '1h', '1d'].includes(tf) ? tf : '1d'
  try {
    const res = await fetch(
      `${BASE}/klines/${encodeURIComponent(symbol)}/${validTf}?limit=${limit}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) throw new Error(String(res.status))
    const json = await res.json()
    const raw = json.data ?? json
    const list = Array.isArray(raw) ? raw : []
    const candles = list.map((c: { timestamp: number; open: number; high: number; low: number; close: number; volume?: number }) => ({
      date: new Date(c.timestamp).toISOString().slice(0, 10),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: c.volume != null ? Number(c.volume) : undefined,
    }))
    return NextResponse.json(candles)
  } catch {
    return NextResponse.json([])
  }
}
