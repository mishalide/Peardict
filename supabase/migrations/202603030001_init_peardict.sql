-- Project Peardict baseline schema for Supabase

create table if not exists public.users (
  user_id text primary key,
  balance integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  match_id text primary key,
  blue_team text not null,
  red_team text not null,
  blue_score integer,
  red_score integer,
  winner text,
  market_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.bets (
  id bigint generated always as identity primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  match_id text not null references public.matches(match_id) on delete cascade,
  side text not null check (side in ('blue', 'red')),
  stake integer not null check (stake > 0),
  odds numeric(12,4) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.win_predictions (
  id bigint generated always as identity primary key,
  user_id text not null,
  match_id text,
  predicted_team text,
  match_winner text,
  points_received integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bets_match_id_idx on public.bets(match_id);
create index if not exists bets_user_id_created_at_idx on public.bets(user_id, created_at desc);
create index if not exists matches_market_status_idx on public.matches(market_status);

alter table public.users enable row level security;
alter table public.matches enable row level security;
alter table public.bets enable row level security;
alter table public.win_predictions enable row level security;

-- Public read access for match and leaderboard surfaces
create policy if not exists "public read matches"
  on public.matches for select
  using (true);

create policy if not exists "public read users"
  on public.users for select
  using (true);

create policy if not exists "public read predictions"
  on public.win_predictions for select
  using (true);

-- Example policy for authenticated users reading their own bets.
-- If user_id stores auth UID, this will work directly.
create policy if not exists "users read own bets"
  on public.bets for select
  using (auth.uid()::text = user_id);

create or replace function public.place_bet(
  user_id text,
  match_id text,
  side text,
  stake integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  market_closed boolean;
  total_blue numeric;
  total_red numeric;
  total_pool numeric;
  side_total numeric;
  computed_odds numeric;
  updated_balance integer;
begin
  if side not in ('blue', 'red') then
    return json_build_object('error', 'invalid side');
  end if;

  if stake is null or stake <= 0 then
    return json_build_object('error', 'invalid stake');
  end if;

  select u.balance into current_balance
  from public.users u
  where u.user_id = place_bet.user_id
  for update;

  if current_balance is null then
    return json_build_object('error', 'unknown user');
  end if;

  if current_balance < stake then
    return json_build_object('error', 'insufficient balance');
  end if;

  select (m.blue_score is not null and m.red_score is not null)
    into market_closed
  from public.matches m
  where m.match_id = place_bet.match_id;

  if market_closed is null then
    return json_build_object('error', 'match not found');
  end if;

  if market_closed then
    return json_build_object('error', 'market closed');
  end if;

  select coalesce(sum(b.stake), 0)
    into total_blue
  from public.bets b
  where b.match_id = place_bet.match_id
    and b.side = 'blue';

  select coalesce(sum(b.stake), 0)
    into total_red
  from public.bets b
  where b.match_id = place_bet.match_id
    and b.side = 'red';

  total_pool := total_blue + total_red;
  side_total := case when side = 'blue' then total_blue else total_red end;
  computed_odds := (total_pool + stake)::numeric / (side_total + stake)::numeric;

  updated_balance := current_balance - stake;

  update public.users
  set balance = updated_balance
  where user_id = place_bet.user_id;

  insert into public.bets (user_id, match_id, side, stake, odds)
  values (place_bet.user_id, place_bet.match_id, place_bet.side, place_bet.stake, computed_odds);

  return json_build_object(
    'ok', true,
    'odds', computed_odds,
    'balance', updated_balance
  );
end;
$$;

grant execute on function public.place_bet(text, text, text, integer) to anon, authenticated, service_role;
