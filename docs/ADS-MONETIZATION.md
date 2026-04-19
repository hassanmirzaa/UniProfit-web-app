# UniProfit — Ads Monetization Playbook (Phase 1)

**Phase**: 1 (Revenue before payment infrastructure)  
**Goal**: Generate consistent monthly income from traffic while Phase 2 (subscriptions) is built  
**Honest target**: Rs 15,000–80,000/month depending on traffic and ad type mix

---

## The Critical Distinction: Display Ads vs Affiliate Ads

This is the most important decision in your ads strategy. Getting it wrong will:
- Earn very little (display ads in Pakistan = ~$0.5–1.50 CPM)
- Damage user trust and reduce future paid conversions
- Make the product look amateur

### Display Ads (Google AdSense) — What Most People Think Of

| | Reality |
|--|--|
| Pakistan CPM | $0.3 – $1.5 |
| 10,000 page views/month | ~$5–15/month |
| 50,000 page views/month | ~$25–75/month |
| **Verdict** | Only worth it at scale (100k+ monthly views). Use it — but don't rely on it. |

### Affiliate / Partner Ads — What You Should Prioritize

These are **hand-picked, contextually relevant** partner placements. Instead of a generic banner, you show something like:

> 🚚 **"PostEx delivers to 400+ cities — open your seller account free"** → Your affiliate link

A Pakistani ecommerce operator clicking that link and signing up earns you **Rs 500–2,000 per conversion**, vs Rs 0.004 from an AdSense impression.

| Partner Type | Commission Per Signup | Realistic Monthly Potential |
|---|---|---|
| Courier / Logistics (PostEx, Leopards, TCS) | Rs 500–1,500 | Rs 10,000–50,000 |
| PSX Broker Referral (Meezan, Arif Habib) | Rs 500–3,000 | Rs 5,000–30,000 |
| Daraz Seller Registration | TBD (negotiate) | Rs 5,000–20,000 |
| Local Accounting SaaS | 20–30% revenue share | Rs 3,000–15,000 |
| Google AdSense (passive) | ~$0.8 CPM | Rs 2,000–8,000 |

**Combined realistic monthly target at 5,000 MAU**: Rs 20,000–80,000

---

## Ad Placement Map (Where to Show What)

Rules:
1. **Never** put ads inside the calculation form or results numbers — kills trust
2. **Never** put ads in the navigation or header
3. **Always** show ads after the user has gotten value, not before
4. **Affiliate cards** look native — not like ads
5. **AdSense** goes in low-distraction zones: after content sections, sidebar

### `/ecommerce` Page — Primary Revenue Surface

```
[Header: Logo + nav]
[Period selector]
[SKU input form]
[Company costs]
[CTA: Reveal My True Profit]

════════════════════════════════
 ← RESULTS START HERE →
════════════════════════════════

[Health card + metric cards]
[Per-SKU breakdown table]

┌─────────────────────────────────────────────┐
│  AFFILIATE SLOT 1 — Logistics Partner       │
│  "Reduce your delivery cost by 20%..."      │
│  Shown only after analysis, above the fold  │
└─────────────────────────────────────────────┘

[AI suggestions card]
[What-if sliders]
[Cash flow risk]
[Goal tracking]

┌─────────────────────────────────────────────┐
│  ADSENSE SLOT — Horizontal banner           │
│  Placed between what-if and export buttons  │
└─────────────────────────────────────────────┘

[Export buttons]
[Save/Load/Calendar buttons]
```

### `/analytics` Page

```
[KPI summary cards: total profit, total loss, plan count]

┌─────────────────────────────────────────────┐
│  AFFILIATE SLOT 2 — Accounting / Finance    │
│  "Track your taxes automatically..."        │
└─────────────────────────────────────────────┘

[Net profit area chart]
[Monthly bar chart]
[Margin trend chart]

┌─────────────────────────────────────────────┐
│  ADSENSE SLOT — Leaderboard                 │
└─────────────────────────────────────────────┘

[AI insights block]
```

### `/calendar` Page

```
[Calendar view — color-coded days]

┌─────────────────────────────────────────────┐
│  AFFILIATE SLOT 3 — PSX Broker / Finance    │
│  Only shown if user has no plans yet        │
│  "Start tracking your business plans"       │
└─────────────────────────────────────────────┘

[Selected day plan list]
```

### `/login` Page

```
[Auth form]

┌─────────────────────────────────────────────┐
│  ADSENSE SLOT — below form, above footer    │
│  Captive audience, low distraction risk     │
└─────────────────────────────────────────────┘
```

### `/trading` Page

```
[Watchlist | Chart | Portfolio]

┌─────────────────────────────────────────────┐
│  AFFILIATE SLOT 4 — PSX Broker Signup       │
│  "Open a FREE trading account with..."      │
│  Placed in the sidebar below portfolio      │
└─────────────────────────────────────────────┘
```

---

## Phase 1 Implementation Steps

### Step 1: Google AdSense Setup (Day 1)

1. Go to [adsense.google.com](https://adsense.google.com) and apply with this site
2. Add `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=ca-pub-XXXXXXXXXXXXXXXX` to `.env.local`
3. AdSense script is already wired into `app/layout.tsx` via `components/ad-sense-script.tsx`
4. Approval takes 1–2 weeks; until then, slots show nothing (graceful fallback)
5. **Ad unit IDs** — create these in the AdSense dashboard:
   - `Responsive display` unit for `/ecommerce` (use `NEXT_PUBLIC_ADSENSE_SLOT_ECOMMERCE`)
   - `Responsive display` unit for `/analytics` (use `NEXT_PUBLIC_ADSENSE_SLOT_ANALYTICS`)
   - `Responsive display` unit for `/login` (use `NEXT_PUBLIC_ADSENSE_SLOT_LOGIN`)

### Step 2: Affiliate Partnerships (Week 1–2)

Contact these companies directly. Most have referral programs:

#### Logistics / Courier
- **PostEx**: [postex.pk/seller-registration](https://postex.pk) — has an active affiliate program
- **Leopards Courier**: contact their digital/partnerships team
- **TCS Connect**: [tcsconnect.com](https://tcsconnect.com) — seller affiliate
- **Trax**: growing Pakistani logistics startup, very open to partnerships

Email template:
```
Subject: Affiliate Partnership — UniProfit (5,000+ Pakistani ecommerce sellers)

Hi [Name],

I run UniProfit (uniprofit.app), a profit calculator used by Pakistani 
ecommerce sellers on Daraz, Instagram, and WhatsApp.

I'd like to propose a referral partnership where I recommend [Company] 
to my users when they complete their profit analysis. 

Our users are actively selling online and looking for logistics solutions.
I'm proposing a Rs [500–1,000] per-signup commission.

Would you be open to a 15-minute call this week?
```

#### PSX Brokers
- **Arif Habib Limited** (AHL) — has an online account opening referral system
- **Meezan Bank Trading** — Islamic finance angle, large existing user base
- **Optimus Capital** — aggressive referral program for online traders

#### Daraz
- Check [seller.daraz.pk](https://seller.daraz.pk) — they occasionally run seller acquisition campaigns
- Direct pitch to their seller growth team

### Step 3: "Remove Ads" Teaser (Week 2)

Add a small "Remove ads — upgrade to Pro" link below each ad unit.  
This does nothing in Phase 1 (links to a waitlist or "coming soon" page),  
but starts measuring upgrade intent and primes users for Phase 2.

---

## Revenue Tracking

Add UTM parameters to every affiliate link:
```
https://postex.pk/signup?utm_source=uniprofit&utm_medium=affiliate&utm_campaign=calculator_results
```

Track in your analytics dashboard:
- Clicks per ad slot
- Click-through rate per placement
- Affiliate conversions (partner dashboard)
- AdSense RPM (AdSense dashboard)

---

## What NOT To Do

| Don't | Why |
|-------|-----|
| Show ads before the user completes analysis | Kills trust, increases bounce rate |
| Use pop-up / interstitial ads | Destroys UX, Pakistani mobile users will leave |
| Show irrelevant ads (games, crypto scams) | Damages brand credibility |
| Put ads inside the results numbers | Makes results feel untrustworthy |
| Run more than 2 ad units per page | Google penalizes this, slows page |
| Show ads to users who are logged in and active | Save them for the upgrade prompt instead |

---

## Phase 2 Transition: Ads → Subscriptions

When Phase 2 (payments) launches:
- Paid users see **zero ads** — this is a core benefit of paying
- Free users continue to see ads (incentive to upgrade)
- "Remove ads" becomes a bullet point in every upgrade prompt
- Target: ads revenue funds server costs while subscriptions = profit

---

## Environment Variables Needed

Add these to `.env.local`:

```bash
# Google AdSense
NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_ADSENSE_SLOT_ECOMMERCE=1234567890
NEXT_PUBLIC_ADSENSE_SLOT_ANALYTICS=0987654321
NEXT_PUBLIC_ADSENSE_SLOT_LOGIN=1122334455

# Affiliate links (replace with your actual referral URLs)
NEXT_PUBLIC_AFFILIATE_LOGISTICS_URL=https://postex.pk/signup?ref=uniprofit
NEXT_PUBLIC_AFFILIATE_BROKER_URL=https://arihhabib.com/open-account?ref=uniprofit
```
