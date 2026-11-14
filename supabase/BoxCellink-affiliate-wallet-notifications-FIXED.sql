-- BoxCellink wallet, affiliate, notifications and 2-hour discount claims.
-- FIXED VERSION: preserves deleted-review order history, protects balances,
-- fixes profile privilege-trigger conflicts, and hardens notification writes.
-- Run once AFTER all prerequisite ProjectVID migrations.
begin;
-- Run AFTER the existing ProjectVID migrations, especially admin_features.sql,
-- admin_discount_claim_flow.sql and referral_vip_migration.sql.
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists membership_tier text not null default 'basic',
  add column if not exists affiliate_status text not null default 'none',
  add column if not exists deposit_balance bigint not null default 0,
  add column if not exists affiliate_balance bigint not null default 0,
  add column if not exists payout_full_name text,
  add column if not exists payout_address text,
  add column if not exists payout_method text,
  add column if not exists payout_account_number text,
  add column if not exists payout_social jsonb not null default '{}'::jsonb;

alter table public.profiles drop constraint if exists profiles_membership_tier_check;

-- Normalize legacy or partially populated tier values before enforcing the check.
update public.profiles
set membership_tier = case
  when affiliate_status = 'approved' then 'affiliate'
  when vip_expires_at is not null and vip_expires_at > now() then 'vip'
  else 'basic'
end;

alter table public.profiles
  alter column membership_tier set default 'basic',
  alter column membership_tier set not null;

alter table public.profiles add constraint profiles_membership_tier_check
  check (membership_tier in ('basic','vip','affiliate'));
alter table public.profiles drop constraint if exists profiles_affiliate_status_check;
alter table public.profiles add constraint profiles_affiliate_status_check
  check (affiliate_status in ('none','pending','approved','rejected'));

create table if not exists public.affiliate_applications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 full_name text not null,
 full_address text not null,
 payout_method text not null check(payout_method in ('bank','ewallet')),
 payout_account_number text not null,
 social_links jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 admin_note text,
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists affiliate_applications_status_created_idx
 on public.affiliate_applications(status,created_at desc);

create table if not exists public.wallet_ledger(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 wallet_type text not null check(wallet_type in ('deposit','affiliate')),
 amount bigint not null check(amount<>0),
 entry_type text not null,
 reference_id text,
 description text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_user_created_idx on public.wallet_ledger(user_id,created_at desc);

create table if not exists public.affiliate_withdrawals(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 amount bigint not null check(amount>=10000),
 payout_method text not null,
 payout_account_number text not null,
 payout_full_name text not null,
 status text not null default 'pending' check(status in ('pending','processing','rejected','success')),
 admin_note text,
 processed_by uuid references auth.users(id),
 processed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists affiliate_withdrawals_status_created_idx
 on public.affiliate_withdrawals(status,created_at desc);

create table if not exists public.boxcellink_notifications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete cascade,
 title text not null,
 body text not null,
 kind text not null default 'system',
 href text,
 is_read boolean not null default false,
 source_id uuid,
 is_admin_managed boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.boxcellink_notifications add column if not exists source_id uuid;
alter table public.boxcellink_notifications add column if not exists is_admin_managed boolean not null default false;
create unique index if not exists boxcellink_notifications_announcement_uidx on public.boxcellink_notifications(source_id,user_id) where is_admin_managed and source_id is not null;
create index if not exists boxcellink_notifications_user_created_idx
 on public.boxcellink_notifications(user_id,created_at desc);

alter table public.affiliate_applications enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.affiliate_withdrawals enable row level security;
alter table public.boxcellink_notifications enable row level security;

drop policy if exists "affiliate application own read" on public.affiliate_applications;
create policy "affiliate application own read" on public.affiliate_applications
 for select to authenticated using(auth.uid()=user_id or public.is_admin());
drop policy if exists "affiliate application admin all" on public.affiliate_applications;
create policy "affiliate application admin all" on public.affiliate_applications
 for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "wallet ledger own read" on public.wallet_ledger;
create policy "wallet ledger own read" on public.wallet_ledger
 for select to authenticated using(auth.uid()=user_id or public.is_admin());
drop policy if exists "withdrawals own read" on public.affiliate_withdrawals;
create policy "withdrawals own read" on public.affiliate_withdrawals
 for select to authenticated using(auth.uid()=user_id or public.is_admin());
drop policy if exists "withdrawals admin update" on public.affiliate_withdrawals;
create policy "withdrawals admin update" on public.affiliate_withdrawals
 for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "notifications read own or broadcast" on public.boxcellink_notifications;
create policy "notifications read own or broadcast" on public.boxcellink_notifications
 for select to authenticated using(user_id=auth.uid() or user_id is null or public.is_admin());
drop policy if exists "notifications update own" on public.boxcellink_notifications;
create policy "notifications update own" on public.boxcellink_notifications
 for update to authenticated
 using(user_id=auth.uid() and user_id is not null)
 with check(user_id=auth.uid() and user_id is not null);
drop policy if exists "notifications delete own or admin" on public.boxcellink_notifications;
create policy "notifications delete own or admin" on public.boxcellink_notifications
 for delete to authenticated using((user_id=auth.uid() and user_id is not null) or public.is_admin());
drop policy if exists "notifications admin insert" on public.boxcellink_notifications;
create policy "notifications admin insert" on public.boxcellink_notifications
 for insert to authenticated with check(public.is_admin());

grant select on public.affiliate_applications,public.wallet_ledger,public.affiliate_withdrawals,public.boxcellink_notifications to authenticated;
revoke update on public.boxcellink_notifications from authenticated;
grant update(is_read) on public.boxcellink_notifications to authenticated;
grant delete on public.boxcellink_notifications to authenticated;
grant insert,update,delete on public.affiliate_applications to authenticated;
grant update on public.affiliate_withdrawals to authenticated;
grant insert on public.boxcellink_notifications to authenticated;

create or replace function public.apply_for_affiliate(
 p_full_name text,p_address text,p_payout_method text,p_payout_account_number text,p_social jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 if length(trim(coalesce(p_full_name,'')))<3
   or length(trim(coalesce(p_address,'')))<8
   or length(trim(coalesce(p_payout_account_number,'')))<5
   or coalesce(p_payout_method,'') not in ('bank','ewallet')
   or (p_social is not null and jsonb_typeof(p_social) <> 'object') then
  return jsonb_build_object('ok',false,'reason','DATA_INVALID');
 end if;

 if exists(select 1 from public.profiles
           where id=auth.uid() and affiliate_status='approved') then
  return jsonb_build_object('ok',false,'reason','ALREADY_AFFILIATE');
 end if;

 if exists(select 1 from public.affiliate_applications
           where user_id=auth.uid() and status='pending') then
  return jsonb_build_object('ok',false,'reason','APPLICATION_PENDING');
 end if;

 perform set_config('boxcellink.internal_write','on',true);
 insert into public.affiliate_applications(user_id,full_name,full_address,payout_method,payout_account_number,social_links)
 values(auth.uid(),trim(p_full_name),trim(p_address),p_payout_method,trim(p_payout_account_number),coalesce(p_social,'{}'::jsonb))
 returning id into v_id;
 update public.profiles set affiliate_status='pending',payout_full_name=trim(p_full_name),
  payout_address=trim(p_address),payout_method=p_payout_method,payout_account_number=trim(p_payout_account_number),
  payout_social=coalesce(p_social,'{}'::jsonb) where id=auth.uid();
 return jsonb_build_object('ok',true,'application_id',v_id);
end $$;
revoke all on function public.apply_for_affiliate(text,text,text,text,jsonb) from public,anon;
grant execute on function public.apply_for_affiliate(text,text,text,text,jsonb) to authenticated;

create or replace function public.admin_review_affiliate(p_application_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.affiliate_applications%rowtype;
begin
 if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
 if p_status not in ('approved','rejected') then raise exception 'STATUS_INVALID'; end if;
 select * into a from public.affiliate_applications where id=p_application_id for update;
 if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
 if a.status <> 'pending' then raise exception 'APPLICATION_ALREADY_REVIEWED'; end if;
 update public.affiliate_applications set status=p_status,admin_note=nullif(trim(coalesce(p_note,'')),''),reviewed_at=now() where id=p_application_id;
 update public.profiles set affiliate_status=p_status,membership_tier=case when p_status='approved' then 'affiliate' else 'basic' end where id=a.user_id;
 insert into public.boxcellink_notifications(user_id,title,body,kind)
 values(a.user_id,case when p_status='approved' then 'Pengajuan afiliasi disetujui' else 'Pengajuan afiliasi ditolak' end,
  case when p_status='approved' then 'Selamat! Fitur afiliasi sudah aktif.' else 'Pengajuan afiliasi ditolak. Alasan: '||coalesce(nullif(trim(p_note),''),'Silakan periksa data dan ajukan kembali.') end,'affiliate');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_review_affiliate(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_review_affiliate(uuid,text,text) to authenticated;

create or replace function public.request_affiliate_withdrawal(p_amount bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; v_id uuid;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select * into p from public.profiles where id=auth.uid() for update;
 if p.affiliate_status<>'approved' then return jsonb_build_object('ok',false,'reason','AFFILIATE_NOT_APPROVED'); end if;
 if p_amount is null or p_amount<10000 or p_amount>p.affiliate_balance then
  return jsonb_build_object('ok',false,'reason','BALANCE_OR_MINIMUM_INVALID');
 end if;
 if nullif(btrim(p.payout_full_name),'') is null
    or nullif(btrim(p.payout_account_number),'') is null
    or coalesce(p.payout_method,'') not in ('bank','ewallet') then
  return jsonb_build_object('ok',false,'reason','PAYOUT_PROFILE_MISSING');
 end if;
 perform set_config('boxcellink.internal_write','on',true);
 update public.profiles set affiliate_balance=affiliate_balance-p_amount where id=auth.uid();
 insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,description)
 values(auth.uid(),'affiliate',-p_amount,'withdraw_reserve','Saldo ditahan untuk permintaan withdraw');
 insert into public.affiliate_withdrawals(user_id,amount,payout_method,payout_account_number,payout_full_name)
 values(auth.uid(),p_amount,p.payout_method,p.payout_account_number,p.payout_full_name) returning id into v_id;
 return jsonb_build_object('ok',true,'withdrawal_id',v_id);
end $$;
revoke all on function public.request_affiliate_withdrawal(bigint) from public,anon;
grant execute on function public.request_affiliate_withdrawal(bigint) to authenticated;

create or replace function public.admin_process_affiliate_withdrawal(p_withdrawal_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.affiliate_withdrawals%rowtype;
begin
 if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
 if p_status not in ('processing','rejected','success') then raise exception 'STATUS_INVALID'; end if;
 select * into w from public.affiliate_withdrawals where id=p_withdrawal_id for update;
 if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
 if w.status in ('rejected','success') then raise exception 'WITHDRAWAL_ALREADY_FINAL'; end if;
 if p_status='rejected' then
  perform set_config('boxcellink.internal_write','on',true);
  update public.profiles set affiliate_balance=affiliate_balance+w.amount where id=w.user_id;
  insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
   values(w.user_id,'affiliate',w.amount,'withdraw_refund',w.id::text,'Pengembalian saldo karena withdraw ditolak');
 end if;
 update public.affiliate_withdrawals set status=p_status,admin_note=nullif(trim(coalesce(p_note,'')),''),processed_by=auth.uid(),processed_at=now() where id=w.id;
 insert into public.boxcellink_notifications(user_id,title,body,kind)
 values(w.user_id,case p_status when 'processing' then 'Withdraw sedang diproses' when 'rejected' then 'Withdraw ditolak' else 'Withdraw berhasil' end,
  case p_status when 'processing' then 'Permintaan withdraw sedang diproses admin.' when 'rejected' then 'Withdraw ditolak. Alasan: '||coalesce(nullif(trim(p_note),''),'Data pembayaran perlu diperbaiki.') else 'Withdraw telah ditandai berhasil oleh admin.' end,'withdrawal');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_process_affiliate_withdrawal(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_process_affiliate_withdrawal(uuid,text,text) to authenticated;

-- Affiliate attribution must be set only by the trusted create-payment Edge Function.
-- Never accept affiliate_referrer_id directly from an untrusted browser request.
alter table public.cashi_orders add column if not exists affiliate_referrer_id uuid references auth.users(id) on delete set null;
alter table public.cashi_orders add column if not exists affiliate_commission bigint not null default 0;

create or replace function public.credit_affiliate_commission()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_commission bigint;
begin
 if old.status is distinct from new.status and new.status='SETTLED'
   and new.purpose in ('vip','vip_group','review_download')
   and new.affiliate_referrer_id is not null and new.affiliate_referrer_id<>new.user_id
   and new.affiliate_commission=0 then
  -- 5% commission: Rp500 on a Rp10,000 paid order.
  v_commission:=floor(new.amount*0.05)::bigint;
  if v_commission>0 then
   perform set_config('boxcellink.internal_write','on',true);
   update public.profiles set affiliate_balance=affiliate_balance+v_commission where id=new.affiliate_referrer_id and affiliate_status='approved';
   if found then
    update public.cashi_orders set affiliate_commission=v_commission where id=new.id;
    insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
     values(new.affiliate_referrer_id,'affiliate',v_commission,'sale_commission',new.order_id,'Komisi afiliasi dari transaksi BoxCellink');
    insert into public.boxcellink_notifications(user_id,title,body,kind,href)
     values(new.affiliate_referrer_id,'Link terjual — komisi masuk','Transaksi berhasil. Komisi Rp'||to_char(v_commission,'FM999G999G999G990')||' telah ditambahkan ke saldo afiliasi.','affiliate','/account.html');
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists cashi_affiliate_commission on public.cashi_orders;
create trigger cashi_affiliate_commission after update of status on public.cashi_orders
for each row execute function public.credit_affiliate_commission();

-- Add two-hour expiry to admin promo claims. Expiry starts when a member claims the code.
alter table public.admin_discount_claims add column if not exists expires_at timestamptz;
update public.admin_discount_claims set expires_at=claimed_at+interval '2 hours' where expires_at is null and used_at is null;
create or replace function public.cleanup_expired_admin_discount_claims()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 delete from public.admin_discount_claims cl where cl.expires_at is not null and cl.expires_at<=now() and not exists(select 1 from public.admin_discount_reservations r where r.claim_id=cl.id and r.state='reserved');
 get diagnostics n=row_count;
 update public.admin_discount_codes c set claimed_count=(select count(*) from public.admin_discount_claims cl where cl.code_id=c.id) where c.id is not null;
 return n;
end $$;
revoke all on function public.cleanup_expired_admin_discount_claims() from public,anon,authenticated;

create or replace function public.claim_admin_discount(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.admin_discount_codes%rowtype; v_id uuid;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 perform public.cleanup_expired_admin_discount_claims();
 select * into c from public.admin_discount_codes where upper(code)=upper(trim(p_code)) for update;
 if not found then return jsonb_build_object('ok',false,'reason','CODE_NOT_FOUND'); end if;
 if c.expires_at is not null and c.expires_at<=now() then return jsonb_build_object('ok',false,'reason','EXPIRED'); end if;
 if c.claimed_count>=c.claim_limit then return jsonb_build_object('ok',false,'reason','CLAIM_LIMIT'); end if;
 if exists(select 1 from public.admin_discount_claims where code_id=c.id and user_id=auth.uid()) then return jsonb_build_object('ok',false,'reason','ALREADY_CLAIMED'); end if;
 insert into public.admin_discount_claims(code_id,user_id,expires_at) values(c.id,auth.uid(),now()+interval '2 hours') returning id into v_id;
 update public.admin_discount_codes set claimed_count=claimed_count+1 where id=c.id;
 return jsonb_build_object('ok',true,'claim_id',v_id,'code',c.code,'discount_percent',c.discount_percent,'min_purchase',c.min_purchase,'expires_at',now()+interval '2 hours');
end $$;
revoke all on function public.claim_admin_discount(text) from public,anon;
grant execute on function public.claim_admin_discount(text) to authenticated;

create or replace function public.delete_own_discount_claim(p_claim_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 delete from public.admin_discount_claims cl where cl.id=p_claim_id and cl.user_id=auth.uid() and not exists(select 1 from public.admin_discount_reservations r where r.claim_id=cl.id and r.state='reserved');
 if not found then return jsonb_build_object('ok',false,'reason','CLAIM_NOT_FOUND_OR_RESERVED'); end if;
 update public.admin_discount_codes c set claimed_count=(select count(*) from public.admin_discount_claims cl where cl.code_id=c.id) where c.id is not null;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.delete_own_discount_claim(uuid) from public,anon;
grant execute on function public.delete_own_discount_claim(uuid) to authenticated;

-- Admin announcements are copied to each current member so read/delete state is per-user.
create or replace function public.publish_announcement_notification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  delete from public.boxcellink_notifications where source_id=old.id and is_admin_managed;
  return old;
 end if;
 if new.active then
  insert into public.boxcellink_notifications(user_id,title,body,kind,href,source_id,is_admin_managed)
  select p.id,new.title,new.body,'announcement','/notifications.html',new.id,true
  from public.profiles p
  on conflict (source_id,user_id)
    where is_admin_managed and source_id is not null
  do nothing;
  update public.boxcellink_notifications set title=new.title,body=new.body
   where source_id=new.id and is_admin_managed;
 else
  delete from public.boxcellink_notifications where source_id=new.id and is_admin_managed;
 end if;
 return new;
end $$;
drop trigger if exists announcements_to_notifications on public.announcements;
create trigger announcements_to_notifications after insert or update or delete on public.announcements
for each row execute function public.publish_announcement_notification();

-- Allow trusted server-side RPCs to change VIP expiry while keeping direct
-- member updates to role, ban and VIP fields blocked.
create or replace function public.protect_profile_privilege_fields()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null
     and auth.uid()=old.id
     and not public.is_admin()
     and current_setting('boxcellink.internal_write',true) is distinct from 'on' then
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

-- Protect server-controlled balances and membership state from self-service profile updates.
create or replace function public.protect_profile_financial_fields()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid()=old.id and not public.is_admin() and current_setting('boxcellink.internal_write',true) is distinct from 'on' then
  if new.deposit_balance is distinct from old.deposit_balance
    or new.affiliate_balance is distinct from old.affiliate_balance
    or new.affiliate_status is distinct from old.affiliate_status
    or new.membership_tier is distinct from old.membership_tier
    or new.vip_expires_at is distinct from old.vip_expires_at
    or new.premium_expires_at is distinct from old.premium_expires_at then
   raise exception 'FINANCIAL_OR_MEMBERSHIP_FIELDS_ARE_SERVER_MANAGED';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists protect_profile_financial_fields on public.profiles;
create trigger protect_profile_financial_fields before update on public.profiles
for each row execute function public.protect_profile_financial_fields();



-- Enable Cashi deposit orders while preserving the existing purchase constraints.
alter table public.cashi_orders drop constraint if exists cashi_orders_purpose_check;
alter table public.cashi_orders drop constraint if exists cashi_orders_amount_check;
alter table public.cashi_orders add constraint cashi_orders_amount_check check(amount>0);
alter table public.cashi_orders add constraint cashi_orders_purpose_check
 check(purpose in ('vip','review_download','vip_group','wallet_topup'));
alter table public.cashi_orders drop constraint if exists order_target_check;
alter table public.cashi_orders add constraint order_target_check check (
 (purpose='vip' and plan_id is not null and review_id is null and vip_group_id is null) or
 (purpose='review_download' and plan_id is null and vip_group_id is null
   and (review_id is not null or status <> 'PENDING')) or
 (purpose='vip_group' and vip_group_id is not null and plan_id is null and review_id is null) or
 (purpose='wallet_topup' and plan_id is null and review_id is null and vip_group_id is null)
);
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
  elsif o.purpose='wallet_topup' then
    null;
  elsif o.purpose='vip_group' then
    select coalesce(nullif(btrim(o.vip_group_invite_url),''),s.telegram_url) into v_url
      from public.vip_groups g
      left join public.vip_group_secrets s on s.group_id=g.id
     where g.id=o.vip_group_id and g.status='published';
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
    select vip_expires_at into v_exp
      from public.profiles where id=o.user_id for update;
    perform set_config('boxcellink.internal_write','on',true);
    update public.profiles
       set vip_started_at = case
             when v_exp is null or v_exp <= now() then now()
             else coalesce(vip_started_at,now())
           end,
           vip_expires_at = greatest(coalesce(v_exp,now()),now()) + make_interval(days=>v_days),
           membership_tier = case
             when affiliate_status='approved' then 'affiliate'
             else 'vip'
           end
     where id=o.user_id;
  elsif o.purpose='review_download' then
    insert into public.review_entitlements(user_id,review_id,order_id)
      values(o.user_id,o.review_id,o.order_id)
      on conflict(user_id,review_id) do nothing;
  elsif o.purpose='wallet_topup' then
    perform set_config('boxcellink.internal_write','on',true);
    update public.profiles set deposit_balance=deposit_balance+o.amount where id=o.user_id;
    insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
      values(o.user_id,'deposit',o.amount,'topup',o.order_id,'Deposit saldo melalui Cashi');
  elsif o.purpose='vip_group' then
    insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url)
      values(o.user_id,o.vip_group_id,o.order_id,v_url)
      on conflict(user_id,group_id) do nothing;
  end if;
  return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;

create or replace function public.buy_with_deposit_wallet(
 p_purpose text,p_plan_id uuid default null,p_review_id uuid default null,p_vip_group_id uuid default null,p_affiliate_code text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_base bigint; v_cost bigint; v_order text; v_result jsonb; v_affiliate uuid;
begin
 if v_user is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 if p_purpose='vip' then
  select price into v_base from public.vip_plans where id=p_plan_id and status='published';
 elsif p_purpose='review_download' then
  if exists(select 1 from public.review_entitlements where user_id=v_user and review_id=p_review_id) then
   return jsonb_build_object('ok',false,'reason','REVIEW_ALREADY_OWNED');
  end if;
  select price into v_base from public.review_items where id=p_review_id and status='published' and access='paid';
 elsif p_purpose='vip_group' then
  if exists(select 1 from public.vip_group_entitlements where user_id=v_user and group_id=p_vip_group_id) then
   return jsonb_build_object('ok',false,'reason','GROUP_ALREADY_OWNED');
  end if;
  select price into v_base from public.vip_groups where id=p_vip_group_id and status='published';
 else return jsonb_build_object('ok',false,'reason','PURPOSE_INVALID');
 end if;
 if v_base is null or v_base<2000 then return jsonb_build_object('ok',false,'reason','ITEM_UNAVAILABLE'); end if;
 v_cost:=round(v_base*0.8);
 if v_cost<1 then return jsonb_build_object('ok',false,'reason','MINIMUM_PAYMENT'); end if;
 perform set_config('boxcellink.internal_write','on',true);
 update public.profiles set deposit_balance=deposit_balance-v_cost
  where id=v_user and deposit_balance>=v_cost;
 if not found then return jsonb_build_object('ok',false,'reason','INSUFFICIENT_DEPOSIT'); end if;
 if p_affiliate_code is not null then
  select id into v_affiliate from public.profiles where upper(referral_code)=upper(trim(p_affiliate_code)) and affiliate_status='approved' and id<>v_user limit 1;
 end if;
 v_order:='BCW'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.cashi_orders(order_id,user_id,purpose,plan_id,review_id,vip_group_id,amount,base_amount,discount_percent,status,provider_amount,gateway_payload,settled_at,affiliate_referrer_id)
 values(v_order,v_user,p_purpose,p_plan_id,p_review_id,p_vip_group_id,v_cost,v_base,20,'PENDING',null,'{}'::jsonb,null,v_affiliate);
 insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
 values(v_user,'deposit',-v_cost,'purchase_reserve',v_order,'Pembelian menggunakan saldo deposit dengan diskon 20%');
 v_result:=public.settle_cashi_order(v_order,v_cost,jsonb_build_object('source','deposit_wallet'));
 if coalesce((v_result->>'ok')::boolean,false)=false then raise exception 'WALLET_PURCHASE_FAILED:%',v_result->>'reason'; end if;
 return jsonb_build_object('ok',true,'order_id',v_order,'base_amount',v_base,'paid_amount',v_cost,'discount',20);
end $$;
revoke all on function public.buy_with_deposit_wallet(text,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.buy_with_deposit_wallet(text,uuid,uuid,uuid,text) to authenticated;

-- Notify members after a verified Cashi transaction.
create or replace function public.notify_settled_purchase()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_title text; v_body text;
begin
 if old.status is distinct from new.status and new.status='SETTLED' then
  if new.purpose='wallet_topup' then
   v_title:='Deposit berhasil';
   v_body:='Saldo deposit bertambah Rp'||to_char(new.amount,'FM999G999G999G990')||'.';
  elsif new.purpose='vip' then
   v_title:='Pembelian VIP berhasil';
   v_body:='Membership VIP berhasil diaktifkan.';
  elsif new.purpose='vip_group' then
   v_title:='Pembelian Group VIP berhasil';
   v_body:='Akses Group VIP sudah tersedia di Akun Saya.';
  else
   v_title:='Pembelian Review Media berhasil';
   v_body:='Akses Review Media sudah aktif. Silakan buka halaman pembelian untuk melanjutkan.';
  end if;
  insert into public.boxcellink_notifications(user_id,title,body,kind,href)
   values(new.user_id,v_title,v_body,'purchase','/account.html');
 end if;
 return new;
end $$;
drop trigger if exists cashi_purchase_notification on public.cashi_orders;
create trigger cashi_purchase_notification after update of status on public.cashi_orders
for each row execute function public.notify_settled_purchase();

create or replace function public.reserve_referral_coupon(p_user_id uuid,p_code text,p_order_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.discount_coupons%rowtype; a public.admin_discount_codes%rowtype; cl public.admin_discount_claims%rowtype; v_base bigint; v_purpose text; v_scope text;
begin
 select coalesce(base_amount,amount),purpose into v_base,v_purpose from public.cashi_orders where order_id=p_order_id and user_id=p_user_id for update;
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
   and (x.expires_at is null or x.expires_at>now()) and (d.expires_at is null or d.expires_at>now())
   and not exists(select 1 from public.admin_discount_reservations r where r.claim_id=x.id and r.state='reserved')
  for update of d,x;
 if not found then return jsonb_build_object('ok',false,'reason','Kode diskon tidak ditemukan, expired, atau sudah digunakan'); end if;
 v_scope:=case v_purpose when 'vip' then 'vip_account' when 'vip_group' then 'vip_group' when 'review_download' then 'telegram_review' else 'all' end;
 if coalesce(a.scope,'all') not in ('all',v_scope) then return jsonb_build_object('ok',false,'reason','Kode diskon tidak berlaku untuk jenis pembelian ini'); end if;
 if v_base<a.min_purchase then return jsonb_build_object('ok',false,'reason','Minimal pembelian kode ini belum terpenuhi'); end if;
 select x.* into cl from public.admin_discount_claims x where x.user_id=p_user_id and x.code_id=a.id and x.used_at is null for update;
 insert into public.admin_discount_reservations(order_id,claim_id,code_id,user_id,state) values(p_order_id,cl.id,a.id,p_user_id,'reserved');
 update public.cashi_orders set coupon_code=a.code where order_id=p_order_id and user_id=p_user_id;
 return jsonb_build_object('ok',true,'discount_percent',a.discount_percent,'coupon_code',a.code);
end $$;
revoke all on function public.reserve_referral_coupon(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_referral_coupon(uuid,text,text) to service_role;

create or replace function public.notify_expired_vip_once()
returns boolean language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;
begin
 if auth.uid() is null then return false; end if;
 select * into p from public.profiles where id=auth.uid();
 if p.vip_expires_at is null or p.vip_expires_at>now() then return false; end if;
 if exists(select 1 from public.boxcellink_notifications where user_id=auth.uid() and kind='vip_expired' and created_at>=p.vip_expires_at) then return false; end if;
 if p.membership_tier='vip' and p.affiliate_status<>'approved' then
   perform set_config('boxcellink.internal_write','on',true);
   update public.profiles set membership_tier='basic' where id=auth.uid();
 end if;
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 values(auth.uid(),'Masa VIP telah berakhir','Masa aktif VIP kamu sudah berakhir. Pilih paket VIP untuk mengaktifkannya kembali.','vip_expired','/vip.html');
 return true;
end $$;
revoke all on function public.notify_expired_vip_once() from public,anon;
grant execute on function public.notify_expired_vip_once() to authenticated;

create or replace function public.cleanup_my_expired_discount_claims()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if auth.uid() is null then return 0; end if;
 delete from public.admin_discount_claims cl
 where cl.user_id=auth.uid() and cl.expires_at is not null and cl.expires_at<=now()
 and not exists(select 1 from public.admin_discount_reservations r where r.claim_id=cl.id and r.state='reserved');
 get diagnostics n=row_count;
 update public.admin_discount_codes c set claimed_count=(select count(*) from public.admin_discount_claims cl where cl.code_id=c.id) where c.id is not null;
 return n;
end $$;
revoke all on function public.cleanup_my_expired_discount_claims() from public,anon;
grant execute on function public.cleanup_my_expired_discount_claims() to authenticated;

-- If pg_cron is enabled on this Supabase project, remove expired unreserved claims every 5 minutes.
do $$
begin
 create extension if not exists pg_cron;
 perform cron.unschedule(jobid)
   from cron.job
  where jobname='boxcellink-cleanup-discount-claims';
 perform cron.schedule('boxcellink-cleanup-discount-claims','*/5 * * * *',
   'select public.cleanup_expired_admin_discount_claims()');
exception when others then
 raise notice 'pg_cron unavailable; expired claims are still cleaned when users claim or open My Discount: %',sqlerrm;
end $$;

create or replace function public.transfer_affiliate_to_deposit(p_amount bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 if p_amount is null or p_amount<1000 then return jsonb_build_object('ok',false,'reason','MINIMUM_TRANSFER'); end if;
 perform set_config('boxcellink.internal_write','on',true);
 update public.profiles set affiliate_balance=affiliate_balance-p_amount,deposit_balance=deposit_balance+p_amount
  where id=auth.uid() and affiliate_status='approved' and affiliate_balance>=p_amount;
 if not found then return jsonb_build_object('ok',false,'reason','AFFILIATE_BALANCE_INSUFFICIENT'); end if;
 insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,description)
 values(auth.uid(),'affiliate',-p_amount,'transfer_to_deposit','Pemindahan saldo afiliasi ke saldo deposit'),
       (auth.uid(),'deposit',p_amount,'transfer_from_affiliate','Saldo diterima dari afiliasi');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.transfer_affiliate_to_deposit(bigint) from public,anon;
grant execute on function public.transfer_affiliate_to_deposit(bigint) to authenticated;

commit;
