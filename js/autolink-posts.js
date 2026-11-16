(()=>{'use strict';
const feed=document.getElementById('bcPostFeed');if(!feed||!window.sb)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>{try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch{return '';}};
const urlFor=a=>new URL('/z/'+encodeURIComponent(a.short_code),location.origin).href;
const section=document.createElement('section');section.className='al-card bc-autolink-feed';section.style.margin='0 0 18px';
section.innerHTML='<div class="al-head"><div><span class="al-kicker">Publikasi komunitas</span><h2>AutoLink terbaru</h2><p>AutoLink yang sudah dipublikasikan oleh member BoxCellink.</p></div><a class="al-btn" href="/autolink.html"><i class="fa-solid fa-plus"></i> Buat AutoLink</a></div><div id="alNewNotice" class="bc-new-publications" hidden><button type="button" id="alShowNew">1 publikasi terbaru · Tampilkan</button></div><div id="alPostList" aria-live="polite"><span class="al-loading">Memuat publikasi...</span></div>';
feed.parentElement.insertBefore(section,feed);
const list=section.querySelector('#alPostList'),notice=section.querySelector('#alNewNotice');
let newest=null,seen=new Set(),first=true,rowsCache=[];
function card(a){const link=urlFor(a);return `<article class="bc-post-card bc-autolink-card" data-auto-id="${esc(a.id)}"><header class="bc-post-author"><div><strong><i class="fa-solid fa-bolt"></i> AutoLink</strong><time class="bc-post-date">${esc(fmt(a.created_at))}</time></div></header><h3>${esc(a.title||'AutoLink')}</h3>${a.description?`<div class="bc-post-detail">${esc(a.description)}</div>`:''}<a class="bc-post-link" href="${esc(link)}"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>${esc(link)}</span></a><div class="bc-post-actions"><button type="button" class="bc-post-action" data-copy="${esc(link)}"><i class="fa-regular fa-copy"></i> Salin link</button><a class="bc-post-action" href="${esc(link)}"><i class="fa-solid fa-arrow-right"></i> Buka AutoLink</a></div></article>`;}
function promo(){return `<aside class="bc-feed-promo"><a href="/telegram.html"><i class="fa-brands fa-telegram"></i><span><b>Media Telegram</b><small>Jelajahi koleksi review media</small></span><i class="fa-solid fa-chevron-right"></i></a><a href="/book-video.html"><i class="fa-solid fa-clapperboard"></i><span><b>BoxVidey</b><small>Temukan video pilihan komunitas</small></span><i class="fa-solid fa-chevron-right"></i></a></aside>`;}
async function load(silent=false){
 try{
  const {data,error}=await sb.from('autolink_public').select('id,publisher_id,short_code,title,description,status,total_wif,created_at').eq('status','published').order('created_at',{ascending:false}).limit(60);
  if(error)throw error;
  const rows=data||[];
  if(first){rowsCache=rows;newest=rows[0]?.created_at||null;rows.forEach(x=>seen.add(x.id));first=false;render();return;}
  const fresh=rows.filter(x=>!seen.has(x.id));
  if(fresh.length){fresh.forEach(x=>seen.add(x.id));rowsCache=[...fresh,...rowsCache].slice(0,60);notice.hidden=false;section.querySelector('#alShowNew').textContent=`${fresh.length} publikasi terbaru · Tampilkan`;notice.dataset.pending='1';}
  if(!silent)render();
 }catch(e){console.error('AutoLink feed:',e);if(first)list.innerHTML=`<p class="al-alert error">Publikasi AutoLink belum dapat dimuat: ${esc(e.message||'Periksa migrasi AutoLink dan akses view autolink_public.')}</p>`;}
}
function render(){if(!rowsCache.length){list.innerHTML='<p class="bc-post-empty">Belum ada AutoLink yang dipublikasikan. Buat AutoLink pertama kamu!</p>';return;}
 list.innerHTML=rowsCache.map((a,i)=>card(a)+(i===4||i===7?promo():'')).join('');
 list.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.innerHTML='<i class="fa-solid fa-check"></i> Tersalin';}catch{prompt('Salin tautan:',b.dataset.copy);}}));
}
section.querySelector('#alShowNew').addEventListener('click',()=>{notice.hidden=true;notice.dataset.pending='';render();section.scrollIntoView({behavior:'smooth',block:'start'});});
load();setInterval(()=>load(true),30000);
})();