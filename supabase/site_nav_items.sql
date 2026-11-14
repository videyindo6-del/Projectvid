-- Admin-managed public/member navbar items for BoxCellink.
create table if not exists public.site_nav_items (
 id uuid primary key default gen_random_uuid(),
 label text not null check(length(trim(label)) between 1 and 40),
 href text not null check(href ~ '^(https://[^[:space:]]+|/[^/][^[:space:]]*|/)$'),
 icon text not null default 'fa-solid fa-link' check(icon ~ '^(fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$'),
 tag text check(tag is null or upper(tag) in ('NEW','TREND','BETA','PROMO')),
 tag_color text not null default '#2563eb' check(tag_color ~ '^#[0-9a-fA-F]{6}$'),
 bg_color text not null default '#eff6ff' check(bg_color ~ '^#[0-9a-fA-F]{6}$'),
 text_color text not null default '#334155' check(text_color ~ '^#[0-9a-fA-F]{6}$'),
 visibility text not null default 'all' check(visibility in ('all','guest','member')),
 sort_order integer not null default 50,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.site_nav_items drop constraint if exists site_nav_items_tag_check;
alter table public.site_nav_items add constraint site_nav_items_tag_check check(tag is null or upper(tag) in ('NEW','TREND','BETA','PROMO'));
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

-- Allow each member to manage read state and delete their own announcement copies.
drop policy if exists "notifications update own" on public.boxcellink_notifications;
create policy "notifications update own" on public.boxcellink_notifications
 for update to authenticated using(user_id=auth.uid() and user_id is not null)
 with check(user_id=auth.uid() and user_id is not null);
drop policy if exists "notifications delete own or admin" on public.boxcellink_notifications;
create policy "notifications delete own or admin" on public.boxcellink_notifications
 for delete to authenticated using((user_id=auth.uid() and user_id is not null) or public.is_admin());


-- Members may delete only their own notifications after they have been read.
-- Unread notifications remain protected even when the client sends a delete request.
drop policy if exists "notifications delete own or admin" on public.boxcellink_notifications;
create policy "notifications delete own or admin" on public.boxcellink_notifications
 for delete to authenticated
 using ((user_id=auth.uid() and user_id is not null and is_read=true) or public.is_admin());
grant delete on public.boxcellink_notifications to authenticated;

-- Notify the buyer after a verified Cashi settlement.
-- Telegram purchases link directly to the purchased review; other purchase types
-- keep their existing destinations. source_id prevents duplicate notices on retries.
create unique index if not exists boxcellink_notifications_purchase_source_uidx
 on public.boxcellink_notifications(source_id,user_id)
 where kind='purchase' and source_id is not null;

create or replace function public.notify_settled_purchase()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
 v_title text;
 v_body text;
 v_href text;
 v_review_title text;
 v_review_slug text;
begin
 if old.status is distinct from new.status and new.status='SETTLED' then
  if new.purpose='wallet_topup' then
   v_title:='Deposit berhasil';
   v_body:='Saldo deposit bertambah Rp'||to_char(new.amount,'FM999G999G999G990')||'.';
   v_href:='/wallet.html';
  elsif new.purpose='vip' then
   v_title:='Pembelian VIP berhasil';
   v_body:='Membership VIP berhasil diaktifkan.';
   v_href:='/vip.html';
  elsif new.purpose='vip_group' then
   v_title:='Pembelian Group VIP berhasil';
   v_body:='Akses Group VIP sudah tersedia di Akun Saya.';
   v_href:='/account.html';
  elsif new.purpose='review_download' then
   select title,slug into v_review_title,v_review_slug
   from public.review_items where id=new.review_id;
   v_title:='Pembelian Media Telegram Berhasil';
   v_body:='Pembayaran untuk "'||coalesce(v_review_title,'Media Telegram')||'" berhasil. Silakan buka media Telegram yang sudah dibeli.';
   v_href:=case when nullif(v_review_slug,'') is not null then '/r/'||v_review_slug else '/telegram.html' end;
  else
   v_title:='Pembayaran berhasil';
   v_body:='Transaksi Anda berhasil diselesaikan.';
   v_href:='/notifications.html';
  end if;

  insert into public.boxcellink_notifications
   (user_id,title,body,kind,href,source_id,is_admin_managed)
  values(new.user_id,v_title,v_body,'purchase',v_href,new.id,false)
  on conflict (source_id,user_id)
   where kind='purchase' and source_id is not null
  do nothing;
 end if;
 return new;
end;
$$;
