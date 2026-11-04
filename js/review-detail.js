
const box = document.getElementById('reviewDetail');

function getRouteCode(prefix) {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('slug') || params.get('code') || '';
  if (fromQuery.trim()) return fromQuery.trim();

  const parts = location.pathname.split('/').filter(Boolean);
  const index = parts.findIndex(p => p.toLowerCase() === prefix.toLowerCase());
  if (index < 0 || !parts[index + 1]) return '';

  try {
    return decodeURIComponent(parts[index + 1]).trim();
  } catch {
    return parts[index + 1].trim();
  }
}

const slug = getRouteCode('r');
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

function showError(title, message) {
  if (!box) return;
  box.innerHTML = `<h1>${esc(title)}</h1><p>${esc(message)}</p>`;
}

// =====================================================
// GOOGLE DRIVE / EMBED URL HANDLER
// =====================================================

function extractEmbedSource(value) {
  let raw = String(value ?? '').trim();
  if (!raw) return '';

  // Jika database menyimpan kode iframe HTML.
  if (/<iframe[\s>]/i.test(raw)) {
    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      raw = doc.querySelector('iframe')?.getAttribute('src') || '';
    } catch {
      return '';
    }
  }

  // Tolak javascript:, data:, dan URL berbahaya.
  try {
    const parsed = new URL(raw, location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function getDriveId(url) {
  const raw = extractEmbedSource(url);
  if (!raw) return '';

  try {
    const u = new URL(raw);
    if (!/(^|\.)drive\.google\.com$/i.test(u.hostname)) return '';

    const patterns = [
      /\/file\/d\/([^/]+)/i,
      /\/document\/d\/([^/]+)/i,
      /\/spreadsheets\/d\/([^/]+)/i,
      /\/presentation\/d\/([^/]+)/i
    ];

    for (const pattern of patterns) {
      const match = u.pathname.match(pattern);
      if (match) return match[1];
    }

    return u.searchParams.get('id') || '';
  } catch {
    return '';
  }
}

function getEmbedInfo(value) {
  const raw = extractEmbedSource(value);
  if (!raw) return null;

  const driveId = getDriveId(raw);

  if (driveId) {
    return {
      type: 'iframe',
      src: `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`,
      original: raw,
      isDrive: true
    };
  }

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();

    // URL embed yang memang sudah berupa iframe.
    if (
      host === 'drive.google.com' ||
      host === 'docs.google.com'
    ) {
      return {
        type: 'iframe',
        src: raw,
        original: raw,
        isDrive: true
      };
    }

    // Embed video YouTube.
    if (host.includes('youtube.com') || host === 'youtu.be') {
      let id = '';

      if (host === 'youtu.be') {
        id = u.pathname.split('/').filter(Boolean)[0] || '';
      } else {
        id = u.searchParams.get('v') || '';
        if (!id) {
          const match = u.pathname.match(/\/embed\/([^/]+)/);
          if (match) id = match[1];
        }
      }

      if (id) {
        return {
          type: 'iframe',
          src: `https://www.youtube.com/embed/${encodeURIComponent(id)}`,
          original: raw,
          isDrive: false
        };
      }
    }

    return {
      type: 'image',
      src: raw,
      original: raw,
      isDrive: false
    };
  } catch {
    return null;
  }
}

function normalizeGalleryItem(item) {
  if (typeof item === 'string') return item;

  if (item && typeof item === 'object') {
    return item.url ||
      item.src ||
      item.embed_url ||
      item.embed ||
      item.thumbnail_url ||
      '';
  }

  return '';
}

function normalizeGallery(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeGalleryItem).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeGalleryItem).filter(Boolean);
      }
      if (typeof parsed === 'string') return [parsed];
    } catch {
      return [value.trim()];
    }
  }

  return [];
}

// =====================================================
// REVIEW VIEW COUNT
// =====================================================

async function incrementReviewView(id) {
  try {
    if (!sb || typeof sb.rpc !== 'function') return;

    await sb.rpc('increment_review_view', {
      p_review_id: id
    });
  } catch (error) {
    console.warn('Increment review view gagal:', error);
  }
}

// =====================================================
// LOAD EXTRA DATA
// =====================================================

async function getReviewExtra(id) {
  try {
    const result = await sb
      .from('review_items')
      .select('gallery_urls,view_count')
      .eq('id', id)
      .maybeSingle();

    if (result.error) {
      console.warn('Data tambahan review:', result.error);
      return null;
    }

    return result.data || null;
  } catch (error) {
    console.warn('Gagal mengambil data tambahan:', error);
    return null;
  }
}

// =====================================================
// GALLERY HTML
// =====================================================

function renderGallery(items, title) {
  if (!items.length) {
    return '<div class="ad-banner">Belum ada gambar review</div>';
  }

  return items.map((item, index) => {
    const info = getEmbedInfo(item);

    if (!info) {
      return `
        <div class="review-gallery-error">
          <p>Gambar ${index + 1} tidak dapat dibaca.</p>
        </div>
      `;
    }

    if (info.type === 'iframe') {
      return `
        <div class="review-gallery-item review-gallery-embed">
          <iframe
            src="${esc(info.src)}"
            title="${esc(title)} - gambar ${index + 1}"
            loading="lazy"
            allow="autoplay; fullscreen"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
          <a
            class="review-open-original"
            href="${esc(info.original)}"
            target="_blank"
            rel="noopener noreferrer"
          >Buka embed asli ↗</a>
        </div>
      `;
    }

    return `
      <div class="review-gallery-item">
        <img
          src="${esc(info.src)}"
          alt="${esc(title)} - gambar ${index + 1}"
          loading="lazy"
          data-full="${esc(info.src)}"
          onerror="this.closest('.review-gallery-item').classList.add('image-failed')"
        >
        <div class="review-image-fallback">
          <span>Gambar gagal dimuat</span>
          <a href="${esc(info.original)}" target="_blank" rel="noopener noreferrer">
            Buka gambar ↗
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// =====================================================
// GALLERY VIEWER FOR NORMAL IMAGES
// =====================================================

function setupGalleryViewer() {
  const viewer = document.getElementById('reviewViewer');
  const viewerImg = viewer?.querySelector('img');
  if (!viewer || !viewerImg) return;

  let scale = 1;
  let drag = false;
  let startX = 0;
  let startY = 0;
  let tx = 0;
  let ty = 0;

  function render() {
    viewerImg.style.transform =
      `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function open(src) {
    viewer.hidden = false;
    viewerImg.src = src;
    scale = 1;
    tx = 0;
    ty = 0;
    render();
  }

  box.querySelectorAll('.review-gallery img[data-full]').forEach(img => {
    img.addEventListener('click', () => {
      if (!img.closest('.review-gallery-item')?.classList.contains('image-failed')) {
        open(img.dataset.full || img.src);
      }
    });
  });

  viewer.querySelector('.viewer-close').onclick = () => {
    viewer.hidden = true;
    viewerImg.src = '';
  };

  viewer.onclick = e => {
    if (e.target === viewer) {
      viewer.hidden = true;
      viewerImg.src = '';
    }
  };

  viewerImg.onwheel = e => {
    e.preventDefault();
    scale = Math.min(5, Math.max(1, scale + (e.deltaY < 0 ? 0.15 : -0.15)));
    render();
  };

  viewerImg.onpointerdown = e => {
    if (scale <= 1) return;
    drag = true;
    startX = e.clientX - tx;
    startY = e.clientY - ty;
    viewerImg.setPointerCapture(e.pointerId);
  };

  viewerImg.onpointermove = e => {
    if (!drag) return;
    tx = e.clientX - startX;
    ty = e.clientY - startY;
    render();
  };

  viewerImg.onpointerup = () => drag = false;
  viewerImg.onpointercancel = () => drag = false;
}

// =====================================================
// MAIN REVIEW
// =====================================================

async function load() {
  if (!box) {
    console.error('Elemen reviewDetail tidak ditemukan.');
    return;
  }

  if (!slug) {
    showError('Kode review tidak terbaca', 'Pastikan URL berbentuk /r/KODE_REVIEW.');
    return;
  }

  if (typeof sb === 'undefined' || !sb) {
    showError('Supabase belum tersedia', 'Periksa konfigurasi Supabase dan koneksi JavaScript.');
    return;
  }

  try {
    const selectFields =
      'id,slug,title,description,thumbnail_url,price,access,created_at';

    let v = null;
    let queryError = null;

    const primary = await sb
      .from('review_items')
      .select(selectFields)
      .eq('slug', slug)
      .maybeSingle();

    v = primary.data;
    queryError = primary.error;

    if (!queryError && !v) {
      const alt = await sb
        .from('review_items')
        .select(selectFields)
        .ilike('slug', slug)
        .maybeSingle();

      v = alt.data;
      queryError = alt.error;
    }

    if (!queryError && !v) {
      const byId = await sb
        .from('review_items')
        .select(selectFields)
        .eq('id', slug)
        .maybeSingle();

      v = byId.data;
      queryError = byId.error;
    }

    if (queryError) {
      console.error('Review query error:', queryError);
      showError('Gagal memuat review', queryError.message || 'Terjadi kesalahan saat mengambil data review.');
      return;
    }

    if (!v) {
      showError(
        'Review tidak ditemukan',
        'Kode yang dicari: ' + slug + '. Pastikan slug benar dan review sudah dipublikasikan.'
      );
      return;
    }

    const extra = await getReviewExtra(v.id);
    const galleryImages = normalizeGallery(extra?.gallery_urls);

    if (!galleryImages.length && v.thumbnail_url) {
      galleryImages.push(v.thumbnail_url);
    }

    v.view_count = Number(extra?.view_count || 0);

    // Tidak perlu menunggu RPC selesai.
    incrementReviewView(v.id);

    const galleryHTML = renderGallery(galleryImages, v.title);

    const downloadLabel = v.access === 'paid'
      ? 'Download / Beli ' + rp(v.price)
      : 'Download';

    const reviewSlug = v.slug || v.id;

    box.innerHTML = `
      <span class="eyebrow">REVIEW GALLERY</span>
      <h1>${esc(v.title)}</h1>

      <div class="review-gallery">
        ${galleryHTML}
      </div>

      <div class="review-viewer" id="reviewViewer" hidden>
        <button type="button" class="viewer-close" aria-label="Tutup">×</button>
        <img alt="Pratinjau gambar">
      </div>

      <p>${esc(v.description)}</p>

      <div class="watch-meta">
        <span>${v.view_count + 1} views</span>
        <span>
          Publish ${
            v.created_at
              ? new Date(v.created_at).toLocaleDateString('id-ID')
              : '-'
          }
        </span>
      </div>

      <a class="btn primary" href="/d/${encodeURIComponent(reviewSlug)}">
        ${esc(downloadLabel)}
      </a>
    `;

    setupGalleryViewer();
    loadMore(v.id);

  } catch (error) {
    console.error('Review detail error:', error);
    showError('Terjadi kesalahan', error?.message || 'Gagal memuat halaman review.');
  }
}

// =====================================================
// RELATED REVIEWS
// =====================================================

async function loadMore(id) {
  const target = document.getElementById('moreReviews');
  if (!target) return;

  try {
    const { data, error } = await sb
      .from('review_items')
      .select('slug,title,thumbnail_url,price,access')
      .eq('status', 'published')
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) throw error;

    target.innerHTML = (data || []).map(x => {
      const thumbnail = x.thumbnail_url
        ? getEmbedInfo(x.thumbnail_url)
        : null;

      // Thumbnail kartu harus berupa gambar, bukan iframe.
      const thumbUrl = thumbnail
        ? thumbnail.isDrive
          ? (() => {
              const id = getDriveId(x.thumbnail_url);
              return id
                ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600`
                : '';
            })()
          : thumbnail.src
        : '';

      return `
        <a class="video-card" href="/r/${encodeURIComponent(x.slug || '')}">
          ${
            thumbUrl
              ? `<img src="${esc(thumbUrl)}" alt="${esc(x.title)}" loading="lazy">`
              : ''
          }
          <div>
            <b>${esc(x.title)}</b>
            <small style="display:block">
              ${x.access === 'paid' ? rp(x.price) : 'Gratis'}
            </small>
          </div>
        </a>
      `;
    }).join('');

  } catch (error) {
    console.warn('Gagal memuat rekomendasi:', error);
    target.innerHTML = '';
  }
}

// =====================================================
// GALLERY STYLE
// =====================================================

(function addGalleryStyles() {
  if (document.getElementById('reviewGalleryEmbedStyles')) return;

  const style = document.createElement('style');
  style.id = 'reviewGalleryEmbedStyles';
  style.textContent = `
    .review-gallery{
      display:grid;
      grid-template-columns:1fr;
      gap:16px;
      margin:20px 0;
    }
    .review-gallery-item{
      position:relative;
      width:100%;
      overflow:hidden;
      border-radius:16px;
      background:#101827;
    }
    .review-gallery-item>img{
      display:block;
      width:100%;
      max-height:600px;
      object-fit:contain;
      cursor:zoom-in;
    }
    .review-gallery-embed{
      min-height:300px;
    }
    .review-gallery-embed iframe{
      display:block;
      width:100%;
      height:420px;
      border:0;
      background:#101827;
    }
    .review-open-original{
      display:block;
      padding:10px 14px;
      color:inherit;
      text-decoration:none;
      font-size:13px;
      background:rgba(0,0,0,.2);
    }
    .review-image-fallback{
      display:none;
      padding:20px;
      text-align:center;
      color:#fff;
    }
    .review-gallery-item.image-failed .review-image-fallback{
      display:block;
    }
    .review-gallery-item.image-failed>img{
      display:none;
    }
    .review-image-fallback a{
      display:block;
      margin-top:8px;
      color:#8ab4ff;
    }
    .review-gallery-error{
      padding:20px;
      border-radius:12px;
      background:#101827;
    }
    .review-viewer[hidden]{
      display:none!important;
    }
    @media(max-width:600px){
      .review-gallery-embed{
        min-height:280px;
      }
      .review-gallery-embed iframe{
        height:300px;
      }
    }
  `;

  document.head.appendChild(style);
})();

// Jalankan halaman.
load();
