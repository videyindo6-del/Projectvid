(() => {
  const grid = document.getElementById('telegramGrid');
  const searchInput = document.getElementById('telegramSearch');
  const searchClear = document.getElementById('telegramSearchClear');
  const categoryRoot = document.getElementById('telegramCategories');
  const top10Root = document.getElementById('telegramTop10');
  if (!grid) return;

  const removeLegacyOverlays = () => document.querySelectorAll([
    '.telegram-warning-float','.telegram-cover-label','.telegram-premium-badge',
    '.telegram-access-badge','.telegram-premium-overlay','.telegram-account-notice'
  ].join(',')).forEach(el => el.remove());
  removeLegacyOverlays();
  new MutationObserver(removeLegacyOverlays).observe(document.documentElement, {childList:true,subtree:true});

  const PAGE_SIZE = 10;
  let allItems = [], visibleItems = [], stats = new Map(), categories = [];
  let currentPage = 1, selectedCategory = 'all';
  const lang = () => localStorage.getItem('boxcellink_lang') || 'id';
  const isEN = () => lang() === 'en';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = v => Number(v || 0).toLocaleString(isEN() ? 'en-US' : 'id-ID');
  const money = v => 'Rp ' + Number(v || 0).toLocaleString('id-ID');

  function thumbnailSource(value) {
    let raw = String(value ?? '').trim(); if (!raw) return '';
    const iframe = raw.match(/<iframe[^>]+src=["']([^"']+)/i); if (iframe) raw = iframe[1];
    try {
      const u = new URL(raw, location.origin); if (!['http:','https:'].includes(u.protocol)) return '';
      const driveId = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get('id');
      if (u.hostname.includes('drive.google.com') && driveId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`;
      if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
        const id = u.hostname === 'youtu.be' ? u.pathname.split('/').filter(Boolean)[0] : (u.searchParams.get('v') || u.pathname.match(/\/embed\/([^/]+)/)?.[1]);
        if (id) return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`;
      }
      if (u.hostname.includes('dropbox.com')) { u.searchParams.set('raw','1'); return u.href; }
      return u.href;
    } catch { return ''; }
  }
  function reviewThumbnail(item) {
    const gallery = Array.isArray(item.gallery_urls) ? item.gallery_urls : [];
    for (const candidate of [item.thumbnail_url, ...gallery.map(x => typeof x === 'string' ? x : (x?.url || x?.src || x?.embed_url || x?.thumbnail_url))]) {
      const src = thumbnailSource(candidate); if (src) return src;
    }
    return '';
  }
  function renderCategories() {
    if (!categoryRoot) return;
    const allLabel = isEN() ? 'All' : 'Semua';
    categoryRoot.innerHTML = `<button type="button" class="telegram-category-chip${selectedCategory==='all'?' is-active':''}" data-category="all">${allLabel}</button>` + categories.map(c =>
      `<button type="button" class="telegram-category-chip${selectedCategory===c.id?' is-active':''}" data-category="${esc(c.id)}">${esc(c.name)}</button>`
    ).join('');
    categoryRoot.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.category; currentPage = 1; renderCategories(); applyFilters();
    }));
  }
  function renderTop10() {
    if (!top10Root) return;
    const ranked = [...allItems].sort((a,b) => {
      const x=stats.get(a.id)||{}, y=stats.get(b.id)||{};
      const score = (s,item) => Number(s.total_sold||0)*1000000 + Number(s.total_likes||0)*1000 + Number(s.total_comments||0)*100 + Number(item.view_count||0);
      return score(y,b)-score(x,a);
    }).slice(0,10);
    if (!ranked.length) {
      top10Root.innerHTML='<div class="telegram-top10-empty">Belum ada review yang dapat ditampilkan.</div>';
      return;
    }
    top10Root.innerHTML=ranked.map((item,index)=>{
      const thumb=reviewThumbnail(item), href=`/r/${encodeURIComponent(item.slug)}`;
      const price=item.access==='free'?(isEN()?'Free':'Gratis'):money(item.price);
      return `<a class="telegram-top10-card" href="${href}">
        <span class="telegram-top10-rank">${String(index+1).padStart(2,'0')}</span>
        <span class="telegram-top10-thumb${thumb?'':' no-image'}">${thumb?`<img src="${esc(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">`:'<i class="fa-brands fa-telegram"></i>'}</span>
        <span class="telegram-top10-info"><strong>${esc(item.title)}</strong><small><i class="fa-solid fa-eye"></i> ${number(item.view_count)} ${isEN()?'views':'views'}</small><b>${esc(price)}</b></span>
        <i class="fa-solid fa-arrow-up-right-from-square telegram-top10-open"></i>
      </a>`;
    }).join('');
  }

  function applyFilters() {
    const q = (searchInput?.value || '').trim().toLocaleLowerCase(isEN()?'en':'id');
    visibleItems = allItems.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
      const categoryName = categories.find(c => c.id === item.category_id)?.name || '';
      const matchesSearch = !q || `${item.title||''} ${item.description||''} ${categoryName}`.toLocaleLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
    currentPage = 1; render();
  }
  function render() {
    const totalPages = Math.ceil(visibleItems.length / PAGE_SIZE);
    if (searchClear) searchClear.hidden = !(searchInput?.value || '').length;
    if (!visibleItems.length) {
      grid.innerHTML = `<div class="telegram-empty"><span>✦</span><h3>${isEN()?'No matching reviews':'Review tidak ditemukan'}</h3><p>${isEN()?'Try another title or category.':'Coba kata kunci atau kategori lainnya.'}</p></div>`;
      return;
    }
    currentPage = Math.min(Math.max(1,currentPage),Math.max(1,totalPages));
    const start = (currentPage-1)*PAGE_SIZE;
    const cards = visibleItems.slice(start,start+PAGE_SIZE).map(item => {
      const s = stats.get(item.id) || {}, thumb = reviewThumbnail(item);
      const price = item.access === 'free' ? (isEN()?'Free':'Gratis') : money(item.price);
      const href = `/r/${encodeURIComponent(item.slug)}`;
      const categoryName = categories.find(c => c.id === item.category_id)?.name || (isEN() ? 'Telegram media' : 'Media Telegram');
      return `<article class="telegram-review-card">
        <a class="telegram-review-cover${thumb?'':' no-image'}" href="${href}" aria-label="${esc(item.title)}">
          ${thumb?`<img src="${esc(thumb)}" alt="${esc(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('no-image');this.parentElement.querySelector('.telegram-cover-placeholder')?.remove()">`:`<span class="telegram-cover-placeholder"><i class="fa-brands fa-telegram" aria-hidden="true"></i><strong>BOXCELLINK</strong><small>${isEN()?'Preview unavailable':'Preview belum tersedia'}</small></span>`}
          <span class="telegram-cover-badge"><i class="fa-brands fa-telegram" aria-hidden="true"></i> TELEGRAM</span>
          <span class="telegram-cover-open"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></span>
        </a>
        <div class="telegram-review-content">
          <div class="telegram-review-topline"><span><i class="fa-solid fa-layer-group" aria-hidden="true"></i> ${esc(categoryName)}</span><span class="telegram-review-kind">${isEN()?'REVIEW':'ULASAN'}</span></div>
          <h2><a href="${href}">${esc(item.title)}</a></h2>
          ${item.description ? `<p class="telegram-review-description">${esc(item.description)}</p>` : ''}
          <div class="telegram-price-panel">
            <span>${isEN()?'ONE-TIME ACCESS':'AKSES SEKALI BAYAR'}</span>
            <strong>${esc(price)}</strong>
          </div>
          <div class="telegram-review-stats" aria-label="${isEN()?'Review statistics':'Statistik review'}">
            <div><span class="telegram-stat-icon"><i class="fa-solid ${item.access === 'free' ? 'fa-eye' : 'fa-bag-shopping'}" aria-hidden="true"></i></span><b>${number(item.access === 'free' ? item.view_count : s.total_sold)}</b><small>${item.access === 'free' ? (isEN()?'Opens':'Dibuka') : (isEN()?'Sold':'Terjual')}</small></div>
            <div><span class="telegram-stat-icon"><i class="fa-solid fa-heart" aria-hidden="true"></i></span><b>${number(s.total_likes)}</b><small>${isEN()?'Likes':'Disukai'}</small></div>
            <div><span class="telegram-stat-icon"><i class="fa-solid fa-comments" aria-hidden="true"></i></span><b>${number(s.total_comments)}</b><small>${isEN()?'Comments':'Komentar'}</small></div>
          </div>
          <a class="telegram-review-button" href="${href}"><span>${isEN()?'Explore review':'Lihat detail review'}</span><i class="fa-solid fa-arrow-right telegram-review-arrow" aria-hidden="true"></i></a>
        </div>
      </article>`;
    }).join('');
    let pager = '';
    if (visibleItems.length > PAGE_SIZE) {
      const buttons = [];
      const add = (p,label,active=false,disabled=false) => buttons.push(`<button type="button" class="telegram-page-btn${active?' is-active':''}" data-page="${p}" ${disabled?'disabled':''} ${active?'aria-current="page"':''}>${label}</button>`);
      add(currentPage-1,'<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>',false,currentPage===1);
      let from=Math.max(1,currentPage-2),to=Math.min(totalPages,from+4); from=Math.max(1,to-4);
      if(from>1){add(1,'1');if(from>2)buttons.push('<span class="telegram-page-dots">…</span>');}
      for(let p=from;p<=to;p++) add(p,String(p),p===currentPage);
      if(to<totalPages){if(to<totalPages-1)buttons.push('<span class="telegram-page-dots">…</span>');add(totalPages,String(totalPages));}
      add(currentPage+1,'<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>',false,currentPage===totalPages);
      pager=`<nav class="telegram-pagination" aria-label="${isEN()?'Review pages':'Halaman review'}"><div class="telegram-pagination-inner"><span class="telegram-pagination-label">${isEN()?'Page':'Halaman'} <b>${currentPage}</b> ${isEN()?'of':'dari'} <b>${totalPages}</b></span><div class="telegram-page-controls">${buttons.join('')}</div></div></nav>`;
    }
    grid.innerHTML = cards + pager;
    grid.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click',()=>{
      if(btn.disabled)return; currentPage=Number(btn.dataset.page); render(); grid.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }
  async function load() {
    if (!window.sb) { grid.innerHTML=`<div class="telegram-empty">${isEN()?'Service is temporarily unavailable.':'Layanan sementara tidak tersedia.'}</div>`; return; }
    grid.innerHTML=`<div class="telegram-loading"><span class="telegram-spinner"></span>${isEN()?'Loading published reviews…':'Memuat review yang dipublikasikan…'}</div>`;
    try {
      const [reviewsResult,categoriesResult] = await Promise.all([
        sb.from('review_items').select('id,slug,title,description,thumbnail_url,gallery_urls,price,access,category_id,view_count,created_at').eq('status','published').order('created_at',{ascending:false}),
        sb.from('categories').select('id,name,status').eq('status','published').order('name')
      ]);
      if (reviewsResult.error) throw reviewsResult.error;
      if (categoriesResult.error) console.warn('Category list unavailable:',categoriesResult.error.message);
      allItems = reviewsResult.data || []; categories = categoriesResult.data || [];
      const urlCategory = new URLSearchParams(location.search).get('category');
      if(urlCategory && categories.some(c=>c.id===urlCategory)) selectedCategory=urlCategory;
      renderCategories();
      stats = new Map();
      if(allItems.length){
        const {data:rows,error:rpcError}=await sb.rpc('get_public_review_stats');
        if(!rpcError && Array.isArray(rows)) stats=new Map(rows.map(row=>[row.review_id,row]));
        else {
          console.warn('Public review stats RPC unavailable:',rpcError?.message);
          const ids=allItems.map(x=>x.id);
          const [likes,comments,orders]=await Promise.all([
            sb.from('review_likes').select('review_id').in('review_id',ids),
            sb.from('review_comments').select('review_id').in('review_id',ids).eq('is_hidden',false),
            sb.from('review_entitlements').select('review_id').in('review_id',ids)
          ]);
          const count=rows=>(rows||[]).reduce((m,r)=>m.set(r.review_id,(m.get(r.review_id)||0)+1),new Map());
          const l=count(likes.data),c=count(comments.data),sold=count(orders.data);
          stats=new Map(allItems.map(item=>[item.id,{total_sold:sold.get(item.id)||0,total_likes:l.get(item.id)||0,total_comments:c.get(item.id)||0}]));
        }
      }
      renderTop10();
      applyFilters();
    } catch(error) {
      console.error('Telegram review listing:',error);
      grid.innerHTML=`<div class="telegram-empty"><h3>${isEN()?'Could not load reviews':'Review belum dapat dimuat'}</h3><p>${esc(error.message||'Unknown error')}</p><button class="telegram-review-button" type="button" id="telegramRetry">${isEN()?'Try again':'Coba lagi'}</button></div>`;
      document.getElementById('telegramRetry')?.addEventListener('click',load);
    }
  }
  searchInput?.addEventListener('input',applyFilters);
  searchClear?.addEventListener('click',()=>{searchInput.value='';applyFilters();searchInput.focus();});
  window.addEventListener('storage',e=>{if(e.key==='boxcellink_lang'){renderCategories();applyFilters();}});
  load();
})();
