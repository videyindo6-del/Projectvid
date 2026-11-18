(()=>{'use strict';
const path=location.pathname.toLowerCase();
let key=null;
if(path.startsWith('/r/')||path.includes('review-detail')) key='review_detail';
else if(path.includes('watch')) key='watch';
else if(path.includes('review')) key='review';
if(!key||!window.sb)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=value=>{try{const u=new URL(String(value||''));return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
function addStyles(){
 if(document.getElementById('bc-community-links-style'))return;
 const st=document.createElement('style');st.id='bc-community-links-style';st.textContent=`
 .bc-community-link{position:fixed;z-index:9998;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:#fff!important;text-decoration:none!important;font-size:25px;box-shadow:0 8px 24px #10243c38;border:2px solid #fff;transition:transform .18s}
 .bc-community-link:hover{transform:translateY(-3px) scale(1.04)}
 .bc-community-link.telegram{left:16px;bottom:104px;background:#229ed9}
 .bc-community-right{position:fixed;right:16px;bottom:104px;z-index:9998;display:grid;gap:10px}
 .bc-community-right .bc-community-link{position:static}
 .bc-community-link.whatsapp{background:#20b967}.bc-community-link.youtube{background:#e62117}
 .bc-community-notice{display:flex;align-items:center;gap:12px;padding:15px;margin:14px auto;max-width:1100px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;color:#17324d;font-family:inherit;position:relative;z-index:8;box-shadow:0 8px 22px #17324d12}
 .bc-community-notice-copy{flex:1;min-width:0}.bc-community-notice-copy b{display:block;font-weight:800}.bc-community-notice-copy p{margin:4px 0 0;font-size:13px;line-height:1.5}
 .bc-community-notice-actions{display:flex;gap:8px;flex-wrap:wrap}.bc-community-notice-actions a{display:inline-flex;align-items:center;gap:7px;background:#229ed9;color:#fff!important;padding:9px 12px;border-radius:9px;text-decoration:none!important;font-weight:750;font-size:13px;white-space:nowrap}.bc-community-notice-actions a.wa{background:#20a95d}
 .bc-community-notice-close{border:0;background:transparent;font-size:23px;cursor:pointer;color:inherit;padding:2px 6px}
 @media(max-width:600px){.bc-community-link{width:46px;height:46px;font-size:22px}.bc-community-link.telegram{left:10px;bottom:88px}.bc-community-right{right:10px;bottom:88px}.bc-community-notice{margin:10px 12px;align-items:flex-start;flex-wrap:wrap}.bc-community-notice-copy{flex-basis:calc(100% - 35px)}.bc-community-notice-actions{width:100%}.bc-community-notice-actions a{flex:1;justify-content:center}}
 `;
 document.head.appendChild(st);
}
function iconLink(url,cls,icon,label){
 const href=safeUrl(url);if(!href)return '';
 return `<a class="bc-community-link ${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}" title="${esc(label)}"><i class="${icon}" aria-hidden="true"></i></a>`;
}
async function show(){
 const {data,error}=await sb.from('site_link_settings').select('value').eq('key','notice_'+key).maybeSingle();
 if(error)return;
 const n=data?.value||{};
 // Compatibility for old single-channel settings created before the separate link controls.
 let tg=n.telegram_url||'',wa=n.whatsapp_url||'';
 if(!tg&&!wa&&n.url){if(n.channel==='whatsapp')wa=n.url;else tg=n.url}
 const yt=n.youtube_url||'';
 addStyles();
 const dock=document.createElement('div');dock.id='bcCommunityDock';
 dock.innerHTML=iconLink(tg,'telegram','fa-brands fa-telegram','Gabung Telegram')+
  `<div class="bc-community-right">${iconLink(wa,'whatsapp','fa-brands fa-whatsapp','Gabung WhatsApp')}${iconLink(yt,'youtube','fa-brands fa-youtube','Subscribe YouTube')}</div>`;
 document.body.appendChild(dock);
 // The expandable join notice is specific to the review detail page and is controlled in Admin > Link & Notifikasi.
 if(key!=='review_detail'||!n.enabled||(!safeUrl(tg)&&!safeUrl(wa)))return;
 const box=document.createElement('aside');box.className='bc-community-notice';box.setAttribute('role','region');box.setAttribute('aria-label','Gabung komunitas resmi');
 const actions=(safeUrl(tg)?`<a href="${esc(safeUrl(tg))}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-telegram"></i>${esc(n.telegram_button||'Gabung Telegram')}</a>`:'')+
 (safeUrl(wa)?`<a class="wa" href="${esc(safeUrl(wa))}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i>${esc(n.whatsapp_button||'Gabung WhatsApp')}</a>`:'');
 box.innerHTML=`<div class="bc-community-notice-copy"><b>${esc(n.title||'Gabung komunitas resmi')}</b><p>${esc(n.description||'Dapatkan informasi dan update terbaru BoxCellink.')}</p></div><div class="bc-community-notice-actions">${actions}</div><button class="bc-community-notice-close" type="button" aria-label="Tutup">×</button>`;
 box.querySelector('button').addEventListener('click',()=>box.remove());
 const main=document.querySelector('main');if(main)main.prepend(box);else document.body.prepend(box);
}
show().catch(()=>{});
})();