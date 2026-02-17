'use client'

import { useState, useMemo, useEffect, useId, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { TrendingUp, Moon, Sun, LogIn, Plus, Trash2, Lightbulb, Loader2, LogOut, User, Save, Download, Printer, FolderOpen, Calendar as CalendarIcon } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, getCurrencySymbol, CURRENCY_OPTIONS } from '@/lib/format-currency'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addDays, endOfMonth, endOfYear } from 'date-fns'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Period = 'weekly' | 'monthly' | 'yearly'

interface SkuRow {
  id: string
  name: string
  cost: string
  dc: string
  packaging: string   // packaging cost per unit
  sellPrice: string
  unitsSold: string
  returnPercent: string  // return rate e.g. 5 for 5%
  recoveryOnReturn: boolean  // if true, on return only lose dc+packaging; if false, lose cost+dc+packaging
}

interface CompanyCosts {
  rent: string
  salaries: string
  marketing: string
  toolsSoftware: string
  otherFixed: string
}

interface SkuMetrics {
  name: string
  revenue: number
  variableCost: number
  contribution: number
  unitsSold: number
}

interface CompanyMetrics {
  totalRevenue: number
  totalVariableCost: number
  totalFixedCost: number
  totalCost: number
  netProfit: number
  profitMargin: number
  contributionMarginRatio: number
  breakEvenRevenue: number
  healthStatus: 'strong' | 'moderate' | 'risk'
  skuBreakdown: SkuMetrics[]
}

const periodLabels: Record<Period, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDark = (resolvedTheme ?? theme) === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

function createEmptySku(id: string): SkuRow {
  return {
    id,
    name: '',
    cost: '',
    dc: '',
    packaging: '',
    sellPrice: '',
    unitsSold: '',
    returnPercent: '',
    recoveryOnReturn: false,
  }
}

const PENDING_CALC_KEY = 'uniprofit_pending_calculation'

type PendingCalculation = {
  period: Period
  skus: SkuRow[]
  companyCosts: CompanyCosts
}

let skuCounter = 0
function nextSkuId() {
  return `sku-${++skuCounter}-${Date.now()}`
}

export default function BusinessBrainPlanner() {
  const { user, loading: authLoading, signOut } = useAuth()
  const stableId = useId().replace(/:/g, '')
  const [period, setPeriod] = useState<Period>('monthly')
  const [skus, setSkus] = useState<SkuRow[]>(() => [createEmptySku(`sku-${stableId}`)])
  const [companyCosts, setCompanyCosts] = useState<CompanyCosts>({
    rent: '',
    salaries: '',
    marketing: '',
    toolsSoftware: '',
    otherFixed: '',
  })
  const [analyzed, setAnalyzed] = useState(false)
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [sessionExpired, setSessionExpired] = useState(false)
  const [currency, setCurrency] = useState<string>(() => {
    if (typeof window === 'undefined') return 'USD'
    return localStorage.getItem('uniprofit_currency') || 'USD'
  })
  const [compactView, setCompactView] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('uniprofit_compact') === '1'
  })
  const [scenarios, setScenarios] = useState<{ id: string; name: string; created_at: string }[]>([])
  const [scenariosLoading, setScenariosLoading] = useState(false)
  const [scenarioSelectKey, setScenarioSelectKey] = useState(0)
  const [addToCalendarOpen, setAddToCalendarOpen] = useState(false)
  const [addToCalendarScenarioId, setAddToCalendarScenarioId] = useState<string | null>(null)
  const [addToCalendarScenarioName, setAddToCalendarScenarioName] = useState<string | null>(null)
  const [planStartDate, setPlanStartDate] = useState('')
  const [addToCalendarLoading, setAddToCalendarLoading] = useState(false)
  const [addToCalendarError, setAddToCalendarError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const addSku = () => {
    setSkus(prev => [...prev, createEmptySku(nextSkuId())])
    setAnalyzed(false)
  }

  const removeSku = (id: string) => {
    if (skus.length <= 1) return
    setSkus(prev => prev.filter(s => s.id !== id))
    setAnalyzed(false)
  }

  const updateSku = (id: string, field: keyof SkuRow, value: string) => {
    setSkus(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
    setAnalyzed(false)
  }

  const toggleRecoveryOnReturn = (id: string) => {
    setSkus(prev => prev.map(s => s.id === id ? { ...s, recoveryOnReturn: !s.recoveryOnReturn } : s))
    setAnalyzed(false)
  }

  const setCompanyCost = (field: keyof CompanyCosts, value: string) => {
    setCompanyCosts(prev => ({ ...prev, [field]: value }))
    setAnalyzed(false)
  }

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('uniprofit_currency', currency)
  }, [currency])
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('uniprofit_compact', compactView ? '1' : '0')
  }, [compactView])

  function runValidation(): string[] {
    const errs: string[] = []
    skus.forEach((s, i) => {
      const name = s.name.trim() || `Product ${i + 1}`
      const sell = parseFloat(s.sellPrice) || 0
      const cost = parseFloat(s.cost) || 0
      const units = parseFloat(s.unitsSold) || 0
      if (s.name.trim() && (sell > 0 || cost > 0 || units > 0)) {
        if (units <= 0) errs.push(`Enter units sold for ${name}.`)
        if (sell > 0 && cost > sell) errs.push(`Sell price should be above cost for ${name}.`)
      }
    })
    return errs
  }

  function fetchScenarios() {
    if (!user) return
    setScenariosLoading(true)
    supabase
      .from('scenarios')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => setScenarios(data ?? []))
      .finally(() => setScenariosLoading(false))
  }
  useEffect(() => {
    if (user) fetchScenarios()
    else setScenarios([])
  }, [user])

  const loadId = searchParams.get('load')
  useEffect(() => {
    if (!loadId || !user) return
    let cancelled = false
    supabase
      .from('scenarios')
      .select('period, skus, company_costs')
      .eq('id', loadId)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error || !data) {
          router.replace('/', { scroll: false })
          return
        }
        setPeriod((data.period as Period) ?? period)
        setSkus(Array.isArray(data.skus) ? data.skus : skus)
        if (data.company_costs && typeof data.company_costs === 'object') {
          setCompanyCosts((prev) => ({ ...prev, ...data.company_costs }))
        }
        setAnalyzed(false)
        setScenarioSelectKey((k) => k + 1)
        router.replace('/', { scroll: false })
      })
    return () => { cancelled = true }
  }, [loadId, user])

  const handleSaveScenario = async () => {
    if (!user) return
    const name = window.prompt('Name this scenario (e.g. February plan)')
    if (!name?.trim()) return
    const { data: inserted, error } = await supabase
      .from('scenarios')
      .insert({
        user_id: user.id,
        name: name.trim(),
        period,
        skus,
        company_costs: companyCosts,
      })
      .select('id')
      .single()
    if (error) {
      if (/auth|session|JWT|expired|unauthorized/i.test(error.message)) setSessionExpired(true)
      setSuggestionsError(error.message)
      return
    }
    fetchScenarios()
    if (inserted?.id && metrics != null) {
      setAddToCalendarScenarioId(inserted.id)
      setAddToCalendarScenarioName(name.trim())
      const today = new Date()
      setPlanStartDate(today.toISOString().slice(0, 10))
      setAddToCalendarOpen(true)
    }
  }

  const planEndDate = useMemo(() => {
    if (!planStartDate) return ''
    const start = new Date(planStartDate + 'T12:00:00')
    if (isNaN(start.getTime())) return planStartDate
    if (period === 'weekly') return addDays(start, 6).toISOString().slice(0, 10)
    if (period === 'monthly') return endOfMonth(start).toISOString().slice(0, 10)
    if (period === 'yearly') return endOfYear(start).toISOString().slice(0, 10)
    return planStartDate
  }, [planStartDate, period])

  const handleAddToCalendar = async () => {
    if (!user || !addToCalendarScenarioId || !planStartDate) return
    setAddToCalendarError(null)
    setAddToCalendarLoading(true)
    const start = planStartDate
    const end = planEndDate || planStartDate
    const netProfit = metrics?.netProfit ?? 0
    const profitMargin = metrics?.profitMargin ?? 0
    const { error } = await supabase.from('plans').insert({
      user_id: user.id,
      scenario_id: addToCalendarScenarioId,
      start_date: start,
      end_date: end,
      net_profit: netProfit,
      profit_margin: profitMargin,
    })
    setAddToCalendarLoading(false)
    if (error) {
      setAddToCalendarError(error.message)
      return
    }
    setAddToCalendarOpen(false)
    setAddToCalendarScenarioId(null)
    setAddToCalendarScenarioName(null)
  }

  const handleSkipAddToCalendar = () => {
    setAddToCalendarOpen(false)
    setAddToCalendarScenarioId(null)
    setAddToCalendarScenarioName(null)
    setAddToCalendarError(null)
  }

  const handleLoadScenario = async (id: string) => {
    if (!id || id === '_none') return
    const { data, error } = await supabase.from('scenarios').select('period, skus, company_costs').eq('id', id).single()
    if (error || !data) return
    setPeriod((data.period as Period) ?? period)
    setSkus(Array.isArray(data.skus) ? data.skus : skus)
    if (data.company_costs && typeof data.company_costs === 'object') setCompanyCosts({ ...companyCosts, ...data.company_costs })
    setAnalyzed(false)
    setScenarioSelectKey((k) => k + 1)
  }

  const metrics = useMemo<CompanyMetrics | null>(() => {
    if (!analyzed) return null

    let totalRevenue = 0
    let totalVariableCost = 0
    const skuBreakdown: SkuMetrics[] = []

    for (const sku of skus) {
      const sellPrice = parseFloat(sku.sellPrice) || 0
      const cost = parseFloat(sku.cost) || 0
      const dc = parseFloat(sku.dc) || 0
      const packaging = parseFloat(sku.packaging) || 0
      const units = parseFloat(sku.unitsSold) || 0
      const returnRate = (parseFloat(sku.returnPercent) || 0) / 100
      const unitsReturned = units * returnRate
      const netUnits = units - unitsReturned
      const recovery = sku.recoveryOnReturn

      const revenue = sellPrice * netUnits
      const costPerUnit = cost + dc + packaging
      const variableCostSold = costPerUnit * netUnits
      const variableCostReturns = recovery
        ? (dc + packaging) * unitsReturned
        : costPerUnit * unitsReturned
      const variableCost = variableCostSold + variableCostReturns
      const contribution = revenue - variableCost

      totalRevenue += revenue
      totalVariableCost += variableCost
      skuBreakdown.push({
        name: sku.name || `Product ${sku.id}`,
        revenue,
        variableCost,
        contribution,
        unitsSold: netUnits,
      })
    }

    const totalFixedCost =
      (parseFloat(companyCosts.rent) || 0) +
      (parseFloat(companyCosts.salaries) || 0) +
      (parseFloat(companyCosts.marketing) || 0) +
      (parseFloat(companyCosts.toolsSoftware) || 0) +
      (parseFloat(companyCosts.otherFixed) || 0)
    const totalCost = totalVariableCost + totalFixedCost
    const netProfit = totalRevenue - totalCost
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const contributionMarginRatio = totalRevenue > 0 ? (totalRevenue - totalVariableCost) / totalRevenue : 0
    const breakEvenRevenue = contributionMarginRatio > 0 ? totalFixedCost / contributionMarginRatio : 0
    const healthStatus = profitMargin > 25 ? 'strong' : profitMargin >= 10 ? 'moderate' : 'risk'

    return {
      totalRevenue,
      totalVariableCost,
      totalFixedCost,
      totalCost,
      netProfit,
      profitMargin,
      contributionMarginRatio,
      breakEvenRevenue,
      healthStatus,
      skuBreakdown,
    }
  }, [analyzed, skus, companyCosts])

  const canAnalyze = skus.some(
    s =>
      s.name.trim() !== '' &&
      (parseFloat(s.cost) || 0) >= 0 &&
      (parseFloat(s.sellPrice) || 0) >= 0 &&
      (parseFloat(s.unitsSold) || 0) > 0
  )

  const pendingRestoredRef = useRef(false)

  const handleAnalyze = () => {
    const errs = runValidation()
    setValidationErrors(errs)
    if (errs.length > 0) return
    if (!canAnalyze) return
    if (!user) {
      try {
        const pending: PendingCalculation = { period, skus, companyCosts }
        sessionStorage.setItem(PENDING_CALC_KEY, JSON.stringify(pending))
      } catch {
        /* ignore */
      }
      window.location.href = '/login?next=' + encodeURIComponent('/')
      return
    }
    setAnalyzed(true)
  }

  useEffect(() => {
    if (user) setSessionExpired(false)
  }, [user])

  // After login, restore saved form and run calculation once
  useEffect(() => {
    if (authLoading || !user || pendingRestoredRef.current) return
    try {
      const raw = sessionStorage.getItem(PENDING_CALC_KEY)
      if (!raw) return
      const pending = JSON.parse(raw) as PendingCalculation
      sessionStorage.removeItem(PENDING_CALC_KEY)
      pendingRestoredRef.current = true
      if (pending.period) setPeriod(pending.period)
      if (pending.skus?.length) setSkus(pending.skus)
      if (pending.companyCosts) setCompanyCosts(pending.companyCosts)
      setAnalyzed(true)
    } catch {
      sessionStorage.removeItem(PENDING_CALC_KEY)
    }
  }, [authLoading, user])

  // Fetch AI suggestions when we have metrics
  useEffect(() => {
    if (!analyzed || !metrics) {
      setSuggestions(null)
      setSuggestionsError(null)
      return
    }
    const sanitize = (n: number) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)
    const skuList = metrics.skuBreakdown ?? []
    const payload = {
      period,
      totalRevenue: sanitize(metrics.totalRevenue),
      totalVariableCost: sanitize(metrics.totalVariableCost),
      totalFixedCost: sanitize(metrics.totalFixedCost),
      netProfit: sanitize(metrics.netProfit),
      profitMargin: sanitize(metrics.profitMargin),
      breakEvenRevenue: sanitize(metrics.breakEvenRevenue),
      skuBreakdown: skuList.map((s) => ({
        name: String(s?.name ?? ''),
        revenue: sanitize(s.revenue),
        variableCost: sanitize(s.variableCost),
        contribution: sanitize(s.contribution),
        unitsSold: sanitize(s.unitsSold),
      })),
    }
    setSuggestionsLoading(true)
    setSuggestionsError(null)
    fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.status === 401) {
          setSessionExpired(true)
          return Promise.reject(new Error('Session expired'))
        }
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || res.statusText)))
        return res.json()
      })
      .then((data: { suggestions: string[] }) => {
        setSuggestions(data.suggestions || [])
      })
      .catch((err) => {
        setSuggestionsError(err.message || 'Failed to load suggestions.')
        setSuggestions([])
      })
      .finally(() => setSuggestionsLoading(false))
  }, [analyzed, metrics, period])

  const fmt = (n: number) => formatMoney(n, currency)

  return (
    <div className={`min-h-screen bg-background ${compactView ? 'compact-view' : ''}`}>
      {sessionExpired && (
        <Alert className="rounded-none border-x-0 border-t-0 bg-amber-100 dark:bg-amber-950/50 text-foreground">
          <AlertDescription className="flex items-center justify-center gap-2 flex-wrap">
            Session expired. Please sign in again.
            <Link href="/login" className="underline font-medium">Sign in</Link>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={addToCalendarOpen} onOpenChange={(open) => !open && handleSkipAddToCalendar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to calendar</DialogTitle>
            <DialogDescription>
              Add this scenario to your plan calendar. You can view and open it from the Calendar later.
            </DialogDescription>
          </DialogHeader>
          {addToCalendarScenarioName && (
            <p className="text-sm text-muted-foreground">Scenario: {addToCalendarScenarioName}</p>
          )}
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-sm text-foreground">Start date</Label>
              <Input
                type="date"
                value={planStartDate}
                onChange={(e) => setPlanStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm text-foreground">End date</Label>
              <Input type="date" value={planEndDate} readOnly className="mt-1 bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-set from your period: {period === 'weekly' ? 'start + 1 week' : period === 'monthly' ? 'end of month' : 'end of year'}
              </p>
            </div>
          </div>
          {addToCalendarError && (
            <p className="text-sm text-destructive" role="alert">
              {addToCalendarError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleSkipAddToCalendar} disabled={addToCalendarLoading}>
              Skip
            </Button>
            <Button onClick={handleAddToCalendar} disabled={!planStartDate || addToCalendarLoading}>
              {addToCalendarLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adding…
                </>
              ) : (
                'Add to calendar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground truncate">Uniprofit</h1>
                <p className="text-muted-foreground text-sm truncate">Think Before You Sell. Plan Before You Scale.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[72px] h-9" aria-label="Currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c} {getCurrencySymbol(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2"
                onClick={() => setCompactView((v) => !v)}
                title={compactView ? 'Normal view' : 'Compact view'}
              >
                Compact
              </Button>
              {user && (
                <Button variant="ghost" size="sm" className="h-9 gap-1" asChild>
                  <Link href="/calendar">
                    <CalendarIcon className="h-4 w-4" />
                    Calendar
                  </Link>
                </Button>
              )}
              <ThemeToggle />
              {!authLoading && (
                user ? (
                  <div className="flex items-center gap-2">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground truncate max-w-[120px]" title={user.email ?? undefined}>
                      {user.email}
                    </span>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => signOut()}>
                      <LogOut className="w-4 h-4" />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <Link href="/login">
                      <LogIn className="w-4 h-4" />
                      Login
                    </Link>
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-6xl mx-auto px-4 py-12 ${compactView ? 'py-6 text-sm' : ''}`}>
        <Card className={`bg-card border border-border rounded-2xl shadow-sm mb-8 ${compactView ? 'p-4' : 'p-8'}`}>
          <h2 className="text-2xl font-bold text-foreground mb-2">Company Profit Calculator</h2>
          <p className="text-muted-foreground mb-8">Add all your products (SKUs), then enter company costs once. All figures use the same period below.</p>

          {/* Period: all figures are for Weekly / Monthly / Yearly */}
          <div className="mb-10">
            <Label className="text-base font-semibold text-foreground mb-4 block">
              All figures are for (sales, rent, costs):
            </Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(periodLabels) as Array<[Period, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setPeriod(key)
                    setAnalyzed(false)
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    period === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {user && (
            <div className="mb-6 flex flex-wrap items-center gap-2" key={scenarioSelectKey}>
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <Select onValueChange={handleLoadScenario} disabled={scenariosLoading}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Load scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  {scenarios.length === 0 && !scenariosLoading && (
                    <SelectItem value="_none" disabled>No saved scenarios</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Products / SKUs */}
          <div className="mb-10 pb-8 border-b border-border">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold text-foreground">Products (SKUs)</h3>
              <Button type="button" variant="outline" size="sm" onClick={addSku} className="gap-2">
                <Plus className="w-4 h-4" />
                Add product
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              For each product: name, cost, DC, packaging, sell price, units sold. Set Return % and Recovery on return for return impact.
            </p>
            <div className="space-y-4">
              {skus.map((sku) => (
                <Card key={sku.id} className="p-4 bg-muted/30 border-border">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 flex-1 min-w-0">
                      <div>
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input
                          placeholder="Product name"
                          value={sku.name}
                          onChange={(e) => updateSku(sku.id, 'name', e.target.value)}
                          className="bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Cost/unit</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={sku.cost}
                          onChange={(e) => updateSku(sku.id, 'cost', e.target.value)}
                          className="bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">DC/unit</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={sku.dc}
                          onChange={(e) => updateSku(sku.id, 'dc', e.target.value)}
                          className="bg-background mt-1"
                          title="Direct cost: shipping, fees"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Packaging/unit</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={sku.packaging}
                          onChange={(e) => updateSku(sku.id, 'packaging', e.target.value)}
                          className="bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Sell/unit</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={sku.sellPrice}
                          onChange={(e) => updateSku(sku.id, 'sellPrice', e.target.value)}
                          className="bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Units / {period}</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={sku.unitsSold}
                          onChange={(e) => updateSku(sku.id, 'unitsSold', e.target.value)}
                          className="bg-background mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Return %</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          max="100"
                          value={sku.returnPercent}
                          onChange={(e) => updateSku(sku.id, 'returnPercent', e.target.value)}
                          className="bg-background mt-1"
                          title="Percentage of units returned"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Checkbox
                        id={`recovery-${sku.id}`}
                        checked={sku.recoveryOnReturn}
                        onCheckedChange={() => toggleRecoveryOnReturn(sku.id)}
                        aria-label="Recovery on return"
                      />
                      <Label
                        htmlFor={`recovery-${sku.id}`}
                        className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
                      >
                        Recovery on return
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSku(sku.id)}
                      disabled={skus.length <= 1}
                      aria-label="Remove product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {sku.returnPercent && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {sku.recoveryOnReturn
                        ? 'On return: only DC + packaging are lost (cost recovered).'
                        : 'On return: full cost + DC + packaging are lost (no recovery).'}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Company costs (once) */}
          <div className="mb-10">
            <h3 className="text-lg font-semibold text-foreground mb-2">Company costs (per {period})</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter rent, salaries, marketing, software/tools, and other fixed costs once for the whole company.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-foreground">Rent</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={companyCosts.rent}
                  onChange={(e) => setCompanyCost('rent', e.target.value)}
                  className="bg-input mt-1"
                />
              </div>
              <div>
                <Label className="text-sm text-foreground">Salaries</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={companyCosts.salaries}
                  onChange={(e) => setCompanyCost('salaries', e.target.value)}
                  className="bg-input mt-1"
                />
              </div>
              <div>
                <Label className="text-sm text-foreground">Marketing</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={companyCosts.marketing}
                  onChange={(e) => setCompanyCost('marketing', e.target.value)}
                  className="bg-input mt-1"
                />
              </div>
              <div>
                <Label className="text-sm text-foreground">Tools / Software</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={companyCosts.toolsSoftware}
                  onChange={(e) => setCompanyCost('toolsSoftware', e.target.value)}
                  className="bg-input mt-1"
                />
              </div>
              <div>
                <Label className="text-sm text-foreground">Other fixed</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={companyCosts.otherFixed}
                  onChange={(e) => setCompanyCost('otherFixed', e.target.value)}
                  className="bg-input mt-1"
                />
              </div>
            </div>
          </div>

          {validationErrors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {validationErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="flex-1 min-w-[200px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-lg transition-all disabled:opacity-50"
            >
              Calculate company profit
            </Button>
            {user && (
              <Button variant="outline" onClick={handleSaveScenario} className="gap-2">
                <Save className="w-4 h-4" />
                Save scenario
              </Button>
            )}
          </div>
          {!user && canAnalyze && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              You’ll be asked to sign in first; your data will be kept and we’ll run the calculation after you log in.
            </p>
          )}
        </Card>

        {/* Results Section (only when logged in) */}
        {user && analyzed && metrics && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Company summary */}
            <Card className="bg-card border border-border rounded-2xl shadow-sm p-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Company health</p>
                  <h3 className="text-2xl font-bold text-foreground">
                    {metrics.healthStatus === 'strong' ? 'Strong' : metrics.healthStatus === 'moderate' ? 'Moderate' : 'High Risk'}
                  </h3>
                </div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  metrics.healthStatus === 'strong' ? 'bg-green-100 dark:bg-green-900/30' :
                  metrics.healthStatus === 'moderate' ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  <span className={`text-2xl font-bold ${
                    metrics.healthStatus === 'strong' ? 'text-green-700 dark:text-green-400' :
                    metrics.healthStatus === 'moderate' ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'
                  }`}>
                    {metrics.profitMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </Card>

            {/* AI suggestions */}
            <Card className="bg-card border border-border rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Suggestions
              </h3>
              {suggestionsLoading && (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Getting AI suggestions…</span>
                </div>
              )}
              {suggestionsError && !suggestionsLoading && (
                <p className="text-destructive text-sm py-2">{suggestionsError}</p>
              )}
              {!suggestionsLoading && !suggestionsError && suggestions && suggestions.length > 0 && (
                <ul className="space-y-3 list-none p-0 m-0">
                  {suggestions.map((s, i) => {
                    let text = typeof s === 'string' ? s : String(s)
                    text = text.replace(/^\s*\[\s*"?\s*/, '').replace(/\s*"?\s*\]\s*$/g, '').replace(/^["\s]+|["\s]+$/g, '').replace(/\\"/g, '"').trim()
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
            </Card>

            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const rows = [
                    ['Product', 'Units', 'Revenue', 'Variable cost', 'Contribution', 'Contribution/unit'],
                    ...metrics.skuBreakdown.map((r) => [
                      r.name,
                      r.unitsSold.toLocaleString(),
                      r.revenue.toFixed(2),
                      r.variableCost.toFixed(2),
                      r.contribution.toFixed(2),
                      r.unitsSold > 0 ? (r.contribution / r.unitsSold).toFixed(2) : '0',
                    ]),
                    [],
                    ['Total revenue', '', metrics.totalRevenue.toFixed(2), '', '', ''],
                    ['Total variable cost', '', '', metrics.totalVariableCost.toFixed(2), '', ''],
                    ['Total fixed cost', '', '', metrics.totalFixedCost.toFixed(2), '', ''],
                    ['Net profit', '', '', '', metrics.netProfit.toFixed(2), ''],
                  ]
                  const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `uniprofit-${period}-${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(a.href)
                }}
              >
                <Download className="w-4 h-4" />
                Download CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const w = window.open('', '_blank', 'width=800,height=600')
                  if (!w) return
                  w.document.write(`
                    <!DOCTYPE html><html><head><title>UniProfit Summary</title></head><body style="font-family:system-ui;padding:24px;">
                    <h1>UniProfit – ${period}</h1>
                    <p><strong>Total revenue:</strong> ${fmt(metrics.totalRevenue)}</p>
                    <p><strong>Total variable cost:</strong> ${fmt(metrics.totalVariableCost)}</p>
                    <p><strong>Total fixed cost:</strong> ${fmt(metrics.totalFixedCost)}</p>
                    <p><strong>Net profit:</strong> ${fmt(metrics.netProfit)}</p>
                    <p><strong>Profit margin:</strong> ${metrics.profitMargin.toFixed(2)}%</p>
                    <p><strong>Break-even revenue:</strong> ${fmt(metrics.breakEvenRevenue)}</p>
                    <h2>Per product</h2>
                    <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;">
                    <tr><th>Product</th><th>Units</th><th>Revenue</th><th>Variable cost</th><th>Contribution</th><th>Contribution/unit</th></tr>
                    ${metrics.skuBreakdown.map((r) => `<tr><td>${r.name}</td><td>${r.unitsSold.toLocaleString()}</td><td>${fmt(r.revenue)}</td><td>${fmt(r.variableCost)}</td><td>${fmt(r.contribution)}</td><td>${r.unitsSold > 0 ? fmt(r.contribution / r.unitsSold) : '-'}</td></tr>`).join('')}
                    </table>
                    <p style="margin-top:24px;color:#666;font-size:12px;">Your data is stored securely and never shared.</p>
                    </body></html>`)
                  w.document.close()
                  w.focus()
                  setTimeout(() => w.print(), 300)
                }}
              >
                <Printer className="w-4 h-4" />
                Print summary
              </Button>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${compactView ? 'gap-4' : ''}`}>
              <Card className={`bg-card border border-border rounded-2xl shadow-sm ${compactView ? 'p-4' : 'p-6'}`}>
                <p className="text-sm text-muted-foreground mb-2">Total revenue</p>
                <p className={`font-bold text-foreground ${compactView ? 'text-xl' : 'text-3xl'}`}>{fmt(metrics.totalRevenue)}</p>
              </Card>
              <Card className={`bg-card border border-border rounded-2xl shadow-sm ${compactView ? 'p-4' : 'p-6'}`}>
                <p className="text-sm text-muted-foreground mb-2">Total variable cost</p>
                <p className={`font-bold text-foreground ${compactView ? 'text-xl' : 'text-3xl'}`}>{fmt(metrics.totalVariableCost)}</p>
              </Card>
              <Card className={`bg-card border border-border rounded-2xl shadow-sm ${compactView ? 'p-4' : 'p-6'}`}>
                <p className="text-sm text-muted-foreground mb-2">Total fixed cost</p>
                <p className={`font-bold text-foreground ${compactView ? 'text-xl' : 'text-3xl'}`}>{fmt(metrics.totalFixedCost)}</p>
              </Card>
              <Card className={`bg-card border border-border rounded-2xl shadow-sm ${compactView ? 'p-4' : 'p-6'}`}>
                <p className="text-sm text-muted-foreground mb-2">Total cost</p>
                <p className={`font-bold text-foreground ${compactView ? 'text-xl' : 'text-3xl'}`}>{fmt(metrics.totalCost)}</p>
              </Card>
              <Card className={`bg-card border border-border rounded-2xl shadow-sm ${compactView ? 'p-4' : 'p-6'}`}>
                <p className="text-sm text-muted-foreground mb-2">Net profit</p>
                <p className={`font-bold ${compactView ? 'text-xl' : 'text-3xl'} ${metrics.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(metrics.netProfit)}</p>
              </Card>
              <Card className={`bg-card border border-border rounded-2xl shadow-sm ${compactView ? 'p-4' : 'p-6'}`}>
                <p className="text-sm text-muted-foreground mb-2">Profit margin</p>
                <p className={`font-bold text-foreground ${compactView ? 'text-xl' : 'text-3xl'}`}>{metrics.profitMargin.toFixed(2)}%</p>
              </Card>
              <Card className={`bg-card border border-border rounded-2xl shadow-sm ${compactView ? 'p-4' : 'p-6'}`}>
                <p className="text-sm text-muted-foreground mb-2">Break-even revenue</p>
                <p className={`font-bold text-foreground ${compactView ? 'text-xl' : 'text-3xl'}`}>{fmt(metrics.breakEvenRevenue)}</p>
              </Card>
            </div>

            {/* Per-SKU breakdown */}
            {metrics.skuBreakdown.length > 0 && (
              <Card className="bg-card border border-border rounded-2xl shadow-sm p-6 overflow-hidden">
                <h3 className="text-lg font-semibold text-foreground mb-4">Per-product breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-medium text-foreground">Product</th>
                        <th className="text-right py-2 px-2 font-medium text-foreground">Units</th>
                        <th className="text-right py-2 px-2 font-medium text-foreground">Revenue</th>
                        <th className="text-right py-2 px-2 font-medium text-foreground">Variable cost</th>
                        <th className="text-right py-2 px-2 font-medium text-foreground">Contribution</th>
                        <th className="text-right py-2 pl-4 font-medium text-foreground">Contribution/unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.skuBreakdown.map((row, i) => {
                        const contributionMargin = row.revenue > 0 ? row.contribution / row.revenue : 0
                        const contributionPerUnit = row.unitsSold > 0 ? row.contribution / row.unitsSold : 0
                        const rowVariant =
                          row.contribution < 0
                            ? 'loss'
                            : contributionMargin >= 0.15
                              ? 'profit'
                              : 'low'
                        const rowClass =
                          rowVariant === 'profit'
                            ? 'bg-green-100 dark:bg-green-950/40 border-l-4 border-l-green-600 dark:border-l-green-500'
                            : rowVariant === 'low'
                              ? 'bg-amber-100 dark:bg-amber-950/40 border-l-4 border-l-amber-600 dark:border-l-amber-500'
                              : 'bg-red-100 dark:bg-red-950/40 border-l-4 border-l-red-600 dark:border-l-red-500'
                        return (
                          <tr key={i} className={`border-b border-border/50 ${rowClass}`}>
                            <td className={`text-foreground font-medium ${compactView ? 'py-1' : 'py-2'} pr-4`}>{row.name}</td>
                            <td className={`text-right text-muted-foreground ${compactView ? 'py-1' : 'py-2'} px-2`}>{row.unitsSold.toLocaleString()}</td>
                            <td className={`text-right text-foreground ${compactView ? 'py-1' : 'py-2'} px-2`}>{fmt(row.revenue)}</td>
                            <td className={`text-right text-foreground ${compactView ? 'py-1' : 'py-2'} px-2`}>{fmt(row.variableCost)}</td>
                            <td className={`text-right font-medium text-foreground ${compactView ? 'py-1' : 'py-2'} px-2`}>{fmt(row.contribution)}</td>
                            <td className={`text-right font-medium text-foreground ${compactView ? 'py-1' : 'py-2'} pl-4`}>{fmt(contributionPerUnit)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  <span className="inline-block w-3 h-3 rounded-sm bg-green-500/80 mr-1 align-middle" /> Profit (≥15% margin)
                  <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/80 mx-2 mr-1 align-middle" /> Low / balanced
                  <span className="inline-block w-3 h-3 rounded-sm bg-red-500/80 mx-2 mr-1 align-middle" /> Loss
                </p>
              </Card>
            )}
          </div>
        )}
      </main>
      <footer className="border-t border-border py-4 mt-8">
        <p className="text-center text-xs text-muted-foreground">
          Your data is stored securely and never shared.
        </p>
      </footer>
    </div>
  )
}
