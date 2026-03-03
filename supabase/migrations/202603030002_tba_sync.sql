-- Pull TBA event matches directly into Postgres (Supabase)
-- This removes the remaining dependency on Google Sheets for match ingestion.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.tba_sync_config (
  id boolean primary key default true,
  event_code text not null,
  enabled boolean not null default true,
  tba_auth_key text,
  updated_at timestamptz not null default now(),
  constraint tba_sync_config_singleton check (id)
);

insert into public.tba_sync_config (id, event_code, enabled, tba_auth_key)
values (true, '2025txdri', true, null)
on conflict (id) do nothing;


alter table public.tba_sync_config enable row level security;

-- Do not expose TBA auth key to client roles. Service role can still access this table.
drop policy if exists "deny client read tba config" on public.tba_sync_config;
create policy "deny client read tba config"
  on public.tba_sync_config
  for select
  using (false);

create or replace function public._tba_label(comp_level text, set_number int, match_number int)
returns text
language sql
immutable
as $$
  select case
    when comp_level = 'qm' then format('Quals %s', match_number)
    when comp_level = 'sf' then format('Semis %s-%s', set_number, match_number)
    when comp_level = 'f' then format('Finals %s', match_number)
    else format('%s %s', comp_level, match_number)
  end;
$$;

create or replace function public._tba_teams(team_keys jsonb)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(replace(value, 'frc', ''), ',' order by ord), '')
  from jsonb_array_elements_text(team_keys) with ordinality as t(value, ord);
$$;

create or replace function public.sync_tba_matches()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg record;

  req_id bigint;
  tries int := 0;
  payload jsonb;
  m jsonb;
  tba_url text;
  blue_score int;
  red_score int;
  resolved_winner text;
  market_state text;
begin
  select event_code, enabled, tba_auth_key into cfg
  from public.tba_sync_config
  where id = true;

  if cfg.event_code is null then
    return jsonb_build_object('ok', false, 'error', 'missing tba_sync_config.event_code');
  end if;

  if not cfg.enabled then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'sync disabled');
  end if;

  if cfg.tba_auth_key is null or btrim(cfg.tba_auth_key) = '' then
    return jsonb_build_object('ok', false, 'error', 'missing tba_sync_config.tba_auth_key');
  end if;

  tba_url := format('https://www.thebluealliance.com/api/v3/event/%s/matches', cfg.event_code);

  select net.http_get(
    url := tba_url,
    headers := jsonb_build_object('X-TBA-Auth-Key', cfg.tba_auth_key)
  ) into req_id;

  loop
    tries := tries + 1;

    select content::jsonb into payload
    from net._http_response
    where id = req_id
      and status_code between 200 and 299
    order by created desc
    limit 1;

    exit when payload is not null or tries >= 20;
    perform pg_sleep(0.25);
  end loop;

  if payload is null then
    return jsonb_build_object('ok', false, 'error', 'no successful tba response', 'request_id', req_id);
  end if;

  for m in
    select value
    from jsonb_array_elements(payload)
    order by
      case value->>'comp_level'
        when 'qm' then 1
        when 'sf' then 2
        when 'f' then 3
        else 4
      end,
      coalesce((value->>'set_number')::int, 0),
      coalesce((value->>'match_number')::int, 0)
  loop
    blue_score := nullif((m #>> '{alliances,blue,score}')::int, -1);
    red_score := nullif((m #>> '{alliances,red,score}')::int, -1);

    resolved_winner := case
      when blue_score is null or red_score is null then null
      when blue_score > red_score then 'blue'
      when red_score > blue_score then 'red'
      else 'tie'
    end;

    market_state := case
      when blue_score is null or red_score is null then 'open'
      else 'closed'
    end;

    insert into public.matches (
      match_id,
      blue_team,
      red_team,
      blue_score,
      red_score,
      winner,
      market_status
    )
    values (
      public._tba_label(
        m->>'comp_level',
        coalesce((m->>'set_number')::int, 0),
        coalesce((m->>'match_number')::int, 0)
      ),
      public._tba_teams(m #> '{alliances,blue,team_keys}'),
      public._tba_teams(m #> '{alliances,red,team_keys}'),
      blue_score,
      red_score,
      resolved_winner,
      market_state
    )
    on conflict (match_id) do update
      set blue_team = excluded.blue_team,
          red_team = excluded.red_team,
          blue_score = excluded.blue_score,
          red_score = excluded.red_score,
          winner = excluded.winner,
          market_status = excluded.market_status;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'event_code', cfg.event_code,
    'request_id', req_id,
    'rows_seen', coalesce(jsonb_array_length(payload), 0)
  );
end;
$$;

grant execute on function public.sync_tba_matches() to service_role;

create or replace function public.schedule_tba_sync_every_5m()
returns void
language plpgsql
security definer
set search_path = public
as $schedule$
begin
  begin
    perform cron.unschedule('peardict_tba_sync_every_5m');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'peardict_tba_sync_every_5m',
    '*/5 * * * *',
    $$select public.sync_tba_matches();$$
  );
end;
$schedule$;

-- Optional one-time setup calls after migration:
-- update public.tba_sync_config
-- set event_code = '2025txdri',
--     tba_auth_key = 'YOUR_TBA_AUTH_KEY'
-- where id = true;
-- select public.schedule_tba_sync_every_5m();
