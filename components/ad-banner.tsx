'use client'

import { useEffect, useRef } from 'react'

interface AdBannerProps {
  slotId: string
  className?: string
}

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

/**
 * Google AdSense display unit.
 * Uses NEXT_PUBLIC_ADSENSE_PUBLISHER_ID or the default UniProfit publisher ID.
 * Slot IDs are page-specific and set via props.
 */
export function AdBanner({ slotId, className = '' }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null)
  const initialized = useRef(false)
  const publisherId =
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || 'ca-pub-6520119728614881'

  useEffect(() => {
    if (!slotId || initialized.current) return
    initialized.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // AdSense not loaded yet or blocked by adblocker
    }
  }, [publisherId, slotId])

  if (!slotId) return null

  return (
    <div className={`flex justify-center items-center overflow-hidden ${className}`} aria-label="Advertisement">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={publisherId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
