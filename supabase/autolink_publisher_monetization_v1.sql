-- AutoLink Publisher Monetization — additive migration
-- Run only after the existing ProjectVID/BoxCellink migrations, including
-- BoxCellink-affiliate-wallet-notifications-FIXED.sql and boxcellink_wallet_withdraw_v2.sql.
begin;
create extension if not exists pgcrypto;

create table if not exists public.autolinks (
 id uuid primary key default gen_random_uuid(),
 publisher_id uuid not null references auth.users(id) on delete cascade,
 short_code varchar(12) not null unique,
 target_url text not null,
 title varchar(140) not null,
 description varchar(1200) not null default '',
 status text not null default 'published' check(status in ('draft','published','paused','deleted')),
 total_visits bigint not null default 0 check(total_visits>=0),
 total_wif bigint not null default 0 check(total_wif>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint autolinks_target_url_check check(target_url ~* '^https?://')
);
create index if not exists autolinks_publisher_created_idx on public.autolinks(publisher_id,created_at desc);
create index if not exists autolinks_status_code_idx on public.autolinks(status,short_code);

create table if not exists public.publisher_balances (
 publisher_id uuid primary key references auth.users(id) on delete cascade,
 available_balance bigint not null default 0 check(available_balance>=0),
 pending_withdrawal bigint not null default 0 check(pending_withdrawal>=0),
 withdrawn_total bigint not null default 0 check(withdrawn_total>=0),
 free_earned_total bigint not null default 0,
 direct_access_earned_total bigint not null default 0,
 valid_wif bigint not null default 0,
 cpm numeric(5,2) not null default 50 check(cpm between 50 and 99),
 updated_at timestamptz not null default now()
);
create table if not exists public.publisher_transactions (
 id uuid primary key default gen_random_uuid(),
 publisher_id uuid not null references auth.users(id) on delete cascade,
 autolink_id uuid references public.autolinks(id) on delete set null,
 transaction_type text not null check(transaction_type in ('free_wif','direct_access','withdraw_reserve','withdraw_release','withdraw_paid','admin_adjustment')),
 amount bigint not null,
 reference_id text not null unique,
 description text not null default '',
 created_at timestamptz not null default now()
);
alter table public.publisher_transactions drop constraint if exists publisher_transactions_transaction_type_check;
alter table public.publisher_transactions add constraint publisher_transactions_transaction_type_check
 check(transaction_type in ('free_wif','direct_access','withdraw_reserve','withdraw_release','withdraw_paid','admin_adjustment','review_purchase'));
create index if not exists publisher_transactions_owner_date_idx on public.publisher_transactions(publisher_id,created_at desc);

create table if not exists public.autolink_visits (
 id uuid primary key default gen_random_uuid(),
 autolink_id uuid not null references public.autolinks(id) on delete cascade,
 visitor_hash text not null,
 visited_at timestamptz not null default now()
);
create index if not exists autolink_visits_link_date_idx on public.autolink_visits(autolink_id,visited_at desc);

create table if not exists public.autolink_sessions (
 id uuid primary key default gen_random_uuid(),
 autolink_id uuid not null references public.autolinks(id) on delete cascade,
 publisher_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique,
 progress_index smallint not null default 0 check(progress_index between 0 and 16),
 vip_bypass boolean not null default false,
 started_at timestamptz not null default now(),
 stage_started_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '2 hours',
 completed_at timestamptz,
 visitor_hash text not null,
 rate_key text not null
);
create index if not exists autolink_sessions_rate_idx on public.autolink_sessions(rate_key,started_at desc);
create index if not exists autolink_sessions_expiry_idx on public.autolink_sessions(expires_at);
create table if not exists public.autolink_tasks (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.autolink_sessions(id) on delete cascade,
 task_number smallint not null check(task_number between 1 and 3),
 stage_number smallint not null,
 completed_at timestamptz not null default now(),
 unique(session_id,task_number,stage_number)
);
create table if not exists public.autolink_redirects (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null unique references public.autolink_sessions(id) on delete restrict,
 autolink_id uuid not null references public.autolinks(id) on delete restrict,
 publisher_id uuid not null references auth.users(id) on delete restrict,
 visitor_hash text not null,
 visitor_day date not null default (now() at time zone 'Asia/Jakarta')::date,
 verified_at timestamptz not null default now(),
 destination_host text not null
);
create unique index if not exists autolink_redirects_unique_visitor_day on public.autolink_redirects(autolink_id,visitor_hash,visitor_day);
create index if not exists autolink_redirects_publisher_date_idx on public.autolink_redirects(publisher_id,verified_at desc);
create table if not exists public.autolink_payments (
 id uuid primary key default gen_random_uuid(),
 order_id text not null unique,
 autolink_id uuid not null references public.autolinks(id) on delete restrict,
 buyer_id uuid references auth.users(id) on delete set null,
 publisher_id uuid not null references auth.users(id) on delete restrict,
 target_url_snapshot text not null,
 title_snapshot text not null,
 amount bigint not null default 3500 check(amount=3500),
 publisher_amount bigint not null default 2000 check(publisher_amount=2000),
 platform_amount bigint not null default 1500 check(platform_amount=1500),
 status text not null default 'pending' check(status in ('pending','settled','failed')),
 created_at timestamptz not null default now(),
 settled_at timestamptz
);
create table if not exists public.publisher_daily_stats (
 publisher_id uuid not null references auth.users(id) on delete cascade,
 stat_date date not null,
 valid_wif bigint not null default 0,
 free_earned bigint not null default 0,
 direct_access_earned bigint not null default 0,
 primary key(publisher_id,stat_date)
);
create table if not exists public.publisher_cpm_history (
 id uuid primary key default gen_random_uuid(),
 publisher_id uuid not null references auth.users(id) on delete cascade,
 previous_cpm numeric(5,2) not null,
 current_cpm numeric(5,2) not null,
 valid_wif bigint not null,
 created_at timestamptz not null default now()
);
create table if not exists public.publisher_withdrawals (
 id uuid primary key default gen_random_uuid(),
 publisher_id uuid not null references auth.users(id) on delete cascade,
 amount bigint not null check(amount>=10000),
 payout_method text not null check(payout_method in ('bank','ewallet')),
 payout_provider text not null,
 account_holder text not null,
 account_number text not null,
 status text not null default 'pending' check(status in ('pending','processing','success','rejected')),
 admin_note text,
 processed_by uuid references auth.users(id),
 processed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists publisher_withdrawals_status_date_idx on public.publisher_withdrawals(status,created_at desc);
create table if not exists public.endorse_settings (
 id uuid primary key default gen_random_uuid(),
 slot text not null unique check(slot in ('go_top','go_middle','go_bottom','final_top','final_bottom')),
 content_type text not null default 'image' check(content_type in ('image','video','html')),
 media_url text,
 target_url text,
 embed_html text,
 active boolean not null default false,
 starts_at timestamptz,
 ends_at timestamptz,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.go_ad_settings (
 id uuid primary key default gen_random_uuid(),
 slot text not null unique,
 ad_type text not null check(ad_type in ('banner','video','social_bar','popunder','interstitial','slide_banner')),
 ad_code text not null default '',
 active boolean not null default false,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.autolink_platform_revenue (
 id uuid primary key default gen_random_uuid(),
 order_id text not null unique,
 amount bigint not null check(amount=1500),
 created_at timestamptz not null default now()
);

alter table public.boxcellink_notifications add column if not exists expires_at timestamptz;
alter table public.cashi_orders add column if not exists autolink_id uuid references public.autolinks(id) on delete set null;

alter table public.cashi_orders drop constraint if exists cashi_orders_purpose_check;
alter table public.cashi_orders add constraint cashi_orders_purpose_check
 check(purpose in ('vip','review_download','vip_group','wallet_topup','autolink_direct_access'));

alter table public.cashi_orders drop constraint if exists order_target_check;
alter table public.cashi_orders add constraint order_target_check check (
 (purpose='vip' and plan_id is not null and review_id is null and vip_group_id is null and autolink_id is null) or
 (purpose='review_download' and plan_id is null and vip_group_id is null and autolink_id is null and (review_id is not null or status <> 'PENDING')) or
 (purpose='vip_group' and vip_group_id is not null and plan_id is null and review_id is null and autolink_id is null) or
 (purpose='wallet_topup' and plan_id is null and review_id is null and vip_group_id is null and autolink_id is null) or
 (purpose='autolink_direct_access' and autolink_id is not null and plan_id is null and review_id is null and vip_group_id is null)
);

grant all on public.autolinks,public.publisher_balances,public.publisher_transactions,public.autolink_visits,public.autolink_sessions,public.autolink_tasks,public.autolink_redirects,public.autolink_payments,public.publisher_daily_stats,public.publisher_cpm_history,public.publisher_withdrawals,public.endorse_settings,public.go_ad_settings,public.autolink_platform_revenue to service_role;

alter table public.autolinks enable row level security;
alter table public.publisher_balances enable row level security;
alter table public.publisher_transactions enable row level security;
alter table public.autolink_visits enable row level security;
alter table public.autolink_sessions enable row level security;
alter table public.autolink_tasks enable row level security;
alter table public.autolink_redirects enable row level security;
alter table public.autolink_payments enable row level security;
alter table public.publisher_daily_stats enable row level security;
alter table public.publisher_cpm_history enable row level security;
alter table public.publisher_withdrawals enable row level security;
alter table public.endorse_settings enable row level security;
alter table public.go_ad_settings enable row level security;
alter table public.autolink_platform_revenue enable row level security;

drop policy if exists autolinks_public_read on public.autolinks;
create policy autolinks_public_read on public.autolinks for select using(status='published' or publisher_id=auth.uid() or public.is_admin());
drop policy if exists autolinks_owner_insert on public.autolinks;
create policy autolinks_owner_insert on public.autolinks for insert to authenticated with check(publisher_id=auth.uid());
drop policy if exists autolinks_owner_update on public.autolinks;
create policy autolinks_owner_update on public.autolinks for update to authenticated using(publisher_id=auth.uid() or public.is_admin()) with check(publisher_id=auth.uid() or public.is_admin());
drop policy if exists autolinks_owner_delete on public.autolinks;
create policy autolinks_owner_delete on public.autolinks for delete to authenticated using(publisher_id=auth.uid() or public.is_admin());
drop policy if exists publisher_balances_read_own on public.publisher_balances;
create policy publisher_balances_read_own on public.publisher_balances for select to authenticated using(publisher_id=auth.uid() or public.is_admin());
drop policy if exists publisher_transactions_read_own on public.publisher_transactions;
create policy publisher_transactions_read_own on public.publisher_transactions for select to authenticated using(publisher_id=auth.uid() or public.is_admin());
drop policy if exists publisher_withdrawals_read_own on public.publisher_withdrawals;
create policy publisher_withdrawals_read_own on public.publisher_withdrawals for select to authenticated using(publisher_id=auth.uid() or public.is_admin());
drop policy if exists publisher_withdrawals_admin_update on public.publisher_withdrawals;
create policy publisher_withdrawals_admin_update on public.publisher_withdrawals for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists endorse_settings_public_read on public.endorse_settings;
create policy endorse_settings_public_read on public.endorse_settings for select using(active=true or public.is_admin());
drop policy if exists endorse_settings_admin_all on public.endorse_settings;
create policy endorse_settings_admin_all on public.endorse_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists go_ad_settings_admin_all on public.go_ad_settings;
create policy go_ad_settings_admin_all on public.go_ad_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());

grant select on public.publisher_balances,public.publisher_transactions,public.publisher_withdrawals,public.endorse_settings to authenticated;
revoke all on public.autolinks from anon,authenticated;
create or replace view public.autolink_public with (security_barrier=true) as
 select id,publisher_id,short_code,title,description,status,total_visits,total_wif,created_at,updated_at
 from public.autolinks
 where status='published' or publisher_id=auth.uid() or public.is_admin();
grant select on public.autolink_public to anon,authenticated;
grant select on public.publisher_daily_stats,public.publisher_cpm_history to authenticated;
grant select,insert,update on public.publisher_withdrawals to authenticated;
grant select,insert,update,delete on public.endorse_settings,public.go_ad_settings to authenticated;
revoke all on public.publisher_transactions,public.publisher_balances,public.autolink_sessions,public.autolink_tasks,public.autolink_redirects,public.autolink_visits,public.autolink_payments,public.autolink_platform_revenue from anon,authenticated;


drop policy if exists publisher_daily_stats_read_own on public.publisher_daily_stats;
create policy publisher_daily_stats_read_own on public.publisher_daily_stats for select to authenticated using(publisher_id=auth.uid() or public.is_admin());
drop policy if exists publisher_cpm_history_read_own on public.publisher_cpm_history;
create policy publisher_cpm_history_read_own on public.publisher_cpm_history for select to authenticated using(publisher_id=auth.uid() or public.is_admin());
revoke all on public.autolink_payments from anon,authenticated;


drop policy if exists go_ad_settings_public_read on public.go_ad_settings;
create policy go_ad_settings_public_read on public.go_ad_settings for select using(active=true or public.is_admin());
grant select on public.go_ad_settings to anon,authenticated;
do $$ begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('autolink-endorse','autolink-endorse',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
  on conflict(id) do nothing;
 end if;
end $$;
drop policy if exists autolink_endorse_public_read on storage.objects;
create policy autolink_endorse_public_read on storage.objects for select using(bucket_id='autolink-endorse');
drop policy if exists autolink_endorse_admin_write on storage.objects;
create policy autolink_endorse_admin_write on storage.objects for insert to authenticated with check(bucket_id='autolink-endorse' and public.is_admin());
drop policy if exists autolink_endorse_admin_update on storage.objects;
create policy autolink_endorse_admin_update on storage.objects for update to authenticated using(bucket_id='autolink-endorse' and public.is_admin()) with check(bucket_id='autolink-endorse' and public.is_admin());
drop policy if exists autolink_endorse_admin_delete on storage.objects;
create policy autolink_endorse_admin_delete on storage.objects for delete to authenticated using(bucket_id='autolink-endorse' and public.is_admin());

create or replace function public.autolink_cpm(p_wif bigint)
returns numeric language sql immutable as $$
 select case when greatest(coalesce(p_wif,0),0)>=1000 then 99::numeric
 when greatest(coalesce(p_wif,0),0)<=0 then 50::numeric
 when p_wif<=500 then round(50 + (p_wif::numeric/500)*30,2)
 else round(80 + ((p_wif-500)::numeric/500)*19,2) end
$$;

create or replace function public.record_autolink_ready_redirect(p_session_id uuid,p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.autolink_sessions%rowtype; a public.autolinks%rowtype;
 v_old_cpm numeric(5,2); v_new_cpm numeric(5,2); v_old_wif bigint; v_new_wif bigint;
 v_old_earned bigint; v_new_earned bigint; v_delta bigint; v_host text;
begin
 select * into s from public.autolink_sessions where id=p_session_id for update;
 if not found or s.token_hash<>p_token_hash or s.expires_at<now() then return jsonb_build_object('ok',false,'reason','SESSION_INVALID'); end if;
 if s.progress_index<16 then return jsonb_build_object('ok',false,'reason','TASKS_INCOMPLETE'); end if;
 if exists(select 1 from public.autolink_redirects where session_id=s.id) then return jsonb_build_object('ok',false,'reason','ALREADY_COUNTED'); end if;
 if exists(select 1 from public.autolink_redirects where autolink_id=s.autolink_id and visitor_hash=s.visitor_hash and visitor_day=(now() at time zone 'Asia/Jakarta')::date) then return jsonb_build_object('ok',false,'reason','VISITOR_ALREADY_COUNTED_TODAY'); end if;
 select * into a from public.autolinks where id=s.autolink_id and status='published' for update;
 if not found then return jsonb_build_object('ok',false,'reason','AUTOLINK_UNAVAILABLE'); end if;
 v_host:=lower(regexp_replace(a.target_url,'^https?://([^/]+).*$','\1','i'));
 insert into public.autolink_redirects(session_id,autolink_id,publisher_id,visitor_hash,destination_host)
 values(s.id,a.id,a.publisher_id,s.visitor_hash,v_host);
 insert into public.publisher_balances(publisher_id) values(a.publisher_id) on conflict do nothing;
 select valid_wif,cpm into v_old_wif,v_old_cpm from public.publisher_balances where publisher_id=a.publisher_id for update;
 v_new_wif:=v_old_wif+1; v_new_cpm:=public.autolink_cpm(v_new_wif);
 -- Cumulative repricing: at each CPM tier, the publisher's entire valid-WIF
 -- total is valued at the current rate. Integer arithmetic preserves every rupiah.
 v_old_earned:=floor(v_old_wif::numeric*120*v_old_cpm/99);
 v_new_earned:=floor(v_new_wif::numeric*120*v_new_cpm/99);
 v_delta:=greatest(0,v_new_earned-v_old_earned);
 update public.publisher_balances set valid_wif=v_new_wif,cpm=v_new_cpm,
   available_balance=available_balance+v_delta,free_earned_total=free_earned_total+v_delta,updated_at=now()
 where publisher_id=a.publisher_id;
 update public.autolinks set total_wif=total_wif+1,updated_at=now() where id=a.id;
 insert into public.publisher_transactions(publisher_id,autolink_id,transaction_type,amount,reference_id,description)
 values(a.publisher_id,a.id,'free_wif',v_delta,'WIF:'||s.id::text,'Ready Redirect valid · '||a.title);
 insert into public.publisher_daily_stats(publisher_id,stat_date,valid_wif,free_earned)
 values(a.publisher_id,(now() at time zone 'Asia/Jakarta')::date,1,v_delta)
 on conflict(publisher_id,stat_date) do update set valid_wif=publisher_daily_stats.valid_wif+1,free_earned=publisher_daily_stats.free_earned+excluded.free_earned;
 if floor(v_new_cpm/10)>floor(v_old_cpm/10) or (v_new_cpm=99 and v_old_cpm<99) then
  insert into public.publisher_cpm_history(publisher_id,previous_cpm,current_cpm,valid_wif)
  values(a.publisher_id,v_old_cpm,v_new_cpm,v_new_wif);
  insert into public.boxcellink_notifications(user_id,title,body,kind,href,expires_at)
  values(a.publisher_id,'CPM AutoLink Meningkat!','CPM sebelumnya: '||v_old_cpm||'%. CPM sekarang: '||v_new_cpm||'%. Terus bagikan AutoLink kamu untuk mendapatkan CPM lebih tinggi!','autolink_cpm','/dashboard.html',now()+interval '30 minutes')
  ;
 end if;
 update public.autolink_sessions set completed_at=now() where id=s.id;
 return jsonb_build_object('ok',true,'redirect_id',(select id from public.autolink_redirects where session_id=s.id),'publisher_amount',v_delta,'total_wif',v_new_wif,'cpm',v_new_cpm,'destination',a.target_url);
end $$;
revoke all on function public.record_autolink_ready_redirect(uuid,text) from public,anon,authenticated;
grant execute on function public.record_autolink_ready_redirect(uuid,text) to service_role;

create or replace function public.settle_autolink_direct_access(p_order_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.autolink_payments%rowtype; a public.autolinks%rowtype;
begin
 select * into p from public.autolink_payments where order_id=p_order_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','PAYMENT_NOT_FOUND'); end if;
 if p.status='settled' then return jsonb_build_object('ok',true,'duplicate',true); end if;
 select * into a from public.autolinks where id=p.autolink_id;
 if not found then return jsonb_build_object('ok',false,'reason','AUTOLINK_UNAVAILABLE'); end if;
 insert into public.publisher_balances(publisher_id) values(p.publisher_id) on conflict do nothing;
 update public.publisher_balances set available_balance=available_balance+2000,
  direct_access_earned_total=direct_access_earned_total+2000,updated_at=now()
 where publisher_id=p.publisher_id;
 insert into public.publisher_transactions(publisher_id,autolink_id,transaction_type,amount,reference_id,description)
 values(p.publisher_id,p.autolink_id,'direct_access',2000,'DIRECT:'||p.order_id,'Langsung Akses · '||a.title);
 insert into public.boxcellink_notifications(user_id,title,body,kind,href) values(p.publisher_id,'Pembayaran AutoLink berhasil!','Saldo publisher bertambah +Rp2.000 dari AutoLink: '||a.title,'autolink_payment','/publisher-dashboard.html');
 insert into public.autolink_platform_revenue(order_id,amount) values(p.order_id,1500) on conflict do nothing;
 insert into public.publisher_daily_stats(publisher_id,stat_date,direct_access_earned)
 values(p.publisher_id,(now() at time zone 'Asia/Jakarta')::date,2000)
 on conflict(publisher_id,stat_date) do update set direct_access_earned=publisher_daily_stats.direct_access_earned+2000;
 update public.autolink_payments set status='settled',settled_at=now() where order_id=p_order_id;
 return jsonb_build_object('ok',true,'publisher_amount',2000,'platform_amount',1500,'title',a.title);
end $$;
revoke all on function public.settle_autolink_direct_access(text) from public,anon,authenticated;
grant execute on function public.settle_autolink_direct_access(text) to service_role;


create or replace function public.settle_cashi_order(
 p_order_id text,p_amount bigint,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.cashi_orders%rowtype; v_exp timestamptz; v_days integer; v_url text; v_direct jsonb;
 v_res public.discount_coupon_reservations%rowtype; v_admin_res public.admin_discount_reservations%rowtype;
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
 elsif o.purpose='wallet_topup' then null;
 elsif o.purpose='vip_group' then
  select coalesce(nullif(btrim(o.vip_group_invite_url),''),s.telegram_url) into v_url from public.vip_groups g left join public.vip_group_secrets s on s.group_id=g.id where g.id=o.vip_group_id and g.status='published';
  if v_url is null then return jsonb_build_object('ok',false,'reason','GROUP_INVITE_NOT_CONFIGURED'); end if;
 elsif o.purpose='autolink_direct_access' then
  if not exists(select 1 from public.autolink_payments where order_id=o.order_id and status='pending') then return jsonb_build_object('ok',false,'reason','AUTOLINK_PAYMENT_NOT_FOUND'); end if;
 else return jsonb_build_object('ok',false,'reason','UNKNOWN_PURPOSE'); end if;
 if o.coupon_code is not null then
  select * into v_res from public.discount_coupon_reservations where order_id=o.order_id and user_id=o.user_id and state='reserved' for update;
  if not found then select * into v_admin_res from public.admin_discount_reservations where order_id=o.order_id and user_id=o.user_id and state='reserved' for update;
   if not found then return jsonb_build_object('ok',false,'reason','COUPON_RESERVATION_MISSING'); end if;
  end if;
 end if;
 update public.cashi_orders set status='SETTLED',provider_amount=p_amount,gateway_payload=coalesce(p_payload,'{}'::jsonb),settled_at=now(),updated_at=now() where order_id=p_order_id;
 if o.coupon_code is not null then
  if v_res.order_id is not null then
   update public.discount_coupons set uses_reserved=greatest(uses_reserved-1,0),uses_used=uses_used+1 where user_id=o.user_id and code=v_res.coupon_code;
   update public.discount_coupon_reservations set state='consumed' where order_id=o.order_id and state='reserved';
  else
   update public.admin_discount_claims set used_at=now(),used_for=o.order_id where id=v_admin_res.claim_id and user_id=o.user_id and used_at is null;
   update public.admin_discount_reservations set state='consumed' where order_id=o.order_id and state='reserved';
  end if;
 end if;
 if o.purpose='vip' then
  select vip_expires_at into v_exp from public.profiles where id=o.user_id for update;
  perform set_config('boxcellink.internal_write','on',true);
  update public.profiles set vip_started_at=case when v_exp is null or v_exp<=now() then now() else coalesce(vip_started_at,now()) end,
   vip_expires_at=greatest(coalesce(v_exp,now()),now())+make_interval(days=>v_days),
   membership_tier=case when affiliate_status='approved' then 'affiliate' else 'vip' end where id=o.user_id;
 elsif o.purpose='review_download' then
  insert into public.review_entitlements(user_id,review_id,order_id) values(o.user_id,o.review_id,o.order_id) on conflict(user_id,review_id) do nothing;
 elsif o.purpose='wallet_topup' then
  perform set_config('boxcellink.internal_write','on',true);
  update public.profiles set deposit_balance=deposit_balance+o.amount where id=o.user_id;
  insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description) values(o.user_id,'deposit',o.amount,'topup',o.order_id,'Deposit saldo melalui Cashi');
 elsif o.purpose='vip_group' then
  insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url) values(o.user_id,o.vip_group_id,o.order_id,v_url) on conflict(user_id,group_id) do nothing;
 elsif o.purpose='autolink_direct_access' then
  v_direct:=public.settle_autolink_direct_access(o.order_id);
  if coalesce((v_direct->>'ok')::boolean,false)=false then raise exception 'AUTOLINK_SETTLEMENT_FAILED:%',coalesce(v_direct->>'reason','UNKNOWN'); end if;
 end if;
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;


create or replace function public.buy_review_with_publisher_balance(p_review_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); r public.review_items%rowtype; ref text;
begin
 if u is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select * into r from public.review_items where id=p_review_id and status='published' and access='paid' for update;
 if not found then return jsonb_build_object('ok',false,'reason','REVIEW_UNAVAILABLE'); end if;
 if exists(select 1 from public.review_entitlements where user_id=u and review_id=p_review_id) then return jsonb_build_object('ok',false,'reason','ALREADY_OWNED'); end if;
 insert into public.publisher_balances(publisher_id) values(u) on conflict do nothing;
 update public.publisher_balances set available_balance=available_balance-r.price,updated_at=now()
 where publisher_id=u and available_balance>=r.price and r.price>0;
 if not found then return jsonb_build_object('ok',false,'reason','INSUFFICIENT_PUBLISHER_BALANCE'); end if;
 insert into public.review_entitlements(user_id,review_id,order_id) values(u,p_review_id,null);
 ref:='PUBREVIEW:'||gen_random_uuid()::text;
 insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description)
 values(u,'review_purchase',-r.price,ref,'Pembelian Review Media: '||r.title);
 return jsonb_build_object('ok',true,'review_id',p_review_id,'amount',r.price);
end $$;
revoke all on function public.buy_review_with_publisher_balance(uuid) from public,anon;
grant execute on function public.buy_review_with_publisher_balance(uuid) to authenticated;

create or replace function public.request_publisher_withdrawal(p_amount bigint,p_method text,p_provider text,p_holder text,p_account text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); wid uuid;
begin
 if u is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 if p_amount<10000 or p_method not in ('bank','ewallet') or length(trim(coalesce(p_provider,'')))<2 or length(trim(coalesce(p_holder,'')))<2 or length(trim(coalesce(p_account,'')))<5 then
  return jsonb_build_object('ok',false,'reason','INVALID_DATA');
 end if;
 insert into public.publisher_balances(publisher_id) values(u) on conflict do nothing;
 update public.publisher_balances set available_balance=available_balance-p_amount,pending_withdrawal=pending_withdrawal+p_amount,updated_at=now()
 where publisher_id=u and available_balance>=p_amount;
 if not found then return jsonb_build_object('ok',false,'reason','INSUFFICIENT_BALANCE'); end if;
 insert into public.publisher_withdrawals(publisher_id,amount,payout_method,payout_provider,account_holder,account_number)
 values(u,p_amount,p_method,trim(p_provider),trim(p_holder),trim(p_account)) returning id into wid;
 insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description)
 values(u,'withdraw_reserve',-p_amount,'WITHDRAW:'||wid::text,'Saldo ditahan untuk permintaan withdraw');
 return jsonb_build_object('ok',true,'withdrawal_id',wid);
end $$;
revoke all on function public.request_publisher_withdrawal(bigint,text,text,text,text) from public,anon;
grant execute on function public.request_publisher_withdrawal(bigint,text,text,text,text) to authenticated;

create or replace function public.admin_update_publisher_withdrawal(p_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.publisher_withdrawals%rowtype;
begin
 if not public.is_admin() then return jsonb_build_object('ok',false,'reason','ADMIN_REQUIRED'); end if;
 select * into w from public.publisher_withdrawals where id=p_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','NOT_FOUND'); end if;
 if w.status in ('success','rejected') then return jsonb_build_object('ok',false,'reason','ALREADY_FINAL'); end if;
 if p_status not in ('processing','success','rejected') then return jsonb_build_object('ok',false,'reason','STATUS_INVALID'); end if;
 update public.publisher_withdrawals set status=p_status,admin_note=left(coalesce(p_note,''),1000),processed_by=auth.uid(),processed_at=case when p_status in ('success','rejected') then now() else processed_at end where id=p_id;
 if p_status in ('success','rejected') then
  if p_status='success' then
   update public.publisher_balances set pending_withdrawal=pending_withdrawal-w.amount,withdrawn_total=withdrawn_total+w.amount,updated_at=now() where publisher_id=w.publisher_id;
   insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description) values(w.publisher_id,'withdraw_paid',-w.amount,'WITHDRAWPAID:'||w.id::text,'Withdraw berhasil dibayar');
  else
   update public.publisher_balances set pending_withdrawal=pending_withdrawal-w.amount,available_balance=available_balance+w.amount,updated_at=now() where publisher_id=w.publisher_id;
   insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description) values(w.publisher_id,'withdraw_release',w.amount,'WITHDRAWRELEASE:'||w.id::text,'Withdraw ditolak; saldo dikembalikan');
  end if;
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_update_publisher_withdrawal(uuid,text,text) from public,anon;
grant execute on function public.admin_update_publisher_withdrawal(uuid,text,text) to authenticated;


create or replace function public.record_autolink_visit(p_autolink_id uuid,p_visitor_hash text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.autolinks where id=p_autolink_id and status='published') then return; end if;
 insert into public.autolink_visits(autolink_id,visitor_hash) values(p_autolink_id,left(p_visitor_hash,128));
 update public.autolinks set total_visits=total_visits+1 where id=p_autolink_id;
end $$;
revoke all on function public.record_autolink_visit(uuid,text) from public,anon,authenticated;
grant execute on function public.record_autolink_visit(uuid,text) to service_role;

-- Service-role-only helpers; no client may write balances or event ledgers directly.
grant usage on schema public to service_role;
commit;
