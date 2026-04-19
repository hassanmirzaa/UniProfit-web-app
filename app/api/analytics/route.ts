import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_BODY_BYTES = 20_000
const MAX_PROPERTIES_KEYS = 30
const MAX_STRING_LENGTH = 500

export type AnalyticsEventBody = {
  event_type: string
  event_name: string
  page?: string
  path?: string
  referrer?: string
  properties?: Record<string, unknown>
  session_id?: string
  anonymous_id?: string
  user_agent?: string
  viewport_width?: number
  viewport_height?: number
}

function sanitizeString(s: unknown, maxLen: number): string {
  if (s == null) return ''
  const t = typeof s === 'string' ? s : String(s)
  return t.slice(0, maxLen)
}

function sanitizeProperties(obj: unknown): Record<string, unknown> {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return {}
  const record = obj as Record<string, unknown>
  const keys = Object.keys(record).slice(0, MAX_PROPERTIES_KEYS)
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const key = sanitizeString(k, 100)
    if (!key) continue
    const v = record[k]
    if (v === null || v === undefined) continue
    if (typeof v === 'string') out[key] = v.slice(0, MAX_STRING_LENGTH)
    else if (typeof v === 'number' && Number.isFinite(v)) out[key] = v
    else if (typeof v === 'boolean') out[key] = v
    else if (Array.isArray(v)) out[key] = v.slice(0, 50).map((x) => (typeof x === 'string' ? x.slice(0, 200) : x))
    else if (typeof v === 'object') out[key] = sanitizeProperties(v)
    else out[key] = String(v).slice(0, MAX_STRING_LENGTH)
  }
  return out
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    let body: AnalyticsEventBody | AnalyticsEventBody[]
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const events = Array.isArray(body) ? body : [body]
    if (events.length === 0 || events.length > 20) {
      return NextResponse.json({ error: 'Send 1–20 events per request' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user ?? null

    const rows = events.map((ev) => {
      const eventType = sanitizeString(ev.event_type, 80)
      const eventName = sanitizeString(ev.event_name, 200)
      if (!eventType || !eventName) return null
      return {
        user_id: user?.id ?? null,
        session_id: sanitizeString(ev.session_id, 64) || undefined,
        anonymous_id: sanitizeString(ev.anonymous_id, 64) || undefined,
        event_type: eventType,
        event_name: eventName,
        page: sanitizeString(ev.page, MAX_STRING_LENGTH) || undefined,
        path: sanitizeString(ev.path, 500) || undefined,
        referrer: sanitizeString(ev.referrer, 500) || undefined,
        properties: sanitizeProperties(ev.properties ?? {}),
        user_agent: sanitizeString(ev.user_agent, 500) || undefined,
        viewport_width: typeof ev.viewport_width === 'number' && Number.isFinite(ev.viewport_width) ? ev.viewport_width : undefined,
        viewport_height: typeof ev.viewport_height === 'number' && Number.isFinite(ev.viewport_height) ? ev.viewport_height : undefined,
      }
    }).filter(Boolean) as Array<Record<string, unknown>>

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid events' }, { status: 400 })
    }

    const { error } = await supabase.from('analytics_events').insert(rows)
    if (error) {
      const msg = `${error.message ?? ''} ${(error as { details?: string }).details ?? ''}`.toLowerCase()
      const unreachable =
        msg.includes('fetch failed') ||
        msg.includes('enotfound') ||
        msg.includes('getaddrinfo') ||
        msg.includes('econnrefused') ||
        msg.includes('etimedout') ||
        msg.includes('eai_again')
      if (unreachable) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            'Analytics: Supabase unreachable (check NEXT_PUBLIC_SUPABASE_URL and network). Events dropped for this request.'
          )
        }
        return NextResponse.json({ ok: true, count: rows.length, stored: false })
      }
      console.error('Analytics insert error', error)
      return NextResponse.json({ error: 'Failed to store event' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: rows.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const unreachable =
      /fetch failed|enotfound|getaddrinfo|econnrefused|etimedout/i.test(msg)
    if (unreachable) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Analytics: upstream unreachable.', msg)
      }
      return NextResponse.json({ ok: true, stored: false })
    }
    console.error('Analytics API error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
