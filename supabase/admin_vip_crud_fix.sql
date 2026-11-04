-- ProjectVID / BoxCellink: repair admin CRUD for VIP, Group VIP and discount management.
-- Run AFTER admin_vip_discount_management.sql and vip_group_secret_hardening.sql.
-- Safe to run more than once.

-- Ensure authenticated users can reach the tables; RLS below limits writes to admins.
grant usage on schema public to authenticated;

alter table public.vip_plans enable row level security;
drop policy if exists "published plans" on public.vip_plans;
create policy "published plans" on public.vip_plans
  for select to anon, authenticated using (status='published' or public.is_admin());
drop policy if exists "admin plans" on public.vip_plans;
create policy "admin plans" on public.vip_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.vip_plans to authenticated;

alter table public.vip_groups enable row level security;
drop policy if exists "public vip groups" on public.vip_groups;
create policy "public vip groups" on public.vip_groups
  for select to anon, authenticated using (status='published' or public.is_admin());
drop policy if exists "admin vip groups" on public.vip_groups;
create policy "admin vip groups" on public.vip_groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Do not grant access to the legacy telegram_url column. The invite is stored privately.
grant select (id,name,description,price,member_count,status,created_at) on public.vip_groups to anon, authenticated;
grant insert (name,description,price,member_count,status) on public.vip_groups to authenticated;
grant update (name,description,price,member_count,status) on public.vip_groups to authenticated;
grant delete on public.vip_groups to authenticated;

alter table public.admin_discount_codes enable row level security;
drop policy if exists "admin discount codes" on public.admin_discount_codes;
create policy "admin discount codes" on public.admin_discount_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.admin_discount_codes to authenticated;

create table if not exists public.vip_group_secrets (
  group_id uuid primary key references public.vip_groups(id) on delete cascade,
  telegram_url text not null,
  updated_at timestamptz not null default now()
);
alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets" on public.vip_group_secrets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.vip_group_secrets to authenticated;

-- Keep the admin role check callable by authenticated sessions.
grant execute on function public.is_admin() to authenticated;
