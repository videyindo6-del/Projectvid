const root = document.getElementById('pasteContent');

function getRouteCode(prefix) {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('slug') || params.get('code') || '';
  if (fromQuery.trim()) return fromQuery.trim();
  const parts = location.pathname.split('/').filter(Boolean);
  const index = parts.findIndex(part => part.toLowerCase() === prefix);
  if (index < 0 || !parts[index + 1]) return '';
  try { return decodeURIComponent(parts[index + 1]).trim(); }
  catch { return parts[index + 1].trim(); }
}

const slug = getRouteCode('paste');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

async function getFunctionError(error, data) {
  if (data?.error) return data.error;
  // Supabase JS may put the Edge Function's non-2xx JSON body in error.context.
  try {
    if (error?.context?.json) {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch (_) {}
  return error?.message || 'Edge Function gagal memproses permintaan.';
}

async function run() {
  try {
    if (!window.sb) throw new Error('Supabase belum terkonfigurasi. Periksa js/config.js.');
    if (!slug) throw new Error('Kode review tidak terbaca. Pastikan URL berbentuk /paste/KODE_REVIEW.');

    const { data: authData, error: authError } = await sb.auth.getUser();
    if (authError || !authData?.user) {
      throw new Error('Silakan login menggunakan akun admin atau akun yang sudah membeli konten ini.');
    }

    // The public page can read published review metadata. The Edge Function
    // performs the authoritative admin/entitlement check and reads private links.
    let { data: item, error } = await sb
      .from('review_items')
      .select('id,title,slug,access,status')
      .eq('slug', slug)
      .maybeSingle();

    if (!error && !item) {
      const alternate = await sb.from('review_items')
        .select('id,title,slug,access,status')
        .ilike('slug', slug)
        .maybeSingle();
      item = alternate.data;
      error = alternate.error;
    }

    if (error) throw new Error('Gagal membaca data review: ' + error.message);
    if (!item || item.status !== 'published') {
      throw new Error('Review tidak ditemukan atau belum dipublikasikan. Kode: ' + slug);
    }

    const result = await sb.functions.invoke('download-link', {
      body: { review_id: item.id }
    });
    if (result.error || !result.data?.success) {
      throw new Error(await getFunctionError(result.error, result.data));
    }

    const data = result.data;
    root.innerHTML = `
      <span class="eyebrow">${data.is_admin ? 'AKSES ADMIN TERVERIFIKASI' : 'AKSES TERVERIFIKASI'}</span>
      <h1>${esc(data.title || item.title)}</h1>
      <p>${data.is_admin ? 'Akses admin berhasil diverifikasi.' : 'Hak akses pembelian berhasil diverifikasi.'} Link download tersedia di bawah ini.</p>
      ${data.content_after_payment ? `<div class="watch-card"><p>${esc(data.content_after_payment)}</p></div>` : ''}
      <a class="btn primary" href="${esc(data.download_url)}" target="_blank" rel="noopener noreferrer">Download Sekarang</a>`;
  } catch (error) {
    const message = error?.message || 'Akses belum tersedia.';
    root.innerHTML = `
      <h1>Akses belum tersedia</h1>
      <p>${esc(message)}</p>
      <a class="btn primary" href="/d/${encodeURIComponent(slug)}">Periksa status / lanjutkan pembayaran</a>
      <p><a href="/login.html?next=${encodeURIComponent(location.pathname + location.search)}">Login ke akun lain</a></p>`;
  }
}

run();
