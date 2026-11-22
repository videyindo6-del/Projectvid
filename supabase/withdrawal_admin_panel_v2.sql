-- BoxCellink Withdrawal Admin Panel V2
-- Run AFTER supabase/withdrawal_unified_v1.sql and boxcellink_wallet_withdraw_v2.sql.
-- Admin notifications include member + amount + payout destination.
-- Admin may leave the process/rejection/success note blank.
begin;

create or replace function public.request_withdrawal_v1(p_amount bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 u uuid:=auth.uid(); p public.profiles%rowtype; pub bigint:=0; a bigint:=0;
 take_a bigint:=0; take_p bigint:=0; fee bigint; net bigint; wid uuid; sched jsonb;
 v_username text; v_member_name text; v_body text; v_method text;
begin
 if u is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 sched:=public.get_withdrawal_schedule();
 if not coalesce((sched->>'open')::boolean,false) then return jsonb_build_object('ok',false,'reason','WITHDRAWAL_CLOSED','schedule',sched); end if;
 if p_amount is null or p_amount<100000 then return jsonb_build_object('ok',false,'reason','MINIMUM_100000'); end if;
 select * into p from public.profiles where id=u for update;
 if not found then return jsonb_build_object('ok',false,'reason','PROFILE_NOT_FOUND'); end if;
 if nullif(trim(p.payout_account_number),'') is null or nullif(trim(p.payout_account_holder),'') is null or nullif(trim(p.payout_provider),'') is null or coalesce(p.payout_method,'') not in ('bank','ewallet') then
  return jsonb_build_object('ok',false,'reason','PAYOUT_PROFILE_MISSING');
 end if;
 insert into public.publisher_balances(publisher_id) values(u) on conflict do nothing;
 select coalesce(available_balance,0) into pub from public.publisher_balances where publisher_id=u for update;
 a:=coalesce(p.affiliate_balance,0);
 if p_amount>a+pub then return jsonb_build_object('ok',false,'reason','INSUFFICIENT_BALANCE'); end if;
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
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 values(u,'Pengajuan withdrawal diterima','Pengajuan withdrawal '||wid::text||' sedang menunggu pemeriksaan admin.','withdrawal','/withdraw.html');
 select coalesce(nullif(trim(username),''),'(tanpa username)'),coalesce(nullif(trim(full_name),''),'Member') into v_username,v_member_name from public.profiles where id=u;
 v_method:=case when p.payout_method='ewallet' then 'E-Wallet' else 'Bank' end;
 v_body:=format('Username: @%s | Nama: %s | Nominal pengajuan: Rp %s | Jenis: %s | Penyedia: %s | Nama rekening: %s | Nomor rekening: %s | ID: %s',v_username,v_member_name,to_char(p_amount,'FM999,999,999,999'),v_method,p.payout_provider,p.payout_account_holder,p.payout_account_number,wid);
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 select id,'Pengajuan withdrawal baru',v_body,'withdrawal_admin','/admin-publisher-withdraw.html' from public.profiles where role='admin';
 return jsonb_build_object('ok',true,'withdrawal_id',wid,'amount',p_amount,'fee_amount',fee,'net_amount',net,'affiliate_reserved',take_a,'publisher_reserved',take_p);
end $$;
revoke all on function public.request_withdrawal_v1(bigint) from public,anon;
grant execute on function public.request_withdrawal_v1(bigint) to authenticated;

create or replace function public.admin_update_withdrawal_v1(p_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.withdrawal_requests%rowtype; v_note text:=nullif(left(trim(coalesce(p_note,'')),1000),''); v_body text;
begin
 if not public.is_admin() then return jsonb_build_object('ok',false,'reason','ADMIN_REQUIRED'); end if;
 if p_status not in ('processing','success','rejected') then return jsonb_build_object('ok',false,'reason','STATUS_INVALID'); end if;
 select * into w from public.withdrawal_requests where id=p_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','NOT_FOUND'); end if;
 if w.status in ('success','rejected') then return jsonb_build_object('ok',false,'reason','ALREADY_FINAL'); end if;
 if p_status='rejected' then
  perform set_config('boxcellink.internal_write','on',true);
  if w.affiliate_reserved>0 then
   update public.profiles set affiliate_balance=affiliate_balance+w.affiliate_reserved where id=w.user_id;
   insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description) values(w.user_id,'affiliate',w.affiliate_reserved,'withdraw_refund',w.id::text,'Saldo afiliasi dikembalikan karena withdrawal ditolak');
  end if;
  if w.publisher_reserved>0 then
   update public.publisher_balances set pending_withdrawal=pending_withdrawal-w.publisher_reserved,available_balance=available_balance+w.publisher_reserved,updated_at=now() where publisher_id=w.user_id;
   insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description) values(w.user_id,'withdraw_release',w.publisher_reserved,'WITHDRAWRELEASE:'||w.id::text,'Saldo AutoLink dikembalikan karena withdrawal ditolak');
  end if;
 elsif p_status='success' and w.publisher_reserved>0 then
  update public.publisher_balances set pending_withdrawal=pending_withdrawal-w.publisher_reserved,withdrawn_total=withdrawn_total+w.publisher_reserved,updated_at=now() where publisher_id=w.user_id;
  insert into public.publisher_transactions(publisher_id,transaction_type,amount,reference_id,description) values(w.user_id,'withdraw_paid',-w.publisher_reserved,'WITHDRAWPAID:'||w.id::text,'Withdrawal AutoLink berhasil dibayar');
 end if;
 update public.withdrawal_requests set status=p_status,admin_note=v_note,processed_by=auth.uid(),processed_at=case when p_status in ('success','rejected') then now() else processed_at end where id=p_id;
 v_body:=case
  when p_status='processing' then coalesce(v_note,'Permintaan withdrawal sedang diproses oleh admin.')
  when p_status='rejected' then 'Withdrawal ditolak.'||case when v_note is not null then ' Alasan: '||v_note else ' Saldo telah dikembalikan ke saldo yang dapat ditarik.' end
  else 'Withdrawal telah ditandai sukses oleh admin.'||case when v_note is not null then ' Keterangan: '||v_note else '' end
 end;
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 values(w.user_id,case p_status when 'processing' then 'Withdrawal diproses' when 'rejected' then 'Withdrawal ditolak' else 'Withdrawal berhasil' end,v_body,'withdrawal','/withdraw.html');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_update_withdrawal_v1(uuid,text,text) from public,anon;
grant execute on function public.admin_update_withdrawal_v1(uuid,text,text) to authenticated;

-- Existing affiliate admin processor required a note for rejection.
-- This replacement keeps the same balance-return behavior but makes notes optional.
create or replace function public.admin_process_affiliate_withdrawal_v2(p_withdrawal_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.affiliate_withdrawals%rowtype; v_title text; v_body text; v_note text:=nullif(left(trim(coalesce(p_note,'')),1000),'');
begin
 if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
 if p_status not in ('processing','revision','rejected','success') then raise exception 'STATUS_INVALID'; end if;
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
 update public.affiliate_withdrawals set status=p_status,admin_note=v_note,processed_by=auth.uid(),processed_at=case when p_status in ('success','rejected') then now() else processed_at end where id=w.id;
 v_title:=case p_status when 'processing' then 'Withdraw sedang diproses' when 'revision' then 'Withdraw perlu diperbaiki' when 'rejected' then 'Withdraw ditolak' else 'Withdraw berhasil' end;
 v_body:=case p_status
  when 'processing' then coalesce(v_note,'Permintaan withdraw sedang diproses admin.')
  when 'revision' then 'Pengajuan withdraw dikembalikan untuk diperbaiki.'||case when v_note is not null then ' Catatan: '||v_note else '' end||' Saldo sudah dikembalikan ke wallet.'
  when 'rejected' then 'Withdraw ditolak.'||case when v_note is not null then ' Alasan: '||v_note else '' end||' Saldo sudah dikembalikan ke wallet.'
  else 'Withdraw telah ditandai berhasil oleh admin.'||case when v_note is not null then ' Keterangan: '||v_note else '' end
 end;
 insert into public.boxcellink_notifications(user_id,title,body,kind,href) values(w.user_id,v_title,v_body,'withdrawal','/wallet.html');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_process_affiliate_withdrawal_v2(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_process_affiliate_withdrawal_v2(uuid,text,text) to authenticated;

commit;
