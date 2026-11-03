-- Jalankan setelah schema.sql. Migrasi BoxCellink + Cashi.
create extension if not exists pgcrypto;
create table if not exists public.review_items (
 id uuid primary key default gen_random_uuid(), title text not null, slug text unique,
 description text not null default '', review_embed_url text, thumbnail_url text,
 price bigint not null default 0 check(price>=0),
 access text not null default 'paid' check(access in ('free','paid')),
 category_id uuid references public.categories(id) on delete set null,
 status public.publish_status not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cashi_orders (
 id uuid primary key default gen_random_uuid(), order_id text not null unique,
 user_id uuid not null references auth.users(id) on delete cascade,
 purpose text not null check(purpose in ('vip','review_download')),
 plan_id uuid references public.vip_plans(id), review_id uuid references public.review_items(id),
 amount bigint not null check(amount>=2000), status text not null default 'PENDING' check(status in ('PENDING','SETTLED','EXPIRED','FAILED')),
 checkout_url text, provider_amount bigint, gateway_payload jsonb, settled_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint order_target_check check ((purpose='vip' and plan_id is not null and review_id is null) or (purpose='review_download' and review_id is not null and plan_id is null))
);
create table if not exists public.review_download_secrets (review_id uuid primary key references public.review_items(id) on delete cascade, download_url text not null, updated_at timestamptz not null default now());
create table if not exists public.review_entitlements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 review_id uuid not null references public.review_items(id) on delete cascade,
 order_id text unique references public.cashi_orders(order_id), created_at timestamptz not null default now(), unique(user_id,review_id)
);
alter table public.review_items enable row level security;
alter table public.cashi_orders enable row level security;
alter table public.review_entitlements enable row level security;
alter table public.review_download_secrets enable row level security;
drop policy if exists "admin review secrets" on public.review_download_secrets;
create policy "admin review secrets" on public.review_download_secrets for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "published review items" on public.review_items;
create policy "published review items" on public.review_items for select using(status='published' or public.is_admin());
drop policy if exists "admin review items" on public.review_items;
create policy "admin review items" on public.review_items for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "own orders read" on public.cashi_orders;
create policy "own orders read" on public.cashi_orders for select using(auth.uid()=user_id or public.is_admin());
drop policy if exists "own entitlements read" on public.review_entitlements;
create policy "own entitlements read" on public.review_entitlements for select using(auth.uid()=user_id or public.is_admin());
-- Hanya service role/webhook yang boleh memanggil RPC ini.
create or replace function public.settle_cashi_order(p_order_id text,p_amount bigint,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.cashi_orders%rowtype; v_exp timestamptz;
begin
 select * into o from public.cashi_orders where order_id=p_order_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
 if o.status='SETTLED' then return jsonb_build_object('ok',true,'duplicate',true); end if;
 if p_amount is null or p_amount <> o.amount then return jsonb_build_object('ok',false,'reason','AMOUNT_MISMATCH'); end if;
 if o.status <> 'PENDING' then return jsonb_build_object('ok',false,'reason','ORDER_NOT_PAYABLE'); end if;
 update public.cashi_orders set status='SETTLED',provider_amount=p_amount,gateway_payload=p_payload,settled_at=now(),updated_at=now() where order_id=p_order_id;
 if o.purpose='vip' then
   select greatest(coalesce(vip_expires_at,now()),now()) into v_exp from public.profiles where id=o.user_id;
   update public.profiles set vip_expires_at=coalesce(v_exp,now()) + make_interval(days=>(select duration_days from public.vip_plans where id=o.plan_id)) where id=o.user_id;
 else
   insert into public.review_entitlements(user_id,review_id,order_id) values(o.user_id,o.review_id,o.order_id) on conflict(user_id,review_id) do nothing;
 end if;
 return jsonb_build_object('ok',true,'duplicate',false);
end $$;
revoke all on function public.settle_cashi_order(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.settle_cashi_order(text,bigint,jsonb) to service_role;

-- Pretty URLs, gallery review, engagement and access controls
alter table public.videos add column if not exists slug text unique;
alter table public.videos add column if not exists thumbnail_url text;
alter table public.videos add column if not exists view_count bigint not null default 0;
alter table public.videos add column if not exists access_scope text not null default 'everyone' check(access_scope in ('everyone','login','vip'));
alter table public.review_items add column if not exists gallery_urls jsonb not null default '[]'::jsonb;
alter table public.review_items add column if not exists view_count bigint not null default 0;
create table if not exists public.video_likes(id uuid primary key default gen_random_uuid(),video_id uuid not null references public.videos(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),unique(video_id,user_id));
create table if not exists public.video_comments(id uuid primary key default gen_random_uuid(),video_id uuid not null references public.videos(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,body text not null check(length(body) between 1 and 1500),created_at timestamptz not null default now());
alter table public.video_likes enable row level security; alter table public.video_comments enable row level security;
drop policy if exists "likes visible" on public.video_likes;
create policy "likes visible" on public.video_likes for select using(true);
drop policy if exists "user manages own likes" on public.video_likes;
create policy "user manages own likes" on public.video_likes for insert with check(auth.uid()=user_id);
drop policy if exists "user removes own likes" on public.video_likes;
create policy "user removes own likes" on public.video_likes for delete using(auth.uid()=user_id);
drop policy if exists "comments visible" on public.video_comments;
create policy "comments visible" on public.video_comments for select using(true);
drop policy if exists "signed users comment" on public.video_comments;
create policy "signed users comment" on public.video_comments for insert with check(auth.uid()=user_id);
create or replace function public.increment_video_view(p_video_id uuid) returns void language sql security definer set search_path=public as $$ update public.videos set view_count=view_count+1 where id=p_video_id and status='published'; $$;
revoke all on function public.increment_video_view(uuid) from public; grant execute on function public.increment_video_view(uuid) to anon,authenticated;
create table if not exists public.review_content_secrets(review_id uuid primary key references public.review_items(id) on delete cascade,content_after_payment text not null default '',updated_at timestamptz not null default now());
alter table public.review_content_secrets enable row level security;
drop policy if exists "admin review content secret" on public.review_content_secrets;
create policy "admin review content secret" on public.review_content_secrets for all using(public.is_admin()) with check(public.is_admin());

-- Security hardening: keep private review content out of the public review table.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='review_items' and column_name='content_after_payment') then
    insert into public.review_content_secrets(review_id,content_after_payment)
    select id,coalesce(content_after_payment,'') from public.review_items
    where content_after_payment is not null
    on conflict(review_id) do update set content_after_payment=excluded.content_after_payment;
    alter table public.review_items drop column content_after_payment;
  end if;
end $$;

-- Restrict direct video reads according to the access_scope field.
drop policy if exists "published videos" on public.videos;
create policy "published videos" on public.videos for select using (
 status='published' and (
   (access='public' and access_scope='everyone')
   or (access='public' and access_scope='login' and auth.uid() is not null)
   or ((access='vip' or access_scope='vip') and auth.uid() is not null and exists(
     select 1 from public.profiles p where p.id=auth.uid() and p.vip_expires_at>now()
   ))
 ) or public.is_admin()
);

create or replace function public.increment_review_view(p_review_id uuid)
returns void language sql security definer set search_path=public as $$
 update public.review_items set view_count=view_count+1 where id=p_review_id and status='published';
$$;
revoke all on function public.increment_review_view(uuid) from public;
grant execute on function public.increment_review_view(uuid) to anon,authenticated;

-- Ensure only admins can read/write private secret tables; no public grants.
revoke all on public.review_download_secrets, public.review_content_secrets from anon, authenticated;
-- Admin dashboard uses the authenticated Supabase client; RLS still limits these tables to admins.
revoke all on public.review_download_secrets, public.review_content_secrets from anon;
grant select, insert, update, delete on public.review_download_secrets, public.review_content_secrets to authenticated;
