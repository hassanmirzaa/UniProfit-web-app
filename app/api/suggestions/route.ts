import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'
const COOLDOWN_HOURS = 1
const MAX_BODY_BYTES = 100_000
const MAX_SKUS = 50
const GEMINI_TIMEOUT_MS = 30_000

export interface SuggestionsRequestBody {
  period: string
  totalRevenue: number
  totalVariableCost: number
  totalFixedCost: number
  netProfit: number
  profitMargin: number
  breakEvenRevenue: number
  skuBreakdown: Array<{
    name: string
    revenue: number
    variableCost: number
    contribution: number
    unitsSold: number
  }>
}

function buildPrompt(body: SuggestionsRequestBody): string {
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)
  const fmt = (n: number) => num(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  const skuList = Array.isArray(body.skuBreakdown) ? body.skuBreakdown.slice(0, MAX_SKUS) : []
  const productsText = skuList
    .map((s) => {
      const margin = num(s.revenue) > 0 ? ((num(s.contribution) / num(s.revenue)) * 100).toFixed(1) : '0.0'
      const perUnit = num(s.unitsSold) > 0 ? (num(s.contribution) / num(s.unitsSold)).toFixed(2) : '0'
      return `- ${String(s?.name ?? '').slice(0, 100)}: revenue $${fmt(s.revenue)}, variable cost $${fmt(s.variableCost)}, contribution $${fmt(s.contribution)} (${margin}% margin), ${num(s.unitsSold)} units, $${perUnit}/unit contribution`
    })
    .join('\n')

  const marketingPct = num(body.totalRevenue) > 0 ? ((num(body.totalFixedCost) / num(body.totalRevenue)) * 100).toFixed(1) : '0'
  const contributionMarginRatio = num(body.totalRevenue) > 0 ? (((num(body.totalRevenue) - num(body.totalVariableCost)) / num(body.totalRevenue)) * 100).toFixed(1) : '0'

  return `You are a quantitative ecommerce business advisor. Based on the profit data below, give 4 to 6 specific, numeric, SKU-level actionable recommendations.

RULES:
- Every suggestion MUST include specific numbers: dollar amounts, percentages, or SKU names.
- Reference specific products by name. Never say "reduce costs" or "increase revenue" generically.
- Calculate the projected impact of each recommendation using the data provided.
- Format: one clear sentence per suggestion, max 35 words. Include the dollar or percentage impact.

Period: ${body.period ?? 'monthly'}
Total revenue: $${fmt(body.totalRevenue)}
Total variable cost: $${fmt(body.totalVariableCost)}
Total fixed cost: $${fmt(body.totalFixedCost)} (${marketingPct}% of revenue)
Net profit: $${fmt(body.netProfit)}
Profit margin: ${num(body.profitMargin).toFixed(2)}%
Contribution margin ratio: ${contributionMarginRatio}%
Break-even revenue: $${fmt(body.breakEvenRevenue)}

Per-product breakdown:
${productsText}

SUGGESTION TYPES (use actual numbers from the data above):
1. "Increasing {SKU} price by X% would improve overall margin from Y% to ~Z%, adding ~$N profit (assuming stable demand)."
2. "Reducing return rate on {SKU} from X% to Y% would increase ${body.period} profit by ~$N."
3. "{SKU} has the lowest margin at X%; consider cutting variable costs by $N/unit to match the Y% average."
4. "Fixed costs are ${marketingPct}% of revenue — if ad spend increases by X% at current ROAS, projected profit increases by ~$N."
5. "Prioritize {SKU} — highest contribution at $X per unit. Scaling units by Y% adds ~$N to profit."
6. "{SKU} is a loss-maker at -X% margin. Discontinuing it would recover ~$N per ${body.period}."

Respond with ONLY a valid JSON array of strings. No markdown, no code block.`
}

function salvageSuggestionsFromRaw(raw: string): string[] {
  if (!raw || !raw.trim()) return []
  let s = raw.trim()
  if (s.startsWith('[')) s = s.slice(1)
  if (s.endsWith(']')) s = s.slice(0, -1)
  s = s.trim()
  if (!s) return []
  const parts: string[] = []
  let inString = false
  let escape = false
  let quoteChar = '"'
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === '\\' && inString) {
      escape = true
      continue
    }
    if (!inString) {
      if (c === '"' || c === "'") {
        inString = true
        quoteChar = c
        start = i + 1
      }
      continue
    }
    if (c === quoteChar) {
      inString = false
      parts.push(s.slice(start, i).replace(/\\"/g, '"').trim())
      continue
    }
  }
  if (inString && start < s.length) {
    parts.push(s.slice(start).replace(/\\"/g, '"').trim())
  }
  return parts.filter((p) => p.length > 0)
}

function normalizeSuggestion(s: string): string {
  let t = typeof s === 'string' ? s.trim() : String(s)
  t = t.replace(/^\s*\[\s*"?\s*/, '').replace(/\s*"?\s*\]\s*$/, '')
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1)
  t = t.replace(/^["\s]+|["\s]+$/g, '').replace(/\\"/g, '"')
  return t.replace(/\s+/g, ' ').trim()
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request payload too large.' }, { status: 413 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: cooldownRow } = await supabase
      .from('ai_suggestions_cooldown')
      .select('ends_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const now = Date.now()
    const endsAtMs = cooldownRow?.ends_at ? new Date(cooldownRow.ends_at).getTime() : 0
    if (endsAtMs > now) {
      return NextResponse.json(
        { error: 'AI suggestions are in cooldown. Try again later.', ends_at: endsAtMs },
        { status: 429 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set. Add it to .env.local.' },
        { status: 500 }
      )
    }

    // Set cooldown BEFORE making the external API call to prevent race conditions.
    // Even if the Gemini request fails, the cooldown is enforced.
    const cooldownEndsAt = new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000)
    await supabase
      .from('ai_suggestions_cooldown')
      .upsert(
        { user_id: user.id, ends_at: cooldownEndsAt.toISOString() },
        { onConflict: 'user_id' }
      )

    let body: SuggestionsRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = buildPrompt(body)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 4096,
          },
        }),
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return NextResponse.json(
          { error: 'AI request timed out. Please try again later.', cooldown_ends_at: cooldownEndsAt.getTime() },
          { status: 504 }
        )
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini API error', res.status, err)
      const isRateLimit = res.status === 429
      const message = isRateLimit
        ? 'AI suggestions are temporarily unavailable (rate limit). Try again in a minute.'
        : 'Failed to get suggestions from AI.'
      return NextResponse.json(
        { error: message, rateLimit: isRateLimit, cooldown_ends_at: cooldownEndsAt.getTime() },
        { status: isRateLimit ? 429 : 502 }
      )
    }

    const data = await res.json()
    let raw =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) raw = jsonMatch[0]
    else if (raw.startsWith('[')) {
      // truncated: keep from [ to end
    }
    let suggestions: string[] = []
    try {
      const parsed = JSON.parse(raw)
      suggestions = Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === 'string')
        : [String(parsed)]
    } catch {
      suggestions = salvageSuggestionsFromRaw(raw)
    }
    if (suggestions.length === 1 && /^\s*\[/.test(suggestions[0])) {
      suggestions = salvageSuggestionsFromRaw(suggestions[0])
    }
    suggestions = suggestions.map(normalizeSuggestion).filter(Boolean)

    return NextResponse.json({
      suggestions,
      cooldown_ends_at: cooldownEndsAt.getTime(),
    })
  } catch (e) {
    console.error('Suggestions API error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
