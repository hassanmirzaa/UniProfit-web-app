-- Run in Supabase Dashboard → SQL Editor
-- Trading: watchlist and portfolio

-- Watchlist: user's saved symbols per market
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null default 'PSX',
  symbol text not null,
  name text,
  created_at timestamptz not null default now(),
  unique(user_id, market, symbol)
);

alter table public.watchlist enable row level security;

create policy "Users can read own watchlist"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "Users can insert own watchlist"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own watchlist"
  on public.watchlist for delete
  using (auth.uid() = user_id);

create index if not exists watchlist_user_market_idx on public.watchlist(user_id, market);

-- Portfolio: user's positions (buying price, quantity) for P&L
create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null default 'PSX',
  symbol text not null,
  name text,
  buy_price numeric not null,
  quantity numeric not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.portfolio enable row level security;

create policy "Users can read own portfolio"
  on public.portfolio for select
  using (auth.uid() = user_id);

create policy "Users can insert own portfolio"
  on public.portfolio for insert
  with check (auth.uid() = user_id);

create policy "Users can update own portfolio"
  on public.portfolio for update
  using (auth.uid() = user_id);

create policy "Users can delete own portfolio"
  on public.portfolio for delete
  using (auth.uid() = user_id);

create index if not exists portfolio_user_market_idx on public.portfolio(user_id, market);
