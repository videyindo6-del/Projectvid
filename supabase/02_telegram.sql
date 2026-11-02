-- Telegram catalog with protected download URLs. Safe to re-run.
do $$ begin create type public.telegram_type as enum ('free','paid'); exception when duplicate_object then null; end $$;
create table if not exists public.telegram_items (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 type public.telegram_type not null default 'free',
 review_embed_url text,
 price bigint not null default 0 check(price >= 0),
 category_id uuid references public.categories(id) on delete set null,
 server_id uuid references public.servers(id) on delete set null,
 status public.publish_status not null default 'draft',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.telegram_items add column if not exists type public.telegram_type not null default 'free';
alter table public.telegram_items add column if not exists review_embed_url text;
alter table public.telegram_items add column if not exists price bigint not null default 0;
alter table public.telegram_items add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.telegram_items add column if not exists server_id uuid references public.servers(id) on delete set null;
alter table public.telegram_items add column if not exists status public.publish_status not null default 'draft';
alter table public.telegram_items add column if not exists created_at timestamptz not null default now();
alter table public.telegram_items add column if not exists updated_at timestamptz not null default now();

-- Move any legacy public download_url values into an admin-only table, then remove the exposed column.
create table if not exists public.telegram_assets (
 item_id uuid primary key references public.telegram_items(id) on delete cascade,
 download_url text not null,
 updated_at timestamptz not null default now()
);
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='telegram_items' and column_name='download_url') then
   execute 'insert into public.telegram_assets(item_id,download_url)
            select id,download_url from public.telegram_items
            where download_url is not null and btrim(download_url) <> ''''
            on conflict(item_id) do update set download_url=excluded.download_url,updated_at=now()';
   alter table public.telegram_items drop column download_url;
 end if;
end $$;

create table if not exists public.telegram_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id uuid not null references public.telegram_items(id) on delete restrict,
 amount bigint not null check(amount >= 0),
 status text not null default 'pending' check(status in ('pending','paid','cancelled','expired','refunded')),
 provider text,
 provider_reference text,
 created_at timestamptz not null default now(),
 paid_at timestamptz,
 unique(user_id,item_id,id)
);
create index if not exists telegram_orders_user_item_status_idx on public.telegram_orders(user_id,item_id,status);

alter table public.telegram_items enable row level security;
alter table public.telegram_assets enable row level security;
alter table public.telegram_orders enable row level security;
drop policy if exists "published telegram" on public.telegram_items;
drop policy if exists "admin telegram" on public.telegram_items;
create policy "published telegram catalog" on public.telegram_items for select using(status='published' or public.is_admin());
create policy "admin telegram items" on public.telegram_items for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admin telegram assets" on public.telegram_assets;
create policy "admin telegram assets" on public.telegram_assets for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "orders owner read" on public.telegram_orders;
drop policy if exists "admin orders manage" on public.telegram_orders;
create policy "orders owner or admin read" on public.telegram_orders for select using(user_id=auth.uid() or public.is_admin());
create policy "admin orders manage" on public.telegram_orders for all using(public.is_admin()) with check(public.is_admin());

grant select on public.telegram_items to anon,authenticated;
grant insert,update,delete on public.telegram_items to authenticated;\ngrant select,insert,update,delete on public.telegram_assets to authenticated;\ngrant update on public.telegram_orders to authenticated;
grant select on public.telegram_orders to authenticated;

-- Authenticated user can create an order only for a published paid item. No client can mark it paid.
create or replace function public.create_telegram_order(p_item_id uuid)
returns uuid language plpgsql security definer set search_path=public,auth
as $$
declare v_id uuid; v_price bigint;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 select price into v_price from public.telegram_items
 where id=p_item_id and type='paid' and status='published';
 if not found then raise exception 'ITEM_NOT_AVAILABLE'; end if;
 insert into public.telegram_orders(user_id,item_id,amount) values(auth.uid(),p_item_id,v_price) returning id into v_id;
 return v_id;
end $$;

-- The URL is returned only for Free items or after a verified paid order exists.
create or replace function public.get_telegram_download(p_item_id uuid)
returns text language plpgsql stable security definer set search_path=public,auth
as $$
declare v_type public.telegram_type; v_url text;
begin
 select type into v_type from public.telegram_items where id=p_item_id and status='published';
 if not found then raise exception 'ITEM_NOT_AVAILABLE'; end if;
 if v_type='paid' and not public.is_admin() and not exists(
   select 1 from public.telegram_orders o where o.item_id=p_item_id and o.user_id=auth.uid() and o.status='paid'
 ) then raise exception 'PAYMENT_REQUIRED'; end if;
 select download_url into v_url from public.telegram_assets where item_id=p_item_id;
 if v_url is null then raise exception 'DOWNLOAD_NOT_CONFIGURED'; end if;
 return v_url;
end $$;
revoke all on function public.get_telegram_download(uuid) from public;
grant execute on function public.get_telegram_download(uuid) to anon,authenticated;
revoke all on function public.create_telegram_order(uuid) from public;
grant execute on function public.create_telegram_order(uuid) to authenticated;
