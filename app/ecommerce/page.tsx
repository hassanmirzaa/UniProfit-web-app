'use client'

import { useState, useMemo, useEffect, useId, useRef, Suspense, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Moon, Sun, LogIn, Plus, Trash2, Lightbulb, Loader2, LogOut, User, Save, Download, Printer, FolderOpen, Calendar as CalendarIcon, RotateCcw, BarChart3, Crown, AlertTriangle, Target, TrendingUp, SlidersHorizontal, Gauge } from 'lucide-react'
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
import { addDays, endOfMonth, endOfYear, format } from 'date-fns'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { track } from '@/lib/analytics'
import { AffiliateCard } from '@/components/affiliate-card'
import { AdBanner } from '@/components/ad-banner'

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
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && (resolvedTheme ?? theme) === 'dark'
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
    )
  }
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

export default function EcommercePage() {
  return (
    <Suspense>
      <BusinessBrainPlanner />
    </Suspense>
  )
}

function BusinessBrainPlanner() {
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
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(false)
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [sessionExpired, setSessionExpired] = useState(false)
  const [currency, setCurrency] = useState<string>('USD')
  const [compactView, setCompactView] = useState(false)
  useEffect(() => {
    setCurrency(localStorage.getItem('uniprofit_currency') || 'USD')
    setCompactView(localStorage.getItem('uniprofit_compact') === '1')
  }, [])
  const [scenarios, setScenarios] = useState<{ id: string; name: string; created_at: string }[]>([])
  const [scenariosLoading, setScenariosLoading] = useState(false)
  const [scenarioSelectKey, setScenarioSelectKey] = useState(0)
  const [addToCalendarOpen, setAddToCalendarOpen] = useState(false)
  const [addToCalendarScenarioId, setAddToCalendarScenarioId] = useState<string | null>(null)
  const [addToCalendarScenarioName, setAddToCalendarScenarioName] = useState<string | null>(null)
  const [planStartDate, setPlanStartDate] = useState('')
  const [addToCalendarLoading, setAddToCalendarLoading] = useState(false)
  const [addToCalendarError, setAddToCalendarError] = useState<string | null>(null)
  const [existingPlanRanges, setExistingPlanRanges] = useState<{ start_date: string; end_date: string }[]>([])
  // What-If Simulator state
  const [whatIfPrice, setWhatIfPrice] = useState(0)
  const [whatIfReturn, setWhatIfReturn] = useState(0)
  const [whatIfUnits, setWhatIfUnits] = useState(0)
  const [whatIfAdSpend, setWhatIfAdSpend] = useState(0)
  // Cash Flow state
  const [cashOnHand, setCashOnHand] = useState('')
  // Goal Tracking state
  const [targetMargin, setTargetMargin] = useState('')
  const [targetRevenue, setTargetRevenue] = useState('')
  const [targetProfit, setTargetProfit] = useState('')
  const [aiCooldownEndsAt, setAiCooldownEndsAt] = useState<number | null>(null)
  const [, setCooldownTick] = useState(0)

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

  // AI suggestions: cooldown is server-side (DB). Fetch on load and when tab becomes visible so all tabs stay in sync.
  const fetchAiCooldown = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch('/api/suggestions/cooldown', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (data.in_cooldown && typeof data.ends_at === 'number' && data.ends_at > Date.now()) {
        setAiCooldownEndsAt(data.ends_at)
      } else {
        setAiCooldownEndsAt(null)
      }
    } catch {
      /* ignore */
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setAiCooldownEndsAt(null)
      return
    }
    fetchAiCooldown()
  }, [user, fetchAiCooldown])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) fetchAiCooldown()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [user, fetchAiCooldown])

  // Timer tick: re-render every second while in cooldown and clear when expired
  useEffect(() => {
    if (!aiCooldownEndsAt) return
    const id = setInterval(() => {
      if (Date.now() >= aiCooldownEndsAt) setAiCooldownEndsAt(null)
      setCooldownTick((t) => t + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [aiCooldownEndsAt])

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

  async function fetchScenarios() {
    if (!user) return
    setScenariosLoading(true)
    try {
      const { data } = await supabase
        .from('scenarios')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
      setScenarios(data ?? [])
    } finally {
      setScenariosLoading(false)
    }
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
          router.replace('/ecommerce', { scroll: false })
          return
        }
        setPeriod((data.period as Period) ?? period)
        setSkus(Array.isArray(data.skus) ? data.skus : skus)
        if (data.company_costs && typeof data.company_costs === 'object') {
          setCompanyCosts((prev) => ({ ...prev, ...data.company_costs }))
        }
        setAnalyzed(false)
        setScenarioSelectKey((k) => k + 1)
        router.replace('/ecommerce', { scroll: false })
      })
    return () => { cancelled = true }
  }, [loadId, user])

  const handleSaveTemplate = async () => {
    if (!user) return
    const name = window.prompt('Name this template (e.g. Monthly baseline)')
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
    track('scenario', 'Save template', { scenario_name: name.trim(), period, sku_count: skus.length })
  }

  const handleOpenAddToCalendar = async () => {
    if (!user || !metrics) return
    const name = window.prompt('Name this plan for the calendar (e.g. March 2025)')
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
    if (inserted?.id) {
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
    const start = planStartDate
    const end = planEndDate || planStartDate
    const overlaps = existingPlanRanges.some(
      (p) => start <= p.end_date && end >= p.start_date
    )
    if (overlaps) {
      setAddToCalendarError('You already have a plan for some of these dates. Please choose different dates.')
      return
    }
    setAddToCalendarLoading(true)
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
    track('calendar', 'Record on calendar', { period, start_date: start, end_date: end, net_profit: netProfit, profit_margin: profitMargin })
  }

  const handleSkipAddToCalendar = () => {
    setAddToCalendarOpen(false)
    setAddToCalendarScenarioId(null)
    setAddToCalendarScenarioName(null)
    setAddToCalendarError(null)
  }

  useEffect(() => {
    if (!addToCalendarOpen || !user) return
    supabase
      .from('plans')
      .select('start_date, end_date')
      .then(({ data }) => setExistingPlanRanges((data ?? []) as { start_date: string; end_date: string }[]))
  }, [addToCalendarOpen, user])

  const getEndDateForStart = (startStr: string) => {
    const start = new Date(startStr + 'T12:00:00')
    if (isNaN(start.getTime())) return startStr
    if (period === 'weekly') return format(addDays(start, 6), 'yyyy-MM-dd')
    if (period === 'monthly') return format(endOfMonth(start), 'yyyy-MM-dd')
    if (period === 'yearly') return format(endOfYear(start), 'yyyy-MM-dd')
    return startStr
  }

  const isDateOccupied = (date: Date) => {
    const start = format(date, 'yyyy-MM-dd')
    const end = getEndDateForStart(start)
    return existingPlanRanges.some((p) => start <= p.end_date && end >= p.start_date)
  }

  const [loadScenarioOpen, setLoadScenarioOpen] = useState(false)
  const [deletingScenarioId, setDeletingScenarioId] = useState<string | null>(null)

  const handleLoadScenario = async (id: string) => {
    if (!id || id === '_none') return
    const { data, error } = await supabase.from('scenarios').select('period, skus, company_costs').eq('id', id).single()
    if (error || !data) return
    setPeriod((data.period as Period) ?? period)
    setSkus(Array.isArray(data.skus) ? data.skus : skus)
    if (data.company_costs && typeof data.company_costs === 'object') setCompanyCosts({ ...companyCosts, ...data.company_costs })
    setAnalyzed(false)
    setScenarioSelectKey((k) => k + 1)
    setLoadScenarioOpen(false)
  }

  const handleDeleteScenario = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user || !id) return
    if (!window.confirm('Delete this template? This cannot be undone.')) return
    setDeletingScenarioId(id)
    const { error } = await supabase.from('scenarios').delete().eq('id', id).eq('user_id', user.id)
    setDeletingScenarioId(null)
    if (error) {
      if (/auth|session|JWT|expired|unauthorized/i.test(error.message)) setSessionExpired(true)
      return
    }
    fetchScenarios()
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

  // What-If projected metrics
  const projectedMetrics = useMemo(() => {
    if (!metrics || (whatIfPrice === 0 && whatIfReturn === 0 && whatIfUnits === 0 && whatIfAdSpend === 0)) return null

    let totalRevenue = 0
    let totalVariableCost = 0

    for (const sku of skus) {
      const sellPrice = (parseFloat(sku.sellPrice) || 0) * (1 + whatIfPrice / 100)
      const cost = parseFloat(sku.cost) || 0
      const dc = parseFloat(sku.dc) || 0
      const packaging = parseFloat(sku.packaging) || 0
      const units = (parseFloat(sku.unitsSold) || 0) * (1 + whatIfUnits / 100)
      const origReturn = parseFloat(sku.returnPercent) || 0
      const returnRate = Math.max(0, Math.min(100, origReturn + whatIfReturn)) / 100
      const unitsReturned = units * returnRate
      const netUnits = units - unitsReturned
      const recovery = sku.recoveryOnReturn

      const revenue = sellPrice * netUnits
      const costPerUnit = cost + dc + packaging
      const variableCostSold = costPerUnit * netUnits
      const variableCostReturns = recovery
        ? (dc + packaging) * unitsReturned
        : costPerUnit * unitsReturned
      totalRevenue += revenue
      totalVariableCost += variableCostSold + variableCostReturns
    }

    const baseMarketing = parseFloat(companyCosts.marketing) || 0
    const adjustedMarketing = baseMarketing * (1 + whatIfAdSpend / 100)
    const totalFixedCost =
      (parseFloat(companyCosts.rent) || 0) +
      (parseFloat(companyCosts.salaries) || 0) +
      adjustedMarketing +
      (parseFloat(companyCosts.toolsSoftware) || 0) +
      (parseFloat(companyCosts.otherFixed) || 0)
    const totalCost = totalVariableCost + totalFixedCost
    const netProfit = totalRevenue - totalCost
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const contributionMarginRatio = totalRevenue > 0 ? (totalRevenue - totalVariableCost) / totalRevenue : 0
    const breakEvenRevenue = contributionMarginRatio > 0 ? totalFixedCost / contributionMarginRatio : 0

    return { totalRevenue, totalVariableCost, totalFixedCost, totalCost, netProfit, profitMargin, breakEvenRevenue }
  }, [metrics, skus, companyCosts, whatIfPrice, whatIfReturn, whatIfUnits, whatIfAdSpend])

  // Cash Flow Risk
  const cashFlowRisk = useMemo(() => {
    if (!metrics) return null
    const cash = parseFloat(cashOnHand) || 0
    if (cash <= 0) return null
    const periodMultiplier = period === 'weekly' ? 4.33 : period === 'yearly' ? 1 / 12 : 1
    const monthlyBurn = metrics.netProfit < 0 ? Math.abs(metrics.netProfit) * periodMultiplier : 0
    const monthlyFixed = metrics.totalFixedCost * periodMultiplier
    const monthlyRevenue = metrics.totalRevenue * periodMultiplier
    const runwayMonths = monthlyBurn > 0 ? cash / monthlyBurn : Infinity
    const riskLevel: 'low' | 'moderate' | 'critical' =
      metrics.netProfit >= 0 ? 'low' : runwayMonths > 6 ? 'low' : runwayMonths > 3 ? 'moderate' : 'critical'
    return { cash, monthlyBurn, monthlyFixed, monthlyRevenue, runwayMonths, riskLevel, isProfitable: metrics.netProfit >= 0 }
  }, [metrics, cashOnHand, period])

  // Goal Progress
  const goalProgress = useMemo(() => {
    if (!metrics) return null
    const goals: Array<{ label: string; current: number; target: number; progress: number; gap: number; isMoney: boolean }> = []
    const tm = parseFloat(targetMargin)
    if (tm > 0) goals.push({ label: 'Profit margin', current: metrics.profitMargin, target: tm, progress: Math.min(100, (metrics.profitMargin / tm) * 100), gap: tm - metrics.profitMargin, isMoney: false })
    const tr = parseFloat(targetRevenue)
    if (tr > 0) goals.push({ label: 'Revenue', current: metrics.totalRevenue, target: tr, progress: Math.min(100, (metrics.totalRevenue / tr) * 100), gap: tr - metrics.totalRevenue, isMoney: true })
    const tp = parseFloat(targetProfit)
    if (tp > 0) goals.push({ label: 'Net profit', current: metrics.netProfit, target: tp, progress: Math.min(100, Math.max(0, (metrics.netProfit / tp) * 100)), gap: tp - metrics.netProfit, isMoney: true })
    return goals.length > 0 ? goals : null
  }, [metrics, targetMargin, targetRevenue, targetProfit])


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
      window.location.href = '/login?next=' + encodeURIComponent('/ecommerce')
      return
    }
    setAnalyzed(true)
    track('calculation', 'Reveal My True Profit', { period, sku_count: skus.length })
  }

  const handleReset = () => {
    setPeriod('monthly')
    setSkus([createEmptySku(nextSkuId())])
    setCompanyCosts({
      rent: '',
      salaries: '',
      marketing: '',
      toolsSoftware: '',
      otherFixed: '',
    })
    setAnalyzed(false)
    setSuggestions(null)
    setSuggestionsError(null)
    setValidationErrors([])
    setScenarioSelectKey((k) => k + 1)
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

  // Fetch AI suggestions when we have metrics and AI suggestions are enabled. Cooldown enforced server-side.
  useEffect(() => {
    if (!analyzed || !metrics || !aiSuggestionsEnabled || !user) {
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
      skuBreakdown: skuList.map((s) => {
        const rev = sanitize(s.revenue)
        const contrib = sanitize(s.contribution)
        const units = sanitize(s.unitsSold)
        return {
          name: String(s?.name ?? ''),
          revenue: rev,
          variableCost: sanitize(s.variableCost),
          contribution: contrib,
          unitsSold: units,
          margin: rev > 0 ? (contrib / rev) * 100 : 0,
          contributionPerUnit: units > 0 ? contrib / units : 0,
        }
      }),
    }
    setSuggestionsLoading(true)
    setSuggestionsError(null)
    track('ai_suggestions', 'AI suggestions requested', { period, sku_count: skuList.length })
    fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    })
      .then(async (res) => {
        if (res.status === 401) {
          setSessionExpired(true)
          throw new Error('Session expired')
        }
        const data = await res.json().catch(() => ({}))
        if (res.status === 429) {
          if (typeof data.ends_at === 'number') setAiCooldownEndsAt(data.ends_at)
          setSuggestionsError(data.error || 'AI suggestions are in cooldown. Try again later.')
          setSuggestions(null)
          return
        }
        if (typeof data.cooldown_ends_at === 'number') setAiCooldownEndsAt(data.cooldown_ends_at)
        if (!res.ok) throw new Error(data.error || res.statusText)
        setSuggestions(data.suggestions || [])
      })
      .catch((err) => {
        setSuggestionsError(err.message || 'Failed to load suggestions.')
        setSuggestions([])
      })
      .finally(() => setSuggestionsLoading(false))
  }, [analyzed, metrics, period, aiSuggestionsEnabled, user])

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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record on calendar for analytics</DialogTitle>
            <DialogDescription>
              Record this result on your calendar to track business performance over time. Pick a start date; end date is set from your period. You can’t record on dates that already have a plan.
            </DialogDescription>
          </DialogHeader>
          {addToCalendarScenarioName && (
            <p className="text-sm text-muted-foreground">Plan: {addToCalendarScenarioName}</p>
          )}
          <div className="grid gap-4 py-2">
            <Label className="text-sm text-foreground">Pick start date</Label>
            <Calendar
              mode="single"
              selected={planStartDate ? new Date(planStartDate + 'T12:00:00') : undefined}
              onSelect={(d) => d && setPlanStartDate(format(d, 'yyyy-MM-dd'))}
              disabled={isDateOccupied}
              className="rounded-md border border-border p-3"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End (auto)</Label>
                <Input type="date" value={planEndDate} readOnly className="mt-1 h-9 bg-muted" />
              </div>
            </div>
          </div>
          {addToCalendarError && (
            <p className="text-sm text-destructive" role="alert">
              {addToCalendarError}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleSkipAddToCalendar} disabled={addToCalendarLoading}>
              Cancel
            </Button>
            <Button onClick={handleAddToCalendar} disabled={!planStartDate || addToCalendarLoading}>
              {addToCalendarLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Recording…
                </>
              ) : (
                'Record on calendar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="w-full max-w-6xl mx-auto pl-3 pr-4 sm:pl-4 sm:pr-4 py-4">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <Link href="/" className="flex flex-col gap-1 min-w-0 shrink-0">
              <Image
                src="/uniProfit-logo.png"
                alt="UniProfit"
                width={280}
                height={84}
                className="h-16 sm:h-20 w-auto shrink-0 object-contain"
                priority
              />
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Stop Losing Money Without Realizing It.</p>
            </Link>
            <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="min-w-[5rem] h-9" aria-label="Currency">
                  <SelectValue>
                    {currency} {getCurrencySymbol(currency)}
                  </SelectValue>
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
                <>
                  <Button variant="ghost" size="sm" className="h-9 gap-1" asChild>
                    <Link href="/calendar">
                      <CalendarIcon className="h-4 w-4" />
                      Calendar
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 gap-1" asChild>
                    <Link href="/analytics">
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </Link>
                  </Button>
                </>
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
          <h2 className="text-2xl font-bold text-foreground mb-1">Know If Your Store Is Actually Profitable</h2>
          <p className="text-lg text-muted-foreground mb-1">Your AI-powered profit control center for ecommerce.</p>
          <p className="text-sm text-muted-foreground mb-8">Add your products and costs below. Get instant clarity on margins, break-even, and hidden losses — in 60 seconds.</p>

          {/* Period and top actions: Reset + Load template */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm font-medium text-foreground shrink-0">Period:</Label>
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
            {user && (
              <div className="flex flex-wrap items-center gap-2" key={scenarioSelectKey}>
                <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                <Popover open={loadScenarioOpen} onOpenChange={setLoadScenarioOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start gap-2" disabled={scenariosLoading}>
                      <span className="truncate">
                        {scenariosLoading ? 'Loading…' : 'Load template'}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0" align="start">
                    {scenarios.length === 0 && !scenariosLoading && (
                      <p className="p-3 text-sm text-muted-foreground">No saved templates</p>
                    )}
                    {scenarios.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 rounded-sm cursor-pointer group"
                        onClick={() => handleLoadScenario(s.id)}
                      >
                        <span className="text-sm font-medium truncate flex-1">{s.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 opacity-70 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                          disabled={deletingScenarioId === s.id}
                          onClick={(e) => handleDeleteScenario(s.id, e)}
                          aria-label={`Delete ${s.name}`}
                        >
                          {deletingScenarioId === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 ml-auto shrink-0">
              <RotateCcw className="w-4 h-4" />
              Reset form
            </Button>
          </div>

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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 dark:bg-muted/20 px-4 py-3 mb-4">
            <Label htmlFor="ai-suggestions" className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
              <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
              AI suggestions
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Crown className="h-3 w-3 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
                Premium
              </span>
            </Label>
            <div className="flex items-center gap-3">
              {!user && (
                <span className="text-xs text-muted-foreground">Sign in to use</span>
              )}
              {user && aiCooldownEndsAt && Date.now() < aiCooldownEndsAt && (() => {
                const remainingMs = Math.max(0, aiCooldownEndsAt - Date.now())
                const m = Math.floor(remainingMs / 60000)
                const s = Math.floor((remainingMs % 60000) / 1000)
                return (
                  <span className="text-xs font-mono font-medium text-amber-700 dark:text-amber-300 tabular-nums">
                    Next request in {m}:{s.toString().padStart(2, '0')}
                  </span>
                )
              })()}
              <Switch
                id="ai-suggestions"
                checked={user ? aiSuggestionsEnabled : false}
                onCheckedChange={setAiSuggestionsEnabled}
                disabled={!user || !!(aiCooldownEndsAt && Date.now() < aiCooldownEndsAt)}
                className="data-[state=unchecked]:bg-muted-foreground/30 dark:data-[state=unchecked]:bg-muted-foreground/20"
              />
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
              Reveal My True Profit
            </Button>
            {user && (
              <>
                <Button variant="outline" onClick={handleSaveTemplate} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save template
                </Button>
                <Button variant="outline" onClick={handleOpenAddToCalendar} className="gap-2" disabled={!analyzed || !metrics} title="Record this result on the calendar for business analytics">
                  <CalendarIcon className="w-4 h-4" />
                  Record on calendar
                </Button>
              </>
            )}
          </div>
          {!user && canAnalyze && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Sign in to unlock your profit analysis — your data is preserved and calculated instantly after login.
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

            {/* AI suggestions (only when enabled) */}
            {aiSuggestionsEnabled && (
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
            )}

            {/* Affiliate: logistics partner — shown after analysis, highly relevant */}
            <AffiliateCard variant="logistics" className="mb-4" />

            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleOpenAddToCalendar}
                title="Record this result on the calendar for business analytics"
              >
                <CalendarIcon className="w-4 h-4" />
                Record on calendar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const rows = [
                    ['Product', 'Units', 'Revenue', 'Variable cost', 'Contribution', 'Profit %', 'Contribution/unit'],
                    ...metrics.skuBreakdown.map((r) => [
                      r.name,
                      r.unitsSold.toLocaleString(),
                      r.revenue.toFixed(2),
                      r.variableCost.toFixed(2),
                      r.contribution.toFixed(2),
                      r.revenue > 0 ? ((r.contribution / r.revenue) * 100).toFixed(1) : '0.0',
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
                  track('export', 'Download CSV', { period })
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
                    <tr><th>Product</th><th>Units</th><th>Revenue</th><th>Variable cost</th><th>Contribution</th><th>Profit %</th><th>Contribution/unit</th></tr>
                    ${metrics.skuBreakdown.map((r) => `<tr><td>${r.name}</td><td>${r.unitsSold.toLocaleString()}</td><td>${fmt(r.revenue)}</td><td>${fmt(r.variableCost)}</td><td>${fmt(r.contribution)}</td><td>${r.revenue > 0 ? ((r.contribution / r.revenue) * 100).toFixed(1) + '%' : '0.0%'}</td><td>${r.unitsSold > 0 ? fmt(r.contribution / r.unitsSold) : '-'}</td></tr>`).join('')}
                    </table>
                    <p style="margin-top:24px;color:#666;font-size:12px;">Your data is stored securely and never shared.</p>
                    </body></html>`)
                  w.document.close()
                  w.focus()
                  setTimeout(() => w.print(), 300)
                  track('export', 'Print summary', { period })
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
                        <th className="text-right py-2 px-2 font-medium text-foreground">Profit %</th>
                        <th className="text-right py-2 pl-4 font-medium text-foreground">Contribution/unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.skuBreakdown.map((row, i) => {
                        const contributionMargin = row.revenue > 0 ? row.contribution / row.revenue : 0
                        const profitPct = contributionMargin * 100
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
                            <td className={`text-right text-foreground ${compactView ? 'py-1' : 'py-2'} px-2`}>{profitPct.toFixed(1)}%</td>
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

            {/* What-If Scenario Simulator */}
            <Card className="bg-card border border-border rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                What-If Scenario Simulator
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Simulate strategic changes before implementing them. See how pricing, returns, volume, and ad spend affect your bottom line.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-foreground">Sell price change</Label>
                    <span className={`text-sm font-semibold ${whatIfPrice > 0 ? 'text-green-600 dark:text-green-400' : whatIfPrice < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{whatIfPrice > 0 ? '+' : ''}{whatIfPrice}%</span>
                  </div>
                  <Slider value={[whatIfPrice]} onValueChange={([v]) => setWhatIfPrice(v)} min={-50} max={50} step={1} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-foreground">Return rate change</Label>
                    <span className={`text-sm font-semibold ${whatIfReturn < 0 ? 'text-green-600 dark:text-green-400' : whatIfReturn > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{whatIfReturn > 0 ? '+' : ''}{whatIfReturn}pp</span>
                  </div>
                  <Slider value={[whatIfReturn]} onValueChange={([v]) => setWhatIfReturn(v)} min={-20} max={20} step={1} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-foreground">Units sold change</Label>
                    <span className={`text-sm font-semibold ${whatIfUnits > 0 ? 'text-green-600 dark:text-green-400' : whatIfUnits < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{whatIfUnits > 0 ? '+' : ''}{whatIfUnits}%</span>
                  </div>
                  <Slider value={[whatIfUnits]} onValueChange={([v]) => setWhatIfUnits(v)} min={-50} max={100} step={5} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-foreground">Ad/marketing spend change</Label>
                    <span className={`text-sm font-semibold ${whatIfAdSpend < 0 ? 'text-green-600 dark:text-green-400' : whatIfAdSpend > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>{whatIfAdSpend > 0 ? '+' : ''}{whatIfAdSpend}%</span>
                  </div>
                  <Slider value={[whatIfAdSpend]} onValueChange={([v]) => setWhatIfAdSpend(v)} min={-50} max={100} step={5} />
                </div>
              </div>
              {projectedMetrics && metrics ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-2 px-4 font-medium text-foreground">Metric</th>
                        <th className="text-right py-2 px-4 font-medium text-muted-foreground">Current</th>
                        <th className="text-right py-2 px-4 font-medium text-primary">Projected</th>
                        <th className="text-right py-2 px-4 font-medium text-foreground">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Revenue', base: metrics.totalRevenue, proj: projectedMetrics.totalRevenue, money: true },
                        { label: 'Variable cost', base: metrics.totalVariableCost, proj: projectedMetrics.totalVariableCost, money: true },
                        { label: 'Fixed cost', base: metrics.totalFixedCost, proj: projectedMetrics.totalFixedCost, money: true },
                        { label: 'Net profit', base: metrics.netProfit, proj: projectedMetrics.netProfit, money: true },
                        { label: 'Profit margin', base: metrics.profitMargin, proj: projectedMetrics.profitMargin, money: false },
                        { label: 'Break-even revenue', base: metrics.breakEvenRevenue, proj: projectedMetrics.breakEvenRevenue, money: true },
                      ].map((row) => {
                        const diff = row.proj - row.base
                        const positive = row.label === 'Variable cost' || row.label === 'Fixed cost' ? diff < 0 : diff > 0
                        return (
                          <tr key={row.label} className="border-b border-border/50">
                            <td className="py-2 px-4 text-foreground font-medium">{row.label}</td>
                            <td className="py-2 px-4 text-right text-muted-foreground">{row.money ? fmt(row.base) : `${row.base.toFixed(1)}%`}</td>
                            <td className="py-2 px-4 text-right font-semibold text-foreground">{row.money ? fmt(row.proj) : `${row.proj.toFixed(1)}%`}</td>
                            <td className={`py-2 px-4 text-right font-semibold ${positive ? 'text-green-600 dark:text-green-400' : diff === 0 ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400'}`}>
                              {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${row.money ? fmt(diff) : `${diff.toFixed(1)}pp`}`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Move the sliders above to simulate a scenario.</p>
              )}
              {(whatIfPrice !== 0 || whatIfReturn !== 0 || whatIfUnits !== 0 || whatIfAdSpend !== 0) && (
                <Button variant="ghost" size="sm" className="mt-3 gap-2" onClick={() => { setWhatIfPrice(0); setWhatIfReturn(0); setWhatIfUnits(0); setWhatIfAdSpend(0) }}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reset simulation
                </Button>
              )}
            </Card>

            {/* Cash Flow Risk Indicator */}
            <Card className="bg-card border border-border rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-primary" />
                Cash Flow Risk Indicator
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your current cash on hand to see how long your business can sustain at current burn rate.
              </p>
              <div className="max-w-xs mb-4">
                <Label className="text-sm text-foreground">Cash on hand ({getCurrencySymbol(currency)})</Label>
                <Input
                  type="number"
                  placeholder="e.g. 50000"
                  value={cashOnHand}
                  onChange={(e) => setCashOnHand(e.target.value)}
                  className="bg-input mt-1"
                />
              </div>
              {cashFlowRisk && (
                <div className={`rounded-lg border-2 p-5 ${
                  cashFlowRisk.riskLevel === 'critical' ? 'border-red-500/60 bg-red-50 dark:bg-red-950/20' :
                  cashFlowRisk.riskLevel === 'moderate' ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/20' :
                  'border-green-500/60 bg-green-50 dark:bg-green-950/20'
                }`}>
                  <div className="flex items-start gap-3 mb-4">
                    {cashFlowRisk.riskLevel === 'critical' ? (
                      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    ) : cashFlowRisk.riskLevel === 'moderate' ? (
                      <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-lg font-bold ${
                        cashFlowRisk.riskLevel === 'critical' ? 'text-red-700 dark:text-red-400' :
                        cashFlowRisk.riskLevel === 'moderate' ? 'text-amber-700 dark:text-amber-400' :
                        'text-green-700 dark:text-green-400'
                      }`}>
                        {cashFlowRisk.isProfitable ? 'Profitable — Low Risk' :
                         cashFlowRisk.riskLevel === 'critical' ? 'Critical — Immediate Action Required' :
                         cashFlowRisk.riskLevel === 'moderate' ? 'Moderate Risk — Monitor Closely' : 'Low Risk'}
                      </p>
                      <p className="text-sm text-foreground mt-1">
                        {cashFlowRisk.isProfitable
                          ? `Your business is profitable this ${period}. Cash reserves of ${fmt(cashFlowRisk.cash)} provide a strong buffer.`
                          : cashFlowRisk.runwayMonths === Infinity
                            ? 'No monthly burn detected.'
                            : `At your current burn rate of ${fmt(cashFlowRisk.monthlyBurn)}/month, you will run out of cash in ${cashFlowRisk.runwayMonths.toFixed(1)} months.`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-md bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">Cash on hand</p>
                      <p className="text-base font-bold text-foreground">{fmt(cashFlowRisk.cash)}</p>
                    </div>
                    <div className="rounded-md bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">Monthly burn</p>
                      <p className="text-base font-bold text-foreground">{cashFlowRisk.monthlyBurn > 0 ? fmt(cashFlowRisk.monthlyBurn) : '—'}</p>
                    </div>
                    <div className="rounded-md bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">Monthly fixed costs</p>
                      <p className="text-base font-bold text-foreground">{fmt(cashFlowRisk.monthlyFixed)}</p>
                    </div>
                    <div className="rounded-md bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">Runway</p>
                      <p className="text-base font-bold text-foreground">
                        {cashFlowRisk.isProfitable ? 'Sustainable' : cashFlowRisk.runwayMonths === Infinity ? '—' : `${cashFlowRisk.runwayMonths.toFixed(1)} months`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Goal Tracking */}
            <Card className="bg-card border border-border rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Goal Tracking
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set your targets and track how close you are. See exactly what needs to improve.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label className="text-sm text-foreground">Target margin (%)</Label>
                  <Input type="number" placeholder="e.g. 25" value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)} className="bg-input mt-1" />
                </div>
                <div>
                  <Label className="text-sm text-foreground">Target revenue ({getCurrencySymbol(currency)})</Label>
                  <Input type="number" placeholder="e.g. 100000" value={targetRevenue} onChange={(e) => setTargetRevenue(e.target.value)} className="bg-input mt-1" />
                </div>
                <div>
                  <Label className="text-sm text-foreground">Target profit ({getCurrencySymbol(currency)})</Label>
                  <Input type="number" placeholder="e.g. 20000" value={targetProfit} onChange={(e) => setTargetProfit(e.target.value)} className="bg-input mt-1" />
                </div>
              </div>
              {goalProgress && (
                <div className="space-y-4">
                  {goalProgress.map((goal) => (
                    <div key={goal.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground">{goal.label}</span>
                        <span className="text-sm text-muted-foreground">
                          {goal.isMoney ? fmt(goal.current) : `${goal.current.toFixed(1)}%`}
                          {' / '}
                          {goal.isMoney ? fmt(goal.target) : `${goal.target.toFixed(1)}%`}
                        </span>
                      </div>
                      <Progress value={goal.progress} className="h-3" />
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs font-semibold ${goal.progress >= 100 ? 'text-green-600 dark:text-green-400' : goal.progress >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                          {goal.progress.toFixed(0)}%
                        </span>
                        {goal.gap > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Gap: {goal.isMoney ? fmt(goal.gap) : `${goal.gap.toFixed(1)}pp`}
                          </span>
                        )}
                        {goal.gap <= 0 && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">Target reached</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </div>
        )}
      </main>
      <footer className="border-t border-border py-4 mt-8">
        {/* AdSense display unit — below all content, non-intrusive */}
        <AdBanner
          slotId={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ECOMMERCE || ''}
          className="mb-4 max-w-2xl mx-auto"
        />
        <p className="text-center text-xs text-muted-foreground">
          Your data is stored securely and never shared.
        </p>
      </footer>
    </div>
  )
}
