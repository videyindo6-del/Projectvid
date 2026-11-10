-- Boxcelink Support Chat: run this migration in Supabase SQL Editor.
create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'Chat Support',
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists support_conversations_user_updated_idx on public.support_conversations(user_id,updated_at desc);
create index if not exists support_messages_conversation_created_idx on public.support_messages(conversation_id,created_at);
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
drop policy if exists "support conversations read own or admin" on public.support_conversations;
create policy "support conversations read own or admin" on public.support_conversations for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "support conversations create own" on public.support_conversations;
create policy "support conversations create own" on public.support_conversations for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "support conversations admin update" on public.support_conversations;
create policy "support conversations admin update" on public.support_conversations for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "support conversations admin delete" on public.support_conversations;
create policy "support conversations admin delete" on public.support_conversations for delete to authenticated using(public.is_admin());
drop policy if exists "support messages read own or admin" on public.support_messages;
create policy "support messages read own or admin" on public.support_messages for select to authenticated using(
  public.is_admin() or exists(select 1 from public.support_conversations c where c.id=conversation_id and c.user_id=auth.uid())
);
drop policy if exists "support messages insert own or admin reply" on public.support_messages;
create policy "support messages insert own or admin reply" on public.support_messages for insert to authenticated with check(
  sender_id=auth.uid() and (public.is_admin() or exists(select 1 from public.support_conversations c where c.id=conversation_id and c.user_id=auth.uid()))
);
drop policy if exists "support messages admin update" on public.support_messages;
create policy "support messages admin update" on public.support_messages for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "support messages admin delete" on public.support_messages;
create policy "support messages admin delete" on public.support_messages for delete to authenticated using(public.is_admin());
create or replace function public.touch_support_conversation() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.support_conversations set updated_at=now() where id=new.conversation_id; return new; end $$;
drop trigger if exists support_message_touch_conversation on public.support_messages;
create trigger support_message_touch_conversation after insert or update on public.support_messages for each row execute function public.touch_support_conversation();
