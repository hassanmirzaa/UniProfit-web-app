'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// V1: go directly to ecommerce. Homepage with Trading + Ecommerce choice commented for later.
// import Link from 'next/link'
// import Image from 'next/image'
// import { TrendingUp, ShoppingCart } from 'lucide-react'

export default function HomeChoicePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/ecommerce')
  }, [router])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <p className="text-muted-foreground text-sm">Redirecting…</p>
    </div>
  )

  /* Commented for v1 — uncomment when we want Trading + Ecommerce choice again:
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-center">
          <Image
            src="/uniProfit-logo.png"
            alt="UniProfit"
            width={240}
            height={72}
            className="h-14 w-auto object-contain"
            priority
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16">
        <p className="text-muted-foreground text-center mb-2 text-sm sm:text-base">
          Know Your Real Numbers Before You Sell.
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-10">
          Choose your mode
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
          <Link
            href="/trading"
            className="group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all shadow-sm"
          >
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Trading</h2>
            <p className="text-sm text-muted-foreground text-center">
              Watchlist, portfolio & real-time P&L. PSX and more.
            </p>
          </Link>

          <Link
            href="/ecommerce"
            className="group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all shadow-sm"
          >
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <ShoppingCart className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-1">E‑commerce</h2>
            <p className="text-sm text-muted-foreground text-center">
              Company profit calculator, templates & analytics.
            </p>
          </Link>
        </div>
      </main>

      <footer className="border-t border-border py-4">
        <p className="text-center text-xs text-muted-foreground">
          Your data is stored securely and never shared.
        </p>
      </footer>
    </div>
  )
  */
}
