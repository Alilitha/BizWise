-- Apply in Supabase SQL Editor before using the app.
create extension if not exists pgcrypto;
create table if not exists public.shops(id uuid primary key default gen_random_uuid(),owner_user_id uuid not null unique references auth.users(id) on delete cascade,name text not null,town text not null,whatsapp_number text,created_at timestamptz not null default now());
create table if not exists public.services(id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id) on delete cascade,name text not null,active boolean not null default true,unique(shop_id,id),unique(shop_id,name));
create table if not exists public.customers(id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id) on delete cascade,display_name text,phone text,unique(shop_id,id));
create table if not exists public.jobs(id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id) on delete cascade,service_id uuid not null,customer_id uuid,job_date date not null,description text,status text not null default 'draft' check(status in('draft','completed','cancelled')),amount_charged numeric(12,2) check(amount_charged>=0),parts_cost numeric(12,2) not null default 0 check(parts_cost>=0),other_direct_cost numeric(12,2) not null default 0 check(other_direct_cost>=0),labour_hours numeric(7,2) check(labour_hours>=0),created_at timestamptz not null default now(),unique(shop_id,id),foreign key(shop_id,service_id) references public.services(shop_id,id),foreign key(shop_id,customer_id) references public.customers(shop_id,id),check(status<>'completed' or amount_charged is not null));
create table if not exists public.payments(id uuid primary key default gen_random_uuid(),shop_id uuid not null,job_id uuid not null,paid_at date not null,amount numeric(12,2) not null check(amount>0),method text check(method in('cash','card','eft','other')),foreign key(shop_id,job_id) references public.jobs(shop_id,id) on delete cascade);
create table if not exists public.feedback(id uuid primary key default gen_random_uuid(),shop_id uuid not null,job_id uuid not null,rating smallint check(rating between 1 and 5),comment text,received_at date not null default current_date,foreign key(shop_id,job_id) references public.jobs(shop_id,id) on delete cascade,check(rating is not null or nullif(trim(comment),'') is not null));
create table if not exists public.adviser_actions(id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id) on delete cascade,goal text not null check(goal in('customers','experience','money')),evidence_json jsonb not null default '{}'::jsonb,recommendation text not null,limitations text not null default '',status text not null default 'planned' check(status in('planned','active','completed','dismissed')),enquiries integer not null default 0 check(enquiries>=0),bookings integer not null default 0 check(bookings>=0),attributed_jobs integer not null default 0 check(attributed_jobs>=0),result_notes text,created_at timestamptz not null default now(),unique(shop_id,id),check(bookings<=enquiries),check(attributed_jobs<=bookings));
create table if not exists public.marketing_assets(id uuid primary key default gen_random_uuid(),shop_id uuid not null,action_id uuid not null,channel text not null check(channel in('whatsapp','social')),body text not null,status text not null default 'draft' check(status in('draft','published')),published_at timestamptz,created_at timestamptz not null default now(),foreign key(shop_id,action_id) references public.adviser_actions(shop_id,id) on delete cascade);
create index if not exists jobs_shop_date_idx on public.jobs(shop_id,job_date desc);
create index if not exists payments_shop_job_idx on public.payments(shop_id,job_id);
-- Verify payment totals inside the database, including concurrent writes and price reductions.
create or replace function public.check_job_balance() returns trigger language plpgsql security definer set search_path=public as $$ declare total numeric(12,2); charge numeric(12,2); state text; begin
  if TG_TABLE_NAME='payments' then
    perform 1 from jobs where id=new.job_id and shop_id=new.shop_id for update;
    select amount_charged,status into charge,state from jobs where id=new.job_id and shop_id=new.shop_id;
    if state<>'completed' then raise exception 'Payments require a completed job'; end if;
    select coalesce(sum(amount),0) into total from payments where job_id=new.job_id and id<>new.id;
    if total+new.amount>charge then raise exception 'Payment exceeds job charge'; end if;
  else
    select coalesce(sum(amount),0) into total from payments where job_id=new.id;
    if total>coalesce(new.amount_charged,0) or (total>0 and new.status<>'completed') then raise exception 'Job change conflicts with payments'; end if;
  end if; return new; end $$;
create trigger payment_balance before insert or update on public.payments for each row execute function public.check_job_balance();
create trigger job_balance before update on public.jobs for each row execute function public.check_job_balance();
-- Only owner-owned shops and rows are accessible to signed-in clients.
alter table public.shops enable row level security;
create policy shops_owner on public.shops for all to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
do $$ declare t text; begin foreach t in array array['services','customers','jobs','payments','feedback','adviser_actions','marketing_assets'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy %I on public.%I for all to authenticated using (exists (select 1 from public.shops s where s.id=%I.shop_id and s.owner_user_id=auth.uid())) with check (exists (select 1 from public.shops s where s.id=%I.shop_id and s.owner_user_id=auth.uid()))',t||'_owner',t,t,t);
 end loop; end $$;
