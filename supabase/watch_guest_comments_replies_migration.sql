-- BoxCellink Watch: guest comments, nested replies, and comment reactions.
-- Run this file once in Supabase SQL Editor.
begin;

alter table public.video_comments alter column user_id drop not null;
alter table public.video_comments add column if not exists guest_name text;
alter table public.video_comments drop constraint if exists video_comments_guest_name_length;
alter table public.video_comments add constraint video_comments_guest_name_length
  check (guest_name is null or char_length(btrim(guest_name)) between 1 and 40);

create or replace function public.guard_video_comment_insert()
returns trigger language plpgsql security invoker set search_path=public,auth as $$
declare signed_in boolean := auth.uid() is not null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false;
begin
  if signed_in then
    if new.user_id is distinct from auth.uid() then raise exception 'Identitas komentar tidak valid.'; end if;
    new.guest_name := null;
  else
    if new.user_id is not null then raise exception 'Login diperlukan untuk komentar dengan tautan.'; end if;
    if new.guest_name is null or char_length(btrim(new.guest_name)) < 1 then raise exception 'Nama wajib diisi.'; end if;
    if new.body ~* '(https?://|www\.)' then raise exception 'Komentar berisi tautan hanya dapat dikirim oleh pengguna yang login.'; end if;
    new.guest_name := left(btrim(new.guest_name),40);
  end if;
  return new;
end; $$;

drop trigger if exists video_comment_insert_guard on public.video_comments;
create trigger video_comment_insert_guard before insert on public.video_comments
for each row execute function public.guard_video_comment_insert();

drop policy if exists "signed users comment" on public.video_comments;
drop policy if exists "video guests add text comments" on public.video_comments;
create policy "video guests add text comments" on public.video_comments for insert to anon
with check (user_id is null and guest_name is not null and exists(
  select 1 from public.videos v where v.id=video_id and v.status='published'
));
drop policy if exists "video members add comments" on public.video_comments;
create policy "video members add comments" on public.video_comments for insert to authenticated
with check (auth.uid()=user_id and exists(
  select 1 from public.videos v where v.id=video_id and v.status='published'
));

create table if not exists public.video_comment_replies(
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.video_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  guest_name text,
  body text not null check(char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.video_comment_replies enable row level security;
drop policy if exists "video comment replies public read" on public.video_comment_replies;
create policy "video comment replies public read" on public.video_comment_replies for select to anon,authenticated using(true);
drop policy if exists "video comment replies guest insert" on public.video_comment_replies;
create policy "video comment replies guest insert" on public.video_comment_replies for insert to anon
with check(user_id is null and guest_name is not null and body !~* '(https?://|www\.)');
drop policy if exists "video comment replies member insert" on public.video_comment_replies;
create policy "video comment replies member insert" on public.video_comment_replies for insert to authenticated
with check(auth.uid()=user_id);

create table if not exists public.video_comment_likes(
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.video_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  guest_token text,
  created_at timestamptz not null default now(),
  constraint video_comment_likes_actor check ((user_id is not null and guest_token is null) or (user_id is null and guest_token is not null)),
  constraint video_comment_likes_user_unique unique(comment_id,user_id),
  constraint video_comment_likes_guest_unique unique(comment_id,guest_token)
);
alter table public.video_comment_likes enable row level security;
drop policy if exists "video comment likes public read" on public.video_comment_likes;
create policy "video comment likes public read" on public.video_comment_likes for select to anon,authenticated using(true);
drop policy if exists "video comment likes guest insert" on public.video_comment_likes;
create policy "video comment likes guest insert" on public.video_comment_likes for insert to anon
with check(user_id is null and guest_token is not null and char_length(guest_token) between 8 and 100);
drop policy if exists "video comment likes member insert" on public.video_comment_likes;
create policy "video comment likes member insert" on public.video_comment_likes for insert to authenticated
with check(auth.uid()=user_id and guest_token is null);
drop policy if exists "video comment likes guest delete" on public.video_comment_likes;
drop policy if exists "video comment likes member delete" on public.video_comment_likes;
create policy "video comment likes member delete" on public.video_comment_likes for delete to authenticated
using(auth.uid()=user_id);

grant select,insert on public.video_comments to anon,authenticated;
grant select,insert on public.video_comment_replies to anon,authenticated;
grant select,insert,delete on public.video_comment_likes to anon,authenticated;

commit;
