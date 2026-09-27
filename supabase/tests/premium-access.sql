-- Run as postgres in an isolated Supabase staging database after all migrations.
-- Everything is rolled back. This is not run automatically against production.
begin;
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
insert into public.shops (owner_user_id, name, town) values
 ('00000000-0000-4000-8000-000000000001', 'Security test A', 'Cape Town'),
 ('00000000-0000-4000-8000-000000000002', 'Security test B', 'Durban');
insert into public.business_entitlements (owner_user_id, plan, expires_at)
 values ('00000000-0000-4000-8000-000000000002', 'premium', now() + interval '1 day');
do $$ declare business record; service uuid; job uuid;
begin
  for business in select * from public.shops loop
    insert into public.services(shop_id,name) values(business.id,'Fixture service') returning id into service;
    insert into public.jobs(shop_id,service_id,job_date,status,amount_charged) values(business.id,service,current_date,'completed',100) returning id into job;
    insert into public.payments(shop_id,job_id,paid_at,amount,method) values(business.id,job,current_date,20,'cash');
    insert into public.feedback(shop_id,job_id,rating) values(business.id,job,4);
    insert into public.adviser_actions(shop_id,goal,recommendation) values(business.id,'money','Private fixture recommendation');
    if business.owner_user_id = '00000000-0000-4000-8000-000000000002'::uuid then
      perform set_config('test.other_job',job::text,true);
      perform set_config('test.other_shop',business.id::text,true);
    end if;
  end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$ declare affected integer; begin
  if has_table_privilege('authenticated', 'public.jobs', 'DELETE') then raise exception 'Unnecessary DELETE privilege'; end if;
  if has_column_privilege('authenticated', 'public.jobs', 'shop_id', 'UPDATE') then raise exception 'Tenant identity can be reassigned'; end if;
  if has_column_privilege('authenticated', 'public.adviser_actions', 'evidence_json', 'UPDATE') then raise exception 'Evidence is editable after saving'; end if;
  if has_table_privilege('anon', 'public.jobs', 'SELECT') then raise exception 'Anonymous table access'; end if;
  if (select count(*) from public.shops) <> 1 then raise exception 'Owner isolation failed'; end if;
  if (select count(*) from public.jobs) <> 1 then raise exception 'Job isolation failed'; end if;
  if (select count(*) from public.payments) <> 1 then raise exception 'Payment isolation failed'; end if;
  if (select count(*) from public.feedback) <> 1 then raise exception 'Feedback isolation failed'; end if;
  if (select count(*) from public.adviser_actions) <> 1 then raise exception 'Conversation isolation failed'; end if;
  update public.jobs set description='Cross-tenant write' where id=current_setting('test.other_job')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-tenant update succeeded'; end if;
  begin
    insert into public.feedback(shop_id,job_id,rating) values(current_setting('test.other_shop')::uuid,current_setting('test.other_job')::uuid,1);
    raise exception 'Cross-tenant feedback insert succeeded';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.business_entitlements) then raise exception 'Entitlement isolation failed'; end if;
  begin
    perform public.premium_insights();
    raise exception 'Free account accessed Premium';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.business_entitlements values (auth.uid(), 'premium', now()+interval '1 day', now());
    raise exception 'Client self-upgrade succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.learning_progress(owner_user_id, lesson_key) values ('00000000-0000-4000-8000-000000000002', 'records');
    raise exception 'Cross-account progress write succeeded';
  exception when insufficient_privilege then null; end;
  for i in 1..5 loop
    if not public.consume_adviser_request() then raise exception 'Quota rejected early'; end if;
  end loop;
  if public.consume_adviser_request() then raise exception 'Quota failed to enforce limit'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$ begin
  if jsonb_array_length(public.premium_insights()->'months') is distinct from 1 then raise exception 'Unexpected report'; end if;
  if (public.premium_insights()->'months'->0->>'charged')::numeric is distinct from 100 then raise exception 'Report crossed tenants'; end if;
  if not public.consume_adviser_request() then raise exception 'Quota crossed accounts'; end if;
end $$;
reset role;
update public.business_entitlements set expires_at = now()-interval '1 minute';
set local role authenticated;
do $$ begin
  begin
    perform public.premium_insights();
    raise exception 'Expired entitlement accessed Premium';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.platform_admins(user_id) values ('00000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$ begin
  perform public.record_ai_event('ask', 'payments', 'ok', 900, 120);
  insert into public.ai_feedback(topic, rating, tag) values ('payments', -1, 'inaccurate');
  if public.is_platform_admin() then raise exception 'Non-admin reported as admin'; end if;
  begin perform public.admin_telemetry(14); raise exception 'Non-admin read telemetry';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.ai_events; raise exception 'Owner read raw telemetry';
  exception when insufficient_privilege then null; end;
  begin insert into public.ai_feedback(owner_user_id, topic, rating) values ('00000000-0000-4000-8000-000000000001', 'payments', 1); raise exception 'Feedback attributed to another account';
  exception when insufficient_privilege then null; end;
  begin insert into public.platform_admins(user_id) values (auth.uid()); raise exception 'Client self-granted admin';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$ declare report jsonb; begin
  if not public.is_platform_admin() then raise exception 'Admin not recognised'; end if;
  report := public.admin_telemetry(14);
  if (report->'daily'->0->>'requests')::int is distinct from 1 then raise exception 'Telemetry count wrong'; end if;
  if (report->'feedback'->0->>'inaccurate')::int is distinct from 1 then raise exception 'Accuracy report missing'; end if;
  if report::text ~ 'Private fixture' then raise exception 'Telemetry leaked business content'; end if;
end $$;
rollback;
