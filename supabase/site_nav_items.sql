-- Admin-managed public/member navbar items for BoxCellink.
create table if not exists public.site_nav_items (
 id uuid primary key default gen_random_uuid(),
 label text not null check(length(trim(label)) between 1 and 40),
 href text not null check(href ~ '^(https://[^[:space:]]+|/[^/][^[:space:]]*|/)$'),
 icon text not null default 'fa-solid fa-link' check(icon ~ '^(fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$'),
 tag text check(tag is null or upper(tag) in ('NEW','TREND','BETA')),
 tag_color text not null default '#2563eb' check(tag_color ~ '^#[0-9a-fA-F]{6}$'),
 bg_color text not null default '#eff6ff' check(bg_color ~ '^#[0-9a-fA-F]{6}$'),
 text_color text not null default '#334155' check(text_color ~ '^#[0-9a-fA-F]{6}$'),
 visibility text not null default 'all' check(visibility in ('all','guest','member')),
 sort_order integer not null default 50,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.site_nav_items enable row level security;
drop policy if exists "public active navbar items" on public.site_nav_items;
create policy "public active navbar items" on public.site_nav_items for select using(active or public.is_admin());
drop policy if exists "admin manages navbar items" on public.site_nav_items;
create policy "admin manages navbar items" on public.site_nav_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.site_nav_items to anon,authenticated;
grant insert,update,delete on public.site_nav_items to authenticated;

-- Keep admin announcements visible in each member's notification inbox.
-- Run this after BoxCellink-affiliate-wallet-notifications-FIXED.sql.
alter table public.boxcellink_notifications add column if not exists source_id uuid;
alter table public.boxcellink_notifications add column if not exists is_admin_managed boolean not null default false;
create unique index if not exists boxcellink_notifications_announcement_uidx
 on public.boxcellink_notifications(source_id,user_id)
 where is_admin_managed and source_id is not null;
create or replace function public.publish_announcement_notification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  delete from public.boxcellink_notifications where source_id=old.id and is_admin_managed;
  return old;
 end if;
 if new.active then
  insert into public.boxcellink_notifications(user_id,title,body,kind,href,source_id,is_admin_managed)
  select p.id,new.title,new.body,'announcement','/notifications.html',new.id,true
  from public.profiles p
  where not exists(select 1 from public.boxcellink_notifications n where n.user_id=p.id and n.source_id=new.id and n.is_admin_managed);
  update public.boxcellink_notifications set title=new.title,body=new.body
   where source_id=new.id and is_admin_managed;
 else
  delete from public.boxcellink_notifications where source_id=new.id and is_admin_managed;
 end if;
 return new;
end $$;
drop trigger if exists announcements_to_notifications on public.announcements;
create trigger announcements_to_notifications after insert or update or delete on public.announcements
for each row execute function public.publish_announcement_notification();
