-- BoxCellink discount claim + SKU/purpose enforcement repair.
-- Apply AFTER admin_discount_claim_flow.sql and admin_discount_scope_and_crud_fix.sql.
-- Admin claims are valid for 2 hours; promo reservations are consumed only by settle_cashi_order.

create table if not exists public.admin_discount_reservations(
 order_id text primary key,
 claim_id uuid not null references public.admin_discount_claims(id) on delete cascade,
 code_id uuid not null references public.admin_discount_codes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 state text not null default 'reserved' check(state in ('reserved','consumed','released')),
 created_at timestamptz not null default now()
);
create unique index if not exists admin_discount_one_open_reservation_idx
 on public.admin_discount_reservations(claim_id) where state='reserved';
alter table public.admin_discount_reservations enable row level security;
revoke all on public.admin_discount_reservations from anon,authenticated;

-- Backfill expiry on older claims that were created by the scope/CRUD SQL without an expiry.
update public.admin_discount_claims set expires_at=claimed_at+interval '2 hours' where expires_at is null;

-- Restore the 2-hour claim window; the scope/CRUD migration's version omitted claim expiry.
create or replace function public.claim_admin_discount(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.admin_discount_codes%rowtype; v_id uuid; v_claim_exp timestamptz; v_code text:=nullif(upper(trim(coalesce(p_code,''))), '');
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 perform public.cleanup_expired_admin_discount_claims();
 if v_code is null then
   select d.* into c from public.admin_discount_codes d
   where (d.expires_at is null or d.expires_at>now()) and d.claimed_count<d.claim_limit
     and not exists(select 1 from public.admin_discount_claims x where x.code_id=d.id and x.user_id=auth.uid())
   order by random() limit 1 for update skip locked;
   if not found then return jsonb_build_object('ok',false,'reason','NO_AVAILABLE_CODE'); end if;
 else
   select * into c from public.admin_discount_codes where upper(code)=v_code for update;
   if not found then return jsonb_build_object('ok',false,'reason','CODE_NOT_FOUND'); end if;
   if c.expires_at is not null and c.expires_at<=now() then return jsonb_build_object('ok',false,'reason','EXPIRED'); end if;
   if c.claimed_count>=c.claim_limit then return jsonb_build_object('ok',false,'reason','CLAIM_LIMIT'); end if;
   if exists(select 1 from public.admin_discount_claims where code_id=c.id and user_id=auth.uid()) then return jsonb_build_object('ok',false,'reason','ALREADY_CLAIMED'); end if;
 end if;
 v_claim_exp:=now()+interval '2 hours';
 insert into public.admin_discount_claims(code_id,user_id,expires_at) values(c.id,auth.uid(),v_claim_exp) returning id into v_id;
 update public.admin_discount_codes set claimed_count=claimed_count+1 where id=c.id;
 return jsonb_build_object('ok',true,'claim_id',v_id,'code',c.code,'scope',c.scope,'discount_percent',c.discount_percent,'min_purchase',c.min_purchase,'expires_at',v_claim_exp);
end $$;
revoke all on function public.claim_admin_discount(text) from public,anon;
grant execute on function public.claim_admin_discount(text) to authenticated;

-- Coupon reservation validates the purchase SKU/purpose server-side, not just in the UI.
create or replace function public.reserve_referral_coupon(p_user_id uuid,p_code text,p_order_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 c public.discount_coupons%rowtype; a public.admin_discount_codes%rowtype;
 cl public.admin_discount_claims%rowtype; v_base bigint; v_purpose text; v_scope text;
begin
 select coalesce(base_amount,amount),purpose into v_base,v_purpose
 from public.cashi_orders where order_id=p_order_id and user_id=p_user_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
 select * into c from public.discount_coupons where user_id=p_user_id and upper(code)=upper(trim(p_code)) for update;
 if found then
  if v_purpose<>'review_download' then return jsonb_build_object('ok',false,'reason','REFERRAL_ONLY_TELEGRAM_REVIEW'); end if;
  if c.expires_at is not null and c.expires_at<=now() then return jsonb_build_object('ok',false,'reason','REFERRAL_COUPON_EXPIRED'); end if;
  if c.uses_used+c.uses_reserved>=c.uses_total then return jsonb_build_object('ok',false,'reason','REFERRAL_COUPON_EXHAUSTED'); end if;
  insert into public.discount_coupon_reservations(order_id,user_id,coupon_code,state) values(p_order_id,p_user_id,c.code,'reserved');
  update public.cashi_orders set coupon_code=c.code where order_id=p_order_id and user_id=p_user_id;
  update public.discount_coupons set uses_reserved=uses_reserved+1 where id=c.id;
  return jsonb_build_object('ok',true,'discount_percent',c.discount_percent,'coupon_code',c.code);
 end if;
 select d.* into a from public.admin_discount_codes d join public.admin_discount_claims x on x.code_id=d.id
 where x.user_id=p_user_id and upper(d.code)=upper(trim(p_code)) and x.used_at is null
   and x.expires_at>now() and (d.expires_at is null or d.expires_at>now())
   and not exists(select 1 from public.admin_discount_reservations r where r.claim_id=x.id and r.state='reserved')
 for update of d,x;
 if not found then return jsonb_build_object('ok',false,'reason','CLAIM_NOT_FOUND_EXPIRED_OR_USED'); end if;
 v_scope:=case when v_purpose='vip' then 'vip_account' when v_purpose='vip_group' then 'vip_group' when v_purpose='review_download' then 'telegram_review' else 'unsupported' end;
 if a.scope not in ('all',v_scope) then return jsonb_build_object('ok',false,'reason','SKU_SCOPE_MISMATCH'); end if;
 if v_base<a.min_purchase then return jsonb_build_object('ok',false,'reason','MIN_PURCHASE_NOT_MET'); end if;
 select * into cl from public.admin_discount_claims x where x.user_id=p_user_id and x.code_id=a.id and x.used_at is null and x.expires_at>now() for update;
 if not found then return jsonb_build_object('ok',false,'reason','CLAIM_EXPIRED_OR_USED'); end if;
 insert into public.admin_discount_reservations(order_id,claim_id,code_id,user_id,state) values(p_order_id,cl.id,a.id,p_user_id,'reserved');
 update public.cashi_orders set coupon_code=a.code where order_id=p_order_id and user_id=p_user_id;
 return jsonb_build_object('ok',true,'discount_percent',a.discount_percent,'coupon_code',a.code,'scope',a.scope);
end $$;
revoke all on function public.reserve_referral_coupon(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_referral_coupon(uuid,text,text) to service_role;
