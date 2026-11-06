(() => {
  const $ = id => document.getElementById(id);
  const lang = () => localStorage.getItem('boxcellink_lang') === 'en' ? 'en' : 'id';
  const words = {
    id: {
      loading:'Memuat konten...', empty:'Belum ada konten yang dipublikasikan.', published:'Dipublikasikan', basic:'BASIC', vip:'VIP',
      views:'View', likes:'Like', comments:'Komentar', sold:'Terjual', price:'Harga akses', free:'Gratis',
      review:'Lihat Review', viewVideo:'Lihat Video', page:'Halaman', previous:'Sebelumnya', next:'Berikutnya',
      noTitle:'Tanpa judul', noDescription:'Informasi dan detail konten akan ditampilkan pada halaman ini.',
      admin:'PENGUMUMAN ADMIN', welcome:'Selamat datang di BoxCellink', announcement:'Informasi terbaru dari admin akan tampil di panel ini.',
      noCategories:'Belum ada kategori', boxCategories:'Jelajahi BoxVidey', telegramCategories:'Jelajahi media Telegram',
      allTelegram:'Semua Media Telegram', latest:'Video Terbaru', reviews:'Watch Review', topTelegram:'Media Telegram Terpopuler', topBox:'Media BoxVidey Terpopuler',
      vipTitle:'BoxVidey VIP', exploreVip:'Jelajahi VIP', vipDesc:'Akses konten khusus member', noVideos:'Belum ada BoxVidey', noReviews:'Belum ada media Telegram',
      serviceError:'Layanan belum tersedia', loadError:'Gagal memuat konten', rank:'PERINGKAT',
    },
    en: {
      loading:'Loading content...', empty:'No published content yet.', published:'Published', basic:'BASIC', vip:'VIP',
      views:'Views', likes:'Likes', comments:'Comments', sold:'Sold', price:'Access price', free:'Free',
      review:'View Review', viewVideo:'View Video', page:'Page', previous:'Previous', next:'Next',
      noTitle:'Untitled', noDescription:'Content information and details are available on this page.',
      admin:'ADMIN ANNOUNCEMENT', welcome:'Welcome to BoxCellink', announcement:'The latest updates from the admin will appear here.',
      noCategories:'No categories yet', boxCategories:'Explore BoxVidey', telegramCategories:'Explore Telegram media',
      allTelegram:'All Telegram Media', latest:'Latest Videos', reviews:'Watch Review', topTelegram:'Popular Telegram Media', topBox:'Popular BoxVidey Media',
      vipTitle:'BoxVidey VIP', exploreVip:'Explore VIP', vipDesc:'Exclusive member content', noVideos:'No BoxVidey published yet', noReviews:'No Telegram media published yet',
      serviceError:'Service is unavailable', loadError:'Unable to load content', rank:'RANK',
    }
  };
  const t = key => words[lang()][key] || key;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => Number(value || 0).toLocaleString(lang() === 'id' ? 'id-ID' : 'en-US');
  const rupiah = value => lang() === 'id' ? 'Rp ' + num(value) : 'IDR ' + num(value);
  function thumbnailCandidates(url, embedUrl='') {
    const raw = String(url || '').trim();
    const source = String(embedUrl || '').trim();
    const candidates = [];
    const add = value => { if (value && /^https?:\/\//i.test(value) && !candidates.includes(value)) candidates.push(value); };
    const normalize = value => {
      if (!value) return '';
      const iframe = value.match(/<iframe[^>]+src=[\"']([^\"']+)/i);
      let clean = iframe ? iframe[1] : value;
      try {
        const u = new URL(clean, location.origin);
        if (!['http:', 'https:'].includes(u.protocol)) return '';
        if (/drive\.google\.com$/i.test(u.hostname)) {
          const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get('id');
          if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000`;
        }
        if (/youtu\.be|youtube\.com/i.test(u.hostname)) {
          const id = u.hostname === 'youtu.be' ? u.pathname.split('/').filter(Boolean)[0] : (u.searchParams.get('v') || u.pathname.match(/\/embed\/([^/]+)/)?.[1]);
          if (id) return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
        }
        const videy = u.searchParams.get('id') || u.pathname.match(/(?:videy\.co\/v\/|cdn\.videy\.co\/)([a-zA-Z0-9_-]+)/i)?.[1];
        if (/videy\.co$/i.test(u.hostname) && videy) return `https://cdn.videy.co/${encodeURIComponent(videy)}.jpg`;
        if (/\.(mp4|webm|m3u8)(?:$|\?)/i.test(clean)) {
          const id = u.pathname.split('/').filter(Boolean).pop()?.replace(/\.(mp4|webm|m3u8)$/i,'');
          if (/cdn\.videy\.co$/i.test(u.hostname) && id) return `https://cdn.videy.co/${encodeURIComponent(id)}.jpg`;
          return '';
        }
        return clean;
      } catch { return ''; }
    };
    add(normalize(raw)); add(normalize(source));
    return candidates;
  }
  window.boxThumbError = img => {
    const list = JSON.parse(img.dataset.candidates || '[]');
    const next = Number(img.dataset.candidateIndex || 0) + 1;
    if (next < list.length) {
      img.dataset.candidateIndex = String(next);
      img.src = list[next];
    } else {
      img.onerror = null;
      img.remove();
      img.parentElement?.classList.add('thumb-fallback');
    }
  };
  const thumb = (url, title, icon='fa-play', embedUrl='') => {
    const candidates = thumbnailCandidates(url, embedUrl);
    return candidates.length
      ? `<img class="media-thumb" src="${esc(candidates[0])}" data-candidates="${esc(JSON.stringify(candidates))}" data-candidate-index="0" alt="${esc(title)}" loading="lazy" onerror="window.boxThumbError(this)">`
      : `<div class="media-thumb thumb-fallback"><i class="${icon.startsWith('fa-brands') ? 'fa-brands' : 'fa-solid'} ${icon.replace('fa-brands ', '')}"></i></div>`;
  };
  const empty = message => `<div class="member-empty"><i class="fa-regular fa-folder-open"></i><b>${esc(message)}</b><span>${esc(t('empty'))}</span></div>`;
  const stat = (icon, value, label, color='') => `<span class="stat-item ${color}"><i class="${icon.startsWith('fa-brands') ? 'fa-brands' : 'fa-solid'} ${icon.replace('fa-brands ', '')}"></i><b>${num(value)}</b><small>${esc(label)}</small></span>`;
  const safeVideoUrl = v => v.slug ? `/v/${encodeURIComponent(v.slug)}` : `/watch.html?id=${encodeURIComponent(v.id)}`;
  const safeReviewUrl = r => `/r/${encodeURIComponent(r.slug || '')}`;

  function videoCard(v, stats={}) {
    const href = safeVideoUrl(v);
    const isVip = String(v.access || '').toLowerCase() === 'vip';
    return `<article class="member-media-card dashboard-video-card">
      <a class="member-media-cover" href="${href}" aria-label="${esc(v.title || t('noTitle'))}">${thumb(v.thumbnail_url,v.title,'fa-play',v.embed_url)}<span class="media-kind video-kind">BOXVIDEY</span><span class="access-chip ${isVip?'vip-chip':'basic-chip'}"><i class="fa-solid ${isVip?'fa-crown':'fa-circle-check'}"></i> ${isVip?t('vip'):t('basic')}</span></a>
      <div class="member-media-body"><div class="published-label"><i class="fa-solid fa-circle-check"></i> ${t('published')}</div>
        <h3><a href="${href}">${esc(v.title || t('noTitle'))}</a></h3>
        <div class="member-media-stats video-stats">${stat('fa-eye',v.view_count,t('views'),'stat-views')}${stat('fa-heart',stats.total_likes,t('likes'),'stat-likes')}${stat('fa-comment',stats.total_comments,t('comments'),'stat-comments')}</div>
        <a class="member-card-link" href="${href}">${t('viewVideo')} <i class="fa-solid fa-arrow-right"></i></a>
      </div></article>`;
  }

  function reviewCard(r, stats={}) {
    const gallery = Array.isArray(r.gallery_urls) ? r.gallery_urls : [];
    const galleryThumb = gallery.map(item => typeof item === 'string' ? item : (item?.thumbnail_url || item?.url || item?.src || '')).find(Boolean);
    const href = safeReviewUrl(r);
    const price = String(r.access || '').toLowerCase() === 'free' || Number(r.price || 0) <= 0 ? t('free') : rupiah(r.price);
    return `<article class="member-media-card dashboard-review-card">
      <a class="member-media-cover" href="${href}" aria-label="${esc(r.title || t('noTitle'))}">${thumb(r.thumbnail_url || galleryThumb,r.title,'fa-brands fa-telegram')}<span class="media-kind telegram-kind">TELEGRAM MEDIA</span></a>
      <div class="member-media-body"><div class="published-label"><i class="fa-solid fa-circle-check"></i> ${t('published')}</div>
        <div class="media-price-row"><span><i class="fa-solid fa-wallet"></i> ${t('price')}</span><b>${esc(price)}</b></div>
        <h3><a href="${href}">${esc(r.title || t('noTitle'))}</a></h3>
        <p class="media-description">${esc(r.description || t('noDescription'))}</p>
        <div class="member-media-stats review-stats">${stat('fa-fire',stats.total_sold,t('sold'),'stat-sold')}${stat('fa-heart',stats.total_likes,t('likes'),'stat-likes')}${stat('fa-comment',stats.total_comments,t('comments'),'stat-comments')}</div>
        <a class="member-card-link review-link-motion" href="${href}">${t('review')} <i class="fa-solid fa-arrow-right"></i></a>
      </div></article>`;
  }

  function rankCard(item, index, kind, stats={}) {
    const isTelegram = kind === 'telegram';
    const href = isTelegram ? safeReviewUrl(item) : safeVideoUrl(item);
    const title = item.title || t('noTitle');
    const gallery = Array.isArray(item.gallery_urls) ? item.gallery_urls : [];
    const cover = isTelegram ? (item.thumbnail_url || gallery.map(x => typeof x === 'string' ? x : (x?.thumbnail_url || x?.url || x?.src || '')).find(Boolean)) : item.thumbnail_url;
    const metric = isTelegram ? `${num(stats.total_sold)} ${t('sold').toLowerCase()}` : `${num(item.view_count)} ${t('views').toLowerCase()}`;
    const medal = index === 0 ? 'fa-trophy' : index === 1 ? 'fa-medal' : index === 2 ? 'fa-award' : 'fa-hashtag';
    return `<a class="mini-card rank-card rank-${index+1}" href="${href}">
      <span class="rank-badge"><i class="fa-solid ${medal}"></i><b>#${index+1}</b></span>
      ${thumb(cover,title,isTelegram?'fa-brands fa-telegram':'fa-play',item.embed_url)}
      <b class="rank-title">${esc(title)}</b><span class="rank-metric">${esc(metric)}</span>
    </a>`;
  }

  function renderPager(id, page, total, onPage) {
    const pages = Math.ceil(total / 16);
    const el = $(id);
    if (!el) return;
    if (pages <= 1) { el.innerHTML = ''; return; }
    const start = Math.max(1, page - 2), end = Math.min(pages, page + 2);
    let html = `<button type="button" data-page="${page-1}" ${page===1?'disabled':''} aria-label="${t('previous')}"><i class="fa-solid fa-chevron-left"></i></button>`;
    if (start > 1) html += `<button type="button" data-page="1">1</button>${start>2?'<span class="pager-dots">…</span>':''}`;
    for (let p=start;p<=end;p++) html += `<button type="button" data-page="${p}" class="${p===page?'active':''}" aria-current="${p===page?'page':'false'}">${p}</button>`;
    if (end < pages) html += `${end<pages-1?'<span class="pager-dots">…</span>':''}<button type="button" data-page="${pages}">${pages}</button>`;
    html += `<button type="button" data-page="${page+1}" ${page===pages?'disabled':''} aria-label="${t('next')}"><i class="fa-solid fa-chevron-right"></i></button><span class="pager-label">${t('page')} ${page}/${pages}</span>`;
    el.innerHTML = html;
    el.querySelectorAll('button[data-page]').forEach(button => button.addEventListener('click', () => {
      const next = Number(button.dataset.page);
      if (next >= 1 && next <= pages) onPage(next);
    }));
  }

  async function fetchVideoStats(ids) {
    const map = new Map();
    if (!ids.length) return map;
    const {data,error} = await sb.rpc('get_public_video_stats',{p_video_ids:ids});
    if (error) console.warn('Video stats RPC:', error.message);
    (data || []).forEach(row => map.set(row.video_id,row));
    return map;
  }
  async function fetchReviewStats() {
    const map = new Map();
    const {data,error} = await sb.rpc('get_public_review_stats');
    if (error) console.warn('Review stats RPC:',error.message);
    (data || []).forEach(row => map.set(row.review_id,row));
    return map;
  }

  async function init() {
    if (!window.sb) { $('latestVideos').innerHTML = empty(t('serviceError')); return; }
    const {data:{user}} = await sb.auth.getUser();
    if (!user) { location.replace('/login.html?next='+encodeURIComponent('/dashboard.html')); return; }
    const {data:profile} = await sb.from('profiles').select('full_name,role,is_banned').eq('id',user.id).maybeSingle();
    if (profile?.is_banned) { await sb.auth.signOut(); location.replace('/login.html'); return; }
    await sb.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',user.id);

    const {data:ann} = await sb.from('announcements').select('title,body').eq('active',true).order('created_at',{ascending:false}).limit(1);
    if (ann?.[0]) { $('announcement').querySelector('h2').textContent=ann[0].title; $('announcement').querySelector('p').textContent=ann[0].body; }

    const {data:cats,error:catError} = await sb.from('categories').select('id,name').eq('status','published').order('name');
    if (catError) console.warn('Dashboard categories:',catError.message);
    $('boxCategories').innerHTML=(cats||[]).map(c=>`<a class="cat-card" href="/index.html?category=${encodeURIComponent(c.id)}"><i class="fa-solid fa-layer-group"></i><b>${esc(c.name)}</b><span>${t('boxCategories')}</span></a>`).join('') || empty(t('noCategories'));
    $('telegramCategories').innerHTML=`<a class="cat-card" href="/telegram.html"><i class="fa-brands fa-telegram"></i><b>${t('allTelegram')}</b><span>${t('telegramCategories')}</span></a>` + (cats||[]).map(c=>`<a class="cat-card" href="/telegram.html?category=${encodeURIComponent(c.id)}"><i class="fa-solid fa-folder-open"></i><b>${esc(c.name)}</b><span>${t('telegramCategories')}</span></a>`).join('');

    let videoPage = 1, reviewPage = 1;
    async function loadVideos(page) {
      videoPage = page;
      const from=(page-1)*16, to=from+15;
      const {data:videos,error,count} = await sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access,created_at',{count:'exact'}).eq('status','published').order('created_at',{ascending:false}).range(from,to);
      if (error) { console.warn('Dashboard videos:',error.message); $('latestVideos').innerHTML=empty(t('loadError')); return; }
      const stats=await fetchVideoStats((videos||[]).map(v=>v.id));
      $('latestVideos').innerHTML=(videos||[]).map(v=>videoCard(v,stats.get(v.id)||{})).join('') || empty(t('noVideos'));
      renderPager('videoPager',page,count||0,loadVideos);
    }
    async function loadReviews(page) {
      reviewPage = page;
      const from=(page-1)*16, to=from+15;
      const {data:reviews,error,count} = await sb.from('review_items').select('id,slug,title,description,thumbnail_url,gallery_urls,price,access,view_count,created_at',{count:'exact'}).eq('status','published').order('created_at',{ascending:false}).range(from,to);
      if (error) { console.warn('Dashboard reviews:',error.message); $('reviews').innerHTML=empty(t('loadError')); return; }
      const stats=await fetchReviewStats();
      $('reviews').innerHTML=(reviews||[]).map(r=>reviewCard(r,stats.get(r.id)||{})).join('') || empty(t('noReviews'));
      renderPager('reviewPager',page,count||0,loadReviews);
    }
    await Promise.all([loadVideos(1),loadReviews(1)]);

    // VIP strip only contains published VIP videos.
    const {data:vipVideos,error:vipError}=await sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access').eq('status','published').eq('access','vip').order('created_at',{ascending:false}).limit(8);
    if(vipError) console.warn('VIP videos:',vipError.message);
    $('vipVideos').innerHTML=(vipVideos||[]).map(v=>`<a class="mini-card" href="${safeVideoUrl(v)}">${thumb(v.thumbnail_url,v.title,'fa-crown',v.embed_url)}<b>${esc(v.title||t('noTitle'))}</b><span><i class="fa-solid fa-crown"></i> VIP · ${num(v.view_count)} ${t('views').toLowerCase()}</span></a>`).join('') || `<a class="mini-card" href="/vip.html"><i class="fa-solid fa-crown"></i><b>${t('exploreVip')}</b><span>${t('vipDesc')}</span></a>`;

    // Ranking uses only published rows; top ten is calculated independently from the paginated lists.
    const [{data:topVideos,error:topVideoError},{data:topReviews,error:topReviewError}] = await Promise.all([
      sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access').eq('status','published').order('view_count',{ascending:false}).limit(10),
      sb.from('review_items').select('id,slug,title,thumbnail_url,gallery_urls,view_count,price,access').eq('status','published').order('created_at',{ascending:false}).limit(1000)
    ]);
    if(topVideoError) console.warn('Top BoxVidey:',topVideoError.message);
    if(topReviewError) console.warn('Top Telegram:',topReviewError.message);
    const topVideoStats=await fetchVideoStats((topVideos||[]).map(v=>v.id));
    const reviewStats=await fetchReviewStats();
    const rankedReviews=[...(topReviews||[])].sort((a,b)=>Number(reviewStats.get(b.id)?.total_sold||0)-Number(reviewStats.get(a.id)?.total_sold||0)).slice(0,10);
    $('topTelegram').innerHTML=rankedReviews.map((r,i)=>rankCard(r,i,'telegram',reviewStats.get(r.id)||{})).join('') || empty(t('noReviews'));
    $('topBox').innerHTML=(topVideos||[]).map((v,i)=>rankCard(v,i,'video',topVideoStats.get(v.id)||{})).join('') || empty(t('noVideos'));
  }
  init().catch(error=>{console.error(error);document.querySelectorAll('#latestVideos,#reviews,#topTelegram,#topBox').forEach(el=>el.innerHTML=empty(t('loadError')));});
})();
