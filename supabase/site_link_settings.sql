-- BoxCellink: pengaturan link support dan notifikasi per halaman
create table if not exists public.site_link_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_link_settings enable row level security;
drop policy if exists "Public can read site link settings" on public.site_link_settings;
create policy "Public can read site link settings" on public.site_link_settings
 for select to anon, authenticated using (true);
drop policy if exists "Admins manage site link settings" on public.site_link_settings;
create policy "Admins manage site link settings" on public.site_link_settings
 for all to authenticated
 using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_banned,false)=false))
 with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_banned,false)=false));
