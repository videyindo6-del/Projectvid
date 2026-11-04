-- BoxCellink: public review likes and comments
-- Run once in Supabase SQL Editor after the main schema/migrations.
begin;

create table if not exists public.review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.review_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint review_likes_one_per_user unique(review_id,user_id)
);

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.review_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check(char_length(content) between 1 and 1000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists review_likes_review_id_idx on public.review_likes(review_id);
create index if not exists review_comments_review_created_idx on public.review_comments(review_id,created_at desc);

alter table public.review_likes enable row level security;
alter table public.review_comments enable row level security;

grant select on public.review_likes, public.review_comments to anon,authenticated;
grant insert,delete on public.review_likes to authenticated;
grant insert on public.review_comments to authenticated;

drop policy if exists "published review likes are readable" on public.review_likes;
create policy "published review likes are readable" on public.review_likes
for select to anon,authenticated
using (exists(select 1 from public.review_items r where r.id=review_id and r.status='published'));

drop policy if exists "users add own review like" on public.review_likes;
create policy "users add own review like" on public.review_likes
for insert to authenticated
with check (auth.uid()=user_id and exists(select 1 from public.review_items r where r.id=review_id and r.status='published'));

drop policy if exists "users remove own review like" on public.review_likes;
create policy "users remove own review like" on public.review_likes
for delete to authenticated
using (auth.uid()=user_id);

drop policy if exists "published review comments are readable" on public.review_comments;
create policy "published review comments are readable" on public.review_comments
for select to anon,authenticated
using (is_hidden=false and exists(select 1 from public.review_items r where r.id=review_id and r.status='published'));

drop policy if exists "users add own review comment" on public.review_comments;
create policy "users add own review comment" on public.review_comments
for insert to authenticated
with check (auth.uid()=user_id and is_hidden=false and exists(select 1 from public.review_items r where r.id=review_id and r.status='published'));

commit;
