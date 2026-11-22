(() => {
  'use strict';

  const grid = document.getElementById('reviewGrid');
  const pager = document.getElementById('reviewPagination');
  const searchInput = document.getElementById('reviewCatalogSearch');
  const clearSearch = document.getElementById('reviewCatalogClear');
  const countLabel = document.getElementById('reviewCatalogCount');
  const titleLabel = document.getElementById('reviewCatalogTitle');
  const descriptionLabel = document.getElementById('reviewCatalogDescription');
  const listTitle = document.getElementById('reviewCatalogListTitle');
  const searchHint = document.getElementById('reviewCatalogSearchHint');
  const perPage = 12;
  let page = 1;
  let searchTerm = '';
  let loading = false;
  let searchTimer = null;
  let lastRequest = 0;

  const lang = () => localStorage.getItem('boxcellink_lang') === 'en' ? 'en' : 'id';
  const en = () => lang() === 'en';
  const text = () => en() ? {
    title: 'Telegram Media Reviews',
    description: 'Read the details, preview the media, and check access pricing before continuing.',
    list: 'Review Catalog',
    loading: 'Loading reviews…',
    count: n => `${n.toLocaleString('en-US')} review${n === 1 ? '' : 's'} found`,
    search: 'Search review titles or descriptions…',
    hint: 'Search published reviews by title or description.',
    noItems: 'No published reviews yet.',
    noResults: 'No reviews match your search. Try another keyword.',
    error: 'Reviews could not be loaded. Please check your connection and try again.',
    retry: 'Retry',
    paid: 'Paid access', free: 'Free', preview: 'View review',
    thumbWait: 'Loading thumbnail…', thumbFail: 'Preview unavailable',
    price: 'Access price', page: 'Page', previous: 'Previous page', next: 'Next page'
  } : {
    title: 'Review Media Telegram',
    description: 'Baca informasi, lihat pratinjau media, dan periksa harga akses sebelum melanjutkan.',
    list: 'Daftar Review',
    loading: 'Memuat review…',
    count: n => `${n.toLocaleString('id-ID')} review ditemukan`,
    search: 'Cari judul atau deskripsi review…',
    hint: 'Cari berdasarkan judul atau deskripsi review yang dipublikasikan.',
    noItems: 'Belum ada review yang dipublikasikan.',
    noResults: 'Review tidak ditemukan. Coba kata kunci lain.',
    error: 'Review gagal dimuat. Periksa koneksi internet lalu coba lagi.',
    retry: 'Coba lagi',
    paid: 'Akses berbayar', free: 'Gratis', preview: 'Lihat review',
    thumbWait: 'Memuat thumbnail…', thumbFail: 'Preview tidak tersedia',
    price: 'Harga akses', page: 'Halaman', previous: 'Halaman sebelumnya', next: 'Halaman berikutnya'
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function parseUrl(raw) {
    let value = String(raw ?? '').trim();
    if (!value) return null;
    const embedded = value.match(/<(?:iframe|img|video|source)[^>]*\bsrc=["']([^"']+)["']/i);
    if (embedded) value = embedded[1];
    if (value.startsWith('//')) value = `https:${value}`;
    try {
      const url = new URL(value, location.origin);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return url;
    } catch { return null; }
  }

  function thumbnailFrom(raw) {
    const url = parseUrl(raw);
    if (!url) return '';
    const host = url.hostname.toLowerCase(), path = url.pathname;
    if (/drive\.google\.com$/.test(host)) {
      const id = path.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id');
      if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w900`;
    }
    if (host === 'youtu.be' || /youtube\.com$/.test(host) || /youtube-nocookie\.com$/.test(host)) {
      const id = host === 'youtu.be' ? path.split('/').filter(Boolean)[0] : (url.searchParams.get('v') || path.match(/\/(?:embed|shorts|live)\/([^/]+)/)?.[1]);
      if (id) return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
    }
    if (/videy\.co$/.test(host) || /cdn\.videy\.co$/.test(host)) {
      const id = url.searchParams.get('id') || path.match(/\/(?:v|embed)\/([^/]+)/)?.[1] || path.split('/').filter(Boolean).pop()?.replace(/\.(?:mp4|webm)$/i, '');
      if (id) return `https://cdn.videy.co/${encodeURIComponent(id)}.jpg`;
    }
    if (/dropbox\.com$/.test(host)) {
      if (/\.(?:jpg|jpeg|png|webp|gif|avif)$/i.test(path)) {
        url.searchParams.delete('dl'); url.searchParams.set('raw', '1'); return url.href;
      }
    }
    if (/dailymotion\.com$/.test(host) || host === 'dai.ly') {
      const id = path.match(/\/(?:video|embed\/video)\/([^_/?]+)/)?.[1] || (host === 'dai.ly' ? path.slice(1) : '');
      if (id) return `https://www.dailymotion.com/thumbnail/video/${encodeURIComponent(id)}`;
    }
    if (/\.image\.(?:jpg|jpeg|png|webp|gif)$/i.test(host) || /\.(?:jpg|jpeg|png|webp|gif|avif|bmp)$/i.test(path)) return url.href;
    const parsed = window.ProjectVIDEmbed?.parse(raw);
    if (parsed?.thumbnail) return parsed.thumbnail;
    if (parsed?.type === 'image') return parsed.src;
    // Do not use video-player/embed URLs as <img> sources.
    return '';
  }

  function galleryUrls(value) {
    if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : item?.url || item?.src || item?.embed_url || item?.embed || item?.thumbnail_url || '').filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
      try { return galleryUrls(JSON.parse(value)); } catch { return [value.trim()]; }
    }
    return [];
  }

  function candidatesFor(item) {
    return [item.thumbnail_url, ...galleryUrls(item.gallery_urls)]
      .map(thumbnailFrom).filter((src, index, list) => src && list.indexOf(src) === index);
  }

  function thumbMarkup(item, candidates) {
    const fallback = `<div class="review-catalog-thumb-fallback"><i class="fa-solid fa-photo-film"></i><span>${esc(text().thumbFail)}</span></div>`;
    if (!candidates.length) return `<div class="review-catalog-thumb is-fallback">${fallback}</div>`;
    return `<div class="review-catalog-thumb"><span class="review-catalog-thumb-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> ${esc(text().thumbWait)}</span><img src="${esc(candidates[0])}" data-thumb-candidates="${esc(JSON.stringify(candidates))}" data-thumb-index="0" alt="${esc(item.title)}" loading="lazy"></div>`;
  }

  function cardMarkup(item) {
    const candidates = candidatesFor(item);
    const paid = item.access === 'paid';
    const price = paid ? `Rp ${Number(item.price || 0).toLocaleString(en() ? 'en-US' : 'id-ID')}` : text().free;
    const excerpt = String(item.description || '').trim();
    return `<a class="media-card review-catalog-card" href="/r/${encodeURIComponent(item.slug || item.id)}" aria-label="${esc(text().preview)}: ${esc(item.title)}">
      ${thumbMarkup(item, candidates)}
      <div class="media-body review-catalog-card-body">
        <div class="review-catalog-card-top"><span class="review-catalog-access ${paid ? 'is-paid' : 'is-free'}">${esc(paid ? text().paid : text().free)}</span><span class="review-catalog-price">${esc(price)}</span></div>
        <h3>${esc(item.title || (en() ? 'Untitled review' : 'Review tanpa judul'))}</h3>
        <p>${esc(excerpt.slice(0, 135))}${excerpt.length > 135 ? '…' : ''}</p>
        <span class="review-catalog-card-cta">${esc(text().preview)} <i class="fa-solid fa-arrow-right"></i></span>
      </div>
    </a>`;
  }


  function setLoading() {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = `<div class="review-catalog-state"><span class="review-catalog-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></span><b>${esc(text().loading)}</b></div>`;
    pager.innerHTML = '';
    countLabel.textContent = text().loading;
  }


  function setError() {
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = `<div class="review-catalog-state is-error"><i class="fa-solid fa-triangle-exclamation"></i><b>${esc(text().error)}</b><button type="button" class="review-catalog-retry">${esc(text().retry)}</button></div>`;
    grid.querySelector('.review-catalog-retry')?.addEventListener('click', load);
    pager.innerHTML = '';
    countLabel.textContent = '';
  }

  function applyPageTranslations() {
    const t = text();
    if (titleLabel) titleLabel.textContent = t.title;
    if (descriptionLabel) descriptionLabel.textContent = t.description;
    if (listTitle) listTitle.textContent = t.list;
    if (searchInput) searchInput.placeholder = t.search;
    if (searchHint) searchHint.textContent = t.hint;
    if (clearSearch) clearSearch.hidden = !searchInput?.value;
  }

  async function load() {
    if (!grid || typeof sb === 'undefined' || !sb) {
      if (grid && (!window.sb || typeof window.sb.from !== 'function')) setError();
      return;
    }
    loading = true;
    const requestId = ++lastRequest;
    setLoading();
    applyPageTranslations();
    try {
      let query = sb.from('review_items').select('id,slug,title,description,thumbnail_url,gallery_urls,price,access,created_at', { count: 'exact' }).eq('status', 'published').order('created_at', { ascending: false });
      if (searchTerm) {
        const term = searchTerm.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim().slice(0, 80);
        if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
      }
      const { data, error, count } = await query.range((page - 1) * perPage, page * perPage - 1);
      if (requestId !== lastRequest) return;
      if (error) throw error;
      const rows = data || [];
      grid.setAttribute('aria-busy', 'false');
      countLabel.textContent = text().count(Number(count || 0));
      if (!rows.length) {
        grid.innerHTML = `<div class="review-catalog-state"><i class="fa-regular fa-folder-open"></i><b>${esc(searchTerm ? text().noResults : text().noItems)}</b></div>`;
        pager.innerHTML = '';
        return;
      }
      grid.innerHTML = rows.map(cardMarkup).join('');
      grid.querySelectorAll('img[data-thumb-candidates]').forEach(img => {
        const thumb = img.parentElement;
        const handleLoad = () => thumb?.classList.add('is-loaded');
        const handleError = () => {
          const candidates = JSON.parse(img.dataset.thumbCandidates || '[]');
          const nextIndex = Number(img.dataset.thumbIndex || 0) + 1;
          if (nextIndex < candidates.length) {
            img.dataset.thumbIndex = String(nextIndex);
            img.src = candidates[nextIndex];
          } else {
            img.remove();
            thumb?.classList.add('is-failed');
            if (thumb && !thumb.querySelector('.review-catalog-thumb-fallback')) {
              thumb.insertAdjacentHTML('beforeend', `<div class="review-catalog-thumb-fallback"><i class="fa-solid fa-photo-film"></i><span>${esc(text().thumbFail)}</span></div>`);
            }
          }
        };
        img.addEventListener('load', handleLoad, { once: true });
        img.addEventListener('error', handleError);
        // Lazy images may finish before handlers are attached.
        if (img.complete) { if (img.naturalWidth > 0) handleLoad(); else handleError(); }
      });
      renderPager(Number(count || 0));
    } catch (error) {
      if (requestId === lastRequest) {
        console.error('Review catalog load error:', error);
        setError();
      }
    } finally {
      if (requestId === lastRequest) loading = false;
    }
  }


  function renderPager(total) {
    const pages = Math.ceil(total / perPage);
    pager.innerHTML = '';
    if (pages <= 1) return;
    const t = text();
    const previous = document.createElement('button');
    previous.type = 'button'; previous.className = 'review-page-arrow'; previous.disabled = page <= 1;
    previous.setAttribute('aria-label', t.previous); previous.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    previous.addEventListener('click', () => changePage(page - 1)); pager.append(previous);
    for (let n = 1; n <= pages; n++) {
      const button = document.createElement('button'); button.type = 'button'; button.className = `review-page-number${n === page ? ' is-active' : ''}`;
      button.textContent = n; button.disabled = n === page; button.setAttribute('aria-current', n === page ? 'page' : 'false');
      button.addEventListener('click', () => changePage(n)); pager.append(button);
    }
    const next = document.createElement('button');
    next.type = 'button'; next.className = 'review-page-arrow'; next.disabled = page >= pages;
    next.setAttribute('aria-label', t.next); next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    next.addEventListener('click', () => changePage(page + 1)); pager.append(next);
  }

  function changePage(next) {
    const max = Math.max(1, next);
    if (max === page) return;
    page = max;
    load();
    document.querySelector('.review-catalog-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (searchInput) searchInput.addEventListener('input', () => {
    clearSearch.hidden = !searchInput.value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { searchTerm = searchInput.value.trim(); page = 1; load(); }, 280);
  });
  clearSearch?.addEventListener('click', () => { searchInput.value = ''; searchTerm = ''; page = 1; clearSearch.hidden = true; load(); searchInput.focus(); });
  document.addEventListener('boxcellink:language-change', () => { applyPageTranslations(); load(); });
  window.addEventListener('storage', event => { if (event.key === 'boxcellink_lang') { applyPageTranslations(); load(); } });
  applyPageTranslations();
  load();
})();
