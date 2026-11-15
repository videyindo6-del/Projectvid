-- BoxCellink public social profile + friends v2
-- Run after social_posts_v1.sql and account_center_v1.sql.
begin;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists social_links jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_bio_length_check;
alter table public.profiles add constraint profiles_bio_length_check check(char_length(bio)<=500);

create table if not exists public.social_friend_requests (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 receiver_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint social_friend_no_self check(sender_id<>receiver_id)
);
create unique index if not exists social_friend_pending_pair_uidx on public.social_friend_requests(least(sender_id,receiver_id),greatest(sender_id,receiver_id)) where status in ('pending','accepted');
create index if not exists social_friend_receiver_idx on public.social_friend_requests(receiver_id,status,created_at desc);
create index if not exists social_friend_sender_idx on public.social_friend_requests(sender_id,status,created_at desc);
alter table public.social_friend_requests enable row level security;
revoke all on public.social_friend_requests from anon,authenticated;

create or replace function public.get_public_member_profile(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r jsonb; v_uid uuid:=auth.uid(); v_friend text:='none'; v_status text:='Basic';
begin
 select jsonb_build_object('id',p.id,'username',p.username,'bio',coalesce(p.bio,''),'social_links',coalesce(p.social_links,'{}'::jsonb),'vip_expires_at',p.vip_expires_at,'role',p.role,'membership_tier',to_jsonb(p)->>'membership_tier')
 into r from public.profiles p where p.id=p_user_id and nullif(btrim(p.username),'') is not null;
 if r is null then return null; end if;
 if (r->>'vip_expires_at') is not null and (r->>'vip_expires_at')::timestamptz>now() then v_status:='VIP';
 elsif lower(coalesce(r->>'membership_tier',''))='published' or lower(coalesce(r->>'role',''))='published' then v_status:='Published'; end if;
 if v_uid is not null and v_uid<>p_user_id then
  select case when status='accepted' then 'friends' when sender_id=v_uid then 'sent' else 'received' end into v_friend
  from public.social_friend_requests where status in ('pending','accepted') and ((sender_id=v_uid and receiver_id=p_user_id) or (sender_id=p_user_id and receiver_id=v_uid)) limit 1;
 end if;
 return r||jsonb_build_object('status_label',v_status,'friend_state',coalesce(v_friend,'none'));
end $$;
revoke all on function public.get_public_member_profile(uuid) from public;
grant execute on function public.get_public_member_profile(uuid) to anon,authenticated;

create or replace function public.search_public_members(p_query text default '')
returns table(user_id uuid,username text,bio text,status_label text)
language sql stable security definer set search_path=public as $$
 select p.id,p.username,coalesce(p.bio,''),case when p.vip_expires_at>now() then 'VIP' when lower(coalesce(to_jsonb(p)->>'membership_tier',''))='published' or lower(p.role::text)='published' then 'Published' else 'Basic' end
 from public.profiles p where nullif(btrim(p.username),'') is not null and p.id<>auth.uid() and lower(p.username) like '%'||lower(left(btrim(coalesce(p_query,'')),40))||'%' order by lower(p.username) limit 30;
$$;
revoke all on function public.search_public_members(text) from public;
grant execute on function public.search_public_members(text) to authenticated;

create or replace function public.send_social_friend_request(p_user_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_existing public.social_friend_requests%rowtype;
begin
 if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;
 if p_user_id is null or p_user_id=v_uid then raise exception 'INVALID_USER'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and nullif(btrim(username),'') is not null) then raise exception 'USER_NOT_FOUND'; end if;
 select * into v_existing from public.social_friend_requests where status in ('pending','accepted') and ((sender_id=v_uid and receiver_id=p_user_id) or (sender_id=p_user_id and receiver_id=v_uid)) limit 1;
 if found then return case when v_existing.status='accepted' then 'friends' when v_existing.sender_id=v_uid then 'sent' else 'received' end; end if;
 insert into public.social_friend_requests(sender_id,receiver_id) values(v_uid,p_user_id);
 return 'sent';
end $$;
revoke all on function public.send_social_friend_request(uuid) from public,anon;
grant execute on function public.send_social_friend_request(uuid) to authenticated;

create or replace function public.respond_social_friend_request(p_request_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.social_friend_requests set status=case when p_accept then 'accepted' else 'rejected' end,updated_at=now()
 where id=p_request_id and receiver_id=auth.uid() and status='pending';
 if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
end $$;
revoke all on function public.respond_social_friend_request(uuid,boolean) from public,anon;
grant execute on function public.respond_social_friend_request(uuid,boolean) to authenticated;

create or replace function public.remove_social_friend(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.social_friend_requests set status='cancelled',updated_at=now() where status in ('pending','accepted') and ((sender_id=auth.uid() and receiver_id=p_user_id) or (sender_id=p_user_id and receiver_id=auth.uid()));
end $$;
revoke all on function public.remove_social_friend(uuid) from public,anon;
grant execute on function public.remove_social_friend(uuid) to authenticated;

create or replace function public.get_my_social_friends()
returns table(user_id uuid,username text,bio text)
language sql stable security definer set search_path=public as $$
 select p.id,p.username,coalesce(p.bio,'') from public.social_friend_requests f join public.profiles p on p.id=case when f.sender_id=auth.uid() then f.receiver_id else f.sender_id end
 where f.status='accepted' and auth.uid() in (f.sender_id,f.receiver_id) order by lower(p.username);
$$;
revoke all on function public.get_my_social_friends() from public,anon;
grant execute on function public.get_my_social_friends() to authenticated;

create or replace function public.get_my_social_friend_requests()
returns table(request_id uuid,user_id uuid,username text,bio text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select f.id,p.id,p.username,coalesce(p.bio,''),f.created_at from public.social_friend_requests f join public.profiles p on p.id=f.sender_id
 where f.receiver_id=auth.uid() and f.status='pending' order by f.created_at desc;
$$;
revoke all on function public.get_my_social_friend_requests() from public,anon;
grant execute on function public.get_my_social_friend_requests() to authenticated;
commit;
