-- Endorse campaigns v1. Apply after current BoxCellink migrations.
-- Extend the existing legacy banner-slot check to include Final middle.
alter table public.endorse_settings drop constraint if exists endorse_settings_slot_check;
alter table public.endorse_settings add constraint endorse_settings_slot_check check(slot in ('go_top','go_middle','go_bottom','final_top','final_middle','final_bottom'));
create extension if not exists pgcrypto;
alter table public.cashi_orders alter column user_id drop not null;
alter table public.cashi_orders drop constraint if exists cashi_orders_purpose_check;
alter table public.cashi_orders add constraint cashi_orders_purpose_check
 check(purpose in ('vip','review_download','vip_group','wallet_topup','autolink_direct_access','endorse'));
alter table public.cashi_orders drop constraint if exists order_target_check;
alter table public.cashi_orders add constraint order_target_check check (
 (purpose='vip' and plan_id is not null and review_id is null and vip_group_id is null and autolink_id is null) or
 (purpose='review_download' and plan_id is null and vip_group_id is null and autolink_id is null and (review_id is not null or status <> 'PENDING')) or
 (purpose='vip_group' and vip_group_id is not null and plan_id is null and review_id is null and autolink_id is null) or
 (purpose='wallet_topup' and plan_id is null and review_id is null and vip_group_id is null and autolink_id is null) or
 (purpose='autolink_direct_access' and autolink_id is not null and plan_id is null and review_id is null and vip_group_id is null) or
 (purpose='endorse' and plan_id is null and review_id is null and vip_group_id is null and autolink_id is null)
);
create table if not exists public.endorse_orders (
 id uuid primary key default gen_random_uuid(), order_id text unique not null references public.cashi_orders(order_id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null, guest_token_hash text,
 slot text not null check(slot in ('go_top','go_middle','go_bottom','final_top','final_middle','final_bottom')),
 duration_days integer not null check(duration_days in (1,2,5)), amount bigint not null check(amount>0),
 target_url text not null, image_url text not null, admin_media_url text, admin_embed_html text,
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','paid_pending_review','rejected','queued','active','expired','payment_failed')),
 rejection_reason text, approved_by uuid references auth.users(id), approved_at timestamptz,
 starts_at timestamptz, ends_at timestamptz, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(user_id is not null or guest_token_hash is not null)
);
create index if not exists endorse_orders_created_idx on public.endorse_orders(created_at desc);
create index if not exists endorse_orders_status_idx on public.endorse_orders(status,created_at desc);
alter table public.endorse_orders enable row level security;
drop policy if exists endorse_orders_owner_read on public.endorse_orders;
create policy endorse_orders_owner_read on public.endorse_orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists endorse_orders_admin_manage on public.endorse_orders;
create policy endorse_orders_admin_manage on public.endorse_orders for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.endorse_orders to authenticated;
grant all on public.endorse_orders to service_role;
-- Image storage bucket; uploads are restricted to authenticated users. Admin can also upload.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('endorse-media','endorse-media',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];
drop policy if exists endorse_media_auth_upload on storage.objects;
create policy endorse_media_auth_upload on storage.objects for insert to authenticated with check(bucket_id='endorse-media');
drop policy if exists endorse_media_public_read on storage.objects;
create policy endorse_media_public_read on storage.objects for select to anon,authenticated using(bucket_id='endorse-media');
-- Payment settlement hook updates the campaign state; never trusts client-side payment claims.
create or replace function public.sync_endorse_payment_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.purpose='endorse' and new.status='SETTLED' and old.status is distinct from 'SETTLED' then
  update public.endorse_orders set status='paid_pending_review',updated_at=now() where order_id=new.order_id and status='awaiting_payment';
 elsif new.purpose='endorse' and new.status in ('FAILED','EXPIRED','CANCELLED','CANCELED') then
  update public.endorse_orders set status='payment_failed',updated_at=now() where order_id=new.order_id and status='awaiting_payment';
 end if;
 return new;
end $$;
drop trigger if exists cashi_endorse_status_sync on public.cashi_orders;
create trigger cashi_endorse_status_sync after update of status on public.cashi_orders for each row execute function public.sync_endorse_payment_status();
-- Extend settlement RPC to accept endorse orders without changing existing settlement effects.
create or replace function public.settle_cashi_order(
 p_order_id text, p_amount bigint, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.cashi_orders%rowtype; v_exp timestamptz; v_days integer; v_url text; v_res public.discount_coupon_reservations%rowtype;
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
  select coalesce(o.vip_group_invite_url,telegram_url) into v_url from public.vip_groups where id=o.vip_group_id;
  if v_url is null or length(trim(v_url))=0 then return jsonb_build_object('ok',false,'reason','GROUP_INVITE_NOT_CONFIGURED'); end if;
 elsif o.purpose='endorse' then
  if not exists(select 1 from public.endorse_orders e where e.order_id=o.order_id and e.status='awaiting_payment') then return jsonb_build_object('ok',false,'reason','ENDORSE_ORDER_UNAVAILABLE'); end if;
 else return jsonb_build_object('ok',false,'reason','UNKNOWN_PURPOSE'); end if;
 if o.coupon_code is not null then
  select * into v_res from public.discount_coupon_reservations where order_id=o.order_id and user_id=o.user_id and state='reserved' for update;
  if not found then return jsonb_build_object('ok',false,'reason','COUPON_RESERVATION_MISSING'); end if;
 end if;
 update public.cashi_orders set status='SETTLED',provider_amount=p_amount,gateway_payload=coalesce(p_payload,'{}'::jsonb),settled_at=now(),updated_at=now() where order_id=p_order_id;
 if o.coupon_code is not null then
  update public.discount_coupons set uses_reserved=greatest(uses_reserved-1,0),uses_used=uses_used+1 where user_id=o.user_id and code=v_res.coupon_code;
  update public.discount_coupon_reservations set state='consumed' where order_id=o.order_id and state='reserved';
 end if;
 if o.purpose='vip' then
  select greatest(coalesce(vip_expires_at,now()),now()) into v_exp from public.profiles where id=o.user_id for update;
  update public.profiles set vip_expires_at=coalesce(v_exp,now())+make_interval(days=>v_days) where id=o.user_id;
 elsif o.purpose='review_download' then
  insert into public.review_entitlements(user_id,review_id,order_id) values(o.user_id,o.review_id,o.order_id) on conflict(user_id,review_id) do nothing;
 elsif o.purpose='vip_group' then
  insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url) values(o.user_id,o.vip_group_id,o.order_id,v_url) on conflict(user_id,group_id) do nothing;
 end if;
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;
