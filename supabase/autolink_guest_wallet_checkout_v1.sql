-- AutoLink Direct Access guest checkout + member wallet payment + discount support
-- Run after the existing ProjectVID/BoxCellink migrations, including
-- BoxCellink-affiliate-wallet-notifications-FIXED.sql and autolink_publisher_monetization_v1.sql.

begin;

-- Guest QRIS orders do not have an account owner. Other checkout purposes remain
-- protected by their Edge Function authentication checks.
alter table public.cashi_orders alter column user_id drop not null;

alter table public.autolink_payments
  add column if not exists guest_token_hash text;

alter table public.autolink_payments
  drop constraint if exists autolink_payments_amount_check,
  drop constraint if exists autolink_payments_publisher_amount_check,
  drop constraint if exists autolink_payments_platform_amount_check;

alter table public.autolink_payments
  add constraint autolink_payments_amount_check check (amount >= 2000),
  add constraint autolink_payments_publisher_amount_check check (publisher_amount = 2000),
  add constraint autolink_payments_platform_amount_check check (platform_amount >= 0),
  add constraint autolink_payments_split_check check (publisher_amount + platform_amount = amount);

alter table public.autolink_platform_revenue
  drop constraint if exists autolink_platform_revenue_amount_check;
alter table public.autolink_platform_revenue
  add constraint autolink_platform_revenue_amount_check check (amount >= 0);

-- Keep member notifications, but do not try to create a member notification for a guest QRIS order.
create or replace function public.notify_settled_purchase()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_title text; v_body text;
begin
 if old.status is distinct from new.status and new.status='SETTLED' and new.user_id is not null then
  if new.purpose='wallet_topup' then
   v_title:='Deposit berhasil';
   v_body:='Saldo deposit bertambah Rp'||to_char(new.amount,'FM999G999G999G990')||'.';
  elsif new.purpose='vip' then
   v_title:='Pembelian VIP berhasil';
   v_body:='Membership VIP berhasil diaktifkan.';
  elsif new.purpose='vip_group' then
   v_title:='Pembelian Group VIP berhasil';
   v_body:='Akses Group VIP sudah tersedia di Akun Saya.';
  elsif new.purpose='autolink_direct_access' then
   v_title:='Pembelian AutoLink berhasil';
   v_body:='Pembayaran Langsung Akses berhasil diverifikasi.';
  else
   v_title:='Pembelian Review Media berhasil';
   v_body:='Akses Review Media sudah aktif. Silakan buka halaman pembelian untuk melanjutkan.';
  end if;
  insert into public.boxcellink_notifications(user_id,title,body,kind,href)
   values(new.user_id,v_title,v_body,'purchase','/account.html');
 end if;
 return new;
end $$;

-- Settlement is idempotent. Publisher receives Rp2.000; the platform receives
-- the remaining paid amount after any member coupon discount.
create or replace function public.settle_autolink_direct_access(p_order_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.autolink_payments%rowtype; a public.autolinks%rowtype;
begin
 select * into p from public.autolink_payments where order_id=p_order_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','PAYMENT_NOT_FOUND'); end if;
 if p.status='settled' then return jsonb_build_object('ok',true,'duplicate',true); end if;
 select * into a from public.autolinks where id=p.autolink_id;
 if not found then return jsonb_build_object('ok',false,'reason','AUTOLINK_UNAVAILABLE'); end if;
 if p.amount < p.publisher_amount or p.publisher_amount <> 2000 then
  return jsonb_build_object('ok',false,'reason','PAYMENT_AMOUNT_INVALID');
 end if;
 insert into public.publisher_balances(publisher_id) values(p.publisher_id) on conflict do nothing;
 update public.publisher_balances set available_balance=available_balance+p.publisher_amount,
  direct_access_earned_total=direct_access_earned_total+p.publisher_amount,updated_at=now()
 where publisher_id=p.publisher_id;
 insert into public.publisher_transactions(publisher_id,autolink_id,transaction_type,amount,reference_id,description)
 values(p.publisher_id,p.autolink_id,'direct_access',p.publisher_amount,'DIRECT:'||p.order_id,'Langsung Akses · '||a.title);
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 values(p.publisher_id,'Pembayaran AutoLink berhasil!','Saldo publisher bertambah +Rp'||to_char(p.publisher_amount,'FM999G999G999G990')||' dari AutoLink: '||a.title,'autolink_payment','/publisher-dashboard.html');
 insert into public.autolink_platform_revenue(order_id,amount) values(p.order_id,p.platform_amount) on conflict do nothing;
 insert into public.publisher_daily_stats(publisher_id,stat_date,direct_access_earned)
 values(p.publisher_id,(now() at time zone 'Asia/Jakarta')::date,p.publisher_amount)
 on conflict(publisher_id,stat_date) do update set direct_access_earned=publisher_daily_stats.direct_access_earned+excluded.direct_access_earned;
 update public.autolink_payments set status='settled',settled_at=now() where order_id=p_order_id;
 return jsonb_build_object('ok',true,'publisher_amount',p.publisher_amount,'platform_amount',p.platform_amount,'title',a.title);
end $$;
revoke all on function public.settle_autolink_direct_access(text) from public,anon,authenticated;
grant execute on function public.settle_autolink_direct_access(text) to service_role;

-- Member can pay Direct Access from either wallet. Discount codes use the
-- existing reservation/consumption workflow and are only available to logged-in members.
create or replace function public.buy_autolink_direct_access_with_wallet(
 p_short_code text,
 p_wallet_type text default 'deposit',
 p_coupon_code text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_user uuid:=auth.uid();
 v_link public.autolinks%rowtype;
 v_order text;
 v_discount integer:=0;
 v_coupon text:=null;
 v_amount bigint:=3500;
 v_result jsonb;
begin
 if v_user is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 if p_wallet_type not in ('deposit','affiliate') then return jsonb_build_object('ok',false,'reason','WALLET_INVALID'); end if;
 select * into v_link from public.autolinks where short_code=trim(p_short_code) and status='published' for update;
 if not found then return jsonb_build_object('ok',false,'reason','AUTOLINK_UNAVAILABLE'); end if;
 if v_link.publisher_id=v_user then return jsonb_build_object('ok',false,'reason','CANNOT_BUY_OWN_LINK'); end if;
 if p_wallet_type='affiliate' and not exists(select 1 from public.profiles where id=v_user and affiliate_status='approved') then
  return jsonb_build_object('ok',false,'reason','AFFILIATE_NOT_APPROVED');
 end if;

 v_order:='BCWAL'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.cashi_orders(order_id,user_id,purpose,autolink_id,amount,base_amount,discount_percent,status)
 values(v_order,v_user,'autolink_direct_access',v_link.id,3500,3500,0,'PENDING');

 if nullif(trim(coalesce(p_coupon_code,'')),'') is not null then
  v_result:=public.reserve_referral_coupon(v_user,trim(p_coupon_code),v_order);
  if coalesce((v_result->>'ok')::boolean,false)=false then
   delete from public.cashi_orders where order_id=v_order;
   return jsonb_build_object('ok',false,'reason',coalesce(v_result->>'reason','COUPON_INVALID'));
  end if;
  v_discount:=greatest(0,least(90,coalesce((v_result->>'discount_percent')::integer,0)));
  v_coupon:=v_result->>'coupon_code';
 end if;
 v_amount:=round(3500*(100-v_discount)/100.0)::bigint;
 if v_amount<2000 then
  if v_coupon is not null then perform public.release_referral_coupon(v_order); end if;
  update public.cashi_orders set status='FAILED' where order_id=v_order;
  return jsonb_build_object('ok',false,'reason','MINIMUM_AFTER_DISCOUNT');
 end if;

 insert into public.autolink_payments(order_id,autolink_id,buyer_id,publisher_id,target_url_snapshot,title_snapshot,amount,publisher_amount,platform_amount,status,guest_token_hash)
 values(v_order,v_link.id,v_user,v_link.publisher_id,v_link.target_url,v_link.title,v_amount,2000,v_amount-2000,'pending',null);

 update public.cashi_orders set amount=v_amount,discount_percent=v_discount,coupon_code=v_coupon where order_id=v_order;

 perform set_config('boxcellink.internal_write','on',true);
 if p_wallet_type='deposit' then
  update public.profiles set deposit_balance=deposit_balance-v_amount where id=v_user and deposit_balance>=v_amount;
 else
  update public.profiles set affiliate_balance=affiliate_balance-v_amount
   where id=v_user and affiliate_status='approved' and affiliate_balance>=v_amount;
 end if;
 if not found then
  if v_coupon is not null then perform public.release_referral_coupon(v_order); end if;
  update public.autolink_payments set status='failed' where order_id=v_order;
  update public.cashi_orders set status='FAILED' where order_id=v_order;
  return jsonb_build_object('ok',false,'reason',case when p_wallet_type='deposit' then 'INSUFFICIENT_DEPOSIT' else 'INSUFFICIENT_AFFILIATE_BALANCE' end);
 end if;

 insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
 values(v_user,p_wallet_type,-v_amount,'autolink_direct_access',v_order,
  'Pembelian AutoLink Langsung Akses menggunakan saldo '||case when p_wallet_type='deposit' then 'deposit' else 'afiliasi' end);

 v_result:=public.settle_cashi_order(v_order,v_amount,jsonb_build_object('source','internal_wallet','wallet_type',p_wallet_type));
 if coalesce((v_result->>'ok')::boolean,false)=false then
  raise exception 'AUTOLINK_WALLET_SETTLEMENT_FAILED:%',coalesce(v_result->>'reason','UNKNOWN');
 end if;
 return jsonb_build_object('ok',true,'order_id',v_order,'amount',v_amount,'discount_percent',v_discount,'title',v_link.title);
end $$;
revoke all on function public.buy_autolink_direct_access_with_wallet(text,text,text) from public,anon;
grant execute on function public.buy_autolink_direct_access_with_wallet(text,text,text) to authenticated;

commit;
