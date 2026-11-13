-- ProjectVID: hard-delete content and cascade its dependent rows.
-- Run AFTER review_delete_preserve_orders.sql and all content/social migrations.
-- Content data is removed permanently. Payment ledger rows are retained for audit.
begin;

-- Ensure the order model supports all current product types and can retain
-- settled review orders after the referenced review row is removed.
alter table public.cashi_orders
  add column if not exists vip_group_id uuid
  references public.vip_groups(id) on delete set null;
alter table public.cashi_orders drop constraint if exists order_target_check;
alter table public.cashi_orders add constraint order_target_check check (
  (purpose = 'vip' and plan_id is not null and review_id is null and vip_group_id is null)
  or
  (purpose = 'review_download' and plan_id is null and vip_group_id is null
    and (review_id is not null or status <> 'PENDING'))
  or
  (purpose = 'vip_group' and vip_group_id is not null and plan_id is null and review_id is null)
);

-- A review deletion must not leave an unpaid order pointing at deleted content.
create or replace function public.expire_review_orders_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cashi_orders
     set status = 'EXPIRED', updated_at = now()
   where review_id = old.id
     and purpose = 'review_download'
     and status = 'PENDING';
  return old;
end;
$$;
revoke all on function public.expire_review_orders_before_delete() from public, anon, authenticated;
drop trigger if exists expire_review_orders_before_delete on public.review_items;
create trigger expire_review_orders_before_delete
before delete on public.review_items
for each row execute function public.expire_review_orders_before_delete();

-- Keep order/payment history, but detach it from deleted review content.
alter table public.cashi_orders drop constraint if exists cashi_orders_review_id_fkey;
alter table public.cashi_orders
  add constraint cashi_orders_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete set null;

-- A deleted review removes all content-specific records and paid access records.
alter table public.review_download_secrets drop constraint if exists review_download_secrets_review_id_fkey;
alter table public.review_download_secrets
  add constraint review_download_secrets_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

alter table public.review_content_secrets drop constraint if exists review_content_secrets_review_id_fkey;
alter table public.review_content_secrets
  add constraint review_content_secrets_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

alter table public.review_entitlements drop constraint if exists review_entitlements_review_id_fkey;
alter table public.review_entitlements
  add constraint review_entitlements_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

alter table public.review_likes drop constraint if exists review_likes_review_id_fkey;
alter table public.review_likes
  add constraint review_likes_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

alter table public.review_comments drop constraint if exists review_comments_review_id_fkey;
alter table public.review_comments
  add constraint review_comments_review_id_fkey
  foreign key (review_id) references public.review_items(id) on delete cascade;

-- A deleted video removes likes, comments, comment replies/reactions and watch history.
alter table public.video_likes drop constraint if exists video_likes_video_id_fkey;
alter table public.video_likes
  add constraint video_likes_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete cascade;

alter table public.video_comments drop constraint if exists video_comments_video_id_fkey;
alter table public.video_comments
  add constraint video_comments_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete cascade;

alter table public.video_watch_history drop constraint if exists video_watch_history_video_id_fkey;
alter table public.video_watch_history
  add constraint video_watch_history_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete cascade;

alter table public.video_comment_replies drop constraint if exists video_comment_replies_comment_id_fkey;
alter table public.video_comment_replies
  add constraint video_comment_replies_comment_id_fkey
  foreign key (comment_id) references public.video_comments(id) on delete cascade;

alter table public.video_comment_likes drop constraint if exists video_comment_likes_comment_id_fkey;
alter table public.video_comment_likes
  add constraint video_comment_likes_comment_id_fkey
  foreign key (comment_id) references public.video_comments(id) on delete cascade;

commit;
