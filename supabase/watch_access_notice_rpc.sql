-- Safe public metadata for restricted BoxVidey pages.
-- This RPC deliberately omits embed_url, download_url, and all other playback secrets.
create or replace function public.get_watch_video_notice(p_slug text)
returns table (
  video_id uuid,
  slug text,
  title text,
  access text,
  access_scope text,
  thumbnail_url text,
  created_at timestamptz,
  view_count bigint,
  category_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.id,
    v.slug,
    v.title,
    v.access::text,
    coalesce(v.access_scope, 'everyone'),
    v.thumbnail_url,
    v.created_at,
    v.view_count,
    c.name
  from public.videos v
  left join public.categories c on c.id = v.category_id
  where v.status = 'published'
    and (v.slug = p_slug or v.id::text = p_slug)
    and (
      (v.access = 'vip' or v.access_scope = 'vip')
      or (v.access = 'public' and v.access_scope = 'login')
    )
  limit 1;
$$;
revoke all on function public.get_watch_video_notice(text) from public;
grant execute on function public.get_watch_video_notice(text) to anon, authenticated;
