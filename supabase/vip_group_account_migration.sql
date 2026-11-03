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
