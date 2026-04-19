export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'
const MAX_BODY_BYTES = 100_000
const MAX_SUMMARY_CHARS = 5_000
const MAX_SCENARIOS = 50
const GEMINI_TIMEOUT_MS = 30_000

export interface AnalyticsSuggestionsBody {
  summaryText: string
  monthWise?: { month: string; netProfit: number; planCount: number }[]
  scenarioWise?: { name: string; period: string; start: string; end: string; netProfit: number; margin: number }[]
}

function salvageSuggestionsFromRaw(raw: string): string[] {
  if (!raw?.trim()) return []
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

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set.' },
        { status: 500 }
      )
    }

    let body: AnalyticsSuggestionsBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const summary = typeof body.summaryText === 'string'
      ? body.summaryText.slice(0, MAX_SUMMARY_CHARS)
      : 'No calendar data.'
    const scenarios = Array.isArray(body.scenarioWise) ? body.scenarioWise.slice(0, MAX_SCENARIOS) : []

    const prompt = `You are a business advisor. Below is a summary of the user's saved profit plans from their calendar (multiple scenarios over time, with SKU and month-wise data where available).

${summary}

Give 3 to 5 actionable suggestions based on this overall calendar data. Consider: trends (improving or declining profit over months), best/worst scenarios or products, consistency, and what to do next. Keep each suggestion to ONE short sentence (max 20–25 words). Be concise.

Respond with ONLY a valid JSON array of strings. No markdown, no code block. Example: ["Focus on Scenario X—it has the highest margin.","February showed a dip; review fixed costs for that period."]`

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
        return NextResponse.json({ error: 'AI request timed out. Try again.' }, { status: 504 })
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini analytics API error', res.status, err)
      const isRateLimit = res.status === 429
      return NextResponse.json(
        { error: isRateLimit ? 'Rate limit. Try again later.' : 'Failed to get suggestions.' },
        { status: isRateLimit ? 429 : 502 }
      )
    }

    const data = await res.json()
    let raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) raw = jsonMatch[0]
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
    return NextResponse.json({ suggestions })
  } catch (e) {
    console.error('Analytics suggestions API error', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
