-- Separate category namespaces for Box Video and Media Telegram.
-- Run once after the base content tables exist.
begin;
alter table public.categories add column if not exists content_type text not null default 'box_video';
alter table public.categories drop constraint if exists categories_name_key;
alter table public.categories drop constraint if exists categories_content_type_check;
alter table public.categories add constraint categories_content_type_check check(content_type in ('box_video','media_telegram'));
create unique index if not exists categories_type_name_uidx on public.categories(content_type,name);

-- Duplicate categories used by Telegram reviews, then move only review_items to those copies.
with review_category_names as (
  select distinct c.name,c.status
  from public.review_items r
  join public.categories c on c.id=r.category_id
), inserted as (
  insert into public.categories(name,status,content_type)
  select n.name,n.status,'media_telegram'
  from review_category_names n
  on conflict (content_type,name) do nothing
  returning id,name
)
update public.review_items r
set category_id = target.id
from public.categories old_category
join public.categories target
  on target.name=old_category.name and target.content_type='media_telegram'
where r.category_id=old_category.id and old_category.content_type='box_video';

create index if not exists categories_type_status_name_idx on public.categories(content_type,status,name);
commit;
