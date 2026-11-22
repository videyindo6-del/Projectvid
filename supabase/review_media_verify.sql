-- BoxCellink Review Media diagnostic checks.
-- READ-ONLY: run in Supabase SQL Editor. This script does not change data/schema.

with required_columns(table_name, column_name) as (
  values
    ('review_items','id'),('review_items','slug'),('review_items','title'),
    ('review_items','description'),('review_items','review_embed_url'),
    ('review_items','thumbnail_url'),('review_items','gallery_urls'),
    ('review_items','price'),('review_items','access'),('review_items','status'),
    ('review_items','created_at'),('review_items','view_count'),('review_items','share_count'),
    ('review_comments','id'),('review_comments','review_id'),('review_comments','user_id'),
    ('review_comments','guest_name'),('review_comments','content'),('review_comments','is_hidden'),('review_comments','created_at'),
    ('review_likes','id'),('review_likes','review_id'),('review_likes','user_id'),('review_likes','created_at')
), column_checks as (
  select rc.table_name||'.'||rc.column_name as check_name,
         exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=rc.table_name and c.column_name=rc.column_name) as ok
  from required_columns rc
), function_checks as (
  select 'RPC increment_review_view(uuid)' as check_name, to_regprocedure('public.increment_review_view(uuid)') is not null as ok
  union all select 'RPC record_review_watch(uuid)', to_regprocedure('public.record_review_watch(uuid)') is not null
  union all select 'RPC get_public_review_stats()', to_regprocedure('public.get_public_review_stats()') is not null
  union all select 'RPC increment_review_share(uuid)', to_regprocedure('public.increment_review_share(uuid)') is not null
  union all select 'RPC get_public_usernames(uuid[])', to_regprocedure('public.get_public_usernames(uuid[])') is not null
), policy_checks as (
  select 'RLS review_items enabled' as check_name, coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='review_items'),false) as ok
  union all select 'Public SELECT review_items', has_table_privilege('anon','public.review_items','SELECT')
  union all select 'RLS review_comments enabled', coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='review_comments'),false)
  union all select 'Guest comment name column present', exists(select 1 from information_schema.columns where table_schema='public' and table_name='review_comments' and column_name='guest_name')
  union all select 'Guest comment user_id nullable', coalesce((select is_nullable='YES' from information_schema.columns where table_schema='public' and table_name='review_comments' and column_name='user_id'),false)
  union all select 'RLS review_likes enabled', coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='review_likes'),false)
), grant_checks as (
  select 'EXECUTE get_public_review_stats for anon' as check_name, has_function_privilege('anon','public.get_public_review_stats()','EXECUTE') as ok
  union all select 'EXECUTE increment_review_view for anon', has_function_privilege('anon','public.increment_review_view(uuid)','EXECUTE')
  union all select 'EXECUTE increment_review_share for anon', has_function_privilege('anon','public.increment_review_share(uuid)','EXECUTE')
)
select check_name, case when ok then 'OK' else 'MISSING / CHECK MIGRATION' end as status
from column_checks
union all select check_name, case when ok then 'OK' else 'MISSING / CHECK MIGRATION' end from function_checks
union all select check_name, case when ok then 'OK' else 'MISSING / CHECK MIGRATION' end from policy_checks
union all select check_name, case when ok then 'OK' else 'MISSING / CHECK MIGRATION' end from grant_checks
order by status desc, check_name;
