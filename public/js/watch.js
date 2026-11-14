(()=>{
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>localStorage.getItem('boxcellink_lang')||'id';
const TELEGRAM_GROUP='https://t.me/+03WCfVAwaWUzZTkx';
const T={
id:{watchHub:'Watch & Discover',watchIntro:'Temukan video Basic dan konten eksklusif VIP dalam satu tempat.',upgradeVip:'Upgrade VIP',loading:'Memuat video...',notFound:'Video tidak ditemukan.',watchError:'Tidak dapat memuat video. Coba muat ulang halaman.',views:'tayangan',published:'Dipublikasikan',like:'Like',comment:'Komentar',share:'Share',community:'Community',download:'Download',commentsTitle:'Komentar & Diskusi',commentsLoading:'Memuat komentar...',noComments:'Belum ada komentar. Jadilah yang pertama berdiskusi.',writeComment:'Tulis komentar',commentPlaceholder:'Bagikan pendapat kamu...',sendComment:'Kirim komentar',loginComment:'Nama wajib diisi untuk komentar pengunjung.',commentFailed:'Komentar gagal dikirim: ',yourActivity:'YOUR ACTIVITY',historyTitle:'Riwayat tontonan',historySub:'Video yang terakhir kamu tonton.',historyEmpty:'Belum ada riwayat tontonan.',telegramCollection:'TELEGRAM COLLECTION',telegramTitle:'Review Media Telegram',telegramSub:'Temukan media terbaru dari koleksi Telegram.',seeAll:'Lihat semua',telegramLoading:'Memuat media...',telegramEmpty:'Belum ada media yang dipublikasikan.',vipMembership:'VIP MEMBERSHIP',vipSideTitle:'Buka pengalaman tanpa batas',vipSideDesc:'Tonton semua video VIP dan nikmati diskon 20% untuk pembelian media Telegram.',upgradeNow:'Upgrade Now',categoriesTitle:'Kategori video',categoriesLoading:'Memuat kategori...',categoriesEmpty:'Belum ada kategori aktif.',discover:'DISCOVER',moreVideos:'Jelajahi video lainnya',moreVideosSub:'Pilih video Basic atau lihat cuplikan konten VIP.',filterAll:'Semua',filterBasic:'Basic',filterVip:'VIP',basic:'BASIC',vip:'VIP',vipOnly:'VIP EXCLUSIVE',loginOnly:'LOGIN REQUIRED',loginRequiredTitle:'Konten khusus member',loginRequiredText:'Silakan masuk ke akun BoxCellink untuk menonton video ini.',loginButton:'Masuk sekarang',vipModalTitle:'Video khusus member VIP',vipModalText:'Upgrade akun sekarang untuk menonton semua fitur VIP dan mendapatkan potongan 20% untuk pembelian media Telegram.',cancel:'Batal',emptyVideos:'Belum ada video lain.',pagePrev:'Sebelumnya',pageNext:'Berikutnya',teaser:'Cuplikan VIP',teaserNote:'Upgrade VIP untuk menonton video lengkap.',shareCopied:'Link video disalin.',shareError:'Tidak dapat membagikan link.',adLabel:'ADVERTISEMENT',historyLogin:'Riwayat tontonan tersimpan di perangkat ini.',allCategoriesEyebrow:'CATEGORIES',allCategoriesTitle:'Kategori dan video',allCategoriesSub:'Jelajahi video berdasarkan kategori.',guestName:'Nama kamu',reply:'Balas',sendReply:'Kirim balasan',commentLike:'Suka',replyPlaceholder:'Tulis balasan...',commentNameRequired:'Masukkan nama untuk berkomentar.',guestLinkDenied:'Pengunjung belum login tidak boleh memasukkan tautan.',commentAction:'Bergabung ke komunitas Telegram untuk Like, Comment, Share, dan Community.'},
en:{watchHub:'Watch & Discover',watchIntro:'Explore Basic videos and exclusive VIP content in one place.',upgradeVip:'Upgrade VIP',loading:'Loading video...',notFound:'Video not found.',watchError:'Unable to load this video. Please refresh.',views:'views',published:'Published',like:'Like',comment:'Comment',share:'Share',community:'Community',download:'Download',commentsTitle:'Comments & Discussion',commentsLoading:'Loading comments...',noComments:'No comments yet. Start the conversation.',writeComment:'Write a comment',commentPlaceholder:'Share your thoughts...',sendComment:'Post comment',loginComment:'Enter a name to post as a guest.',commentFailed:'Could not post comment: ',yourActivity:'YOUR ACTIVITY',historyTitle:'Watch history',historySub:'Videos you watched recently.',historyEmpty:'No watch history yet.',telegramCollection:'TELEGRAM COLLECTION',telegramTitle:'Telegram Media Reviews',telegramSub:'Discover the latest items from the Telegram collection.',seeAll:'View all',telegramLoading:'Loading media...',telegramEmpty:'No media published yet.',vipMembership:'VIP MEMBERSHIP',vipSideTitle:'Unlock the full experience',vipSideDesc:'Watch all VIP videos and get 20% off Telegram media purchases.',upgradeNow:'Upgrade Now',categoriesTitle:'Video categories',categoriesLoading:'Loading categories...',categoriesEmpty:'No active categories yet.',discover:'DISCOVER',moreVideos:'Explore more videos',moreVideosSub:'Choose a Basic video or preview VIP content.',filterAll:'All',filterBasic:'Basic',filterVip:'VIP',basic:'BASIC',vip:'VIP',vipOnly:'VIP EXCLUSIVE',loginOnly:'LOGIN REQUIRED',loginRequiredTitle:'Members-only content',loginRequiredText:'Please sign in to your BoxCellink account to watch this video.',loginButton:'Sign in now',vipModalTitle:'Exclusive VIP video',vipModalText:'Upgrade now to unlock all VIP features and get 20% off Telegram media purchases.',cancel:'Cancel',emptyVideos:'No more videos available.',pagePrev:'Previous',pageNext:'Next',teaser:'VIP preview',teaserNote:'Upgrade to VIP to watch the full video.',shareCopied:'Video link copied.',shareError:'Unable to share this link.',adLabel:'ADVERTISEMENT',historyLogin:'Watch history is saved on this device.',allCategoriesEyebrow:'CATEGORIES',allCategoriesTitle:'Categories and videos',allCategoriesSub:'Explore videos by category.',guestName:'Your name',reply:'Reply',sendReply:'Send reply',commentLike:'Like',replyPlaceholder:'Write a reply...',commentNameRequired:'Enter your name to comment.',guestLinkDenied:'Guests cannot include links in comments.',commentAction:'Join the Telegram community for Like, Comment, Share, and Community.'}
};
const tr=k=>(T[lang()]||T.id)[k]||k;
function applyLang(){document.querySelectorAll('[data-wt]').forEach(el=>{const k=el.dataset.wt;if(T[lang()]?.[k])el.textContent=tr(k)});const ta=$('#commentText');if(ta)ta.placeholder=tr('commentPlaceholder');const guestName=$('#guestCommentName');if(guestName){guestName.placeholder=tr('guestName');guestName.setAttribute('aria-label',tr('guestName'));guestName.hidden=!!currentUser;}document.documentElement.lang=lang();}
let currentUser=null,isVip=false,currentVideo=null,allVideos=[],activeFilter='all',page=1,categories=[],categoryCounts={};
const perPage=20;
const guestToken=(()=>{let t=localStorage.getItem('boxcellink_guest_comment_token');if(!t){t=(crypto.randomUUID?crypto.randomUUID():`g-${Date.now()}-${Math.random().toString(36).slice(2)}`);localStorage.setItem('boxcellink_guest_comment_token',t)}return t})();
function showVipModal(mode='vip'){const m=$('#vipModal');if(!m)return;const guest=!currentUser,isVipMode=mode==='vip';const title=$('#vipModalTitle'),copy=$('#vipModalText'),icon=$('#accessModalIcon'),eyebrow=$('#accessModalEyebrow'),benefits=$('#accessModalBenefits'),login=$('#accessLogin'),upgrade=$('#accessUpgrade'),group=$('#accessTelegramGroup');
 if(guest){title.textContent=isVipMode?'Konten VIP untuk Member':'Gabung komunitas & login untuk menonton';copy.textContent='Gabung grup Telegram resmi kami, lalu login untuk menonton video Basic dengan sedikit iklan. Upgrade VIP untuk menikmati video tanpa iklan dan fitur download.';icon.innerHTML='<i class="fa-brands fa-telegram"></i>';eyebrow.textContent='AKSES MEMBER BOXCELLINK';benefits.innerHTML='<span><i class="fa-solid fa-circle-check"></i> Login untuk menonton video Basic dengan sedikit iklan</span><span><i class="fa-solid fa-crown"></i> VIP: tanpa iklan, download sepuasnya, dan akses video VIP</span>';login.hidden=false;login.href=loginNextUrl();upgrade.hidden=false;group.hidden=false;
 }else if(isVipMode){title.textContent='Video khusus member VIP';copy.textContent='Upgrade ke VIP untuk menonton video eksklusif tanpa iklan, download sepuasnya, dan menikmati koleksi video VIP lainnya.';icon.innerHTML='<i class="fa-solid fa-crown"></i>';eyebrow.textContent='VIP EXCLUSIVE';benefits.innerHTML='<span><i class="fa-solid fa-circle-check"></i> Menonton tanpa iklan</span><span><i class="fa-solid fa-circle-check"></i> Download sepuasnya & akses semua video VIP</span>';login.hidden=true;upgrade.hidden=false;group.hidden=true;
 }else{title.textContent='Login untuk menonton';copy.textContent='Silakan login ke akun BoxCellink untuk menonton video ini dengan sedikit iklan.';icon.innerHTML='<i class="fa-solid fa-lock"></i>';eyebrow.textContent='LOGIN REQUIRED';benefits.innerHTML='<span><i class="fa-solid fa-circle-check"></i> Simpan riwayat tontonan dan akses video Basic</span>';login.hidden=false;login.href=loginNextUrl();upgrade.hidden=true;group.hidden=false;}
 m.hidden=false;document.body.classList.add('modal-open')}
function hideVipModal(){const m=$('#vipModal');if(m)m.hidden=true;document.body.classList.remove('modal-open')}
$('#vipModalClose').onclick=hideVipModal;$('#vipModalCancel').onclick=hideVipModal;$('#vipModal').addEventListener('click',e=>{if(e.target.id==='vipModal')hideVipModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')hideVipModal()});
function isVipVideo(v){return String(v.access||'').toLowerCase()==='vip'||String(v.access_scope||'').toLowerCase()==='vip'}
function isLoginVideo(v){return String(v.access_scope||'').toLowerCase()==='login'&&!isVipVideo(v)}
function loginNextUrl(){const next=location.pathname+location.search;return '/login.html?next='+encodeURIComponent(next)}
function videoUrl(v){return '/v/'+encodeURIComponent(v.slug||v.id)}
function openVideoFromCard(v){if(!v)return;if(isVipVideo(v)&&!isVip){showVipModal('vip');return}if(!currentUser&&isLoginVideo(v)){showVipModal('login');return}location.href=videoUrl(v)}
function orientation(v){const raw=String(v?.orientation||v?.video_orientation||'auto').toLowerCase();if(['vertical','portrait','9:16'].includes(raw))return 'vertical';if(['horizontal','landscape','16:9'].includes(raw))return 'horizontal';return 'auto'}
function thumbnailSource(value){
 if(!value)return '';
 let raw=typeof value==='string'?value:(value.url||value.src||value.thumbnail_url||value.embed_url||value.embed||'');
 raw=String(raw).trim();
 // A thumbnail field is an explicit poster: don't reinterpret a provider URL as the video embed.
 const imageMatch=raw.match(/<(?:img|source)[^>]+src=["']([^"']+)/i);
 if(imageMatch)raw=imageMatch[1];
 const iframeMatch=raw.match(/<iframe[^>]+src=["']([^"']+)/i);
 if(iframeMatch)raw=iframeMatch[1];
 if(raw.startsWith('//'))raw='https:'+raw;
 if(/^data:image\//i.test(raw))return raw;
 try{const u=new URL(raw,location.origin);if(!['http:','https:'].includes(u.protocol))return '';if(/\.(?:jpe?g|png|gif|webp|avif)(?:$|[?#])/i.test(u.href))return u.href;
  const info=window.ProjectVIDEmbed?.parse(raw);
  if(info?.thumbnail)return info.thumbnail;
  if(info?.type==='image')return info.src;
  if(info?.provider==='YouTube'){const id=info.src.match(/youtube-nocookie\.com\/embed\/([^?]+)/)?.[1];return id?`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`:'';}
  if(info?.provider==='Google Drive')return info.thumbnail||'';
  return '';
 }catch{return '';}
}

function imageMarkup(v){
 const explicit=thumbnailSource(v?.thumbnail_url)||thumbnailSource(v?.poster_url);
 const src=explicit||thumbnailSource(v?.embed_url)||thumbnailSource(v?.video_url);
 if(!src){const raw=v?.embed_url||v?.video_url||'';const info=window.ProjectVIDEmbed?.parse(raw);if(info?.type==='iframe')return `<iframe class="watch-provider-poster" src="${esc(info.src)}" title="${esc(v?.title||'Video preview')}" loading="lazy" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen tabindex="-1"></iframe>`;return `<div class="thumb-placeholder"><i class="fa-solid fa-circle-play"></i></div>`;}
 if(/\.(mp4|webm|ogg|m4v|mov|m3u8|mpd)(?:[?#].*)?$/i.test(src))return `<video class="watch-history-thumb" src="${esc(src)}" muted playsinline autoplay loop preload="metadata"></video>`;
 return `<img loading="lazy" src="${esc(src)}" alt="${esc(v?.title||'Video thumbnail')}" onerror="this.onerror=null;this.remove();this.parentElement.classList.add('thumb-failed')">`;
}
function linkify(text){const safe=esc(text);return safe.replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi,m=>{const href=m.toLowerCase().startsWith('www.')?'https://'+m:m;return `<a class="comment-link" href="${href}" target="_blank" rel="noopener noreferrer">${m}</a>`})}
function cardMarkup(v){const vip=isVipVideo(v),orient=orientation(v);return `<article class="video-tile ${vip?'is-vip':''} ${orient==='vertical'?'is-vertical':''}"><button class="video-tile-link" data-video-id="${esc(v.id)}" data-vip="${vip?'1':'0'}">${imageMarkup(v)}<span class="video-type ${vip?'vip':'basic'}">${vip?'<i class="fa-solid fa-crown"></i> '+tr('vip'):tr('basic')}</span><span class="tile-play"><i class="fa-solid fa-play"></i></span></button><div class="tile-copy"><h3>${esc(v.title)}</h3><p>${esc(v.categories?.name||'BoxVidey')} <span>•</span> ${new Date(v.created_at).toLocaleDateString(lang()==='id'?'id-ID':'en-US')}</p></div></article>`}
function adMarkup(){return `<div class="adsterra-banner adsterra-banner-clean related-ad-placement"><div class="ad-box ad-inline-native"></div><span class="ad-caption">ADVERTISEMENT</span></div>`}
const AD_DIRECT_LINK='https://www.profitableratecpmnetwork.com/vw721j6q?key=e997cbbb9bbee0de7820bd0c98fc8351';
const AD_UNITS={
 banner728:{width:728,height:90,key:'b5df562e06e9e080a144e679bdd04b11'},
 banner320:{width:320,height:50,key:'e48004340d99ba399e04e57dd40239fa'},
 banner468:{width:468,height:60,key:'32b22531e798b31302788d3f353a1b96'},
 banner300:{width:300,height:250,key:'896ad8ddb5ea1d057ac6d61226e3f54d'}
};
function injectScript(parent,src,attrs={}){
 if(!parent)return null;
 const script=document.createElement('script');script.src=src;
 Object.entries(attrs).forEach(([k,v])=>script.setAttribute(k,v));
 parent.appendChild(script);return script;
}
function mountAdUnit(host,unit){
 if(!host||host.dataset.loaded==='1')return;host.dataset.loaded='1';
 const {width,height,key}=unit;
 const frame=document.createElement('iframe');frame.title='Advertisement';frame.width=String(width);frame.height=String(height);frame.loading='lazy';frame.scrolling='no';
 frame.style.cssText=`display:block;border:0;background:transparent;width:min(100%,${width}px);height:${height}px;margin:0 auto;overflow:hidden`;
 frame.srcdoc=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}</style></head><body><script>var atOptions={key:'${key}',format:'iframe',height:${height},width:${width},params:{}};<\/script><script src="https://www.highrevenueformat.com/${key}/invoke.js"><\/script></body></html>`;
 host.replaceChildren(frame);
}
function mountInlineAd(host){
 if(!host||host.dataset.loaded==='1')return;host.dataset.loaded='1';
 host.style.cssText='display:block;width:100%;min-height:250px;margin:12px 0;padding:0;background:transparent;border:0;box-shadow:none;border-radius:0';
 const frame=document.createElement('iframe');frame.title='Advertisement';frame.loading='lazy';frame.scrolling='no';
 frame.style.cssText='display:block;width:100%;min-height:250px;height:300px;border:0;background:transparent';
 frame.srcdoc='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;min-height:250px;background:transparent}</style></head><body><script async="async" data-cfasync="false" src="https://pl32231888.profitableratecpmnetwork.com/d0c4535d3914ad4b2c4e09c4aa337646/invoke.js"><\/script><div id="container-d0c4535d3914ad4b2c4e09c4aa337646"></div></body></html>';
 host.replaceChildren(frame);
}
function setupSocialBars(){
 // Adsterra Social Bar is a page-level floating format: load its publisher code once,
 // near the end of body. The three visual slots remain in the markup for the requested
 // stacked layout, but must not each execute the same publisher script.
 if(isVip||document.querySelector('script[data-boxcellink-socialbar="1"]'))return;
 const script=document.createElement('script');
 script.src='https://pl32231840.profitableratecpmnetwork.com/6a/04/a4/6a04a4d0015749a46994e2d7d16590df.js';
 script.async=true;script.setAttribute('data-cfasync','false');script.dataset.boxcellinkSocialbar='1';
 document.body.appendChild(script);
}
let popunderStarted=false;
function setupPopunder(){
 if(isVip||popunderStarted)return;popunderStarted=true;
 // Load publisher popunder once. Its frequency/cooldown is governed by the ad network/browser.
 injectScript(document.body,'https://pl32231845.profitableratecpmnetwork.com/63/28/51/6328510ed0ef36d32ce4589c0110531b.js');
}
function mountFloatingBanner(){
 const wrap=$('#floatingBannerAd'),slot=$('#floatingBannerAdSlot'),hide=$('#hideFloatingBanner'),show=$('#showFloatingBanner');
 if(!wrap||!slot||wrap.dataset.loaded==='1'||isVip)return;
 wrap.dataset.loaded='1';
 slot.style.cssText='width:300px;max-width:100%;min-height:250px;margin:0;padding:0;background:transparent;border:0;box-shadow:none';
 const frame=document.createElement('iframe');frame.title='Iklan mengambang';frame.width='300';frame.height='250';frame.loading='eager';frame.scrolling='no';
 frame.style.cssText='display:block;width:300px;max-width:100%;height:250px;border:0;margin:0 auto;background:transparent';
 frame.srcdoc=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:300px;height:250px;overflow:hidden;background:transparent}</style></head><body><script>var atOptions={key:'896ad8ddb5ea1d057ac6d61226e3f54d',format:'iframe',height:250,width:300,params:{}};<\/script><script src="https://www.highrevenueformat.com/896ad8ddb5ea1d057ac6d61226e3f54d/invoke.js"><\/script></body></html>`;
 slot.replaceChildren(frame);
 window.setTimeout(()=>{if(!isVip&&!sessionStorage.getItem('boxcellinkFloatingAdHidden')){wrap.hidden=false;wrap.classList.add('is-visible')}},7000);
 hide?.addEventListener('click',()=>{wrap.classList.remove('is-visible');wrap.hidden=true;show.hidden=false;sessionStorage.setItem('boxcellinkFloatingAdHidden','1')});
 
 show?.addEventListener('click',()=>{wrap.hidden=false;wrap.classList.add('is-visible');show.hidden=true;sessionStorage.removeItem('boxcellinkFloatingAdHidden')});
 // Move the floating ad by dragging its compact toolbar; remember its position for this tab.
 const handle=$('#floatingAdDragHandle');
 if(handle&&!handle.dataset.dragBound){
  handle.dataset.dragBound='1';let active=false,startX=0,startY=0,left=0,top=0;
  const restore=()=>{try{const pos=JSON.parse(sessionStorage.getItem('boxcellinkFloatingAdPosition')||'null');if(pos&&Number.isFinite(pos.left)&&Number.isFinite(pos.top)){wrap.style.left=pos.left+'px';wrap.style.top=pos.top+'px';wrap.style.right='auto';wrap.style.bottom='auto';wrap.style.transform='none'}}catch{}};
  restore();
  handle.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;active=true;const rect=wrap.getBoundingClientRect();left=rect.left;top=rect.top;startX=e.clientX;startY=e.clientY;handle.setPointerCapture?.(e.pointerId);e.preventDefault()});
  handle.addEventListener('pointermove',e=>{if(!active)return;const maxLeft=Math.max(8,innerWidth-wrap.offsetWidth-8),maxTop=Math.max(8,innerHeight-wrap.offsetHeight-8);const x=Math.max(8,Math.min(maxLeft,left+e.clientX-startX)),y=Math.max(8,Math.min(maxTop,top+e.clientY-startY));wrap.style.left=x+'px';wrap.style.top=y+'px';wrap.style.right='auto';wrap.style.bottom='auto';wrap.style.transform='none'});
  const finish=()=>{if(!active)return;active=false;const rect=wrap.getBoundingClientRect();try{sessionStorage.setItem('boxcellinkFloatingAdPosition',JSON.stringify({left:rect.left,top:rect.top}))}catch{}};
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
  window.addEventListener('resize',()=>{if(wrap.style.left){const x=Math.max(8,Math.min(innerWidth-wrap.offsetWidth-8,parseFloat(wrap.style.left)||8));const y=Math.max(8,Math.min(innerHeight-wrap.offsetHeight-8,parseFloat(wrap.style.top)||8));wrap.style.left=x+'px';wrap.style.top=y+'px'}});
 }

}
let videoPlaybackActive=false;
function setupVideoAdPlayback(){
 const host=$('#watchContent');if(!host||isVip)return;
 host.addEventListener('play',e=>{if(e.target?.tagName==='VIDEO')videoPlaybackActive=true},true);
 host.addEventListener('pause',e=>{if(e.target?.tagName==='VIDEO')videoPlaybackActive=false},true);
 host.addEventListener('ended',()=>{videoPlaybackActive=false},true);
 host.addEventListener('click',e=>{if(e.target.closest('.watch-player iframe'))videoPlaybackActive=true});
 window.addEventListener('message',e=>{const d=e.data;let t='';try{t=typeof d==='string'?d:JSON.stringify(d)}catch{}
  if(/"event"\s*:\s*"(?:pause|ended|finish)"|"playerState"\s*:\s*2/i.test(t))videoPlaybackActive=false;
  if(/"event"\s*:\s*"(?:play|playing)"|"playerState"\s*:\s*1/i.test(t))videoPlaybackActive=true;
 });
}
function addSocialClose(slot){
 if(!slot||slot.querySelector('.social-slot-close'))return;
 const close=document.createElement('button');close.type='button';close.className='social-slot-close';close.setAttribute('aria-label','Tutup iklan');close.textContent='×';
 close.addEventListener('click',()=>{slot.hidden=true;slot.dataset.dismissed='1';});slot.appendChild(close);
}
function setupInterstitial(){
 const modal=$('#videoInterstitialAd'),slot=$('#videoInterstitialSlot'),close=$('#closeVideoInterstitial');
 if(!modal||!slot||isVip||modal.dataset.scheduled==='1')return;
 modal.dataset.scheduled='1';
 let timer=null,tick=null,showing=false;
 const schedule=()=>{
  if(isVip||document.visibilityState==='hidden') {timer=window.setTimeout(schedule,10000);return;}
  timer=window.setTimeout(()=>{
   if(isVip||document.visibilityState==='hidden'){schedule();return;}
   slot.replaceChildren();
   const unit=AD_UNITS.banner300,frame=document.createElement('iframe');
   frame.title='Advertisement';frame.width='300';frame.height='250';frame.scrolling='no';
   frame.style.cssText='display:block;width:min(300px,90vw);height:250px;border:0;margin:auto';
   frame.srcdoc=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent}</style></head><body><script>var atOptions={key:'${unit.key}',format:'iframe',height:250,width:300,params:{}};<\/script><script src="https://www.highrevenueformat.com/${unit.key}/invoke.js"><\/script></body></html>`;
   slot.appendChild(frame);modal.hidden=false;showing=true;
   let remaining=3;close.disabled=true;close.textContent=`Lewati dalam ${remaining}`;
   tick=window.setInterval(()=>{remaining--;if(remaining<=0){window.clearInterval(tick);tick=null;close.disabled=false;close.textContent='× Tutup iklan'}else close.textContent=`Lewati dalam ${remaining}`},1000);
  },10000);
 };
 close.onclick=()=>{
  if(tick){window.clearInterval(tick);tick=null;}
  modal.hidden=true;showing=false;schedule();
 };
 document.addEventListener('visibilitychange',()=>{if(!showing&&document.visibilityState==='visible'&&!timer)schedule()});
 schedule();
}
function setupGuestAds(){
 const role=isVip?'vip':(currentUser?'member':'guest');
 document.querySelectorAll('.adsterra-wide-wrap,.ad-side-card').forEach(el=>{el.hidden=true;el.style.cssText='background:transparent;border:0;box-shadow:none;padding:0;margin:12px 0'});
 document.querySelectorAll('.ad-unit-728,.ad-unit-320,.ad-unit-468,#ad300x250,#ad160x300,#ad160x600').forEach(el=>el.hidden=true);
 if(role==='vip'){
  $('#guestAdTop')?.remove();$('#floatingBannerAd')?.remove();$('#showFloatingBanner')?.remove();$('#guestPopunderSlot')?.remove();$('#videoInterstitialAd')?.remove();
  // VIP sees banner placements only; social bars, popunder, floating and interstitial ads stay off.
  document.querySelectorAll('.ad-side-card').forEach(el=>el.hidden=true);
  document.querySelectorAll('.guest-and-vip-banner').forEach(el=>{el.hidden=false;el.style.cssText='display:block;background:transparent;border:0;box-shadow:none;padding:0;margin:12px 0'});
  document.querySelectorAll('.ad-unit-728,.ad-unit-320,.ad-unit-468').forEach(host=>{host.hidden=false;host.style.cssText='display:block;background:transparent;border:0;box-shadow:none;padding:0;margin:12px auto;max-width:100%';mountAdUnit(host,host.classList.contains('ad-unit-728')?AD_UNITS.banner728:(host.classList.contains('ad-unit-320')?AD_UNITS.banner320:AD_UNITS.banner468))});
  return;
 }
 const socialStack=$('#guestAdTop');
 if(socialStack){socialStack.hidden=false;socialStack.style.display='flex';
  const slots=[...socialStack.querySelectorAll('.adsterra-social-slot')];
  slots.forEach((host,i)=>{
   const allowed=role==='guest'||(role==='member'&&i<2);host.hidden=!allowed;if(!allowed)return;
   host.style.cssText='display:block;position:relative;min-height:50px;padding:0;border:0;background:transparent;box-shadow:none;pointer-events:auto';
   mountAdUnit(host,AD_UNITS.banner320);addSocialClose(host);
  });
 }
 const banners=role==='guest'?
  [['.ad-unit-728',AD_UNITS.banner728],['.ad-unit-320',AD_UNITS.banner320],['.ad-unit-468',AD_UNITS.banner468],['#ad300x250',AD_UNITS.banner300]]:
  [['.ad-unit-320',AD_UNITS.banner320],['#ad300x250',AD_UNITS.banner300]];
 banners.forEach(([sel,unit])=>document.querySelectorAll(sel).forEach(host=>{
  host.hidden=false;host.style.cssText='display:block;background:transparent;border:0;box-shadow:none;padding:0;margin:12px auto;max-width:100%';
  const wrapper=host.closest('.ad-side-card,.adsterra-wide-wrap');if(wrapper){wrapper.hidden=false;wrapper.style.cssText='display:block;background:transparent;border:0;box-shadow:none;padding:0;margin:12px 0'}
  mountAdUnit(host,unit);
 }));
 if(role!=='vip')setupSocialBars();
 if(role==='guest'){
  document.querySelectorAll('.ad-inline-300').forEach(mountInlineAd);
  setupPopunder();mountFloatingBanner();
 }
 setupVideoAdPlayback();setupInterstitial();
}
async function showGuestWatchPreparation(){
 const host=$('#watchContent');if(!host)return;
 const messages=lang()==='en'
  ?['Preparing media','Preparing page','Checking status','Media ready to watch']
  :['Menyiapkan media','Menyiapkan halaman','Memeriksa status','Media siap ditonton'];
 host.innerHTML=`<div class="watch-preparation" role="status" aria-live="polite"><span class="preparation-orb"><i class="fa-solid fa-play"></i></span><strong id="watchPreparationText">${messages[0]}</strong><div class="preparation-track"><span></span></div><small>BOXCELLINK · WATCH</small></div>`;
 let index=0;const text=$('#watchPreparationText');
 const ticker=window.setInterval(()=>{index=Math.min(index+1,messages.length-1);if(text)text.textContent=messages[index]},750);
 await new Promise(resolve=>window.setTimeout(resolve,3000));
 window.clearInterval(ticker);
}
function saveGuestHistory(v){try{const key='boxcellink_watch_history_guest';let a=JSON.parse(localStorage.getItem(key)||'[]');a=a.filter(x=>x.id!==v.id);a.unshift({id:v.id,title:v.title,slug:v.slug,thumbnail_url:v.thumbnail_url,embed_url:v.embed_url,watched_at:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(a.slice(0,20)))}catch{}}
async function load(){applyLang();try{const {data:{user},error:authErr}=await sb.auth.getUser();if(!authErr)currentUser=user||null;if(currentUser){const {data:p}=await sb.from('profiles').select('vip_expires_at').eq('id',currentUser.id).maybeSingle();isVip=!!p?.vip_expires_at&&new Date(p.vip_expires_at)>new Date()}if(!currentUser)await showGuestWatchPreparation();setupGuestAds();applyLang();
 const path=location.pathname.split('/').filter(Boolean),slug=(new URLSearchParams(location.search).get('slug')||path.at(-1)||'').trim();let q=sb.from('videos').select('*,categories(name)').eq('status','published');let {data:v,error}=await q.eq('slug',slug).maybeSingle();if(!v&&!error){const byId=await sb.from('videos').select('*,categories(name)').eq('id',slug).maybeSingle();v=byId.data;error=byId.error}
 let metadataOnly=false;
 if(!v){
  // RLS hides restricted rows from viewers who lack access. Fetch only safe display metadata
  // through a narrowly-scoped RPC; never expose embed_url or download_url in this response.
  const {data:noticeRows,error:noticeError}=await sb.rpc('get_watch_video_notice',{p_slug:slug});
  const notice=Array.isArray(noticeRows)?noticeRows[0]:noticeRows;
  if(!noticeError&&notice){
   const restrictedVip=(String(notice.access||'').toLowerCase()==='vip'||String(notice.access_scope||'').toLowerCase()==='vip')&&!isVip;
   const restrictedLogin=String(notice.access_scope||'').toLowerCase()==='login'&&!currentUser;
   if(restrictedVip||restrictedLogin){v={id:notice.video_id,slug:notice.slug,title:notice.title,access:notice.access,access_scope:notice.access_scope,thumbnail_url:notice.thumbnail_url,created_at:notice.created_at,view_count:notice.view_count,categories:{name:notice.category_name||'BoxVidey'},embed_url:'',download_enabled:false,download_url:null};metadataOnly=true;}
  }
 }
 if(!v){$('#watchContent').innerHTML=`<div class="empty-state large"><i class="fa-regular fa-circle-play"></i><h2>${tr('notFound')}</h2></div>`;return}currentVideo=v;
 await sb.rpc('increment_video_view',{p_video_id:v.id});if(currentUser)await sb.rpc('record_video_watch',{p_video_id:v.id});else saveGuestHistory(v);
 const [{count:likes},{data:comments},{data:liked}]=await Promise.all([sb.from('video_likes').select('*',{count:'exact',head:true}).eq('video_id',v.id),sb.from('video_comments').select('id,body,created_at,user_id,guest_name').eq('video_id',v.id).order('created_at',{ascending:false}).limit(50),currentUser?sb.from('video_likes').select('id').eq('video_id',v.id).eq('user_id',currentUser.id).maybeSingle():Promise.resolve({data:null})]);
 renderMain(v,likes||0,comments||[],!!liked);setupVideoAffiliateTools(v);await Promise.all([loadVideos(v.id),loadCategories(),loadHistory(),loadTelegram()]);renderVideos();renderCategoryVideos();renderVipRail();loadTelegramHistory();
 }catch(e){console.error('Watch page error',e);$('#watchContent').innerHTML=`<div class="empty-state">${tr('watchError')}</div>`}}
function renderEmbedPlayer(v,initialOrient){
 const info=window.ProjectVIDEmbed?.parse(v.embed_url);
 const cls=`watch-player ${initialOrient==='vertical'?'is-vertical':'is-horizontal'}`;
 if(!info)return `<div class="${cls}"><div class="vip-no-thumbnail">Embed tidak valid</div></div>`;
 if(info.type==='video')return `<div class="${cls}"><video src="${esc(info.src)}" controls playsinline preload="metadata" title="${esc(v.title)}"></video></div>`;
 if(info.type==='audio')return `<div class="${cls}"><audio src="${esc(info.src)}" controls preload="metadata"></audio></div>`;
 if(info.type==='iframe')return `<div class="${cls}"><iframe src="${esc(info.src)}" title="${esc(v.title)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
 if(info.type==='image')return `<div class="${cls}"><img src="${esc(info.src)}" alt="${esc(v.title)}" style="width:100%;height:100%;object-fit:contain"></div>`;
 return `<div class="${cls} vip-preview-placeholder"><div class="vip-no-thumbnail"><i class="fa-solid fa-arrow-up-right-from-square"></i><p>${info.provider==='OneDrive'?'Gunakan URL Embed OneDrive atau tempel kode iframe.':'Sumber ini belum menyediakan player embed langsung.'}</p><a class="action-primary" href="${esc(info.src)}" target="_blank" rel="noopener noreferrer">Buka sumber asli</a></div></div>`;
}
async function setupVideoAffiliateTools(v){
 const player=document.querySelector('#watchContent video');
 if(!currentUser||!player)return; // third-party iframes cannot expose trustworthy playback progress
 try{
  const {data:profile}=await sb.from('profiles').select('affiliate_status,referral_code').eq('id',currentUser.id).maybeSingle();
  if(profile?.affiliate_status==='approved'&&profile.referral_code){
   const actions=document.querySelector('#watchContent .watch-actions');
   if(actions){const btn=document.createElement('button');btn.type='button';btn.className='watch-action video-share-earn';btn.innerHTML='<i class="fa-solid fa-coins"></i><span>Share to Earn</span>';btn.style.cssText='border:1px solid #e8c56b;border-radius:12px;background:linear-gradient(135deg,#fff6d8,#f3d889);color:#68470b;font-weight:850;cursor:pointer';btn.addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('ref',profile.referral_code);try{if(navigator.share)await navigator.share({title:v.title,url:url.toString()});else{await navigator.clipboard.writeText(url.toString());alert('Link Share to Earn berhasil disalin.');}}catch(e){if(e?.name!=='AbortError')prompt('Salin link Share to Earn:',url.toString());}});actions.appendChild(btn);}
  }
  const referral=(new URLSearchParams(location.search).get('ref')||localStorage.getItem('boxcellink_affiliate_code')||'').trim().toUpperCase();
  if(!referral)return;
  let sessionId=null,playingSeconds=0,lastTime=null,claiming=false,startedAt=0;
  const begin=async()=>{if(sessionId||claiming)return;claiming=true;try{const {data,error}=await sb.rpc('start_video_watch_earning',{p_video_id:v.id,p_referral_code:referral});if(error||!data?.ok||data.rewarded)return;sessionId=data.session_id;startedAt=Date.now();lastTime=player.currentTime||0;}catch(e){console.warn('Video earning session unavailable:',e);}finally{claiming=false;}};
  player.addEventListener('play',begin);
  player.addEventListener('timeupdate',async()=>{if(!sessionId||player.paused||player.seeking)return;const now=Number(player.currentTime||0);if(lastTime!==null){const delta=now-lastTime;if(delta>0&&delta<=2.5)playingSeconds+=delta;}lastTime=now;if(playingSeconds<300||Date.now()-startedAt<300000||claiming)return;claiming=true;try{const {data,error}=await sb.rpc('claim_video_watch_earning',{p_session_id:sessionId});if(!error&&data?.ok){sessionId=null;const note=document.createElement('div');note.className='video-earning-success';note.textContent='Bonus Share to Earn Rp2 berhasil ditambahkan ke saldo affiliate.';note.style.cssText='margin:10px 0;padding:11px 13px;border-radius:10px;background:#fff6d8;color:#68470b;font-size:12px;font-weight:750';document.querySelector('#watchContent .main-video-details')?.prepend(note);}}catch(e){console.warn('Video earning claim unavailable:',e);}finally{claiming=false;}});
  player.addEventListener('seeking',()=>{lastTime=player.currentTime||0;});player.addEventListener('pause',()=>{lastTime=player.currentTime||0;});
 }catch(e){console.warn('Affiliate video tools unavailable:',e);}
}
function renderMain(v,likes,comments,liked){const vipVideo=isVipVideo(v),loginVideo=isLoginVideo(v),lockedVip=vipVideo&&!isVip,lockedLogin=loginVideo&&!currentUser,locked=lockedVip||lockedLogin,orient=orientation(v);let player='';const initialOrient=orient==='vertical'?'vertical':'horizontal';if(locked){const noticeTitle=lockedLogin?tr('loginRequiredTitle'):tr('vipModalTitle'),noticeText=lockedLogin?tr('loginRequiredText'):tr('teaserNote'),noticeIcon=lockedLogin?'fa-lock':'fa-crown',action=lockedLogin?`<a class="action-secondary" href="${TELEGRAM_GROUP}" target="_blank" rel="noopener">Gabung Grup Telegram</a><a class="action-primary" href="${esc(loginNextUrl())}">${tr('loginButton')}</a>`:(!currentUser?`<a class="action-secondary" href="${TELEGRAM_GROUP}" target="_blank" rel="noopener">Gabung Grup Telegram</a><a class="action-secondary" href="${esc(loginNextUrl())}">Login</a><a class="action-primary" href="/vip.html">Upgrade ke VIP</a>`:`<a class="action-primary" href="/vip.html">Upgrade ke VIP</a>`);player=`<div class="watch-player vip-preview-placeholder ${initialOrient==='vertical'?'is-vertical':'is-horizontal'}">${v.thumbnail_url?imageMarkup(v):'<div class="vip-no-thumbnail"><i class="fa-solid fa-circle-play"></i></div>'}<div class="vip-player-notice" id="vipPlayerNotice"><div class="vip-notice-icon"><i class="fa-solid ${noticeIcon}"></i></div><b>${noticeTitle}</b><p>${noticeText}</p><div class="vip-notice-actions">${action}</div></div></div>`}else{player=renderEmbedPlayer(v,initialOrient)}
const orientationTools=`<div class="watch-orientation-tools" role="group" aria-label="Video orientation"><span>${lang()==='id'?'Tampilan video':'Video layout'}</span><button type="button" class="${initialOrient==='horizontal'?'active':''}" data-watch-orientation="horizontal"><i class="fa-solid fa-tv"></i> ${lang()==='id'?'Horizontal':'Horizontal'} 16:9</button><button type="button" class="${initialOrient==='vertical'?'active':''}" data-watch-orientation="vertical"><i class="fa-solid fa-mobile-screen"></i> ${lang()==='id'?'Vertikal':'Vertical'} 9:16</button></div>`;
player=orientationTools+player;
 $('#watchContent').innerHTML=`${player}<div class="main-video-details"><div class="main-title-row"><div><div class="main-video-badges"><span class="video-type ${vipVideo?'vip':'basic'}">${vipVideo?'<i class="fa-solid fa-crown"></i> '+tr('vip'):tr('basic')}</span>${isVip?'<span class="member-active"><i class="fa-solid fa-shield-check"></i> VIP ACTIVE</span>':''}</div><h2>${esc(v.title)}</h2><div class="watch-meta"><span><i class="fa-regular fa-eye"></i> ${Number(v.view_count||0)+1} ${tr('views')}</span><span><i class="fa-regular fa-calendar"></i> ${tr('published')} ${new Date(v.created_at).toLocaleDateString(lang()==='id'?'id-ID':'en-US')}</span><span><i class="fa-solid fa-folder"></i> ${esc(v.categories?.name||'BoxVidey')}</span></div></div></div><div class="watch-actions"><a class="watch-action" href="${TELEGRAM_GROUP}" target="_blank" rel="noopener"><i class="fa-regular fa-heart"></i><span>${tr('like')}</span><b>${likes}</b></a><a class="watch-action" href="${TELEGRAM_GROUP}" target="_blank" rel="noopener"><i class="fa-regular fa-comment"></i><span>${tr('comment')}</span></a><a class="watch-action" id="shareBtn" href="${TELEGRAM_GROUP}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-from-bracket"></i><span>${tr('share')}</span></a><a class="watch-action" href="${TELEGRAM_GROUP}" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i><span>${tr('community')}</span></a>${v.download_enabled&&v.download_url&&!locked?`<a class="watch-action download-action" href="${esc(v.download_url)}" target="_blank" rel="noopener" data-download-ad="1"><i class="fa-solid fa-download"></i><span>${tr('download')}</span></a>`:''}</div></div>`;
 const playerEl=$('#watchContent .watch-player');document.querySelectorAll('#watchContent [data-watch-orientation]').forEach(btn=>btn.addEventListener('click',()=>{const mode=btn.dataset.watchOrientation;playerEl?.classList.toggle('is-vertical',mode==='vertical');playerEl?.classList.toggle('is-horizontal',mode==='horizontal');$('#watchContent [data-watch-orientation].active')?.classList.remove('active');btn.classList.add('active')}));const mainVid=$('#watchContent video');if(mainVid&&orient==='auto')mainVid.addEventListener('loadedmetadata',()=>{const vertical=mainVid.videoHeight>mainVid.videoWidth;mainVid.closest('.watch-player')?.classList.toggle('is-vertical',vertical);mainVid.closest('.watch-player')?.classList.toggle('is-horizontal',!vertical)},{once:true});$('#mainVipUpgrade')?.addEventListener('click',showVipModal);
 const downloadLink=$('[data-download-ad]');if(downloadLink&&!isVip)downloadLink.addEventListener('click',()=>{window.open(AD_DIRECT_LINK,'_blank','noopener,noreferrer')});if(orient==='auto'&&(thumbnailSource(v.thumbnail_url)||thumbnailSource(v.embed_url))){const probe=new Image();probe.onload=()=>{const vertical=probe.naturalHeight>probe.naturalWidth;const playerEl=$('#watchContent .watch-player');playerEl?.classList.toggle('is-vertical',vertical);playerEl?.classList.toggle('is-horizontal',!vertical)};probe.src=thumbnailSource(v.thumbnail_url)||thumbnailSource(v.embed_url)}const list=$('#commentList');renderComments(comments);
 $('#commentForm').onsubmit=async e=>{e.preventDefault();const field=$('#commentText'),body=field.value.trim(),name=$('#guestCommentName')?.value.trim()||'';if(!body)return;if(!currentUser&&!name){alert(tr('commentNameRequired'));$('#guestCommentName')?.focus();return}if(!currentUser&&/(https?:\/\/|www\.)/i.test(body)){alert(tr('guestLinkDenied'));return}
 const btn=e.submitter;btn.disabled=true;let payload={video_id:v.id,user_id:currentUser?.id||null,body};if(!currentUser)payload.guest_name=name;
 const {error}=await sb.from('video_comments').insert(payload);btn.disabled=false;if(error){alert(tr('commentFailed')+error.message);return}field.value='';if(!currentUser&&$('#guestCommentName'))$('#guestCommentName').value='';await refreshComments(v.id);
 };
}
async function refreshComments(videoId){const {data,error}=await sb.from('video_comments').select('id,body,created_at,user_id,guest_name').eq('video_id',videoId).order('created_at',{ascending:false}).limit(50);if(error){console.warn(error);return}renderComments(data||[])}
async function renderComments(comments){const list=$('#commentList');if(!list)return;if(!comments.length){list.innerHTML=`<div class="empty-state">${tr('noComments')}</div>`;return}
 const ids=comments.map(c=>c.id);let repliesBy={};let likesBy={};try{const [{data:replies},{data:likes}]=await Promise.all([sb.from('video_comment_replies').select('id,comment_id,body,created_at,user_id,guest_name').in('comment_id',ids).order('created_at',{ascending:true}),sb.from('video_comment_likes').select('comment_id,user_id,guest_token').in('comment_id',ids)]);(replies||[]).forEach(r=>(repliesBy[r.comment_id]??=[]).push(r));(likes||[]).forEach(l=>(likesBy[l.comment_id]??=[]).push(l))}catch(e){console.warn('Comment reactions/replies:',e)}
 list.innerHTML=comments.map(c=>{const likes=likesBy[c.id]||[],mine=likes.some(x=>currentUser?x.user_id===currentUser.id:x.guest_token===guestToken),replies=repliesBy[c.id]||[],author=c.guest_name||'BoxCellink member';return `<article class="comment-item" data-comment-id="${esc(c.id)}"><div class="comment-avatar">${esc((author||'?').trim().charAt(0).toUpperCase())}</div><div class="comment-body"><div class="comment-byline"><b>${esc(author)}</b><time>${new Date(c.created_at).toLocaleString(lang()==='id'?'id-ID':'en-US',{dateStyle:'medium',timeStyle:'short'})}</time></div><p>${linkify(c.body)}</p><div class="comment-tools"><button class="comment-tool ${mine?'is-liked':''}" data-comment-like="${esc(c.id)}">♡ ${tr('commentLike')} (${likes.length})</button><button class="comment-tool" data-comment-reply="${esc(c.id)}">↳ ${tr('reply')} (${replies.length})</button></div><div class="comment-replies">${replies.map(r=>`<div class="comment-reply"><b>${esc(r.guest_name||'BoxCellink member')}</b><p>${linkify(r.body)}</p></div>`).join('')}</div><div class="reply-form-wrap" id="replyWrap-${esc(c.id)}"></div></div></article>`}).join('');
 list.querySelectorAll('[data-comment-like]').forEach(btn=>btn.onclick=()=>toggleCommentLike(btn.dataset.commentLike));
 list.querySelectorAll('[data-comment-reply]').forEach(btn=>btn.onclick=()=>openReplyForm(btn.dataset.commentReply));
}
async function toggleCommentLike(commentId){const q=sb.from('video_comment_likes');let del=q.delete().eq('comment_id',commentId);if(currentUser)del=del.eq('user_id',currentUser.id);else del=del.eq('guest_token',guestToken);const {data:existing}=await sb.from('video_comment_likes').select('id').eq('comment_id',commentId).match(currentUser?{user_id:currentUser.id}:{guest_token:guestToken}).maybeSingle();if(existing){if(currentUser){const {error}=await del;if(error)alert(error.message)}}else{const {error}=await sb.from('video_comment_likes').insert({comment_id:commentId,user_id:currentUser?.id||null,guest_token:currentUser?null:guestToken});if(error)alert(error.message)}await refreshComments(currentVideo.id)}
function openReplyForm(commentId){const wrap=$(`#replyWrap-${CSS.escape(commentId)}`);if(!wrap)return;if(wrap.innerHTML){wrap.innerHTML='';return}wrap.innerHTML=`<form class="reply-form"><input class="reply-name" maxlength="40" placeholder="${tr('guestName')}" ${currentUser?'hidden':''}><textarea maxlength="1000" placeholder="${tr('replyPlaceholder')}" required></textarea><button class="action-primary" type="submit">${tr('sendReply')}</button></form>`;wrap.querySelector('form').onsubmit=async e=>{e.preventDefault();const name=wrap.querySelector('.reply-name')?.value.trim()||'',body=wrap.querySelector('textarea').value.trim();if(!currentUser&&!name){alert(tr('commentNameRequired'));return}if(!currentUser&&/(https?:\/\/|www\.)/i.test(body)){alert(tr('guestLinkDenied'));return}const payload={comment_id:commentId,user_id:currentUser?.id||null,body,...(!currentUser?{guest_name:name}:{})};const {error}=await sb.from('video_comment_replies').insert(payload);if(error){alert(tr('commentFailed')+error.message);return}await refreshComments(currentVideo.id)}}
function setupTeaser(){const v=$('#vipTeaserVideo');if(!v)return;let start=1,end=5,ready=false;const begin=()=>{if(!Number.isFinite(v.duration)||v.duration<=0)return;start=Math.min(1,Math.max(0,v.duration-0.2));end=Math.min(5,Math.max(start+0.2,v.duration-0.08));try{v.currentTime=start}catch{}ready=true;v.play().catch(()=>{})};v.addEventListener('loadedmetadata',begin,{once:true});v.addEventListener('timeupdate',()=>{if(!ready)return;if(v.currentTime>=end){try{v.currentTime=start;v.play().catch(()=>{})}catch{}}});v.addEventListener('ended',()=>{if(ready){v.currentTime=start;v.play().catch(()=>{})}});if(v.readyState>=1)begin()}
async function loadVideos(current){const {data,error}=await sb.from('videos').select('id,title,slug,thumbnail_url,orientation,access,access_scope,created_at,category_id,categories(name)').eq('status','published').neq('id',current).order('created_at',{ascending:false}).limit(100);if(error){console.warn('Video list:',error.message);allVideos=[]}else allVideos=data||[]}
function interleaved(items,withAds){
 const basic=items.filter(v=>!isVipVideo(v)),vip=items.filter(isVipVideo),out=[];
 const take=a=>{if(a.length)out.push(a.shift())};
 take(basic);take(basic);
 if(withAds)out.push({__ad:true});
 take(basic);take(vip);take(basic);take(basic);
 if(withAds)out.push({__ad:true});
 take(vip);take(basic);take(basic);take(basic);
 while(basic.length||vip.length){if(basic.length)take(basic);if(vip.length)take(vip)}
 return out
}
function renderVideos(){
 const filtered=allVideos.filter(v=>activeFilter==='all'||(activeFilter==='vip'?isVipVideo(v):!isVipVideo(v)));
 const totalPages=Math.max(1,Math.ceil(filtered.length/perPage));page=Math.min(page,totalPages);
 const pageItems=filtered.slice((page-1)*perPage,page*perPage);const g=$('#relatedVideos');
 if(!pageItems.length){g.innerHTML=`<div class="empty-state wide">${tr('emptyVideos')}</div>`;$('#watchPages').innerHTML='';return}
 let html='';pageItems.forEach((v,i)=>{
  html+=cardMarkup(v);
  const n=i+1;
  const shouldInsertAd=isVip?n===4:(currentUser?n===8:[4,6,10,12,16].includes(n));
  if(shouldInsertAd)html+=adMarkup();
 });
 g.innerHTML=html;g.querySelectorAll('.ad-inline-native').forEach(mountInlineAd);
 g.querySelectorAll('[data-video-id]').forEach(btn=>btn.addEventListener('click',()=>{const found=allVideos.find(v=>v.id===btn.dataset.videoId);if(found)openVideoFromCard(found)}));
 $('#watchPages').innerHTML=totalPages>1?`<button class="page-btn" ${page===1?'disabled':''} data-page="${page-1}"><i class="fa-solid fa-chevron-left"></i> ${tr('pagePrev')}</button><span>${page} / ${totalPages}</span><button class="page-btn" ${page===totalPages?'disabled':''} data-page="${page+1}">${tr('pageNext')} <i class="fa-solid fa-chevron-right"></i></button>`:'';
 $('#watchPages').querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=Number(b.dataset.page);renderVideos();$('#relatedVideos').scrollIntoView({behavior:'smooth',block:'start'})});
}
document.querySelectorAll('.filter-chip').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeFilter=b.dataset.filter;page=1;renderVideos()});
async function loadCategories(){const {data,error}=await sb.from('categories').select('id,name').eq('status','published').order('name');const box=$('#categoryList');if(error||!data?.length){box.innerHTML=`<div class=\"empty-state\">${tr('categoriesEmpty')}</div>`;categories=[];return}categories=data;const results=await Promise.all([sb.from('videos').select('id',{count:'exact',head:true}).eq('status','published'),...data.map(c=>sb.from('videos').select('id',{count:'exact',head:true}).eq('status','published').eq('category_id',c.id))]);categoryCounts={};data.forEach((c,i)=>{categoryCounts[c.id]=results[i+1]?.count||0});if(results.some(r=>r.error))console.warn('One or more category counts could not be loaded.');const total=results[0]?.count||0;box.innerHTML=`<a href=\"/index.html\" class=\"category-link\"><span><i class=\"fa-solid fa-border-all\"></i> ${lang()==='id'?'Semua video':'All videos'}</span><b class=\"category-count\">${total} media</b></a>`+data.map(c=>`<a href=\"/index.html?category=${encodeURIComponent(c.id)}\" class=\"category-link\"><span><i class=\"fa-regular fa-folder\"></i> ${esc(c.name)}</span><b class=\"category-count\">${categoryCounts[c.id]||0} media</b></a>`).join('')}
function renderCategoryVideos(){const box=$('#categoryVideoSections');if(!box)return;const cats=categories;if(!cats.length){box.innerHTML=`<div class="empty-state">${tr('categoriesEmpty')}</div>`;return}box.innerHTML=cats.map(c=>{const rows=allVideos.filter(v=>String(v.category_id||'')===String(c.id));return `<section class="category-video-block"><div class="category-video-head"><h3>${esc(c.name)} <span class="category-count">${categoryCounts[c.id]||0} ${lang()==='id'?'media':'media'}</span></h3><a href="/watch.html?category=${encodeURIComponent(c.id)}">${tr('seeAll')} →</a></div><div class="category-video-rail">${rows.length?rows.slice(0,12).map(cardMarkup).join(''):`<div class="empty-state">${tr('emptyVideos')}</div>`}</div></section>`}).join('');box.querySelectorAll('[data-video-id]').forEach(btn=>btn.onclick=()=>{const found=allVideos.find(v=>v.id===btn.dataset.videoId);if(found)openVideoFromCard(found)})}
function renderVipRail(){
 const box=$('#vipVideoRail');if(!box)return;const rows=allVideos.filter(isVipVideo).slice(0,12);
 if(!rows.length){box.innerHTML=`<div class="empty-state">Belum ada video VIP yang dipublikasikan.</div>`;return;}
 box.innerHTML=rows.map(v=>`<article class="vip-rail-card"><button type="button" class="vip-rail-thumb" data-video-id="${esc(v.id)}">${imageMarkup(v)}<span><i class="fa-solid fa-crown"></i> VIP</span></button><b>${esc(v.title)}</b><small>${esc(v.categories?.name||'VIP Collection')}</small></article>`).join('');
 box.querySelectorAll('[data-video-id]').forEach(btn=>btn.onclick=()=>{const found=allVideos.find(v=>v.id===btn.dataset.videoId);if(found)openVideoFromCard(found)});
}
function saveTelegramHistory(item){try{const key='boxcellink_telegram_watch_history';let a=JSON.parse(localStorage.getItem(key)||'[]');a=a.filter(x=>x.id!==item.id);a.unshift({...item,watched_at:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(a.slice(0,20)))}catch{}}
function loadTelegramHistory(){const box=$('#telegramHistory');if(!box)return;let a=[];try{a=JSON.parse(localStorage.getItem('boxcellink_telegram_watch_history')||'[]')}catch{}box.innerHTML=a.length?a.map(x=>`<a class="rail-card story-media-card" href="${x.slug?`/r/${encodeURIComponent(x.slug)}`:'/telegram.html'}">${imageMarkup(x)}<span class="story-media-shade"></span><span class="story-media-copy"><b>${esc(x.title)}</b><small>${new Date(x.watched_at).toLocaleDateString(lang()==='id'?'id-ID':'en-US')}</small></span></a>`).join(''):`<div class="empty-state">Belum ada riwayat review Telegram.</div>`}
async function loadHistory(){const box=$('#watchHistory');if(!currentUser){let a=[];try{a=JSON.parse(localStorage.getItem('boxcellink_watch_history_guest')||'[]')}catch{}box.innerHTML=a.length?a.map(x=>`<a class="rail-card" href="${videoUrl(x)}">${imageMarkup(x)}<b>${esc(x.title)}</b><small>${new Date(x.watched_at).toLocaleDateString(lang()==='id'?'id-ID':'en-US')}</small></a>`).join(''):`<div class="empty-state">${tr('historyEmpty')}</div>`;return}const {data,error}=await sb.from('video_watch_history').select('watched_at,videos(id,title,slug,thumbnail_url,embed_url)').eq('user_id',currentUser.id).order('watched_at',{ascending:false}).limit(15);if(error||!data?.length){box.innerHTML=`<div class="empty-state">${tr('historyEmpty')}</div>`;return}box.innerHTML=data.filter(x=>x.videos).map(x=>`<a class="rail-card" href="${videoUrl(x.videos)}">${imageMarkup(x.videos)}<b>${esc(x.videos.title)}</b><small>${new Date(x.watched_at).toLocaleDateString(lang()==='id'?'id-ID':'en-US')}</small></a>`).join('')}
async function loadTelegram(){
 const box=$('#telegramRail');if(!box)return;
 const {data,error}=await sb.from('review_items').select('id,slug,title,thumbnail_url,review_embed_url,gallery_urls,price,access,status,created_at').eq('status','published').order('created_at',{ascending:false}).limit(12);
 if(error||!data?.length){box.innerHTML=`<div class="empty-state">${tr('telegramEmpty')}</div>`;return;}
 box.innerHTML=data.map(x=>{
  const gallery=Array.isArray(x.gallery_urls)?x.gallery_urls:[];
  const thumb=x.thumbnail_url||gallery[0]||x.review_embed_url||'';
  const item={id:x.id,slug:x.slug,title:x.title,thumbnail_url:thumb,embed_url:x.review_embed_url||gallery[0]||''};
  return `<a class="rail-card telegram-rail-card story-media-card" href="/r/${encodeURIComponent(x.slug||x.id)}" data-telegram-history="${esc(x.id)}">${imageMarkup(item)}<span class="story-media-shade"></span><span class="story-media-copy"><b>${esc(x.title)}</b><small>${x.access==='paid'?'Rp '+Number(x.price||0).toLocaleString('id-ID'):tr('basic')} · ${lang()==='id'?'Review Telegram':'Telegram review'}</small></span></a>`;
 }).join('');
 box.querySelectorAll('[data-telegram-history]').forEach(a=>a.addEventListener('click',()=>{
  const x=data.find(v=>String(v.id)===a.dataset.telegramHistory);if(!x)return;
  const gallery=Array.isArray(x.gallery_urls)?x.gallery_urls:[];
  saveTelegramHistory({id:x.id,slug:x.slug,title:x.title,thumbnail_url:x.thumbnail_url||gallery[0]||x.review_embed_url,embed_url:x.review_embed_url||gallery[0]||''});
 }));
 loadTelegramHistory();
}

document.addEventListener('boxcellink:language-change',()=>location.reload());load();
})();