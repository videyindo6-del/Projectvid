
const form = document.getElementById('reviewForm');
const list = document.getElementById('reviewAdmin');
const msg = document.getElementById('formMessage');
const gallery = document.getElementById('galleryInputs');
const preview = document.getElementById('galleryPreview');

let editingId = null;
let loading = false;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

function notify(text, error = false) {
  if (!msg) return;
  msg.className = '';
  msg.textContent = text;
  msg.style.whiteSpace = 'pre-wrap';
  msg.style.color = error ? '#ef4444' : '';
}

// =====================================================
// EMBED / GOOGLE DRIVE HANDLER
// =====================================================

function normalizeEmbed(value) {
  let raw = String(value ?? '').trim();
  if (!raw) return '';

  // Terima kode iframe yang ditempel admin.
  if (/<iframe[\s>]/i.test(raw)) {
    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      raw = doc.querySelector('iframe')?.getAttribute('src') || '';
    } catch {
      return '';
    }
  }

  try {
    const url = new URL(raw, location.origin);

    if (!['http:', 'https:'].includes(url.protocol)) return '';

    // Google Drive file URL.
    if (/(^|\.)drive\.google\.com$/i.test(url.hostname)) {
      let id = '';

      const match = url.pathname.match(/\/file\/d\/([^/]+)/i);
      if (match) id = match[1];

      if (!id) id = url.searchParams.get('id') || '';

      if (id) {
        return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
      }
    }

    // Google Docs / Spreadsheet / Slides embed.
    if (/(^|\.)docs\.google\.com$/i.test(url.hostname)) {
      return url.href;
    }

    // YouTube.
    if (url.hostname === 'youtu.be' ||
        url.hostname.includes('youtube.com')) {
      let id = url.hostname === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('v');

      if (!id) {
        id = url.pathname.match(/\/embed\/([^/]+)/)?.[1] || '';
      }

      if (id) {
        return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
      }
    }

    return url.href;
  } catch {
    return '';
  }
}

function getDriveId(value) {
  const url = normalizeEmbed(value);
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  return match?.[1] || '';
}

function isEmbedUrl(value) {
  const url = normalizeEmbed(value);
  if (!url) return false;

  try {
    const u = new URL(url);
    return (
      u.hostname.includes('drive.google.com') ||
      u.hostname.includes('docs.google.com') ||
      u.hostname.includes('youtube.com')
    );
  } catch {
    return false;
  }
}

function getThumbnail(value) {
  const id = getDriveId(value);

  if (id) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`;
  }

  return normalizeEmbed(value);
}

function normalizeGallery(value) {
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return normalizeEmbed(item);
      if (item && typeof item === 'object') {
        return normalizeEmbed(
          item.url || item.src || item.embed_url || item.embed || ''
        );
      }
      return '';
    }).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      return normalizeGallery(JSON.parse(value));
    } catch {
      const url = normalizeEmbed(value);
      return url ? [url] : [];
    }
  }

  return [];
}

// =====================================================
// GALLERY INPUT
// =====================================================

function addGallery(value = '') {
  if (gallery.children.length >= 10) {
    alert('Maksimal 10 gambar.');
    return;
  }

  const n = gallery.children.length + 1;
  const row = document.createElement('div');

  row.className = 'review-gallery-input-row';
  row.style.cssText = `
    display:flex;
    gap:8px;
    align-items:center;
    margin:6px 0;
  `;

  row.innerHTML = `
    <input
      type="text"
      name="gallery_${Date.now()}_${n}"
      placeholder="URL gambar / Google Drive Embed ${n}"
      value="${esc(value)}"
      style="width:100%;margin:4px 0"
    >
    <button
      type="button"
      class="btn review-gallery-remove"
      title="Hapus gambar"
    >×</button>
  `;

  gallery.appendChild(row);

  const input = row.querySelector('input');

  input.addEventListener('input', renderGalleryPreview);

  row.querySelector('.review-gallery-remove').addEventListener('click', () => {
    row.remove();
    renderGalleryPreview();
  });

  renderGalleryPreview();
}

function renderPreviewItem(value, index) {
  const url = normalizeEmbed(value);
  if (!url) return '';

  if (isEmbedUrl(url)) {
    return `
      <div class="review-admin-preview-item">
        <iframe
          src="${esc(url)}"
          title="Preview gambar ${index + 1}"
          loading="lazy"
          allow="autoplay; fullscreen"
          allowfullscreen
        ></iframe>
        <small>Embed ${index + 1}</small>
      </div>
    `;
  }

  return `
    <div class="review-admin-preview-item">
      <img
        src="${esc(url)}"
        alt="Preview ${index + 1}"
        loading="lazy"
        onerror="this.closest('.review-admin-preview-item').classList.add('preview-error')"
      >
      <small>Gambar ${index + 1}</small>
      <span class="preview-failed">Gambar gagal dimuat</span>
    </div>
  `;
}

function renderGalleryPreview() {
  if (!preview) return;

  const urls = [...gallery.querySelectorAll('input')]
    .map(input => input.value.trim())
    .filter(Boolean);

  preview.innerHTML = urls.length
    ? urls.map(renderPreviewItem).join('')
    : '<p>Belum ada gambar untuk preview.</p>';
}

// =====================================================
// PREVIEW CSS
// =====================================================

(function addAdminGalleryStyles() {
  if (document.getElementById('reviewAdminGalleryStyles')) return;

  const style = document.createElement('style');
  style.id = 'reviewAdminGalleryStyles';

  style.textContent = `
    #galleryPreview {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
      gap:12px;
      margin-top:12px;
    }
    .review-admin-preview-item {
      position:relative;
      min-width:0;
      overflow:hidden;
      border-radius:12px;
      background:#101827;
    }
    .review-admin-preview-item img {
      width:100%;
      height:180px;
      object-fit:contain;
      display:block;
    }
    .review-admin-preview-item iframe {
      width:100%;
      height:220px;
      border:0;
      display:block;
    }
    .review-admin-preview-item small {
      display:block;
      padding:8px;
      color:inherit;
    }
    .review-admin-preview-item .preview-failed {
      display:none;
      padding:10px;
      color:#ef4444;
    }
    .review-admin-preview-item.preview-error img {
      display:none;
    }
    .review-admin-preview-item.preview-error .preview-failed {
      display:block;
    }
    .review-gallery-input-row input {
      min-width:0;
      flex:1;
    }
    .review-gallery-remove {
      flex-shrink:0;
    }
  `;

  document.head.appendChild(style);
})();

document.getElementById('addGallery')?.addEventListener('click', () => {
  addGallery();
});

// Awal form: tiga input gambar.
for (let i = 0; i < 3; i++) addGallery();

// =====================================================
// ADMIN AUTHORIZATION
// =====================================================

async function guard() {
  try {
    const { data: { user }, error: authError } = await sb.auth.getUser();

    if (authError || !user) {
      location.href = 'login.html';
      return false;
    }

    const { data: profile, error } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || profile?.role !== 'admin') {
      location.href = '/';
      return false;
    }

    const email = document.getElementById('adminEmail');
    if (email) email.textContent = user.email || '';

    return true;
  } catch (error) {
    console.error('Admin guard:', error);
    notify('Gagal memeriksa akses admin.', true);
    return false;
  }
}

// =====================================================
// LOAD REVIEW LIST
// =====================================================

async function load() {
  if (!await guard()) return;

  if (!list) return;

  list.textContent = 'Memuat review...';

  try {
    const { data, error } = await sb
      .from('review_items')
      .select('id,slug,title,price,access,status,review_download_secrets(download_url)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    list.innerHTML = `
      <table class="table review-admin-table">
        <thead><tr>
          <th>Judul</th><th>Link Review</th><th>Link Tujuan Download</th>
          <th>Harga</th><th>Akses</th><th>Status</th><th>Aksi</th>
        </tr></thead>
        <tbody>${(data || []).map(x => {
          const reviewUrl = `${location.origin}/r/${encodeURIComponent(x.slug)}`;
          const downloadUrl = x.review_download_secrets?.[0]?.download_url || '';
          return `<tr>
            <td class="review-title-cell"><strong>${esc(x.title)}</strong><small>${esc(x.slug)}</small></td>
            <td><div class="review-link-cell"><a href="${esc(reviewUrl)}" target="_blank" rel="noopener">${esc(reviewUrl)}</a><button type="button" class="copy-link-btn" data-copy="${esc(reviewUrl)}" title="Salin link review"><i class="fa-regular fa-copy"></i> Copy</button></div></td>
            <td>${downloadUrl ? `<div class="review-link-cell"><a href="${esc(downloadUrl)}" target="_blank" rel="noopener noreferrer">${esc(downloadUrl)}</a><button type="button" class="copy-link-btn" data-copy="${esc(downloadUrl)}"><i class="fa-regular fa-copy"></i> Copy</button></div>` : '<span class="empty-link">Belum diatur</span>'}</td>
            <td>Rp ${Number(x.price || 0).toLocaleString('id-ID')}</td>
            <td><span class="review-pill">${esc(x.access)}</span></td>
            <td><span class="review-status ${x.status === 'published' ? 'is-published' : 'is-draft'}">${esc(x.status)}</span></td>
            <td><div class="review-actions"><button class="btn" data-edit="${esc(x.id)}">Edit</button><button class="btn danger" data-delete="${esc(x.id)}">Hapus</button></div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;

    list.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => editReview(button.dataset.edit));
    });

    list.querySelectorAll('[data-delete]').forEach(button => {
      button.addEventListener('click', () => removeReview(button.dataset.delete));
    });

    list.querySelectorAll('[data-copy]').forEach(button => {
      button.addEventListener('click', async () => {
        const value = button.dataset.copy || '';
        try {
          await navigator.clipboard.writeText(value);
          const old = button.innerHTML;
          button.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin';
          setTimeout(() => { button.innerHTML = old; }, 1400);
        } catch {
          window.prompt('Salin link berikut:', value);
        }
      });
    });

  } catch (error) {
    console.error('Load review:', error);
    list.textContent = error.message || 'Gagal memuat review.';
  }
}

// =====================================================
// EDIT REVIEW
// =====================================================

async function editReview(id) {
  try {
    notify('Mengambil data review...');

    const { data: x, error } = await sb
      .from('review_items')
      .select('*,review_download_secrets(download_url),review_content_secrets(content_after_payment)')
      .eq('id', id)
      .single();

    if (error) throw error;

    editingId = id;

    form.elements.title.value = x.title || '';
    form.elements.description.value = x.description || '';
    form.elements.thumbnail_url.value = x.thumbnail_url || '';
    form.elements.content_after_payment.value =
      x.review_content_secrets?.[0]?.content_after_payment || '';
    form.elements.download_url.value =
      x.review_download_secrets?.[0]?.download_url || '';
    form.elements.price.value = x.price ?? 0;
    form.elements.access.value = x.access || 'free';
    form.elements.status.value = x.status || 'draft';

    gallery.innerHTML = '';

    const images = normalizeGallery(x.gallery_urls);

    images.forEach(url => addGallery(url));

    if (!images.length) {
      for (let i = 0; i < 3; i++) addGallery();
    }

    renderGalleryPreview();

    form.scrollIntoView({ behavior: 'smooth' });
    notify('Mode edit aktif. Simpan untuk memperbarui review.');

  } catch (error) {
    console.error('Edit review:', error);
    notify(error.message || 'Gagal mengambil data review.', true);
  }
}

window.editReview = editReview;

// =====================================================
// DELETE REVIEW
// =====================================================

async function removeReview(id) {
  if (!confirm('Yakin ingin menghapus review ini?')) return;

  try {
    const { error } = await sb
      .from('review_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    notify('Review berhasil dihapus.');
    await load();

  } catch (error) {
    console.error('Delete review:', error);
    notify(error.message || 'Gagal menghapus review.', true);
  }
}

window.removeReview = removeReview;

// =====================================================
// SAVE REVIEW
// =====================================================

form?.addEventListener('submit', async e => {
  e.preventDefault();

  if (loading) return;

  if (!form.reportValidity()) return;

  loading = true;
  notify('Menyimpan review...');

  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const f = new FormData(form);
    const v = Object.fromEntries(f.entries());

    const rawImages = [...gallery.querySelectorAll('input')]
      .map(input => input.value.trim())
      .filter(Boolean);

    if (rawImages.length > 10) {
      throw new Error('Maksimal 10 gambar.');
    }

    const images = rawImages.map(normalizeEmbed);

    if (images.some(url => !url)) {
      throw new Error('Ada URL gambar atau embed yang tidak valid.');
    }

    const price = v.access === 'free' ? 0 : Number(v.price);

    if (v.access === 'paid' &&
        (!Number.isFinite(price) || price < 2000 || price > 10000000)) {
      throw new Error('Harga harus Rp2.000–Rp10.000.000.');
    }

    const thumbnail = normalizeEmbed(v.thumbnail_url || images[0] || '');

    if (v.thumbnail_url && !thumbnail) {
      throw new Error('URL thumbnail tidak valid.');
    }

    const reviewData = {
      title: v.title,
      description: v.description || '',
      thumbnail_url: thumbnail || null,
      gallery_urls: images,
      price,
      access: v.access,
      status: v.status
    };

    let reviewId = editingId;
    let slug;

    if (editingId) {
      const { data: old, error: oldError } = await sb
        .from('review_items')
        .select('slug')
        .eq('id', editingId)
        .single();

      if (oldError) throw oldError;

      slug = old.slug;

      const { error } = await sb
        .from('review_items')
        .update(reviewData)
        .eq('id', editingId);

      if (error) throw error;

      const [downloadResult, contentResult] = await Promise.all([
        sb.from('review_download_secrets').upsert({
          review_id: reviewId,
          download_url: v.download_url || ''
        }, { onConflict: 'review_id' }),

        sb.from('review_content_secrets').upsert({
          review_id: reviewId,
          content_after_payment: v.content_after_payment || ''
        }, { onConflict: 'review_id' })
      ]);

      if (downloadResult.error) throw downloadResult.error;
      if (contentResult.error) throw contentResult.error;

    } else {
      slug = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();

      const { data, error } = await sb
        .from('review_items')
        .insert({
          ...reviewData,
          slug,
          review_embed_url: null
        })
        .select('id')
        .single();

      if (error) throw error;

      reviewId = data.id;

      const [downloadResult, contentResult] = await Promise.all([
        sb.from('review_download_secrets').insert({
          review_id: reviewId,
          download_url: v.download_url || ''
        }),

        sb.from('review_content_secrets').insert({
          review_id: reviewId,
          content_after_payment: v.content_after_payment || ''
        })
      ]);

      if (downloadResult.error || contentResult.error) {
        await sb.from('review_items').delete().eq('id', reviewId);
        throw downloadResult.error || contentResult.error;
      }
    }

    editingId = null;
    form.reset();
    gallery.innerHTML = '';

    for (let i = 0; i < 3; i++) addGallery();

    const reviewUrl = `${location.origin}/r/${encodeURIComponent(slug)}`;
    const checkoutUrl = `${location.origin}/d/${encodeURIComponent(slug)}`;
    const pasteUrl = `${location.origin}/paste/${encodeURIComponent(slug)}`;
    msg.className = 'review-save-result';
    msg.innerHTML = `<strong><i class="fa-solid fa-circle-check"></i> Berhasil disimpan!</strong>
      ${[['Link Review',reviewUrl],['Link Checkout',checkoutUrl],['Halaman Paste',pasteUrl]].map(([label,url]) => `<div class="saved-url-row"><span>${label}</span><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a><button type="button" class="copy-link-btn" data-copy="${esc(url)}"><i class="fa-regular fa-copy"></i> Copy</button></div>`).join('')}`;
    msg.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(button.dataset.copy); button.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin'; }
      catch { window.prompt('Salin link berikut:', button.dataset.copy); }
    }));

    await load();

  } catch (error) {
    console.error('Save review:', error);
    notify(error.message || 'Gagal menyimpan review.', true);

  } finally {
    loading = false;
    if (submitButton) submitButton.disabled = false;
  }
});

// =====================================================
// LOGOUT
// =====================================================

document.getElementById('logout')?.addEventListener('click', async () => {
  try {
    await sb.auth.signOut();
  } finally {
    location.href = 'login.html';
  }
});

// =====================================================
// START
// =====================================================

load();
