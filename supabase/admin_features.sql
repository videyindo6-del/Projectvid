-- BoxCellink admin/member expansion. Jalankan SETELAH schema.sql + migrations.sql + referral_vip_migration.sql.
alter table public.profiles add column if not exists email text, add column if not exists is_banned boolean not null default false, add column if not exists last_seen_at timestamptz, add column if not exists premium_expires_at timestamptz;
update public.profiles p set email=u.email from auth.users u where u.id=p.id and p.email is null;
create index if not exists profiles_last_seen_idx on public.profiles(last_seen_at desc);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email) on conflict(id) do update set email=excluded.email; return new; end $$;

create table if not exists public.announcements(id uuid primary key default gen_random_uuid(),title text not null,body text not null,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.vip_groups(id uuid primary key default gen_random_uuid(),name text not null unique,description text not null default '',telegram_url text,member_count integer not null default 0,status public.publish_status not null default 'draft',created_at timestamptz not null default now());
create table if not exists public.admin_discount_codes(id uuid primary key default gen_random_uuid(),code text not null unique,discount_percent integer not null check(discount_percent between 10 and 75),min_purchase bigint not null default 7000 check(min_purchase>=7000),claim_limit integer not null default 1,claimed_count integer not null default 0,expires_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.admin_discount_claims(id uuid primary key default gen_random_uuid(),code_id uuid not null references public.admin_discount_codes(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,claimed_at timestamptz not null default now(),used_at timestamptz,used_for text,unique(code_id,user_id));

alter table public.announcements enable row level security; alter table public.vip_groups enable row level security; alter table public.admin_discount_codes enable row level security; alter table public.admin_discount_claims enable row level security;
drop policy if exists "public announcements" on public.announcements; create policy "public announcements" on public.announcements for select using(active or public.is_admin());
drop policy if exists "admin announcements" on public.announcements; create policy "admin announcements" on public.announcements for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public vip groups" on public.vip_groups; create policy "public vip groups" on public.vip_groups for select using(status='published' or public.is_admin());
drop policy if exists "admin vip groups" on public.vip_groups; create policy "admin vip groups" on public.vip_groups for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "active discount codes" on public.admin_discount_codes; create policy "active discount codes" on public.admin_discount_codes for select using(expires_at is null or expires_at>now() or public.is_admin());
drop policy if exists "admin discount codes" on public.admin_discount_codes; create policy "admin discount codes" on public.admin_discount_codes for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists "own discount claims" on public.admin_discount_claims; create policy "own discount claims" on public.admin_discount_claims for select using(auth.uid()=user_id or public.is_admin());

drop policy if exists "admin profiles" on public.profiles; create policy "admin profiles" on public.profiles for all using(public.is_admin()) with check(public.is_admin());

create or replace function public.claim_admin_discount(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.admin_discount_codes%rowtype; v_id uuid;
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED'); end if;
 select * into c from public.admin_discount_codes where upper(code)=upper(trim(p_code)) for update;
 if not found then return jsonb_build_object('ok',false,'reason','CODE_NOT_FOUND'); end if;
 if c.expires_at is not null and c.expires_at<=now() then return jsonb_build_object('ok',false,'reason','EXPIRED'); end if;
 if c.claimed_count>=c.claim_limit then return jsonb_build_object('ok',false,'reason','CLAIM_LIMIT'); end if;
 if exists(select 1 from public.admin_discount_claims where code_id=c.id and user_id=auth.uid()) then return jsonb_build_object('ok',false,'reason','ALREADY_CLAIMED'); end if;
 insert into public.admin_discount_claims(code_id,user_id) values(c.id,auth.uid()) returning id into v_id;
 update public.admin_discount_codes set claimed_count=claimed_count+1 where id=c.id;
 return jsonb_build_object('ok',true,'claim_id',v_id,'code',c.code,'discount_percent',c.discount_percent,'min_purchase',c.min_purchase,'expires_at',c.expires_at);
end $$;
revoke all on function public.claim_admin_discount(text) from public,anon; grant execute on function public.claim_admin_discount(text) to authenticated;

insert into public.announcements(title,body) select 'Selamat datang di BoxCellink','Informasi terbaru dari admin akan tampil di sini.' where not exists(select 1 from public.announcements);
insert into public.vip_groups(name,description,status) values
('Premium Access','Lebih banyak update media, tinggal nonton, update lebih sering setiap hari, dan media dapat di-download.','published'),
('VIP Boxcil','Dapatkan media Boxcil dengan update media lebih banyak, tinggal nonton, dan media dapat di-download.','published'),
('VIP Indo','Dapatkan media Local Indo dengan update media viral terbaru, tinggal nonton, dan media dapat di-download.','published'),
('VIP VGK','Dapatkan media VGK dengan update media, tinggal nonton, dan media dapat di-download.','published') on conflict(name) do nothing;
drop policy if exists "profiles self update" on public.profiles; create policy "profiles self update" on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);
