-- BoxCellink: private member-to-member chat. Run after social_friends_profile_v2.sql.
begin;
create table if not exists public.direct_conversations (
 id uuid primary key default gen_random_uuid(),
 user_low uuid not null references auth.users(id) on delete cascade,
 user_high uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint direct_conversations_distinct check(user_low<>user_high),
 constraint direct_conversations_sorted check(user_low<user_high),
 unique(user_low,user_high)
);
create table if not exists public.direct_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists direct_messages_conversation_created_idx on public.direct_messages(conversation_id,created_at desc);
create index if not exists direct_conversations_low_updated_idx on public.direct_conversations(user_low,updated_at desc);
create index if not exists direct_conversations_high_updated_idx on public.direct_conversations(user_high,updated_at desc);
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
revoke all on public.direct_conversations from anon,authenticated;
revoke all on public.direct_messages from anon,authenticated;

create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_me uuid:=auth.uid(); v_low uuid; v_high uuid; v_id uuid;
begin
 if v_me is null then raise exception 'LOGIN_REQUIRED'; end if;
 if p_other_user_id is null or p_other_user_id=v_me then raise exception 'INVALID_USER'; end if;
 if not exists(select 1 from public.profiles where id=p_other_user_id and nullif(trim(username),'') is not null) then raise exception 'MEMBER_NOT_FOUND'; end if;
 v_low:=least(v_me,p_other_user_id);v_high:=greatest(v_me,p_other_user_id);
 insert into public.direct_conversations(user_low,user_high) values(v_low,v_high) on conflict(user_low,user_high) do update set updated_at=now() returning id into v_id;
 return v_id;
end $$;
revoke all on function public.get_or_create_direct_conversation(uuid) from public,anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

create or replace function public.get_direct_messages(p_conversation_id uuid,p_limit integer default 80)
returns table(id uuid,sender_id uuid,body text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select recent.id,recent.sender_id,recent.body,recent.created_at from (
  select m.id,m.sender_id,m.body,m.created_at from public.direct_messages m
  join public.direct_conversations c on c.id=m.conversation_id
  where c.id=p_conversation_id and auth.uid() in (c.user_low,c.user_high)
  order by m.created_at desc limit greatest(1,least(coalesce(p_limit,80),100))
 ) recent order by recent.created_at asc
$$;
revoke all on function public.get_direct_messages(uuid,integer) from public,anon;
grant execute on function public.get_direct_messages(uuid,integer) to authenticated;

create or replace function public.send_direct_message(p_conversation_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_id uuid;v_body text:=trim(coalesce(p_body,''));
begin
 if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;
 if char_length(v_body)<1 or char_length(v_body)>2000 then raise exception 'MESSAGE_LENGTH_INVALID'; end if;
 if not exists(select 1 from public.direct_conversations c where c.id=p_conversation_id and v_uid in (c.user_low,c.user_high)) then raise exception 'CONVERSATION_FORBIDDEN'; end if;
 insert into public.direct_messages(conversation_id,sender_id,body) values(p_conversation_id,v_uid,v_body) returning id into v_id;
 update public.direct_conversations set updated_at=now() where id=p_conversation_id;
 return v_id;
end $$;
revoke all on function public.send_direct_message(uuid,text) from public,anon;
grant execute on function public.send_direct_message(uuid,text) to authenticated;
commit;
