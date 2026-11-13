-- BoxCellink / ProjectVID: admin CRUD and discount purpose targeting.
-- Run after admin_discount_claim_flow.sql, admin_vip_crud_fix.sql and vip_group_secret_hardening.sql.

alter table public.admin_discount_codes add column if not exists scope text not null default 'all';
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_scope_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_scope_check
  check (scope in ('all','vip_account','vip_group','telegram_review'));
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_discount_percent_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_discount_percent_check
  check (discount_percent between 1 and 75);
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_claim_limit_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_claim_limit_check
  check (claim_limit between 1 and 10000);
alter table public.admin_discount_codes alter column claim_limit set default 2;
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_min_purchase_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_min_purchase_check check(min_purchase>=2000);

-- Ensure admin CRUD policies and grants are in place for all management tables.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.vip_plans to authenticated;
grant select,insert,update,delete on public.admin_discount_codes to authenticated;
grant select (id,name,description,price,member_count,status,created_at) on public.vip_groups to anon,authenticated;
grant insert (name,description,price,member_count,status) on public.vip_groups to authenticated;
grant update (name,description,price,member_count,status) on public.vip_groups to authenticated;
grant delete on public.vip_groups to authenticated;
grant select,insert,update,delete on public.vip_group_secrets to authenticated;

-- Keep group invitation links private, but manageable by administrators.
alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets" on public.vip_group_secrets
 for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Ensure VIP plan and group CRUD is restricted to admins.
alter table public.vip_plans enable row level security;
drop policy if exists "admin plans" on public.vip_plans;
create policy "admin plans" on public.vip_plans for all to authenticated
 using(public.is_admin()) with check(public.is_admin());
alter table public.vip_groups enable row level security;
drop policy if exists "admin vip groups" on public.vip_groups;
create policy "admin vip groups" on public.vip_groups for all to authenticated
 using(public.is_admin()) with check(public.is_admin());
alter table public.admin_discount_codes enable row level security;
drop policy if exists "admin discount codes" on public.admin_discount_codes;
create policy "admin discount codes" on public.admin_discount_codes for all to authenticated
 using(public.is_admin()) with check(public.is_admin());

-- A code can only be reserved for the purchase type selected by the administrator.
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
  if v_purpose<>'review_download' then return jsonb_build_object('ok',false,'reason','Kode referral hanya berlaku untuk review media Telegram'); end if;
  if c.uses_used+c.uses_reserved>=c.uses_total then return jsonb_build_object('ok',false,'reason','Kode diskon referral sudah habis'); end if;
  insert into public.discount_coupon_reservations(order_id,user_id,coupon_code,state) values(p_order_id,p_user_id,c.code,'reserved');
  update public.cashi_orders set coupon_code=c.code where order_id=p_order_id and user_id=p_user_id;
  update public.discount_coupons set uses_reserved=uses_reserved+1 where id=c.id;
  return jsonb_build_object('ok',true,'discount_percent',c.discount_percent,'coupon_code',c.code);
 end if;
 select d.* into a from public.admin_discount_codes d join public.admin_discount_claims x on x.code_id=d.id
 where x.user_id=p_user_id and upper(d.code)=upper(trim(p_code)) and x.used_at is null
   and (d.expires_at is null or d.expires_at>now())
   and not exists(select 1 from public.admin_discount_reservations r where r.claim_id=x.id and r.state='reserved')
 for update of d,x;
 if not found then return jsonb_build_object('ok',false,'reason','Kode diskon tidak ditemukan, expired, atau sudah digunakan'); end if;
 v_scope:=case when v_purpose='vip' then 'vip_account' when v_purpose='vip_group' then 'vip_group' when v_purpose='review_download' then 'telegram_review' else 'invalid' end;
 if a.scope not in ('all',v_scope) then return jsonb_build_object('ok',false,'reason','Kode diskon ini tidak berlaku untuk jenis pembelian tersebut'); end if;
 if v_base<a.min_purchase then return jsonb_build_object('ok',false,'reason','Minimal pembelian kode ini belum terpenuhi'); end if;
 select x.* into cl from public.admin_discount_claims x where x.user_id=p_user_id and x.code_id=a.id and x.used_at is null for update;
 insert into public.admin_discount_reservations(order_id,claim_id,code_id,user_id,state) values(p_order_id,cl.id,a.id,p_user_id,'reserved');
 update public.cashi_orders set coupon_code=a.code where order_id=p_order_id and user_id=p_user_id;
 return jsonb_build_object('ok',true,'discount_percent',a.discount_percent,'coupon_code',a.code);
end $$;
revoke all on function public.reserve_referral_coupon(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_referral_coupon(uuid,text,text) to service_role;

-- Update claim RPC response with scope for member-facing display.
create or replace function public.claim_admin_discount(p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.admin_discount_codes%rowtype; v_id uuid;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select * into c from public.admin_discount_codes where upper(code)=upper(trim(p_code)) for update;
 if not found then return jsonb_build_object('ok',false,'reason','CODE_NOT_FOUND'); end if;
 if c.expires_at is not null and c.expires_at<=now() then return jsonb_build_object('ok',false,'reason','EXPIRED'); end if;
 if c.claimed_count>=c.claim_limit then return jsonb_build_object('ok',false,'reason','CLAIM_LIMIT'); end if;
 if exists(select 1 from public.admin_discount_claims where code_id=c.id and user_id=auth.uid()) then return jsonb_build_object('ok',false,'reason','ALREADY_CLAIMED'); end if;
 insert into public.admin_discount_claims(code_id,user_id) values(c.id,auth.uid()) returning id into v_id;
 update public.admin_discount_codes set claimed_count=claimed_count+1 where id=c.id;
 return jsonb_build_object('ok',true,'claim_id',v_id,'code',c.code,'scope',c.scope,'discount_percent',c.discount_percent,'min_purchase',c.min_purchase,'expires_at',c.expires_at);
end $$;
revoke all on function public.claim_admin_discount(text) from public,anon;
grant execute on function public.claim_admin_discount(text) to authenticated;
