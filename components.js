(() => {
const translations={id:{admin:'Panel Admin',dashboard:'Dashboard',account:'Akun Saya',box:'BoxVidey',telegram:'Media Telegram',review:'Review & Download',vip:'VIP',groups:'Group VIP Telegram',discount:'Kode Diskon Saya',referral:'Referral & Hadiah',notifications:'Notifikasi',wallet:'Saldo & Afiliasi',categories:'Kategori',payments:'Pembayaran',login:'Masuk',register:'Daftar',logout:'Keluar',terms:'Syarat & ketentuan',privacy:'Kebijakan Dan Privasi',help:'Bantuan',cookies:'Kami menggunakan cookie untuk pengalaman yang lebih baik.',accept:'Setujui'},en:{admin:'Admin Panel',dashboard:'Dashboard',account:'My Account',box:'BoxVidey',telegram:'Telegram Media',review:'Review & Download',vip:'VIP',groups:'VIP Telegram Groups',discount:'My Discount Codes',referral:'Referral & Rewards',notifications:'Notifications',wallet:'Wallet & Affiliate',categories:'Categories',payments:'Payments',login:'Sign in',register:'Sign up',logout:'Sign out',terms:'Terms & Conditions',privacy:'Privacy Policy',help:'Help',cookies:'We use cookies for a better experience.',accept:'Accept'}};
const getLang=()=>localStorage.getItem('boxcellink_lang')||'id';
function applyLocal(l=getLang()){const d=translations[l]||translations.id;document.documentElement.lang=l;document.querySelectorAll('[data-nav]').forEach(e=>{if(d[e.dataset.nav])e.textContent=d[e.dataset.nav]});document.querySelectorAll('[data-footer]').forEach(e=>{if(d[e.dataset.footer])e.textContent=d[e.dataset.footer]});const b=document.getElementById('translateLabel');if(b)b.textContent=l==='id'?'ID':'ENG';}
async function load(selector,url){const el=document.querySelector(selector);if(!el)return;try{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);el.innerHTML=await r.text();}catch(e){console.error('Component load failed',url,e);if(selector.includes('footer'))el.innerHTML='<footer class="bc-footer"><div class="bc-footer-inner"><div>© <span id="footerYear"></span> Boxcellink. All rights reserved.</div><nav><a href="/terms.html">Syarat & ketentuan</a><a href="/privacy.html">Kebijakan Dan Privasi</a><a href="/help.html">Bantuan</a></nav></div></footer>';else if(selector.includes('navbar'))el.innerHTML='<header class="bc-navbar"><div class="bc-nav-inner"><a class="bc-brand" href="/index.html">BoxCellink</a><div class="bc-nav-actions"><button id="translateBtn" class="bc-nav-btn" type="button"><span id="translateLabel">ID</span></button></div></div></header>';}}
function setGoogleLanguage(lang){localStorage.setItem('boxcellink_lang',lang);applyLocal(lang);document.dispatchEvent(new CustomEvent('boxcellink:language-change',{detail:{lang}}));}
function initTranslate(){const btn=document.getElementById('translateBtn');if(!btn)return;if(!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',()=>setGoogleLanguage(getLang()==='id'?'en':'id'));}applyLocal();}
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
    'index','login','register','forgot-password','watch','review','review-detail','telegram','vip','vip-groups'
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

async function initMemberNavExtras(user){
 const wallet=document.getElementById('navWallet'),notifyWrap=document.getElementById('navNotificationWrap');
 const money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
 const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 if(wallet){
  try{
   const {data:p,error}=await window.sb.from('profiles').select('deposit_balance,affiliate_balance').eq('id',user.id).maybeSingle();
   if(!error&&p){document.getElementById('navDepositBalance').textContent=money(p.deposit_balance);document.getElementById('navAffiliateBalance').textContent=money(p.affiliate_balance);wallet.hidden=false;}
  }catch(e){console.warn('Wallet summary unavailable:',e);}
 }
 if(!notifyWrap)return;
 notifyWrap.hidden=false;
 const dropdown=document.getElementById('navNotificationDropdown'),button=document.getElementById('navNotificationBtn'),items=document.getElementById('navNotificationItems'),badge=document.getElementById('navNotificationCount');
 const refresh=async()=>{
  try{
   const {data,error}=await window.sb.from('boxcellink_notifications').select('id,title,body,href,is_read,created_at').order('created_at',{ascending:false}).limit(20);
   if(error)throw error;
   const rows=data||[],unread=rows.filter(x=>!x.is_read).length;
   badge.textContent=unread>99?'99+':String(unread);badge.hidden=!unread;
   items.innerHTML=rows.slice(0,6).map(n=>`<a class="bc-notification-item ${n.is_read?'':'unread'}" href="${escapeHtml((n.href||'/notifications.html').startsWith('/')?n.href:'/notifications.html')}" data-notification-id="${escapeHtml(n.id)}"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.body)}</span><small>${new Date(n.created_at).toLocaleString('id-ID')}</small></a>`).join('')||'<p class="bc-notification-empty">Belum ada notifikasi.</p>';
   items.querySelectorAll('[data-notification-id]').forEach(a=>a.addEventListener('click',async()=>{const id=a.dataset.notificationId;await window.sb.from('boxcellink_notifications').update({is_read:true}).eq('id',id);}));
  }catch(e){items.innerHTML='<p class="bc-notification-empty">Notifikasi belum tersedia.</p>';console.warn('Notification dropdown unavailable:',e);}
 };
 await refresh();
 if(button&&!button.dataset.bound){button.dataset.bound='1';button.addEventListener('click',()=>{dropdown.hidden=!dropdown.hidden;if(!dropdown.hidden)refresh()});document.addEventListener('click',e=>{if(!e.target.closest('#navNotificationWrap'))dropdown.hidden=true});}
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
 // BoxVidey categories are nested under one compact accordion, not a separate
 // top-level navigation destination. Public categories are safe for guests too.
 if(window.sb?.from){
   try{
     const [{data:cats,error:catError},{data:reviews,error:reviewError},{data:videos,error:videoError}]=await Promise.all([
       window.sb.from('categories').select('id,name,content_type').eq('status','published').order('name'),
       window.sb.from('review_items').select('category_id').eq('status','published'),
       window.sb.from('videos').select('category_id').eq('status','published')
     ]);
     if(!catError){
       const counts=(rows)=>{const m=new Map();(rows||[]).forEach(r=>{if(r.category_id)m.set(r.category_id,(m.get(r.category_id)||0)+1)});return m};
       const reviewCounts=counts(reviewError?[]:reviews),videoCounts=counts(videoError?[]:videos);
       document.querySelectorAll('.bc-submenu[id^="boxCategorySubmenu"]').forEach(target=>{
         target.innerHTML='<a href="/index.html#boxvideySection">Semua Box Video</a>'+(cats||[]).filter(c=>!c.content_type||c.content_type==='box_video').map(c=>`<a href="/index.html?category=${encodeURIComponent(c.id)}">${esc(c.name)} <small>(${videoCounts.get(c.id)||0})</small></a>`).join('')||'<span class="submenu-loading">Belum ada kategori aktif</span>';
       });
       document.querySelectorAll('.bc-submenu[id^="telegramCategorySubmenu"]').forEach(target=>{
         target.innerHTML='<a href="/telegram.html">Semua Media Telegram</a>'+(cats||[]).filter(c=>c.content_type==='media_telegram').map(c=>`<a href="/telegram.html?category=${encodeURIComponent(c.id)}">${esc(c.name)} <small>(${reviewCounts.get(c.id)||0})</small></a>`).join('')||'<span class="submenu-loading">Belum ada kategori aktif</span>';
       });
     }
   }catch(e){console.warn('Navigation categories unavailable:',e);}
 }
 document.querySelectorAll('.bc-submenu-toggle').forEach(toggle=>{
   const submenu=document.getElementById(toggle.getAttribute('aria-controls'));
   if(toggle.dataset.bound)return;toggle.dataset.bound='1';
   toggle.addEventListener('click',()=>{
     const expanded=toggle.getAttribute('aria-expanded')==='true';
     toggle.setAttribute('aria-expanded',String(!expanded));
     if(submenu)submenu.hidden=expanded;
   });
 });
}
document.addEventListener('DOMContentLoaded',async()=>{
 const sharedRef=(new URLSearchParams(location.search).get('ref')||'').trim().toUpperCase();
 if(/^[A-Z0-9]{6,16}$/.test(sharedRef))localStorage.setItem('boxcellink_affiliate_code',sharedRef);
 // Load Support immediately; it no longer depends on navbar/footer network fetches.
 if(!document.getElementById('bcSupportWidgetScript')&&!window.__boxcellinkSupportLoaded){const supportScript=document.createElement('script');supportScript.id='bcSupportWidgetScript';supportScript.src='/js/support-widget.js';supportScript.async=false;supportScript.onerror=()=>console.error('Support widget failed to load:',supportScript.src);document.body.appendChild(supportScript);}
 await Promise.all([load('[data-component="navbar"]','/components/navbar.html'),load('[data-component="footer"]','/components/footer.html')]);
 initTranslate();const y=document.getElementById('footerYear');if(y)y.textContent=new Date().getFullYear();const ca=document.getElementById('cookieAccept'),cn=document.getElementById('cookieNotice');if(ca)ca.onclick=()=>{localStorage.setItem('boxcellink_cookie_ok','1');cn?.classList.add('is-hidden')};if(localStorage.getItem('boxcellink_cookie_ok')==='1')cn?.classList.add('is-hidden');applyLocal();
 if(isAuthRoute()){const guest=document.getElementById('navGuest'),member=document.getElementById('navMember');if(guest)guest.hidden=false;if(member)member.hidden=true;initDrawer();}else{await initNavbar();}
});
})();