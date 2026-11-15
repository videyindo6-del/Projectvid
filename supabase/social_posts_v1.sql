-- BoxCellink Social Posts v1
-- Run in Supabase SQL Editor after Account Center v1 (username support).
begin;

alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_lower_uidx on public.profiles(lower(username)) where username is not null and btrim(username)<>'';

create table if not exists public.social_posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 detail text,
 public_url text not null,
 status text not null default 'published' check(status in ('published','hidden','deleted')),
 like_count integer not null default 0 check(like_count>=0),
 comment_count integer not null default 0 check(comment_count>=0),
 share_count integer not null default 0 check(share_count>=0),
 created_at timestamptz not null default now(),
 constraint social_posts_detail_length check(detail is null or char_length(detail)<=1500),
 constraint social_posts_url_valid check(public_url ~* '^https?://')
);
create index if not exists social_posts_feed_idx on public.social_posts(status,created_at desc);
create index if not exists social_posts_user_idx on public.social_posts(user_id,created_at desc);

create table if not exists public.social_post_likes (
 post_id uuid not null references public.social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create index if not exists social_post_likes_user_idx on public.social_post_likes(user_id,post_id);

create table if not exists public.social_post_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.social_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 800),
 created_at timestamptz not null default now()
);
create index if not exists social_post_comments_feed_idx on public.social_post_comments(post_id,created_at asc);

alter table public.social_posts enable row level security;
alter table public.social_post_likes enable row level security;
alter table public.social_post_comments enable row level security;

drop policy if exists "social posts public read" on public.social_posts;
create policy "social posts public read" on public.social_posts for select to anon,authenticated using(status='published' or user_id=auth.uid());
drop policy if exists "social posts members create" on public.social_posts;
create policy "social posts members create" on public.social_posts for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and nullif(btrim(p.username),'') is not null));
drop policy if exists "social posts owner delete" on public.social_posts;
create policy "social posts owner delete" on public.social_posts for delete to authenticated using(user_id=auth.uid());

drop policy if exists "social likes public read" on public.social_post_likes;
create policy "social likes public read" on public.social_post_likes for select to anon,authenticated using(true);
drop policy if exists "social likes members add" on public.social_post_likes;
create policy "social likes members add" on public.social_post_likes for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.social_posts p where p.id=post_id and p.status='published'));
drop policy if exists "social likes owner remove" on public.social_post_likes;
create policy "social likes owner remove" on public.social_post_likes for delete to authenticated using(user_id=auth.uid());

drop policy if exists "social comments public read" on public.social_post_comments;
create policy "social comments public read" on public.social_post_comments for select to anon,authenticated using(true);
drop policy if exists "social comments members add" on public.social_post_comments;
create policy "social comments members add" on public.social_post_comments for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and nullif(btrim(p.username),'') is not null) and exists(select 1 from public.social_posts p where p.id=post_id and p.status='published'));
drop policy if exists "social comments owner remove" on public.social_post_comments;
create policy "social comments owner remove" on public.social_post_comments for delete to authenticated using(user_id=auth.uid());

revoke all on public.social_posts from anon,authenticated;
revoke all on public.social_post_likes from anon,authenticated;
revoke all on public.social_post_comments from anon,authenticated;
grant select on public.social_posts to anon,authenticated;
grant insert,delete on public.social_posts to authenticated;
grant select on public.social_post_likes to anon,authenticated;
grant insert,delete on public.social_post_likes to authenticated;
grant select on public.social_post_comments to anon,authenticated;
grant insert,delete on public.social_post_comments to authenticated;

create or replace function public.social_post_update_counts()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_post uuid;
begin
 v_post:=coalesce(new.post_id,old.post_id);
 if tg_table_name='social_post_likes' then
  update public.social_posts set like_count=(select count(*) from public.social_post_likes where post_id=v_post) where id=v_post;
 else
  update public.social_posts set comment_count=(select count(*) from public.social_post_comments where post_id=v_post) where id=v_post;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists social_post_like_count on public.social_post_likes;
create trigger social_post_like_count after insert or delete on public.social_post_likes for each row execute function public.social_post_update_counts();
drop trigger if exists social_post_comment_count on public.social_post_comments;
create trigger social_post_comment_count after insert or delete on public.social_post_comments for each row execute function public.social_post_update_counts();

create or replace function public.increment_social_post_share(p_post_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 if p_post_id is null then raise exception 'POST_ID_REQUIRED'; end if;
 update public.social_posts set share_count=share_count+1 where id=p_post_id and status='published' returning share_count into v_count;
 if v_count is null then raise exception 'POST_NOT_FOUND'; end if;
 return v_count;
end; $$;
revoke all on function public.increment_social_post_share(uuid) from public;
grant execute on function public.increment_social_post_share(uuid) to authenticated;

-- Public username lookup used by feed cards and comments; never returns email/name.
create or replace function public.get_public_usernames(p_user_ids uuid[])
returns table(user_id uuid,username text) language sql stable security definer set search_path=public as $$
 select p.id,p.username from public.profiles p where p.id=any(coalesce(p_user_ids,'{}'::uuid[])) and nullif(btrim(p.username),'') is not null;
$$;
revoke all on function public.get_public_usernames(uuid[]) from public;
grant execute on function public.get_public_usernames(uuid[]) to anon,authenticated;

commit;
