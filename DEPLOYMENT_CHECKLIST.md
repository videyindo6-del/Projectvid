# BoxCellink — deployment and verification checklist

## Required deployment order

1. Apply `supabase/schema.sql` to the intended Supabase project (only for a fresh project).
2. Apply `supabase/migrations.sql`.
3. Apply `supabase/referral_vip_migration.sql`.
4. Apply `supabase/admin_features.sql`.
5. Apply `supabase/vip_group_account_migration.sql`.
6. Apply `supabase/final_hardening_migration.sql` LAST. This migration closes profile privilege escalation and replaces payment settlement with an atomic implementation.

If the project already has production data, take a Supabase backup before applying migrations. Do not re-run the base `schema.sql` on an existing database without reviewing it first.

## Supabase Edge Function secrets

Set these in Supabase Dashboard → Edge Functions → Secrets:

- `CASHI_API_KEY`
- `CASHI_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never put `CASHI_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in browser JavaScript, HTML, or a public repository. The Supabase anon/publishable key is intended for browser use and must rely on correct RLS policies.

## Deploy Edge Functions

Deploy all four functions from `supabase/functions/`:

- `create-payment`
- `payment-status`
- `cashi-webhook`
- `download-link`

Configure the Cashi webhook URL to the deployed `cashi-webhook` function URL and confirm the gateway's exact signature header/algorithm against its current documentation before enabling live payments.

## Cloudflare Pages

Deploy the contents of `Projectvid-main/` as the Pages output directory. Confirm the production domain is added to Supabase Authentication → URL Configuration → Site URL and Redirect URLs. Add both the production origin and any preview origins actually used. Keep the `_redirects` file in the deployed root.

## Manual acceptance tests (required before production)

- Open `/login` while signed out; it must show the login form and must not add nested `next` parameters.
- Sign in as a member and as an admin; verify role-based landing pages.
- Verify a member cannot update their own `role`, `is_banned`, VIP expiry, referral code, or email through the Supabase client.
- Verify an admin can manage categories, servers, users, videos, Telegram items, VIP plans, and VIP groups.
- Test VIP, review-download, and VIP-group payments using gateway sandbox/test mode. Verify wrong amount, duplicate webhook, expired order, missing Telegram invite, and repeated status polling.
- Verify download links and paid review content are returned only after a matching entitlement exists.
- Test referral signup, coupon reservation, coupon release after failed/expired orders, and coupon consumption after settlement.
- Test on iOS Safari and desktop browsers.

This checklist does not claim live gateway/database verification: those require access to the deployed Supabase project and Cashi test credentials.
