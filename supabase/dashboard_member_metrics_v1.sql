-- Member dashboard metrics: daily AutoLink visits/earnings and PasteLink views.
-- Run after autolink_publisher_monetization_v1.sql and pastelink_v1.sql.
begin;

create table if not exists public.paste_link_daily_views (
  paste_link_id uuid not null references public.paste_links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stat_date date not null,
  view_count bigint not null default 0 check (view_count >= 0),
  primary key (paste_link_id, stat_date)
);
create index if not exists paste_link_daily_views_user_date_idx
  on public.paste_link_daily_views(user_id, stat_date desc);
alter table public.paste_link_daily_views enable row level security;
revoke all on public.paste_link_daily_views from anon, authenticated;
grant all on public.paste_link_daily_views to service_role;

create or replace function public.increment_pastelink_view(p_paste_link_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid; v_date date := (now() at time zone 'Asia/Jakarta')::date;
begin
  update public.paste_links set view_count=view_count+1
   where id=p_paste_link_id and status='published'
     and (expires_at is null or expires_at>now())
   returning user_id into v_user;
  if v_user is not null then
    insert into public.paste_link_daily_views(paste_link_id,user_id,stat_date,view_count)
    values(p_paste_link_id,v_user,v_date,1)
    on conflict(paste_link_id,stat_date) do update
      set view_count=public.paste_link_daily_views.view_count+1;
  end if;
end $$;
revoke all on function public.increment_pastelink_view(uuid) from public,anon,authenticated;
grant execute on function public.increment_pastelink_view(uuid) to service_role;

create or replace function public.get_member_dashboard_metrics()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid(); v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_total_auto bigint; v_total_paste bigint; v_auto_views bigint; v_paste_views bigint;
  v_earned bigint; v_cpm numeric; v_auto jsonb; v_paste jsonb;
begin
  if v_uid is null then raise exception 'Login diperlukan'; end if;
  select count(*) into v_total_auto from public.autolinks where publisher_id=v_uid and status<>'deleted';
  select count(*) into v_total_paste from public.paste_links where user_id=v_uid and status<>'deleted';
  select count(*) into v_auto_views from public.autolink_visits v join public.autolinks a on a.id=v.autolink_id
    where a.publisher_id=v_uid and v.visited_at >= (v_today::timestamp at time zone 'Asia/Jakarta')
      and v.visited_at < ((v_today+1)::timestamp at time zone 'Asia/Jakarta');
  select coalesce(sum(view_count),0) into v_paste_views from public.paste_link_daily_views where user_id=v_uid and stat_date=v_today;
  select coalesce(free_earned,0)+coalesce(direct_access_earned,0) into v_earned
    from public.publisher_daily_stats where publisher_id=v_uid and stat_date=v_today;
  select coalesce(cpm,50) into v_cpm from public.publisher_balances where publisher_id=v_uid;
  select coalesce(jsonb_agg(jsonb_build_object('date',d::date::text,'views',coalesce(x.views,0),'earned',coalesce(x.earned,0),'cpm',coalesce(x.cpm,0)) order by d),'[]'::jsonb)
    into v_auto from generate_series(v_today-13,v_today,interval '1 day') g(d)
    left join (
      select days.d::date as day, coalesce(vis.views,0) as views,
        coalesce(ps.free_earned,0)+coalesce(ps.direct_access_earned,0) as earned, coalesce(pb.cpm,0) as cpm
      from generate_series(v_today-13,v_today,interval '1 day') days(d)
      left join lateral (select count(*) views from public.autolink_visits av join public.autolinks al on al.id=av.autolink_id
        where al.publisher_id=v_uid and av.visited_at >= (days.d::date::timestamp at time zone 'Asia/Jakarta')
          and av.visited_at < ((days.d::date+1)::timestamp at time zone 'Asia/Jakarta')) vis on true
      left join public.publisher_daily_stats ps on ps.publisher_id=v_uid and ps.stat_date=days.d::date
      left join public.publisher_balances pb on pb.publisher_id=v_uid
    ) x on x.day=d::date;
  select coalesce(jsonb_agg(jsonb_build_object('date',d::date::text,'views',coalesce(x.views,0)) order by d),'[]'::jsonb)
    into v_paste from generate_series(v_today-13,v_today,interval '1 day') g(d)
    left join (select stat_date, sum(view_count) views from public.paste_link_daily_views where user_id=v_uid and stat_date between v_today-13 and v_today group by stat_date) x on x.stat_date=d::date;
  return jsonb_build_object('total_autolinks',v_total_auto,'auto_today_views',v_auto_views,
    'auto_today_earned',coalesce(v_earned,0),'cpm',coalesce(v_cpm,50),'auto_trend',v_auto,
    'total_pastelinks',v_total_paste,'paste_today_views',v_paste_views,'paste_trend',v_paste);
end $$;
revoke all on function public.get_member_dashboard_metrics() from public,anon;
grant execute on function public.get_member_dashboard_metrics() to authenticated;
commit;
