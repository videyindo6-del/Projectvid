-- Run this migration once in Supabase SQL Editor.
-- Tracks successful public PasteLink opens and exposes the counter only through the Pages Function service role.
begin;

alter table public.paste_links
  add column if not exists view_count bigint not null default 0;

create or replace function public.increment_pastelink_view(p_paste_link_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.paste_links
     set view_count = view_count + 1
   where id = p_paste_link_id
     and status = 'published'
     and (expires_at is null or expires_at > now());
$$;

revoke all on function public.increment_pastelink_view(uuid) from public, anon, authenticated;
grant execute on function public.increment_pastelink_view(uuid) to service_role;

commit;
