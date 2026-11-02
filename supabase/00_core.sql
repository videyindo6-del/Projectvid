-- BoxCellink database core. Safe to re-run.
create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('user','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.publish_status as enum ('draft','published','archived'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'user',
  vip_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role public.user_role not null default 'user';
alter table public.profiles add column if not exists vip_expires_at timestamptz;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.categories (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 status public.publish_status not null default 'published', created_at timestamptz not null default now()
);
create table if not exists public.servers (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 type text not null default 'storage', folder_endpoint text,
 status public.publish_status not null default 'published', created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public,auth
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
 insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''))
 on conflict(id) do update set full_name=excluded.full_name;
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.servers enable row level security;

drop policy if exists "profiles own" on public.profiles;\ndrop policy if exists "profiles own or admin read" on public.profiles;
drop policy if exists "profiles admin read" on public.profiles;
drop policy if exists "admin profiles manage" on public.profiles;\ndrop policy if exists "admin profiles update" on public.profiles;
create policy "profiles own or admin read" on public.profiles for select using(auth.uid()=id or public.is_admin());
create policy "admin profiles update" on public.profiles for update using(public.is_admin()) with check(public.is_admin());

drop policy if exists "public categories" on public.categories;
drop policy if exists "admin categories" on public.categories;
create policy "public categories" on public.categories for select using(status='published' or public.is_admin());
create policy "admin categories" on public.categories for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "public servers" on public.servers;
drop policy if exists "admin servers" on public.servers;
create policy "public servers" on public.servers for select using(status='published' or public.is_admin());
create policy "admin servers" on public.servers for all using(public.is_admin()) with check(public.is_admin());

insert into public.categories(name) values('Entertainment'),('Premium') on conflict(name) do nothing;
insert into public.servers(name,type) values('Server 01','storage'),('Telegram A','telegram') on conflict(name) do nothing;

grant usage on schema public to anon, authenticated;
grant select on public.categories,public.servers to anon,authenticated;\ngrant insert,update,delete on public.categories,public.servers to authenticated;
grant select,update on public.profiles to authenticated;
