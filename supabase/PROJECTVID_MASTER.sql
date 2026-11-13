-- ============================================================================
-- PROJECTVID / BOXCELLINK — MASTER SQL INSTALLER (FRESH PROJECT ONLY)
-- One-time combined install. DO NOT run over an existing live database.
-- For an existing database, run only missing migrations; see SQL_RUN_ORDER.md.
-- Never run ADMIN_SETUP.sql automatically; it requires the real admin UUID.
-- ============================================================================



-- ============================================================================
-- STEP 01: supabase/schema.sql
-- ============================================================================
create extension if not exists pgcrypto;
do $$ begin create type public.user_role as enum ('user','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.content_access as enum ('public','vip'); exception when duplicate_object then null; end $$;
do $$ begin create type public.publish_status as enum ('draft','published','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.telegram_type as enum ('free','paid'); exception when duplicate_object then null; end $$;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text,role public.user_role not null default 'user',vip_started_at timestamptz,vip_expires_at timestamptz,created_at timestamptz not null default now());
create table public.categories(id uuid primary key default gen_random_uuid(),name text not null unique,status public.publish_status not null default 'published',created_at timestamptz not null default now());
create table public.servers(id uuid primary key default gen_random_uuid(),name text not null unique,type text not null default 'storage',folder_endpoint text,status public.publish_status not null default 'published',created_at timestamptz not null default now());
create table public.videos(id uuid primary key default gen_random_uuid(),title text not null,provider text not null,embed_url text not null,download_url text,access public.content_access not null default 'public',download_enabled boolean not null default false,category_id uuid references public.categories(id) on delete set null,server_id uuid references public.servers(id) on delete set null,status public.publish_status not null default 'draft',created_at timestamptz not null default now());
create table public.telegram_items(id uuid primary key default gen_random_uuid(),title text not null,type public.telegram_type not null,review_embed_url text,download_url text not null,price bigint not null default 0,category_id uuid references public.categories(id) on delete set null,server_id uuid references public.servers(id) on delete set null,status public.publish_status not null default 'draft',created_at timestamptz not null default now());
create table public.vip_plans(id uuid primary key default gen_random_uuid(),name text not null,duration_days integer not null,price bigint not null,status public.publish_status not null default 'published',created_at timestamptz not null default now());
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
alter table public.profiles enable row level security; alter table public.categories enable row level security; alter table public.servers enable row level security; alter table public.videos enable row level security; alter table public.telegram_items enable row level security; alter table public.vip_plans enable row level security;
drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles for select using(auth.uid()=id or public.is_admin());
drop policy if exists "public categories" on public.categories;
create policy "public categories" on public.categories for select using(status='published' or public.is_admin());
drop policy if exists "admin categories" on public.categories;
create policy "admin categories" on public.categories for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public servers" on public.servers;
create policy "public servers" on public.servers for select using(status='published' or public.is_admin());
drop policy if exists "admin servers" on public.servers;
create policy "admin servers" on public.servers for all using(public.is_admin()) with check(public.is_admin());
create policy "published videos" on public.videos for select using(status='published' and (access='public' or (auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.vip_expires_at>now()))) or public.is_admin());
drop policy if exists "admin videos" on public.videos;
create policy "admin videos" on public.videos for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "published telegram" on public.telegram_items;
create policy "published telegram" on public.telegram_items for select using(status='published' or public.is_admin());
drop policy if exists "admin telegram" on public.telegram_items;
create policy "admin telegram" on public.telegram_items for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "published plans" on public.vip_plans;
create policy "published plans" on public.vip_plans for select using(status='published' or public.is_admin());
drop policy if exists "admin plans" on public.vip_plans;
create policy "admin plans" on public.vip_plans for all using(public.is_admin()) with check(public.is_admin());
-- Setelah membuat akun pertama, jadikan admin dengan SQL ini:
-- update public.profiles set role='admin' where id='UUID_USER_ANDA';
insert into public.categories(name) values('Entertainment'),('Premium') on conflict do nothing;
insert into public.servers(name,type) values('Server 01','storage'),('Telegram A','telegram') on conflict do nothing;
create unique index if not exists vip_plans_duration_days_uidx on public.vip_plans(duration_days);
insert into public.vip_plans(name,duration_days,price) values
 ('VIP 1 Hari',1,15000),('VIP 2 Hari',2,25000),('VIP 5 Hari',5,30000),
 ('VIP 7 Hari',7,35000),('VIP 15 Hari',15,50000),('VIP 30 Hari',30,100000)
on conflict (duration_days) do update set name=excluded.name,price=excluded.price,status='published';


-- ============================================================================
-- STEP 02: supabase/migrations.sql
-- ============================================================================
-- Jalankan setelah schema.sql. Migrasi BoxCellink + Cashi.
create extension if not exists pgcrypto;
create table if not exists public.review_items (
 id uuid primary key default gen_random_uuid(), title text not null, slug text unique,
 description text not null default '', review_embed_url text, thumbnail_url text,
 price bigint not null default 0 check(price>=0),
 access text not null default 'paid' check(access in ('free','paid')),
 category_id uuid references public.categories(id) on delete set null,
 status public.publish_status not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cashi_orders (
 id uuid primary key default gen_random_uuid(), order_id text not null unique,
 user_id uuid not null references auth.users(id) on delete cascade,
 purpose text not null check(purpose in ('vip','review_download')),
 plan_id uuid references public.vip_plans(id), review_id uuid references public.review_items(id),
 amount bigint not null check(amount>=2000), status text not null default 'PENDING' check(status in ('PENDING','SETTLED','EXPIRED','FAILED')),
 checkout_url text, provider_amount bigint, gateway_payload jsonb, settled_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint order_target_check check ((purpose='vip' and plan_id is not null and review_id is null) or (purpose='review_download' and review_id is not null and plan_id is null))
);
create table if not exists public.review_download_secrets (review_id uuid primary key references public.review_items(id) on delete cascade, download_url text not null, updated_at timestamptz not null default now());
create table if not exists public.review_entitlements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 review_id uuid not null references public.review_items(id) on delete cascade,
 order_id text unique references public.cashi_orders(order_id), created_at timestamptz not null default now(), unique(user_id,review_id)
);
alter table public.review_items enable row level security;
alter table public.cashi_orders enable row level security;
alter table public.review_entitlements enable row level security;
alter table public.review_download_secrets enable row level security;
drop policy if exists "admin review secrets" on public.review_download_secrets;
create policy "admin review secrets" on public.review_download_secrets for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "published review items" on public.review_items;
create policy "published review items" on public.review_items for select using(status='published' or public.is_admin());
drop policy if exists "admin review items" on public.review_items;
create policy "admin review items" on public.review_items for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "own orders read" on public.cashi_orders;
create policy "own orders read" on public.cashi_orders for select using(auth.uid()=user_id or public.is_admin());
drop policy if exists "own entitlements read" on public.review_entitlements;
create policy "own entitlements read" on public.review_entitlements for select using(auth.uid()=user_id or public.is_admin());
-- Hanya service role/webhook yang boleh memanggil RPC ini.
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

-- Pretty URLs, gallery review, engagement and access controls
alter table public.videos add column if not exists slug text unique;
alter table public.videos add column if not exists thumbnail_url text;
alter table public.videos add column if not exists view_count bigint not null default 0;
alter table public.videos add column if not exists access_scope text not null default 'everyone' check(access_scope in ('everyone','login','vip'));
alter table public.review_items add column if not exists gallery_urls jsonb not null default '[]'::jsonb;
alter table public.review_items add column if not exists view_count bigint not null default 0;
create table if not exists public.video_likes(id uuid primary key default gen_random_uuid(),video_id uuid not null references public.videos(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),unique(video_id,user_id));
create table if not exists public.video_comments(id uuid primary key default gen_random_uuid(),video_id uuid not null references public.videos(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,body text not null check(length(body) between 1 and 1500),created_at timestamptz not null default now());
alter table public.video_likes enable row level security; alter table public.video_comments enable row level security;
drop policy if exists "likes visible" on public.video_likes;
create policy "likes visible" on public.video_likes for select using(true);
drop policy if exists "user manages own likes" on public.video_likes;
create policy "user manages own likes" on public.video_likes for insert with check(auth.uid()=user_id);
drop policy if exists "user removes own likes" on public.video_likes;
create policy "user removes own likes" on public.video_likes for delete using(auth.uid()=user_id);
drop policy if exists "comments visible" on public.video_comments;
create policy "comments visible" on public.video_comments for select using(true);
drop policy if exists "signed users comment" on public.video_comments;
create policy "signed users comment" on public.video_comments for insert with check(auth.uid()=user_id);
create or replace function public.increment_video_view(p_video_id uuid) returns void language sql security definer set search_path=public as $$ update public.videos set view_count=view_count+1 where id=p_video_id and status='published'; $$;
revoke all on function public.increment_video_view(uuid) from public; grant execute on function public.increment_video_view(uuid) to anon,authenticated;
create table if not exists public.review_content_secrets(review_id uuid primary key references public.review_items(id) on delete cascade,content_after_payment text not null default '',updated_at timestamptz not null default now());
alter table public.review_content_secrets enable row level security;
drop policy if exists "admin review content secret" on public.review_content_secrets;
create policy "admin review content secret" on public.review_content_secrets for all using(public.is_admin()) with check(public.is_admin());

-- Security hardening: keep private review content out of the public review table.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='review_items' and column_name='content_after_payment') then
    insert into public.review_content_secrets(review_id,content_after_payment)
    select id,coalesce(content_after_payment,'') from public.review_items
    where content_after_payment is not null
    on conflict(review_id) do update set content_after_payment=excluded.content_after_payment;
    alter table public.review_items drop column content_after_payment;
  end if;
end $$;

-- Restrict direct video reads according to the access_scope field.
drop policy if exists "published videos" on public.videos;
create policy "published videos" on public.videos for select using (
 status='published' and (
   (access='public' and access_scope='everyone')
   or (access='public' and access_scope='login' and auth.uid() is not null)
   or ((access='vip' or access_scope='vip') and auth.uid() is not null and exists(
     select 1 from public.profiles p where p.id=auth.uid() and p.vip_expires_at>now()
   ))
 ) or public.is_admin()
);

create or replace function public.increment_review_view(p_review_id uuid)
returns void language sql security definer set search_path=public as $$
 update public.review_items set view_count=view_count+1 where id=p_review_id and status='published';
$$;
revoke all on function public.increment_review_view(uuid) from public;
grant execute on function public.increment_review_view(uuid) to anon,authenticated;

-- Ensure only admins can read/write private secret tables; no public grants.
revoke all on public.review_download_secrets, public.review_content_secrets from anon, authenticated;
-- Admin dashboard uses the authenticated Supabase client; RLS still limits these tables to admins.
revoke all on public.review_download_secrets, public.review_content_secrets from anon;
grant select, insert, update, delete on public.review_download_secrets, public.review_content_secrets to authenticated;


-- ============================================================================
-- STEP 03: supabase/referral_vip_migration.sql
-- ============================================================================

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


-- ============================================================================
-- STEP 04: supabase/admin_features.sql
-- ============================================================================
-- BoxCellink admin/member expansion. Jalankan SETELAH schema.sql + migrations.sql + referral_vip_migration.sql.
alter table public.profiles add column if not exists email text, add column if not exists is_banned boolean not null default false, add column if not exists last_seen_at timestamptz, add column if not exists premium_expires_at timestamptz;
update public.profiles p set email=u.email from auth.users u where u.id=p.id and p.email is null;
create index if not exists profiles_last_seen_idx on public.profiles(last_seen_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email) on conflict(id) do update set email=excluded.email; return new; end $$;

create table if not exists public.announcements(id uuid primary key default gen_random_uuid(),title text not null,body text not null,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.vip_groups(id uuid primary key default gen_random_uuid(),name text not null unique,description text not null default '',telegram_url text,member_count integer not null default 0,status public.publish_status not null default 'draft',created_at timestamptz not null default now());
create table if not exists public.admin_discount_codes(id uuid primary key default gen_random_uuid(),code text not null unique,discount_percent integer not null check(discount_percent between 10 and 75),min_purchase bigint not null default 7000 check(min_purchase>=7000),claim_limit integer not null default 1,claimed_count integer not null default 0,expires_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.admin_discount_claims(id uuid primary key default gen_random_uuid(),code_id uuid not null references public.admin_discount_codes(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,claimed_at timestamptz not null default now(),used_at timestamptz,used_for text,unique(code_id,user_id));

alter table public.announcements enable row level security; alter table public.vip_groups enable row level security; alter table public.admin_discount_codes enable row level security; alter table public.admin_discount_claims enable row level security;
drop policy if exists "public announcements" on public.announcements; create policy "public announcements" on public.announcements for select using(active or public.is_admin());
drop policy if exists "admin announcements" on public.announcements; create policy "admin announcements" on public.announcements for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public vip groups" on public.vip_groups; create policy "public vip groups" on public.vip_groups for select using(status='published' or public.is_admin());
drop policy if exists "admin vip groups" on public.vip_groups; create policy "admin vip groups" on public.vip_groups for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "active discount codes" on public.admin_discount_codes; create policy "active discount codes" on public.admin_discount_codes for select using(expires_at is null or expires_at>now() or public.is_admin());
drop policy if exists "admin discount codes" on public.admin_discount_codes; create policy "admin discount codes" on public.admin_discount_codes for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "own discount claims" on public.admin_discount_claims; create policy "own discount claims" on public.admin_discount_claims for select using(auth.uid()=user_id or public.is_admin());

drop policy if exists "admin profiles" on public.profiles; create policy "admin profiles" on public.profiles for all using(public.is_admin()) with check(public.is_admin());

create or replace function public.claim_admin_discount(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.admin_discount_codes%rowtype; v_id uuid;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select * into c from public.admin_discount_codes where upper(code)=upper(trim(p_code)) for update;
 if not found then return jsonb_build_object('ok',false,'reason','CODE_NOT_FOUND'); end if;
 if c.expires_at is not null and c.expires_at<=now() then return jsonb_build_object('ok',false,'reason','EXPIRED'); end if;
 if c.claimed_count>=c.claim_limit then return jsonb_build_object('ok',false,'reason','CLAIM_LIMIT'); end if;
 if exists(select 1 from public.admin_discount_claims where code_id=c.id and user_id=auth.uid()) then return jsonb_build_object('ok',false,'reason','ALREADY_CLAIMED'); end if;
 insert into public.admin_discount_claims(code_id,user_id) values(c.id,auth.uid()) returning id into v_id;
 update public.admin_discount_codes set claimed_count=claimed_count+1 where id=c.id;
 return jsonb_build_object('ok',true,'claim_id',v_id,'code',c.code,'discount_percent',c.discount_percent,'min_purchase',c.min_purchase,'expires_at',c.expires_at);
end $$;
revoke all on function public.claim_admin_discount(text) from public,anon; grant execute on function public.claim_admin_discount(text) to authenticated;

insert into public.announcements(title,body) select 'Selamat datang di BoxCellink','Informasi terbaru dari admin akan tampil di sini.' where not exists(select 1 from public.announcements);
insert into public.vip_groups(name,description,status) values
('Premium Access','Lebih banyak update media, tinggal nonton, update lebih sering setiap hari, dan media dapat di-download.','published'),
('VIP Boxcil','Dapatkan media Boxcil dengan update media lebih banyak, tinggal nonton, dan media dapat di-download.','published'),
('VIP Indo','Dapatkan media Local Indo dengan update media viral terbaru, tinggal nonton, dan media dapat di-download.','published'),
('VIP VGK','Dapatkan media VGK dengan update media, tinggal nonton, dan media dapat di-download.','published') on conflict(name) do nothing;
drop policy if exists "profiles self update" on public.profiles; create policy "profiles self update" on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);


-- ============================================================================
-- STEP 05: supabase/vip_group_account_migration.sql
-- ============================================================================
-- Jalankan setelah schema.sql, migrations.sql, referral_vip_migration.sql dan admin_features.sql.
alter table public.vip_groups add column if not exists price bigint not null default 5000 check(price>=2000);
alter table public.cashi_orders add column if not exists vip_group_id uuid references public.vip_groups(id) on delete set null;
alter table public.cashi_orders drop constraint if exists cashi_orders_purpose_check;
alter table public.cashi_orders add constraint cashi_orders_purpose_check check(purpose in ('vip','review_download','vip_group'));
alter table public.cashi_orders drop constraint if exists order_target_check;
alter table public.cashi_orders add constraint order_target_check check (
 (purpose='vip' and plan_id is not null and review_id is null and vip_group_id is null) or
 (purpose='review_download' and review_id is not null and plan_id is null and vip_group_id is null) or
 (purpose='vip_group' and vip_group_id is not null and plan_id is null and review_id is null)
);
create table if not exists public.vip_group_entitlements(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 group_id uuid not null references public.vip_groups(id) on delete cascade,
 order_id text unique references public.cashi_orders(order_id),
 telegram_url text not null,
 created_at timestamptz not null default now(),
 unique(user_id,group_id)
);
alter table public.vip_group_entitlements enable row level security;
drop policy if exists "own vip group entitlements" on public.vip_group_entitlements;
create policy "own vip group entitlements" on public.vip_group_entitlements for select using(auth.uid()=user_id or public.is_admin());
drop policy if exists "admin vip group entitlements" on public.vip_group_entitlements;
create policy "admin vip group entitlements" on public.vip_group_entitlements for all using(public.is_admin()) with check(public.is_admin());
create or replace function public.settle_cashi_order(p_order_id text,p_amount bigint,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.cashi_orders%rowtype; v_exp timestamptz; v_days integer; v_url text;
begin
 select * into o from public.cashi_orders where order_id=p_order_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
 if o.status='SETTLED' then return jsonb_build_object('ok',true,'duplicate',true); end if;
 if p_amount is null or p_amount<>o.amount then return jsonb_build_object('ok',false,'reason','AMOUNT_MISMATCH'); end if;
 if o.status<>'PENDING' then return jsonb_build_object('ok',false,'reason','ORDER_NOT_PAYABLE'); end if;
 update public.cashi_orders set status='SETTLED',provider_amount=p_amount,gateway_payload=p_payload,settled_at=now(),updated_at=now() where order_id=p_order_id;
 if o.purpose='vip' then
  select duration_days into v_days from public.vip_plans where id=o.plan_id;
  select greatest(coalesce(vip_expires_at,now()),now()) into v_exp from public.profiles where id=o.user_id;
  update public.profiles set vip_expires_at=coalesce(v_exp,now())+make_interval(days=>v_days) where id=o.user_id;
 elsif o.purpose='review_download' then
  insert into public.review_entitlements(user_id,review_id,order_id) values(o.user_id,o.review_id,o.order_id) on conflict(user_id,review_id) do nothing;
 elsif o.purpose='vip_group' then
  select telegram_url into v_url from public.vip_groups where id=o.vip_group_id and status='published';
  if v_url is null then return jsonb_build_object('ok',false,'reason','GROUP_INVITE_NOT_CONFIGURED'); end if;
  insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url) values(o.user_id,o.vip_group_id,o.order_id,v_url) on conflict(user_id,group_id) do nothing;
 end if;
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;


-- ============================================================================
-- STEP 06: supabase/review_social_interactions.sql
-- ============================================================================
-- BoxCellink: public review likes and comments
-- Run once in Supabase SQL Editor after the main schema/migrations.
begin;

create table if not exists public.review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.review_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint review_likes_one_per_user unique(review_id,user_id)
);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.review_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check(char_length(content) between 1 and 1000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists review_likes_review_id_idx on public.review_likes(review_id);
create index if not exists review_comments_review_created_idx on public.review_comments(review_id,created_at desc);

alter table public.review_likes enable row level security;
alter table public.review_comments enable row level security;

grant select on public.review_likes, public.review_comments to anon,authenticated;
grant insert,delete on public.review_likes to authenticated;
grant insert on public.review_comments to authenticated;

drop policy if exists "published review likes are readable" on public.review_likes;
create policy "published review likes are readable" on public.review_likes
for select to anon,authenticated
using (exists(select 1 from public.review_items r where r.id=review_id and r.status='published'));

drop policy if exists "users add own review like" on public.review_likes;
create policy "users add own review like" on public.review_likes
for insert to authenticated
with check (auth.uid()=user_id and exists(select 1 from public.review_items r where r.id=review_id and r.status='published'));

drop policy if exists "users remove own review like" on public.review_likes;
create policy "users remove own review like" on public.review_likes
for delete to authenticated
using (auth.uid()=user_id);

drop policy if exists "published review comments are readable" on public.review_comments;
create policy "published review comments are readable" on public.review_comments
for select to anon,authenticated
using (is_hidden=false and exists(select 1 from public.review_items r where r.id=review_id and r.status='published'));

drop policy if exists "users add own review comment" on public.review_comments;
create policy "users add own review comment" on public.review_comments
for insert to authenticated
with check (auth.uid()=user_id and is_hidden=false and exists(select 1 from public.review_items r where r.id=review_id and r.status='published'));

commit;


-- ============================================================================
-- STEP 07: supabase/review_public_access_fix.sql
-- ============================================================================
-- BOXCellink: akses baca publik untuk metadata review berstatus published.
-- Jalankan di Supabase SQL Editor pada project yang sama dengan website.
-- Link download dan konten berbayar tetap privat di tabel *_secrets.

begin;

grant usage on schema public to anon, authenticated;
grant select on table public.review_items to anon, authenticated;

alter table public.review_items enable row level security;

drop policy if exists "public published review items" on public.review_items;
create policy "public published review items"
  on public.review_items
  for select
  to anon, authenticated
  using (status = 'published');

commit;

-- Verifikasi sesudah menjalankan SQL:
-- select slug, status, title from public.review_items where slug = 'BC6E17F2';


-- ============================================================================
-- STEP 08: supabase/review_public_stats_rpc.sql
-- ============================================================================
-- Public aggregate statistics for published BoxCellink reviews.
-- Exposes aggregate counts only; no buyer IDs, payment references, or order details.
-- Drop first because PostgreSQL cannot change a function return table shape with CREATE OR REPLACE.
drop function if exists public.get_public_review_stats();
create or replace function public.get_public_review_stats()
returns table (
  review_id uuid,
  total_sold bigint,
  total_links bigint,
  total_likes bigint,
  total_comments bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id as review_id,
    coalesce(s.total_sold, 0)::bigint as total_sold,
    coalesce(r.view_count, 0)::bigint as total_links,
    coalesce(l.total_likes, 0)::bigint as total_likes,
    coalesce(c.total_comments, 0)::bigint as total_comments
  from public.review_items r
  left join lateral (
    select count(*) as total_sold
    from public.cashi_orders o
    where o.review_id = r.id
      and o.purpose = 'review_download'
      and o.status = 'SETTLED'
  ) s on true
  left join lateral (
    select count(*) as total_likes
    from public.review_likes rl
    where rl.review_id = r.id
  ) l on true
  left join lateral (
    select count(*) as total_comments
    from public.review_comments rc
    where rc.review_id = r.id and rc.is_hidden = false
  ) c on true
  where r.status = 'published';
$$;
revoke all on function public.get_public_review_stats() from public;
grant execute on function public.get_public_review_stats() to anon, authenticated;


-- ============================================================================
-- STEP 09: supabase/review_guest_comments_migration.sql
-- ============================================================================
-- BoxCellink review comments: public text-only guest comments,
-- authenticated comments may contain URLs, admin moderation.
-- Run once in Supabase SQL Editor after review_social_interactions.sql.
begin;

alter table public.review_comments
  alter column user_id drop not null;

alter table public.review_comments
  add column if not exists guest_name text;

alter table public.review_comments
  drop constraint if exists review_comments_guest_name_length;
alter table public.review_comments
  add constraint review_comments_guest_name_length
  check (guest_name is null or char_length(btrim(guest_name)) between 1 and 40);

create or replace function public.guard_review_comment_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  signed_in boolean := auth.uid() is not null
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false;
begin
  if signed_in then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Identitas komentar tidak valid.';
    end if;
    new.guest_name := null;
  else
    if new.user_id is not null then
      raise exception 'Login diperlukan untuk komentar dengan tautan.';
    end if;
    if new.guest_name is null or char_length(btrim(new.guest_name)) < 1 then
      raise exception 'Username wajib diisi untuk komentar pengunjung.';
    end if;
    if new.content ~* '(https?://|www\.)' then
      raise exception 'Komentar berisi tautan hanya dapat dikirim oleh pengguna yang login.';
    end if;
    new.guest_name := left(btrim(new.guest_name), 40);
  end if;
  return new;
end;
$$;

drop trigger if exists review_comment_insert_guard on public.review_comments;
create trigger review_comment_insert_guard
before insert on public.review_comments
for each row execute function public.guard_review_comment_insert();

-- Replace earlier authenticated-only insert policy with explicit guest/member policies.
drop policy if exists "users add own review comment" on public.review_comments;
drop policy if exists "review guests add text comments" on public.review_comments;
create policy "review guests add text comments"
on public.review_comments for insert to anon
with check (
  user_id is null
  and guest_name is not null
  and is_hidden = false
  and exists(select 1 from public.review_items r where r.id = review_id and r.status = 'published')
);

drop policy if exists "review members add comments" on public.review_comments;
create policy "review members add comments"
on public.review_comments for insert to authenticated
with check (
  auth.uid() = user_id
  and is_hidden = false
  and exists(select 1 from public.review_items r where r.id = review_id and r.status = 'published')
);

drop policy if exists "review anonymous sessions add guest text comments" on public.review_comments;
create policy "review anonymous sessions add guest text comments"
on public.review_comments for insert to authenticated
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = true
  and user_id is null
  and guest_name is not null
  and is_hidden = false
  and exists(select 1 from public.review_items r where r.id = review_id and r.status = 'published')
);

drop policy if exists "admins delete review comments" on public.review_comments;
create policy "admins delete review comments"
on public.review_comments for delete to authenticated
using (public.is_admin());

grant select on public.review_comments to anon, authenticated;
grant insert on public.review_comments to anon, authenticated;
grant delete on public.review_comments to authenticated;

commit;


-- ============================================================================
-- STEP 10: supabase/watch_video_orientation_migration.sql
-- ============================================================================
-- BoxCellink: dukungan video horizontal dan vertikal. Jalankan sekali di Supabase SQL Editor.
alter table public.videos add column if not exists orientation text not null default 'auto';
alter table public.videos drop constraint if exists videos_orientation_check;
alter table public.videos add constraint videos_orientation_check check (orientation in ('auto','horizontal','vertical'));


-- ============================================================================
-- STEP 11: supabase/watch_guest_comments_replies_migration.sql
-- ============================================================================
-- BoxCellink Watch: guest comments, nested replies, and comment reactions.
-- Run this file once in Supabase SQL Editor.
begin;

alter table public.video_comments alter column user_id drop not null;
alter table public.video_comments add column if not exists guest_name text;
alter table public.video_comments drop constraint if exists video_comments_guest_name_length;
alter table public.video_comments add constraint video_comments_guest_name_length
  check (guest_name is null or char_length(btrim(guest_name)) between 1 and 40);

create or replace function public.guard_video_comment_insert()
returns trigger language plpgsql security invoker set search_path=public,auth as $$
declare signed_in boolean := auth.uid() is not null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false;
begin
  if signed_in then
    if new.user_id is distinct from auth.uid() then raise exception 'Identitas komentar tidak valid.'; end if;
    new.guest_name := null;
  else
    if new.user_id is not null then raise exception 'Login diperlukan untuk komentar dengan tautan.'; end if;
    if new.guest_name is null or char_length(btrim(new.guest_name)) < 1 then raise exception 'Nama wajib diisi.'; end if;
    if new.body ~* '(https?://|www\.)' then raise exception 'Komentar berisi tautan hanya dapat dikirim oleh pengguna yang login.'; end if;
    new.guest_name := left(btrim(new.guest_name),40);
  end if;
  return new;
end; $$;

drop trigger if exists video_comment_insert_guard on public.video_comments;
create trigger video_comment_insert_guard before insert on public.video_comments
for each row execute function public.guard_video_comment_insert();

drop policy if exists "signed users comment" on public.video_comments;
drop policy if exists "video guests add text comments" on public.video_comments;
create policy "video guests add text comments" on public.video_comments for insert to anon
with check (user_id is null and guest_name is not null and exists(
  select 1 from public.videos v where v.id=video_id and v.status='published'
));
drop policy if exists "video members add comments" on public.video_comments;
create policy "video members add comments" on public.video_comments for insert to authenticated
with check (auth.uid()=user_id and exists(
  select 1 from public.videos v where v.id=video_id and v.status='published'
));

create table if not exists public.video_comment_replies(
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.video_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  guest_name text,
  body text not null check(char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.video_comment_replies enable row level security;
drop policy if exists "video comment replies public read" on public.video_comment_replies;
create policy "video comment replies public read" on public.video_comment_replies for select to anon,authenticated using(true);
drop policy if exists "video comment replies guest insert" on public.video_comment_replies;
create policy "video comment replies guest insert" on public.video_comment_replies for insert to anon
with check(user_id is null and guest_name is not null and body !~* '(https?://|www\.)');
drop policy if exists "video comment replies member insert" on public.video_comment_replies;
create policy "video comment replies member insert" on public.video_comment_replies for insert to authenticated
with check(auth.uid()=user_id);

create table if not exists public.video_comment_likes(
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.video_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  guest_token text,
  created_at timestamptz not null default now(),
  constraint video_comment_likes_actor check ((user_id is not null and guest_token is null) or (user_id is null and guest_token is not null)),
  constraint video_comment_likes_user_unique unique(comment_id,user_id),
  constraint video_comment_likes_guest_unique unique(comment_id,guest_token)
);
alter table public.video_comment_likes enable row level security;
drop policy if exists "video comment likes public read" on public.video_comment_likes;
create policy "video comment likes public read" on public.video_comment_likes for select to anon,authenticated using(true);
drop policy if exists "video comment likes guest insert" on public.video_comment_likes;
create policy "video comment likes guest insert" on public.video_comment_likes for insert to anon
with check(user_id is null and guest_token is not null and char_length(guest_token) between 8 and 100);
drop policy if exists "video comment likes member insert" on public.video_comment_likes;
create policy "video comment likes member insert" on public.video_comment_likes for insert to authenticated
with check(auth.uid()=user_id and guest_token is null);
drop policy if exists "video comment likes guest delete" on public.video_comment_likes;
drop policy if exists "video comment likes member delete" on public.video_comment_likes;
create policy "video comment likes member delete" on public.video_comment_likes for delete to authenticated
using(auth.uid()=user_id);

grant select,insert on public.video_comments to anon,authenticated;
grant select,insert on public.video_comment_replies to anon,authenticated;
grant select,insert,delete on public.video_comment_likes to anon,authenticated;

commit;


-- ============================================================================
-- STEP 12: supabase/watch_access_notice_rpc.sql
-- ============================================================================
-- Safe public metadata for restricted BoxVidey pages.
-- This RPC deliberately omits embed_url, download_url, and all other playback secrets.
create or replace function public.get_watch_video_notice(p_slug text)
returns table (
  video_id uuid,
  slug text,
  title text,
  access text,
  access_scope text,
  thumbnail_url text,
  created_at timestamptz,
  view_count bigint,
  category_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.id,
    v.slug,
    v.title,
    v.access::text,
    coalesce(v.access_scope, 'everyone'),
    v.thumbnail_url,
    v.created_at,
    v.view_count,
    c.name
  from public.videos v
  left join public.categories c on c.id = v.category_id
  where v.status = 'published'
    and (v.slug = p_slug or v.id::text = p_slug)
    and (
      (v.access = 'vip' or v.access_scope = 'vip')
      or (v.access = 'public' and v.access_scope = 'login')
    )
  limit 1;
$$;
revoke all on function public.get_watch_video_notice(text) from public;
grant execute on function public.get_watch_video_notice(text) to anon, authenticated;


-- ============================================================================
-- STEP 13: supabase/support_chat_migration.sql
-- ============================================================================
-- Boxcelink Support Chat: run this migration in Supabase SQL Editor.
create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'Chat Support',
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists support_conversations_user_updated_idx on public.support_conversations(user_id,updated_at desc);
create index if not exists support_messages_conversation_created_idx on public.support_messages(conversation_id,created_at);
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
drop policy if exists "support conversations read own or admin" on public.support_conversations;
create policy "support conversations read own or admin" on public.support_conversations for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "support conversations create own" on public.support_conversations;
create policy "support conversations create own" on public.support_conversations for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "support conversations admin update" on public.support_conversations;
create policy "support conversations admin update" on public.support_conversations for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "support conversations admin delete" on public.support_conversations;
create policy "support conversations admin delete" on public.support_conversations for delete to authenticated using(public.is_admin());
drop policy if exists "support messages read own or admin" on public.support_messages;
create policy "support messages read own or admin" on public.support_messages for select to authenticated using(
  public.is_admin() or exists(select 1 from public.support_conversations c where c.id=conversation_id and c.user_id=auth.uid())
);
drop policy if exists "support messages insert own or admin reply" on public.support_messages;
create policy "support messages insert own or admin reply" on public.support_messages for insert to authenticated with check(
  sender_id=auth.uid() and (public.is_admin() or exists(select 1 from public.support_conversations c where c.id=conversation_id and c.user_id=auth.uid()))
);
drop policy if exists "support messages admin update" on public.support_messages;
create policy "support messages admin update" on public.support_messages for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "support messages admin delete" on public.support_messages;
create policy "support messages admin delete" on public.support_messages for delete to authenticated using(public.is_admin());
create or replace function public.touch_support_conversation() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.support_conversations set updated_at=now() where id=new.conversation_id; return new; end $$;
drop trigger if exists support_message_touch_conversation on public.support_messages;
create trigger support_message_touch_conversation after insert or update on public.support_messages for each row execute function public.touch_support_conversation();


-- ============================================================================
-- STEP 14: supabase/admin_vip_discount_management.sql
-- ============================================================================
-- Run after schema.sql, admin_features.sql, referral_vip_migration.sql and vip_group_account_migration.sql.
-- Ensure VIP group pricing exists.
alter table public.vip_groups add column if not exists price bigint not null default 5000 check(price>=2000);
-- Admin-created promo codes are claimable by 2-10 distinct members.
update public.admin_discount_codes set claim_limit=greatest(2,least(10,claim_limit));
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_claim_limit_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_claim_limit_check check(claim_limit between 2 and 10);
alter table public.admin_discount_codes alter column claim_limit set default 2;
alter table public.admin_discount_codes add column if not exists min_purchase bigint not null default 7000;
alter table public.admin_discount_codes add column if not exists expires_at timestamptz;
alter table public.admin_discount_codes add column if not exists claimed_count integer not null default 0;
create unique index if not exists admin_discount_codes_code_upper_uidx on public.admin_discount_codes(upper(code));


-- ============================================================================
-- STEP 15: supabase/final_hardening_migration.sql
-- ============================================================================
-- BoxCellink final hardening migration.
-- Run AFTER schema.sql, migrations.sql, referral_vip_migration.sql,
-- admin_features.sql and vip_group_account_migration.sql.
create extension if not exists pgcrypto;
alter table public.cashi_orders add column if not exists vip_group_invite_url text;

-- 1) Keep privileged profile attributes server/admin controlled.
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_banned is distinct from old.is_banned
       or new.vip_expires_at is distinct from old.vip_expires_at
       or new.premium_expires_at is distinct from old.premium_expires_at
       or new.referral_code is distinct from old.referral_code
       or new.referred_by is distinct from old.referred_by
       or new.email is distinct from old.email then
      raise exception 'Kolom profil ini hanya dapat diubah oleh admin.' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges before update on public.profiles
for each row execute function public.protect_profile_privileges();

-- 2) Preserve referral attribution AND profile email when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_referrer uuid; v_ref_code text;
begin
  v_ref_code := nullif(upper(trim(new.raw_user_meta_data->>'referral_code')), '');
  if v_ref_code is not null then
    select id into v_referrer from public.profiles
      where upper(referral_code)=v_ref_code limit 1;
  end if;
  insert into public.profiles(id,full_name,email,role,referral_code,referred_by)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,
         'user'::public.user_role,public.make_referral_code(),v_referrer)
  on conflict(id) do update set
    email=excluded.email,
    referred_by=coalesce(public.profiles.referred_by,excluded.referred_by);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- 3) Ensure group invitation exists BEFORE marking an order paid.
-- The function is transactional: any raised error rolls back all changes.
create or replace function public.settle_cashi_order(
  p_order_id text, p_amount bigint, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  o public.cashi_orders%rowtype;
  v_exp timestamptz;
  v_days integer;
  v_url text;
  v_res public.discount_coupon_reservations%rowtype;
begin
  select * into o from public.cashi_orders where order_id=p_order_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
  if o.status='SETTLED' then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if o.status<>'PENDING' then return jsonb_build_object('ok',false,'reason','ORDER_NOT_PAYABLE'); end if;
  if p_amount is null or p_amount<>o.amount then
    return jsonb_build_object('ok',false,'reason','AMOUNT_MISMATCH');
  end if;

  if o.purpose='vip' then
    select duration_days into v_days from public.vip_plans
      where id=o.plan_id and status='published';
    if v_days is null or v_days<1 then
      return jsonb_build_object('ok',false,'reason','VIP_PLAN_UNAVAILABLE');
    end if;
  elsif o.purpose='review_download' then
    if not exists(select 1 from public.review_items where id=o.review_id and status='published') then
      return jsonb_build_object('ok',false,'reason','REVIEW_UNAVAILABLE');
    end if;
  elsif o.purpose='vip_group' then
    select coalesce(o.vip_group_invite_url,telegram_url) into v_url from public.vip_groups
      where id=o.vip_group_id;
    if v_url is null or length(trim(v_url))=0 then
      return jsonb_build_object('ok',false,'reason','GROUP_INVITE_NOT_CONFIGURED');
    end if;
  else
    return jsonb_build_object('ok',false,'reason','UNKNOWN_PURPOSE');
  end if;

  if o.coupon_code is not null then
    select * into v_res from public.discount_coupon_reservations
      where order_id=o.order_id and user_id=o.user_id and state='reserved' for update;
    if not found then
      return jsonb_build_object('ok',false,'reason','COUPON_RESERVATION_MISSING');
    end if;
  end if;

  update public.cashi_orders set status='SETTLED',provider_amount=p_amount,
    gateway_payload=coalesce(p_payload,'{}'::jsonb),settled_at=now(),updated_at=now()
    where order_id=p_order_id;

  if o.coupon_code is not null then
    update public.discount_coupons set
      uses_reserved=greatest(uses_reserved-1,0), uses_used=uses_used+1
      where user_id=o.user_id and code=v_res.coupon_code;
    update public.discount_coupon_reservations set state='consumed'
      where order_id=o.order_id and state='reserved';
  end if;

  if o.purpose='vip' then
    select greatest(coalesce(vip_expires_at,now()),now()) into v_exp
      from public.profiles where id=o.user_id for update;
    update public.profiles set vip_expires_at=coalesce(v_exp,now())+make_interval(days=>v_days)
      where id=o.user_id;
  elsif o.purpose='review_download' then
    insert into public.review_entitlements(user_id,review_id,order_id)
      values(o.user_id,o.review_id,o.order_id)
      on conflict(user_id,review_id) do nothing;
  elsif o.purpose='vip_group' then
    insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url)
      values(o.user_id,o.vip_group_id,o.order_id,v_url)
      on conflict(user_id,group_id) do nothing;
  end if;
  return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;

-- 4) Keep coupon RPCs service-role only.
revoke all on function public.reserve_referral_coupon(uuid,text,text) from public,anon,authenticated;
revoke all on function public.release_referral_coupon(text) from public,anon,authenticated;
grant execute on function public.reserve_referral_coupon(uuid,text,text) to service_role;
grant execute on function public.release_referral_coupon(text) to service_role;

-- 5) Ensure private tables are never readable by anonymous visitors.
revoke all on public.review_download_secrets, public.review_content_secrets from anon;
grant select,insert,update,delete on public.review_download_secrets, public.review_content_secrets to authenticated;

-- 6) Indexes used by account/admin/payment lookups.
create index if not exists cashi_orders_user_created_idx on public.cashi_orders(user_id,created_at desc);
create index if not exists cashi_orders_status_idx on public.cashi_orders(status,created_at desc);
create index if not exists vip_group_entitlements_user_idx on public.vip_group_entitlements(user_id,created_at desc);
create index if not exists review_entitlements_user_idx on public.review_entitlements(user_id,created_at desc);
create index if not exists profiles_referred_by_idx on public.profiles(referred_by);


-- ============================================================================
-- STEP 16: supabase/vip_group_secret_hardening.sql
-- ============================================================================
-- Run AFTER final_hardening_migration.sql and admin_vip_discount_management.sql.
-- Invitation URLs are private data and must not be selectable from the public group catalogue.
create table if not exists public.vip_group_secrets(
 group_id uuid primary key references public.vip_groups(id) on delete cascade,
 telegram_url text not null,
 updated_at timestamptz not null default now()
);
insert into public.vip_group_secrets(group_id,telegram_url)
select id,telegram_url from public.vip_groups where telegram_url is not null and btrim(telegram_url)<>''
on conflict(group_id) do update set telegram_url=excluded.telegram_url,updated_at=now();
alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets" on public.vip_group_secrets for all using(public.is_admin()) with check(public.is_admin());
revoke all on public.vip_group_secrets from anon,authenticated;
grant select,insert,update,delete on public.vip_group_secrets to authenticated;
-- Retain legacy column for backward compatibility, but block all direct client reads.
revoke select on public.vip_groups from anon,authenticated;
grant select(id,name,description,member_count,status,created_at,price) on public.vip_groups to anon,authenticated;
create or replace function public.settle_cashi_order(
  p_order_id text, p_amount bigint, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  o public.cashi_orders%rowtype;
  v_exp timestamptz;
  v_days integer;
  v_url text;
  v_res public.discount_coupon_reservations%rowtype;
begin
  select * into o from public.cashi_orders where order_id=p_order_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
  if o.status='SETTLED' then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if o.status<>'PENDING' then return jsonb_build_object('ok',false,'reason','ORDER_NOT_PAYABLE'); end if;
  if p_amount is null or p_amount<>o.amount then
    return jsonb_build_object('ok',false,'reason','AMOUNT_MISMATCH');
  end if;

  if o.purpose='vip' then
    select duration_days into v_days from public.vip_plans
      where id=o.plan_id and status='published';
    if v_days is null or v_days<1 then
      return jsonb_build_object('ok',false,'reason','VIP_PLAN_UNAVAILABLE');
    end if;
  elsif o.purpose='review_download' then
    if not exists(select 1 from public.review_items where id=o.review_id and status='published') then
      return jsonb_build_object('ok',false,'reason','REVIEW_UNAVAILABLE');
    end if;
  elsif o.purpose='vip_group' then
    select coalesce(o.vip_group_invite_url,
      (select s.telegram_url from public.vip_group_secrets s where s.group_id=o.vip_group_id))
      into v_url;
    if v_url is null or length(trim(v_url))=0 then
      return jsonb_build_object('ok',false,'reason','GROUP_INVITE_NOT_CONFIGURED');
    end if;
  else
    return jsonb_build_object('ok',false,'reason','UNKNOWN_PURPOSE');
  end if;

  if o.coupon_code is not null then
    select * into v_res from public.discount_coupon_reservations
      where order_id=o.order_id and user_id=o.user_id and state='reserved' for update;
    if not found then
      return jsonb_build_object('ok',false,'reason','COUPON_RESERVATION_MISSING');
    end if;
  end if;

  update public.cashi_orders set status='SETTLED',provider_amount=p_amount,
    gateway_payload=coalesce(p_payload,'{}'::jsonb),settled_at=now(),updated_at=now()
    where order_id=p_order_id;

  if o.coupon_code is not null then
    update public.discount_coupons set
      uses_reserved=greatest(uses_reserved-1,0), uses_used=uses_used+1
      where user_id=o.user_id and code=v_res.coupon_code;
    update public.discount_coupon_reservations set state='consumed'
      where order_id=o.order_id and state='reserved';
  end if;

  if o.purpose='vip' then
    select greatest(coalesce(vip_expires_at,now()),now()) into v_exp
      from public.profiles where id=o.user_id for update;
    update public.profiles set vip_expires_at=coalesce(v_exp,now())+make_interval(days=>v_days)
      where id=o.user_id;
  elsif o.purpose='review_download' then
    insert into public.review_entitlements(user_id,review_id,order_id)
      values(o.user_id,o.review_id,o.order_id)
      on conflict(user_id,review_id) do nothing;
  elsif o.purpose='vip_group' then
    insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url)
      values(o.user_id,o.vip_group_id,o.order_id,v_url)
      on conflict(user_id,group_id) do nothing;
  end if;
  return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;


-- ============================================================================
-- STEP 17: supabase/boxcellink_premium_expansion.sql
-- ============================================================================
-- Membership timeline fields
alter table public.profiles add column if not exists vip_started_at timestamptz;
-- BoxCellink premium member/admin expansion. Run after all existing migrations.
begin;

alter table public.profiles
  add column if not exists premium_expires_at timestamptz,
  add column if not exists is_banned boolean not null default false,
  add column if not exists last_seen_at timestamptz;

alter table public.vip_groups add column if not exists price bigint not null default 5000;
alter table public.cashi_orders add column if not exists vip_group_id uuid references public.vip_groups(id) on delete set null;
alter table public.cashi_orders add column if not exists vip_group_invite_url text;
create table if not exists public.vip_group_secrets(
  group_id uuid primary key references public.vip_groups(id) on delete cascade,
  telegram_url text not null,
  updated_at timestamptz not null default now()
);
alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets" on public.vip_group_secrets
  for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.vip_group_secrets to authenticated;
revoke all on public.vip_group_secrets from anon;

alter table public.videos add column if not exists share_count bigint not null default 0;
alter table public.review_items add column if not exists share_count bigint not null default 0;

create table if not exists public.video_watch_history(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  watched_at timestamptz not null default now(),
  unique(user_id,video_id)
);
create index if not exists video_watch_history_user_time_idx
  on public.video_watch_history(user_id,watched_at desc);
alter table public.video_watch_history enable row level security;
drop policy if exists "users read own video watch history" on public.video_watch_history;
create policy "users read own video watch history" on public.video_watch_history
  for select to authenticated using(auth.uid()=user_id or public.is_admin());
grant select on public.video_watch_history to authenticated;

create or replace function public.record_video_watch(p_video_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.video_watch_history(user_id,video_id,watched_at)
  select auth.uid(),v.id,now() from public.videos v
  where v.id=p_video_id and v.status='published'
  on conflict(user_id,video_id) do update set watched_at=excluded.watched_at;
end $$;
revoke all on function public.record_video_watch(uuid) from public,anon;
grant execute on function public.record_video_watch(uuid) to authenticated;

create or replace function public.increment_video_share(p_video_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.videos set share_count=share_count+1
  where id=p_video_id and status='published';
$$;
create or replace function public.increment_review_share(p_review_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.review_items set share_count=share_count+1
  where id=p_review_id and status='published';
$$;
revoke all on function public.increment_video_share(uuid) from public;
revoke all on function public.increment_review_share(uuid) from public;
grant execute on function public.increment_video_share(uuid) to anon,authenticated;
grant execute on function public.increment_review_share(uuid) to anon,authenticated;

drop function if exists public.get_public_video_stats(uuid[]);
create function public.get_public_video_stats(p_video_ids uuid[])
returns table(video_id uuid,total_likes bigint,total_comments bigint,total_shares bigint)
language sql stable security definer set search_path=public as $$
 select v.id,
  coalesce((select count(*) from public.video_likes l where l.video_id=v.id),0)::bigint,
  coalesce((select count(*) from public.video_comments c where c.video_id=v.id),0)::bigint,
  coalesce(v.share_count,0)::bigint
 from public.videos v where v.id=any(p_video_ids) and v.status='published';
$$;
revoke all on function public.get_public_video_stats(uuid[]) from public;
grant execute on function public.get_public_video_stats(uuid[]) to anon,authenticated;

drop function if exists public.get_public_review_stats();
create function public.get_public_review_stats()
returns table(review_id uuid,total_sold bigint,total_links bigint,total_likes bigint,total_comments bigint,total_shares bigint)
language sql stable security definer set search_path=public as $$
 select r.id,
  coalesce((select count(*) from public.cashi_orders o where o.review_id=r.id and o.purpose='review_download' and o.status='SETTLED'),0)::bigint,
  coalesce(r.view_count,0)::bigint,
  coalesce((select count(*) from public.review_likes l where l.review_id=r.id),0)::bigint,
  coalesce((select count(*) from public.review_comments c where c.review_id=r.id and c.is_hidden=false),0)::bigint,
  coalesce(r.share_count,0)::bigint
 from public.review_items r where r.status='published';
$$;
revoke all on function public.get_public_review_stats() from public;
grant execute on function public.get_public_review_stats() to anon,authenticated;

create table if not exists public.vip_group_entitlements(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.vip_groups(id) on delete cascade,
  order_id text unique references public.cashi_orders(order_id),
  telegram_url text not null,
  created_at timestamptz not null default now(),
  invite_expires_at timestamptz,
  unique(user_id,group_id)
);
alter table public.vip_group_entitlements enable row level security;
drop policy if exists "own vip group entitlements" on public.vip_group_entitlements;
create policy "own vip group entitlements" on public.vip_group_entitlements
  for select to authenticated using(auth.uid()=user_id or public.is_admin());
drop policy if exists "admin vip group entitlements" on public.vip_group_entitlements;
create policy "admin vip group entitlements" on public.vip_group_entitlements
  for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.vip_group_entitlements to authenticated;

alter table public.vip_group_entitlements
  add column if not exists invite_expires_at timestamptz;
update public.vip_group_entitlements
set invite_expires_at=created_at+interval '12 hours'
where invite_expires_at is null;

-- Seed/normalize the four launch groups. Their invitation URLs stay in the
-- private vip_group_secrets table and are copied into an entitlement only
-- after the corresponding Cashi order has been verified as SETTLED.
-- Rename the legacy seed records in-place so existing group IDs and private
-- invite-secret references remain stable instead of creating duplicate cards.
update public.vip_groups g set name='Group Telegram Premium Access'
where g.name='Premium Access' and not exists(select 1 from public.vip_groups x where x.name='Group Telegram Premium Access');
update public.vip_groups g set name='Group VIP Boxcel'
where g.name in ('VIP Boxcil','VIP Boxcel') and not exists(select 1 from public.vip_groups x where x.name='Group VIP Boxcel' and x.id<>g.id);
update public.vip_groups g set name='Group VIP INDO'
where g.name in ('VIP Indo','VIP INDO') and not exists(select 1 from public.vip_groups x where x.name='Group VIP INDO' and x.id<>g.id);
update public.vip_groups g set name='Group VIP VGK'
where g.name='VIP VGK' and not exists(select 1 from public.vip_groups x where x.name='Group VIP VGK' and x.id<>g.id);

insert into public.vip_groups(name,description,price,member_count,status)
values
 ('Group Telegram Premium Access','Group update setiap hari. Media bisa langsung ditonton dan disimpan. Koleksi berisi banyak media pilihan, viral, dan terbaru. Sekali bayar Rp250.000 untuk akses permanen dan bergaransi.',250000,0,'published'),
 ('Group VIP Boxcel','Group khusus pecinta Boxcel. Nikmati banyak media viral dan terbaru, bisa ditonton langsung dan disimpan, dengan update setiap hari. Sekali bayar Rp100.000 untuk akses permanen.',100000,0,'published'),
 ('Group VIP INDO','Group khusus Asupan Pemersatu Local Indo. Banyak media pilihan, viral, dan terbaru yang bisa ditonton serta disimpan. Update setiap hari. Sekali bayar Rp75.000 untuk akses permanen.',75000,0,'published'),
 ('Group VIP VGK','Group khusus pecinta VGK. Nikmati banyak media pilihan dan terbaru, bisa ditonton langsung serta disimpan. Update setiap hari. Sekali bayar Rp50.000 untuk akses permanen.',50000,0,'published')
on conflict(name) do update set description=excluded.description,price=excluded.price,status='published';

insert into public.vip_group_secrets(group_id,telegram_url)
select id,case name
 when 'Group Telegram Premium Access' then 'https://t.me/+6TuJGSGCDSc5MGM5'
 when 'Group VIP Boxcel' then 'https://t.me/+S8Su8lUvcSpmNWQ1'
 when 'Group VIP INDO' then 'https://t.me/+jLjsw3_lI50yMjM0'
 when 'Group VIP VGK' then 'https://t.me/+Gs3cVfpSrRY4OTc5'
end
from public.vip_groups
where name in ('Group Telegram Premium Access','Group VIP Boxcel','Group VIP INDO','Group VIP VGK')
on conflict(group_id) do update set telegram_url=excluded.telegram_url,updated_at=now();

-- Snapshot invitation URL at order creation is already captured by create-payment.
-- The entitlement receives a 12-hour display window after settlement.
create or replace function public.settle_cashi_order(
  p_order_id text,p_amount bigint,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 o public.cashi_orders%rowtype;
 v_exp timestamptz;
 v_days integer;
 v_url text;
 v_coupon public.discount_coupon_reservations%rowtype;
begin
 select * into o from public.cashi_orders where order_id=p_order_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
 if o.status='SETTLED' then return jsonb_build_object('ok',true,'duplicate',true); end if;
 if o.status<>'PENDING' then return jsonb_build_object('ok',false,'reason','ORDER_NOT_PAYABLE'); end if;
 if p_amount is null or p_amount<>o.amount then return jsonb_build_object('ok',false,'reason','AMOUNT_MISMATCH'); end if;

 if o.purpose='vip' then
  select duration_days into v_days from public.vip_plans where id=o.plan_id and status='published';
  if v_days is null or v_days<1 then return jsonb_build_object('ok',false,'reason','VIP_PLAN_UNAVAILABLE'); end if;
 elsif o.purpose='review_download' then
  if not exists(select 1 from public.review_items where id=o.review_id and status='published') then return jsonb_build_object('ok',false,'reason','REVIEW_UNAVAILABLE'); end if;
 elsif o.purpose='vip_group' then
  select coalesce(o.vip_group_invite_url,s.telegram_url) into v_url
  from public.vip_groups g left join public.vip_group_secrets s on s.group_id=g.id
  where g.id=o.vip_group_id and g.status='published';
  if v_url is null or length(trim(v_url))=0 then return jsonb_build_object('ok',false,'reason','GROUP_INVITE_NOT_CONFIGURED'); end if;
 else return jsonb_build_object('ok',false,'reason','UNKNOWN_PURPOSE');
 end if;

 if o.coupon_code is not null then
  select * into v_coupon from public.discount_coupon_reservations
  where order_id=o.order_id and user_id=o.user_id and state='reserved' for update;
  if not found then return jsonb_build_object('ok',false,'reason','COUPON_RESERVATION_MISSING'); end if;
 end if;

 update public.cashi_orders set status='SETTLED',provider_amount=p_amount,
  gateway_payload=coalesce(p_payload,'{}'::jsonb),settled_at=now(),updated_at=now()
 where order_id=p_order_id;

 if o.coupon_code is not null then
  update public.discount_coupons set uses_reserved=greatest(uses_reserved-1,0),uses_used=uses_used+1
  where user_id=o.user_id and code=v_coupon.coupon_code;
  update public.discount_coupon_reservations set state='consumed' where order_id=o.order_id and state='reserved';
 end if;

 if o.purpose='vip' then
  select vip_expires_at into v_exp from public.profiles where id=o.user_id for update;
  update public.profiles
  set vip_started_at=case
        when v_exp is null or v_exp<=now() then now()
        else coalesce(vip_started_at,now())
      end,
      vip_expires_at=greatest(coalesce(v_exp,now()),now())+make_interval(days=>v_days)
  where id=o.user_id;
 elsif o.purpose='review_download' then
  insert into public.review_entitlements(user_id,review_id,order_id)
  values(o.user_id,o.review_id,o.order_id) on conflict(user_id,review_id) do nothing;
 elsif o.purpose='vip_group' then
  insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url,invite_expires_at)
  values(o.user_id,o.vip_group_id,o.order_id,v_url,now()+interval '12 hours')
  on conflict(user_id,group_id) do update set order_id=excluded.order_id,telegram_url=excluded.telegram_url,
   created_at=now(),invite_expires_at=now()+interval '12 hours';
 end if;
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;

-- Admin can manage member profile fields (ban state and package expirations).
drop policy if exists "admin profiles" on public.profiles;
create policy "admin profiles" on public.profiles
  for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,update,delete on public.profiles to authenticated;


-- Prevent ordinary users from changing their own role, ban flag or membership expiry.
create or replace function public.protect_profile_privilege_fields()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and auth.uid()=old.id and not public.is_admin() then
    new.role:=old.role;
    new.is_banned:=old.is_banned;
    new.vip_started_at:=old.vip_started_at;
    new.vip_expires_at:=old.vip_expires_at;
    new.premium_expires_at:=old.premium_expires_at;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_privilege_fields on public.profiles;
create trigger protect_profile_privilege_fields
before update on public.profiles
for each row execute function public.protect_profile_privilege_fields();


-- Group invite URLs are only returned while the 12-hour access window is active.
-- Keep purchase history readable after expiry, but never expose expired invite URLs.
revoke select on public.vip_group_entitlements from anon,authenticated;
grant select(id,user_id,group_id,order_id,created_at,invite_expires_at)
  on public.vip_group_entitlements to authenticated;
create or replace function public.get_my_vip_group_entitlements()
returns table(
  entitlement_id uuid,
  group_id uuid,
  group_name text,
  purchased_at timestamptz,
  invite_expires_at timestamptz,
  telegram_url text
)
language sql stable security definer set search_path=public as $$
  select e.id,e.group_id,g.name,e.created_at,e.invite_expires_at,
    case when e.invite_expires_at>now() then e.telegram_url else null end
  from public.vip_group_entitlements e
  join public.vip_groups g on g.id=e.group_id
  where e.user_id=auth.uid()
  order by e.created_at desc;
$$;
revoke all on function public.get_my_vip_group_entitlements() from public,anon;
grant execute on function public.get_my_vip_group_entitlements() to authenticated;

commit;


-- ============================================================================
-- STEP 18: supabase/vip_groups_profile_link_refresh.sql
-- ============================================================================
-- BoxCellink VIP Groups: profile access uses the latest admin-managed invite URL.
-- Run this migration in Supabase SQL Editor after vip_group_secret_hardening.sql.
begin;

create table if not exists public.vip_group_secrets(
  group_id uuid primary key references public.vip_groups(id) on delete cascade,
  telegram_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.vip_group_entitlements
  add column if not exists invite_expires_at timestamptz;

alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets"
  on public.vip_group_secrets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.vip_group_secrets from anon, authenticated;
grant select, insert, update, delete on public.vip_group_secrets to authenticated;

-- Return purchase history to its owner, but resolve the current invitation URL
-- from the admin-managed secret table. Updating a banned/replaced group link
-- therefore updates the link shown to every existing purchaser without another
-- payment. Telegram itself controls whether that invitation is still valid.
create or replace function public.get_my_vip_group_entitlements()
returns table(
  entitlement_id uuid,
  group_id uuid,
  group_name text,
  purchased_at timestamptz,
  invite_expires_at timestamptz,
  telegram_url text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    e.id,
    e.group_id,
    g.name,
    e.created_at,
    e.invite_expires_at,
    coalesce(nullif(s.telegram_url,''), e.telegram_url)
  from public.vip_group_entitlements e
  join public.vip_groups g on g.id=e.group_id
  left join public.vip_group_secrets s on s.group_id=e.group_id
  where e.user_id=auth.uid()
  order by e.created_at desc;
$$;

revoke all on function public.get_my_vip_group_entitlements() from public, anon;
grant execute on function public.get_my_vip_group_entitlements() to authenticated;

commit;


-- ============================================================================
-- STEP 19: supabase/admin_vip_crud_fix.sql
-- ============================================================================
-- ProjectVID / BoxCellink: repair admin CRUD for VIP, Group VIP and discount management.
-- Run AFTER admin_vip_discount_management.sql and vip_group_secret_hardening.sql.
-- Safe to run more than once.

-- Ensure authenticated users can reach the tables; RLS below limits writes to admins.
grant usage on schema public to authenticated;

alter table public.vip_plans enable row level security;
drop policy if exists "published plans" on public.vip_plans;
create policy "published plans" on public.vip_plans
  for select to anon, authenticated using (status='published' or public.is_admin());
drop policy if exists "admin plans" on public.vip_plans;
create policy "admin plans" on public.vip_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.vip_plans to authenticated;

alter table public.vip_groups enable row level security;
drop policy if exists "public vip groups" on public.vip_groups;
create policy "public vip groups" on public.vip_groups
  for select to anon, authenticated using (status='published' or public.is_admin());
drop policy if exists "admin vip groups" on public.vip_groups;
create policy "admin vip groups" on public.vip_groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Do not grant access to the legacy telegram_url column. The invite is stored privately.
grant select (id,name,description,price,member_count,status,created_at) on public.vip_groups to anon, authenticated;
grant insert (name,description,price,member_count,status) on public.vip_groups to authenticated;
grant update (name,description,price,member_count,status) on public.vip_groups to authenticated;
grant delete on public.vip_groups to authenticated;

alter table public.admin_discount_codes enable row level security;
drop policy if exists "admin discount codes" on public.admin_discount_codes;
create policy "admin discount codes" on public.admin_discount_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.admin_discount_codes to authenticated;

create table if not exists public.vip_group_secrets (
  group_id uuid primary key references public.vip_groups(id) on delete cascade,
  telegram_url text not null,
  updated_at timestamptz not null default now()
);
alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets" on public.vip_group_secrets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.vip_group_secrets to authenticated;

-- Keep the admin role check callable by authenticated sessions.
grant execute on function public.is_admin() to authenticated;


-- ============================================================================
-- STEP 20: supabase/admin_discount_claim_flow.sql
-- ============================================================================
-- Run AFTER admin_vip_discount_management.sql and vip_group_secret_hardening.sql.
-- Enables member claim, single-use redemption, and verified-payment consumption of admin promo codes.
create table if not exists public.admin_discount_reservations(
 order_id text primary key,
 claim_id uuid not null references public.admin_discount_claims(id) on delete cascade,
 code_id uuid not null references public.admin_discount_codes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 state text not null default 'reserved' check(state in ('reserved','consumed','released')),
 created_at timestamptz not null default now()
);
create unique index if not exists admin_discount_one_open_reservation_idx on public.admin_discount_reservations(claim_id) where state='reserved';
alter table public.admin_discount_reservations enable row level security;
revoke all on public.admin_discount_reservations from anon,authenticated;

-- A member may read the details of codes they have claimed, including after expiry.
drop policy if exists "own claimed discount code details" on public.admin_discount_codes;
create policy "own claimed discount code details" on public.admin_discount_codes for select using(
 expires_at is null or expires_at>now() or public.is_admin() or exists(
  select 1 from public.admin_discount_claims cl where cl.code_id=admin_discount_codes.id and cl.user_id=auth.uid()
 )
);

create or replace function public.reserve_referral_coupon(p_user_id uuid,p_code text,p_order_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.discount_coupons%rowtype; a public.admin_discount_codes%rowtype; cl public.admin_discount_claims%rowtype; v_base bigint;
begin
 select coalesce(base_amount,amount) into v_base from public.cashi_orders where order_id=p_order_id and user_id=p_user_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
 select * into c from public.discount_coupons where user_id=p_user_id and upper(code)=upper(trim(p_code)) for update;
 if found then
  if c.uses_used+c.uses_reserved>=c.uses_total then return jsonb_build_object('ok',false,'reason','Kode diskon referral sudah habis'); end if;
  insert into public.discount_coupon_reservations(order_id,user_id,coupon_code,state) values(p_order_id,p_user_id,c.code,'reserved');
  update public.cashi_orders set coupon_code=c.code where order_id=p_order_id and user_id=p_user_id;
  update public.discount_coupons set uses_reserved=uses_reserved+1 where id=c.id;
  return jsonb_build_object('ok',true,'discount_percent',c.discount_percent,'coupon_code',c.code);
 end if;
 select d.* into a from public.admin_discount_codes d join public.admin_discount_claims x on x.code_id=d.id
  where x.user_id=p_user_id and upper(d.code)=upper(trim(p_code)) and x.used_at is null
   and (d.expires_at is null or d.expires_at>now())
   and not exists(select 1 from public.admin_discount_reservations r where r.claim_id=x.id and r.state='reserved')
  for update of d,x;
 if not found then return jsonb_build_object('ok',false,'reason','Kode diskon tidak ditemukan, expired, atau sudah digunakan'); end if;
 if v_base<a.min_purchase then return jsonb_build_object('ok',false,'reason','Minimal pembelian kode ini belum terpenuhi'); end if;
 select x.* into cl from public.admin_discount_claims x where x.user_id=p_user_id and x.code_id=a.id and x.used_at is null for update;
 insert into public.admin_discount_reservations(order_id,claim_id,code_id,user_id,state) values(p_order_id,cl.id,a.id,p_user_id,'reserved');
 update public.cashi_orders set coupon_code=a.code where order_id=p_order_id and user_id=p_user_id;
 return jsonb_build_object('ok',true,'discount_percent',a.discount_percent,'coupon_code',a.code);
end $$;
revoke all on function public.reserve_referral_coupon(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_referral_coupon(uuid,text,text) to service_role;

create or replace function public.release_referral_coupon(p_order_id text)
returns void language plpgsql security definer set search_path=public as $$
declare r public.discount_coupon_reservations%rowtype;
begin
 select * into r from public.discount_coupon_reservations where order_id=p_order_id for update;
 if found and r.state='reserved' then
  update public.discount_coupons set uses_reserved=greatest(uses_reserved-1,0) where user_id=r.user_id and code=r.coupon_code;
  update public.discount_coupon_reservations set state='released' where order_id=p_order_id;
  return;
 end if;
 update public.admin_discount_reservations set state='released' where order_id=p_order_id and state='reserved';
end $$;
revoke all on function public.release_referral_coupon(text) from public,anon,authenticated;
grant execute on function public.release_referral_coupon(text) to service_role;

create or replace function public.settle_cashi_order(
  p_order_id text, p_amount bigint, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  o public.cashi_orders%rowtype;
  v_exp timestamptz;
  v_days integer;
  v_url text;
  v_res public.discount_coupon_reservations%rowtype;
  v_admin_res public.admin_discount_reservations%rowtype;
begin
  select * into o from public.cashi_orders where order_id=p_order_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
  if o.status='SETTLED' then return jsonb_build_object('ok',true,'duplicate',true); end if;
  if o.status<>'PENDING' then return jsonb_build_object('ok',false,'reason','ORDER_NOT_PAYABLE'); end if;
  if p_amount is null or p_amount<>o.amount then
    return jsonb_build_object('ok',false,'reason','AMOUNT_MISMATCH');
  end if;

  if o.purpose='vip' then
    select duration_days into v_days from public.vip_plans
      where id=o.plan_id and status='published';
    if v_days is null or v_days<1 then
      return jsonb_build_object('ok',false,'reason','VIP_PLAN_UNAVAILABLE');
    end if;
  elsif o.purpose='review_download' then
    if not exists(select 1 from public.review_items where id=o.review_id and status='published') then
      return jsonb_build_object('ok',false,'reason','REVIEW_UNAVAILABLE');
    end if;
  elsif o.purpose='vip_group' then
    select coalesce(o.vip_group_invite_url,s.telegram_url) into v_url from public.vip_group_secrets s
      where s.group_id=o.vip_group_id;
    if v_url is null or length(trim(v_url))=0 then
      return jsonb_build_object('ok',false,'reason','GROUP_INVITE_NOT_CONFIGURED');
    end if;
  else
    return jsonb_build_object('ok',false,'reason','UNKNOWN_PURPOSE');
  end if;

  if o.coupon_code is not null then
    select * into v_res from public.discount_coupon_reservations
      where order_id=o.order_id and user_id=o.user_id and state='reserved' for update;
    if not found then
      select * into v_admin_res from public.admin_discount_reservations
        where order_id=o.order_id and user_id=o.user_id and state='reserved' for update;
      if not found then
        return jsonb_build_object('ok',false,'reason','COUPON_RESERVATION_MISSING');
      end if;
    end if;
  end if;

  update public.cashi_orders set status='SETTLED',provider_amount=p_amount,
    gateway_payload=coalesce(p_payload,'{}'::jsonb),settled_at=now(),updated_at=now()
    where order_id=p_order_id;

  if o.coupon_code is not null then
    if v_res.order_id is not null then
      update public.discount_coupons set
        uses_reserved=greatest(uses_reserved-1,0), uses_used=uses_used+1
        where user_id=o.user_id and code=v_res.coupon_code;
      update public.discount_coupon_reservations set state='consumed'
        where order_id=o.order_id and state='reserved';
    else
      update public.admin_discount_claims set used_at=now(),used_for=o.order_id
        where id=v_admin_res.claim_id and user_id=o.user_id and used_at is null;
      update public.admin_discount_reservations set state='consumed'
        where order_id=o.order_id and state='reserved';
    end if;
  end if;

  if o.purpose='vip' then
    select greatest(coalesce(vip_expires_at,now()),now()) into v_exp
      from public.profiles where id=o.user_id for update;
    update public.profiles set vip_expires_at=coalesce(v_exp,now())+make_interval(days=>v_days)
      where id=o.user_id;
  elsif o.purpose='review_download' then
    insert into public.review_entitlements(user_id,review_id,order_id)
      values(o.user_id,o.review_id,o.order_id)
      on conflict(user_id,review_id) do nothing;
  elsif o.purpose='vip_group' then
    insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url)
      values(o.user_id,o.vip_group_id,o.order_id,v_url)
      on conflict(user_id,group_id) do nothing;
  end if;
  return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;


-- ============================================================================
-- STEP 21: supabase/admin_discount_scope_and_crud_fix.sql
-- ============================================================================
-- BoxCellink / ProjectVID: admin CRUD and discount purpose targeting.
-- Run after admin_discount_claim_flow.sql, admin_vip_crud_fix.sql and vip_group_secret_hardening.sql.

alter table public.admin_discount_codes add column if not exists scope text not null default 'all';
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_scope_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_scope_check
  check (scope in ('all','vip_account','vip_group','telegram_review'));
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_discount_percent_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_discount_percent_check
  check (discount_percent between 1 and 75);
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_claim_limit_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_claim_limit_check
  check (claim_limit between 1 and 10000);
alter table public.admin_discount_codes alter column claim_limit set default 2;
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_min_purchase_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_min_purchase_check check(min_purchase>=2000);

-- Ensure admin CRUD policies and grants are in place for all management tables.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.vip_plans to authenticated;
grant select,insert,update,delete on public.admin_discount_codes to authenticated;
grant select (id,name,description,price,member_count,status,created_at) on public.vip_groups to anon,authenticated;
grant insert (name,description,price,member_count,status) on public.vip_groups to authenticated;
grant update (name,description,price,member_count,status) on public.vip_groups to authenticated;
grant delete on public.vip_groups to authenticated;
grant select,insert,update,delete on public.vip_group_secrets to authenticated;

-- Keep group invitation links private, but manageable by administrators.
alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets" on public.vip_group_secrets
 for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Ensure VIP plan and group CRUD is restricted to admins.
alter table public.vip_plans enable row level security;
drop policy if exists "admin plans" on public.vip_plans;
create policy "admin plans" on public.vip_plans for all to authenticated
 using(public.is_admin()) with check(public.is_admin());
alter table public.vip_groups enable row level security;
drop policy if exists "admin vip groups" on public.vip_groups;
create policy "admin vip groups" on public.vip_groups for all to authenticated
 using(public.is_admin()) with check(public.is_admin());
alter table public.admin_discount_codes enable row level security;
drop policy if exists "admin discount codes" on public.admin_discount_codes;
create policy "admin discount codes" on public.admin_discount_codes for all to authenticated
 using(public.is_admin()) with check(public.is_admin());

-- A code can only be reserved for the purchase type selected by the administrator.
create or replace function public.reserve_referral_coupon(p_user_id uuid,p_code text,p_order_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 c public.discount_coupons%rowtype; a public.admin_discount_codes%rowtype;
 cl public.admin_discount_claims%rowtype; v_base bigint; v_purpose text; v_scope text;
begin
 select coalesce(base_amount,amount),purpose into v_base,v_purpose
 from public.cashi_orders where order_id=p_order_id and user_id=p_user_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
 select * into c from public.discount_coupons where user_id=p_user_id and upper(code)=upper(trim(p_code)) for update;
 if found then
  if v_purpose<>'review_download' then return jsonb_build_object('ok',false,'reason','Kode referral hanya berlaku untuk review media Telegram'); end if;
  if c.uses_used+c.uses_reserved>=c.uses_total then return jsonb_build_object('ok',false,'reason','Kode diskon referral sudah habis'); end if;
  insert into public.discount_coupon_reservations(order_id,user_id,coupon_code,state) values(p_order_id,p_user_id,c.code,'reserved');
  update public.cashi_orders set coupon_code=c.code where order_id=p_order_id and user_id=p_user_id;
  update public.discount_coupons set uses_reserved=uses_reserved+1 where id=c.id;
  return jsonb_build_object('ok',true,'discount_percent',c.discount_percent,'coupon_code',c.code);
 end if;
 select d.* into a from public.admin_discount_codes d join public.admin_discount_claims x on x.code_id=d.id
 where x.user_id=p_user_id and upper(d.code)=upper(trim(p_code)) and x.used_at is null
   and (d.expires_at is null or d.expires_at>now())
   and not exists(select 1 from public.admin_discount_reservations r where r.claim_id=x.id and r.state='reserved')
 for update of d,x;
 if not found then return jsonb_build_object('ok',false,'reason','Kode diskon tidak ditemukan, expired, atau sudah digunakan'); end if;
 v_scope:=case when v_purpose='vip' then 'vip_account' when v_purpose='vip_group' then 'vip_group' when v_purpose='review_download' then 'telegram_review' else 'invalid' end;
 if a.scope not in ('all',v_scope) then return jsonb_build_object('ok',false,'reason','Kode diskon ini tidak berlaku untuk jenis pembelian tersebut'); end if;
 if v_base<a.min_purchase then return jsonb_build_object('ok',false,'reason','Minimal pembelian kode ini belum terpenuhi'); end if;
 select x.* into cl from public.admin_discount_claims x where x.user_id=p_user_id and x.code_id=a.id and x.used_at is null for update;
 insert into public.admin_discount_reservations(order_id,claim_id,code_id,user_id,state) values(p_order_id,cl.id,a.id,p_user_id,'reserved');
 update public.cashi_orders set coupon_code=a.code where order_id=p_order_id and user_id=p_user_id;
 return jsonb_build_object('ok',true,'discount_percent',a.discount_percent,'coupon_code',a.code);
end $$;
revoke all on function public.reserve_referral_coupon(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_referral_coupon(uuid,text,text) to service_role;

-- Update claim RPC response with scope for member-facing display.
create or replace function public.claim_admin_discount(p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.admin_discount_codes%rowtype; v_id uuid;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select * into c from public.admin_discount_codes where upper(code)=upper(trim(p_code)) for update;
 if not found then return jsonb_build_object('ok',false,'reason','CODE_NOT_FOUND'); end if;
 if c.expires_at is not null and c.expires_at<=now() then return jsonb_build_object('ok',false,'reason','EXPIRED'); end if;
 if c.claimed_count>=c.claim_limit then return jsonb_build_object('ok',false,'reason','CLAIM_LIMIT'); end if;
 if exists(select 1 from public.admin_discount_claims where code_id=c.id and user_id=auth.uid()) then return jsonb_build_object('ok',false,'reason','ALREADY_CLAIMED'); end if;
 insert into public.admin_discount_claims(code_id,user_id) values(c.id,auth.uid()) returning id into v_id;
 update public.admin_discount_codes set claimed_count=claimed_count+1 where id=c.id;
 return jsonb_build_object('ok',true,'claim_id',v_id,'code',c.code,'scope',c.scope,'discount_percent',c.discount_percent,'min_purchase',c.min_purchase,'expires_at',c.expires_at);
end $$;
revoke all on function public.claim_admin_discount(text) from public,anon;
grant execute on function public.claim_admin_discount(text) to authenticated;


-- ============================================================================
-- STEP 22: supabase/review_delete_preserve_orders.sql
-- ============================================================================
-- =============================================================
-- Aman menghapus review tanpa menghapus riwayat cashi_orders.
-- Mendukung seluruh jenis pesanan Projectvid:
--   vip, review_download, dan vip_group.
-- Jalankan sekali melalui Supabase Dashboard > SQL Editor.
-- =============================================================

begin;

-- Pastikan kolom grup VIP tersedia (biasanya sudah dibuat oleh
-- vip_group_account_migration.sql).
alter table public.cashi_orders
  add column if not exists vip_group_id uuid
  references public.vip_groups(id) on delete set null;

-- Pesanan review yang masih menunggu pembayaran tidak boleh tetap aktif
-- setelah review dihapus. Tandai EXPIRED sebelum FK melepas review_id.
create or replace function public.expire_review_orders_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cashi_orders
     set status = 'EXPIRED',
         updated_at = now()
   where review_id = old.id
     and purpose = 'review_download'
     and status = 'PENDING';

  return old;
end;
$$;

revoke all on function public.expire_review_orders_before_delete()
  from public, anon, authenticated;

drop trigger if exists expire_review_orders_before_delete
  on public.review_items;

create trigger expire_review_orders_before_delete
before delete on public.review_items
for each row
execute function public.expire_review_orders_before_delete();

-- Pertahankan baris pesanan. Saat review dihapus, hanya review_id
-- yang menjadi NULL; order dan data pembayarannya tetap tersimpan.
alter table public.cashi_orders
  drop constraint if exists cashi_orders_review_id_fkey;

alter table public.cashi_orders
  add constraint cashi_orders_review_id_fkey
  foreign key (review_id)
  references public.review_items(id)
  on delete set null;

-- PENTING: pertahankan aturan untuk vip_group.
-- Review yang sudah dihapus boleh memiliki review_id NULL selama
-- statusnya bukan PENDING (termasuk SETTLED/EXPIRED/FAILED).
alter table public.cashi_orders
  drop constraint if exists order_target_check;

alter table public.cashi_orders
  add constraint order_target_check check (
    (
      purpose = 'vip'
      and plan_id is not null
      and review_id is null
      and vip_group_id is null
    )
    or
    (
      purpose = 'review_download'
      and plan_id is null
      and vip_group_id is null
      and (review_id is not null or status <> 'PENDING')
    )
    or
    (
      purpose = 'vip_group'
      and vip_group_id is not null
      and plan_id is null
      and review_id is null
    )
  );

commit;


-- ============================================================================
-- STEP 23: supabase/content_delete_cleanup.sql
-- ============================================================================
-- ProjectVID: hard-delete content and cascade its dependent rows.
-- Run AFTER review_delete_preserve_orders.sql and all content/social migrations.
-- Content data is removed permanently. Payment ledger rows are retained for audit.
begin;

-- Ensure the order model supports all current product types and can retain
-- settled review orders after the referenced review row is removed.
alter table public.cashi_orders
  add column if not exists vip_group_id uuid
  references public.vip_groups(id) on delete set null;
alter table public.cashi_orders drop constraint if exists order_target_check;
alter table public.cashi_orders add constraint order_target_check check (
  (purpose = 'vip' and plan_id is not null and review_id is null and vip_group_id is null)
  or
  (purpose = 'review_download' and plan_id is null and vip_group_id is null
    and (review_id is not null or status <> 'PENDING'))
  or
  (purpose = 'vip_group' and vip_group_id is not null and plan_id is null and review_id is null)
);

-- A review deletion must not leave an unpaid order pointing at deleted content.
create or replace function public.expire_review_orders_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cashi_orders
     set status = 'EXPIRED', updated_at = now()
   where review_id = old.id
     and purpose = 'review_download'
     and status = 'PENDING';
  return old;
end;
$$;
revoke all on function public.expire_review_orders_before_delete() from public, anon, authenticated;
drop trigger if exists expire_review_orders_before_delete on public.review_items;
create trigger expire_review_orders_before_delete
before delete on public.review_items
for each row execute function public.expire_review_orders_before_delete();

-- Keep order/payment history, but detach it from deleted review content.
alter table public.cashi_orders drop constraint if exists cashi_orders_review_id_fkey;
alter table public.cashi_orders
  add constraint cashi_orders_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete set null;

-- A deleted review removes all content-specific records and paid access records.
alter table public.review_download_secrets drop constraint if exists review_download_secrets_review_id_fkey;
alter table public.review_download_secrets
  add constraint review_download_secrets_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

alter table public.review_content_secrets drop constraint if exists review_content_secrets_review_id_fkey;
alter table public.review_content_secrets
  add constraint review_content_secrets_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

alter table public.review_entitlements drop constraint if exists review_entitlements_review_id_fkey;
alter table public.review_entitlements
  add constraint review_entitlements_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

alter table public.review_likes drop constraint if exists review_likes_review_id_fkey;
alter table public.review_likes
  add constraint review_likes_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

alter table public.review_comments drop constraint if exists review_comments_review_id_fkey;
alter table public.review_comments
  add constraint review_comments_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

-- A deleted video removes likes, comments, comment replies/reactions and watch history.
alter table public.video_likes drop constraint if exists video_likes_video_id_fkey;
alter table public.video_likes
  add constraint video_likes_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete cascade;

alter table public.video_comments drop constraint if exists video_comments_video_id_fkey;
alter table public.video_comments
  add constraint video_comments_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete cascade;

alter table public.video_watch_history drop constraint if exists video_watch_history_video_id_fkey;
alter table public.video_watch_history
  add constraint video_watch_history_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete cascade;

alter table public.video_comment_replies drop constraint if exists video_comment_replies_comment_id_fkey;
alter table public.video_comment_replies
  add constraint video_comment_replies_comment_id_fkey
  foreign key (comment_id) references public.video_comments(id) on delete cascade;

alter table public.video_comment_likes drop constraint if exists video_comment_likes_comment_id_fkey;
alter table public.video_comment_likes
  add constraint video_comment_likes_comment_id_fkey
  foreign key (comment_id) references public.video_comments(id) on delete cascade;

commit;
