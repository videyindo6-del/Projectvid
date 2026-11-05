import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ success: false, error: 'Method tidak diizinkan' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) {
      return reply({ success: false, error: 'Konfigurasi Supabase Edge Function belum lengkap. Periksa secrets server.' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const reviewId = String(body?.review_id || '').trim();
    if (!reviewId) return reply({ success: false, error: 'ID review tidak dikirim.' }, 400);

    // Read the review first with the service role. FREE access is public and
    // must not be blocked by an expired/stale browser login token.
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: item, error: itemError } = await admin
      .from('review_items')
      .select('id,title,slug,access,status')
      .eq('id', reviewId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item || item.status !== 'published') {
      return reply({ success: false, error: 'Konten tidak ditemukan atau belum dipublikasikan.' }, 404);
    }

    const accessType = String(item.access || '').trim().toLowerCase();
    const isFree = accessType === 'free';
    const authorization = req.headers.get('Authorization') || '';
    const bearerToken = authorization.replace(/^Bearer\\s+/i, '').trim();
    let user: { id: string } | null = null;
    let profile: { role?: string | null; is_banned?: boolean | null } | null = null;

    // Only validate a session when the content actually requires a user.
    // This allows FREE content to work with no session or a stale session.
    if (!isFree && bearerToken && bearerToken !== anonKey) {
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

    const isAdmin = String(profile?.role || '').trim().toLowerCase() === 'admin';
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
