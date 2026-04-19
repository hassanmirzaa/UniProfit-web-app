'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday } from 'date-fns'
import { Calendar as CalendarIcon, Loader2, FolderOpen, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format-currency'
import { track } from '@/lib/analytics'
import { AffiliateCard } from '@/components/affiliate-card'

type PlanRow = {
  id: string
  scenario_id: string
  start_date: string
  end_date: string
  net_profit: number
  profit_margin: number
  scenario_name?: string
}

function getDayStatus(plans: PlanRow[], day: Date): 'profit' | 'loss' | 'low' | null {
  const dayStr = format(day, 'yyyy-MM-dd')
  const onDay = plans.filter(
    (p) => dayStr >= p.start_date && dayStr <= p.end_date
  )
  if (onDay.length === 0) return null
  const sumProfit = onDay.reduce((s, p) => s + Number(p.net_profit), 0)
  if (sumProfit > 0) return 'profit'
  if (sumProfit < 0) return 'loss'
  return 'low'
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth()
  const [month, setMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
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
      .order('start_date', { ascending: false })
      .then(({ data: plansData }) => {
        const list = (plansData ?? []) as PlanRow[]
        setPlans(list)
        const scenarioIds = [...new Set(list.map((p) => p.scenario_id))]
        if (scenarioIds.length === 0) {
          setLoading(false)
          return
        }
        supabase
          .from('scenarios')
          .select('id, name')
          .in('id', scenarioIds)
          .then(({ data: scenariosData }) => {
            const nameMap = new Map(
              (scenariosData ?? []).map((s: { id: string; name: string }) => [s.id, s.name])
            )
            setPlans((prev) =>
              prev.map((p) => ({ ...p, scenario_name: nameMap.get(p.scenario_id) ?? 'Plan' }))
            )
          })
          .finally(() => setLoading(false))
      })
      .catch(() => setLoading(false))
  }, [user])

  const { profitDays, lossDays, lowDays } = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const days = eachDayOfInterval({ start, end })
    const profit: Date[] = []
    const loss: Date[] = []
    const low: Date[] = []
    days.forEach((day) => {
      const status = getDayStatus(plans, day)
      if (status === 'profit') profit.push(day)
      else if (status === 'loss') loss.push(day)
      else if (status === 'low') low.push(day)
    })
    return { profitDays: profit, lossDays: loss, lowDays: low }
  }, [month, plans])

  const plansOnSelectedDay = useMemo(() => {
    if (!selectedDay) return []
    const dayStr = format(selectedDay, 'yyyy-MM-dd')
    return plans.filter((p) => dayStr >= p.start_date && dayStr <= p.end_date)
  }, [selectedDay, plans])

  const goToPrevMonth = () => setMonth((m) => subMonths(m, 1))
  const goToNextMonth = () => setMonth((m) => addMonths(m, 1))
  const goToToday = () => {
    const today = new Date()
    setMonth(today)
    setSelectedDay(today)
  }

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-semibold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Sign in to view your plans and track business performance over time.
          </p>
        </div>
        <Button asChild>
          <Link href="/login?next=/calendar">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <Link href="/ecommerce" className="flex flex-col gap-0.5 min-w-0 shrink-0">
              <Image
                src="/uniProfit-logo.png"
                alt="UniProfit"
                width={240}
                height={72}
                className="h-14 sm:h-16 w-auto shrink-0 object-contain"
                priority
              />
              <span className="text-muted-foreground text-xs sm:text-sm">Calendar</span>
            </Link>
            <nav className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/analytics" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/ecommerce" className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Calculator
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Your plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plans recorded from the calculator. Select a day to see details.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-3 rounded-xl bg-muted/40 border border-border">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legend</span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full bg-green-500 shadow-sm" aria-hidden />
              <span className="text-foreground">Profit</span>
            </span>
            <span className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full bg-red-500 shadow-sm" aria-hidden />
              <span className="text-foreground">Loss</span>
            </span>
            <span className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm" aria-hidden />
              <span className="text-foreground">Low / break-even</span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading your plans…</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Month navigation + calendar */}
            <Card className="overflow-hidden border border-border rounded-2xl shadow-sm">
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-muted/30">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={goToPrevMonth}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="text-base font-semibold text-foreground tabular-nums">
                  {format(month, 'MMMM yyyy')}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={goToNextMonth}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 border-b border-border/50 bg-muted/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={goToToday}
                >
                  Today
                </Button>
              </div>
              <div className="p-4 sm:p-6">
                <Calendar
                  mode="single"
                  month={month}
                  onMonthChange={setMonth}
                  selected={selectedDay ?? undefined}
                  onSelect={setSelectedDay}
                  classNames={{
                    months: 'w-full',
                    month: 'w-full',
                    month_caption: 'hidden',
                    nav: 'hidden',
                    table: 'w-full border-collapse',
                    head_cell: 'text-muted-foreground rounded-md w-10 sm:w-12 font-medium text-xs uppercase tracking-wider p-1',
                    cell: 'h-10 w-10 sm:h-12 sm:w-12 text-center text-sm p-0.5 relative',
                    day: 'h-10 w-10 sm:h-12 sm:w-12 p-0 font-medium rounded-lg text-base transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    day_button: 'h-full w-full rounded-lg',
                    selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                    today: 'ring-2 ring-primary/50 font-semibold',
                    outside: 'text-muted-foreground/50',
                    disabled: 'opacity-40',
                    hidden: 'invisible',
                  }}
                  modifiers={{
                    profit: profitDays,
                    loss: lossDays,
                    low: lowDays,
                  }}
                  modifiersClassNames={{
                    profit: '!bg-green-500 text-white hover:!bg-green-600 hover:!text-white focus:!ring-green-500',
                    loss: '!bg-red-500 text-white hover:!bg-red-600 hover:!text-white focus:!ring-red-500',
                    low: '!bg-amber-500 text-white hover:!bg-amber-600 hover:!text-white focus:!ring-amber-500',
                  }}
                />
              </div>
            </Card>

            {/* Selected day detail */}
            {!selectedDay && plans.length > 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                Click a day on the calendar to view plans for that date.
              </p>
            )}

            {selectedDay && (
              <Card className="border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <h2 className="text-lg font-semibold text-foreground">
                    {format(selectedDay, 'EEEE, MMMM d, yyyy')}
                  </h2>
                  {isToday(selectedDay) && (
                    <span className="text-xs font-medium text-primary mt-0.5 inline-block">Today</span>
                  )}
                </div>
                <div className="p-4 sm:p-6">
                  {plansOnSelectedDay.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No plans recorded for this day.</p>
                  ) : (
                    <ul className="space-y-3">
                      {plansOnSelectedDay.map((p) => {
                        const isProfit = Number(p.net_profit) > 0
                        const isLoss = Number(p.net_profit) < 0
                        return (
                          <li
                            key={p.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">
                                {p.scenario_name ?? 'Plan'}
                              </p>
                              <p
                                className={`text-sm font-medium mt-0.5 ${
                                  isProfit
                                    ? 'text-green-600 dark:text-green-400'
                                    : isLoss
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {formatMoney(Number(p.net_profit), currency)} net profit
                                <span className="text-muted-foreground font-normal">
                                  {' '}· {Number(p.profit_margin).toFixed(1)}% margin
                                </span>
                              </p>
                            </div>
                            <Button size="sm" className="shrink-0 w-full sm:w-auto" asChild>
                              <Link href={`/ecommerce?load=${p.scenario_id}`} onClick={() => track('calendar', 'Open in calculator', { scenario_id: p.scenario_id })}>Open in calculator</Link>
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </Card>
            )}

            {!loading && plans.length === 0 && (
              <Card className="border border-dashed border-border rounded-2xl p-10 text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No plans yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Use the calculator to run a profit analysis, then record the result on the calendar to see it here.
                </p>
                <Button asChild>
                  <Link href="/ecommerce">Go to calculator</Link>
                </Button>
              </Card>
              {/* Affiliate: shown on empty state only — high-intent moment */}
              <AffiliateCard variant="daraz" className="max-w-md mx-auto mt-4" />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
