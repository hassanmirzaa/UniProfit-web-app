# UniProfit — Product Strategy, Competitive Analysis & Monetization Playbook

**Date:** April 2026  
**Author:** Product Strategy Review  
**Status:** Internal Reference

---

## Table of Contents

1. [What UniProfit Actually Is](#1-what-uniprofit-actually-is)
2. [Honest Value Assessment](#2-honest-value-assessment)
3. [Target User Profiles](#3-target-user-profiles)
4. [Competitive Landscape](#4-competitive-landscape)
5. [Where You Win, Where You Lose](#5-where-you-win-where-you-lose)
6. [Is It Monetizable?](#6-is-it-monetizable)
7. [Monetization Strategy](#7-monetization-strategy)
8. [Tier Structure & Pricing](#8-tier-structure--pricing)
9. [High-Value Features to Build Next](#9-high-value-features-to-build-next)
10. [Go-To-Market Approach](#10-go-to-market-approach)
11. [12-Month Revenue Roadmap](#11-12-month-revenue-roadmap)

---

## 1. What UniProfit Actually Is

UniProfit is a **business intelligence tool for Pakistani SME operators and traders**. It bundles two distinct products:

### Product A — Ecommerce Profit Calculator (Core)

A multi-SKU, period-aware profit calculator that goes far beyond a spreadsheet:

- Handles **cost of goods, delivery charges, packaging, return rates, and return recovery logic** per SKU
- Computes **true net profit** after all variable and fixed costs
- **Contribution margin ratio** and **break-even revenue** — proper financial metrics
- **Health scoring** (Strong / Moderate / Risk) with color-coded SKU table
- **What-if scenario sliders** (price, return rate, units, ad spend)
- **Cash flow runway** from cash on hand
- **Goal tracking** (target margin, revenue, profit)
- **AI suggestions** via Gemini (per-SKU, quantitative, gated behind auth + 1h cooldown)
- **Save/load scenario templates** in Supabase
- **Record plans on a calendar** with date-range tracking
- **CSV export and print** view
- **Multi-currency**: USD, GBP, EUR, PKR
- Guest → analyze → gate → login flow (smart friction)

### Product B — PSX Trading Terminal (Secondary)

- Symbol search + watchlist (saved per user)
- Portfolio with **real P&L** from live prices (WebSocket ticks)
- **Candlestick charts** (1m / 5m / 15m / 1h / 1d)
- Company info card
- Live price streaming via PSX Terminal API

### Product C — Calendar & Analytics Layer

- **Calendar view** of all saved plans — profit/loss days color-coded
- **Monthly charts**: net profit area, bar, and margin trend line (Recharts)
- **AI analytics insights** from calendar data (cached, Gemini-powered)
- Click any day → open scenario in calculator

---

## 2. Honest Value Assessment

### What works well

| Strength | Why It Matters |
|----------|----------------|
| **Return rate + recovery logic** | No free tool handles this correctly. Returns are a major silent cost killer for ecommerce. |
| **Break-even revenue** | Rare in free tools. Serious business metric. |
| **What-if sliders** | Turns a calculator into a decision tool. Huge for ops decisions. |
| **Calendar planning layer** | No competitor does profit planning on a calendar this way. Unique. |
| **AI suggestions with SKU context** | Gemini is given real numbers — not generic advice. |
| **Cash runway** | Operationally critical, almost nowhere in free tools. |
| **PSX watchlist + live P&L** | Directly useful for Pakistani retail investors. |
| **PKR support** | Competes locally where no global tool bothers. |
| **Multi-auth** (Google, email, OTP) | Low friction signup. |
| **Save/load templates** | Recurring businesses need this every week. |

### What is currently weak or missing

| Gap | Impact |
|-----|--------|
| No paid tier exists | Zero revenue path today |
| PSX and ecommerce feel like two separate apps | Reduces perceived cohesion |
| Analytics page has no drill-down | Low utility once novelty wears off |
| AI suggestion cooldown is 1h — but there's no visible value ladder to justify paying | Users hit wall with no upgrade option |
| No onboarding / empty state guidance | New users see blank form and leave |
| No team / collaboration features | Limits B2B potential |
| No mobile-native experience | Majority of Pakistani SME operators are mobile-first |
| Trading terminal has no price alerts | Core feature for any trading tool |
| No notifications (email or push) | Zero retention mechanism |
| No Shopify / WooCommerce / Daraz integration | Manual entry is a recurring friction point |

---

## 3. Target User Profiles

### Primary: Pakistani Ecommerce Operator
- Sells on **Daraz, Instagram, WhatsApp**, own website
- Carries **5–50 SKUs**, often fashion/garments, electronics accessories, cosmetics
- Does math in WhatsApp notes or Excel — no formal P&L discipline
- Gets hit by return rates (15–40% on Daraz) and doesn't know true profit
- **Willingness to pay: Rs 1,000–5,000/month** for something that saves them from losing money

### Secondary: Pakistani Retail Trader (PSX)
- Watches 10–30 symbols on PSX
- Currently uses PSX Terminal or WhatsApp groups for tips
- Needs portfolio P&L without broker app friction
- **Willingness to pay: Rs 500–2,000/month** for real-time alerts + analytics

### Tertiary: Freelancer / Service Provider
- Needs to track monthly revenue, costs, margins across clients
- Calculator works for services if they treat each client as a SKU
- **Willingness to pay: Rs 500–1,500/month**

### Emerging: SME Finance Manager
- Small business with 1–5 people managing finance
- Needs monthly P&L tracking, not just a one-time calculator
- Scenario planning ("if I cut salaries 10%, what happens?")
- **Willingness to pay: Rs 3,000–10,000/month** — but needs team features

---

## 4. Competitive Landscape

### Direct Ecommerce Profit Calculator Competitors

#### BeProfit (Shopify App) — `beprofit.co`
- **Price**: $25–$250/month USD
- **Strengths**: Shopify integration pulls live order data automatically; multi-channel (Amazon, Facebook Ads)
- **Weaknesses**: Shopify-only, no PSX, no Pakistan market focus, USD pricing makes it inaccessible for Pakistani users
- **Your edge**: Multi-channel manual entry, PKR, calendar, return recovery logic, PSX integration

#### Triple Whale — `triplewhale.com`
- **Price**: $129–$999/month USD
- **Strengths**: Deep ad attribution, Shopify native, real-time dashboards
- **Weaknesses**: Extremely expensive, US/EU focused, overkill for SME
- **Your edge**: Price, simplicity, local market fit

#### TrueProfit — `trueprofit.io`
- **Price**: $25–$300/month USD
- **Strengths**: Shopify, real-time profit dashboard, multi-currency
- **Weaknesses**: SaaS-only for Shopify sellers, no manual SKU input, no Pakistan/Daraz support
- **Your edge**: Manual SKU input (Daraz/Instagram sellers can't integrate), PKR, trading terminal

#### SellerBoard — `sellerboard.com`
- **Price**: $19–$63/month USD
- **Strengths**: Amazon-specific, PPC analysis
- **Weaknesses**: Amazon-only, no local Pakistani market
- **Your edge**: Daraz/multi-channel focus

#### Shopify Analytics (free with Shopify)
- **Weaknesses**: Only works if you have a Shopify store; no return recovery logic; no fixed cost management; no break-even
- **Your edge**: Works for anyone — Instagram, WhatsApp, Daraz, offline

### Local / Pakistan-Specific Competitors

#### Spreadsheet (Google Sheets / Excel)
- **Effectively the biggest competitor** — free, familiar, but requires setup expertise
- **Your edge**: 10x faster to set up, AI suggestions, visual health scoring, no formula errors

#### PSX Terminal — `psxterminal.com`
- Your **data provider**, not a direct product competitor yet
- They don't offer portfolio P&L, calendar, or ecommerce features
- **Risk**: They could build a consumer-facing product

#### SaharaIO / Local Pakistani SaaS (emerging)
- Small, fragmented market — no dominant player for SME profit tracking in Pakistan

### Indirect Competitors

| Tool | What They Do | Your Advantage |
|------|-------------|----------------|
| Wave Accounting (free) | Full accounting, invoicing | You're faster, more decision-focused, no accountant needed |
| QuickBooks | Full accounting | Price, simplicity, no local flavor |
| Zoho Analytics | BI dashboards | No ecommerce profit calculator, no PSX |
| LivePlan | Business planning | Expensive ($20/mo USD), no Pakistan fit |
| ProfitWell | SaaS metrics | Not relevant for ecommerce/trading |

---

## 5. Where You Win, Where You Lose

### You Win When:
- The user sells on Daraz, Instagram, or WhatsApp (no Shopify integration possible)
- They have return rate problems they don't fully understand
- They need break-even analysis before a restocking decision
- They trade PSX stocks and want portfolio P&L in one place
- They want to see if last month was actually profitable (calendar)
- They are Pakistani and uncomfortable with USD SaaS pricing

### You Lose When:
- The user runs a Shopify store and wants automatic data pull
- They need accounting (invoicing, tax, payroll)
- They need team collaboration
- They want mobile app (current is web-only)
- They want price alerts on stocks

---

## 6. Is It Monetizable?

**Yes — with strong conviction.** Here is why:

1. **The problem is financially painful.** Pakistani ecommerce operators lose 10–30% of profit to returns they don't account for. A tool that shows them their real number has direct ROI.

2. **No dominant local competitor.** The Pakistani SME fintech space is thin. Being first with a polished, locally-priced tool matters.

3. **AI creates a natural upgrade gate.** You already have the AI cooldown mechanic — users hit it and have nowhere to go. One paid tier removes it.

4. **PKR pricing removes the USD barrier.** Global tools at $25/month USD feel expensive to a Pakistani small business. At Rs 999/month, you are less than a single product return.

5. **Recurring behavior.** Businesses run numbers weekly/monthly. This is naturally a subscription product — not a one-time calculator.

6. **Calendar + Analytics creates lock-in.** Once a user has 3 months of plans recorded, they will not leave. This is the most powerful retention feature you have.

**Conservative estimate**: 500 paying users at Rs 1,500/month average = **Rs 750,000/month (~$2,700 USD/month)** — achievable in 12–18 months with focused marketing.

---

## 7. Monetization Strategy

### Core Philosophy
> Gate features that provide **ongoing value**, not one-time value. Free users should get enough to understand the product works; paid users get the tools to run their business on it.

### What Should Stay Free (Forever)
- Single-session calculator (no save)
- Up to 5 SKU rows
- Basic results (net profit, margin)
- Health status
- Login with Google

**Why**: Free tier is your acquisition channel. It must be useful enough to demo the product but incomplete enough to drive upgrade.

### What Gets Gated

| Feature | Free | Starter | Pro | Business |
|---------|------|---------|-----|----------|
| SKU rows | 5 | 15 | Unlimited | Unlimited |
| Saved templates | 0 | 3 | Unlimited | Unlimited |
| Calendar plans | 0 | 10/month | Unlimited | Unlimited |
| What-if sliders | No | Yes | Yes | Yes |
| Cash flow runway | No | Yes | Yes | Yes |
| Goal tracking | No | Yes | Yes | Yes |
| AI suggestions | No | 3/month | Unlimited | Unlimited |
| Analytics charts | No | Basic | Full | Full |
| AI analytics insights | No | No | Yes | Yes |
| CSV export | Yes | Yes | Yes | Yes |
| Trading watchlist | 5 symbols | 20 | Unlimited | Unlimited |
| Trading portfolio | No | Yes | Yes | Yes |
| Price alerts (PSX) | No | No | 5 alerts | Unlimited |
| Team members | No | No | No | 3 members |
| Priority support | No | No | Yes | Yes |

---

## 8. Tier Structure & Pricing

### Recommended Pricing (PKR-first)

| Tier | Monthly (PKR) | Annual (PKR) | USD Equivalent |
|------|--------------|--------------|----------------|
| **Free** | 0 | 0 | — |
| **Starter** | Rs 799 | Rs 7,190 (~25% off) | ~$2.9/mo |
| **Pro** | Rs 1,999 | Rs 17,990 (~25% off) | ~$7.2/mo |
| **Business** | Rs 4,999 | Rs 44,990 | ~$18/mo |

### Why These Numbers
- **Rs 799** is below the psychological "Rs 1,000" barrier. Feels like "less than two coffees."
- **Rs 1,999** is the sweet spot for a serious sole-trader operator — affordable but filters out non-serious users.
- **Rs 4,999** for team/agency use — still far below any USD competitor.
- Annual discount drives LTV and reduces churn.

### Payment Infrastructure for Pakistan
- **JazzCash / EasyPaisa** — mandatory for Pakistan (most SME owners are not credit-card holders)
- **Card** via Stripe or local acquirer
- **Bank transfer** option for Business tier (common for B2B in Pakistan)

---

## 9. High-Value Features to Build Next

Ranked by **revenue impact × build cost ratio**. Build in this order.

---

### Tier 1: Build These First (Unlock Monetization)

#### 1. Paywall / Upgrade Flow (Critical Path)
**What**: When a user hits a limit (6th SKU, save button, AI button), show a smooth upgrade modal with tier comparison and payment CTA.  
**Why**: Nothing above matters without this. Currently there is **no way to pay**.  
**Effort**: Medium. Stripe/JazzCash integration + upgrade gate logic per feature.

#### 2. AI Suggestions — Remove Cooldown for Pro/Business
**What**: Paid users get unlimited AI suggestions per session or per day (not per hour).  
**Why**: The 1h cooldown is the most visible "pay to unlock" moment in the app today. Users are already hitting it.  
**Effort**: Low. One DB check on `tier` before cooldown logic.

#### 3. Unlimited Templates + Plan History
**What**: Free users can save 0 templates. Paid users get 3 or unlimited.  
**Why**: Templates are the #1 retention driver — once saved, users return weekly. This makes the value of paying obvious.  
**Effort**: Low. Supabase RLS count check before insert.

---

### Tier 2: Retention & Engagement Features

#### 4. Weekly Email Digest
**What**: Every Monday, send users a summary: "Last week you were [health status]. Profit: Rs X. Top performing SKU: Y."  
**Why**: Retention. Users who don't log in lose the habit. Email brings them back.  
**Tech**: Supabase Edge Function + Resend.com or SendGrid. Trigger on weekly cron.  
**Effort**: Medium.

#### 5. PSX Price Alerts
**What**: User sets a target price for a watchlist symbol. When price crosses threshold, send push/email notification.  
**Why**: This is the single most-requested feature for any trading watchlist tool. Missing this loses serious traders.  
**Tech**: WebSocket listener in a background Edge Function or serverless worker. Notification via email or Web Push.  
**Effort**: Medium–High.

#### 6. Daraz Order Import (CSV/Excel)
**What**: User exports their Daraz seller order report (CSV) and imports it. App parses SKU names, quantities, prices, and returns. Auto-fills the calculator.  
**Why**: Manual entry is the #1 friction point. Daraz exports are standardized. This removes 80% of friction for the biggest user segment.  
**Effort**: Medium. CSV parser + field mapping UI.

#### 7. Return Rate Tracker Per SKU Over Time
**What**: When a user records a plan, also save the return rate per SKU. Show a trend chart: "Your return rate for SKU X went from 8% → 15% over 3 months."  
**Why**: Return rates creep up and operators don't notice until margins collapse. This is a high-value early warning system.  
**Effort**: Medium. Additional JSONB fields in `plans` + chart on analytics page.

---

### Tier 3: Business-Tier / B2B Features

#### 8. Team / Multi-User Workspace
**What**: Business tier gets a shared workspace. Owner + 2 members can all view and edit the same templates and plans. Role-based: owner, editor, viewer.  
**Why**: Small ecommerce businesses often have a business partner or VA running numbers. This unlocks B2B pricing.  
**Effort**: High. New `workspaces` + `workspace_members` tables, RLS rewrite, invitation flow.

#### 9. Reorder Suggestion Engine
**What**: Based on units sold per period and the restocking lead time the user inputs, calculate "You will run out of SKU X in 12 days. Reorder now to maintain current sales."  
**Why**: Stockouts are the #2 silent profit killer (after returns). This is a direct financial tool.  
**Effort**: Medium. Additional field (lead time days) + calculation + UI card.

#### 10. Supplier Comparison Calculator
**What**: For a given SKU, compare up to 3 suppliers: cost per unit, MOQ, lead time, payment terms. Show which maximizes margin at your current sales volume.  
**Why**: Pakistani ecommerce operators constantly switch suppliers. This is a direct decision tool.  
**Effort**: Medium. New modal UI + comparison table calculation.

---

### Tier 4: Platform / Ecosystem Features

#### 11. Shopify Integration (Limited Read-Only)
**What**: OAuth connect Shopify store. Pull last 30 days of orders by product, auto-fill SKU revenue and units sold. User still sets cost/DC/packaging manually (we don't have that data).  
**Why**: Shopify sellers are the highest-value ecommerce segment globally. Even partial integration removes significant friction.  
**Effort**: High. Shopify API OAuth + product/order sync.

#### 12. Profit Target → Scenario Reverse Calculator
**What**: Instead of entering SKUs and getting profit, let user enter their **target profit** and the app works backward: "To hit Rs 50,000 net profit this month, you need to sell X units of SKU Y at price Z, or cut DC to Rs W."  
**Why**: Operators think in goals, not in calculations. This makes UniProfit a **planning** tool, not just a reporting tool. Unique in the market.  
**Effort**: Medium. Reverse algebra on existing formulas.

#### 13. Mobile App (PWA or Native)
**What**: At minimum, a Progressive Web App with offline support for viewing last plan + calculator.  
**Why**: Pakistan's SME operators are 80% mobile-first. A desktop-only web app has a ceiling.  
**Effort**: High for native. Medium for PWA (manifest + service worker already supportable in Next.js).

#### 14. WhatsApp Report Sharing
**What**: One-tap "Share via WhatsApp" that sends a formatted summary: "This month's profit: Rs 45,000. Margin: 18%. Break-even: Rs 120,000. [Link to UniProfit]"  
**Why**: Pakistani business communication is WhatsApp-native. Every shared report is a referral impression.  
**Effort**: Low. WhatsApp deep link with pre-filled text + Web Share API fallback.

#### 15. Benchmark Comparison
**What**: After analysis, show: "Your margin (12%) is below average for similar businesses in your category (estimated 18–22%)." Use anonymized aggregate data from your analytics events.  
**Why**: Benchmarks create urgency. Operators who see they're below average will use AI suggestions or upgrade to understand why.  
**Effort**: Medium–High. Requires enough users to build meaningful benchmarks. Can start with hard-coded ranges per category.

---

## 10. Go-To-Market Approach

### Phase 1: Validate Willingness to Pay (Month 1–2)

1. **Add the paywall** before anything else. Even a fake "coming soon — join waitlist for Pro" gathers demand signal.
2. **Post in Pakistani ecommerce Facebook groups** (Daraz Sellers Pakistan, eCommerce Pakistan, etc.) — these have 100k–500k members.
3. **YouTube Shorts / Reels**: 60-second video — "I used to think I was making Rs 80,000 profit. UniProfit showed me I was actually losing Rs 12,000. Here's how."
4. **Daraz Seller Forums**: targeted posts with calculator screenshots showing return rate math.

### Phase 2: Convert Free → Paid (Month 2–4)

1. **In-app upgrade prompts** at every limit hit.
2. **Email sequence**: Day 1 welcome → Day 3 "did you know about break-even?" → Day 7 "your free template limit is up, here's what Pro unlocks" → Day 14 discount offer.
3. **JazzCash payment** — without this, >70% of Pakistani users cannot convert.

### Phase 3: Grow with Referral (Month 4+)

1. **"Powered by UniProfit"** on exported CSV / print view (free tier only) — passive brand exposure.
2. **Referral program**: "Invite a seller, get 1 month Pro free."
3. **WhatsApp sharing** of results (built into product, free tier).

### Phase 4: B2B / Agency (Month 6+)

1. Target **ecommerce agencies and consultants** who manage multiple seller accounts.
2. Business tier with multi-client workspace view.
3. White-label option at premium pricing.

---

## 11. 12-Month Revenue Roadmap

| Milestone | Target | Revenue (PKR/month) |
|-----------|--------|---------------------|
| Paywall live + JazzCash | Month 2 | First Rs 50,000 |
| 100 Starter subscribers | Month 4 | ~Rs 80,000 |
| 200 Pro + 50 Starter | Month 6 | ~Rs 440,000 |
| 500 Pro + 100 Starter | Month 10 | ~Rs 1,080,000 |
| 800 Pro + 200 Starter + 20 Business | Month 12 | ~Rs 1,860,000 (~$6,700 USD) |

> **Conservative scenario** assumes no viral growth, no enterprise deals, purely organic + community marketing.

---

## Summary: The Three Things To Do Right Now

1. **Build the paywall and payment flow first.** No other feature matters until there is a way to pay. Even a simple Stripe link or JazzCash manual collection is better than nothing.

2. **Remove the AI cooldown for paid users.** This is the highest-perceived-value gate you already have. Use it.

3. **Add Daraz CSV import or WhatsApp sharing.** One of these will drive the viral loop that grows free users, who convert to paid.

Everything else in this document is a roadmap, not urgent. Revenue comes from steps 1–3.

---

*This document is a living strategy reference. Revisit quarterly as user data accumulates.*
