'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackPageView } from '@/lib/analytics'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/ecommerce': 'Profit calculator',
  '/calendar': 'Calendar',
  '/analytics': 'Analytics',
  '/login': 'Login',
  '/trading': 'Trading',
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    if (prevPath.current === pathname) return
    prevPath.current = pathname
    const title = PAGE_TITLES[pathname] || pathname
    trackPageView(pathname, title)
  }, [pathname])

  return <>{children}</>
}
