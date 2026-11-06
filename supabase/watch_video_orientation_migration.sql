-- BoxCellink: dukungan video horizontal dan vertikal. Jalankan sekali di Supabase SQL Editor.
alter table public.videos add column if not exists orientation text not null default 'auto';
alter table public.videos drop constraint if exists videos_orientation_check;
alter table public.videos add constraint videos_orientation_check check (orientation in ('auto','horizontal','vertical'));
