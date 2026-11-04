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
