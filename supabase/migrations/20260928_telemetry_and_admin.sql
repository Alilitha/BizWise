-- Apply after 20260927_least_privilege.sql. AI telemetry, answer ratings and an admin-only summary.
-- No question text, answer text or business figures are stored here: only labels, timings and counts.
create table if not exists public.ai_events (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ask', 'follow_up', 'advert', 'textbook', 'campaign')),
  topic text check (char_length(topic) <= 40),
  status text not null check (status in ('ok', 'provider_error', 'invalid_output', 'rejected')),
  latency_ms integer not null check (latency_ms between 0 and 600000),
  tokens integer not null default 0 check (tokens between 0 and 200000),
  created_at timestamptz not null default now()
);
create index if not exists ai_events_created_idx on public.ai_events(created_at desc);
alter table public.ai_events enable row level security;
revoke all on public.ai_events from public, anon, authenticated;

-- The caller's identity comes from auth.uid(), not a parameter. An owner can still misreport
-- their own timings by calling this directly, so treat per-owner outliers with suspicion.
create or replace function public.record_ai_event(kind text, topic text, status text, latency_ms integer, tokens integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.ai_events(owner_user_id, kind, topic, status, latency_ms, tokens)
  values (auth.uid(), kind, left(topic, 40), status, greatest(0, latency_ms), greatest(0, tokens));
end $$;
revoke all on function public.record_ai_event(text, text, text, integer, integer) from public, anon;
grant execute on function public.record_ai_event(text, text, text, integer, integer) to authenticated;

create table if not exists public.ai_feedback (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic text not null check (char_length(topic) <= 40),
  rating smallint not null check (rating in (-1, 1)),
  tag text check (tag in ('helpful', 'inaccurate', 'not_relevant', 'unclear', 'unsafe')),
  created_at timestamptz not null default now()
);
alter table public.ai_feedback enable row level security;
revoke all on public.ai_feedback from public, anon, authenticated;
grant insert (topic, rating, tag) on public.ai_feedback to authenticated;
create policy ai_feedback_owner_insert on public.ai_feedback for insert to authenticated with check (owner_user_id = (select auth.uid()));

-- Admins are granted by a trusted operator in the SQL editor. No client can write this table.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.admin_telemetry(window_days integer default 14) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz := now() - make_interval(days => least(greatest(window_days, 1), 90)); auth_events jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  begin
    execute $q$ select coalesce(jsonb_agg(row_to_json(a) order by a.events desc), '[]'::jsonb) from (
      select coalesce(payload->>'action', 'unknown') as action, count(*) as events
      from auth.audit_log_entries where created_at > now() - interval '24 hours' group by 1) a $q$ into auth_events;
  exception when others then auth_events := null;
  end;
  return jsonb_build_object(
    'generated_at', now(), 'since', since,
    'daily', (select coalesce(jsonb_agg(row_to_json(d) order by d.day), '[]'::jsonb) from (
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*) as requests,
        count(*) filter (where status <> 'ok') as failures, round(avg(latency_ms)) as avg_latency_ms,
        round(percentile_cont(0.95) within group (order by latency_ms)::numeric) as p95_latency_ms, sum(tokens) as tokens
      from public.ai_events where created_at > since group by 1) d),
    'by_kind', (select coalesce(jsonb_agg(row_to_json(k) order by k.requests desc), '[]'::jsonb) from (
      select kind, count(*) as requests, round(avg(latency_ms)) as avg_latency_ms, sum(tokens) as tokens,
        round(count(*) filter (where status <> 'ok')::numeric / count(*), 4) as failure_rate
      from public.ai_events where created_at > since group by kind) k),
    'feedback', (select coalesce(jsonb_agg(row_to_json(f) order by f.ratings desc), '[]'::jsonb) from (
      select topic, count(*) as ratings, count(*) filter (where rating = 1) as up, count(*) filter (where rating = -1) as down,
        count(*) filter (where tag = 'inaccurate') as inaccurate, count(*) filter (where tag = 'unsafe') as unsafe,
        round(count(*) filter (where rating = 1)::numeric / count(*), 4) as satisfaction
      from public.ai_feedback where created_at > since group by topic) f),
    'usage', jsonb_build_object(
      'active_accounts', (select count(distinct owner_user_id) from public.ai_events where created_at > since),
      'accounts_at_daily_limit', (select count(*) from public.adviser_usage where day_start > now() - interval '24 hours' and day_count >= 50),
      'requests_last_hour', (select count(*) from public.ai_events where created_at > now() - interval '1 hour'),
      'average_hourly_requests', (select round(count(*)::numeric / greatest(1, extract(epoch from now() - since) / 3600), 2) from public.ai_events where created_at > since),
      'busiest_account_share', (select round(max(n)::numeric / greatest(1, sum(n)), 4) from (select count(*) as n from public.ai_events where created_at > since group by owner_user_id) o)),
    'auth_events_24h', auth_events
  );
end $$;
revoke all on function public.admin_telemetry(integer) from public, anon;
grant execute on function public.admin_telemetry(integer) to authenticated;
