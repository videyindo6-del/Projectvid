-- BoxCellink review comments: public text-only guest comments,
-- authenticated comments may contain URLs, admin moderation.
-- Run once in Supabase SQL Editor after review_social_interactions.sql.
begin;

alter table public.review_comments
  alter column user_id drop not null;

alter table public.review_comments
  add column if not exists guest_name text;

alter table public.review_comments
  drop constraint if exists review_comments_guest_name_length;
alter table public.review_comments
  add constraint review_comments_guest_name_length
  check (guest_name is null or char_length(btrim(guest_name)) between 1 and 40);

create or replace function public.guard_review_comment_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  signed_in boolean := auth.uid() is not null
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false;
begin
  if signed_in then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Identitas komentar tidak valid.';
    end if;
    new.guest_name := null;
  else
    if new.user_id is not null then
      raise exception 'Login diperlukan untuk komentar dengan tautan.';
    end if;
    if new.guest_name is null or char_length(btrim(new.guest_name)) < 1 then
      raise exception 'Username wajib diisi untuk komentar pengunjung.';
    end if;
    if new.content ~* '(https?://|www\.)' then
      raise exception 'Komentar berisi tautan hanya dapat dikirim oleh pengguna yang login.';
    end if;
    new.guest_name := left(btrim(new.guest_name), 40);
  end if;
  return new;
end;
$$;

drop trigger if exists review_comment_insert_guard on public.review_comments;
create trigger review_comment_insert_guard
before insert on public.review_comments
for each row execute function public.guard_review_comment_insert();

-- Replace earlier authenticated-only insert policy with explicit guest/member policies.
drop policy if exists "users add own review comment" on public.review_comments;
drop policy if exists "review guests add text comments" on public.review_comments;
create policy "review guests add text comments"
on public.review_comments for insert to anon
with check (
  user_id is null
  and guest_name is not null
  and is_hidden = false
  and exists(select 1 from public.review_items r where r.id = review_id and r.status = 'published')
);

drop policy if exists "review members add comments" on public.review_comments;
create policy "review members add comments"
on public.review_comments for insert to authenticated
with check (
  auth.uid() = user_id
  and is_hidden = false
  and exists(select 1 from public.review_items r where r.id = review_id and r.status = 'published')
);

drop policy if exists "review anonymous sessions add guest text comments" on public.review_comments;
create policy "review anonymous sessions add guest text comments"
on public.review_comments for insert to authenticated
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = true
  and user_id is null
  and guest_name is not null
  and is_hidden = false
  and exists(select 1 from public.review_items r where r.id = review_id and r.status = 'published')
);

drop policy if exists "admins delete review comments" on public.review_comments;
create policy "admins delete review comments"
on public.review_comments for delete to authenticated
using (public.is_admin());

grant select on public.review_comments to anon, authenticated;
grant insert on public.review_comments to anon, authenticated;
grant delete on public.review_comments to authenticated;

commit;
