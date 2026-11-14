(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const lang = () => localStorage.getItem('boxcellink_lang') === 'en' ? 'en' : 'id';
  const words = {
    id: {loading:'Memuat video...', empty:'Belum ada konten yang dipublikasikan.', noVideos:'Belum ada BoxVidey', noReviews:'Belum ada media Telegram', noTitle:'Tanpa judul', published:'Dipublikasikan', basic:'BASIC', vip:'VIP', views:'View', sold:'Terjual', likes:'Like', comments:'Komentar', viewVideo:'Lihat Video', previous:'Sebelumnya', next:'Berikutnya', page:'Halaman', free:'Gratis', price:'Harga akses', loadError:'Gagal memuat konten'},
    en: {loading:'Loading videos...', empty:'No published content yet.', noVideos:'No BoxVidey published yet', noReviews:'No Telegram media published yet', noTitle:'Untitled', published:'Published', basic:'BASIC', vip:'VIP', views:'Views', sold:'Sold', likes:'Likes', comments:'Comments', viewVideo:'View Video', previous:'Previous', next:'Next', page:'Page', free:'Free', price:'Access price', loadError:'Unable to load content'}
  };
  const t = key => words[lang()][key] || key;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => Number(value || 0).toLocaleString(lang() === 'id' ? 'id-ID' : 'en-US');
  const rupiah = value => lang() === 'id' ? 'Rp ' + num(value) : 'IDR ' + num(value);
  // Keep the same thumbnail resolver and fallback behavior as the member dashboard.
  const thumbnailUrl = value => {
    let raw = '';
    if (typeof value === 'string') raw = value.trim();
    else if (value && typeof value === 'object') raw = String(value.url || value.src || value.thumbnail_url || value.embed_url || '').trim();
    if (!raw) return '';
    const iframe = raw.match(/<iframe[^>]+src=["']([^"']+)/i);
    const image = raw.match(/<img[^>]+src=["']([^"']+)/i);
    if (iframe) raw = iframe[1]; else if (image) raw = image[1];
    try {
      const u = new URL(raw, location.origin);
      if (!['http:', 'https:'].includes(u.protocol)) return '';
      const driveId = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get('id');
      if (u.hostname.includes('drive.google.com') && driveId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`;
      if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
        const id = u.hostname === 'youtu.be' ? u.pathname.split('/').filter(Boolean)[0] : (u.searchParams.get('v') || u.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1]);
        if (id) return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
      }
      return u.href;
    } catch { return ''; }
  };
  const isDirectVideo = url => /\.(mp4|webm|ogg|m4v)(?:[?#].*)?$/i.test(String(url || ''));
  const thumb = (value, title, iconClass='fa-solid fa-play') => {
    const url = thumbnailUrl(value);
    const fallback = `<div class="media-thumb thumb-fallback" ${url ? 'hidden' : ''}><i class="${esc(iconClass)}"></i></div>`;
    if (!url) return fallback;
    if (isDirectVideo(url)) return `<video class="media-thumb dashboard-thumb-video" src="${esc(url)}" muted playsinline autoplay loop preload="metadata" aria-label="${esc(title)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"></video>${fallback}`;
    return `<img class="media-thumb" src="${esc(url)}" alt="${esc(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false">${fallback}`;
  };
  const empty = message => `<div class="member-empty"><i class="fa-regular fa-folder-open"></i><b>${esc(message)}</b><span>${esc(t('empty'))}</span></div>`;
  const stat = (icon, value, label, color='') => `<span class="stat-item ${color}"><i class="fa-solid ${icon}"></i><b>${num(value)}</b><small>${esc(label)}</small></span>`;
  const safeVideoUrl = v => v.slug ? `/v/${encodeURIComponent(v.slug)}` : `/watch.html?id=${encodeURIComponent(v.id)}`;
  const safeReviewUrl = r => `/r/${encodeURIComponent(r.slug || '')}`;
  function videoCard(v, stats={}) {
    const href = safeVideoUrl(v), vip = String(v.access || '').toLowerCase() === 'vip';
    return `<article class="member-media-card dashboard-video-card"><a class="member-media-cover" href="${href}" aria-label="${esc(v.title || t('noTitle'))}">${thumb(v.thumbnail_url || v.embed_url,v.title)}<span class="media-kind video-kind">BOXVIDEY</span><span class="access-chip ${vip?'vip-chip':'basic-chip'}"><i class="fa-solid ${vip?'fa-crown':'fa-circle-check'}"></i> ${vip?t('vip'):t('basic')}</span></a><div class="member-media-body"><div class="published-label"><i class="fa-solid fa-circle-check"></i> ${t('published')}</div><h3><a href="${href}">${esc(v.title || t('noTitle'))}</a></h3><div class="member-media-stats video-stats">${stat('fa-eye',v.view_count,t('views'),'stat-views')}${stat('fa-heart',stats.total_likes,t('likes'),'stat-likes')}${stat('fa-comment',stats.total_comments,t('comments'),'stat-comments')}</div><a class="member-card-link" href="${href}">${t('viewVideo')} <i class="fa-solid fa-arrow-right"></i></a></div></article>`;
  }
  function rankVideo(v,index) {
    const medal = index===0?'fa-trophy':index===1?'fa-medal':index===2?'fa-award':'fa-hashtag';
    return `<a class="mini-card rank-card rank-${index+1}" href="${safeVideoUrl(v)}"><span class="rank-badge"><i class="fa-solid ${medal}"></i><b>#${index+1}</b></span>${thumb(v.thumbnail_url || v.embed_url,v.title)}<b class="rank-title">${esc(v.title || t('noTitle'))}</b><span class="rank-metric">${num(v.view_count)} ${t('views').toLowerCase()}</span></a>`;
  }
  function rankReview(r,index,stats={}) {
    const gallery=Array.isArray(r.gallery_urls)?r.gallery_urls:[];
    const cover=r.thumbnail_url || gallery.map(x=>typeof x==='string'?x:(x?.url||x?.src||x?.thumbnail_url||x?.embed_url||'')).find(Boolean);
    const medal=index===0?'fa-trophy':index===1?'fa-medal':index===2?'fa-award':'fa-hashtag';
    return `<a class="mini-card rank-card rank-${index+1}" href="${safeReviewUrl(r)}"><span class="rank-badge"><i class="fa-solid ${medal}"></i><b>#${index+1}</b></span>${thumb(cover,r.title,'fa-brands fa-telegram')}<b class="rank-title">${esc(r.title || t('noTitle'))}</b><span class="rank-metric">${num(stats.total_sold)} ${t('sold').toLowerCase()}</span></a>`;
  }
  async function fetchVideoStats(ids) {
    const map=new Map(); if(!ids.length)return map;
    const {data,error}=await sb.rpc('get_public_video_stats',{p_video_ids:ids});
    if(error)console.warn('Video stats RPC:',error.message);
    (data||[]).forEach(row=>map.set(row.video_id,row)); return map;
  }
  async function fetchReviewStats() {
    const map=new Map(); const {data,error}=await sb.rpc('get_public_review_stats');
    if(error)console.warn('Review stats RPC:',error.message);
    (data||[]).forEach(row=>map.set(row.review_id,row)); return map;
  }
  let videos=[],categories=[],selected=new URLSearchParams(location.search).get('category')||'all',page=1;
  const pageSize=16;
  function renderCategories() {
    const box=$('bookCategories');
    box.innerHTML=`<button class="${selected==='all'?'active':''}" data-category="all">${lang()==='en'?'All':'Semua'}</button>`+categories.map(c=>`<button class="${selected===c.id?'active':''}" data-category="${esc(c.id)}">${esc(c.name)}</button>`).join('');
    box.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.category;page=1;renderCategories();renderVideos();}));
  }
  function filteredVideos() {
    const query=($('bookSearch')?.value||'').trim().toLowerCase();
    return videos.filter(v=>(selected==='all'||v.category_id===selected)&&(!query||String(v.title||'').toLowerCase().includes(query)));
  }
  function renderVideos() {
    const rows=filteredVideos(),pages=Math.ceil(rows.length/pageSize),start=(page-1)*pageSize,slice=rows.slice(start,start+pageSize);
    $('bookGrid').innerHTML=slice.map(v=>videoCard(v)).join('')||empty(t('noVideos'));
    const pager=$('bookPagination');
    if(pages<=1){pager.innerHTML='';return;}
    pager.innerHTML=`<button type="button" data-page="${page-1}" ${page===1?'disabled':''}>‹ ${t('previous')}</button><span>${t('page')} ${page}/${pages}</span><button type="button" data-page="${page+1}" ${page===pages?'disabled':''}>${t('next')} ›</button>`;
    pager.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{page=Number(b.dataset.page);renderVideos();$('bookGrid').scrollIntoView({behavior:'smooth',block:'start'});}));
  }
  async function init() {
    if(!window.sb){$('bookGrid').innerHTML=empty(t('loadError'));return;}
    // Same published-video fields, filters, thumbnail source, and stats RPC as Dashboard.
    const [{data:videoRows,error:videoError},{data:catRows,error:catError}] = await Promise.all([
      sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access,created_at,category_id').eq('status','published').order('created_at',{ascending:false}).limit(1000),
      sb.from('categories').select('id,name').eq('status','published').eq('content_type','box_video').order('name')
    ]);
    if(videoError){console.error('Box Video query:',videoError);$('bookGrid').innerHTML=empty(t('loadError'));return;}
    videos=videoRows||[];categories=catError?[]:(catRows||[]);
    if(selected!=='all'&&!categories.some(c=>c.id===selected))selected='all';
    const topVideos=[...videos].sort((a,b)=>Number(b.view_count||0)-Number(a.view_count||0)).slice(0,10);
    $('bookTop10').innerHTML=topVideos.map(rankVideo).join('')||empty(t('noVideos'));
    renderCategories();renderVideos();
    $('bookSearch').addEventListener('input',()=>{page=1;renderVideos();});
    // Telegram area intentionally remains Telegram review content, ranked by sold count like Dashboard.
    const {data:reviewRows,error:reviewError}=await sb.from('review_items').select('id,slug,title,thumbnail_url,gallery_urls,view_count,price,access').eq('status','published').order('created_at',{ascending:false}).limit(1000);
    if(reviewError){console.warn('Top Telegram:',reviewError.message);$('bookTelegramTop10').innerHTML=empty(t('noReviews'));return;}
    const reviewStats=await fetchReviewStats();
    const ranked=[...(reviewRows||[])].sort((a,b)=>Number(reviewStats.get(b.id)?.total_sold||0)-Number(reviewStats.get(a.id)?.total_sold||0)).slice(0,10);
    $('bookTelegramTop10').innerHTML=ranked.map((r,i)=>rankReview(r,i,reviewStats.get(r.id)||{})).join('')||empty(t('noReviews'));
  }
  document.addEventListener('DOMContentLoaded',()=>init().catch(error=>{console.error('Box Video initialization:',error);$('bookGrid').innerHTML=empty(t('loadError'));}));
})();
