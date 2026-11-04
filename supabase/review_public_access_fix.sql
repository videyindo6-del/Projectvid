-- BoxCellink: perbaikan akses baca publik untuk review yang berstatus published.
-- Jalankan sekali di Supabase SQL Editor.
-- Data rahasia tetap berada di review_download_secrets dan review_content_secrets.
alter table public.review_items enable row level security;

grant select on table public.review_items to anon, authenticated;

drop policy if exists "public published review items" on public.review_items;
create policy "public published review items"
on public.review_items
for select
to anon, authenticated
using (status = 'published');

-- Admin tetap memakai policy admin review items yang sudah ada.
