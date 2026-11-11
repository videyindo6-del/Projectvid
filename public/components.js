(() => {
const translations={id:{admin:'Panel Admin',dashboard:'Dashboard',account:'Akun Saya',box:'BoxVidey',telegram:'Media Telegram',review:'Review & Download',vip:'VIP',groups:'Group VIP Telegram',discount:'Kode Diskon Saya',referral:'Referral & Hadiah',categories:'Kategori',payments:'Pembayaran',login:'Masuk',register:'Daftar',logout:'Keluar',terms:'Syarat & ketentuan',privacy:'Kebijakan Dan Privasi',help:'Bantuan',cookies:'Kami menggunakan cookie untuk pengalaman yang lebih baik.',accept:'Setujui'},en:{admin:'Admin Panel',dashboard:'Dashboard',account:'My Account',box:'BoxVidey',telegram:'Telegram Media',review:'Review & Download',vip:'VIP',groups:'VIP Telegram Groups',discount:'My Discount Codes',referral:'Referral & Rewards',categories:'Categories',payments:'Payments',login:'Sign in',register:'Sign up',logout:'Sign out',terms:'Terms & Conditions',privacy:'Privacy Policy',help:'Help',cookies:'We use cookies for a better experience.',accept:'Accept'}};
const getLang=()=>localStorage.getItem('boxcellink_lang')||'id';
function applyLocal(l=getLang()){const d=translations[l]||translations.id;document.documentElement.lang=l;document.querySelectorAll('[data-nav]').forEach(e=>{if(d[e.dataset.nav])e.textContent=d[e.dataset.nav]});document.querySelectorAll('[data-footer]').forEach(e=>{if(d[e.dataset.footer])e.textContent=d[e.dataset.footer]});const b=document.getElementById('translateLabel');if(b)b.textContent=l==='id'?'ID':'ENG';}
async function load(selector,url){const el=document.querySelector(selector);if(!el)return;try{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);el.innerHTML=await r.text();}catch(e){console.error('Component load failed',url,e);el.innerHTML='';}}
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
     const {data:cats,error}=await window.sb.from('categories').select('id,name').eq('status','published').order('name');
     if(!error){
       document.querySelectorAll('.bc-submenu[id^="boxCategorySubmenu"]').forEach(target=>{
         target.innerHTML='<a href="/index.html">Semua BoxVidey</a>'+(cats||[]).map(c=>`<a href="/index.html?category=${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join('')||'<span class="submenu-loading">Belum ada kategori aktif</span>';
       });
     }
   }catch(e){console.warn('BoxVidey categories unavailable:',e);}
 }
 document.querySelectorAll('.bc-submenu-toggle[id^="boxMenuToggle"]').forEach(boxToggle=>{
   const boxSub=document.getElementById(boxToggle.getAttribute('aria-controls'));
   boxToggle.addEventListener('click',()=>{
     const expanded=boxToggle.getAttribute('aria-expanded')==='true';
     boxToggle.setAttribute('aria-expanded',String(!expanded));
     if(boxSub)boxSub.hidden=expanded;
   });
 });
}
document.addEventListener('DOMContentLoaded',async()=>{await Promise.all([load('[data-component="navbar"]','/components/navbar.html'),load('[data-component="footer"]','/components/footer.html')]);initTranslate();const y=document.getElementById('footerYear');if(y)y.textContent=new Date().getFullYear();const ca=document.getElementById('cookieAccept'),cn=document.getElementById('cookieNotice');if(ca)ca.onclick=()=>{localStorage.setItem('boxcellink_cookie_ok','1');cn?.classList.add('is-hidden')};if(localStorage.getItem('boxcellink_cookie_ok')==='1')cn?.classList.add('is-hidden');applyLocal();const supportScript=document.createElement('script');supportScript.src='/js/support-widget.js';supportScript.defer=true;document.body.appendChild(supportScript);if(isAuthRoute()){const guest=document.getElementById('navGuest'),member=document.getElementById('navMember');if(guest)guest.hidden=false;if(member)member.hidden=true;initDrawer();}else{await initNavbar();}});
})();