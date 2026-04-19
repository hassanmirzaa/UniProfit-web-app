'use client'

import { ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import { track } from '@/lib/analytics'

export type AffiliateVariant = 'logistics' | 'broker' | 'daraz' | 'accounting'

interface AffiliateCardProps {
  variant: AffiliateVariant
  className?: string
  dismissible?: boolean
}

const AFFILIATES: Record<AffiliateVariant, {
  badge: string
  headline: string
  body: string
  cta: string
  href: string
  accent: string
  icon: string
}> = {
  logistics: {
    badge: 'Sponsored',
    headline: 'Cut your delivery costs by up to 20%',
    body: 'PostEx covers 400+ cities across Pakistan. Open your seller account free — no minimum shipments.',
    cta: 'Open free seller account →',
    href: process.env.NEXT_PUBLIC_AFFILIATE_LOGISTICS_URL || 'https://postex.pk',
    accent: 'border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/20',
    icon: '🚚',
  },
  broker: {
    badge: 'Sponsored',
    headline: 'Trade PSX stocks with zero account fee',
    body: 'Open a verified brokerage account online in minutes. Full PSX access, real-time data, mobile app.',
    cta: 'Open trading account →',
    href: process.env.NEXT_PUBLIC_AFFILIATE_BROKER_URL || 'https://ahsec.com.pk',
    accent: 'border-green-500/30 bg-green-50/60 dark:bg-green-950/20',
    icon: '📈',
  },
  daraz: {
    badge: 'Partner',
    headline: 'Sell to 40M+ buyers on Daraz',
    body: 'Register as a Daraz seller for free. Access seller tools, promotions, and nationwide logistics.',
    cta: 'Register as seller →',
    href: 'https://seller.daraz.pk',
    accent: 'border-orange-500/30 bg-orange-50/60 dark:bg-orange-950/20',
    icon: '🛍️',
  },
  accounting: {
    badge: 'Sponsored',
    headline: 'Automate your bookkeeping',
    body: 'Connect your bank and get real-time P&L, tax reports, and invoice tracking — built for Pakistani SMEs.',
    cta: 'Try free for 30 days →',
    href: '#',
    accent: 'border-purple-500/30 bg-purple-50/60 dark:bg-purple-950/20',
    icon: '📊',
  },
}

const DISMISS_KEY = (variant: AffiliateVariant) => `uniprofit_ad_dismissed_${variant}`

export function AffiliateCard({ variant, className = '', dismissible = true }: AffiliateCardProps) {
  const ad = AFFILIATES[variant]
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISS_KEY(variant)) === '1'
  })

  if (dismissed) return null

  const handleClick = () => {
    track('ad_click', `affiliate_${variant}`, { variant, href: ad.href })
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY(variant), '1')
    } catch { /* storage blocked */ }
    track('ad_dismiss', `affiliate_${variant}`, { variant })
    setDismissed(true)
  }

  return (
    <div
      className={`relative rounded-xl border px-4 py-3 ${ad.accent} ${className}`}
      role="complementary"
      aria-label="Sponsored content"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{ad.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {ad.badge}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{ad.headline}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ad.body}</p>
          <a
            href={ad.href}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleClick}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-1.5"
          >
            {ad.cta}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
            aria-label="Dismiss ad"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
