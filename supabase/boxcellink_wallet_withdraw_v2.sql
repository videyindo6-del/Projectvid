-- BoxCellink wallet/affiliate payout expansion (safe additive migration).
-- Run AFTER BoxCellink-affiliate-wallet-notifications-FIXED.sql.
begin;

alter table public.profiles
  add column if not exists payout_provider text,
  add column if not exists payout_account_holder text,
  add column if not exists payout_village text,
  add column if not exists payout_district text,
  add column if not exists payout_regency text,
  add column if not exists payout_province text,
  add column if not exists payout_phone text;

alter table public.affiliate_applications
  add column if not exists phone text,
  add column if not exists village text,
  add column if not exists district text,
  add column if not exists regency text,
  add column if not exists province text,
  add column if not exists payout_provider text,
  add column if not exists payout_account_holder text;

alter table public.affiliate_withdrawals drop constraint if exists affiliate_withdrawals_status_check;
alter table public.affiliate_withdrawals add constraint affiliate_withdrawals_status_check check(status in ('pending','processing','revision','rejected','success'));

alter table public.affiliate_withdrawals
  add column if not exists payout_provider text,
  add column if not exists fee_amount bigint not null default 7000,
  add column if not exists net_amount bigint,
  add column if not exists payout_account_holder text,
  add column if not exists payout_address text;

update public.affiliate_withdrawals
set net_amount=greatest(0,amount-coalesce(fee_amount,7000))
where net_amount is null;

create or replace function public.apply_for_affiliate_v2(
 p_full_name text,
 p_phone text,
 p_village text,
 p_district text,
 p_regency text,
 p_province text,
 p_payout_method text,
 p_payout_provider text,
 p_payout_account_number text,
 p_payout_account_holder text,
 p_social jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_address text;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 if length(trim(coalesce(p_full_name,'')))<3
  or length(trim(coalesce(p_village,'')))<2
  or length(trim(coalesce(p_district,'')))<2
  or length(trim(coalesce(p_regency,'')))<2
  or length(trim(coalesce(p_province,'')))<2
  or length(trim(coalesce(p_payout_provider,'')))<2
  or length(trim(coalesce(p_payout_account_number,'')))<5
  or length(trim(coalesce(p_payout_account_holder,'')))<3
  or coalesce(p_payout_method,'') not in ('bank','ewallet')
  or (p_social is not null and jsonb_typeof(p_social)<>'object') then
  return jsonb_build_object('ok',false,'reason','DATA_INVALID');
 end if;
 if exists(select 1 from public.profiles where id=auth.uid() and affiliate_status='approved') then
  return jsonb_build_object('ok',false,'reason','ALREADY_AFFILIATE');
 end if;
 if exists(select 1 from public.affiliate_applications where user_id=auth.uid() and status='pending') then
  return jsonb_build_object('ok',false,'reason','APPLICATION_PENDING');
 end if;
 v_address:=concat_ws(', ',trim(p_village),trim(p_district),trim(p_regency),trim(p_province));
 perform set_config('boxcellink.internal_write','on',true);
 insert into public.affiliate_applications(user_id,full_name,full_address,payout_method,payout_account_number,social_links,phone,village,district,regency,province,payout_provider,payout_account_holder)
 values(auth.uid(),trim(p_full_name),v_address,p_payout_method,trim(p_payout_account_number),coalesce(p_social,'{}'::jsonb),nullif(trim(coalesce(p_phone,'')),''),trim(p_village),trim(p_district),trim(p_regency),trim(p_province),trim(p_payout_provider),trim(p_payout_account_holder)) returning id into v_id;
 update public.profiles set affiliate_status='pending',payout_full_name=trim(p_full_name),payout_address=v_address,
  payout_method=p_payout_method,payout_account_number=trim(p_payout_account_number),payout_provider=trim(p_payout_provider),
  payout_account_holder=trim(p_payout_account_holder),payout_village=trim(p_village),payout_district=trim(p_district),
  payout_regency=trim(p_regency),payout_province=trim(p_province),payout_phone=nullif(trim(coalesce(p_phone,'')),'')
 where id=auth.uid();
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 select id,'Pengajuan affiliate baru','Ada pengajuan affiliate baru yang menunggu pemeriksaan.','affiliate_admin','/affiliate-admin.html' from public.profiles where role='admin';
 return jsonb_build_object('ok',true,'application_id',v_id);
end $$;
revoke all on function public.apply_for_affiliate_v2(text,text,text,text,text,text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.apply_for_affiliate_v2(text,text,text,text,text,text,text,text,text,text,jsonb) to authenticated;

create or replace function public.update_affiliate_payout_v2(p_method text,p_provider text,p_account_number text,p_account_holder text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 if p_method not in ('bank','ewallet') or length(trim(coalesce(p_provider,'')))<2
  or length(trim(coalesce(p_account_number,'')))<5 or length(trim(coalesce(p_account_holder,'')))<3 then
  return jsonb_build_object('ok',false,'reason','DATA_INVALID');
 end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and affiliate_status='approved') then
  return jsonb_build_object('ok',false,'reason','AFFILIATE_NOT_APPROVED');
 end if;
 perform set_config('boxcellink.internal_write','on',true);
 update public.profiles set payout_method=p_method,payout_provider=trim(p_provider),payout_account_number=trim(p_account_number),payout_account_holder=trim(p_account_holder) where id=auth.uid();
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.update_affiliate_payout_v2(text,text,text,text) from public,anon;
grant execute on function public.update_affiliate_payout_v2(text,text,text,text) to authenticated;

-- Fee is fixed at Rp7,000 per withdrawal. The gross amount is reserved atomically;
-- rejection refunds the full gross amount using the existing admin RPC.
create or replace function public.request_affiliate_withdrawal_v2(p_amount bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; v_id uuid; v_fee bigint:=7000; v_net bigint;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select * into p from public.profiles where id=auth.uid() for update;
 if not found or p.affiliate_status<>'approved' then return jsonb_build_object('ok',false,'reason','AFFILIATE_NOT_APPROVED'); end if;
 if p_amount is null or p_amount<10000 or p_amount>p.affiliate_balance then
  return jsonb_build_object('ok',false,'reason','BALANCE_OR_MINIMUM_INVALID');
 end if;
 if p_amount<=v_fee then return jsonb_build_object('ok',false,'reason','AMOUNT_MUST_EXCEED_PLATFORM_FEE'); end if;
 if nullif(btrim(p.payout_account_number),'') is null
  or nullif(btrim(p.payout_account_holder),'') is null
  or nullif(btrim(p.payout_provider),'') is null
  or coalesce(p.payout_method,'') not in ('bank','ewallet') then
  return jsonb_build_object('ok',false,'reason','PAYOUT_PROFILE_MISSING');
 end if;
 v_net:=p_amount-v_fee;
 perform set_config('boxcellink.internal_write','on',true);
 update public.profiles set affiliate_balance=affiliate_balance-p_amount where id=auth.uid();
 insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,description)
 values(auth.uid(),'affiliate',-p_amount,'withdraw_reserve','Saldo ditahan untuk pengajuan withdraw');
 insert into public.affiliate_withdrawals(user_id,amount,fee_amount,net_amount,payout_method,payout_provider,payout_account_number,payout_full_name,payout_account_holder,payout_address)
 values(auth.uid(),p_amount,v_fee,v_net,p.payout_method,p.payout_provider,p.payout_account_number,coalesce(p.payout_full_name,p.full_name),p.payout_account_holder,p.payout_address)
 returning id into v_id;
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 values(auth.uid(),'Pengajuan withdraw diterima','Pengajuan withdraw '+v_id::text+' sedang menunggu pemeriksaan admin.','withdrawal','/wallet.html');
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 select id,'Pengajuan withdraw baru','Ada pengajuan withdraw '+v_id::text+' yang perlu diproses.','withdrawal_admin','/affiliate-admin.html' from public.profiles where role='admin';
 return jsonb_build_object('ok',true,'withdrawal_id',v_id,'amount',p_amount,'fee_amount',v_fee,'net_amount',v_net);
end $$;
revoke all on function public.request_affiliate_withdrawal_v2(bigint) from public,anon;
grant execute on function public.request_affiliate_withdrawal_v2(bigint) to authenticated;

create or replace function public.admin_process_affiliate_withdrawal_v2(p_withdrawal_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.affiliate_withdrawals%rowtype; v_title text; v_body text;
begin
 if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
 if p_status not in ('processing','revision','rejected','success') then raise exception 'STATUS_INVALID'; end if;
 if p_status in ('revision','rejected') and nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'ADMIN_NOTE_REQUIRED'; end if;
 select * into w from public.affiliate_withdrawals where id=p_withdrawal_id for update;
 if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
 if w.status in ('rejected','success') then raise exception 'WITHDRAWAL_ALREADY_FINAL'; end if;
 if p_status in ('revision','rejected') and w.status not in ('pending','processing','revision') then raise exception 'WITHDRAWAL_STATE_INVALID'; end if;
 if p_status in ('revision','rejected') and w.status<>'revision' then
  perform set_config('boxcellink.internal_write','on',true);
  update public.profiles set affiliate_balance=affiliate_balance+w.amount where id=w.user_id;
  insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
   values(w.user_id,'affiliate',w.amount,case when p_status='revision' then 'withdraw_revision_refund' else 'withdraw_refund' end,w.id::text,case when p_status='revision' then 'Saldo dikembalikan untuk perbaikan data withdraw' else 'Saldo dikembalikan karena withdraw ditolak' end);
 end if;
 update public.affiliate_withdrawals set status=p_status,admin_note=nullif(trim(coalesce(p_note,'')),''),processed_by=auth.uid(),processed_at=now() where id=w.id;
 v_title:=case p_status when 'processing' then 'Withdraw sedang diproses' when 'revision' then 'Withdraw perlu diperbaiki' when 'rejected' then 'Withdraw ditolak' else 'Withdraw berhasil' end;
 v_body:=case p_status when 'processing' then 'Permintaan withdraw sedang diproses admin.' when 'revision' then 'Pengajuan withdraw dikembalikan. Alasan: '||trim(p_note)||' Saldo sudah dikembalikan ke wallet.' when 'rejected' then 'Withdraw ditolak. Alasan: '||trim(p_note)||' Saldo sudah dikembalikan ke wallet.' else 'Withdraw telah ditandai berhasil oleh admin. Dana diterima sesuai rincian pengajuan.' end;
 insert into public.boxcellink_notifications(user_id,title,body,kind,href) values(w.user_id,v_title,v_body,'withdrawal','/wallet.html');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_process_affiliate_withdrawal_v2(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_process_affiliate_withdrawal_v2(uuid,text,text) to authenticated;

commit;

begin;

-- Video Share-to-Earn: only native HTML5 video playback can report play state.
-- One Rp2 reward per viewer/referrer/video pair, credited to affiliate_balance.
create table if not exists public.video_watch_earning_sessions(
 id uuid primary key default gen_random_uuid(),
 referrer_id uuid not null references auth.users(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 video_id uuid not null references public.videos(id) on delete cascade,
 started_at timestamptz not null default now(),
 rewarded_at timestamptz,
 created_at timestamptz not null default now(),
 unique(referrer_id,viewer_id,video_id)
);
alter table public.video_watch_earning_sessions enable row level security;
revoke all on public.video_watch_earning_sessions from anon,authenticated;

create or replace function public.start_video_watch_earning(p_video_id uuid,p_referral_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_referrer uuid; v_session public.video_watch_earning_sessions%rowtype;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select id into v_referrer from public.profiles where upper(referral_code)=upper(trim(coalesce(p_referral_code,''))) and affiliate_status='approved' limit 1;
 if v_referrer is null or v_referrer=auth.uid() then return jsonb_build_object('ok',false,'reason','REFERRAL_INVALID'); end if;
 if not exists(select 1 from public.videos where id=p_video_id and status='published') then return jsonb_build_object('ok',false,'reason','VIDEO_UNAVAILABLE'); end if;
 insert into public.video_watch_earning_sessions(referrer_id,viewer_id,video_id)
 values(v_referrer,auth.uid(),p_video_id) on conflict(referrer_id,viewer_id,video_id) do nothing;
 select * into v_session from public.video_watch_earning_sessions
 where referrer_id=v_referrer and viewer_id=auth.uid() and video_id=p_video_id;
 return jsonb_build_object('ok',true,'session_id',v_session.id,'rewarded',v_session.rewarded_at is not null);
end $$;
revoke all on function public.start_video_watch_earning(uuid,text) from public,anon;
grant execute on function public.start_video_watch_earning(uuid,text) to authenticated;

create or replace function public.claim_video_watch_earning(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.video_watch_earning_sessions%rowtype;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select * into s from public.video_watch_earning_sessions where id=p_session_id and viewer_id=auth.uid() for update;
 if not found then return jsonb_build_object('ok',false,'reason','SESSION_NOT_FOUND'); end if;
 if s.rewarded_at is not null then return jsonb_build_object('ok',false,'reason','ALREADY_REWARDED'); end if;
 if s.started_at>now()-interval '5 minutes' then return jsonb_build_object('ok',false,'reason','WATCH_TIME_NOT_MET'); end if;
 if not exists(select 1 from public.profiles where id=s.referrer_id and affiliate_status='approved') then return jsonb_build_object('ok',false,'reason','AFFILIATE_INACTIVE'); end if;
 perform set_config('boxcellink.internal_write','on',true);
 update public.profiles set affiliate_balance=affiliate_balance+2 where id=s.referrer_id;
 insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
 values(s.referrer_id,'affiliate',2,'video_watch_earning',s.id::text,'Bonus Share to Earn: video ditonton 5 menit');
 update public.video_watch_earning_sessions set rewarded_at=now() where id=s.id;
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 values(s.referrer_id,'Bonus video berhasil','Kamu menerima bonus Rp2 dari penonton yang menyelesaikan 5 menit video.','affiliate','/wallet.html');
 return jsonb_build_object('ok',true,'amount',2);
end $$;
revoke all on function public.claim_video_watch_earning(uuid) from public,anon;
grant execute on function public.claim_video_watch_earning(uuid) to authenticated;

commit;
