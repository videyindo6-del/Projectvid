-- BoxCellink unified withdrawal v1
-- Run AFTER BoxCellink-affiliate-wallet-notifications-FIXED.sql,
-- boxcellink_wallet_withdraw_v2.sql and autolink_publisher_monetization_v1.sql.
begin;

create table if not exists public.indonesia_public_holidays(
 holiday_date date primary key,
 holiday_name text not null,
 source text default 'Nager.Date',
 updated_at timestamptz not null default now()
);
alter table public.indonesia_public_holidays enable row level security;
drop policy if exists "Public can read Indonesia holidays" on public.indonesia_public_holidays;
create policy "Public can read Indonesia holidays" on public.indonesia_public_holidays for select to anon,authenticated using(true);

create table if not exists public.withdrawal_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 amount bigint not null check(amount>=100000),
 fee_amount bigint not null,
 net_amount bigint not null,
 affiliate_reserved bigint not null default 0,
 publisher_reserved bigint not null default 0,
 payout_method text not null check(payout_method in ('bank','ewallet')),
 payout_provider text not null,
 payout_account_number text not null,
 payout_account_holder text not null,
 status text not null default 'pending' check(status in ('pending','processing','rejected','success')),
 admin_note text,
 processed_by uuid references auth.users(id),
 processed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists withdrawal_requests_user_created_idx on public.withdrawal_requests(user_id,created_at desc);
create index if not exists withdrawal_requests_status_created_idx on public.withdrawal_requests(status,created_at desc);
create table if not exists public.withdrawal_telegram_events(
 id uuid not null references public.withdrawal_requests(id) on delete cascade,
 event text not null check(event in ('requested','processing','rejected','success')),
 sent_at timestamptz not null default now(),
 primary key(id,event)
);
revoke all on public.withdrawal_telegram_events from public,anon,authenticated;
alter table public.withdrawal_requests enable row level security;
drop policy if exists "Users read own withdrawal requests" on public.withdrawal_requests;
create policy "Users read own withdrawal requests" on public.withdrawal_requests for select to authenticated using(user_id=auth.uid() or public.is_admin());
grant select on public.withdrawal_requests to authenticated;
revoke insert,update,delete on public.withdrawal_requests from anon,authenticated;
grant select on public.indonesia_public_holidays to anon,authenticated;
grant all on public.withdrawal_telegram_events to service_role;

drop function if exists public.get_withdrawable_balances();
create function public.get_withdrawable_balances() returns jsonb
language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); a bigint; p bigint;
begin
 if u is null then raise exception 'LOGIN_REQUIRED'; end if;
 select coalesce(affiliate_balance,0) into a from public.profiles where id=u;
 select coalesce(available_balance,0) into p from public.publisher_balances where publisher_id=u;
 return jsonb_build_object('affiliate_balance',coalesce(a,0),'publisher_balance',coalesce(p,0),'total',coalesce(a,0)+coalesce(p,0));
end $$;
revoke all on function public.get_withdrawable_balances() from public,anon;
grant execute on function public.get_withdrawable_balances() to authenticated;

create or replace function public.get_withdrawal_schedule() returns jsonb
language plpgsql security definer set search_path=public as $$
declare local_now timestamp:=timezone('Asia/Jakarta',now()); d date:=local_now::date; dow int:=extract(dow from local_now); tm time:=local_now::time; holiday text;
begin
 select holiday_name into holiday from public.indonesia_public_holidays where holiday_date=d;
 if holiday is not null then return jsonb_build_object('open',false,'reason','holiday','holiday_name',holiday,'local_date',d); end if;
 if dow in (0,6) then return jsonb_build_object('open',false,'reason','weekend','local_date',d); end if;
 if tm<time '08:00' or tm>=time '21:00' then return jsonb_build_object('open',false,'reason','hours','local_date',d); end if;
 return jsonb_build_object('open',true,'reason','open','local_date',d);
end $$;
revoke all on function public.get_withdrawal_schedule() from public;
grant execute on function public.get_withdrawal_schedule() to anon,authenticated;

create or replace function public.update_affiliate_payout_v2(p_method text,p_provider text,p_account_number text,p_account_holder text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 if coalesce(p_method,'') not in ('bank','ewallet') or length(trim(coalesce(p_provider,'')))<2 or length(trim(coalesce(p_account_number,'')))<5 or length(trim(coalesce(p_account_holder,'')))<3 then return jsonb_build_object('ok',false,'reason','DATA_INVALID'); end if;
 perform set_config('boxcellink.internal_write','on',true);
 update public.profiles set payout_method=p_method,payout_provider=trim(p_provider),payout_account_number=trim(p_account_number),payout_account_holder=trim(p_account_holder),payout_full_name=trim(p_account_holder) where id=auth.uid();
 if not found then return jsonb_build_object('ok',false,'reason','PROFILE_NOT_FOUND'); end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.update_affiliate_payout_v2(text,text,text,text) from public,anon;
grant execute on function public.update_affiliate_payout_v2(text,text,text,text) to authenticated;

create or replace function public.request_withdrawal_v1(p_amount bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); p public.profiles%rowtype; pub bigint:=0; a bigint:=0; take_a bigint:=0; take_p bigint:=0; fee bigint; net bigint; wid uuid; sched jsonb;
begin
 if u is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 sched:=public.get_withdrawal_schedule(); if not coalesce((sched->>'open')::boolean,false) then return jsonb_build_object('ok',false,'reason','WITHDRAWAL_CLOSED','schedule',sched); end if;
 if p_amount is null or p_amount<100000 then return jsonb_build_object('ok',false,'reason','MINIMUM_100000'); end if;
 select * into p from public.profiles where id=u for update;
 if not found then return jsonb_build_object('ok',false,'reason','PROFILE_NOT_FOUND'); end if;
 if nullif(trim(p.payout_account_number),'') is null or nullif(trim(p.payout_account_holder),'') is null or nullif(trim(p.payout_provider),'') is null or coalesce(p.payout_method,'') not in ('bank','ewallet') then return jsonb_build_object('ok',false,'reason','PAYOUT_PROFILE_MISSING'); end if;
 insert into public.publisher_balances(publisher_id) values(u) on conflict do nothing;
 select coalesce(available_balance,0) into pub from public.publisher_balances where publisher_id=u for update;
 a:=coalesce(p.affiliate_balance,0);
 if p_amount>a+pub then return jsonb_build_object('ok',false,'reason','INSUFFICIENT_BALANCE'); end if;
 -- Reserve affiliate earnings first, then AutoLink publisher earnings.
 take_a:=least(a,p_amount); take_p:=p_amount-take_a;
 fee:=10000; net:=p_amount-fee;
 if net<=0 then return jsonb_build_object('ok',false,'reason','NET_AMOUNT_INVALID'); end if;
 perform set_config('boxcellink.internal_write','on',true);
 update public.profiles set affiliate_balance=affiliate_balance-take_a where id=u;
 update public.publisher_balances set available_balance=available_balance-take_p,pending_withdrawal=pending_withdrawal+take_p,updated_at=now() where publisher_id=u;
 insert into public.withdrawal_requests(user_id,amount,fee_amount,net_amount,affiliate_reserved,publisher_reserved,payout_method,payout_provider,payout_account_number,payout_account_holder)
 values(u,p_amount,fee,net,take_a,take_p,p.payout_method,p.payout_provider,p.payout_account_number,p.payout_account_holder) returning id into wid;
 if take_a>0 then insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description) values(u,'affiliate',-take_a,'withdraw_reserve',wid::text,'Saldo afiliasi ditahan untuk withdrawal'); end if;
 if take_p>0 then insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description) values(u,'withdraw_reserve',-take_p,'WITHDRAW:'||wid::text,'Saldo AutoLink ditahan untuk withdrawal'); end if;
 insert into public.boxcellink_notifications(user_id,title,body,kind,href) values(u,'Pengajuan withdrawal diterima','Pengajuan withdrawal '||wid::text||' sedang menunggu pemeriksaan admin.','withdrawal','/withdraw.html');
 insert into public.boxcellink_notifications(user_id,title,body,kind,href) select id,'Pengajuan withdrawal baru','Ada pengajuan withdrawal '||wid::text||' yang perlu diproses.','withdrawal_admin','/admin-publisher-withdraw.html' from public.profiles where role='admin';
 return jsonb_build_object('ok',true,'withdrawal_id',wid,'amount',p_amount,'fee_amount',fee,'net_amount',net,'affiliate_reserved',take_a,'publisher_reserved',take_p);
end $$;
revoke all on function public.request_withdrawal_v1(bigint) from public,anon;
grant execute on function public.request_withdrawal_v1(bigint) to authenticated;

create or replace function public.admin_update_withdrawal_v1(p_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.withdrawal_requests%rowtype;
begin
 if not public.is_admin() then return jsonb_build_object('ok',false,'reason','ADMIN_REQUIRED'); end if;
 if p_status not in ('processing','success','rejected') then return jsonb_build_object('ok',false,'reason','STATUS_INVALID'); end if;
 if p_status in ('success','rejected') and nullif(trim(coalesce(p_note,'')),'') is null then return jsonb_build_object('ok',false,'reason','ADMIN_NOTE_REQUIRED'); end if;
 select * into w from public.withdrawal_requests where id=p_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','NOT_FOUND'); end if;
 if w.status in ('success','rejected') then return jsonb_build_object('ok',false,'reason','ALREADY_FINAL'); end if;
 if p_status='rejected' then
  perform set_config('boxcellink.internal_write','on',true);
  if w.affiliate_reserved>0 then update public.profiles set affiliate_balance=affiliate_balance+w.affiliate_reserved where id=w.user_id; insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description) values(w.user_id,'affiliate',w.affiliate_reserved,'withdraw_refund',w.id::text,'Saldo afiliasi dikembalikan karena withdrawal ditolak'); end if;
  if w.publisher_reserved>0 then update public.publisher_balances set pending_withdrawal=pending_withdrawal-w.publisher_reserved,available_balance=available_balance+w.publisher_reserved,updated_at=now() where publisher_id=w.user_id; insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description) values(w.user_id,'withdraw_release',w.publisher_reserved,'WITHDRAWRELEASE:'||w.id::text,'Saldo AutoLink dikembalikan karena withdrawal ditolak'); end if;
 elsif p_status='success' then
  if w.publisher_reserved>0 then update public.publisher_balances set pending_withdrawal=pending_withdrawal-w.publisher_reserved,withdrawn_total=withdrawn_total+w.publisher_reserved,updated_at=now() where publisher_id=w.user_id; insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description) values(w.user_id,'withdraw_paid',-w.publisher_reserved,'WITHDRAWPAID:'||w.id::text,'Withdrawal AutoLink berhasil dibayar'); end if;
 end if;
 update public.withdrawal_requests set status=p_status,admin_note=nullif(trim(coalesce(p_note,'')),''),processed_by=auth.uid(),processed_at=case when p_status in ('success','rejected') then now() else processed_at end where id=p_id;
 insert into public.boxcellink_notifications(user_id,title,body,kind,href) values(w.user_id,case p_status when 'processing' then 'Withdrawal diproses' when 'rejected' then 'Withdrawal ditolak' else 'Withdrawal berhasil' end,case p_status when 'processing' then coalesce(nullif(trim(p_note),''),'Permintaan withdrawal sedang diproses.') when 'rejected' then 'Withdrawal ditolak. Alasan: '||trim(p_note)||' Saldo telah dikembalikan.' else trim(p_note) end,'withdrawal','/withdraw.html');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_update_withdrawal_v1(uuid,text,text) from public,anon;
grant execute on function public.admin_update_withdrawal_v1(uuid,text,text) to authenticated;
commit;
