-- Apply after 20260925_bizwise.sql. No client can grant itself Premium.
create table if not exists public.learning_progress (
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_key text not null check (lesson_key in ('records', 'payments', 'customers')),
  completed_at timestamptz not null default now(),
  primary key (owner_user_id, lesson_key)
);
alter table public.learning_progress enable row level security;
revoke all on public.learning_progress from anon, authenticated;
grant select, insert on public.learning_progress to authenticated;
create policy learning_owner_read on public.learning_progress for select to authenticated using (owner_user_id = (select auth.uid()));
create policy learning_owner_insert on public.learning_progress for insert to authenticated with check (owner_user_id = (select auth.uid()));

create table if not exists public.business_entitlements (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('premium', 'sponsored')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.business_entitlements enable row level security;
revoke all on public.business_entitlements from anon, authenticated;
grant select on public.business_entitlements to authenticated;
create policy entitlement_owner_read on public.business_entitlements for select to authenticated
  using (owner_user_id = (select auth.uid()));

-- Shared atomic counters: works across Edge Function workers, not just one process.
create table if not exists public.adviser_usage (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null,
  minute_count integer not null,
  day_start timestamptz not null,
  day_count integer not null
);
alter table public.adviser_usage enable row level security;
revoke all on public.adviser_usage from public, anon, authenticated;
create or replace function public.consume_adviser_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); stamp timestamptz := clock_timestamp(); allowed boolean;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.adviser_usage values (uid, stamp, 1, stamp, 1)
  on conflict (owner_user_id) do update set
    minute_start = case when public.adviser_usage.minute_start <= stamp - interval '1 minute' then stamp else public.adviser_usage.minute_start end,
    minute_count = case when public.adviser_usage.minute_start <= stamp - interval '1 minute' then 1 else public.adviser_usage.minute_count + 1 end,
    day_start = case when public.adviser_usage.day_start <= stamp - interval '24 hours' then stamp else public.adviser_usage.day_start end,
    day_count = case when public.adviser_usage.day_start <= stamp - interval '24 hours' then 1 else public.adviser_usage.day_count + 1 end
  where (public.adviser_usage.minute_start <= stamp - interval '1 minute' or public.adviser_usage.minute_count < 5)
    and (public.adviser_usage.day_start <= stamp - interval '24 hours' or public.adviser_usage.day_count < 50)
  returning true into allowed;
  return coalesce(allowed, false);
end $$;
revoke all on function public.consume_adviser_request() from public, anon;
grant execute on function public.consume_adviser_request() to authenticated;

create or replace function public.premium_insights() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare business_id uuid; report jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business_entitlements
    where owner_user_id = auth.uid() and expires_at > now()
  ) then raise exception 'An active Premium or sponsored plan is required' using errcode='42501'; end if;
  select id into business_id from public.shops where owner_user_id = auth.uid();
  if business_id is null then raise exception 'Set up your business first'; end if;
  select jsonb_build_object(
    'generated_at', now(),
    'months', (select coalesce(jsonb_agg(row_to_json(m) order by m.month), '[]'::jsonb) from (
      select to_char(date_trunc('month', job_date), 'YYYY-MM') as month,
        sum(amount_charged) as charged, sum(parts_cost + other_direct_cost) as direct_costs, count(*) as jobs
      from public.jobs where shop_id = business_id and status = 'completed'
        and job_date >= (date_trunc('month', now() at time zone 'UTC') - interval '5 months')::date
        and job_date <= (now() at time zone 'UTC')::date
      group by 1
    ) m),
    'services', (select coalesce(jsonb_agg(row_to_json(s) order by s.charged desc), '[]'::jsonb) from (
      select services.name, count(*) as jobs, sum(jobs.amount_charged) as charged
      from public.jobs join public.services on services.id = jobs.service_id and services.shop_id = jobs.shop_id
      where jobs.shop_id = business_id and jobs.status = 'completed' and jobs.job_date <= (now() at time zone 'UTC')::date
      group by services.id, services.name
    ) s)
  ) into report;
  return report;
end $$;
revoke all on function public.premium_insights() from public, anon;
grant execute on function public.premium_insights() to authenticated;

-- Pin the existing trigger's lookup path; authenticated users cannot create objects here.
revoke create on schema public from public, anon, authenticated;
alter function public.check_job_balance() set search_path = pg_catalog, public;
revoke execute on function public.check_job_balance() from public, anon, authenticated;
