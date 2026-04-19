# UniProfit — Ecommerce Profit Control Center

*"Stop Losing Money Without Realizing It."*

Short reference for the ecommerce app at `/ecommerce`.

---

## What It Is

Single-page **AI-powered profit control center** for ecommerce operators. Users add products (SKUs), enter company costs, pick a period, and get instant clarity on margins, hidden losses, break-even, what-if scenarios, cash flow risk, and quantitative AI recommendations — in 60 seconds.

---

## Features

| Area | Description |
|------|-------------|
| **Products (SKUs)** | Add/remove rows. Per SKU: name, cost/unit, DC/unit, packaging, sell price, units sold, return %, and "recovery on return" (affects whether returns lose full cost or only DC+packaging). |
| **Company costs** | Single set per period: rent, salaries, marketing, tools/software, other fixed. |
| **Period** | Weekly, monthly, or yearly — all figures use the same period. |
| **Reveal My True Profit** | Runs validation, then shows: total revenue, variable/fixed/total cost, net profit, profit margin, break-even revenue, health (strong/moderate/risk), and per-SKU contribution/margin. |
| **What-If Scenario Simulator** | Slider-based simulator: adjust sell price (%), return rate (pp), units sold (%), and ad/marketing spend (%). Instantly recalculates and shows a baseline vs projected comparison table for revenue, costs, profit, margin, and break-even. Transforms the tool from *reporting* into *strategy*. |
| **Cash Flow Risk Indicator** | Enter cash on hand. System calculates monthly burn rate, fixed costs, runway in months, and risk level (Low / Moderate / Critical) with visual urgency cues. Shows "At your current burn rate, you will run out of cash in X months." |
| **Goal Tracking** | Set target margin (%), revenue, and profit. Shows progress bars with percentage completion and gap analysis. |
| **Profit Trends** | Mini line charts of net profit and margin over time, pulled from recorded calendar plans. Links to full Analytics page. |
| **AI Suggestions (Premium)** | Quantitative, SKU-specific recommendations from Gemini. E.g. "Increasing Cap price by 3% would improve margin from 14% to 18%, adding ~$420/month." Requires `GEMINI_API_KEY`. |
| **Templates (scenarios)** | Save current inputs as a named template; load from dropdown. List/delete in a popover. Stored in Supabase per user. |
| **Record on calendar** | After calculating, user can "Record on calendar": creates a plan for a date range (derived from period). Used for analytics; prevents overlapping plans for same dates. |
| **Export** | Download CSV (SKU breakdown + totals), Print summary (opens print-friendly window). |
| **UX** | Currency selector (USD, GBP, EUR, PKR), compact view toggle, light/dark theme. Session-expired handling with link to login. |
| **Auth** | Login/Logout in header. Calculate without account; save templates, calendar, and AI suggestions require sign-in. Pending calculation can be restored after login via sessionStorage. |

---

## Strategic Positioning

- **Punchline**: "Stop Losing Money Without Realizing It."
- **Hero**: "Know If Your Store Is Actually Profitable" / "Your AI-powered profit control center for ecommerce."
- **CTA**: "Reveal My True Profit"
- **Value pillars**: Speed (60-second clarity), Accuracy (data-backed), Decision confidence (what-if modeling), Risk prevention (cash flow + AI)

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| **Framework** | Next.js 16 (App Router), React 19, Turbopack in dev |
| **UI** | Tailwind CSS, Radix UI (Button, Input, Card, Dialog, Select, Popover, Calendar, Switch, Slider, Progress), `lucide-react` icons, `next-themes` (dark/light) |
| **Charts** | Recharts (LineChart for trends), Radix Progress bars for goals |
| **Auth & data** | Supabase: Auth (session), `scenarios` and `plans` tables with RLS |
| **API** | `POST /api/suggestions` — calls Google Gemini (`gemini-2.5-flash-lite`) with quantitative prompt for SKU-level recommendations |
| **Dates** | `date-fns` (format, addDays, endOfMonth, endOfYear, parseISO, startOfMonth), `react-day-picker` (Calendar component) |
| **State** | React `useState` / `useEffect` / `useMemo` / `useRef`; no global store |

---

## Data Model (Supabase)

- **`scenarios`** — Saved templates: `user_id`, `name`, `period`, `skus` (JSONB), `company_costs` (JSONB), `created_at`. RLS: user can CRUD own rows.
- **`plans`** — Calendar records: `user_id`, `scenario_id`, `start_date`, `end_date`, `net_profit`, `profit_margin`, `created_at`. RLS: user can CRUD own rows. Used by analytics and trend charts.

- **`ai_suggestions_cooldown`** — One row per user: `user_id`, `ends_at`. Enforces 1-hour cooldown for AI suggestions server-side (no client bypass). RLS: user can read/insert/update own row.

Schema and RLS are in `supabase-scenarios.sql` (run Part 3 for the cooldown table).

---

## Key Files

| Path | Purpose |
|------|---------|
| `app/ecommerce/page.tsx` | Main page: form, results (metrics, what-if simulator, cash flow risk, goal tracking, trends), header, dialogs, inline `ThemeToggle`. |
| `app/api/suggestions/route.ts` | Quantitative AI prompt → Gemini → SKU-specific numeric recommendations. Uses `GEMINI_API_KEY`. |
| `lib/format-currency.ts` | `formatMoney`, `getCurrencySymbol`, `CURRENCY_OPTIONS` (USD, GBP, EUR, PKR). |
| `contexts/auth-context.tsx` | `useAuth()` → `user`, `loading`, `signOut`; Supabase auth state. |
| `lib/supabase/client.ts` | Browser Supabase client for auth and data. |

---

## Env / Config

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and auth callback configured).
- **AI suggestions**: `GEMINI_API_KEY` in env (e.g. `.env.local`). If missing, API returns 500 with a clear message.
- **App analytics**: Events are stored in Supabase table `analytics_events`. Run Part 4 of `supabase-scenarios.sql`, then see **docs/ANALYTICS-SUPABASE.md** for schema and example queries.

---

## Troubleshooting

### Internal Server Error or "Persisting failed: Another write batch or compaction is already active"

Turbopack’s dev cache can hit concurrent-write errors and leave the app in a bad state. Default `npm run dev` now uses Webpack to avoid this.

1. Stop the dev server (Ctrl+C).
2. Clear the cache and restart:
   ```bash
   npm run clean && npm run dev
   ```
   On Windows, delete the `.next` and `node_modules/.cache` folders manually, then run `npm run dev`.
3. To use Turbopack again (faster, but can show the above errors): `npm run dev:turbo`.

### Runtime ChunkLoadError (e.g. `Failed to load chunk /_next/static/chunks/...`)

Same as above: run `npm run clean && npm run dev`. The default dev script no longer uses Turbopack, which also avoids most chunk load errors.

---

## Summary

One client-rendered page positioned as a profit control center (not a calculator). Core calculator plus four strategic features: What-If Simulator (decision engine), Cash Flow Risk (survival monitoring), Goal Tracking (retention), and Profit Trends (recurring engagement). AI suggestions upgraded from generic to quantitative/SKU-specific. Supabase for auth and persistence, Gemini for intelligence, Recharts for visualization.
