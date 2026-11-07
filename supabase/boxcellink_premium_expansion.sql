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
