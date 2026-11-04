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
