import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  const redirectUrl = `${origin}${next}`
  const redirectResponse = NextResponse.redirect(redirectUrl)
  const loginErrorUrl = `${origin}/login?error=auth`

  try {
    const cookieStore = await cookies()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Auth callback: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
      return NextResponse.redirect(loginErrorUrl)
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options)
          })
        },
      },
    })

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return redirectResponse
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'magiclink' | 'email' })
      if (!error) return redirectResponse
    }

    return NextResponse.redirect(loginErrorUrl)
  } catch (e) {
    console.error('Auth callback error', e)
    return NextResponse.redirect(loginErrorUrl)
  }
}