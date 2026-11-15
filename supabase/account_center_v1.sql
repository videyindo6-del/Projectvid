-- BoxCellink Account Center v1
-- Run in Supabase SQL Editor AFTER the existing project migrations,
-- including review_delete_preserve_orders.sql and boxcellink_wallet_withdraw_v2.sql.

begin;

-- Public member username. Keep full_name unchanged for account/legal display.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

create or replace function public.update_my_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(btrim(coalesce(p_username,'')));
  v_owner uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED');
  end if;
  if v_username !~ '^[a-z0-9_.]{3,24}$' then
    return jsonb_build_object('ok',false,'reason','USERNAME_INVALID');
  end if;
  select id into v_owner from public.profiles
    where lower(username)=v_username and id<>auth.uid()
    limit 1;
  if v_owner is not null then
    return jsonb_build_object('ok',false,'reason','USERNAME_TAKEN');
  end if;
  update public.profiles set username=v_username where id=auth.uid();
  if not found then
    return jsonb_build_object('ok',false,'reason','PROFILE_NOT_FOUND');
  end if;
  return jsonb_build_object('ok',true,'username',v_username);
exception when unique_violation then
  return jsonb_build_object('ok',false,'reason','USERNAME_TAKEN');
end;
$$;
revoke all on function public.update_my_username(text) from public, anon;
grant execute on function public.update_my_username(text) to authenticated;

-- Immutable snapshot of paid Review Media purchases for signed-in members.
-- This keeps the account's purchase history even if an admin later removes the
-- source review item (the original cashi_orders row is also retained).
create table if not exists public.review_purchase_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null unique references public.cashi_orders(order_id) on delete restrict,
  review_id uuid,
  title text not null,
  slug text,
  thumbnail_url text,
  review_embed_url text,
  gallery_urls jsonb not null default '[]'::jsonb,
  amount bigint not null default 0,
  purchased_at timestamptz not null default now()
);
create index if not exists review_purchase_history_user_date_idx
  on public.review_purchase_history(user_id,purchased_at desc);
alter table public.review_purchase_history enable row level security;
drop policy if exists "users read own review purchase history" on public.review_purchase_history;
create policy "users read own review purchase history"
  on public.review_purchase_history for select to authenticated
  using (auth.uid()=user_id);
revoke all on public.review_purchase_history from anon, authenticated;
grant select on public.review_purchase_history to authenticated;

create or replace function public.snapshot_review_purchase_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status='SETTLED'
     and new.purpose='review_download'
     and new.user_id is not null
     and new.review_id is not null
     and (tg_op='INSERT' or old.status is distinct from 'SETTLED') then
    insert into public.review_purchase_history(
      user_id,order_id,review_id,title,slug,thumbnail_url,
      review_embed_url,gallery_urls,amount,purchased_at
    )
    select new.user_id,new.order_id,r.id,r.title,r.slug,r.thumbnail_url,
      r.review_embed_url,coalesce(to_jsonb(r)->'gallery_urls','[]'::jsonb),
      new.amount,coalesce(new.settled_at,new.created_at,now())
    from public.review_items r
    where r.id=new.review_id
    on conflict(order_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists snapshot_review_purchase_history on public.cashi_orders;
create trigger snapshot_review_purchase_history
  after insert or update of status on public.cashi_orders
  for each row execute function public.snapshot_review_purchase_history();

-- Backfill snapshots for all existing settled member purchases whose review
-- item is still available at migration time.
insert into public.review_purchase_history(
  user_id,order_id,review_id,title,slug,thumbnail_url,
  review_embed_url,gallery_urls,amount,purchased_at
)
select o.user_id,o.order_id,r.id,r.title,r.slug,r.thumbnail_url,
  r.review_embed_url,coalesce(to_jsonb(r)->'gallery_urls','[]'::jsonb),
  o.amount,coalesce(o.settled_at,o.created_at,now())
from public.cashi_orders o
join public.review_items r on r.id=o.review_id
where o.purpose='review_download' and o.status='SETTLED' and o.user_id is not null
on conflict(order_id) do nothing;

-- If a review item is deleted, keep the purchase snapshot but remove stale
-- content URLs so the Account page does not present a dead link as active.
create or replace function public.mark_deleted_review_in_purchase_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.review_purchase_history
    set slug=null,thumbnail_url=null,review_embed_url=null,gallery_urls='[]'::jsonb
  where review_id=old.id;
  return old;
end;
$$;
drop trigger if exists mark_deleted_review_in_purchase_history on public.review_items;
create trigger mark_deleted_review_in_purchase_history
  before delete on public.review_items
  for each row execute function public.mark_deleted_review_in_purchase_history();

-- Public comments can resolve a member's public handle without exposing email
-- or other private profile fields.
create or replace function public.get_public_usernames(p_user_ids uuid[])
returns table(user_id uuid, username text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username
  from public.profiles p
  where p.id = any(coalesce(p_user_ids,'{}'::uuid[]))
    and p.username is not null;
$$;
revoke all on function public.get_public_usernames(uuid[]) from public;
grant execute on function public.get_public_usernames(uuid[]) to anon, authenticated;

-- Device login history. This is a device/browser history, not a full list of
-- Supabase refresh-token sessions. "Sign out other devices" uses Supabase Auth.
create table if not exists public.account_login_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_label text not null default 'Unknown device',
  user_agent text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key(user_id,device_id)
);
create index if not exists account_login_devices_user_last_seen_idx
  on public.account_login_devices(user_id,last_seen_at desc);
alter table public.account_login_devices enable row level security;
drop policy if exists "users read own account login devices" on public.account_login_devices;
create policy "users read own account login devices"
  on public.account_login_devices for select to authenticated
  using (auth.uid()=user_id);
revoke all on public.account_login_devices from anon, authenticated;
grant select on public.account_login_devices to authenticated;

create or replace function public.record_account_login(
  p_device_id text,
  p_device_label text,
  p_user_agent text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new boolean;
  v_device_id text := left(btrim(coalesce(p_device_id,'')),128);
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED');
  end if;
  if v_device_id='' then
    return jsonb_build_object('ok',false,'reason','DEVICE_ID_REQUIRED');
  end if;
  select not exists(
    select 1 from public.account_login_devices
    where user_id=auth.uid() and device_id=v_device_id
  ) into v_new;
  insert into public.account_login_devices(user_id,device_id,device_label,user_agent)
  values(auth.uid(),v_device_id,left(coalesce(nullif(btrim(p_device_label),''),'Unknown device'),120),left(coalesce(p_user_agent,''),1000))
  on conflict(user_id,device_id) do update set
    device_label=excluded.device_label,
    user_agent=excluded.user_agent,
    last_seen_at=now();
  return jsonb_build_object('ok',true,'is_new',v_new);
end;
$$;
revoke all on function public.record_account_login(text,text,text) from public, anon;
grant execute on function public.record_account_login(text,text,text) to authenticated;

-- Track actual seconds for native video players on the Watch page.
alter table public.video_watch_history
  add column if not exists watched_seconds integer not null default 0;
create or replace function public.add_video_watch_seconds(
  p_video_id uuid,
  p_seconds integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_video_id is null
     or p_seconds is null or p_seconds<1 or p_seconds>30 then
    return;
  end if;
  update public.video_watch_history
    set watched_seconds=watched_seconds+p_seconds,
        watched_at=now()
  where user_id=auth.uid() and video_id=p_video_id;
end;
$$;
revoke all on function public.add_video_watch_seconds(uuid,integer) from public, anon;
grant execute on function public.add_video_watch_seconds(uuid,integer) to authenticated;

-- VIP purchase rows remain permanent. Their invite URL is only returned for
-- 24 hours from the latest purchase; repurchasing refreshes that window.
alter table public.vip_group_entitlements
  add column if not exists invite_expires_at timestamptz;
update public.vip_group_entitlements
  set invite_expires_at=created_at + interval '24 hours'
  where invite_expires_at is null
     or invite_expires_at < created_at + interval '24 hours';

create or replace function public.set_vip_group_invite_expiry()
returns trigger
language plpgsql
as $$
begin
  new.invite_expires_at := coalesce(new.created_at,now()) + interval '24 hours';
  return new;
end;
$$;
drop trigger if exists vip_group_invite_expiry_24h on public.vip_group_entitlements;
create trigger vip_group_invite_expiry_24h
  before insert or update of created_at, invite_expires_at
  on public.vip_group_entitlements
  for each row execute function public.set_vip_group_invite_expiry();

create or replace function public.get_my_vip_group_entitlements()
returns table(
  entitlement_id uuid,
  group_id uuid,
  group_name text,
  purchased_at timestamptz,
  invite_expires_at timestamptz,
  telegram_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.group_id,
    g.name,
    e.created_at,
    e.invite_expires_at,
    case
      when e.invite_expires_at > now()
      then coalesce(nullif(s.telegram_url,''),e.telegram_url)
      else null
    end
  from public.vip_group_entitlements e
  join public.vip_groups g on g.id=e.group_id
  left join public.vip_group_secrets s on s.group_id=e.group_id
  where e.user_id=auth.uid()
  order by e.created_at desc;
$$;
revoke all on function public.get_my_vip_group_entitlements() from public, anon;
grant execute on function public.get_my_vip_group_entitlements() to authenticated;

commit;
