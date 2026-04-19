import { NextResponse } from 'next/server'

const BASE = process.env.NEXT_PUBLIC_PSX_API_URL ?? 'https://psxterminal.com/api'

/** Response shape from https://psxterminal.com/api/companies/{symbol} */
interface PSXCompanyData {
  symbol?: string
  businessDescription?: string
  financialStats?: {
    marketCap?: { raw?: string; numeric?: number }
    shares?: { raw?: string; numeric?: number }
    freeFloat?: { raw?: string; numeric?: number }
    freeFloatPercent?: { raw?: string; numeric?: number }
  }
  keyPeople?: Array<{ name: string; position: string }>
  error?: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  }
  try {
    const companyRes = await fetch(`${BASE}/companies/${encodeURIComponent(symbol)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    })
    if (!companyRes.ok) {
      return NextResponse.json(
        { symbol, name: symbol, error: 'Company not found' },
        { status: companyRes.status === 404 ? 404 : 502 }
      )
    }
    const body = await companyRes.json()
    const data: PSXCompanyData | undefined = body?.success === true ? body?.data : body?.data ?? body
    if (!data || data?.error) {
      return NextResponse.json({
        symbol: data?.symbol ?? symbol,
        name: symbol,
        description: undefined,
      })
    }
    const marketCap = data.financialStats?.marketCap?.numeric
    return NextResponse.json({
      symbol: data.symbol ?? symbol,
      name: data.symbol ?? symbol,
      description: data.businessDescription ?? undefined,
      marketCap: marketCap != null ? marketCap : undefined,
      keyPeople: Array.isArray(data.keyPeople) ? data.keyPeople : undefined,
    })
  } catch (e) {
    console.error('[company]', symbol, e)
    return NextResponse.json(
      { symbol, name: symbol, error: 'Failed to load company details' },
      { status: 500 }
    )
  }
}
