(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const lang = () => localStorage.getItem('boxcellink_lang') === 'en' ? 'en' : 'id';
  const words = {
    id: {empty:'Belum ada konten yang dipublikasikan.',noVideos:'Belum ada BoxVidey',noReviews:'Belum ada media Telegram',noTitle:'Tanpa judul',published:'Dipublikasikan',basic:'BASIC',vip:'VIP',views:'View',sold:'Terjual',likes:'Like',comments:'Komentar',viewVideo:'Lihat Video',previous:'Sebelumnya',next:'Berikutnya',page:'Halaman',loadError:'Gagal memuat konten',noCategories:'Belum ada kategori'},
    en: {empty:'No published content yet.',noVideos:'No BoxVidey published yet',noReviews:'No Telegram media published yet',noTitle:'Untitled',published:'Published',basic:'BASIC',vip:'VIP',views:'Views',sold:'Sold',likes:'Likes',comments:'Comments',viewVideo:'View Video',previous:'Previous',next:'Next',page:'Page',loadError:'Unable to load content',noCategories:'No categories yet'}
  };
  const t = key => words[lang()][key] || key;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => Number(value || 0).toLocaleString(lang()==='id'?'id-ID':'en-US');

  // This is intentionally the same thumbnail resolver and card renderer used by Dashboard.
  const thumbnailUrl = value => {
    let raw='';
    if(typeof value==='string') raw=value.trim();
    else if(value&&typeof value==='object') raw=String(value.url||value.src||value.thumbnail_url||value.embed_url||'').trim();
    if(!raw)return '';
    const iframe=raw.match(/<iframe[^>]+src=["']([^"']+)/i);
    const image=raw.match(/<img[^>]+src=["']([^"']+)/i);
    if(iframe)raw=iframe[1];else if(image)raw=image[1];
    try{
      const u=new URL(raw,location.origin);
      if(!['http:','https:'].includes(u.protocol))return '';
      const driveId=u.pathname.match(/\/file\/d\/([^/]+)/)?.[1]||u.searchParams.get('id');
      if(u.hostname.includes('drive.google.com')&&driveId)return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`;
      if(u.hostname.includes('youtube.com')||u.hostname==='youtu.be'){
        const videoId=u.hostname==='youtu.be'?u.pathname.split('/').filter(Boolean)[0]:(u.searchParams.get('v')||u.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1]);
        if(videoId)return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
      }
      return u.href;
    }catch{return '';}
  };
  const isDirectVideo = url => /\.(mp4|webm|ogg|m4v)(?:[?#].*)?$/i.test(String(url||''));
  const thumb = (value,title,iconClass='fa-solid fa-play') => {
    const url=thumbnailUrl(value);
    const fallback=`<div class="media-thumb thumb-fallback" ${url?'hidden':''}><i class="${esc(iconClass)}"></i></div>`;
    if(!url)return fallback;
    if(isDirectVideo(url))return `<video class="media-thumb dashboard-thumb-video" src="${esc(url)}" muted playsinline autoplay loop preload="metadata" aria-label="${esc(title)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"></video>${fallback}`;
    return `<img class="media-thumb" src="${esc(url)}" alt="${esc(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false">${fallback}`;
  };
  const empty = message => `<div class="member-empty"><i class="fa-regular fa-folder-open"></i><b>${esc(message)}</b><span>${esc(t('empty'))}</span></div>`;
  const stat = (icon,value,label,color='') => `<span class="stat-item ${color}"><i class="fa-solid ${icon}"></i><b>${num(value)}</b><small>${esc(label)}</small></span>`;
  const safeVideoUrl = v => v.slug?`/v/${encodeURIComponent(v.slug)}`:`/watch.html?id=${encodeURIComponent(v.id)}`;
  const safeReviewUrl = r => `/r/${encodeURIComponent(r.slug||'')}`;
  function videoCard(v,stats={}){
    const href=safeVideoUrl(v),vip=String(v.access||'').toLowerCase()==='vip';
    return `<article class="member-media-card dashboard-video-card"><a class="member-media-cover" href="${href}" aria-label="${esc(v.title||t('noTitle'))}">${thumb(v.thumbnail_url||v.embed_url,v.title)}<span class="media-kind video-kind">BOXVIDEY</span><span class="access-chip ${vip?'vip-chip':'basic-chip'}"><i class="fa-solid ${vip?'fa-crown':'fa-circle-check'}"></i> ${vip?t('vip'):t('basic')}</span></a><div class="member-media-body"><div class="published-label"><i class="fa-solid fa-circle-check"></i> ${t('published')}</div><h3><a href="${href}">${esc(v.title||t('noTitle'))}</a></h3><div class="member-media-stats video-stats">${stat('fa-eye',v.view_count,t('views'),'stat-views')}${stat('fa-heart',stats.total_likes,t('likes'),'stat-likes')}${stat('fa-comment',stats.total_comments,t('comments'),'stat-comments')}</div><a class="member-card-link" href="${href}">${t('viewVideo')} <i class="fa-solid fa-arrow-right"></i></a></div></article>`;
  }
  function rankCard(item,index,kind,stats={}){
    const telegram=kind==='telegram',href=telegram?safeReviewUrl(item):safeVideoUrl(item);
    const gallery=Array.isArray(item.gallery_urls)?item.gallery_urls:[];
    const cover=telegram?(item.thumbnail_url||gallery.map(x=>typeof x==='string'?x:(x?.url||x?.src||x?.thumbnail_url||x?.embed_url||'')).find(Boolean)): (item.thumbnail_url||item.embed_url);
    const medal=index===0?'fa-trophy':index===1?'fa-medal':index===2?'fa-award':'fa-hashtag';
    const metric=telegram?`${num(stats.total_sold)} ${t('sold').toLowerCase()}`:`${num(item.view_count)} ${t('views').toLowerCase()}`;
    return `<a class="mini-card rank-card rank-${index+1}" href="${href}"><span class="rank-badge"><i class="fa-solid ${medal}"></i><b>#${index+1}</b></span>${thumb(cover,item.title,telegram?'fa-brands fa-telegram':'fa-solid fa-play')}<b class="rank-title">${esc(item.title||t('noTitle'))}</b><span class="rank-metric">${esc(metric)}</span></a>`;
  }
  async function fetchVideoStats(ids){
    const map=new Map();if(!ids.length)return map;
    const {data,error}=await sb.rpc('get_public_video_stats',{p_video_ids:ids});
    if(error)console.warn('Box Video stats RPC:',error.message);
    (data||[]).forEach(row=>map.set(row.video_id,row));return map;
  }
  async function fetchReviewStats(){
    const map=new Map();const {data,error}=await sb.rpc('get_public_review_stats');
    if(error)console.warn('Telegram review stats RPC:',error.message);
    (data||[]).forEach(row=>map.set(row.review_id,row));return map;
  }

  let categories=[],selected=new URLSearchParams(location.search).get('category')||'all',page=1,search='';
  const pageSize=16;
  function renderCategories(){
    const box=$('bookCategories');
    box.innerHTML=`<button type="button" class="${selected==='all'?'active':''}" data-category="all">${lang()==='en'?'All':'Semua'}</button>`+categories.map(c=>`<button type="button" class="${selected===c.id?'active':''}" data-category="${esc(c.id)}">${esc(c.name)}</button>`).join('');
    box.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.category;page=1;renderCategories();loadVideos(1);}));
  }
  async function loadVideos(nextPage=1){
    page=nextPage;
    const from=(page-1)*pageSize,to=from+pageSize-1;
    let query=sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access,created_at,category_id',{count:'exact'}).eq('status','published').order('created_at',{ascending:false});
    if(selected!=='all')query=query.eq('category_id',selected);
    if(search)query=query.ilike('title',`%${search.replace(/[%,()]/g,' ').trim()}%`);
    const {data,error,count}=await query.range(from,to);
    if(error){console.error('Book Video list query:',error);$('bookGrid').innerHTML=empty(t('loadError'));$('bookPagination').innerHTML='';return;}
    const rows=data||[],stats=await fetchVideoStats(rows.map(v=>v.id));
    $('bookGrid').innerHTML=rows.map(v=>videoCard(v,stats.get(v.id)||{})).join('')||empty(t('noVideos'));
    const pages=Math.ceil((count||0)/pageSize),pager=$('bookPagination');
    if(pages<=1){pager.innerHTML='';return;}
    pager.innerHTML=`<button type="button" data-page="${page-1}" ${page===1?'disabled':''}>‹ ${t('previous')}</button><span>${t('page')} ${page}/${pages}</span><button type="button" data-page="${page+1}" ${page===pages?'disabled':''}>${t('next')} ›</button>`;
    pager.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{const p=Number(button.dataset.page);if(p>=1&&p<=pages)loadVideos(p);}));
  }
  async function loadTopVideos(){
    const {data,error}=await sb.from('videos').select('id,slug,title,thumbnail_url,embed_url,view_count,access').eq('status','published').order('view_count',{ascending:false}).limit(10);
    if(error){console.error('Top BoxVidey query:',error);$('bookTop10').innerHTML=empty(t('loadError'));return;}
    $('bookTop10').innerHTML=(data||[]).map((v,i)=>rankCard(v,i,'video')).join('')||empty(t('noVideos'));
  }
  async function loadTelegramTop10(){
    const {data,error}=await sb.from('review_items').select('id,slug,title,thumbnail_url,gallery_urls,view_count,price,access').eq('status','published').order('created_at',{ascending:false}).limit(1000);
    if(error){console.error('Top Telegram query:',error);$('bookTelegramTop10').innerHTML=empty(t('noReviews'));return;}
    const stats=await fetchReviewStats();
    const ranked=[...(data||[])].sort((a,b)=>Number(stats.get(b.id)?.total_sold||0)-Number(stats.get(a.id)?.total_sold||0)).slice(0,10);
    $('bookTelegramTop10').innerHTML=ranked.map((r,i)=>rankCard(r,i,'telegram',stats.get(r.id)||{})).join('')||empty(t('noReviews'));
  }
  async function init(){
    if(!window.sb){console.error('Supabase client belum tersedia pada Book Video.');$('bookGrid').innerHTML=empty(t('loadError'));return;}
    const {data:catRows,error:catError}=await sb.from('categories').select('id,name').eq('status','published').eq('content_type','box_video').order('name');
    if(catError)console.warn('Book Video categories:',catError.message);
    categories=catError?[]:(catRows||[]);
    if(selected!=='all'&&!categories.some(c=>c.id===selected))selected='all';
    renderCategories();
    const searchBox=$('bookSearch');
    if(searchBox)searchBox.addEventListener('input',()=>{search=searchBox.value.trim();page=1;loadVideos(1);});
    await Promise.all([loadVideos(1),loadTopVideos(),loadTelegramTop10()]);
  }
  document.addEventListener('DOMContentLoaded',()=>init().catch(error=>{console.error('Book Video initialization:',error);$('bookGrid').innerHTML=empty(t('loadError'));}));
})();
