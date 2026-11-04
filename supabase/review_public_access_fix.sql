-- BOXCellink: akses baca publik untuk metadata review berstatus published.
-- Jalankan di Supabase SQL Editor pada project yang sama dengan website.
-- Link download dan konten berbayar tetap privat di tabel *_secrets.

begin;

grant usage on schema public to anon, authenticated;
grant select on table public.review_items to anon, authenticated;

alter table public.review_items enable row level security;

drop policy if exists "public published review items" on public.review_items;
create policy "public published review items"
  on public.review_items
  for select
  to anon, authenticated
  using (status = 'published');

commit;

-- Verifikasi sesudah menjalankan SQL:
-- select slug, status, title from public.review_items where slug = 'BC6E17F2';
