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
    if (!authorization) return reply({ success: false, error: 'Login diperlukan' }, 401);

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) {
      console.error('Supabase function environment is incomplete');
      return reply({ success: false, error: 'Konfigurasi server belum lengkap' }, 500);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return reply({ success: false, error: 'Sesi tidak valid' }, 401);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: actor, error: actorError } = await admin
      .from('profiles')
      .select('role,is_banned')
      .eq('id', user.id)
      .maybeSingle();

    if (actorError) throw actorError;
    if (actor?.role !== 'admin' || actor?.is_banned) {
      return reply({ success: false, error: 'Akses admin diperlukan' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'delete') {
      return reply({ success: false, error: 'Aksi tidak didukung' }, 400);
    }

    const targetId = String(body.user_id || '').trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(targetId)) {
      return reply({ success: false, error: 'ID pengguna tidak valid' }, 400);
    }
    if (targetId === user.id) {
      return reply({ success: false, error: 'Admin tidak dapat menghapus akunnya sendiri dari menu ini' }, 400);
    }

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', targetId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return reply({ success: false, error: 'Pengguna tidak ditemukan' }, 404);
    if (target.role === 'admin') {
      return reply({ success: false, error: 'Akun admin dilindungi dan tidak dapat dihapus dari menu ini' }, 403);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) throw deleteError;

    return reply({ success: true, message: 'Akun berhasil dihapus' });
  } catch (error) {
    console.error('admin-user error:', error);
    return reply({
      success: false,
      error: error instanceof Error ? error.message : 'Kesalahan internal',
    }, 500);
  }
});
