'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type AuthContextType = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    return session
  }, [supabase])

  useEffect(() => {
    let cancelled = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setUser(session?.user ?? null)
    })

    refreshSession().then(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase, refreshSession])

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        if (debounce) clearTimeout(debounce)
        return
      }
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (document.visibilityState === 'visible') void refreshSession()
      }, 400)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      if (debounce) clearTimeout(debounce)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refreshSession])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
