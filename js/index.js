(() => {
  const videoGrid = document.getElementById('homeVideoGrid');
  const telegramGrid = document.getElementById('homeTelegramGrid');
  const search = document.getElementById('homeSearch');
  const clear = document.getElementById('homeSearchClear');
  const count = document.getElementById('catalogCount');
  if (!videoGrid || !telegramGrid) return;

  // Homepage CTA mengikuti sesi Supabase: tombol Login/Register hanya untuk guest.
  const guestActions = document.getElementById('homeGuestActions');
  const bottomCta = document.getElementById('homeBottomCta');
  const ctaDescription = document.getElementById('homeCtaDescription');
  const ctaLink = document.getElementById('homeCtaLink');
  let authStateResolved = false;
  function updateHomeAuthUI(user) {
    authStateResolved = true;
    if (guestActions) guestActions.hidden = !!user;
    if (bottomCta) {
      bottomCta.hidden = false;
      if (user) {
        if (ctaDescription) ctaDescription.textContent = en()
          ? 'Continue exploring your Boxcelink member area.'
          : 'Lanjutkan menjelajahi konten dan fitur member Boxcelink.';
        if (ctaLink) {
          ctaLink.href = '/dashboard.html';
          ctaLink.innerHTML = `${en() ? 'Open Dashboard' : 'Buka Dashboard'} <i class="fa-solid fa-arrow-right"></i>`;
        }
      } else {
        if (ctaDescription) ctaDescription.textContent = en()
          ? 'Create a free account to enjoy a more complete content experience.'
          : 'Buat akun gratis untuk menikmati pengalaman konten yang lebih lengkap.';
        if (ctaLink) {
          ctaLink.href = '/register.html';
          ctaLink.innerHTML = `${en() ? 'Create account' : 'Buat akun'} <i class="fa-solid fa-arrow-right"></i>`;
        }
      }
    }
  }
  async function checkHomeAuth() {
    if (!window.sb?.auth) {
      updateHomeAuthUI(null);
      return;
    }
    try {
      const { data, error } = await window.sb.auth.getSession();
      if (error) throw error;
      updateHomeAuthUI(data?.session?.user || null);
    } catch (error) {
      // Jika pemeriksaan sesi gagal, jangan menyimpulkan bahwa user sudah logout.
      console.warn('Homepage auth state unavailable:', error);
      updateHomeAuthUI(null);
    }
    window.sb.auth.onAuthStateChange((_event, session) => {
      updateHomeAuthUI(session?.user || null);
    });
  }
  checkHomeAuth();

  let videos = [], reviews = [];
  const selectedVideoCategory = new URLSearchParams(location.search).get('category') || '';
  const categoryFilter = (items) => selectedVideoCategory ? items.filter(v => v.category_id === selectedVideoCategory) : items;
  const lang = () => localStorage.getItem('boxcellink_lang') || 'id';
  const en = () => lang() === 'en';
  const t = (id, english) => en() ? english : id;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => 'Rp ' + Number(value || 0).toLocaleString('id-ID');
  const thumb = value => {
    let raw = String(value || '').trim(); if (!raw) return '';
    const iframe = raw.match(/<iframe[^>]+src=["']([^"']+)/i); if (iframe) raw = iframe[1];
    try {
      const u = new URL(raw, location.origin); if (!['http:','https:'].includes(u.protocol)) return '';
      const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get('id');
      if (u.hostname.includes('drive.google.com') && id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000`;
      if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') { const vid = u.hostname === 'youtu.be' ? u.pathname.split('/').filter(Boolean)[0] : (u.searchParams.get('v') || u.pathname.match(/\/embed\/([^/]+)/)?.[1]); if (vid) return `https://i.ytimg.com/vi/${encodeURIComponent(vid)}/hqdefault.jpg`; }
      return u.href;
    } catch { return ''; }
  };
  const placeholder = (icon, label) => `<div class="home-thumb-placeholder"><i class="${icon}"></i><span>${label}</span></div>`;

  function render() {
    const q = (search?.value || '').trim().toLocaleLowerCase(en() ? 'en' : 'id');
    const foundVideos = categoryFilter(videos).filter(v => !q || `${v.title || ''} ${v.provider || ''}`.toLocaleLowerCase().includes(q));
    const foundReviews = reviews.filter(r => !q || `${r.title || ''} ${r.description || ''}`.toLocaleLowerCase().includes(q));
    if (count) count.textContent = t(`${foundVideos.length + foundReviews.length} konten ditemukan`, `${foundVideos.length + foundReviews.length} items found`);
    if (clear) clear.hidden = !(search?.value || '').length;
    videoGrid.innerHTML = foundVideos.length ? foundVideos.slice(0, 8).map(v => {
      const image = thumb(v.thumbnail_url), href = `/v/${encodeURIComponent(v.slug || v.id)}`;
      return `<article class="home-content-card"><a class="home-card-thumb" href="${href}">${image ? `<img src="${esc(image)}" alt="${esc(v.title)}" loading="lazy" onerror="this.remove()">` : placeholder('fa-solid fa-play','BOX VIDEY')}<span class="thumb-play"><i class="fa-solid fa-play"></i></span><span class="thumb-tag">BOX VIDEY</span></a><div class="home-card-body"><h3><a href="${href}">${esc(v.title)}</a></h3><div class="home-card-meta"><span><i class="fa-solid fa-circle-play"></i> ${esc(v.provider || 'Video')}</span><span>${Number(v.view_count || 0).toLocaleString(en()?'en-US':'id-ID')} ${t('views','views')}</span></div><a class="home-card-link" href="${href}">${t('Tonton video','Watch video')} <i class="fa-solid fa-arrow-right"></i></a></div></article>`;
    }).join('') : `<div class="home-empty">${t('Video tidak ditemukan.','No videos found.')}</div>`;

    telegramGrid.innerHTML = foundReviews.length ? foundReviews.slice(0, 8).map(r => {
      const image = thumb(r.thumbnail_url) || thumb(Array.isArray(r.gallery_urls) ? (typeof r.gallery_urls[0] === 'string' ? r.gallery_urls[0] : r.gallery_urls[0]?.url) : ''), href = `/r/${encodeURIComponent(r.slug)}`;
      const price = r.access === 'free' ? t('Gratis','Free') : money(r.price);
      return `<article class="home-content-card"><a class="home-card-thumb" href="${href}">${image ? `<img src="${esc(image)}" alt="${esc(r.title)}" loading="lazy">` : placeholder('fa-brands fa-telegram','TELEGRAM MEDIA')}<span class="thumb-tag telegram-tag">TELEGRAM</span></a><div class="home-card-body"><div class="home-review-label">${t('REVIEW TELEGRAM','TELEGRAM REVIEW')}</div><h3><a href="${href}">${esc(r.title)}</a></h3><p class="home-review-description">${esc(r.description || t('Lihat detail review dan informasi akses media ini.','View the review details and access information for this media.')).slice(0,105)}</p><div class="home-card-meta"><span><i class="fa-solid fa-ticket"></i> ${t('Harga akses','Access price')}</span><strong>${price}</strong></div><a class="home-card-link" href="${href}">${t('Lihat review','View review')} <i class="fa-solid fa-arrow-right"></i></a></div></article>`;
    }).join('') : `<div class="home-empty">${t('Review Telegram tidak ditemukan.','No Telegram reviews found.')}</div>`;
  }

  async function load() {
    if (!window.sb) { videoGrid.innerHTML = telegramGrid.innerHTML = `<div class="home-empty">${t('Layanan sementara tidak tersedia.','Service is temporarily unavailable.')}</div>`; return; }
    try {
      const [videoResult, reviewResult] = await Promise.all([
        sb.from('videos').select('id,slug,title,provider,thumbnail_url,access,view_count,created_at,category_id').eq('status','published').eq('access','public').order('created_at',{ascending:false}).limit(40),
        sb.from('review_items').select('id,slug,title,description,thumbnail_url,gallery_urls,price,access,created_at').eq('status','published').order('created_at',{ascending:false}).limit(40)
      ]);
      if (videoResult.error) throw videoResult.error;
      if (reviewResult.error) throw reviewResult.error;
      videos = videoResult.data || []; reviews = reviewResult.data || [];
      render();
    } catch (error) {
      console.error('Homepage content failed:', error);
      videoGrid.innerHTML = `<div class="home-empty">${t('Video belum dapat dimuat. Silakan coba lagi nanti.','Videos could not be loaded. Please try again later.')}</div>`;
      telegramGrid.innerHTML = `<div class="home-empty">${t('Review belum dapat dimuat. Silakan coba lagi nanti.','Reviews could not be loaded. Please try again later.')}</div>`;
      if (count) count.textContent = t('Konten belum tersedia','Content unavailable');
    }
  }
  search?.addEventListener('input', render);
  clear?.addEventListener('click', () => { search.value = ''; search.focus(); render(); });
  window.addEventListener('storage', e => { if (e.key === 'boxcellink_lang') render(); });
  load();
})();
