-- BoxCellink: presence member dan pengunjung
-- Jalankan sekali di Supabase SQL Editor setelah schema utama/admin_features.
create table if not exists public.site_presence (
  visitor_key text primary key,
  user_id uuid references auth.users(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists site_presence_last_seen_idx on public.site_presence(last_seen_at desc);
create index if not exists site_presence_user_last_seen_idx on public.site_presence(user_id,last_seen_at desc);
alter table public.site_presence enable row level security;
-- Tidak ada policy baca/tulis langsung. Semua operasi dilakukan lewat RPC SECURITY DEFINER.

create or replace function public.heartbeat_site_presence(p_visitor_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user_id uuid := auth.uid();
begin
  if p_visitor_key is null or p_visitor_key !~ '^[A-Za-z0-9_-]{16,80}$' then
    raise exception 'Invalid visitor key';
  end if;

  insert into public.site_presence(visitor_key,user_id,last_seen_at)
  values(p_visitor_key,v_user_id,now())
  on conflict(visitor_key) do update
    set user_id=excluded.user_id,last_seen_at=now();

  if v_user_id is not null then
    update public.profiles set last_seen_at=now() where id=v_user_id;
  end if;

  delete from public.site_presence where last_seen_at < now() - interval '30 days';
  return jsonb_build_object('ok',true,'authenticated',v_user_id is not null);
end;
$$;
revoke all on function public.heartbeat_site_presence(text) from public;
grant execute on function public.heartbeat_site_presence(text) to anon, authenticated;

create or replace function public.get_admin_presence_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_registered bigint;
  v_online_members bigint;
  v_guest_online bigint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.is_banned,false)=false
  ) then
    raise exception 'Admin access required';
  end if;

  select count(*) into v_registered from public.profiles where role='user';
  select count(distinct sp.user_id) into v_online_members
    from public.site_presence sp
    join public.profiles p on p.id=sp.user_id
    where sp.user_id is not null and p.role='user' and coalesce(p.is_banned,false)=false and sp.last_seen_at >= now()-interval '2 minutes';
  select count(*) into v_guest_online
    from public.site_presence sp
    where sp.user_id is null and sp.last_seen_at >= now()-interval '2 minutes';

  return jsonb_build_object(
    'registered_members',v_registered,
    'online_members',v_online_members,
    'guest_online',v_guest_online,
    'total_online',v_online_members+v_guest_online,
    'online_window_seconds',120
  );
end;
$$;
revoke all on function public.get_admin_presence_stats() from public, anon;
grant execute on function public.get_admin_presence_stats() to authenticated;
