
-- VIP pricing, referral rewards, admin promotion, and discount coupons
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

create unique index if not exists profiles_referral_code_uidx
  on public.profiles(referral_code) where referral_code is not null;

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  milestone integer not null,
  reward_type text not null check (reward_type in ('discount','vip')),
  description text not null,
  created_at timestamptz not null default now(),
  unique(user_id,milestone)
);

create table if not exists public.discount_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique,
  discount_percent integer not null check(discount_percent in (20,50)),
  uses_total integer not null check(uses_total > 0),
  uses_used integer not null default 0,
  uses_reserved integer not null default 0,
  source_milestone integer not null,
  created_at timestamptz not null default now(),
  check(uses_used >= 0 and uses_reserved >= 0 and uses_used + uses_reserved <= uses_total)
);

alter table public.cashi_orders
  add column if not exists base_amount bigint,
  add column if not exists discount_percent integer not null default 0,
  add column if not exists coupon_code text;


create table if not exists public.discount_coupon_reservations (
  order_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  coupon_code text not null references public.discount_coupons(code) on delete cascade,
  state text not null default 'reserved' check(state in ('reserved','consumed','released')),
  created_at timestamptz not null default now()
);
alter table public.discount_coupon_reservations enable row level security;

alter table public.referral_rewards enable row level security;
alter table public.discount_coupons enable row level security;

drop policy if exists "own referral rewards" on public.referral_rewards;
drop policy if exists "own referral rewards" on public.referral_rewards;
create policy "own referral rewards" on public.referral_rewards
 for select using(auth.uid()=user_id or public.is_admin());
drop policy if exists "own coupons" on public.discount_coupons;
drop policy if exists "own coupons" on public.discount_coupons;
create policy "own coupons" on public.discount_coupons
 for select using(auth.uid()=user_id or public.is_admin());

create or replace function public.make_referral_code()
returns text language sql volatile as $$
  select upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
$$;

update public.profiles set referral_code=public.make_referral_code() where referral_code is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_referrer uuid; v_code text;
begin
  v_code := nullif(new.raw_user_meta_data->>'referral_code','');
  if v_code is not null then
    select id into v_referrer from public.profiles where upper(referral_code)=upper(v_code) limit 1;
  end if;
  insert into public.profiles(id,full_name,role,referral_code,referred_by)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    'user'::public.user_role,
    public.make_referral_code(),
    v_referrer
  )
  on conflict(id) do update set
    referred_by=coalesce(public.profiles.referred_by,excluded.referred_by);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin promotion is intentionally manual. Run the UUID-based command in ADMIN_SETUP.sql.

create or replace function public.issue_referral_rewards()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_count integer; v_code text;
begin
  if new.referred_by is null then return new; end if;
  select count(*) into v_count from public.profiles where referred_by=new.referred_by;
  if v_count >= 5 and not exists(select 1 from public.referral_rewards where user_id=new.referred_by and milestone=5) then
    v_code := 'BC20-' || upper(substr(encode(gen_random_bytes(5),'hex'),1,8));
    insert into public.referral_rewards(user_id,milestone,reward_type,description)
      values(new.referred_by,5,'discount','Diskon 20% untuk 2 kali pembelian review');
    insert into public.discount_coupons(user_id,code,discount_percent,uses_total,source_milestone)
      values(new.referred_by,v_code,20,2,5);
  end if;
  if v_count >= 10 and not exists(select 1 from public.referral_rewards where user_id=new.referred_by and milestone=10) then
    v_code := 'BC50-' || upper(substr(encode(gen_random_bytes(5),'hex'),1,8));
    insert into public.referral_rewards(user_id,milestone,reward_type,description)
      values(new.referred_by,10,'discount','Diskon 50% untuk 4 kali pembelian review');
    insert into public.discount_coupons(user_id,code,discount_percent,uses_total,source_milestone)
      values(new.referred_by,v_code,50,4,10);
  end if;
  if v_count >= 30 and not exists(select 1 from public.referral_rewards where user_id=new.referred_by and milestone=30) then
    insert into public.referral_rewards(user_id,milestone,reward_type,description)
      values(new.referred_by,30,'vip','Bonus VIP 2 hari');
    update public.profiles set vip_expires_at=greatest(coalesce(vip_expires_at,now()),now())+interval '2 days' where id=new.referred_by;
  end if;
  if v_count >= 50 and not exists(select 1 from public.referral_rewards where user_id=new.referred_by and milestone=50) then
    insert into public.referral_rewards(user_id,milestone,reward_type,description)
      values(new.referred_by,50,'vip','Bonus VIP 7 hari');
    update public.profiles set vip_expires_at=greatest(coalesce(vip_expires_at,now()),now())+interval '7 days' where id=new.referred_by;
  end if;
  if v_count >= 100 and not exists(select 1 from public.referral_rewards where user_id=new.referred_by and milestone=100) then
    insert into public.referral_rewards(user_id,milestone,reward_type,description)
      values(new.referred_by,100,'vip','Bonus VIP 30 hari');
    update public.profiles set vip_expires_at=greatest(coalesce(vip_expires_at,now()),now())+interval '30 days' where id=new.referred_by;
  end if;
  return new;
end $$;

drop trigger if exists after_referral_signup on public.profiles;
create trigger after_referral_signup after insert on public.profiles
for each row execute procedure public.issue_referral_rewards();

-- Keep referral rewards and VIP extension server-side only.
create or replace function public.reserve_referral_coupon(p_user_id uuid,p_code text,p_order_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.discount_coupons%rowtype;
begin
  select * into c from public.discount_coupons
   where user_id=p_user_id and upper(code)=upper(trim(p_code))
   for update;
  if not found then return jsonb_build_object('ok',false,'reason','Kode diskon tidak ditemukan'); end if;
  if c.uses_used+c.uses_reserved >= c.uses_total then
    return jsonb_build_object('ok',false,'reason','Kuota kode diskon sudah habis');
  end if;
  insert into public.discount_coupon_reservations(order_id,user_id,coupon_code,state)
    values(p_order_id,p_user_id,c.code,'reserved');
  update public.discount_coupons set uses_reserved=uses_reserved+1 where id=c.id;
  return jsonb_build_object('ok',true,'discount_percent',c.discount_percent,'coupon_code',c.code);
end $$;
revoke all on function public.reserve_referral_coupon(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_referral_coupon(uuid,text,text) to service_role;

create or replace function public.release_referral_coupon(p_order_id text)
returns void language plpgsql security definer set search_path=public as $$
declare r public.discount_coupon_reservations%rowtype;
begin
 select * into r from public.discount_coupon_reservations where order_id=p_order_id for update;
 if not found or r.state <> 'reserved' then return; end if;
 update public.discount_coupons set uses_reserved=greatest(uses_reserved-1,0)
  where user_id=r.user_id and code=r.coupon_code;
 update public.discount_coupon_reservations set state='released' where order_id=p_order_id;
end $$;
revoke all on function public.release_referral_coupon(text) from public,anon,authenticated;
grant execute on function public.release_referral_coupon(text) to service_role;

-- Replace settlement function to consume a reserved coupon only after verified payment.
create or replace function public.settle_cashi_order(p_order_id text,p_amount bigint,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.cashi_orders%rowtype; v_exp timestamptz;
begin
 select * into o from public.cashi_orders where order_id=p_order_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
 if o.status='SETTLED' then return jsonb_build_object('ok',true,'duplicate',true); end if;
 if p_amount is null or p_amount <> o.amount then return jsonb_build_object('ok',false,'reason','AMOUNT_MISMATCH'); end if;
 if o.status <> 'PENDING' then return jsonb_build_object('ok',false,'reason','ORDER_NOT_PAYABLE'); end if;
 update public.cashi_orders set status='SETTLED',provider_amount=p_amount,gateway_payload=p_payload,settled_at=now(),updated_at=now() where order_id=p_order_id;
 if o.coupon_code is not null then
   update public.discount_coupons set uses_reserved=greatest(uses_reserved-1,0),uses_used=uses_used+1
    where user_id=o.user_id and upper(code)=upper(o.coupon_code)
      and exists(select 1 from public.discount_coupon_reservations r where r.order_id=o.order_id and r.state='reserved');
   update public.discount_coupon_reservations set state='consumed'
    where order_id=o.order_id and state='reserved';
 end if;
 if o.purpose='vip' then
   select greatest(coalesce(vip_expires_at,now()),now()) into v_exp from public.profiles where id=o.user_id;
   update public.profiles set vip_expires_at=coalesce(v_exp,now()) + make_interval(days=>(select duration_days from public.vip_plans where id=o.plan_id)) where id=o.user_id;
 else
   insert into public.review_entitlements(user_id,review_id,order_id) values(o.user_id,o.review_id,o.order_id) on conflict(user_id,review_id) do nothing;
 end if;
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;

-- Update existing duration rows and create only missing packages.
update public.vip_plans set
 name='VIP ' || duration_days || case when duration_days=30 then ' Hari' else ' Hari' end,
 price=case duration_days when 1 then 15000 when 2 then 25000 when 5 then 30000
   when 7 then 35000 when 15 then 50000 when 30 then 100000 end,
 status='published'
where duration_days in (1,2,5,7,15,30);

insert into public.vip_plans(name,duration_days,price,status)
select v.name,v.days,v.price,'published'
from (values
 ('VIP 1 Hari',1,15000),('VIP 2 Hari',2,25000),('VIP 5 Hari',5,30000),
 ('VIP 7 Hari',7,35000),('VIP 15 Hari',15,50000),('VIP 30 Hari',30,100000)
) as v(name,days,price)
where not exists(select 1 from public.vip_plans p where p.duration_days=v.days);

create or replace function public.get_referral_summary()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_count integer; v_code text; v_rewards jsonb; v_coupons jsonb;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 select referral_code into v_code from public.profiles where id=auth.uid();
 select count(*) into v_count from public.profiles where referred_by=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('milestone',milestone,'reward_type',reward_type,'description',description,'created_at',created_at) order by milestone),'[]'::jsonb)
 into v_rewards from public.referral_rewards where user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'discount_percent',discount_percent,'uses_total',uses_total,'uses_used',uses_used,'uses_reserved',uses_reserved) order by discount_percent desc),'[]'::jsonb)
 into v_coupons from public.discount_coupons where user_id=auth.uid();
 return jsonb_build_object('referral_code',v_code,'referral_count',v_count,'rewards',v_rewards,'coupons',v_coupons);
end $$;
revoke all on function public.get_referral_summary() from public,anon;
grant execute on function public.get_referral_summary() to authenticated;
