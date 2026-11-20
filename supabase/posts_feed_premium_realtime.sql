-- BoxCellink Posts Premium Feed + Realtime
-- Jalankan SETELAH social_posts_v1.sql, account_center_v1.sql, dan pastelink_v1.sql.
begin;

-- Nama tampilan dan username publik untuk kartu publikasi/komentar.
-- Email dan data privat tidak pernah dikembalikan oleh fungsi ini.
drop function if exists public.get_public_usernames(uuid[]);
create function public.get_public_usernames(p_user_ids uuid[])
returns table(user_id uuid, username text, full_name text)
language sql stable security definer set search_path=public as $$
  select p.id, p.username, coalesce(nullif(btrim(p.full_name),''),p.username)
  from public.profiles p
  where p.id=any(coalesce(p_user_ids,'{}'::uuid[]))
    and nullif(btrim(p.username),'') is not null;
$$;
revoke all on function public.get_public_usernames(uuid[]) from public;
grant execute on function public.get_public_usernames(uuid[]) to anon, authenticated;

-- Aktifkan event INSERT agar feed dapat menampilkan pemberitahuan publikasi baru.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='social_posts') then
    alter publication supabase_realtime add table public.social_posts;
  end if;
end $$;

commit;
