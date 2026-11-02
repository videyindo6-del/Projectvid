-- BoxCell Videy videos. Safe to re-run.
do $$ begin create type public.content_access as enum ('public','vip'); exception when duplicate_object then null; end $$;
create table if not exists public.videos (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 provider text not null default 'Custom',
 embed_url text not null,
 download_url text,
 access public.content_access not null default 'public',
 download_enabled boolean not null default false,
 category_id uuid references public.categories(id) on delete set null,
 server_id uuid references public.servers(id) on delete set null,
 status public.publish_status not null default 'draft',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.videos add column if not exists provider text not null default 'Custom';
alter table public.videos add column if not exists embed_url text;
alter table public.videos add column if not exists download_url text;
alter table public.videos add column if not exists access public.content_access not null default 'public';
alter table public.videos add column if not exists download_enabled boolean not null default false;
alter table public.videos add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.videos add column if not exists server_id uuid references public.servers(id) on delete set null;
alter table public.videos add column if not exists status public.publish_status not null default 'draft';
alter table public.videos add column if not exists created_at timestamptz not null default now();
alter table public.videos add column if not exists updated_at timestamptz not null default now();
alter table public.videos enable row level security;
drop policy if exists "published videos" on public.videos;\ndrop policy if exists "published public or active vip videos" on public.videos;
drop policy if exists "admin videos" on public.videos;
create policy "published public or active vip videos" on public.videos for select using (
 public.is_admin() or (status='published' and (
  access='public' or (auth.uid() is not null and exists(
   select 1 from public.profiles p where p.id=auth.uid() and p.vip_expires_at>now()
  ))
 ))
);
create policy "admin videos" on public.videos for all using(public.is_admin()) with check(public.is_admin());
grant select on public.videos to anon,authenticated;
grant insert,update,delete on public.videos to authenticated;
