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
  // Thumbnail resolver: supports image URLs, Google Drive, YouTube, iframe snippets,
  // gallery objects, and direct video files as a visual preview.
  const thumbnailUrl = value => {
    let raw = '';
    if (typeof value === 'string') raw = value.trim();
    else if (value && typeof value === 'object') raw = String(value.url || value.src || value.thumbnail_url || value.embed_url || '').trim();
    if (!raw) return '';
    const iframe = raw.match(/<iframe[^>]+src=["']([^"']+)/i);
    const image = raw.match(/<img[^>]+src=["']([^"']+)/i);
    if (iframe) raw = iframe[1];
    else if (image) raw = image[1];
    try {
      const u = new URL(raw, location.origin);
      if (!['http:', 'https:'].includes(u.protocol)) return '';
      const driveId = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get('id');
      if (u.hostname.includes('drive.google.com') && driveId)
        return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`;
      if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
        const videoId = u.hostname === 'youtu.be'
          ? u.pathname.split('/').filter(Boolean)[0]
          : (u.searchParams.get('v') || u.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1]);
        if (videoId) return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
      }
      return u.href;
    } catch { return ''; }
  };
  const isDirectVideo = url => /\.(mp4|webm|ogg|m4v)(?:[?#].*)?$/i.test(String(url || ''));
  const thumb = (value, title, iconClass='fa-solid fa-play') => {
    const url = thumbnailUrl(value);
    const fallback = `<div class="media-thumb thumb-fallback" ${url ? 'hidden' : ''}><i class="${esc(iconClass)}"></i></div>`;
    if (!url) return fallback;
    if (isDirectVideo(url))
      return `<video class="media-thumb dashboard-thumb-video" src="${esc(url)}" muted playsinline autoplay loop preload="metadata" aria-label="${esc(title)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"></video>${fallback}`;
    return `<img class="media-thumb" src="${esc(url)}" alt="${esc(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false">${fallback}`;
  };
  const empty = message => `<div class="member-empty"><i class="fa-regular fa-folder-open"></i><b>${esc(message)}</b><span>${esc(t('empty'))}</span></div>`;
  const stat = (icon, value, label, color='') => `<span class="stat-item ${color}"><i class="fa-solid ${icon}"></i><b>${num(value)}</b><small>${esc(label)}</small></span>`;
  const safeVideoUrl = v => v.slug ? `/v/${encodeURIComponent(v.slug)}` : `/watch.html?id=${encodeURIComponent(v.id)}`;
  const safeReviewUrl = r => `/r/${encodeURIComponent(r.slug || '')}`;
  const safeHttp = value => { try { const u=new URL(value,location.origin); return ['http:','https:'].includes(u.protocol)?u.href:null; } catch { return null; } };
  const linkify = value => esc(value).replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, raw => { const href=safeHttp(raw.startsWith('www.')?'https://'+raw:raw); return href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${raw}</a>`:raw; });
  const rupiahText = n => 'Rp '+Number(n||0).toLocaleString('id-ID');
  let dashboardMetrics=null;
  function drawTrend(kind,metric='views'){
    const data=dashboardMetrics?.[kind+'_trend']||[];const chart=$(kind==='auto'?'autoTrendChart':'pasteTrendChart');const labels=$(kind==='auto'?'autoTrendLabels':'pasteTrendLabels');const title=$(kind==='auto'?'autoTrendTitle':'pasteTrendTitle');const change=$(kind==='auto'?'autoTrendChange':'pasteTrendChange');if(!chart)return;
    const series=data.map(x=>Number(metric==='income'?x.earned:metric==='cpm'?x.cpm:x.views||0));const max=Math.max(1,...series);const min=Math.min(0,...series);const h=112,w=620;const pts=series.map((v,i)=>`${series.length<2?0:i*(w/(series.length-1))},${h-10-((v-min)/(max-min||1))*(h-24)}`).join(' ');
    const last=series.at(-1)||0,prev=series.at(-2)||0,diff=last-prev,pct=prev?diff/prev*100:(last?100:0);change.textContent=(diff>=0?'▲ ':'▼ ')+Math.abs(pct).toFixed(1)+'%';change.className='dash-trend-change '+(diff>=0?'up':'down');
    title.textContent=metric==='income'?'Pendapatan AutoLink':metric==='cpm'?'CPM AutoLink':metric==='pasteviews'?'View PasteLink':'View AutoLink';
    chart.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Grafik statistik 14 hari"><defs><linearGradient id="${kind}Area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${kind==='auto'?'#23845b':'#397bc0'}" stop-opacity=".25"/><stop offset="1" stop-color="${kind==='auto'?'#23845b':'#397bc0'}" stop-opacity="0"/></linearGradient></defs><polyline points="${pts}" fill="none" stroke="${kind==='auto'?'#23845b':'#397bc0'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${series.length<2?0:(series.length-1)*(w/(series.length-1))}" cy="${h-10-((last-min)/(max-min||1))*(h-24)}" r="5" fill="${kind==='auto'?'#23845b':'#397bc0'}"/></svg>`;
    labels.innerHTML=data.map(x=>`<span>${new Date(x.date+'T12:00:00').toLocaleDateString(lang()==='id'?'id-ID':'en-US',{day:'numeric',month:'short'})}</span>`).join('');
  }
  async function loadDashboardMetrics(user){
    const {data,error}=await sb.rpc('get_member_dashboard_metrics');if(error){console.warn('Dashboard metrics RPC:',error.message);return;}
    dashboardMetrics=data||{};
    const fmt= n=>Number(n||0).toLocaleString(lang()==='id'?'id-ID':'en-US');
    const auto=$('memberAutoStats');if(auto){const metrics=[['links',fmt(data.total_autolinks),'Total AutoLink'],['views',fmt(data.auto_today_views),'View hari ini'],['income',rupiahText(data.auto_today_earned),'Pendapatan hari ini'],['cpm',Number(data.cpm||50).toFixed(2)+'%','CPM hari ini']];auto.innerHTML=metrics.map(([key,val,label])=>`<button type="button" class="member-auto-stat dash-metric-button" data-auto-metric="${key}"><small>${label}</small><strong>${val}</strong><span>Lihat statistik <i class="fa-solid fa-arrow-right"></i></span></button>`).join('');auto.querySelectorAll('[data-auto-metric]').forEach(b=>b.addEventListener('click',()=>drawTrend('auto',b.dataset.autoMetric==='income'?'income':b.dataset.autoMetric==='cpm'?'cpm':'views')));}
    const ps=$('memberPasteStats');if(ps){ps.innerHTML=`<button type="button" class="member-paste-stat dash-paste-metric" data-paste-metric="total"><span><i class="fa-solid fa-file-lines"></i> Total PasteLink</span><strong>${fmt(data.total_pastelinks)}</strong><small>Lihat daftar link</small></button><button type="button" class="member-paste-stat dash-paste-metric" data-paste-metric="views"><span><i class="fa-solid fa-eye"></i> View hari ini</span><strong>${fmt(data.paste_today_views)}</strong><small>Lihat statistik 14 hari</small></button>`;ps.querySelectorAll('[data-paste-metric]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.pasteMetric==='views')drawTrend('paste','pasteviews');else $('memberPasteList')?.scrollIntoView({behavior:'smooth',block:'start'});}));}
    drawTrend('auto','views');drawTrend('paste','pasteviews');
  }
  async function loadAnnouncementCenter(){
    const {data,error}=await sb.from('announcements').select('id,title,body,created_at').eq('active',true).order('created_at',{ascending:false}).limit(100);
    if(error){console.warn('Announcements:',error.message);return;}const rows=data||[];const first=rows[0];if(first){$('announcement').querySelector('h2').textContent=first.title;$('announcement').querySelector('p').innerHTML=linkify(first.body);}
    const list=$('announcementList');if(list)list.innerHTML=rows.map(a=>`<article class="dash-ann-item"><small><i class="fa-regular fa-calendar"></i> ${new Date(a.created_at).toLocaleString(lang()==='id'?'id-ID':'en-US')}</small><h3>${esc(a.title)}</h3><p>${linkify(a.body)}</p></article>`).join('')||'<div class="dash-ann-empty">Belum ada pengumuman admin.</div>';
    const modal=$('announcementModal');const open=()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('dash-modal-open');};const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('dash-modal-open');};$('showAllAnnouncements')?.addEventListener('click',open);document.querySelectorAll('[data-close-announcements]').forEach(x=>x.addEventListener('click',close));$('announcementRead')?.addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  }
  async function loadMemberAutoLinks(user){
    const host=$('memberAutoList');if(!host)return;try{const {data:rows,error}=await sb.from('autolink_public').select('id,short_code,title,description,status,total_visits,total_wif,created_at').eq('publisher_id',user.id).neq('status','deleted').order('created_at',{ascending:false}).limit(200);if(error)throw error;
      if(!rows?.length){host.innerHTML='<div class="member-paste-state"><i class="fa-solid fa-link"></i><b>Belum ada AutoLink</b><span>Buat AutoLink pertama untuk mulai mendapatkan pendapatan.</span><a href="/autolink-create.html"><i class="fa-solid fa-plus"></i> Buat AutoLink</a></div>';return;}
      host.innerHTML=rows.map(a=>`<article class="member-paste-item dash-autolink-item"><div class="member-paste-item-main"><div class="member-paste-item-icon auto-icon"><i class="fa-solid fa-bolt"></i></div><div class="member-paste-item-info"><div class="member-paste-item-top"><h3>${esc(a.title||'Tanpa judul')}</h3><span class="member-paste-status ${a.status==='published'?'is-active':'is-hidden'}">${esc(a.status)}</span></div><a class="member-paste-url" target="_blank" rel="noopener" href="/z/${encodeURIComponent(a.short_code)}">${esc(location.origin+'/z/'+a.short_code)}</a><small>${fmtDate(a.created_at)} · ${num(a.total_visits)} view · ${num(a.total_wif)} WIF</small></div></div><div class="member-paste-actions"><a class="member-paste-action" href="/z/${encodeURIComponent(a.short_code)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Buka</span></a><button class="member-paste-action" type="button" data-auto-edit="${esc(a.id)}"><i class="fa-solid fa-pen"></i><span>Edit</span></button><button class="member-paste-action is-delete" type="button" data-auto-delete="${esc(a.id)}"><i class="fa-regular fa-trash-can"></i><span>Hapus</span></button></div></article>`).join('');
      host.querySelectorAll('[data-auto-edit]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{const {data:{session}}=await sb.auth.getSession();const auth={authorization:'Bearer '+session.access_token};const d=await fetch('/api/autolink?action=edit-details&id='+encodeURIComponent(btn.dataset.autoEdit),{headers:auth}).then(r=>r.json());if(!d.success)throw new Error(d.error||'Gagal mengambil data AutoLink');const title=prompt('Judul AutoLink',d.autolink.title);if(title===null)return;const description=prompt('Deskripsi',d.autolink.description||'');if(description===null)return;const target_url=prompt('Link tujuan',d.autolink.target_url);if(target_url===null)return;const r=await fetch('/api/autolink?action=update',{method:'POST',headers:{'content-type':'application/json',...auth},body:JSON.stringify({id:btn.dataset.autoEdit,title,description,target_url})});const out=await r.json();if(!r.ok||!out.success)throw new Error(out.error||'Gagal memperbarui AutoLink');await loadMemberAutoLinks(user);}catch(e){alert(e.message);}finally{btn.disabled=false;}}));
      host.querySelectorAll('[data-auto-delete]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Hapus AutoLink ini? Link tidak akan dapat digunakan lagi.'))return;btn.disabled=true;try{const {data:{session}}=await sb.auth.getSession();const r=await fetch('/api/autolink?action=delete',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({id:btn.dataset.autoDelete})});const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||'Gagal menghapus AutoLink');await loadMemberAutoLinks(user);await loadDashboardMetrics(user);}catch(e){alert(e.message);btn.disabled=false;}}));
    }catch(e){console.warn('AutoLink list:',e);host.innerHTML=`<div class="member-paste-state is-error">${esc(e.message||'Gagal memuat AutoLink')}</div>`;}
  }
  const fmtDate=value=>value?new Date(value).toLocaleString(lang()==='id'?'id-ID':'en-US',{dateStyle:'medium'}):'—';

  function videoCard(v, stats={}) {
    const href = safeVideoUrl(v);
    const isVip = String(v.access || '').toLowerCase() === 'vip';
    return `<article class="member-media-card dashboard-video-card">
      <a class="member-media-cover" href="${href}" aria-label="${esc(v.title || t('noTitle'))}">${thumb(v.thumbnail_url || v.embed_url,v.title)}<span class="media-kind video-kind">BOXVIDEY</span><span class="access-chip ${isVip?'vip-chip':'basic-chip'}"><i class="fa-solid ${isVip?'fa-crown':'fa-circle-check'}"></i> ${isVip?t('vip'):t('basic')}</span></a>
      <div class="member-media-body"><div class="published-label"><i class="fa-solid fa-circle-check"></i> ${t('published')}</div>
        <h3><a href="${href}">${esc(v.title || t('noTitle'))}</a></h3>
        <div class="member-media-stats video-stats">${stat('fa-eye',v.view_count,t('views'),'stat-views')}${stat('fa-heart',stats.total_likes,t('likes'),'stat-likes')}${stat('fa-comment',stats.total_comments,t('comments'),'stat-comments')}</div>
        <a class="member-card-link" href="${href}">${t('viewVideo')} <i class="fa-solid fa-arrow-right"></i></a>
      </div></article>`;
  }

  function reviewCard(r, stats={}) {
    const gallery = Array.isArray(r.gallery_urls) ? r.gallery_urls : [];
    const galleryThumb = gallery.map(item => typeof item === 'string' ? item : (item?.url || item?.src || item?.thumbnail_url || item?.embed_url || '')).find(Boolean);
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
    const cover = isTelegram ? (item.thumbnail_url || gallery.map(x => typeof x === 'string' ? x : (x?.url || x?.src || x?.thumbnail_url || x?.embed_url || '')).find(Boolean)) : (item.thumbnail_url || item.embed_url);
    const metric = `${num(item.view_count)} ${t('views').toLowerCase()}`;
    const medal = index === 0 ? 'fa-trophy' : index === 1 ? 'fa-medal' : index === 2 ? 'fa-award' : 'fa-hashtag';
    return `<a class="mini-card rank-card rank-${index+1}" href="${href}">
      <span class="rank-badge"><i class="fa-solid ${medal}"></i><b>#${index+1}</b></span>
      ${thumb(cover,title,isTelegram?'fa-brands fa-telegram':'fa-play')}
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

  async function loadMemberPasteLinks(user) {
    const statsHost=$('memberPasteStats'),listHost=$('memberPasteList');
    if(!statsHost||!listHost)return;
    const showError=message=>{listHost.innerHTML=`<div class="member-paste-state is-error"><i class="fa-solid fa-triangle-exclamation"></i><span>${esc(message)}</span></div>`;};
    try {
      const {data:{session}}=await sb.auth.getSession();
      if(!session?.access_token)throw new Error('Sesi login tidak ditemukan. Silakan login kembali.');
      const response=await fetch('/api/pastelink?action=list',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({})});
      const payload=await response.json();
      if(!response.ok||!payload.success)throw new Error(payload.error||'Gagal memuat daftar PasteLink.');
      const rows=Array.isArray(payload.items)?payload.items:[];
      const fmt=n=>Number(n||0).toLocaleString(lang()==='id'?'id-ID':'en-US');
      if(!dashboardMetrics) statsHost.innerHTML=`<article class="member-paste-stat"><span><i class="fa-solid fa-file-lines"></i> Total PasteLink</span><strong>${fmt(payload.total)}</strong></article><article class="member-paste-stat"><span><i class="fa-solid fa-eye"></i> View hari ini</span><strong>—</strong></article>`;
      if(!rows.length){listHost.innerHTML=`<div class="member-paste-state"><i class="fa-regular fa-folder-open"></i><b>Belum ada PasteLink</b><span>Buat PasteLink pertama kamu untuk mulai membagikan konten.</span><a href="/pastelink-create.html"><i class="fa-solid fa-plus"></i> Buat PasteLink</a></div>`;return;}
      listHost.innerHTML=rows.map(item=>{
        const url=new URL('/pas/'+encodeURIComponent(item.slug),location.origin).href;
        const isExpired=!!item.expires_at&&Date.parse(item.expires_at)<=Date.now();
        const isActive=item.status==='published'&&!isExpired;
        const status=isExpired?'Kedaluwarsa':(item.status==='published'?'Aktif':'Disembunyikan');
        const date=item.created_at?new Date(item.created_at).toLocaleDateString(lang()==='id'?'id-ID':'en-US',{day:'numeric',month:'short',year:'numeric'}):'—';
        return `<article class="member-paste-item" data-paste-id="${esc(item.id)}">
          <div class="member-paste-item-main"><div class="member-paste-item-icon"><i class="fa-solid fa-file-lines"></i></div><div class="member-paste-item-info"><div class="member-paste-item-top"><h3>${esc(item.title||'Tanpa judul')}</h3><span class="member-paste-status ${isActive?'is-active':(isExpired?'is-expired':'is-hidden')}">${status}</span></div><a class="member-paste-url" href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a><small><i class="fa-regular fa-calendar"></i> Dibuat ${esc(date)}</small></div></div>
          <div class="member-paste-actions"><a href="${esc(url)}" target="_blank" rel="noopener" class="member-paste-action"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Buka</span></a><button type="button" class="member-paste-action" data-paste-copy="${esc(url)}"><i class="fa-regular fa-copy"></i><span>Salin</span></button><a href="/pastelink-create.html?edit=${encodeURIComponent(item.id)}" class="member-paste-action"><i class="fa-solid fa-pen"></i><span>Edit</span></a><button type="button" class="member-paste-action is-delete" data-paste-delete="${esc(item.id)}"><i class="fa-regular fa-trash-can"></i><span>Hapus</span></button></div>
        </article>`;
      }).join('');
      listHost.querySelectorAll('[data-paste-copy]').forEach(button=>button.addEventListener('click',async()=>{
        const value=button.dataset.pasteCopy;
        try{await navigator.clipboard.writeText(value);button.classList.add('is-copied');button.querySelector('span').textContent='Tersalin';setTimeout(()=>{button.classList.remove('is-copied');button.querySelector('span').textContent='Salin';},1800);}
        catch{window.prompt('Salin link PasteLink:',value);}
      }));
      listHost.querySelectorAll('[data-paste-delete]').forEach(button=>button.addEventListener('click',async()=>{
        const id=button.dataset.pasteDelete;
        if(!window.confirm('Hapus PasteLink ini? Link yang dihapus tidak lagi dapat dibuka.'))return;
        button.disabled=true;
        try{
          const {data:{session:current}}=await sb.auth.getSession();
          const response=await fetch('/api/pastelink?action=delete',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+current.access_token},body:JSON.stringify({id})});
          const result=await response.json();
          if(!response.ok||!result.success)throw new Error(result.error||'Gagal menghapus PasteLink.');
          await loadMemberPasteLinks(user);
        }catch(error){window.alert(error.message||'Gagal menghapus PasteLink.');button.disabled=false;}
      }));
    } catch(error) {console.warn('Member PasteLink:',error);showError(error.message||'PasteLink belum dapat dimuat.');}
  }

  async function init() {
    if (!window.sb) { $('latestVideos').innerHTML = empty(t('serviceError')); return; }
    const {data:{user}} = await sb.auth.getUser();
    if (!user) { location.replace('/login.html?next='+encodeURIComponent('/dashboard.html')); return; }
    const {data:profile} = await sb.from('profiles').select('full_name,role,is_banned').eq('id',user.id).maybeSingle();
    if (profile?.is_banned) { await sb.auth.signOut(); location.replace('/login.html'); return; }
    await sb.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',user.id);
    await loadMemberPasteLinks(user);
    await Promise.all([loadDashboardMetrics(user),loadMemberAutoLinks(user),loadAnnouncementCenter()]);
    const autoNote=$('memberAutoNote');if(autoNote)autoNote.textContent='Penghasilan dihitung dari Redirect valid dan akses langsung yang berhasil diselesaikan. View biasa tidak otomatis menjadi pendapatan.';

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
    // Extra continuously swipeable lanes: latest and oldest Telegram media and BoxVideo.
    const [latestT,oldestT,latestB,oldestB]=await Promise.all([
      sb.from('review_items').select('id,slug,title,thumbnail_url,gallery_urls,view_count,price,access').eq('status','published').order('created_at',{ascending:false}).limit(1000),
      sb.from('review_items').select('id,slug,title,thumbnail_url,gallery_urls,view_count,price,access').eq('status','published').order('created_at',{ascending:true}).limit(1000),
      sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access').eq('status','published').order('created_at',{ascending:false}).limit(1000),
      sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access').eq('status','published').order('created_at',{ascending:true}).limit(1000)
    ]);
    const renderReviewLane=(rows)=> (rows||[]).map(r=>`<a class="mini-card" href="${safeReviewUrl(r)}">${thumb(r.thumbnail_url||(Array.isArray(r.gallery_urls)?r.gallery_urls[0]:''),r.title,'fa-telegram')}<b>${esc(r.title||t('noTitle'))}</b><span><i class="fa-brands fa-telegram"></i> ${num(r.view_count)} ${t('views').toLowerCase()}</span></a>`).join('')||empty(t('noReviews'));
    const renderVideoLane=(rows)=> (rows||[]).map(v=>`<a class="mini-card" href="${safeVideoUrl(v)}">${thumb(v.thumbnail_url||v.embed_url,v.title,'fa-play')}<b>${esc(v.title||t('noTitle'))}</b><span><i class="fa-solid fa-eye"></i> ${num(v.view_count)} ${t('views').toLowerCase()}</span></a>`).join('')||empty(t('noVideos'));
    if($('latestTelegramAll'))$('latestTelegramAll').innerHTML=renderReviewLane(latestT.data);
    if($('oldestTelegramAll'))$('oldestTelegramAll').innerHTML=renderReviewLane(oldestT.data);
    if($('latestBoxAll'))$('latestBoxAll').innerHTML=renderVideoLane(latestB.data);
    if($('oldestBoxAll'))$('oldestBoxAll').innerHTML=renderVideoLane(oldestB.data);


    // VIP strip only contains published VIP videos.
    const {data:vipVideos,error:vipError}=await sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access').eq('status','published').eq('access','vip').order('created_at',{ascending:false}).limit(8);
    if(vipError) console.warn('VIP videos:',vipError.message);
    $('vipVideos').innerHTML=(vipVideos||[]).map(v=>`<a class="mini-card" href="${safeVideoUrl(v)}">${thumb(v.thumbnail_url || v.embed_url,v.title,'fa-crown')}<b>${esc(v.title||t('noTitle'))}</b><span><i class="fa-solid fa-crown"></i> VIP · ${num(v.view_count)} ${t('views').toLowerCase()}</span></a>`).join('') || `<a class="mini-card" href="/vip.html"><i class="fa-solid fa-crown"></i><b>${t('exploreVip')}</b><span>${t('vipDesc')}</span></a>`;

    // Ranking uses only published rows; top ten is calculated independently from the paginated lists.
    const [{data:topVideos,error:topVideoError},{data:topReviews,error:topReviewError}] = await Promise.all([
      sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access').eq('status','published').order('view_count',{ascending:false}).limit(10),
      sb.from('review_items').select('id,slug,title,thumbnail_url,gallery_urls,view_count,price,access').eq('status','published').order('view_count',{ascending:false}).limit(10)
    ]);
    if(topVideoError) console.warn('Top BoxVidey:',topVideoError.message);
    if(topReviewError) console.warn('Top Telegram:',topReviewError.message);
    const topVideoStats=await fetchVideoStats((topVideos||[]).map(v=>v.id));
    const reviewStats=await fetchReviewStats();
    const rankedReviews=topReviews||[];
    $('topTelegram').innerHTML=rankedReviews.map((r,i)=>rankCard(r,i,'telegram',reviewStats.get(r.id)||{})).join('') || empty(t('noReviews'));
    $('topBox').innerHTML=(topVideos||[]).map((v,i)=>rankCard(v,i,'video',topVideoStats.get(v.id)||{})).join('') || empty(t('noVideos'));
  }
  init().catch(error=>{console.error(error);document.querySelectorAll('#latestVideos,#reviews,#topTelegram,#topBox').forEach(el=>el.innerHTML=empty(t('loadError')));});
})();
