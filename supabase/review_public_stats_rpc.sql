-- Public aggregate statistics for published BoxCellink reviews.
-- Exposes aggregate counts only; no buyer IDs, payment references, or order details.
-- Drop first because PostgreSQL cannot change a function return table shape with CREATE OR REPLACE.
drop function if exists public.get_public_review_stats();
create or replace function public.get_public_review_stats()
returns table (
  review_id uuid,
  total_sold bigint,
  total_links bigint,
  total_likes bigint,
  total_comments bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id as review_id,
    coalesce(s.total_sold, 0)::bigint as total_sold,
    coalesce(r.view_count, 0)::bigint as total_links,
    coalesce(l.total_likes, 0)::bigint as total_likes,
    coalesce(c.total_comments, 0)::bigint as total_comments
  from public.review_items r
  left join lateral (
    select count(*) as total_sold
    from public.cashi_orders o
    where o.review_id = r.id
      and o.purpose = 'review_download'
      and o.status = 'SETTLED'
  ) s on true
  left join lateral (
    select count(*) as total_likes
    from public.review_likes rl
    where rl.review_id = r.id
  ) l on true
  left join lateral (
    select count(*) as total_comments
    from public.review_comments rc
    where rc.review_id = r.id and rc.is_hidden = false
  ) c on true
  where r.status = 'published';
$$;
revoke all on function public.get_public_review_stats() from public;
grant execute on function public.get_public_review_stats() to anon, authenticated;
