-- Account Center v2: secure other-device cleanup and Telegram review viewing history.
-- Run after supabase/account_center_v1.sql and the core Review Media migrations.
begin;

create or replace function public.clear_other_account_login_devices(p_current_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text := left(btrim(coalesce(p_current_device_id,'')),128);
  v_deleted integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED');
  end if;
  if v_current='' then
    return jsonb_build_object('ok',false,'reason','DEVICE_ID_REQUIRED');
  end if;
  delete from public.account_login_devices
  where user_id=auth.uid() and device_id<>v_current;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok',true,'deleted_devices',v_deleted);
end;
$$;
revoke all on function public.clear_other_account_login_devices(text) from public,anon;
grant execute on function public.clear_other_account_login_devices(text) to authenticated;

create table if not exists public.review_watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.review_items(id) on delete cascade,
  watched_at timestamptz not null default now(),
  constraint review_watch_history_user_review_unique unique(user_id,review_id)
);
create index if not exists review_watch_history_user_time_idx
  on public.review_watch_history(user_id,watched_at desc);
alter table public.review_watch_history enable row level security;
drop policy if exists "users read own review watch history" on public.review_watch_history;
create policy "users read own review watch history"
  on public.review_watch_history for select to authenticated
  using (auth.uid()=user_id);
revoke all on public.review_watch_history from anon,authenticated;
grant select on public.review_watch_history to authenticated;

create or replace function public.record_review_watch(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED');
  end if;
  if p_review_id is null then
    return jsonb_build_object('ok',false,'reason','REVIEW_ID_REQUIRED');
  end if;
  insert into public.review_watch_history(user_id,review_id,watched_at)
  select auth.uid(),r.id,now()
  from public.review_items r
  where r.id=p_review_id and r.status='published'
  on conflict(user_id,review_id) do update set watched_at=excluded.watched_at;
  if not found then
    return jsonb_build_object('ok',false,'reason','REVIEW_NOT_AVAILABLE');
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.record_review_watch(uuid) from public,anon;
grant execute on function public.record_review_watch(uuid) to authenticated;

commit;
