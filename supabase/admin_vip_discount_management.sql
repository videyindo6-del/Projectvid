-- Run after schema.sql, admin_features.sql, referral_vip_migration.sql and vip_group_account_migration.sql.
-- Ensure VIP group pricing exists.
alter table public.vip_groups add column if not exists price bigint not null default 5000 check(price>=2000);
-- Admin-created promo codes are claimable by 2-10 distinct members.
update public.admin_discount_codes set claim_limit=greatest(2,least(10,claim_limit)) where id is not null;
alter table public.admin_discount_codes drop constraint if exists admin_discount_codes_claim_limit_check;
alter table public.admin_discount_codes add constraint admin_discount_codes_claim_limit_check check(claim_limit between 2 and 10);
alter table public.admin_discount_codes alter column claim_limit set default 2;
alter table public.admin_discount_codes add column if not exists min_purchase bigint not null default 7000;
alter table public.admin_discount_codes add column if not exists expires_at timestamptz;
alter table public.admin_discount_codes add column if not exists claimed_count integer not null default 0;
create unique index if not exists admin_discount_codes_code_upper_uidx on public.admin_discount_codes(upper(code));
