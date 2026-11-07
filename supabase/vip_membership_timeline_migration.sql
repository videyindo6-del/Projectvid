-- BoxCellink VIP membership timeline + verified payment activation
-- Run this migration once in Supabase SQL Editor before deploying the updated site.
begin;
alter table public.profiles add column if not exists vip_started_at timestamptz;

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
commit;
