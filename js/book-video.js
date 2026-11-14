(() => {
'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let videos=[],categories=[],selected=new URLSearchParams(location.search).get('category')||'all',page=1;const pageSize=10;
function thumbInfo(value){
 if(!value)return {src:'',frame:''};let raw=String(value).trim();
 const img=raw.match(/<(?:img|source)[^>]+src=["']([^"']+)/i);if(img)raw=img[1];
 const frame=raw.match(/<iframe[^>]+src=["']([^"']+)/i);if(frame)return {src:'',frame:frame[1]};
 if(raw.startsWith('//'))raw='https:'+raw;
 if(/\.(jpe?g|png|gif|webp|avif)(?:[?#]|$)/i.test(raw)||raw.startsWith('data:image/'))return {src:raw,frame:''};
 const info=window.ProjectVIDEmbed?.parse(raw);
 if(info?.thumbnail)return {src:info.thumbnail,frame:''};
 if(info?.type==='image')return {src:info.src,frame:''};
 if(info?.provider==='YouTube'){const id=info.src.match(/youtube-nocookie\.com\/embed\/([^?]+)/)?.[1];if(id)return {src:`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`,frame:''};}
 if(info?.provider==='MEGA'){
   let u;try{u=new URL(raw)}catch{return {src:'',frame:''}}
   if(u.pathname.startsWith('/file/'))u.pathname=u.pathname.replace('/file/','/embed/');
   if(u.pathname.startsWith('/embed/'))return {src:'',frame:u.href};
 }
 if(info?.type==='iframe')return {src:'',frame:info.src};
 return {src:'',frame:''};
}
function poster(v){
 const t=thumbInfo(v.thumbnail_url||v.poster_url||'');
 if(t.src)return `<img src="${esc(t.src)}" alt="${esc(v.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.book-thumb').classList.add('failed');this.remove()">`;
 if(t.frame)return `<iframe src="${esc(t.frame)}" title="${esc(v.title)} preview" loading="lazy" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen tabindex="-1"></iframe>`;
 const e=thumbInfo(v.embed_url||v.video_url||'');
 if(e.src)return `<img src="${esc(e.src)}" alt="${esc(v.title)}" loading="lazy" referrerpolicy="no-referrer">`;
 if(e.frame)return `<iframe src="${esc(e.frame)}" title="${esc(v.title)} preview" loading="lazy" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen tabindex="-1"></iframe>`;
 return '<span class="book-thumb-fallback"><i class="fa-solid fa-circle-play"></i></span>';
}
function card(v,rank){return `<article class="book-card"><a class="book-thumb" href="/v/${encodeURIComponent(v.slug||v.id)}">${poster(v)}${rank?`<b class="book-rank">${rank}</b>`:''}<span class="book-play"><i class="fa-solid fa-play"></i></span></a><div class="book-card-body"><h3>${esc(v.title)}</h3><p>${esc(v.categories?.name||'BoxVidey')} · ${new Date(v.created_at).toLocaleDateString('id-ID')}</p><a href="/v/${encodeURIComponent(v.slug||v.id)}" class="book-watch-btn"><i class="fa-solid fa-play"></i> Tonton video</a></div></article>`}
function visible(){const q=($('#bookSearch')?.value||'').trim().toLowerCase();return videos.filter(v=>(selected==='all'||v.category_id===selected)&&(!q||String(v.title||'').toLowerCase().includes(q)));}
function render(){const rows=visible(),total=Math.ceil(rows.length/pageSize),slice=rows.slice((page-1)*pageSize,page*pageSize);$('#bookGrid').innerHTML=slice.length?slice.map(v=>card(v)).join(''):'<div class="book-empty">Video tidak ditemukan.</div>';$('#bookPagination').innerHTML=total>1?`<button ${page===1?'disabled':''} data-page="${page-1}">‹ Sebelumnya</button><span>${page} / ${total}</span><button ${page===total?'disabled':''} data-page="${page+1}">Berikutnya ›</button>`:'';$('#bookPagination').querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=+b.dataset.page;render();$('#bookGrid').scrollIntoView({behavior:'smooth',block:'start'});});}
function renderCategories(){const box=$('#bookCategories');box.innerHTML=`<button class="${selected==='all'?'active':''}" data-category="all">Semua</button>`+categories.map(c=>`<button class="${selected===c.id?'active':''}" data-category="${esc(c.id)}">${esc(c.name)}</button>`).join('');box.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{selected=b.dataset.category;page=1;renderCategories();render()})}
async function loadTelegram(){const box=$('#bookTelegramTop10');const {data,error}=await sb.from('review_items').select('id,title,slug,thumbnail_url,review_embed_url,access,price,view_count,created_at').eq('status','published').order('view_count',{ascending:false}).limit(10);if(error||!data?.length){box.innerHTML='<div class="book-empty">Media Telegram belum tersedia.</div>';return;}box.innerHTML=data.map((v,i)=>{const t=thumbInfo(v.thumbnail_url||v.review_embed_url);const media=t.src?`<img src="${esc(t.src)}" alt="${esc(v.title)}" loading="lazy" referrerpolicy="no-referrer">`:t.frame?`<iframe src="${esc(t.frame)}" title="Preview" loading="lazy" tabindex="-1"></iframe>`:'<i class="fa-brands fa-telegram"></i>';return `<a class="book-telegram-card" href="/r/${encodeURIComponent(v.slug)}"><span class="book-telegram-thumb">${media}<b>${i+1}</b></span><strong>${esc(v.title)}</strong></a>`}).join('')}
async function init(){if(!window.sb){$('#bookGrid').innerHTML='<div class="book-empty">Konfigurasi database belum tersedia.</div>';return;}const [v,c]=await Promise.all([sb.from('videos').select('id,title,slug,thumbnail_url,poster_url,embed_url,video_url,orientation,access,access_scope,created_at,category_id,categories(name),view_count').eq('status','published').order('created_at',{ascending:false}).limit(300),sb.from('categories').select('id,name').eq('status','published').eq('content_type','box_video').order('name')]);if(v.error){$('#bookGrid').innerHTML=`<div class="book-empty">Gagal memuat video: ${esc(v.error.message)}</div>`;return;}videos=v.data||[];categories=c.data||[];const top=[...videos].sort((a,b)=>Number(b.view_count||0)-Number(a.view_count||0)).slice(0,10);$('#bookTop10').innerHTML=top.length?top.map((x,i)=>card(x,i+1)).join(''):'<div class="book-empty">Belum ada video.</div>';renderCategories();render();$('#bookSearch').addEventListener('input',()=>{page=1;render()});await loadTelegram();}
document.addEventListener('DOMContentLoaded',init);
})();