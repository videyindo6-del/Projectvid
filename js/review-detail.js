const box = document.getElementById('reviewDetail');

function getRouteCode(prefix) {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('slug') || params.get('code') || '';

  if (fromQuery.trim()) return fromQuery.trim();

  const parts = location.pathname.split('/').filter(Boolean);
  const prefixIndex = parts.findIndex(
    p => p.toLowerCase() === prefix.toLowerCase()
  );

  if (prefixIndex < 0 || !parts[prefixIndex + 1]) return '';

  try {
    return decodeURIComponent(parts[prefixIndex + 1]).trim();
  } catch {
    return parts[prefixIndex + 1].trim();
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

  box.innerHTML = `
    <h1>${esc(title)}</h1>
    <p>${esc(message)}</p>
  `;
}

// RPC tidak boleh membuat halaman Review gagal.
async function incrementReviewView(id) {
  try {
    if (!sb || typeof sb.rpc !== 'function') return;

    const result = sb.rpc('increment_review_view', {
      p_review_id: id
    });

    // Tidak menggunakan .catch() langsung pada hasil RPC.
    await Promise.resolve(result);

  } catch (error) {
    console.warn('Increment review view gagal:', error);
  }
}

// Mengambil data tambahan secara terpisah.
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

async function load() {
  if (!box) {
    console.error('Elemen reviewDetail tidak ditemukan.');
    return;
  }

  if (!slug) {
    showError(
      'Kode review tidak terbaca',
      'Pastikan URL berbentuk /r/KODE_REVIEW.'
    );
    return;
  }

  if (typeof sb === 'undefined' || !sb) {
    showError(
      'Supabase belum tersedia',
      'Periksa konfigurasi Supabase dan koneksi JavaScript.'
    );
    return;
  }

  try {
    const selectFields =
      'id,slug,title,description,thumbnail_url,price,access,created_at';

    let v = null;
    let queryError = null;

    // 1. Cari berdasarkan slug.
    const primary = await sb
      .from('review_items')
      .select(selectFields)
      .eq('slug', slug)
      .maybeSingle();

    v = primary.data;
    queryError = primary.error;

    // 2. Jika tidak ditemukan, coba pencarian tanpa membedakan kapital.
    if (!queryError && !v) {
      const alt = await sb
        .from('review_items')
        .select(selectFields)
        .ilike('slug', slug)
        .maybeSingle();

      v = alt.data;
      queryError = alt.error;
    }

    // 3. Jika masih belum ditemukan, coba ID.
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

      showError(
        'Gagal memuat review',
        queryError.message || 'Terjadi kesalahan saat mengambil data review.'
      );

      return;
    }

    if (!v) {
      showError(
        'Review tidak ditemukan',
        'Kode yang dicari: ' + slug +
        '. Pastikan slug benar dan review sudah berstatus published.'
      );

      return;
    }

    // Data tambahan dan penghitung views tidak memblokir halaman.
    const extra = await getReviewExtra(v.id);

    v.gallery_urls = extra?.gallery_urls || [];
    v.view_count = Number(extra?.view_count || 0);

    // Jalankan RPC tanpa menunggu keberhasilannya untuk menampilkan halaman.
    incrementReviewView(v.id);

    const imgs = Array.isArray(v.gallery_urls)
      ? v.gallery_urls
      : [];

    const galleryImages = imgs.length
      ? imgs
      : [v.thumbnail_url].filter(Boolean);

    const galleryHTML = galleryImages.length
      ? galleryImages.map((url, i) => `
          <img
            src="${esc(url)}"
            alt="${esc(v.title)} - gambar ${i + 1}"
            loading="lazy"
            data-full="${esc(url)}"
          >
        `).join('')
      : '<div class="ad-banner">Belum ada gambar review</div>';

    const downloadLabel = v.access === 'paid'
      ? 'Download / Beli ' + rp(v.price)
      : 'Download';

    box.innerHTML = `
      <span class="eyebrow">REVIEW GALLERY</span>

      <h1>${esc(v.title)}</h1>

      <div class="review-gallery">
        ${galleryHTML}
      </div>

      <div class="review-viewer" id="reviewViewer" hidden>
        <button
          type="button"
          class="viewer-close"
          aria-label="Tutup"
        >×</button>
        <img alt="Pratinjau gambar">
      </div>

      <p>${esc(v.description)}</p>

      <div class="watch-meta">
        <span>${v.view_count + 1} views</span>
        <span>
          Publish ${v.created_at
            ? new Date(v.created_at).toLocaleDateString('id-ID')
            : '-'}
        </span>
      </div>

      <a
        class="btn primary"
        href="/d/${encodeURIComponent(v.slug)}"
      >
        ${esc(downloadLabel)}
      </a>
    `;

    // Gallery viewer.
    const viewer = document.getElementById('reviewViewer');
    const viewerImg = viewer?.querySelector('img');

    if (viewer && viewerImg) {
      let scale = 1;
      let drag = false;
      let startX = 0;
      let startY = 0;
      let tx = 0;
      let ty = 0;

      function renderViewer() {
        viewerImg.style.transform =
          `translate(${tx}px, ${ty}px) scale(${scale})`;
      }

      function openViewer(src) {
        viewer.hidden = false;
        viewerImg.src = src;

        scale = 1;
        tx = 0;
        ty = 0;

        renderViewer();
      }

      box.querySelectorAll('.review-gallery img').forEach(img => {
        img.addEventListener('click', () => {
          openViewer(img.dataset.full || img.src);
        });
      });

      viewer.querySelector('.viewer-close').onclick = () => {
        viewer.hidden = true;
      };

      viewer.onclick = e => {
        if (e.target === viewer) {
          viewer.hidden = true;
        }
      };

      viewerImg.onwheel = e => {
        e.preventDefault();

        scale = Math.min(
          5,
          Math.max(1, scale + (e.deltaY < 0 ? 0.15 : -0.15))
        );

        renderViewer();
      };

      viewerImg.onpointerdown = e => {
        drag = true;
        startX = e.clientX - tx;
        startY = e.clientY - ty;

        viewerImg.setPointerCapture(e.pointerId);
      };

      viewerImg.onpointermove = e => {
        if (!drag) return;

        tx = e.clientX - startX;
        ty = e.clientY - startY;

        renderViewer();
      };

      viewerImg.onpointerup = () => {
        drag = false;
      };

      viewerImg.onpointercancel = () => {
        drag = false;
      };
    }

    // Rekomendasi tidak boleh menggagalkan halaman utama.
    loadMore(v.id);

  } catch (error) {
    console.error('Review detail error:', error);

    showError(
      'Terjadi kesalahan',
      error?.message || 'Gagal memuat halaman review.'
    );
  }
}

// Rekomendasi review.
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

    target.innerHTML = (data || []).map(x => `
      <a
        class="video-card"
        href="/r/${encodeURIComponent(x.slug)}"
      >
        ${
          x.thumbnail_url
            ? `<img src="${esc(x.thumbnail_url)}" alt="${esc(x.title)}" loading="lazy">`
            : ''
        }

        <div>
          <b>${esc(x.title)}</b>
          <small style="display:block">
            ${x.access === 'paid' ? rp(x.price) : 'Gratis'}
          </small>
        </div>
      </a>
    `).join('');

  } catch (error) {
    console.warn('Gagal memuat rekomendasi:', error);
    target.innerHTML = '';
  }
}

// Jalankan halaman.
load();
