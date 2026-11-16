-- BoxCellink AutoLink dashboard + publisher withdraw permission repair
-- Run once in Supabase SQL Editor AFTER autolink_publisher_monetization_v1.sql.
begin;

do $$
begin
  if to_regclass('public.publisher_balances') is null then
    raise exception 'Tabel publisher_balances belum ada. Jalankan supabase/autolink_publisher_monetization_v1.sql terlebih dahulu.';
  end if;
  if to_regclass('public.autolinks') is null then
    raise exception 'Tabel autolinks belum ada. Jalankan supabase/autolink_publisher_monetization_v1.sql terlebih dahulu.';
  end if;
end $$;

-- PasteLink short codes require the Social Posts v1 table.
do $$
begin
  if to_regclass('public.social_posts') is null then
    raise exception 'Tabel social_posts belum ada. Jalankan supabase/social_posts_v1.sql terlebih dahulu.';
  end if;
end $$;
alter table public.social_posts add column if not exists short_code varchar(12);
update public.social_posts
set short_code = lower(substr(replace(gen_random_uuid()::text,'-',''),1,6))
where short_code is null;
create unique index if not exists social_posts_short_code_uidx
  on public.social_posts(short_code) where short_code is not null;

alter table public.publisher_balances enable row level security;
alter table public.publisher_withdrawals enable row level security;
alter table public.publisher_daily_stats enable row level security;
alter table public.publisher_cpm_history enable row level security;

drop policy if exists publisher_balances_read_own on public.publisher_balances;
create policy publisher_balances_read_own on public.publisher_balances
  for select to authenticated using (publisher_id = auth.uid() or public.is_admin());

drop policy if exists publisher_withdrawals_read_own on public.publisher_withdrawals;
create policy publisher_withdrawals_read_own on public.publisher_withdrawals
  for select to authenticated using (publisher_id = auth.uid() or public.is_admin());

drop policy if exists publisher_daily_stats_read_own on public.publisher_daily_stats;
create policy publisher_daily_stats_read_own on public.publisher_daily_stats
  for select to authenticated using (publisher_id = auth.uid() or public.is_admin());

drop policy if exists publisher_cpm_history_read_own on public.publisher_cpm_history;
create policy publisher_cpm_history_read_own on public.publisher_cpm_history
  for select to authenticated using (publisher_id = auth.uid() or public.is_admin());

-- The previous migration revoked these grants after initially granting them.
-- RLS continues to restrict each member to their own rows.
grant select on public.publisher_balances, public.publisher_withdrawals,
  public.publisher_daily_stats, public.publisher_cpm_history to authenticated;

grant select on public.autolink_public to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Keep the publisher's create/withdraw actions inside security-definer RPCs.
revoke insert, update, delete on public.publisher_balances from anon, authenticated;
revoke insert, update, delete on public.publisher_withdrawals from anon, authenticated;

commit;
