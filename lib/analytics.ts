/**
 * Client-side analytics: sends events to POST /api/analytics, stored in Supabase analytics_events.
 * Use track() for custom events; page views are sent automatically by AnalyticsProvider.
 */

const SESSION_ID_KEY = 'uniprofit_analytics_session_id'
const ANON_ID_KEY = 'uniprofit_analytics_anonymous_id'

function getOrCreateId(key: string, storage: Storage): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = storage.getItem(key)
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
      storage.setItem(key, id)
    }
    return id
  } catch {
    return ''
  }
}

export function getSessionId(): string {
  return getOrCreateId(SESSION_ID_KEY, sessionStorage)
}

export function getAnonymousId(): string {
  return getOrCreateId(ANON_ID_KEY, localStorage)
}

export type TrackProperties = Record<string, string | number | boolean | null | undefined>

export function track(
  eventType: string,
  eventName: string,
  properties?: TrackProperties
): void {
  if (typeof window === 'undefined') return
  const sessionId = getSessionId()
  const anonymousId = getAnonymousId()
  const payload = {
    event_type: eventType,
    event_name: eventName,
    page: window.location.pathname || undefined,
    path: window.location.pathname + window.location.search || undefined,
    referrer: document.referrer || undefined,
    properties: properties ?? {},
    session_id: sessionId || undefined,
    anonymous_id: anonymousId || undefined,
    user_agent: navigator.userAgent || undefined,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
  }
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }).catch(() => {})
}

/** Page view: call from AnalyticsProvider on pathname change */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined') return
  const payload = { path, title: title || path }
  const run = () => track('page_view', title || path, payload)
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback
  if (typeof ric === 'function') {
    ric(run, { timeout: 4000 })
  } else {
    window.setTimeout(run, 1)
  }
}
