-- BoxCellink: pemulihan kata sandi tanpa OTP menggunakan kode rahasia.
-- Jalankan sekali di Supabase SQL Editor sebelum deploy.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.account_recovery_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recovery_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.account_recovery_keys enable row level security;
revoke all on public.account_recovery_keys from anon, authenticated;

create or replace function public.set_my_recovery_code(p_recovery_code text)
returns boolean language plpgsql security definer set search_path = public, auth, extensions as $$
declare uid uuid := auth.uid();
begin
  if uid is null or length(coalesce(p_recovery_code,'')) < 16 then return false; end if;
  insert into public.account_recovery_keys(user_id,recovery_hash,failed_attempts,locked_until,updated_at)
  values(uid, extensions.crypt(upper(p_recovery_code), extensions.gen_salt('bf')),0,null,now())
  on conflict(user_id) do update set recovery_hash=excluded.recovery_hash,failed_attempts=0,locked_until=null,updated_at=now();
  return true;
end; $$;
revoke all on function public.set_my_recovery_code(text) from public;
grant execute on function public.set_my_recovery_code(text) to authenticated;

create or replace function public.reset_password_with_recovery(p_email text,p_recovery_code text,p_new_password text)
returns text language plpgsql security definer set search_path = public, auth, extensions as $$
declare target_id uuid; stored_hash text; attempts integer; blocked timestamptz;
begin
  if length(coalesce(p_new_password,'')) < 8 then return 'weak_password'; end if;
  select id into target_id from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if target_id is null then return 'not_found'; end if;
  select recovery_hash,failed_attempts,locked_until into stored_hash,attempts,blocked from public.account_recovery_keys where user_id=target_id for update;
  if stored_hash is null then return 'invalid_code'; end if;
  if blocked is not null and blocked > now() then return 'too_many_attempts'; end if;
  if stored_hash <> extensions.crypt(upper(trim(coalesce(p_recovery_code,''))),stored_hash) then
    update public.account_recovery_keys set failed_attempts=coalesce(attempts,0)+1,
      locked_until=case when coalesce(attempts,0)+1 >= 8 then now()+interval '30 minutes' else null end,
      updated_at=now() where user_id=target_id;
    return case when coalesce(attempts,0)+1 >= 8 then 'too_many_attempts' else 'invalid_code' end;
  end if;
  update auth.users set encrypted_password=extensions.crypt(p_new_password,extensions.gen_salt('bf')),updated_at=now() where id=target_id;
  update public.account_recovery_keys set failed_attempts=0,locked_until=null,updated_at=now() where user_id=target_id;
  return 'ok';
end; $$;
revoke all on function public.reset_password_with_recovery(text,text,text) from public;
grant execute on function public.reset_password_with_recovery(text,text,text) to anon, authenticated;
