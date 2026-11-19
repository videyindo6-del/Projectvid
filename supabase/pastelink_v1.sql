-- PasteLink v1 for ProjectVID / BoxCellink.
-- Run once after account_center_v1.sql, autolink_publisher_monetization_v1.sql and social_posts_v1.sql.\n-- Pages Function uses service_role; no public table access. PasteLink slugs are 8 chars (API), while the column allows 20 for compatibility.
begin;
create extension if not exists pgcrypto;
alter table public.profiles add column if not exists game_id text;
create table if not exists public.paste_links (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 slug varchar(20) not null unique,
 title varchar(140) not null,
 content text not null,
 password_salt text,
 password_hash text,
 status text not null default 'published' check(status in ('published','hidden','deleted')),
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint paste_links_content_length check(char_length(content) between 1 and 12000),
 constraint paste_links_password_pair check((password_salt is null)=(password_hash is null))
);
create index if not exists paste_links_feed_idx on public.paste_links(status,created_at desc);
create index if not exists paste_links_owner_idx on public.paste_links(user_id,created_at desc);

-- Dashboard view statistics: count only successfully opened published PasteLinks.
alter table public.paste_links add column if not exists view_count bigint not null default 0;
create or replace function public.increment_pastelink_view(p_paste_link_id uuid)
returns void language sql security definer set search_path=public as $$
 update public.paste_links set view_count=view_count+1
 where id=p_paste_link_id and status='published'
   and (expires_at is null or expires_at>now());
$$;
revoke all on function public.increment_pastelink_view(uuid) from public,anon,authenticated;
grant execute on function public.increment_pastelink_view(uuid) to service_role;
alter table public.paste_links enable row level security;
revoke all on public.paste_links from anon,authenticated;
grant all on public.paste_links to service_role;

-- Social feed integration: AutoLink and full PasteLink records use the same
-- like/comment/share tables and therefore appear in one chronological feed.
alter table public.social_posts add column if not exists short_code varchar(12);
create unique index if not exists social_posts_short_code_uidx on public.social_posts(short_code) where short_code is not null;
alter table public.social_posts add column if not exists post_type text not null default 'paste_link';
alter table public.social_posts add column if not exists title text;
alter table public.social_posts add column if not exists autolink_id uuid references public.autolinks(id) on delete cascade;
alter table public.social_posts add column if not exists expires_at timestamptz;
alter table public.social_posts drop constraint if exists social_posts_detail_length;
alter table public.social_posts add constraint social_posts_detail_length check(detail is null or char_length(detail)<=12000);
alter table public.social_posts add column if not exists paste_link_id uuid references public.paste_links(id) on delete cascade;
create unique index if not exists social_posts_paste_link_uidx on public.social_posts(paste_link_id) where paste_link_id is not null;
update public.social_posts set post_type='paste_link' where post_type is null;
create unique index if not exists social_posts_autolink_uidx on public.social_posts(autolink_id) where autolink_id is not null;
create index if not exists social_posts_type_created_idx on public.social_posts(post_type,status,created_at desc);

create or replace function public.sync_autolink_to_social_feed()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
   delete from public.social_posts where autolink_id=old.id;
   return old;
 end if;
 if new.status='published' then
   insert into public.social_posts(user_id,detail,public_url,short_code,status,post_type,title,autolink_id,created_at)
   values(new.publisher_id,nullif(new.description,''),'https://boxcellink.pages.dev/z/'||new.short_code,new.short_code,'published','auto_link',new.title,new.id,new.created_at)
   on conflict (autolink_id) where autolink_id is not null
   do update set detail=excluded.detail,public_url=excluded.public_url,short_code=excluded.short_code,title=excluded.title,status='published';
 else
   update public.social_posts set status='hidden' where autolink_id=new.id;
 end if;
 return new;
end; $$;
drop trigger if exists autolink_social_feed_sync on public.autolinks;
create trigger autolink_social_feed_sync after insert or update of title,description,short_code,status or delete on public.autolinks for each row execute function public.sync_autolink_to_social_feed();

-- Backfill already-published AutoLinks into the social feed.
insert into public.social_posts(user_id,detail,public_url,short_code,status,post_type,title,autolink_id,created_at)
select a.publisher_id,nullif(a.description,''),'https://boxcellink.pages.dev/z/'||a.short_code,a.short_code,'published','auto_link',a.title,a.id,a.created_at
from public.autolinks a where a.status='published'
on conflict (autolink_id) where autolink_id is not null do nothing;

-- Keep full PasteLink entries in the unified social feed as well.
create or replace function public.sync_pastelink_to_social_feed()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_url text;
begin
 if tg_op='DELETE' then delete from public.social_posts where paste_link_id=old.id; return old; end if;
 v_url:='https://boxcelink.pages.dev/pas/'||new.slug;
 if new.status='published' then
  insert into public.social_posts(user_id,detail,public_url,short_code,status,post_type,title,created_at,expires_at,paste_link_id)
  values(new.user_id,new.content,v_url,new.slug,'published','paste_link',new.title,new.created_at,new.expires_at,new.id)
  on conflict (paste_link_id) where paste_link_id is not null do update
   set detail=excluded.detail,public_url=excluded.public_url,title=excluded.title,status='published',expires_at=excluded.expires_at;
 else
  update public.social_posts set status='hidden' where paste_link_id=new.id;
 end if;
 return new;
end; $$;
drop trigger if exists pastelink_social_feed_sync on public.paste_links;
create trigger pastelink_social_feed_sync after insert or update of title,content,status,expires_at or delete on public.paste_links for each row execute function public.sync_pastelink_to_social_feed();

-- Extend public username lookup with display name while retaining safe fields only.
drop function if exists public.get_public_usernames(uuid[]);
create function public.get_public_usernames(p_user_ids uuid[])
returns table(user_id uuid,username text,full_name text) language sql stable security definer set search_path=public as $$
 select p.id,p.username,p.full_name from public.profiles p
 where p.id=any(coalesce(p_user_ids,'{}'::uuid[])) and nullif(btrim(p.username),'') is not null;
$$;
revoke all on function public.get_public_usernames(uuid[]) from public;
grant execute on function public.get_public_usernames(uuid[]) to anon,authenticated;

-- Notify every admin when a Publisher withdrawal request is created.
create or replace function public.notify_admin_publisher_withdrawal()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_username text; v_game_id text; v_name text; v_body text;
begin
 select username,game_id,coalesce(full_name,username,'Member') into v_username,v_game_id,v_name from public.profiles where id=new.publisher_id;
 v_body:=format(E'Username: @%s\nNama: %s\nGame ID: %s\nMetode: %s\nBank/Provider: %s\nNama rekening: %s\nNomor rekening: %s\nNominal: Rp %s',coalesce(v_username,'belum ada'),coalesce(v_name,'Member'),coalesce(v_game_id,'belum diatur'),coalesce(new.payout_method,'-'),coalesce(new.payout_provider,'-'),coalesce(new.account_holder,'-'),coalesce(new.account_number,'-'),to_char(new.amount,'FM999G999G999G990'));
 insert into public.boxcellink_notifications(user_id,title,body,kind,href)
 select id,'Withdraw Publisher baru',v_body,'withdrawal_admin','/admin-publisher-withdraw.html' from public.profiles where role='admin';
 return new;
end; $$;
drop trigger if exists publisher_withdrawal_admin_notice on public.publisher_withdrawals;
create trigger publisher_withdrawal_admin_notice after insert on public.publisher_withdrawals for each row execute function public.notify_admin_publisher_withdrawal();
commit;
