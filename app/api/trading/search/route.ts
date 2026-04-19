import { NextResponse } from 'next/server'

const BASE = process.env.NEXT_PUBLIC_PSX_API_URL ?? 'https://psxterminal.com/api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim().toUpperCase()
  if (!q) {
    return NextResponse.json([])
  }
  try {
    const res = await fetch(`${BASE}/symbols`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(String(res.status))
    const json = await res.json()
    const raw = json.data ?? json
    const symbols: string[] = Array.isArray(raw) ? raw : []
    const filtered = symbols.filter((s: string) => String(s).toUpperCase().includes(q)).slice(0, 30)
    return NextResponse.json(
      filtered.map((symbol: string) => ({ symbol, name: symbol, market: 'PSX' }))
    )
  } catch (e) {
    return NextResponse.json([])
  }
}
