'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  TrendingUp,
  Search,
  Plus,
  Trash2,
  Loader2,
  LogIn,
  Briefcase,
  BarChart3,
  Building2,
  Radio,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { usePsxWebSocket } from '@/hooks/use-psx-websocket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MARKETS, getMarket } from '@/lib/trading/markets'
import type { Quote, Candle, CompanyDetail, SymbolSearchResult } from '@/lib/trading/types'
import { CandlestickChart } from '@/components/candlestick-chart'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { format } from 'date-fns'

const LAST_SYMBOL_KEY = 'uniprofit_last_symbol'
const CHART_TF_OPTIONS = ['1m', '5m', '15m', '1h', '1d'] as const
type ChartTf = (typeof CHART_TF_OPTIONS)[number]

type WatchlistRow = { id: string; market: string; symbol: string; name: string | null }
type PortfolioRow = {
  id: string
  market: string
  symbol: string
  name: string | null
  buy_price: number
  quantity: number
  notes: string | null
}

export default function TradingPage() {
  const { user, loading: authLoading } = useAuth()
  const [market, setMarket] = useState<string>('PSX')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([])
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([])
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [addPortfolioOpen, setAddPortfolioOpen] = useState(false)
  const [addSymbol, setAddSymbol] = useState('')
  const [addBuyPrice, setAddBuyPrice] = useState('')
  const [addQuantity, setAddQuantity] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [quotesMap, setQuotesMap] = useState<Record<string, Quote>>({})
  const [chartTimeframe, setChartTimeframe] = useState<ChartTf>('1d')
  const [companyOpen, setCompanyOpen] = useState(true)
  const supabase = createClient()

  const symbolsForWs = useMemo(() => {
    const set = new Set<string>()
    portfolio.forEach((p) => set.add(p.symbol))
    watchlist.forEach((w) => set.add(w.symbol))
    if (selectedSymbol) set.add(selectedSymbol)
    return Array.from(set)
  }, [portfolio, watchlist, selectedSymbol])

  const { ticks: wsTicks, connected: wsConnected } = usePsxWebSocket(symbolsForWs)

  const quotesMapMerged = useMemo(() => {
    const next: Record<string, Quote> = { ...quotesMap }
    Object.entries(wsTicks).forEach(([symbol, tick]) => {
      next[symbol] = {
        symbol: tick.symbol,
        last: tick.last,
        change: tick.change,
        changePercent: tick.changePercent,
        high: tick.high,
        low: tick.low,
        volume: tick.volume,
      }
    })
    return next
  }, [quotesMap, wsTicks])

  const marketInfo = getMarket(market)

  const fetchWatchlist = useCallback(async () => {
    if (!user) return
    setWatchlistLoading(true)
    const { data } = await supabase
      .from('watchlist')
      .select('id, market, symbol, name')
      .eq('market', market)
      .order('created_at', { ascending: false })
    setWatchlist((data ?? []) as WatchlistRow[])
    setWatchlistLoading(false)
  }, [user, market, supabase])

  const fetchPortfolio = useCallback(async () => {
    if (!user) return
    setPortfolioLoading(true)
    const { data } = await supabase
      .from('portfolio')
      .select('id, market, symbol, name, buy_price, quantity, notes')
      .eq('market', market)
      .order('created_at', { ascending: false })
    setPortfolio((data ?? []) as PortfolioRow[])
    setPortfolioLoading(false)
  }, [user, market, supabase])

  useEffect(() => {
    if (user) {
      fetchWatchlist()
      fetchPortfolio()
    } else {
      setWatchlist([])
      setPortfolio([])
    }
  }, [user, fetchWatchlist, fetchPortfolio])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const t = setTimeout(() => {
      setSearching(true)
      fetch(`/api/trading/search?market=${encodeURIComponent(market)}&q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((d) => setSearchResults(Array.isArray(d) ? d : []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, market])

  const handleAddWatchlist = async (symbol: string, name?: string) => {
    if (!user) return
    await supabase.from('watchlist').upsert(
      { user_id: user.id, market, symbol, name: name ?? null },
      { onConflict: 'user_id,market,symbol' }
    )
    fetchWatchlist()
    setSearchQuery('')
    setSearchResults([])
  }

  const handleRemoveWatchlist = async (id: string) => {
    if (!user) return
    await supabase.from('watchlist').delete().eq('id', id).eq('user_id', user.id)
    fetchWatchlist()
  }

  const handleSelectSymbol = useCallback(
    async (symbol: string) => {
      setSelectedSymbol(symbol)
      if (typeof window !== 'undefined') localStorage.setItem(LAST_SYMBOL_KEY, symbol)
      setLoadingDetail(true)
      setQuote(null)
      setCandles([])
      setCompany(null)
      const tf = chartTimeframe
      try {
        const [quoteRes, candlesRes, companyRes] = await Promise.all([
          fetch(`/api/trading/quote?symbol=${encodeURIComponent(symbol)}&market=REG`),
          fetch(`/api/trading/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=100`),
          fetch(`/api/trading/company?symbol=${encodeURIComponent(symbol)}`),
        ])
        const q = await quoteRes.json()
        const c = await candlesRes.json()
        const co = await companyRes.json()
        setQuote(q?.symbol ? q : null)
        setCandles(Array.isArray(c) ? c : [])
        setCompany(co?.symbol && !co?.error ? co : null)
      } catch {
        setQuote(null)
        setCandles([])
        setCompany(null)
      }
      setLoadingDetail(false)
    },
    [chartTimeframe]
  )

  const prevTfRef = useRef<ChartTf | null>(null)

  useEffect(() => {
    if (!user || watchlistLoading || watchlist.length === 0) return
    if (selectedSymbol) return
    const last = typeof window !== 'undefined' ? localStorage.getItem(LAST_SYMBOL_KEY) : null
    const toLoad = last && watchlist.some((w) => w.symbol === last) ? last : watchlist[0].symbol
    if (toLoad) handleSelectSymbol(toLoad)
  }, [user, watchlistLoading, watchlist, selectedSymbol, handleSelectSymbol])

  useEffect(() => {
    if (!selectedSymbol) return
    const prev = prevTfRef.current
    prevTfRef.current = chartTimeframe
    if (prev === null) return
    setLoadingDetail(true)
    fetch(`/api/trading/candles?symbol=${encodeURIComponent(selectedSymbol)}&tf=${chartTimeframe}&limit=100`)
      .then((r) => r.json())
      .then((c) => setCandles(Array.isArray(c) ? c : []))
      .catch(() => setCandles([]))
      .finally(() => setLoadingDetail(false))
  }, [chartTimeframe, selectedSymbol])

  const handleAddToPortfolio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !addSymbol.trim() || !addBuyPrice || !addQuantity) return
    const buyPrice = parseFloat(addBuyPrice)
    const qty = parseFloat(addQuantity)
    if (isNaN(buyPrice) || buyPrice <= 0 || isNaN(qty) || qty <= 0) return
    setAddSaving(true)
    const { error } = await supabase.from('portfolio').insert({
      user_id: user.id,
      market,
      symbol: addSymbol.trim().toUpperCase(),
      name: selectedSymbol === addSymbol ? (company?.name ?? null) : null,
      buy_price: buyPrice,
      quantity: qty,
    })
    setAddSaving(false)
    if (!error) {
      setAddPortfolioOpen(false)
      setAddSymbol('')
      setAddBuyPrice('')
      setAddQuantity('')
      fetchPortfolio()
    }
  }

  const handleRemovePortfolio = async (id: string) => {
    if (!user) return
    await supabase.from('portfolio').delete().eq('id', id).eq('user_id', user.id)
    fetchPortfolio()
  }

  useEffect(() => {
    if (portfolio.length === 0) {
      setQuotesMap({})
      return
    }
    const symbols = [...new Set(portfolio.map((p) => p.symbol))]
    let cancelled = false
    Promise.all(
      symbols.map((sym) =>
        fetch(`/api/trading/quote?symbol=${encodeURIComponent(sym)}`).then((r) => r.json())
      )
    ).then((results) => {
      if (cancelled) return
      const map: Record<string, Quote> = {}
      results.forEach((q) => {
        if (q?.symbol) map[q.symbol] = q
      })
      setQuotesMap(map)
    })
    return () => { cancelled = true }
  }, [portfolio])

  const portfolioWithQuote = useMemo(() => {
    return portfolio.map((p) => {
      const q = quotesMapMerged[p.symbol]
      const last = q?.last ?? null
      const value = last != null ? last * p.quantity : null
      const cost = p.buy_price * p.quantity
      const pnl = value != null ? value - cost : null
      const pnlPct = cost > 0 && pnl != null ? (pnl / cost) * 100 : null
      return { ...p, last, value, cost, pnl, pnlPct }
    })
  }, [portfolio, quotesMapMerged])

  const totalPnl = useMemo(() => {
    let totalCost = 0
    let totalPnl = 0
    portfolioWithQuote.forEach((p) => {
      totalCost += p.cost
      if (p.pnl != null) totalPnl += p.pnl
    })
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : null
    return { totalPnl, totalPnlPct, totalCost }
  }, [portfolioWithQuote])

  const watchlistWithQuotes = useMemo(() => {
    return watchlist.map((w) => {
      const q = quotesMapMerged[w.symbol]
      return {
        ...w,
        last: q?.last ?? null,
        change: q?.change ?? null,
        changePercent: q?.changePercent ?? null,
      }
    })
  }, [watchlist, quotesMapMerged])

  const liveQuote = selectedSymbol ? quotesMapMerged[selectedSymbol] ?? quote : quote

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Sign in to use Trading (watchlist & portfolio).</p>
        <Button asChild>
          <Link href="/login?next=/trading">Log in</Link>
        </Button>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">Back to home</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-50 shrink-0">
        <div className="max-w-full mx-auto px-3 py-2 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/uniProfit-logo.png" alt="UniProfit" width={160} height={48} className="h-10 w-auto" priority />
            <span className="text-muted-foreground text-xs hidden sm:inline">Trading</span>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            {wsConnected ? (
              <span className="hidden sm:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" title="Live">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title="Connecting…">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Offline
              </span>
            )}
            {selectedSymbol && (
              <span className="hidden md:inline text-sm font-semibold text-foreground truncate max-w-[120px]" title={selectedSymbol}>
                {selectedSymbol}
              </span>
            )}
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger className="w-[140px] sm:w-[160px] h-8 gap-1.5">
                {marketInfo?.logo ? (
                  <Image src={marketInfo.logo} alt="" width={20} height={20} className="rounded object-contain" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                    {market === 'PSX' ? 'PSX' : market.slice(0, 2)}
                  </span>
                )}
                <SelectValue>{marketInfo?.name ?? market}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MARKETS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="flex items-center gap-2">
                    {m.logo ? <Image src={m.logo} alt="" width={20} height={20} className="rounded object-contain" /> : <span className="w-5 h-5 flex items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">{m.id === 'PSX' ? 'PSX' : m.id.slice(0, 2)}</span>}
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 shrink-0" asChild>
              <Link href="/ecommerce" className="gap-1">
                <BarChart3 className="w-4 h-4" />
                E‑commerce
              </Link>
            </Button>
            {!user && (
              <Button variant="ghost" size="sm" className="h-8 gap-1" asChild>
                <Link href="/login?next=/trading"><LogIn className="w-4 h-4" /> Login</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 3-column terminal layout: Watchlist | Chart | Portfolio */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        <div className="hidden lg:grid lg:grid-cols-[280px_1fr_320px] w-full h-[calc(100vh-3.5rem)] max-w-[1920px] mx-auto">
          {/* LEFT: Watchlist */}
          <section className="border-r border-border bg-card/50 flex flex-col overflow-hidden shrink-0">
            <div className="shrink-0 px-2 py-2 border-b border-border flex items-center gap-1">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm flex-1 min-w-0"
              />
              {searching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
            </div>
            {searchResults.length > 0 && (
              <div className="shrink-0 border-b border-border max-h-32 overflow-auto">
                {searchResults.map((s) => (
                  <div key={s.symbol} className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/50">
                    <button type="button" className="text-left flex-1 text-sm font-medium truncate" onClick={() => handleSelectSymbol(s.symbol)}>{s.symbol}</button>
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => handleAddWatchlist(s.symbol, s.name)}>Add</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto min-h-0">
              {watchlistLoading ? (
                <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : watchlist.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">Search and add symbols.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {watchlistWithQuotes.map((w) => (
                    <div
                      key={w.id}
                      className={`flex items-center justify-between gap-1 px-2 py-2 hover:bg-muted/40 cursor-pointer group ${selectedSymbol === w.symbol ? 'bg-primary/10' : ''}`}
                      onClick={() => handleSelectSymbol(w.symbol)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{w.symbol}</div>
                        <div className="flex items-baseline gap-2 text-xs">
                          <span className="font-mono tabular-nums">{w.last != null ? w.last.toFixed(2) : '–'}</span>
                          {w.change != null && (
                            <span className={w.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                              {w.change >= 0 ? '+' : ''}{w.change.toFixed(2)} ({w.changePercent != null ? (w.changePercent >= 0 ? '+' : '') + w.changePercent.toFixed(2) + '%' : '–'})
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); handleRemoveWatchlist(w.id) }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* CENTER: Chart + Company */}
          <section className="border-r border-border bg-background flex flex-col overflow-hidden min-w-0">
            <div className="shrink-0 px-3 py-2 border-b border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-foreground truncate">{selectedSymbol || '—'}</span>
                {wsConnected && selectedSymbol && (
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                    <Radio className="w-3 h-3 animate-pulse" /> Live
                  </span>
                )}
                {liveQuote && (
                  <span className="text-lg font-bold tabular-nums">{liveQuote.last.toFixed(2)}</span>
                )}
                {liveQuote?.change != null && (
                  <span className={`text-sm tabular-nums ${liveQuote.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {liveQuote.change >= 0 ? '+' : ''}{liveQuote.change.toFixed(2)} ({liveQuote.changePercent != null ? (liveQuote.changePercent >= 0 ? '+' : '') + liveQuote.changePercent.toFixed(2) : ''}%)
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {CHART_TF_OPTIONS.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${chartTimeframe === tf ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border hover:bg-muted'}`}
                    onClick={() => setChartTimeframe(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              {loadingDetail ? (
                <div className="flex-1 flex items-center justify-center bg-muted/10">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : candles.length > 0 ? (
                <div className="flex-1 min-h-[280px] p-2">
                  <CandlestickChart data={candles} height={360} className="w-full h-full" />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-4">
                  <p className="text-sm text-muted-foreground text-center">Select a symbol from watchlist or add one to see the chart.</p>
                </div>
              )}
            </div>
            <Collapsible open={companyOpen} onOpenChange={setCompanyOpen} className="shrink-0 border-t border-border">
              <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between text-left text-sm font-medium hover:bg-muted/30">
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Company</span>
                <span className="text-muted-foreground">{companyOpen ? '▼' : '▶'}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 pt-1 text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                  {loadingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : company ? (
                    <>
                      <p className="font-medium text-foreground">{company.name}</p>
                      {company.sector && <p>Sector: {company.sector}</p>}
                      {company.industry && <p>Industry: {company.industry}</p>}
                      {company.description && <p className="line-clamp-2">{company.description}</p>}
                      {company.marketCap != null && <p>Market cap: {company.marketCap.toLocaleString()}</p>}
                      {(company.high52 != null || company.low52 != null) && <p>52W: {company.low52?.toFixed(2)} – {company.high52?.toFixed(2)}</p>}
                      {company.keyPeople && company.keyPeople.length > 0 && (
                        <p className="pt-1">Key people: {company.keyPeople.map((p) => `${p.name} (${p.position})`).join(', ')}</p>
                      )}
                    </>
                  ) : selectedSymbol ? <p>No company details.</p> : null}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>

          {/* RIGHT: Portfolio */}
          <section className="bg-card/50 flex flex-col overflow-hidden shrink-0">
            <div className="shrink-0 px-3 py-2 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground">Overall P&L</p>
              <p className={`text-xl font-bold tabular-nums ${totalPnl.totalPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {portfolio.length === 0 ? '—' : (
                  <>
                    {totalPnl.totalPnl >= 0 ? '+' : ''}{totalPnl.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {totalPnl.totalPnlPct != null && <span className="text-sm ml-1">({totalPnl.totalPnlPct >= 0 ? '+' : ''}{totalPnl.totalPnlPct.toFixed(2)}%)</span>}
                  </>
                )}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {portfolioLoading ? (
                <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : portfolio.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No positions. Add one below.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {portfolioWithQuote.map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-2 hover:bg-muted/40 cursor-pointer group flex flex-col gap-0.5"
                      onClick={() => handleSelectSymbol(p.symbol)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{p.symbol}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); handleRemovePortfolio(p.id) }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">Qty: {p.quantity.toLocaleString()} · Buy {p.buy_price.toFixed(2)}</div>
                      <div className={`text-sm font-semibold tabular-nums ${p.pnl != null ? (p.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400') : ''}`}>
                        {p.pnl != null ? `${p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)} (${p.pnlPct != null ? (p.pnlPct >= 0 ? '+' : '') + p.pnlPct.toFixed(1) + '%' : '–'})` : '–'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 p-2 border-t border-border">
              <Button className="w-full h-9" size="sm" onClick={() => setAddPortfolioOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add position
              </Button>
            </div>
          </section>
        </div>

        {/* Fallback: stacked layout for < lg */}
        <div className="flex-1 overflow-y-auto lg:hidden">
          <div className="max-w-2xl mx-auto p-4 space-y-4">
            {portfolio.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Overall P&L</p>
                <p className={`text-2xl font-bold tabular-nums ${totalPnl.totalPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {totalPnl.totalPnl >= 0 ? '+' : ''}{totalPnl.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {totalPnl.totalPnlPct != null && <span className="text-base ml-1">({totalPnl.totalPnlPct >= 0 ? '+' : ''}{totalPnl.totalPnlPct.toFixed(2)}%)</span>}
                </p>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold mb-2">Watchlist</h3>
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="mb-2 h-9" />
              {watchlistLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : watchlist.length === 0 ? <p className="text-sm text-muted-foreground">Add symbols from search.</p> : (
                <div className="space-y-1">
                  {watchlistWithQuotes.map((w) => (
                    <div key={w.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <button type="button" className="text-left font-medium" onClick={() => handleSelectSymbol(w.symbol)}>{w.symbol}</button>
                      <span className="text-sm tabular-nums">{w.last != null ? w.last.toFixed(2) : '–'}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveWatchlist(w.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold mb-2">Portfolio</h3>
              {portfolioLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : portfolio.length === 0 ? <p className="text-sm text-muted-foreground">No positions.</p> : (
                <div className="space-y-2">
                  {portfolioWithQuote.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <button type="button" className="font-medium" onClick={() => handleSelectSymbol(p.symbol)}>{p.symbol}</button>
                      <span className={`font-semibold tabular-nums ${p.pnl != null ? (p.pnl >= 0 ? 'text-emerald-600' : 'text-red-600') : ''}`}>
                        {p.pnl != null ? `${p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}` : '–'}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemovePortfolio(p.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
              <Button className="w-full mt-2" size="sm" onClick={() => setAddPortfolioOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add position</Button>
            </div>
            {selectedSymbol && (
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold mb-2">{selectedSymbol} {liveQuote && <span className="text-lg font-bold">{liveQuote.last.toFixed(2)}</span>}</h3>
                {candles.length > 0 ? <CandlestickChart data={candles} height={300} className="w-full" /> : loadingDetail ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : <p className="text-sm text-muted-foreground">No chart data.</p>}
                {company && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{company.name}</p>
                    {company.sector && <p>Sector: {company.sector}</p>}
                    {company.description && <p className="line-clamp-2">{company.description}</p>}
                    {company.marketCap != null && <p>Market cap: {company.marketCap.toLocaleString()}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add to portfolio dialog (inline form) */}
      {addPortfolioOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add position</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAddPortfolioOpen(false)}>Cancel</Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddToPortfolio} className="space-y-4">
                <div>
                  <Label>Symbol</Label>
                  <Input
                    value={addSymbol}
                    onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. MTL"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Buy price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addBuyPrice}
                    onChange={(e) => setAddBuyPrice(e.target.value)}
                    placeholder="0.00"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(e.target.value)}
                    placeholder="0"
                    required
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={addSaving} className="w-full gap-2">
                  {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add to portfolio
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
