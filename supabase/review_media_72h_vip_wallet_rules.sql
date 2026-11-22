-- BoxCellink Review Media purchase access: 72 hours, VIP discount, wallet rules.
-- Run after the existing BoxCellink wallet/payment migrations.
begin;

alter table public.review_entitlements
  add column if not exists expires_at timestamptz;

-- Legacy purchases receive a conservative 72-hour window from the original entitlement creation.
update public.review_entitlements
set expires_at = created_at + interval '72 hours'
where expires_at is null;

alter table public.review_entitlements
  alter column expires_at set default (now() + interval '72 hours'),
  alter column expires_at set not null;
create index if not exists review_entitlements_active_lookup_idx
  on public.review_entitlements(user_id,review_id,expires_at);

-- Every successful paid Review Media settlement creates/renews the entitlement.
-- Trigger only on the first transition to SETTLED so status polling cannot extend access.
create or replace function public.grant_review_entitlement_72h_from_settlement()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and old.status='SETTLED' then return new; end if;
  if new.purpose='review_download' and new.review_id is not null and new.user_id is not null
     and new.status='SETTLED' then
    insert into public.review_entitlements(user_id,review_id,order_id,created_at,expires_at)
    values(new.user_id,new.review_id,new.order_id,coalesce(new.settled_at,now()),coalesce(new.settled_at,now())+interval '72 hours')
    on conflict(user_id,review_id) do update set
      order_id=excluded.order_id,
      created_at=excluded.created_at,
      expires_at=excluded.expires_at;
  end if;
  return new;
end $$;
drop trigger if exists cashi_review_entitlement_72h on public.cashi_orders;
create trigger cashi_review_entitlement_72h
after insert or update of status on public.cashi_orders
for each row execute function public.grant_review_entitlement_72h_from_settlement();
revoke all on function public.grant_review_entitlement_72h_from_settlement() from public,anon,authenticated;

-- Direct publisher wallet purchase: expired access can be repurchased; active access cannot.
create or replace function public.buy_review_with_publisher_balance(p_review_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 u uuid:=auth.uid(); r public.review_items%rowtype; ref text;
 v_discount integer:=0; v_cost bigint; v_vip_expires timestamptz;
begin
 if u is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select * into r from public.review_items where id=p_review_id and status='published' and access='paid' for update;
 if not found then return jsonb_build_object('ok',false,'reason','REVIEW_UNAVAILABLE'); end if;
 if exists(select 1 from public.review_entitlements where user_id=u and review_id=p_review_id and expires_at>now()) then
  return jsonb_build_object('ok',false,'reason','ALREADY_OWNED');
 end if;
 select vip_expires_at into v_vip_expires from public.profiles where id=u;
 if v_vip_expires is not null and v_vip_expires>now() then v_discount:=20; end if;
 v_cost:=round(r.price*(100-v_discount)/100.0);
 insert into public.publisher_balances(publisher_id) values(u) on conflict do nothing;
 update public.publisher_balances set available_balance=available_balance-v_cost,updated_at=now()
 where publisher_id=u and available_balance>=v_cost;
 if not found then return jsonb_build_object('ok',false,'reason','INSUFFICIENT_PUBLISHER_BALANCE','required',v_cost,'discount',v_discount); end if;
 insert into public.review_entitlements(user_id,review_id,order_id,created_at,expires_at)
 values(u,p_review_id,null,now(),now()+interval '72 hours')
 on conflict(user_id,review_id) do update set order_id=null,created_at=now(),expires_at=now()+interval '72 hours';
 ref:='PUBREVIEW:'||gen_random_uuid()::text;
 insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description)
 values(u,'review_purchase',-v_cost,ref,'Pembelian Review Media: '||r.title||' · diskon VIP '||v_discount||'%');
 return jsonb_build_object('ok',true,'review_id',p_review_id,'base_amount',r.price,'amount',v_cost,'discount',v_discount,'expires_at',now()+interval '72 hours');
end $$;
revoke all on function public.buy_review_with_publisher_balance(uuid) from public,anon;
grant execute on function public.buy_review_with_publisher_balance(uuid) to authenticated;

-- Wallet purchase RPC: retain multi-wallet funding priority but discount Review Media
-- only for active VIP. Existing non-review wallet purchase discount behavior stays 20%.
create or replace function public.buy_with_deposit_wallet(
 p_purpose text,
 p_plan_id uuid default null,
 p_review_id uuid default null,
 p_vip_group_id uuid default null,
 p_affiliate_code text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_user uuid:=auth.uid(); v_base bigint; v_cost bigint; v_order text; v_result jsonb; v_affiliate uuid;
 v_deposit bigint:=0; v_referral bigint:=0; v_affiliate_balance bigint:=0; v_publisher bigint:=0;
 v_take_deposit bigint:=0; v_take_referral bigint:=0; v_take_affiliate bigint:=0; v_take_publisher bigint:=0;
 v_discount integer:=20; v_vip_expires timestamptz;
begin
 if v_user is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 if p_purpose='vip' then
  select price into v_base from public.vip_plans where id=p_plan_id and status='published';
 elsif p_purpose='review_download' then
  if exists(select 1 from public.review_entitlements where user_id=v_user and review_id=p_review_id and expires_at>now()) then
   return jsonb_build_object('ok',false,'reason','REVIEW_ALREADY_OWNED');
  end if;
  select price into v_base from public.review_items where id=p_review_id and status='published' and access='paid';
  select vip_expires_at into v_vip_expires from public.profiles where id=v_user;
  v_discount:=case when v_vip_expires is not null and v_vip_expires>now() then 20 else 0 end;
 elsif p_purpose='vip_group' then
  if exists(select 1 from public.vip_group_entitlements where user_id=v_user and group_id=p_vip_group_id) then
   return jsonb_build_object('ok',false,'reason','GROUP_ALREADY_OWNED');
  end if;
  select price into v_base from public.vip_groups where id=p_vip_group_id and status='published';
 else return jsonb_build_object('ok',false,'reason','PURPOSE_INVALID'); end if;
 if v_base is null or v_base<2000 then return jsonb_build_object('ok',false,'reason','ITEM_UNAVAILABLE'); end if;
 v_cost:=round(v_base*(100-v_discount)/100.0);
 if v_cost<1 then return jsonb_build_object('ok',false,'reason','MINIMUM_PAYMENT'); end if;
 perform set_config('boxcellink.internal_write','on',true);
 select coalesce(deposit_balance,0),coalesce(referral_balance,0),coalesce(affiliate_balance,0)
 into v_deposit,v_referral,v_affiliate_balance from public.profiles where id=v_user for update;
 if not found then return jsonb_build_object('ok',false,'reason','PROFILE_NOT_FOUND'); end if;
 insert into public.publisher_balances(publisher_id) values(v_user) on conflict(publisher_id) do nothing;
 select coalesce(available_balance,0) into v_publisher from public.publisher_balances where publisher_id=v_user for update;
 v_take_deposit:=least(v_cost,v_deposit);
 v_take_referral:=least(v_cost-v_take_deposit,v_referral);
 v_take_affiliate:=least(v_cost-v_take_deposit-v_take_referral,v_affiliate_balance);
 v_take_publisher:=least(v_cost-v_take_deposit-v_take_referral-v_take_affiliate,v_publisher);
 if v_take_deposit+v_take_referral+v_take_affiliate+v_take_publisher<v_cost then
  return jsonb_build_object('ok',false,'reason','INSUFFICIENT_COMBINED_BALANCE','required',v_cost,'available',v_deposit+v_referral+v_affiliate_balance+v_publisher);
 end if;
 update public.profiles set deposit_balance=deposit_balance-v_take_deposit,referral_balance=referral_balance-v_take_referral,affiliate_balance=affiliate_balance-v_take_affiliate where id=v_user;
 if v_take_publisher>0 then
  update public.publisher_balances set available_balance=available_balance-v_take_publisher,updated_at=now() where publisher_id=v_user and available_balance>=v_take_publisher;
  if not found then raise exception 'PUBLISHER_BALANCE_CHANGED'; end if;
 end if;
 if v_take_deposit>0 then insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,description) values(v_user,'deposit',-v_take_deposit,'purchase_reserve','Pembelian VIP/Group VIP/Review Media'); end if;
 if v_take_referral>0 then insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,description) values(v_user,'referral',-v_take_referral,'purchase_reserve','Pembelian VIP/Group VIP/Review Media'); end if;
 if v_take_affiliate>0 then insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,description) values(v_user,'affiliate',-v_take_affiliate,'purchase_reserve','Pembelian VIP/Group VIP/Review Media'); end if;
 if v_take_publisher>0 then
  insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description)
  values(v_user,'review_purchase',-v_take_publisher,'PURCHASE:'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),'Pembelian VIP/Group VIP/Review Media menggunakan saldo AutoLink');
 end if;
 if p_affiliate_code is not null then
  select id into v_affiliate from public.profiles where upper(referral_code)=upper(trim(p_affiliate_code)) and affiliate_status='approved' and id<>v_user limit 1;
 end if;
 v_order:='BCW'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.cashi_orders(order_id,user_id,purpose,plan_id,review_id,vip_group_id,amount,base_amount,discount_percent,status,provider_amount,gateway_payload,settled_at,affiliate_referrer_id)
 values(v_order,v_user,p_purpose,p_plan_id,p_review_id,p_vip_group_id,v_cost,v_base,v_discount,'PENDING',null,'{}'::jsonb,null,v_affiliate);
 v_result:=public.settle_cashi_order(v_order,v_cost,jsonb_build_object('source','multi_wallet','deposit',v_take_deposit,'referral',v_take_referral,'affiliate',v_take_affiliate,'autolink',v_take_publisher));
 if coalesce((v_result->>'ok')::boolean,false)=false then raise exception 'WALLET_PURCHASE_FAILED:%',coalesce(v_result->>'reason','UNKNOWN'); end if;
 return jsonb_build_object('ok',true,'order_id',v_order,'base_amount',v_base,'paid_amount',v_cost,'discount',v_discount,'expires_at',now()+interval '72 hours','used',jsonb_build_object('deposit',v_take_deposit,'referral',v_take_referral,'affiliate',v_take_affiliate,'autolink',v_take_publisher));
end $$;
revoke all on function public.buy_with_deposit_wallet(text,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.buy_with_deposit_wallet(text,uuid,uuid,uuid,text) to authenticated;

commit;
