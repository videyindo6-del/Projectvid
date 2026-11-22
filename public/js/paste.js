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
const pasteLang=()=>localStorage.getItem('boxcellink_lang')||'id';
const pasteText=(id,en)=>pasteLang()==='en'?en:id;
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

    const destinationHost = downloadUrl.hostname.toLowerCase();
    const isTelegramDestination = destinationHost === 't.me' || destinationHost.endsWith('.t.me') || destinationHost === 'telegram.me' || destinationHost.endsWith('.telegram.me');
    const destinationTitle = isTelegramDestination ? pasteText('LINK MEDIA ASLI TELEGRAM','ORIGINAL TELEGRAM MEDIA LINK') : pasteText('LINK AKSES / DOWNLOAD DARI PANEL ADMIN','ACCESS / DOWNLOAD LINK FROM ADMIN');
    const destinationButton = isTelegramDestination ? pasteText('Buka Media di Telegram','Open Media in Telegram') : pasteText('Buka Link Sekarang','Open Link Now');
    const accessLabel = data.is_admin
      ? pasteText('AKSES ADMIN TERVERIFIKASI','VERIFIED ADMIN ACCESS')
      : (String(item.access || '').trim().toLowerCase() === 'free' ? 'FREE ACCESS' : pasteText('AKSES PEMBELIAN TERVERIFIKASI','VERIFIED PURCHASE ACCESS'));
    const accessMessage = data.is_admin
      ? pasteText('Akses admin berhasil diverifikasi. Link download yang diterapkan admin tersedia di bawah ini.','Admin access has been verified. The configured download link is available below.')
      : (String(item.access || '').trim().toLowerCase() === 'free'
          ? pasteText('Konten ini gratis. Link download yang diterapkan admin tersedia di bawah ini.','This content is free. The configured download link is available below.')
          : pasteText('Pembelian berhasil diverifikasi. Link download yang diterapkan admin tersedia di bawah ini.','Purchase verified. The configured download link is available below.'));

    root.innerHTML = `
      <div class="paste-access-head"><span class="eyebrow">${accessLabel}</span><span class="paste-access-verified"><i class="fa-solid fa-shield-check"></i> ${pasteText('Akses terverifikasi','Verified access')}</span></div>
      <h1 class="paste-premium-title">${esc(data.title || item.title)}</h1>
      <p class="paste-premium-lead">${accessMessage}</p>
      ${data.content_after_payment ? `<div class="paste-extra-content"><p>${esc(data.content_after_payment)}</p></div>` : ''}
      <div class="paste-download-link">
        <div class="paste-link-label">${destinationTitle}</div>
        <a id="pasteDownloadUrl" class="paste-download-url" href="${esc(downloadUrl.href)}" target="_blank" rel="noopener noreferrer">${esc(downloadUrl.href)}</a>
        <button class="paste-copy-button" type="button" id="copyPasteDownloadUrl">${pasteText('Salin Link','Copy Link')}</button>
      </div>
      <a class="paste-open-button" href="${esc(downloadUrl.href)}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-telegram"></i> ${destinationButton}</a>`;

    document.getElementById('copyPasteDownloadUrl')?.addEventListener('click', async () => {
      const button = document.getElementById('copyPasteDownloadUrl');
      try {
        await navigator.clipboard.writeText(downloadUrl.href);
        button.textContent = pasteText('Link berhasil disalin ✓','Link copied ✓');
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
        button.textContent = copied ? pasteText('Link berhasil disalin ✓','Link copied ✓') : pasteText('Salin manual dari link di atas','Copy the link manually above');
      }
    });
  } catch (error) {
    const message = error?.message || 'Akses belum tersedia.';
    const returnTo = location.pathname + location.search;
    const needsLogin = /sesi login tidak valid|login ulang|login diperlukan|konten ini berbayar/i.test(message);
    root.innerHTML = `
      <div class="paste-error-icon"><i class="fa-solid fa-lock"></i></div><h1 class="paste-premium-title">${pasteText('Akses belum tersedia','Access unavailable')}</h1>
      <p class="paste-premium-lead">${esc(message)}</p>
      <a class="paste-open-button" href="/d/${encodeURIComponent(slug)}">${pasteText('Periksa status / lanjutkan pembayaran','Check status / continue payment')}</a>
      ${needsLogin ? `<p><a class="paste-secondary-link" href="/login.html?next=${encodeURIComponent(returnTo)}">${pasteText('Login dengan akun pembelian','Sign in with purchase account')}</a></p>` : ''}`;
  }
}

run();
