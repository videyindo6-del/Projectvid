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
