-- BoxCellink VIP Groups: profile access uses the latest admin-managed invite URL.
-- Run this migration in Supabase SQL Editor after vip_group_secret_hardening.sql.
begin;

create table if not exists public.vip_group_secrets(
  group_id uuid primary key references public.vip_groups(id) on delete cascade,
  telegram_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.vip_group_entitlements
  add column if not exists invite_expires_at timestamptz;

alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets"
  on public.vip_group_secrets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.vip_group_secrets from anon, authenticated;
grant select, insert, update, delete on public.vip_group_secrets to authenticated;

-- Return purchase history to its owner, but resolve the current invitation URL
-- from the admin-managed secret table. Updating a banned/replaced group link
-- therefore updates the link shown to every existing purchaser without another
-- payment. Telegram itself controls whether that invitation is still valid.
create or replace function public.get_my_vip_group_entitlements()
returns table(
  entitlement_id uuid,
  group_id uuid,
  group_name text,
  purchased_at timestamptz,
  invite_expires_at timestamptz,
  telegram_url text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    e.id,
    e.group_id,
    g.name,
    e.created_at,
    e.invite_expires_at,
    coalesce(nullif(s.telegram_url,''), e.telegram_url)
  from public.vip_group_entitlements e
  join public.vip_groups g on g.id=e.group_id
  left join public.vip_group_secrets s on s.group_id=e.group_id
  where e.user_id=auth.uid()
  order by e.created_at desc;
$$;

revoke all on function public.get_my_vip_group_entitlements() from public, anon;
grant execute on function public.get_my_vip_group_entitlements() to authenticated;

commit;
