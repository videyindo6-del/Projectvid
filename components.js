(() => {
const translations={id:{admin:'Panel Admin',dashboard:'Dashboard',account:'Akun Saya',box:'Box Video',telegram:'Media Telegram',review:'Review & Download',vip:'VIP',groups:'Group VIP Telegram',discount:'Kode Diskon Saya',referral:'Referral & Hadiah',notifications:'Notifikasi',wallet:'Saldo & Afiliasi',categories:'Kategori',payments:'Pembayaran',login:'Masuk',register:'Daftar',logout:'Keluar',terms:'Syarat & ketentuan',privacy:'Kebijakan Dan Privasi',help:'Bantuan',cookies:'Kami menggunakan cookie untuk pengalaman yang lebih baik.',accept:'Setujui'},en:{admin:'Admin Panel',dashboard:'Dashboard',account:'My Account',box:'Box Video',telegram:'Telegram Media',review:'Review & Download',vip:'VIP',groups:'VIP Telegram Groups',discount:'My Discount Codes',referral:'Referral & Rewards',notifications:'Notifications',wallet:'Wallet & Affiliate',categories:'Categories',payments:'Payments',login:'Sign in',register:'Sign up',logout:'Sign out',terms:'Terms & Conditions',privacy:'Privacy Policy',help:'Help',cookies:'We use cookies for a better experience.',accept:'Accept'}};
const getLang=()=>localStorage.getItem('boxcellink_lang')||'id';
function applyLocal(l=getLang()){const d=translations[l]||translations.id;document.documentElement.lang=l;document.querySelectorAll('[data-nav]').forEach(e=>{if(d[e.dataset.nav])e.textContent=d[e.dataset.nav]});document.querySelectorAll('[data-footer]').forEach(e=>{if(d[e.dataset.footer])e.textContent=d[e.dataset.footer]});const b=document.getElementById('translateLabel');if(b)b.textContent=l==='id'?'ID':'ENG';}
async function load(selector,url){const el=document.querySelector(selector);if(!el)return;try{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);el.innerHTML=await r.text();}catch(e){console.error('Component load failed',url,e);if(selector.includes('footer'))el.innerHTML='<footer class="bc-footer"><div class="bc-footer-inner"><div>© <span id="footerYear"></span> Boxcellink. All rights reserved.</div><nav><a href="/terms.html">Syarat & ketentuan</a><a href="/privacy.html">Kebijakan Dan Privasi</a><a href="/help.html">Bantuan</a></nav></div></footer>';else if(selector.includes('navbar'))el.innerHTML='<header class="bc-navbar"><div class="bc-nav-inner"><a class="bc-brand" href="/index.html">BoxCellink</a><div class="bc-nav-actions"><button id="translateBtn" class="bc-nav-btn" type="button"><span id="translateLabel">ID</span></button></div></div></header>';}}
function setGoogleLanguage(lang){localStorage.setItem('boxcellink_lang',lang);applyLocal(lang);document.dispatchEvent(new CustomEvent('boxcellink:language-change',{detail:{lang}}));}
function initTranslate(){const btn=document.getElementById('translateBtn');if(!btn)return;let icon=btn.querySelector('i');if(!icon){icon=document.createElement('i');btn.prepend(icon);}icon.className='fa-solid fa-language';icon.setAttribute('aria-hidden','true');btn.setAttribute('aria-label',getLang()==='id'?'Ganti bahasa ke Inggris':'Switch language to Indonesian');btn.title=btn.getAttribute('aria-label');if(!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',()=>setGoogleLanguage(getLang()==='id'?'en':'id'));}applyLocal();}
function currentPage(){
  const path=(location.pathname||'/').toLowerCase().replace(/\/+$/,'')||'/';
  return (path.split('/').pop()||'index').replace(/\.html$/,'');
}
function isAuthRoute(){
  return new Set(['login','register','forgot-password']).has(currentPage());
}
function isPublicRoute(){
  const page=currentPage();
  const path=(location.pathname||'/').toLowerCase();
  const publicPages=new Set([
    'index','login','register','forgot-password','watch','review','review-detail','telegram','book-video','vip','vip-groups'
  ]);
  return publicPages.has(page)||path.startsWith('/v/')||path.startsWith('/r/');
}
function initDrawer(){
 const drawer=document.getElementById('navDrawer'),shade=document.getElementById('navShade'),open=document.getElementById('navOpen');
 const toggle=v=>{drawer?.classList.toggle('open',v);shade?.classList.toggle('show',v);open?.setAttribute('aria-expanded',String(v));};
 if(open&&!open.dataset.bound){open.dataset.bound='1';open.addEventListener('click',()=>toggle(true));}
 const close=document.getElementById('navClose');
 if(close&&!close.dataset.bound){close.dataset.bound='1';close.addEventListener('click',()=>toggle(false));}
 if(shade&&!shade.dataset.bound){shade.dataset.bound='1';shade.addEventListener('click',()=>toggle(false));}
 if(!document.body.dataset.drawerEscapeBound){document.body.dataset.drawerEscapeBound='1';document.addEventListener('keydown',e=>{if(e.key==='Escape')toggle(false)});}
}

async function loadCustomNavItems(){
 if(!window.sb?.from)return;
 try{
  const {data,error}=await window.sb.from('site_nav_items').select('id,label,href,icon,tag,tag_color,bg_color,text_color,visibility,sort_order').eq('active',true).order('sort_order').limit(30);
  if(error){console.warn('Custom navbar items unavailable:',error.message);return;}
  const safeColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||''))?value:'';
  const render=item=>{const href=String(item.href||'');if(!(/^(https:\/\/|\/(?!\/))/i.test(href)))return '';const icon=/^(fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/.test(item.icon||'')?item.icon:'fa-solid fa-link';const tag=String(item.tag||'').toUpperCase();const color=safeColor(item.tag_color)||'#2563eb',bg=safeColor(item.bg_color)||'#eff6ff',text=safeColor(item.text_color)||'#334155';return `<a class="bc-custom-nav-item" href="${esc(href)}" style="--bc-nav-text:${text};--bc-nav-bg:${bg}"><i class="${icon}"></i><span>${esc(item.label)}</span>${tag?`<small style="--bc-nav-tag:${color}">${esc(tag)}</small>`:''}</a>`;};
  const guest=document.getElementById('navCustomItemsGuest'),member=document.getElementById('navCustomItemsMember');
  if(guest)guest.innerHTML=(data||[]).filter(x=>['all','guest'].includes(x.visibility||'all')).map(render).join('');
  if(member)member.innerHTML=(data||[]).filter(x=>['all','member'].includes(x.visibility||'all')).map(render).join('');
 }catch(error){console.warn('Custom navbar load failed:',error);}
}

async function initMemberNavExtras(user){
 const wallet=document.getElementById('navWallet'),notifyWrap=document.getElementById('navNotificationWrap');
 const money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
 if(wallet){
  try{const {data:p,error}=await window.sb.from('profiles').select('deposit_balance,affiliate_balance').eq('id',user.id).maybeSingle();if(!error&&p){document.getElementById('navDepositBalance').textContent=money(p.deposit_balance);document.getElementById('navAffiliateBalance').textContent=money(p.affiliate_balance);wallet.hidden=false;}}catch(e){console.warn('Wallet summary unavailable:',e);}
 }
 if(!notifyWrap)return;
 notifyWrap.hidden=false;
 const badge=document.getElementById('navNotificationCount'),btn=document.getElementById('navNotificationBtn'),panel=document.getElementById('navNotificationDropdown'),list=document.getElementById('navNotificationItems');
 const markBtn=document.getElementById('navMarkAllRead'),deleteBtn=document.getElementById('navDeleteAllRead');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeHref=v=>String(v||'').startsWith('/')&&!String(v).startsWith('//')?v:'/notifications.html';
 let rows=[];
 const render=()=>{if(!list)return;list.innerHTML=rows.length?rows.map(n=>`<a class="bc-notification-item ${n.is_read?'':'unread'}" href="${esc(safeHref(n.href))}" data-nav-notice="${esc(n.id)}"><b>${esc(n.title||'Notifikasi')}</b><span>${esc(n.body||'')}</span><small>${new Date(n.created_at).toLocaleString('id-ID')}</small></a>`).join(''):'<p class="bc-notification-empty">Belum ada notifikasi.</p>';const unread=rows.filter(n=>!n.is_read).length;if(badge){badge.textContent=unread>99?'99+':String(unread);badge.hidden=!unread;}if(markBtn)markBtn.disabled=!unread;if(deleteBtn)deleteBtn.disabled=!rows.some(n=>n.is_read);};
 const load=async()=>{const {data,error}=await window.sb.from('boxcellink_notifications').select('id,title,body,href,is_read,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(5);if(error)throw error;rows=data||[];render();};
 const refresh=async()=>{try{await load();}catch(e){if(list)list.innerHTML='<p class="bc-notification-empty">Notifikasi belum dapat dimuat.</p>';if(badge)badge.hidden=true;console.warn('Notification preview unavailable:',e);}};
 await refresh();
 if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',async()=>{const open=panel?.hidden!==false;if(panel)panel.hidden=!open;btn.setAttribute('aria-expanded',String(open));if(open)await refresh();});}
 if(panel&&!panel.dataset.bound){panel.dataset.bound='1';panel.addEventListener('click',async e=>{const link=e.target.closest('[data-nav-notice]');if(!link)return;e.preventDefault();const id=link.dataset.navNotice,href=link.href;const row=rows.find(x=>String(x.id)===String(id));if(row&&!row.is_read){const {error}=await window.sb.from('boxcellink_notifications').update({is_read:true}).eq('id',id).eq('user_id',user.id);if(error){console.warn('Mark notification read failed:',error);return;}}location.assign(href);});}
 if(markBtn&&!markBtn.dataset.bound){markBtn.dataset.bound='1';markBtn.addEventListener('click',async()=>{if(!rows.some(n=>!n.is_read))return;markBtn.disabled=true;const {error}=await window.sb.from('boxcellink_notifications').update({is_read:true}).eq('user_id',user.id).eq('is_read',false);if(error){console.warn('Mark all notifications failed:',error);return;}await refresh();});}
 if(deleteBtn&&!deleteBtn.dataset.bound){deleteBtn.dataset.bound='1';deleteBtn.addEventListener('click',async()=>{if(!rows.some(n=>n.is_read)||!confirm('Hapus semua notifikasi yang sudah dibaca?'))return;deleteBtn.disabled=true;const {error}=await window.sb.from('boxcellink_notifications').delete().eq('user_id',user.id).eq('is_read',true);if(error){console.warn('Delete read notifications failed:',error);return;}await refresh();});}
 if(!document.body.dataset.noticeOutsideBound){document.body.dataset.noticeOutsideBound='1';document.addEventListener('click',e=>{if(!notifyWrap.contains(e.target)){if(panel)panel.hidden=true;btn?.setAttribute('aria-expanded','false');}});}
}
async function initNavCategoryMenus(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // BoxVidey categories are nested under one compact accordion, not a separate
 // top-level navigation destination. Public categories are safe for guests too.
 if(window.sb?.from){
   try{
     const {data:cats,error:catError}=await window.sb.from('categories').select('id,name,content_type').eq('status','published').order('name');
     if(!catError){
       const boxCats=(cats||[]).filter(c=>c.content_type==='box_video'),tgCats=(cats||[]).filter(c=>c.content_type==='media_telegram');
       const countByCategory=async(table,items)=>{const pairs=await Promise.all(items.map(async c=>{const {count,error}=await window.sb.from(table).select('id',{count:'exact',head:true}).eq('status','published').eq('category_id',c.id);if(error)console.warn(`Category count ${table}/${c.id}:`,error.message);return [c.id,error?0:(count||0)];}));return new Map(pairs);};
       const [videoCounts,reviewCounts,videoTotalResult,reviewTotalResult]=await Promise.all([
         countByCategory('videos',boxCats),countByCategory('review_items',tgCats),
         window.sb.from('videos').select('id',{count:'exact',head:true}).eq('status','published'),
         window.sb.from('review_items').select('id',{count:'exact',head:true}).eq('status','published')
       ]);
       const boxTotal=videoTotalResult.error?0:(videoTotalResult.count||0),tgTotal=reviewTotalResult.error?0:(reviewTotalResult.count||0);
       document.querySelectorAll('.bc-submenu[id^="boxCategorySubmenu"]').forEach(target=>{
         target.innerHTML=`<div class="bc-submenu-summary"><b>${boxTotal.toLocaleString('id-ID')} BoxVidey</b><small>${boxCats.length} kategori</small></div><a class="bc-box-video-all" href="/book-video.html">Lihat semuanya <small>(${boxTotal})</small></a>`+(boxCats.map(c=>`<a class="bc-box-video-category" href="/book-video.html?category=${encodeURIComponent(c.id)}">${esc(c.name)} <small>(${videoCounts.get(c.id)||0})</small></a>`).join('')||'<span class="submenu-loading">Belum ada kategori aktif</span>');
       });
       document.querySelectorAll('.bc-submenu[id^="telegramCategorySubmenu"]').forEach(target=>{
         target.innerHTML=`<div class="bc-submenu-summary"><b>${tgTotal.toLocaleString('id-ID')} Media Telegram</b><small>${tgCats.length} kategori</small></div><a href="/telegram.html">Lihat semuanya <small>(${tgTotal})</small></a>`+(tgCats.map(c=>`<a href="/telegram.html?category=${encodeURIComponent(c.id)}">${esc(c.name)} <small>(${reviewCounts.get(c.id)||0})</small></a>`).join('')||'<span class="submenu-loading">Belum ada kategori aktif</span>');
       });
     }
   }catch(e){console.warn('Navigation categories unavailable:',e);}
 }
 document.querySelectorAll('.bc-submenu[id^="boxCategorySubmenu"] a').forEach(link=>{
  try{const target=new URL(link.getAttribute('href')||'',location.origin);if(/\/(?:watch|videos?)(?:\.html)?$/i.test(target.pathname)){target.pathname='/book-video.html';link.href=target.pathname+target.search+target.hash;}}catch{}
 });
 document.querySelectorAll('.bc-submenu-toggle').forEach(toggle=>{
   const submenu=document.getElementById(toggle.getAttribute('aria-controls'));
   if(toggle.dataset.bound)return;toggle.dataset.bound='1';
   toggle.addEventListener('click',()=>{
     const expanded=toggle.getAttribute('aria-expanded')==='true';
     toggle.setAttribute('aria-expanded',String(!expanded));
     if(submenu)submenu.hidden=expanded;
     if(!expanded&&submenu)setTimeout(()=>submenu.scrollIntoView({behavior:'smooth',block:'nearest'}),80);
   });
 });
}

async function initNavbar(){
 initDrawer();
 // Never treat an unavailable Supabase client or a transient network error as a
 // confirmed signed-out state. This avoids redirecting users during SDK startup/outages.
 let user=null,authVerified=false;
 try{
   if(window.sb?.auth?.getUser){
     const {data,error}=await window.sb.auth.getUser();
     if(!error){user=data?.user||null;authVerified=true;}
     else console.warn('Auth check unavailable; navigation guard skipped:',error.message);
   }
 }catch(e){console.warn('Auth check unavailable; navigation guard skipped:',e);}

 const guest=document.getElementById('navGuest'),member=document.getElementById('navMember');
 if(guest)guest.hidden=!!user;
 if(member)member.hidden=!user;
 // Admin entry is visible only after Supabase confirms profiles.role === 'admin'.
 // A failed profile lookup fails closed: ordinary members never see admin navigation.
 const adminLink=document.getElementById('navAdmin');
 if(adminLink)adminLink.hidden=true;
 if(user&&window.sb?.from){
   try{
     const {data:profile,error:profileError}=await window.sb.from('profiles').select('role,is_banned').eq('id',user.id).maybeSingle();
     if(!profileError&&profile?.role==='admin'&&!profile?.is_banned&&adminLink)adminLink.hidden=false;
   }catch(e){console.warn('Admin navigation check failed; admin link remains hidden:',e);}
 }
 if(user&&window.sb?.from){
   try{await window.sb.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',user.id);}catch(e){console.warn('Last-seen update skipped:',e);}
   try{await window.sb.rpc('notify_expired_vip_once');}catch(e){/* migration may not be installed yet */}
   await initMemberNavExtras(user);
 }
 if(user){
   document.getElementById('navLogout')?.addEventListener('click',async()=>{
     try{await window.sb.auth.signOut();}finally{location.replace('/index.html');}
   });
 }

 // Route-level guard only runs after Supabase positively confirms there is no user.
 // Login/register/reset and public VIP pages must remain accessible to guests.
 if(authVerified&&!user&&!isPublicRoute()){
   const current=location.pathname+location.search;
   const safeCurrent=current.startsWith('/')&&!current.startsWith('//')&&!/^\/(login|register|forgot-password)(\.html)?([/?]|$)/i.test(current);
   const next=safeCurrent?current:'/dashboard.html';
   location.replace('/login.html?next='+encodeURIComponent(next));
   return;
 }

 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 await initNavCategoryMenus();
}
document.addEventListener('DOMContentLoaded',async()=>{
 const sharedRef=(new URLSearchParams(location.search).get('ref')||'').trim().toUpperCase();
 if(/^[A-Z0-9]{6,16}$/.test(sharedRef))localStorage.setItem('boxcellink_affiliate_code',sharedRef);
 // Load Support immediately; it no longer depends on navbar/footer network fetches.
 if(!document.getElementById('bcSupportWidgetScript')&&!window.__boxcellinkSupportLoaded){const supportScript=document.createElement('script');supportScript.id='bcSupportWidgetScript';supportScript.src='/js/support-widget.js';supportScript.async=false;supportScript.onerror=()=>console.error('Support widget failed to load:',supportScript.src);document.body.appendChild(supportScript);}
 await Promise.all([load('[data-component="navbar"]','/components/navbar.html?v=20261114-4'),load('[data-component="footer"]','/components/footer.html')]);
 initTranslate();const y=document.getElementById('footerYear');if(y)y.textContent=new Date().getFullYear();const ca=document.getElementById('cookieAccept'),cn=document.getElementById('cookieNotice');if(ca)ca.onclick=()=>{localStorage.setItem('boxcellink_cookie_ok','1');cn?.classList.add('is-hidden')};if(localStorage.getItem('boxcellink_cookie_ok')==='1')cn?.classList.add('is-hidden');applyLocal();
 if(isAuthRoute()){const guest=document.getElementById('navGuest'),member=document.getElementById('navMember');if(guest)guest.hidden=false;if(member)member.hidden=true;initDrawer();await initNavCategoryMenus();}else{await initNavbar();}await loadCustomNavItems();
});
})();