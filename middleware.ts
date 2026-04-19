import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

let warnedMiddlewareAuthFailure = false

function isLikelyUnreachableSupabaseError(e: unknown): boolean {
  const parts: string[] = []
  if (e && typeof e === 'object') {
    const err = e as Error & { cause?: unknown }
    parts.push(String(err.message ?? ''))
    const c = err.cause
    if (c && typeof c === 'object' && 'code' in c) parts.push(String((c as { code?: string }).code ?? ''))
    if (c instanceof Error) parts.push(c.message)
  } else parts.push(String(e ?? ''))
  const m = parts.join(' ').toLowerCase()
  return (
    m.includes('enotfound') ||
    m.includes('getaddrinfo') ||
    m.includes('fetch failed') ||
    m.includes('econnrefused') ||
    m.includes('etimedout') ||
    m.includes('networkerror')
  )
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })
  if (process.env.SUPABASE_SKIP_MIDDLEWARE === 'true') {
    return response
  }
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return response
    }
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })
    // Cookie/session sync only — avoid getUser() here (extra Auth API round-trip on every navigation).
    await supabase.auth.getSession()
  } catch (e) {
    if (isLikelyUnreachableSupabaseError(e)) {
      if (process.env.NODE_ENV === 'development' && !warnedMiddlewareAuthFailure) {
        warnedMiddlewareAuthFailure = true
        console.warn(
          '[middleware] Supabase unreachable (DNS/network). Set SUPABASE_SKIP_MIDDLEWARE=true in .env.local to silence Edge retries, or fix NEXT_PUBLIC_SUPABASE_URL.'
        )
      }
      return response
    }
    console.error('Middleware auth error', e)
  }
  return response
}

export const config = {
  matcher: [
    /*
     * Only routes that benefit from edge cookie/session sync. Skipping /ecommerce and / avoids
     * refresh-token fetches on every calculator page view (and log spam when Supabase is down).
     */
    '/login',
    '/auth/:path*',
    '/calendar/:path*',
    '/analytics/:path*',
    '/trading/:path*',
  ],
}
