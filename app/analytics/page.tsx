'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { format, parseISO, startOfMonth } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts'
import { BarChart3, TrendingUp, TrendingDown, Calendar as CalendarIcon, Loader2, Lightbulb, FolderOpen } from 'lucide-react'
import { AffiliateCard } from '@/components/affiliate-card'
import { AdBanner } from '@/components/ad-banner'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { formatMoney } from '@/lib/format-currency'

type PlanRow = {
  id: string
  scenario_id: string
  start_date: string
  end_date: string
  net_profit: number
  profit_margin: number
  scenario_name?: string
  scenario_period?: string
  scenario_skus?: unknown
}

const chartConfig = {
  netProfit: { label: 'Net profit', color: 'hsl(var(--chart-1))' },
  profit: { label: 'Profit', color: 'hsl(142, 76%, 36%)' },
  loss: { label: 'Loss', color: 'hsl(0, 84%, 60%)' },
}

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setCurrency(typeof window !== 'undefined' ? localStorage.getItem('uniprofit_currency') || 'USD' : 'USD')
  }, [])

  useEffect(() => {
    if (!user) {
      setPlans([])
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('plans')
      .select('id, scenario_id, start_date, end_date, net_profit, profit_margin')
      .order('start_date', { ascending: true })
      .then(({ data: plansData }) => {
        const list = (plansData ?? []) as PlanRow[]
        if (list.length === 0) {
          setPlans([])
          setLoading(false)
          return
        }
        const scenarioIds = [...new Set(list.map((p) => p.scenario_id))]
        supabase
          .from('scenarios')
          .select('id, name, period, skus')
          .in('id', scenarioIds)
          .then(({ data: scenariosData }) => {
            const map = new Map(
              (scenariosData ?? []).map((s: { id: string; name: string; period?: string; skus?: unknown }) => [
                s.id,
                { name: s.name, period: s.period ?? '', skus: s.skus },
              ])
            )
            setPlans(
              list.map((p) => {
                const s = map.get(p.scenario_id)
                return {
                  ...p,
                  scenario_name: s?.name ?? 'Scenario',
                  scenario_period: s?.period ?? '',
                  scenario_skus: s?.skus,
                }
              })
            )
          })
          .finally(() => setLoading(false))
      })
      .catch(() => setLoading(false))
  }, [user])

  const { monthWiseData, totals, planIdsSignature } = useMemo(() => {
    const byMonth = new Map<string, { netProfit: number; marginSum: number; count: number }>()
    let totalProfit = 0
    let totalLoss = 0
    const ids: string[] = []
    plans.forEach((p) => {
      ids.push(p.id)
      const n = Number(p.net_profit)
      const m = Number(p.profit_margin)
      if (n >= 0) totalProfit += n
      else totalLoss += Math.abs(n)
      const monthKey = format(startOfMonth(parseISO(p.start_date)), 'yyyy-MM')
      const cur = byMonth.get(monthKey) ?? { netProfit: 0, marginSum: 0, count: 0 }
      byMonth.set(monthKey, { netProfit: cur.netProfit + n, marginSum: cur.marginSum + m, count: cur.count + 1 })
    })
    const monthWise = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month: format(parseISO(month + '-01'), 'MMM yyyy'),
        netProfit: v.netProfit,
        margin: v.count > 0 ? v.marginSum / v.count : 0,
        count: v.count,
      }))
    return {
      monthWiseData: monthWise,
      totals: { totalProfit, totalLoss, planCount: plans.length },
      planIdsSignature: [...ids].sort().join(','),
    }
  }, [plans])

  const summaryText = useMemo(() => {
    const lines: string[] = []
    if (monthWiseData.length) {
      lines.push('Month-wise net profit:')
      monthWiseData.forEach((m) => lines.push(`  ${m.month}: ${m.netProfit.toFixed(2)} (${m.count} plan(s))`))
    }
    if (plans.length) {
      lines.push('\nPlans (scenario, period, dates, net profit, margin):')
      plans.slice(0, 30).forEach((p) => {
        lines.push(
          `  ${p.scenario_name} (${p.scenario_period}): ${p.start_date} to ${p.end_date}, net ${Number(p.net_profit).toFixed(2)}, margin ${Number(p.profit_margin).toFixed(1)}%`
        )
      })
      if (plans.length > 30) lines.push(`  ... and ${plans.length - 30} more plans`)
    }
    return lines.join('\n') || 'No calendar plans yet.'
  }, [plans, monthWiseData])

  useEffect(() => {
    if (!user || plans.length === 0 || !planIdsSignature) {
      setSuggestions(null)
      setSuggestionsError(null)
      return
    }
    let cancelled = false
    supabase
      .from('analytics_suggestions_cache')
      .select('plan_ids_signature, suggestions')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data: cache }) => {
        if (cancelled) return
        if (cache?.plan_ids_signature === planIdsSignature && Array.isArray(cache.suggestions)) {
          setSuggestions(cache.suggestions as string[])
          setSuggestionsError(null)
          return
        }
        setSuggestionsLoading(true)
        setSuggestionsError(null)
        fetch('/api/analytics-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            summaryText,
            monthWise: monthWiseData,
            scenarioWise: plans.map((p) => ({
              name: p.scenario_name,
              period: p.scenario_period,
              start: p.start_date,
              end: p.end_date,
              netProfit: Number(p.net_profit),
              margin: Number(p.profit_margin),
            })),
          }),
        })
          .then((res) => {
            if (cancelled) return
            if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || res.statusText)))
            return res.json()
          })
          .then((data: { suggestions: string[] }) => {
            if (cancelled) return
            const list = data.suggestions || []
            setSuggestions(list)
            supabase
              .from('analytics_suggestions_cache')
              .upsert(
                { user_id: user.id, plan_ids_signature: planIdsSignature, suggestions: list },
                { onConflict: 'user_id' }
              )
              .then(() => {})
          })
          .catch((err) => {
            if (!cancelled) {
              setSuggestionsError(err.message || 'Failed to load suggestions.')
              setSuggestions([])
            }
          })
          .finally(() => {
            if (!cancelled) setSuggestionsLoading(false)
          })
      })
    return () => {
      cancelled = true
    }
  }, [user, planIdsSignature, summaryText, monthWiseData, plans])

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Sign in to view analytics.</p>
        <Button asChild>
          <Link href="/login?next=/analytics">Log in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="w-full max-w-6xl mx-auto pl-3 pr-4 sm:pl-4 py-4">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <Link href="/ecommerce" className="flex flex-col gap-1 min-w-0 shrink-0">
              <Image
                src="/uniProfit-logo.png"
                alt="UniProfit"
                width={200}
                height={60}
                className="h-12 sm:h-14 w-auto object-contain"
                priority
              />
              <span className="text-muted-foreground text-xs sm:text-sm">Analytics</span>
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/ecommerce" className="gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Calculator
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/calendar" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Calendar
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Analytics</h1>
        <p className="text-muted-foreground text-sm mb-8">Insights from your saved calendar plans.</p>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading your plans…</p>
          </div>
        ) : plans.length === 0 ? (
          <Card className="p-10 text-center border-border max-w-md mx-auto">
            <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
              <BarChart3 className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No data yet</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Save scenarios from the calculator and add them to the calendar. Your analytics and AI insights will appear here.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button asChild>
                <Link href="/ecommerce">Go to Calculator</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/calendar">View Calendar</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-5 border-border bg-card overflow-hidden transition-all hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-500/10 p-2.5">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total profit</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatMoney(totals.totalProfit, currency)}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-5 border-border bg-card overflow-hidden transition-all hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-500/10 p-2.5">
                    <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total loss</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">
                      {formatMoney(totals.totalLoss, currency)}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-5 border-border bg-card overflow-hidden transition-all hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Plans</p>
                    <p className="text-xl font-bold text-foreground">{totals.planCount}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Affiliate: accounting partner — shown after KPI cards, before charts */}
            <AffiliateCard variant="accounting" />

            {/* Profit by month - Area chart */}
            {monthWiseData.length > 0 && (
              <Card className="p-6 border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">Profit by month</h2>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <AreaChart
                    data={monthWiseData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-netProfit)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--color-netProfit)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => formatMoney(v, currency)} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" formatter={(v) => formatMoney(Number(v), currency)} />} />
                    <Area
                      type="monotone"
                      dataKey="netProfit"
                      stroke="var(--color-netProfit)"
                      fill="url(#fillNet)"
                      strokeWidth={2}
                      isAnimationActive
                      animationDuration={800}
                    />
                  </AreaChart>
                </ChartContainer>
              </Card>
            )}

            {/* Bar chart by month */}
            {monthWiseData.length > 0 && (
              <Card className="p-6 border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">Net profit by month</h2>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <BarChart data={monthWiseData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => formatMoney(v, currency)} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatMoney(Number(v), currency)} />} />
                    <Bar dataKey="netProfit" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600}>
                      {monthWiseData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.netProfit >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </Card>
            )}

            {/* Profit margin trend */}
            {monthWiseData.length > 1 && (
              <Card className="p-6 border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">Profit margin trend</h2>
                <ChartContainer config={{ ...chartConfig, margin: { label: 'Margin', color: 'hsl(var(--primary))' } }} className="h-[280px] w-full">
                  <LineChart data={monthWiseData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${Number(v).toFixed(1)}%`} />} />
                    <Line type="monotone" dataKey="margin" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive animationDuration={800} />
                  </LineChart>
                </ChartContainer>
              </Card>
            )}

            {/* AdSense between charts and AI insights */}
            <AdBanner
              slotId={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ANALYTICS || ''}
              className="max-w-2xl mx-auto"
            />

            {/* AI suggestions */}
            <Card className="p-6 border-border">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Insights from your calendar
              </h2>
              {suggestionsLoading && (
                <div className="flex items-center gap-2 text-muted-foreground py-6">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating insights…</span>
                </div>
              )}
              {suggestionsError && !suggestionsLoading && (
                <p className="text-destructive text-sm py-2">{suggestionsError}</p>
              )}
              {!suggestionsLoading && !suggestionsError && suggestions && suggestions.length > 0 && (
                <ul className="space-y-3 list-none p-0 m-0">
                  {suggestions.map((s, i) => {
                    const text = typeof s === 'string' ? s.trim() : String(s).trim()
                    if (!text) return null
                    return (
                      <li key={i} className="flex gap-3 text-foreground">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                          {i + 1}
                        </span>
                        <p className="text-[15px] leading-relaxed pt-0.5">{text}</p>
                      </li>
                    )
                  })}
                </ul>
              )}
              {!suggestionsLoading && !suggestionsError && suggestions && suggestions.length === 0 && (
                <p className="text-muted-foreground text-sm py-2">No insights to show yet. Add more plans to your calendar and return to refresh.</p>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
