-- Run this in Supabase Dashboard → SQL Editor to enable save/load scenarios.
-- If you already have scenarios set up and only need the calendar plans table,
-- run only the block below labeled "Part 2: Plans only".

-- Part 1: Scenarios (skip if you already ran this)
create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  period text not null,
  skus jsonb not null default '[]',
  company_costs jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.scenarios enable row level security;

create policy "Users can read own scenarios"
  on public.scenarios for select
  using (auth.uid() = user_id);

create policy "Users can insert own scenarios"
  on public.scenarios for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scenarios"
  on public.scenarios for update
  using (auth.uid() = user_id);

create policy "Users can delete own scenarios"
  on public.scenarios for delete
  using (auth.uid() = user_id);

create index if not exists scenarios_user_id_idx on public.scenarios(user_id);

-- =============================================================================
-- Part 2: Plans only (run this block alone if scenarios table already exists)
-- =============================================================================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  net_profit numeric not null default 0,
  profit_margin numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint plans_end_after_start check (end_date >= start_date)
);

alter table public.plans enable row level security;

create policy "Users can read own plans"
  on public.plans for select
  using (auth.uid() = user_id);

create policy "Users can insert own plans"
  on public.plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plans"
  on public.plans for update
  using (auth.uid() = user_id);

create policy "Users can delete own plans"
  on public.plans for delete
  using (auth.uid() = user_id);

create index if not exists plans_user_id_idx on public.plans(user_id);
create index if not exists plans_dates_idx on public.plans(start_date, end_date);

-- Analytics: cache for AI suggestions so we only call Gemini when calendar data changes
create table if not exists public.analytics_suggestions_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_ids_signature text not null,
  suggestions jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.analytics_suggestions_cache enable row level security;

create policy "Users can read own analytics cache"
  on public.analytics_suggestions_cache for select
  using (auth.uid() = user_id);
 
create policy "Users can insert own analytics cache"
  on public.analytics_suggestions_cache for insert
  with check (auth.uid() = user_id);

create policy "Users can update own analytics cache"
  on public.analytics_suggestions_cache for update
  using (auth.uid() = user_id);

-- =============================================================================
-- Part 3: AI suggestions cooldown (1 hour per user, enforced server-side)
-- =============================================================================
create table if not exists public.ai_suggestions_cooldown (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ends_at timestamptz not null default (now() + interval '1 hour')
);

alter table public.ai_suggestions_cooldown enable row level security;

create policy "Users can read own ai cooldown"
  on public.ai_suggestions_cooldown for select
  using (auth.uid() = user_id);

create policy "Users can insert own ai cooldown"
  on public.ai_suggestions_cooldown for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ai cooldown"
  on public.ai_suggestions_cooldown for update
  using (auth.uid() = user_id);

-- =============================================================================
-- Part 4: App analytics (detailed event tracking for web app usage)
-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor. View data in Table Editor or run
-- the example queries in docs/ANALYTICS-SUPABASE.md.
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Who & session
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  anonymous_id text,

  -- What
  event_type text not null,
  event_name text not null,
  page text,
  path text,
  referrer text,

  -- Flexible event-specific data (e.g. button name, scenario_id, period, sku_count, net_profit, error message)
  properties jsonb not null default '{}',

  -- Environment (optional, can be stored in properties instead)
  user_agent text,
  viewport_width int,
  viewport_height int
);

alter table public.analytics_events enable row level security;

-- Allow app to insert events: authenticated users with their user_id, or anonymous (user_id null)
create policy "App can insert analytics events"
  on public.analytics_events for insert
  with check (
    (auth.uid() = user_id) or (user_id is null)
  );

-- No SELECT policy for anon key: only service_role (Dashboard, SQL, API with service key) can read.
-- This keeps event data private and queryable only in Supabase Dashboard / your backend.

create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_event_type_idx on public.analytics_events(event_type);
create index if not exists analytics_events_user_id_idx on public.analytics_events(user_id);
create index if not exists analytics_events_session_id_idx on public.analytics_events(session_id);
create index if not exists analytics_events_page_idx on public.analytics_events(page);
