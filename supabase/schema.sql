-- ─────────────────────────────────────────────────────────────────────────────
-- StockIQ — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. User Profiles ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  risk_tolerance text default 'Moderate' check (risk_tolerance in ('Conservative','Moderate','Aggressive')),
  avatar_url    text,
  created_at    timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. Watchlist ──────────────────────────────────────────────────────────────
create table if not exists public.watchlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  ticker     text not null,
  company    text,
  notes      text,
  added_at   timestamptz default now(),
  unique(user_id, ticker)
);

-- ── 3. Saved Picks ────────────────────────────────────────────────────────────
create table if not exists public.saved_picks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  ticker       text not null,
  pick_type    text default 'Growth' check (pick_type in ('Growth','Value','Options','Earnings')),
  target_price numeric(10,2),
  stop_loss    numeric(10,2),
  notes        text,
  saved_at     timestamptz default now()
);

-- ── 4. User Settings (stores full portfolio + app state as jsonb) ─────────────
create table if not exists public.user_settings (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  settings          jsonb default '{}'::jsonb,
  updated_at        timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS) — each user only sees their own data
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.watchlists    enable row level security;
alter table public.saved_picks   enable row level security;
alter table public.user_settings enable row level security;

-- profiles
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- watchlists
create policy "Users can view own watchlist"
  on public.watchlists for select using (auth.uid() = user_id);
create policy "Users can insert into own watchlist"
  on public.watchlists for insert with check (auth.uid() = user_id);
create policy "Users can delete from own watchlist"
  on public.watchlists for delete using (auth.uid() = user_id);
create policy "Users can update own watchlist"
  on public.watchlists for update using (auth.uid() = user_id);

-- saved_picks
create policy "Users can view own picks"
  on public.saved_picks for select using (auth.uid() = user_id);
create policy "Users can insert own picks"
  on public.saved_picks for insert with check (auth.uid() = user_id);
create policy "Users can delete own picks"
  on public.saved_picks for delete using (auth.uid() = user_id);

-- user_settings
create policy "Users can view own settings"
  on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings"
  on public.user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings"
  on public.user_settings for update using (auth.uid() = user_id);
create policy "Users can delete own settings"
  on public.user_settings for delete using (auth.uid() = user_id);
