-- BoxCellink VIP manager CRUD + private Telegram invite links
-- Run in Supabase SQL Editor. Safe to re-run.
grant usage on schema public to authenticated;
alter table public.vip_plans enable row level security;
drop policy if exists "published plans" on public.vip_plans;
create policy "published plans" on public.vip_plans for select to anon,authenticated using(status='published' or public.is_admin());
drop policy if exists "admin plans" on public.vip_plans;
create policy "admin plans" on public.vip_plans for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.vip_plans to authenticated;
alter table public.vip_groups enable row level security;
drop policy if exists "public vip groups" on public.vip_groups;
create policy "public vip groups" on public.vip_groups for select to anon,authenticated using(status='published' or public.is_admin());
drop policy if exists "admin vip groups" on public.vip_groups;
create policy "admin vip groups" on public.vip_groups for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select(id,name,description,price,member_count,status,created_at) on public.vip_groups to anon,authenticated;
grant insert(name,description,price,member_count,status) on public.vip_groups to authenticated;
grant update(name,description,price,member_count,status) on public.vip_groups to authenticated;
grant delete on public.vip_groups to authenticated;
create table if not exists public.vip_group_secrets(group_id uuid primary key references public.vip_groups(id) on delete cascade,telegram_url text not null,updated_at timestamptz not null default now());
alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets" on public.vip_group_secrets for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update,delete on public.vip_group_secrets to authenticated;
revoke all on public.vip_group_secrets from anon;
grant execute on function public.is_admin() to authenticated;
