-- Apply after 20260928_telemetry_and_admin.sql. Adds bias reports and richer admin summaries.
alter table public.ai_feedback drop constraint if exists ai_feedback_tag_check;
alter table public.ai_feedback add constraint ai_feedback_tag_check
  check (tag in ('helpful', 'inaccurate', 'not_relevant', 'unclear', 'unsafe', 'biased'));

create or replace function public.admin_telemetry(window_days integer default 14) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz := now() - make_interval(days => least(greatest(window_days, 1), 90)); auth_events jsonb; signups integer;
begin
  if not public.is_platform_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  begin
    execute $q$ select coalesce(jsonb_agg(row_to_json(a) order by a.events desc), '[]'::jsonb) from (
      select coalesce(payload->>'action', 'unknown') as action, count(*) as events
      from auth.audit_log_entries where created_at > now() - interval '24 hours' group by 1) a $q$ into auth_events;
  exception when others then auth_events := null;
  end;
  begin
    execute $q$ select count(*) from auth.users where created_at > now() - interval '7 days' $q$ into signups;
  exception when others then signups := null;
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
    'topics', (select coalesce(jsonb_agg(row_to_json(t) order by t.requests desc), '[]'::jsonb) from (
      select coalesce(topic, 'none') as topic, count(*) as requests, count(*) filter (where status = 'rejected') as declined,
        round(count(*) filter (where status = 'rejected')::numeric / count(*), 4) as declined_rate
      from public.ai_events where created_at > since and kind in ('ask', 'follow_up') group by 1) t),
    'feedback', (select coalesce(jsonb_agg(row_to_json(f) order by f.ratings desc), '[]'::jsonb) from (
      select topic, count(*) as ratings, count(*) filter (where rating = 1) as up, count(*) filter (where rating = -1) as down,
        count(*) filter (where tag = 'inaccurate') as inaccurate, count(*) filter (where tag = 'unsafe') as unsafe,
        count(*) filter (where tag = 'biased') as biased, count(*) filter (where tag = 'not_relevant') as not_relevant,
        count(*) filter (where tag = 'unclear') as unclear,
        round(count(*) filter (where rating = 1)::numeric / count(*), 4) as satisfaction
      from public.ai_feedback where created_at > since group by topic) f),
    'recent', (select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb) from (
      select kind, topic, status, latency_ms, tokens, created_at from public.ai_events order by created_at desc limit 25) r),
    'usage', jsonb_build_object(
      'active_accounts', (select count(distinct owner_user_id) from public.ai_events where created_at > since),
      'new_accounts_7d', signups,
      'accounts_at_daily_limit', (select count(*) from public.adviser_usage where day_start > now() - interval '24 hours' and day_count >= 50),
      'requests_last_hour', (select count(*) from public.ai_events where created_at > now() - interval '1 hour'),
      'average_hourly_requests', (select round(count(*)::numeric / greatest(1, extract(epoch from now() - since) / 3600), 2) from public.ai_events where created_at > since),
      'busiest_account_share', (select round(max(n)::numeric / greatest(1, sum(n)), 4) from (select count(*) as n from public.ai_events where created_at > since group by owner_user_id) o)),
    'auth_events_24h', auth_events
  );
end $$;
revoke all on function public.admin_telemetry(integer) from public, anon;
grant execute on function public.admin_telemetry(integer) to authenticated;
