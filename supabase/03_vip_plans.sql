-- VIP plans and payment records. Payment provider webhook must set paid status server-side.
create table if not exists public.vip_plans (
 id uuid primary key default gen_random_uuid(), name text not null,
 duration_days integer not null check(duration_days > 0),
 price bigint not null check(price >= 0),
 status public.publish_status not null default 'published',
 created_at timestamptz not null default now()
);
create table if not exists public.vip_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid not null references public.vip_plans(id) on delete restrict,
 amount bigint not null check(amount >= 0),
 status text not null default 'pending' check(status in ('pending','paid','cancelled','expired','refunded')),
 provider text,
 provider_reference text,
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 order_type text not null check(order_type in ('vip','telegram')),
 order_id uuid not null,
 provider text,
 provider_reference text,
 amount bigint not null check(amount >= 0),
 status text not null default 'pending' check(status in ('pending','paid','failed','expired','refunded')),
 raw_payload jsonb,
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create index if not exists vip_orders_user_status_idx on public.vip_orders(user_id,status);
create index if not exists payments_user_created_idx on public.payments(user_id,created_at desc);

alter table public.vip_plans enable row level security;
alter table public.vip_orders enable row level security;
alter table public.payments enable row level security;
drop policy if exists "published plans" on public.vip_plans;
drop policy if exists "admin plans" on public.vip_plans;
create policy "published plans" on public.vip_plans for select using(status='published' or public.is_admin());
create policy "admin plans" on public.vip_plans for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "vip orders owner read" on public.vip_orders;
drop policy if exists "vip orders admin manage" on public.vip_orders;
create policy "vip orders owner read" on public.vip_orders for select using(user_id=auth.uid() or public.is_admin());
create policy "vip orders admin manage" on public.vip_orders for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "payments owner read" on public.payments;
drop policy if exists "payments admin manage" on public.payments;
create policy "payments owner read" on public.payments for select using(user_id=auth.uid() or public.is_admin());
create policy "payments admin manage" on public.payments for all using(public.is_admin()) with check(public.is_admin());

grant select on public.vip_plans to anon,authenticated;
grant select on public.vip_orders,public.payments to authenticated;\ngrant update on public.vip_orders to authenticated;
grant insert,update,delete on public.vip_plans to authenticated;

create or replace function public.create_vip_order(p_plan_id uuid)
returns uuid language plpgsql security definer set search_path=public,auth
as $$
declare v_id uuid; v_price bigint;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 select price into v_price from public.vip_plans where id=p_plan_id and status='published';
 if not found then raise exception 'PLAN_NOT_AVAILABLE'; end if;
 insert into public.vip_orders(user_id,plan_id,amount) values(auth.uid(),p_plan_id,v_price) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_vip_order(uuid) from public;
grant execute on function public.create_vip_order(uuid) to authenticated;

insert into public.vip_plans(name,duration_days,price)
select seed.name,seed.duration_days,seed.price
from (values ('VIP 1 Hari',1,5000),('VIP 2 Hari',2,8000),('VIP 5 Hari',5,15000),
 ('VIP 7 Hari',7,20000),('VIP 15 Hari',15,32000),('VIP 1 Bulan',30,50000)) as seed(name,duration_days,price)
where not exists(select 1 from public.vip_plans p where p.name=seed.name);

-- Marking a VIP order paid (only through trusted server/admin workflow) activates its duration.
create or replace function public.activate_vip_after_paid()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_days integer;
begin
 if new.status='paid' and old.status is distinct from 'paid' then
  select duration_days into v_days from public.vip_plans where id=new.plan_id;
  update public.profiles
   set vip_expires_at = greatest(coalesce(vip_expires_at,now()),now()) + make_interval(days=>v_days),
       updated_at=now()
   where id=new.user_id;
  new.paid_at=coalesce(new.paid_at,now());
 end if;
 return new;
end $$;
drop trigger if exists vip_order_paid_activate on public.vip_orders;
create trigger vip_order_paid_activate before update of status on public.vip_orders
for each row execute function public.activate_vip_after_paid();
