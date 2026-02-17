# UniProfit – Profit Calculator

**Think before you sell. Plan before you scale.**

A simple, privacy-focused profit calculator for e-commerce and small business. Add your products (SKUs), company costs, and see real margins, break-even, and AI-powered suggestions. Save scenarios and plan them on a calendar.

![UniProfit](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-green?style=flat-square&logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)

---

## Features

- **Company profit calculator** – Multiple SKUs with cost, DC, packaging, sell price, units, and return handling. One set of company costs (rent, salaries, marketing, etc.). Weekly, monthly, or yearly view.
- **Per-product breakdown** – Contribution and margin per SKU with simple traffic-light styling (green / orange / red).
- **Save & load scenarios** – Name and save plans; load them anytime (requires sign-in).
- **Plan calendar** – Add scenarios to a calendar with start/end dates. Calendar highlights days by profit (green = profit, red = loss, orange = low/no profit). Load a scenario from the calendar into the calculator.
- **Auth** – Sign in with Google, email/password, or email OTP (magic link). Supabase handles sessions.
- **AI suggestions** – Short, actionable suggestions based on your numbers (Gemini API; optional).
- **Export** – Download CSV or print a summary.
- **Currency** – USD, GBP, EUR, PKR in the UI.
- **Compact view** – Toggle for a denser layout.

Your data is stored securely and never shared.

---

## Quick start

### Prerequisites

- Node.js 18+
- pnpm (or npm / yarn)

### 1. Clone and install

```bash
git clone https://github.com/hassanmirzaa/UniProfit-web-app.git
cd UniProfit-web-app
pnpm install
```

### 2. Environment variables

Copy the example env file and add your keys (no secrets are committed):

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `GEMINI_API_KEY` | No | For AI suggestions (get from [Google AI Studio](https://aistudio.google.com/apikey)) |

### 3. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the script in **`supabase-scenarios.sql`** (creates `scenarios` and `plans` tables and RLS). If you already have scenarios, run only the “Part 2: Plans only” block.
3. In Authentication → Providers, enable Email and Google (or others) as needed.
4. Add your site URL and redirect URLs in Authentication → URL configuration (e.g. `http://localhost:3000`, `https://your-domain.com`, `https://your-domain.com/auth/callback`).

### 4. Run the app

```bash
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (Turbopack) at 127.0.0.1:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Run production server |
| `pnpm lint` | Run ESLint |

---

## Project structure

- `app/` – Next.js App Router (pages, API routes, auth callback).
- `components/ui/` – Reusable UI (shadcn-style).
- `contexts/` – Auth context.
- `lib/` – Supabase clients, formatting, utilities.
- `supabase-scenarios.sql` – DB schema for scenarios and plans.

---

## Security

- **No API keys in the repo.** Use `.env.local` (and keep it out of version control). `.env.example` documents required variables only.
- Supabase RLS ensures users only access their own scenarios and plans.
- Auth is handled by Supabase (session cookies, redirects).

---

## License

Private / All rights reserved.
