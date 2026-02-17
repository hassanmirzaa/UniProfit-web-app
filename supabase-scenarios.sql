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
