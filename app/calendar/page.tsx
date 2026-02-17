'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { TrendingUp, Calendar as CalendarIcon, Loader2, FolderOpen } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format-currency'

type PlanRow = {
  id: string
  scenario_id: string
  start_date: string
  end_date: string
  net_profit: number
  profit_margin: number
  scenario_name?: string
}

const PROFIT_MARGIN_LOW = 5 // below this = orange (low/no profit)

function getDayStatus(plans: PlanRow[], day: Date): 'profit' | 'loss' | 'low' | null {
  const dayStr = format(day, 'yyyy-MM-dd')
  const onDay = plans.filter(
    (p) => dayStr >= p.start_date && dayStr <= p.end_date
  )
  if (onDay.length === 0) return null
  const sumProfit = onDay.reduce((s, p) => s + Number(p.net_profit), 0)
  const sumMargin = onDay.reduce((s, p) => s + Number(p.profit_margin), 0) / onDay.length
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
              prev.map((p) => ({ ...p, scenario_name: nameMap.get(p.scenario_id) ?? 'Scenario' }))
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

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Sign in to view your plan calendar.</p>
        <Button asChild>
          <Link href="/login?next=/calendar">Log in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground truncate">Uniprofit</h1>
                <p className="text-muted-foreground text-sm truncate">Plan calendar</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/" className="gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Calculator
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Your plans
          </h2>
        </div>

        <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-green-500/80" /> Profit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-500/80" /> Loss
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-amber-500/80" /> Low / no profit
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading plans…
          </div>
        ) : (
          <>
            <Card className="p-4 mb-6">
              <Calendar
                mode="single"
                month={month}
                onMonthChange={setMonth}
                selected={selectedDay ?? undefined}
                onSelect={setSelectedDay}
                modifiers={{
                  profit: profitDays,
                  loss: lossDays,
                  low: lowDays,
                }}
                modifiersClassNames={{
                  profit: 'bg-green-500/80 text-white hover:bg-green-600 hover:text-white font-medium',
                  loss: 'bg-red-500/80 text-white hover:bg-red-600 hover:text-white font-medium',
                  low: 'bg-amber-500/80 text-foreground hover:bg-amber-600 hover:text-white font-medium',
                }}
              />
            </Card>

            {selectedDay && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Plans on {format(selectedDay, 'EEEE, MMM d, yyyy')}
                </h3>
                {plansOnSelectedDay.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No plans on this day.</p>
                ) : (
                  <ul className="space-y-3">
                    {plansOnSelectedDay.map((p) => {
                      const isProfit = Number(p.net_profit) > 0
                      const isLoss = Number(p.net_profit) < 0
                      return (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50 border border-border"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {p.scenario_name ?? 'Scenario'}
                            </p>
                            <p
                              className={`text-sm ${
                                isProfit
                                  ? 'text-green-600 dark:text-green-400'
                                  : isLoss
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                  }`}
                            >
                              {formatMoney(Number(p.net_profit), currency)} net · {Number(p.profit_margin).toFixed(1)}% margin
                            </p>
                          </div>
                          <Button size="sm" asChild>
                            <Link href={`/?load=${p.scenario_id}`}>Load</Link>
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
