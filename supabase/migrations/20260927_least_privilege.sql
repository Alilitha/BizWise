-- Apply after the original schema and 20260926_security_and_premium.sql.
-- RLS remains the row boundary. These grants further limit operations/columns.
revoke all on public.shops, public.services, public.customers, public.jobs,
  public.payments, public.feedback, public.adviser_actions, public.marketing_assets
  from anon, authenticated;
grant select, insert on public.shops, public.services, public.customers, public.jobs,
  public.payments, public.feedback, public.adviser_actions, public.marketing_assets
  to authenticated;
grant update(name, town, whatsapp_number) on public.shops to authenticated;
grant update(service_id, customer_id, job_date, description, status, amount_charged,
  parts_cost, other_direct_cost, labour_hours) on public.jobs to authenticated;
grant update(status, enquiries, bookings, attributed_jobs, result_notes)
  on public.adviser_actions to authenticated;
grant update(body, status, published_at) on public.marketing_assets to authenticated;
-- No client DELETE, TRUNCATE, REFERENCES or TRIGGER privileges. No client UPDATE
-- of owner/shop identity, saved recommendation text or its evidence snapshot.
