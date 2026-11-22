(() => {
  const grid = document.getElementById('telegramGrid');
  const searchInput = document.getElementById('telegramSearch');
  const searchClear = document.getElementById('telegramSearchClear');
  const categoryRoot = document.getElementById('telegramCategories');
  const top10Root = document.getElementById('telegramTop10');
  const top10Pager = document.getElementById('telegramTop10Pagination');
  const top10Title=document.getElementById('telegramTop10Title'),top10Description=document.getElementById('telegramTop10Description'),top10Kicker=document.getElementById('telegramTop10Kicker');
  const heroTitle=document.getElementById('telegramHeroTitle'),heroDescription=document.getElementById('telegramHeroDescription'),categoryLabel=document.getElementById('telegramCategoryLabel'),categoryHint=document.getElementById('telegramCategoryHint'),boxTop10Title=document.getElementById('boxVideyTop10Title'),boxTop10Description=document.getElementElementById?.('boxVideyTop10Description')||document.getElementById('boxVideyTop10Description'),boxTop10Kicker=document.getElementById('boxVideyTop10Kicker');
  const boxTop10Root = document.getElementById('boxVideyTop10');
  if (!grid) return;

  const removeLegacyOverlays = () => document.querySelectorAll([
    '.telegram-warning-float','.telegram-cover-label','.telegram-premium-badge',
    '.telegram-access-badge','.telegram-premium-overlay','.telegram-account-notice'
  ].join(',')).forEach(el => el.remove());
  removeLegacyOverlays();
  new MutationObserver(removeLegacyOverlays).observe(document.documentElement, {childList:true,subtree:true});

  const PAGE_SIZE = 10;
  let allItems = [], visibleItems = [], stats = new Map(), categories = [];
  let currentPage = 1, top10Page = 1, selectedCategory = 'all';
  const lang = () => localStorage.getItem('boxcellink_lang') || 'id';
  const isEN = () => lang() === 'en';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = v => Number(v || 0).toLocaleString(isEN() ? 'en-US' : 'id-ID');
  const money = v => 'Rp ' + Number(v || 0).toLocaleString('id-ID');

  function thumbnailSource(value) {
    if (!value) return '';
    let raw=String(value).trim();
    const img=raw.match(/<(?:img|source)[^>]+src=[\"']([^\"']+)/i); if(img) raw=img[1];
    const frame=raw.match(/<iframe[^>]+src=[\"']([^\"']+)/i); if(frame) raw=frame[1];
    if(raw.startsWith('//'))raw='https:'+raw;
    if(/^data:image\//i.test(raw))return raw;
    try {
      const u=new URL(raw,location.origin); if(!['http:','https:'].includes(u.protocol))return '';
      if(/\.(?:jpe?g|png|gif|webp|avif)(?:$|[?#])/i.test(u.href))return u.href;
      const info=window.ProjectVIDEmbed?.parse(raw);
      if(info?.thumbnail)return info.thumbnail;
      if(info?.type==='image')return info.src;
      if(info?.provider==='YouTube'){const id=info.src.match(/youtube-nocookie\.com\/embed\/([^?]+)/)?.[1];return id?`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`:'';}
      if(info?.provider==='Google Drive')return info.thumbnail||'';
      if(/videy\.co$/i.test(u.hostname)){const id=u.searchParams.get('id')||u.pathname.match(/\/v\/([^/]+)/)?.[1];if(id)return `https://cdn.videy.co/${encodeURIComponent(id)}.jpg`;}
      return '';
    } catch { return ''; }
  }

  function reviewThumbnail(item) {
    const gallery = Array.isArray(item.gallery_urls) ? item.gallery_urls : [];
    for (const candidate of [item.thumbnail_url, item.review_embed_url, ...gallery.map(x => typeof x === 'string' ? x : (x?.url || x?.src || x?.embed_url || x?.thumbnail_url))]) {
      const src = thumbnailSource(candidate); if (src) return src;
    }
    return '';
  }
  function reviewPreviewMarkup(item, className='') {
    const poster=reviewThumbnail(item);
    if(poster)return `<img class="${className}" src="${esc(poster)}" alt="${esc(item.title||'Media preview')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">`;
    const raw=item.thumbnail_url||item.review_embed_url||'';
    const info=window.ProjectVIDEmbed?.parse(raw);
    let frame=info?.type==='iframe'?info.src:'';
    if(!frame&&info?.provider==='MEGA'){try{const u=new URL(info.original);if(u.pathname.startsWith('/file/'))u.pathname=u.pathname.replace('/file/','/embed/');if(u.pathname.startsWith('/embed/'))frame=u.href}catch{}}
    if(frame)return `<iframe class="telegram-provider-poster ${className}" src="${esc(frame)}" title="${esc(item.title||'Media preview')}" loading="lazy" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen tabindex="-1"></iframe>`;
    if(info?.type==='video')return `<video class="telegram-provider-poster ${className}" src="${esc(info.src)}" muted autoplay loop playsinline preload="metadata"></video>`;
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
    if(top10Title)top10Title.textContent=isEN()?'Top 10 Telegram Reviews':'Top 10 Review Telegram';
    if(top10Description)top10Description.textContent=isEN()?'10 reviews per page, ranked by user activity.':'10 review per halaman, diurutkan berdasarkan aktivitas pengguna.';
    if(top10Kicker)top10Kicker.textContent=isEN()?'COMMUNITY PICKS':'PILIHAN KOMUNITAS';
    if(heroTitle)heroTitle.textContent=isEN()?'Telegram Media Reviews':'Review Media Telegram';
    if(heroDescription)heroDescription.textContent=isEN()?'Read reviews and preview media. Original Telegram links are revealed through the verified access flow.':'Baca review dan lihat preview media. Tautan postingan asli Telegram tersedia melalui alur akses yang terverifikasi.';
    if(categoryLabel)categoryLabel.textContent=isEN()?'CATEGORIES':'KATEGORI';
    if(categoryHint)categoryHint.textContent=isEN()?'Select a category to filter reviews':'Pilih kategori untuk menyaring review';
    if(boxTop10Title)boxTop10Title.textContent=isEN()?'Top 10 BoxVidey':'Top 10 BoxVidey';
    if(boxTop10Description)boxTop10Description.textContent=isEN()?'Featured BoxVidey videos to explore.':'Video BoxVidey pilihan yang bisa digeser untuk dijelajahi.';
    if(boxTop10Kicker)boxTop10Kicker.textContent=isEN()?'BOXVIDEY COLLECTION':'KOLEKSI BOXVIDEY';
    const score = item => {
      const s = stats.get(String(item.id)) || {};
      return Number(s.total_sold||0)*1000000 + Number(s.total_likes||0)*1000 + Number(s.total_comments||0)*100 + Number(item.view_count||0);
    };
    const ranked = [...allItems].sort((a,b)=>score(b)-score(a));
    const totalPages=Math.max(1,Math.ceil(ranked.length/PAGE_SIZE));
    top10Page=Math.min(Math.max(1,top10Page),totalPages);
    const pageItems=ranked.slice((top10Page-1)*PAGE_SIZE,top10Page*PAGE_SIZE);
    if (!ranked.length) {
      top10Root.innerHTML='<div class="telegram-top10-empty">'+(isEN()?'No reviews to show yet.':'Belum ada review yang dapat ditampilkan.')+'</div>';
      if(top10Pager)top10Pager.innerHTML='';
      return;
    }
    top10Root.innerHTML=pageItems.map((item,index)=>{
      const globalRank=(top10Page-1)*PAGE_SIZE+index+1;
      const thumb=reviewThumbnail(item), href=`/r/${encodeURIComponent(item.slug)}`;
      const price=item.access==='free'?(isEN()?'Free':'Gratis'):money(item.price);
      return `<a class="telegram-top10-card" href="${href}">
        <span class="telegram-top10-rank">${String(globalRank).padStart(2,'0')}</span>
        <span class="telegram-top10-thumb${thumb?'':' no-image'}">${reviewPreviewMarkup(item)||'<i class="fa-brands fa-telegram"></i>'}</span>
        <span class="telegram-top10-info"><strong>${esc(item.title)}</strong><small><i class="fa-solid fa-eye"></i> ${number(item.view_count)} ${isEN()?'views':'tayangan'}</small><b>${esc(price)}</b></span>
        <i class="fa-solid fa-arrow-up-right-from-square telegram-top10-open"></i>
      </a>`;
    }).join('');
    if(!top10Pager)return;
    if(totalPages<=1){top10Pager.innerHTML='';return;}
    const prev=top10Page-1,next=top10Page+1;
    let buttons=`<button type="button" class="telegram-page-btn" data-top10page="${prev}" aria-label="${isEN()?'Previous page':'Halaman sebelumnya'}" ${top10Page===1?'disabled':''}><i class="fa-solid fa-chevron-left"></i></button>`;
    const from=Math.max(1,Math.min(top10Page-2,totalPages-4)),to=Math.min(totalPages,from+4);
    if(from>1)buttons+=`<button type="button" class="telegram-page-btn" data-top10page="1">1</button><span class="telegram-page-dots">…</span>`;
    for(let n=from;n<=to;n++)buttons+=`<button type="button" class="telegram-page-btn${n===top10Page?' is-active':''}" data-top10page="${n}" ${n===top10Page?'aria-current="page"':''}>${n}</button>`;
    if(to<totalPages)buttons+=`<span class="telegram-page-dots">…</span><button type="button" class="telegram-page-btn" data-top10page="${totalPages}">${totalPages}</button>`;
    buttons+=`<button type="button" class="telegram-page-btn" data-top10page="${next}" aria-label="${isEN()?'Next page':'Halaman berikutnya'}" ${top10Page===totalPages?'disabled':''}><i class="fa-solid fa-chevron-right"></i></button>`;
    top10Pager.innerHTML=`<nav class="telegram-top10-pager-controls"><span>${isEN()?'Page':'Halaman'} <b>${top10Page}</b> ${isEN()?'of':'dari'} <b>${totalPages}</b></span>${buttons}</nav>`;
    top10Pager.querySelectorAll('[data-top10page]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.disabled)return;top10Page=Number(btn.dataset.top10page);renderTop10();top10Root.scrollIntoView({behavior:'smooth',block:'start'});}));
  }

  function renderBoxVideyTop10(items) {
    if(!boxTop10Root)return;
    const ranked=[...(items||[])].sort((a,b)=>Number(b.view_count||0)-Number(a.view_count||0)).slice(0,10);
    if(!ranked.length){boxTop10Root.innerHTML='<div class="telegram-top10-empty">Belum ada video yang dipublikasikan.</div>';return;}
    boxTop10Root.innerHTML=ranked.map((v,i)=>{
      const poster=thumbnailSource(v.thumbnail_url),info=!poster?window.ProjectVIDEmbed?.parse(v.embed_url):null;
      const visual=poster?`<img src="${esc(poster)}" alt="${esc(v.title)}" loading="lazy" onerror="this.hidden=true">`:info?.type==='iframe'?`<iframe src="${esc(info.src)}" title="${esc(v.title)}" loading="lazy" tabindex="-1"></iframe>`:'<span class="boxvidey-top10-fallback"><i class="fa-solid fa-play"></i></span>';
      return `<a class="boxvidey-top10-card" href="/v/${encodeURIComponent(v.slug||v.id)}"><span class="boxvidey-top10-cover">${visual}<span class="boxvidey-top10-rank">${i+1}</span><span class="boxvidey-top10-play"><i class="fa-solid fa-play"></i></span></span><strong>${esc(v.title)}</strong><small><i class="fa-solid fa-eye"></i> ${number(v.view_count)} ${isEN()?'views':'tayangan'}</small></a>`;
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
      const s = stats.get(String(item.id)) || {}, thumb = reviewThumbnail(item);
      const price = item.access === 'free' ? (isEN()?'Free':'Gratis') : money(item.price);
      const href = `/r/${encodeURIComponent(item.slug)}`;
      const categoryName = categories.find(c => c.id === item.category_id)?.name || (isEN() ? 'Telegram media' : 'Media Telegram');
      return `<article class="telegram-review-card">
        <a class="telegram-review-cover${thumb?'':' no-image'}" href="${href}" aria-label="${esc(item.title)}">
          ${reviewPreviewMarkup(item)||`<span class="telegram-cover-placeholder"><i class="fa-brands fa-telegram" aria-hidden="true"></i><strong>BOXCELLINK</strong><small>${isEN()?'Preview unavailable':'Preview belum tersedia'}</small></span>`}
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
      const [reviewsResult,categoriesResult,videosResult] = await Promise.all([
        sb.from('review_items').select('id,slug,title,description,review_embed_url,thumbnail_url,gallery_urls,price,access,category_id,view_count,created_at').eq('status','published').order('created_at',{ascending:false}),
        sb.from('categories').select('id,name,status').eq('status','published').eq('content_type','media_telegram').order('name'),
        sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,created_at').eq('status','published').order('view_count',{ascending:false}).limit(10)
      ]);
      if (reviewsResult.error) throw reviewsResult.error;
      if (categoriesResult.error) console.warn('Category list unavailable:',categoriesResult.error.message);
      allItems = reviewsResult.data || []; categories = categoriesResult.data || [];
      if(videosResult.error)console.warn('BoxVidey Top 10 unavailable:',videosResult.error.message);
      renderBoxVideyTop10(videosResult.data||[]);
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
      top10Page=1;renderTop10();
      applyFilters();
    } catch(error) {
      console.error('Telegram review listing:',error);
      grid.innerHTML=`<div class="telegram-empty"><h3>${isEN()?'Could not load reviews':'Review belum dapat dimuat'}</h3><p>${esc(error.message||'Unknown error')}</p><button class="telegram-review-button" type="button" id="telegramRetry">${isEN()?'Try again':'Coba lagi'}</button></div>`;
      document.getElementById('telegramRetry')?.addEventListener('click',load);
    }
  }
  searchInput?.addEventListener('input',applyFilters);
  searchClear?.addEventListener('click',()=>{searchInput.value='';applyFilters();searchInput.focus();});
  window.addEventListener('storage',e=>{if(e.key==='boxcellink_lang'){renderCategories();renderTop10();applyFilters();}});
  document.addEventListener('boxcellink:language-change',()=>{renderCategories();renderTop10();applyFilters();});
  load();
})();
