(() => {
  const grid = document.getElementById('telegramGrid');
  if (!grid) return;

  // Remove the legacy Telegram account notice and thumbnail overlays. These
  // elements are no longer part of the catalogue and must never cover media.
  const removeLegacyOverlays = () => {
    document.querySelectorAll([
      '.telegram-warning-float',
      '.telegram-cover-label',
      '.telegram-premium-badge',
      '.telegram-access-badge',
      '.telegram-premium-overlay',
      '.telegram-account-notice'
    ].join(',')).forEach(element => element.remove());
  };
  removeLegacyOverlays();
  const legacyOverlayObserver = new MutationObserver(removeLegacyOverlays);
  legacyOverlayObserver.observe(document.documentElement, { childList: true, subtree: true });
  const PAGE_SIZE = 16;
  let allItems = [];
  let stats = new Map();
  let currentPage = 1;
  const lang = () => localStorage.getItem('boxcellink_lang') || 'id';
  const isEN = () => lang() === 'en';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Number(value || 0).toLocaleString(isEN() ? 'en-US' : 'id-ID');
  const money = value => 'Rp ' + Number(value || 0).toLocaleString('id-ID');

  // Convert URLs commonly entered in Review Admin into browser-renderable thumbnails.
  function thumbnailSource(value) {
    let raw = String(value ?? '').trim();
    if (!raw) return '';
    const iframe = raw.match(/<iframe[^>]+src=[\"']([^\"']+)/i);
    if (iframe) raw = iframe[1];
    try {
      const u = new URL(raw, location.origin);
      if (!['http:', 'https:'].includes(u.protocol)) return '';
      const driveId = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get('id');
      if (u.hostname.includes('drive.google.com') && driveId) {
        return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1000`;
      }
      if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
        const id = u.hostname === 'youtu.be' ? u.pathname.split('/').filter(Boolean)[0] : (u.searchParams.get('v') || u.pathname.match(/\/embed\/([^/]+)/)?.[1]);
        if (id) return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
      }
      if (u.hostname.includes('dropbox.com')) {
        u.searchParams.set('raw', '1');
        return u.href;
      }
      return u.href;
    } catch { return ''; }
  }

  function reviewThumbnail(item) {
    const gallery = Array.isArray(item.gallery_urls) ? item.gallery_urls : [];
    const candidates = [item.thumbnail_url, ...gallery.map(x => typeof x === 'string' ? x : (x?.url || x?.src || x?.embed_url || x?.thumbnail_url))];
    for (const candidate of candidates) {
      const src = thumbnailSource(candidate);
      if (src) return src;
    }
    return '';
  }

  function render() {
    const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    if (!allItems.length) {
      grid.innerHTML = `<div class="telegram-empty"><span>✦</span><h3>${isEN() ? 'No reviews yet' : 'Belum ada review'}</h3><p>${isEN() ? 'Published reviews will appear here.' : 'Review yang sudah dipublikasikan akan tampil di sini.'}</p></div>`;
      return;
    }
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = allItems.slice(start, start + PAGE_SIZE);
    const cards = pageItems.map(item => {
      const s = stats.get(item.id) || {};
      const thumb = reviewThumbnail(item);
      const price = item.access === 'free' ? (isEN() ? 'Free' : 'Gratis') : money(item.price);
      const href = `/r/${encodeURIComponent(item.slug)}`;
      return `<article class="telegram-review-card">
        <a class="telegram-review-cover${thumb ? '' : ' no-image'}" href="${href}" aria-label="${esc(item.title)}">
          ${thumb ? `<img src="${esc(thumb)}" alt="${esc(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('no-image')">` : ''}
        </a>
        <div class="telegram-review-content">
          <div class="telegram-review-topline"><span>${isEN() ? 'PRODUCT REVIEW' : 'REVIEW PRODUK'}</span><span class="telegram-review-type">${isEN() ? 'TELEGRAM' : 'TELEGRAM'}</span></div>
          <h2><a href="${href}">${esc(item.title)}</a></h2>
          <p class="telegram-review-description">${esc(item.description || (isEN() ? 'Open this review to see the complete product description, media preview, access information, and purchase instructions.' : 'Buka halaman review untuk melihat deskripsi produk, pratinjau media, informasi akses, dan petunjuk pembelian secara lengkap.'))}</p>
          <div class="telegram-price-panel"><span>${isEN() ? 'ACCESS PRICE' : 'HARGA AKSES'}</span><strong>${esc(price)}</strong></div>
          <div class="telegram-review-stats">
            <div><b>${number(s.total_sold)}</b><span><i class="fa-solid fa-bag-shopping"></i> ${isEN() ? 'Sold' : 'Terjual'}</span></div>
            <div><b>${number(s.total_likes)}</b><span><i class="fa-solid fa-heart"></i> ${isEN() ? 'Likes' : 'Like'}</span></div>
            <div><b>${number(s.total_comments)}</b><span><i class="fa-solid fa-comment"></i> ${isEN() ? 'Comments' : 'Komentar'}</span></div>
          </div>
          <a class="telegram-review-button" href="${href}"><span>${isEN() ? 'View full review' : 'Lihat Review Lengkap'}</span><span class="telegram-review-arrow" aria-hidden="true">→</span></a>
        </div>
      </article>`;
    }).join('');
    const buttons = [];
    const add = (p, label, active = false, disabled = false) => buttons.push(`<button type="button" class="telegram-page-btn${active ? ' is-active' : ''}" data-page="${p}" ${disabled ? 'disabled' : ''} ${active ? 'aria-current="page"' : ''}>${label}</button>`);
    add(currentPage - 1, isEN() ? 'Previous' : '‹', false, currentPage === 1);
    let from = Math.max(1, currentPage - 2), to = Math.min(totalPages, from + 4);
    from = Math.max(1, to - 4);
    if (from > 1) { add(1, '1'); if (from > 2) buttons.push('<span class="telegram-page-dots">…</span>'); }
    for (let p = from; p <= to; p++) add(p, p, p === currentPage);
    if (to < totalPages) { if (to < totalPages - 1) buttons.push('<span class="telegram-page-dots">…</span>'); add(totalPages, totalPages); }
    add(currentPage + 1, isEN() ? 'Next' : '›', false, currentPage === totalPages);
    grid.innerHTML = `${cards}<nav class="telegram-pagination" aria-label="Review pages"><span>${isEN() ? 'Showing' : 'Menampilkan'} ${start + 1}–${Math.min(start + PAGE_SIZE, allItems.length)} ${isEN() ? 'of' : 'dari'} ${number(allItems.length)} ${isEN() ? 'reviews' : 'review'} · ${isEN() ? '16 per page' : '16 review per halaman'}</span><div class="telegram-page-controls">${buttons.join('')}</div></nav>`;
    grid.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
      if (button.disabled) return;
      currentPage = Number(button.dataset.page);
      render();
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  async function load() {
    if (!window.sb) {
      grid.innerHTML = `<div class="telegram-empty">${isEN() ? 'Service is temporarily unavailable.' : 'Layanan sementara tidak tersedia.'}</div>`;
      return;
    }
    grid.innerHTML = `<div class="telegram-loading"><span class="telegram-spinner"></span>${isEN() ? 'Loading published reviews…' : 'Memuat review yang dipublikasikan…'}</div>`;
    try {
      const { data, error } = await sb.from('review_items')
        .select('id,slug,title,description,thumbnail_url,gallery_urls,price,access,view_count,created_at')
        .eq('status', 'published').order('created_at', { ascending: false });
      const categoryId = new URLSearchParams(location.search).get('category');
      if (categoryId) { const filtered = await sb.from('review_items').select('id,slug,title,description,thumbnail_url,gallery_urls,price,access,view_count,created_at').eq('status','published').eq('category_id',categoryId).order('created_at',{ascending:false}); if (filtered.error) throw filtered.error; allItems = filtered.data || []; } else { allItems = data || []; }
      if (error) throw error;
      currentPage = 1;
      stats = new Map();
      if (allItems.length) {
        const { data: statRows, error: statError } = await sb.rpc('get_public_review_stats');
        if (!statError && Array.isArray(statRows)) {
          stats = new Map(statRows.map(row => [row.review_id, row]));
        } else {
          console.warn('Public review stats RPC unavailable:', statError?.message);
          const ids = allItems.map(item => item.id);
          const [likesResult, commentsResult] = await Promise.all([
            sb.from('review_likes').select('review_id').in('review_id', ids),
            sb.from('review_comments').select('review_id').in('review_id', ids).eq('is_hidden', false)
          ]);
          const count = rows => (rows || []).reduce((map, row) => map.set(row.review_id, (map.get(row.review_id) || 0) + 1), new Map());
          const likes = count(likesResult.data), comments = count(commentsResult.data);
          stats = new Map(allItems.map(item => [item.id, { total_sold: 0, total_likes: likes.get(item.id) || 0, total_comments: comments.get(item.id) || 0 }]));
        }
      }
      render();
    } catch (error) {
      console.error('Telegram review listing:', error);
      grid.innerHTML = `<div class="telegram-empty"><h3>${isEN() ? 'Could not load reviews' : 'Review belum dapat dimuat'}</h3><p>${esc(error.message || 'Unknown error')}</p><button class="telegram-review-button" type="button" id="telegramRetry">${isEN() ? 'Try again' : 'Coba lagi'}</button></div>`;
      document.getElementById('telegramRetry')?.addEventListener('click', load);
    }
  }
  window.addEventListener('storage', event => { if (event.key === 'boxcellink_lang') render(); });
  load();
})();
