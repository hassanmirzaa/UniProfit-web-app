import { NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'

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
  const skuList = Array.isArray(body.skuBreakdown) ? body.skuBreakdown : []
  const productsText = skuList
    .map(
      (s) =>
        `- ${String(s?.name ?? '')}: revenue $${fmt(s.revenue)}, variable cost $${fmt(s.variableCost)}, contribution $${fmt(s.contribution)}, units ${num(s.unitsSold)}`
    )
    .join('\n')

  return `You are a business advisor. Based on the company profit data below, give 3 to 5 actionable suggestions.

CRITICAL: Keep each suggestion to ONE short sentence (max 20–25 words). Be concise so every suggestion is complete and nothing gets cut off.

Period: ${body.period ?? 'monthly'}
Total revenue: $${fmt(body.totalRevenue)}
Total variable cost: $${fmt(body.totalVariableCost)}
Total fixed cost: $${fmt(body.totalFixedCost)}
Net profit: $${fmt(body.netProfit)}
Profit margin: ${num(body.profitMargin).toFixed(2)}%
Break-even revenue: $${fmt(body.breakEvenRevenue)}

Per-product breakdown:
${productsText}

Suggestions can cover: worst or best product by contribution; raising price or cutting cost on a specific product; adding products with X% margin to reach break-even; quick wins; fixed costs vs contribution. When relevant, mention marketing or fixed costs as a share of revenue (e.g. "Marketing is X% of revenue; consider …").

Respond with ONLY a valid JSON array of strings. One concise sentence per element. No markdown, no code block. Example: ["Prioritize Cap—highest contribution at $X.","Raise Wallet price to improve its 30% margin."]`
}

/** When JSON is truncated or malformed, split raw string into suggestion strings */
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
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set. Add it to .env.local.' },
        { status: 500 }
      )
    }

    const body: SuggestionsRequestBody = await request.json()
    const prompt = buildPrompt(body)

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 4096,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini API error', res.status, err)
      const isRateLimit = res.status === 429
      const message = isRateLimit
        ? 'AI suggestions are temporarily unavailable (rate limit). Try again in a minute.'
        : 'Failed to get suggestions from AI.'
      return NextResponse.json(
        { error: message, rateLimit: isRateLimit },
        { status: isRateLimit ? 429 : 502 }
      )
    }

    const data = await res.json()
    let raw =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    // Extract JSON array (or start of one if truncated)
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) raw = jsonMatch[0]
    else if (raw.startsWith('[')) {
      // Truncated: no closing ]; keep from [ to end
      raw = raw
    }
    let suggestions: string[] = []
    try {
      const parsed = JSON.parse(raw)
      suggestions = Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === 'string')
        : [String(parsed)]
    } catch {
      // Truncated or malformed: salvage by splitting on "," pattern between array elements
      suggestions = salvageSuggestionsFromRaw(raw)
    }
    // If we still have one item that looks like raw JSON array, salvage it
    if (suggestions.length === 1 && /^\s*\[/.test(suggestions[0])) {
      suggestions = salvageSuggestionsFromRaw(suggestions[0])
    }
    // Normalize: trim, remove brackets/quotes, single line
    suggestions = suggestions.map(normalizeSuggestion).filter(Boolean)
    return NextResponse.json({ suggestions })
  } catch (e) {
    console.error('Suggestions API error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
