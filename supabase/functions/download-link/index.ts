import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ success: false, error: 'Method tidak diizinkan' }, 405);

  try {
    const authorization = req.headers.get('Authorization');

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) {
      console.error('download-link: Supabase environment variables are incomplete');
      return reply({ success: false, error: 'Konfigurasi Supabase Edge Function belum lengkap. Periksa secrets server.' }, 500);
    }

    // A caller may be anonymous for FREE reviews. If a bearer token is
    // supplied, validate it; never trust a user_id supplied by the browser.
    let user: { id: string } | null = null;
    // supabase-js may send the project's anon key as a Bearer header when
    // there is no signed-in session. That is a public/anonymous caller, not
    // an end-user JWT; do not pass it to auth.getUser().
    const bearerToken = authorization?.replace(/^Bearer\s+/i, '').trim() || '';
    if (bearerToken && bearerToken !== anonKey) {
      const userClient = createClient(url, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error: authError } = await userClient.auth.getUser();
      if (authError || !authData?.user) {
        return reply({ success: false, error: 'Sesi login tidak valid. Silakan login ulang.' }, 401);
      }
      user = { id: authData.user.id };
    }

    // Service role reads protected review metadata and secrets. It is never
    // exposed to the browser. Paid access still requires a validated user.
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let profile: { role?: string | null; is_banned?: boolean | null } | null = null;
    if (user) {
      const { data, error: profileError } = await admin
        .from('profiles')
        .select('role,is_banned')
        .eq('id', user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      profile = data;
      if (!profile) return reply({ success: false, error: 'Profil akun tidak ditemukan.' }, 403);
      if (profile.is_banned) return reply({ success: false, error: 'Akun ini sedang dibatasi.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const reviewId = String(body?.review_id || '').trim();
    if (!reviewId) return reply({ success: false, error: 'ID review tidak dikirim.' }, 400);

    const { data: item, error: itemError } = await admin
      .from('review_items')
      .select('id,title,slug,access,status')
      .eq('id', reviewId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item || item.status !== 'published') {
      return reply({ success: false, error: 'Konten tidak ditemukan atau belum dipublikasikan.' }, 404);
    }

    // Access policy: admin can open all published reviews; every user can
    // open FREE reviews; PAID reviews require a verified entitlement.
    // Normalize the database value to avoid 'Free'/' free ' being treated as paid.
    const isAdmin = String(profile?.role || '').trim().toLowerCase() === 'admin';
    const accessType = String(item.access || '').trim().toLowerCase();
    const isFree = accessType === 'free';

    if (!isAdmin && !isFree && !user) {
      return reply({
        success: false,
        error: 'Konten ini berbayar. Silakan login dan selesaikan pembayaran untuk mendapatkan akses.',
        code: 'LOGIN_REQUIRED_FOR_PAID',
      }, 401);
    }

    if (!isAdmin && !isFree && user) {
      const { data: entitlement, error: entitlementError } = await admin
        .from('review_entitlements')
        .select('id')
        .eq('user_id', user.id)
        .eq('review_id', item.id)
        .maybeSingle();
      if (entitlementError) throw entitlementError;

      // Recovery path for older/already-settled orders whose entitlement row
      // was not created (for example, a previous settlement RPC/migration issue).
      // Only a SETTLED order owned by this exact user and review can restore access.
      if (!entitlement) {
        const { data: settledOrder, error: settledOrderError } = await admin
          .from('cashi_orders')
          .select('order_id')
          .eq('user_id', user.id)
          .eq('review_id', item.id)
          .eq('purpose', 'review_download')
          .eq('status', 'SETTLED')
          .order('settled_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (settledOrderError) throw settledOrderError;

        if (settledOrder) {
          const { error: restoreError } = await admin
            .from('review_entitlements')
            .upsert({
              user_id: user.id,
              review_id: item.id,
              order_id: settledOrder.order_id,
            }, { onConflict: 'user_id,review_id', ignoreDuplicates: true });
          if (restoreError) throw restoreError;

          const { data: restored, error: restoredError } = await admin
            .from('review_entitlements')
            .select('id')
            .eq('user_id', user.id)
            .eq('review_id', item.id)
            .maybeSingle();
          if (restoredError) throw restoredError;
          if (!restored) {
            return reply({ success: false, error: 'Pembayaran ditemukan, tetapi pemulihan akses gagal. Hubungi admin.', code: 'ENTITLEMENT_RESTORE_FAILED' }, 500);
          }
        } else {
          return reply({
            success: false,
            error: 'Pembelian untuk akun ini belum ditemukan. Jika sudah membayar, pastikan login dengan akun yang digunakan saat checkout.',
            code: 'PURCHASE_NOT_FOUND',
          }, 403);
        }
      }
    }

    const { data: secret, error: secretError } = await admin
      .from('review_download_secrets')
      .select('download_url')
      .eq('review_id', item.id)
      .maybeSingle();
    if (secretError) throw secretError;
    if (!secret?.download_url) {
      return reply({ success: false, error: 'Link download belum diatur admin.' }, 404);
    }

    const { data: content, error: contentError } = await admin
      .from('review_content_secrets')
      .select('content_after_payment')
      .eq('review_id', item.id)
      .maybeSingle();
    if (contentError) throw contentError;

    return reply({
      success: true,
      is_admin: isAdmin,
      title: item.title,
      download_url: secret.download_url,
      content_after_payment: content?.content_after_payment || '',
    });
  } catch (error) {
    console.error('download-link error:', error);
    return reply({
      success: false,
      error: error instanceof Error ? error.message : 'Kesalahan internal pada download-link.',
    }, 500);
  }
});
