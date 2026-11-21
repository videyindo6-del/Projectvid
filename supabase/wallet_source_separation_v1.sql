-- BoxCellink Wallet Source Separation v1
-- Run AFTER:
-- 1) BoxCellink-affiliate-wallet-notifications-FIXED.sql
-- 2) boxcellink_wallet_withdraw_v2.sql
-- 3) referral_deposit_reward_v1.sql
-- 4) autolink_publisher_monetization_v1.sql
-- This migration keeps each earning source separate and permits all four
-- sources to fund VIP, VIP Group, and paid Telegram Review purchases.

begin;

alter table public.profiles
  add column if not exists referral_balance bigint not null default 0;

alter table public.profiles
  drop constraint if exists profiles_referral_balance_nonnegative;
alter table public.profiles
  add constraint profiles_referral_balance_nonnegative check (referral_balance >= 0);

-- Referral rewards are now a dedicated, non-withdrawable wallet.
-- Historical referral_reward entries remain in deposit_balance because the
-- legacy system mixed referral credits and deposit spending; safely splitting
-- their remaining balance cannot be inferred from the old ledger.
alter table public.wallet_ledger
  drop constraint if exists wallet_ledger_wallet_type_check;
alter table public.wallet_ledger
  add constraint wallet_ledger_wallet_type_check
  check (wallet_type in ('deposit','referral','affiliate'));

create or replace function public.credit_referral_deposit_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
begin
  if new.referred_by is null or new.referred_by = new.id then
    return new;
  end if;

  insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
  values(new.referred_by,'referral',1000,'referral_reward',new.id::text,'Hadiah referral Rp1.000 · saldo khusus pembelian')
  on conflict (user_id,reference_id) where entry_type = 'referral_reward' do nothing
  returning id into v_entry_id;

  if v_entry_id is not null then
    perform set_config('boxcellink.internal_write','on',true);
    update public.profiles
      set referral_balance = coalesce(referral_balance,0) + 1000
      where id = new.referred_by;
    insert into public.boxcellink_notifications(user_id,title,body,kind,href,is_read,is_admin_managed)
    values(new.referred_by,'Hadiah referral masuk','Kamu mendapatkan saldo referral Rp1.000. Saldo dapat digunakan untuk pembelian VIP, Group VIP, dan Review Media Telegram, tetapi tidak dapat ditarik.','referral','/wallet.html',false,false);
  end if;
  return new;
end;
$$;
grant execute on function public.credit_referral_deposit_reward() to authenticated;

-- Existing checkout callers keep the same RPC signature. Funding priority:
-- deposit -> referral -> affiliate -> AutoLink publisher earnings.
-- Deposit and referral are never withdrawable. Affiliate and publisher funds
-- remain withdrawable only through their existing dedicated withdrawal RPCs.
create or replace function public.buy_with_deposit_wallet(
 p_purpose text,
 p_plan_id uuid default null,
 p_review_id uuid default null,
 p_vip_group_id uuid default null,
 p_affiliate_code text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 v_user uuid := auth.uid();
 v_base bigint;
 v_cost bigint;
 v_order text;
 v_result jsonb;
 v_affiliate uuid;
 v_deposit bigint := 0;
 v_referral bigint := 0;
 v_affiliate_balance bigint := 0;
 v_publisher bigint := 0;
 v_take_deposit bigint := 0;
 v_take_referral bigint := 0;
 v_take_affiliate bigint := 0;
 v_take_publisher bigint := 0;
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
 else
  return jsonb_build_object('ok',false,'reason','PURPOSE_INVALID');
 end if;
 if v_base is null or v_base < 2000 then return jsonb_build_object('ok',false,'reason','ITEM_UNAVAILABLE'); end if;
 v_cost := round(v_base * 0.8);
 if v_cost < 1 then return jsonb_build_object('ok',false,'reason','MINIMUM_PAYMENT'); end if;

 -- Lock profile and publisher wallet before calculating allocations.
 perform set_config('boxcellink.internal_write','on',true);
 select coalesce(deposit_balance,0),coalesce(referral_balance,0),coalesce(affiliate_balance,0)
   into v_deposit,v_referral,v_affiliate_balance
   from public.profiles where id=v_user for update;
 if not found then return jsonb_build_object('ok',false,'reason','PROFILE_NOT_FOUND'); end if;

 insert into public.publisher_balances(publisher_id) values(v_user) on conflict(publisher_id) do nothing;
 select coalesce(available_balance,0) into v_publisher
   from public.publisher_balances where publisher_id=v_user for update;

 v_take_deposit := least(v_cost,v_deposit);
 v_take_referral := least(v_cost-v_take_deposit,v_referral);
 v_take_affiliate := least(v_cost-v_take_deposit-v_take_referral,v_affiliate_balance);
 v_take_publisher := least(v_cost-v_take_deposit-v_take_referral-v_take_affiliate,v_publisher);

 if v_take_deposit+v_take_referral+v_take_affiliate+v_take_publisher < v_cost then
  return jsonb_build_object('ok',false,'reason','INSUFFICIENT_COMBINED_BALANCE',
    'required',v_cost,'available',v_deposit+v_referral+v_affiliate_balance+v_publisher);
 end if;

 update public.profiles
 set deposit_balance=deposit_balance-v_take_deposit,
     referral_balance=referral_balance-v_take_referral,
     affiliate_balance=affiliate_balance-v_take_affiliate
 where id=v_user;

 if v_take_publisher > 0 then
  update public.publisher_balances
   set available_balance=available_balance-v_take_publisher,updated_at=now()
   where publisher_id=v_user and available_balance>=v_take_publisher;
  if not found then raise exception 'PUBLISHER_BALANCE_CHANGED'; end if;
 end if;

 if v_take_deposit > 0 then
  insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,description)
  values(v_user,'deposit',-v_take_deposit,'purchase_reserve','Pembelian VIP/Group VIP/Review Media');
 end if;
 if v_take_referral > 0 then
  insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,description)
  values(v_user,'referral',-v_take_referral,'purchase_reserve','Pembelian VIP/Group VIP/Review Media');
 end if;
 if v_take_affiliate > 0 then
  insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,description)
  values(v_user,'affiliate',-v_take_affiliate,'purchase_reserve','Pembelian VIP/Group VIP/Review Media');
 end if;
 if v_take_publisher > 0 then
  insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description)
  values(v_user,'review_purchase',-v_take_publisher,
    'PURCHASE:'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    'Pembelian VIP/Group VIP/Review Media menggunakan saldo AutoLink');
 end if;

 if p_affiliate_code is not null then
  select id into v_affiliate from public.profiles
   where upper(referral_code)=upper(trim(p_affiliate_code)) and affiliate_status='approved' and id<>v_user limit 1;
 end if;
 v_order := 'BCW'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.cashi_orders(order_id,user_id,purpose,plan_id,review_id,vip_group_id,amount,base_amount,discount_percent,status,provider_amount,gateway_payload,settled_at,affiliate_referrer_id)
 values(v_order,v_user,p_purpose,p_plan_id,p_review_id,p_vip_group_id,v_cost,v_base,20,'PENDING',null,'{}'::jsonb,null,v_affiliate);

 v_result := public.settle_cashi_order(v_order,v_cost,
   jsonb_build_object('source','multi_wallet','deposit',v_take_deposit,'referral',v_take_referral,'affiliate',v_take_affiliate,'autolink',v_take_publisher));
 if coalesce((v_result->>'ok')::boolean,false)=false then
  raise exception 'WALLET_PURCHASE_FAILED:%',coalesce(v_result->>'reason','UNKNOWN');
 end if;
 return jsonb_build_object('ok',true,'order_id',v_order,'base_amount',v_base,'paid_amount',v_cost,'discount',20,
  'used',jsonb_build_object('deposit',v_take_deposit,'referral',v_take_referral,'affiliate',v_take_affiliate,'autolink',v_take_publisher));
end;
$$;
revoke all on function public.buy_with_deposit_wallet(text,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.buy_with_deposit_wallet(text,uuid,uuid,uuid,text) to authenticated;

-- The existing AutoLink migration revokes this table's grants after creating
-- its owner-only SELECT policy. Re-grant SELECT so the member wallet can read
-- its own earning history under RLS.
grant select on public.publisher_transactions to authenticated;

commit;
