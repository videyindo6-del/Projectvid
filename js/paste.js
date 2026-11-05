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

    // Free content is public and does not require login. The Edge Function
    // enforces login + entitlement only when the selected review is PAID.

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
    const downloadUrl = new URL(String(data.download_url || ''));
    if (!['http:', 'https:'].includes(downloadUrl.protocol)) {
      throw new Error('Link download dari admin tidak valid. Periksa kembali pengaturan link di panel admin.');
    }

    const accessLabel = data.is_admin
      ? 'AKSES ADMIN TERVERIFIKASI'
      : (String(item.access || '').trim().toLowerCase() === 'free' ? 'FREE ACCESS' : 'AKSES PEMBELIAN TERVERIFIKASI');
    const accessMessage = data.is_admin
      ? 'Akses admin berhasil diverifikasi. Link download yang diterapkan admin tersedia di bawah ini.'
      : (String(item.access || '').trim().toLowerCase() === 'free'
          ? 'Konten ini gratis. Link download yang diterapkan admin tersedia di bawah ini.'
          : 'Pembelian berhasil diverifikasi. Link download yang diterapkan admin tersedia di bawah ini.');

    root.innerHTML = `
      <span class="eyebrow">${accessLabel}</span>
      <h1>${esc(data.title || item.title)}</h1>
      <p>${accessMessage}</p>
      ${data.content_after_payment ? `<div class="watch-card"><p>${esc(data.content_after_payment)}</p></div>` : ''}
      <div class="paste-download-link" style="margin:18px 0;padding:16px;border:1px solid var(--border-color,#dbe2ea);border-radius:14px;background:var(--card-bg,#fff)">
        <div style="font-size:12px;font-weight:700;letter-spacing:.06em;opacity:.7;margin-bottom:8px">LINK DOWNLOAD DARI PANEL ADMIN</div>
        <a id="pasteDownloadUrl" href="${esc(downloadUrl.href)}" target="_blank" rel="noopener noreferrer" style="display:block;overflow-wrap:anywhere;word-break:break-word;margin-bottom:12px">${esc(downloadUrl.href)}</a>
        <button class="btn" type="button" id="copyPasteDownloadUrl">Salin Link</button>
      </div>
      <a class="btn primary" href="${esc(downloadUrl.href)}" target="_blank" rel="noopener noreferrer">Download Sekarang</a>`;

    document.getElementById('copyPasteDownloadUrl')?.addEventListener('click', async () => {
      const button = document.getElementById('copyPasteDownloadUrl');
      try {
        await navigator.clipboard.writeText(downloadUrl.href);
        button.textContent = 'Link berhasil disalin ✓';
      } catch (_) {
        const field = document.createElement('textarea');
        field.value = downloadUrl.href;
        field.setAttribute('readonly', '');
        field.style.position = 'absolute';
        field.style.left = '-9999px';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        button.textContent = copied ? 'Link berhasil disalin ✓' : 'Salin manual dari link di atas';
      }
    });
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
