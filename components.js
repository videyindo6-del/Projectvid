(() => {
const translations={id:{dashboard:'Dashboard',account:'Akun Saya',box:'BoxVidey',telegram:'Media Telegram',review:'Review & Download',vip:'VIP',groups:'Group VIP Telegram',discount:'Kode Diskon Saya',referral:'Referral & Hadiah',categories:'Kategori',payments:'Pembayaran',login:'Masuk',register:'Daftar',logout:'Keluar',terms:'Syarat & ketentuan',privacy:'Kebijakan Dan Privasi',help:'Bantuan',cookies:'Kami menggunakan cookie untuk pengalaman yang lebih baik.',accept:'Setujui'},en:{dashboard:'Dashboard',account:'Akun Saya',box:'BoxVidey',telegram:'Telegram Media',review:'Review & Download',vip:'VIP',groups:'VIP Telegram Groups',discount:'My Discount Codes',referral:'Referral & Rewards',categories:'Categories',payments:'Payments',login:'Sign in',register:'Sign up',logout:'Sign out',terms:'Terms & Conditions',privacy:'Privacy Policy',help:'Help',cookies:'We use cookies for a better experience.',accept:'Accept'}};
const getLang=()=>localStorage.getItem('boxcellink_lang')||'id';
function applyLocal(l=getLang()){const d=translations[l]||translations.id;document.documentElement.lang=l;document.querySelectorAll('[data-nav]').forEach(e=>{if(d[e.dataset.nav])e.textContent=d[e.dataset.nav]});document.querySelectorAll('[data-footer]').forEach(e=>{if(d[e.dataset.footer])e.textContent=d[e.dataset.footer]});const b=document.getElementById('translateLabel');if(b)b.textContent=l==='id'?'ID':'EN';}
async function load(selector,url){const el=document.querySelector(selector);if(!el)return;try{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);el.innerHTML=await r.text();}catch(e){console.error('Component load failed',url,e);el.innerHTML='';}}
function setGoogleLanguage(lang){localStorage.setItem('boxcellink_lang',lang);applyLocal(lang);document.cookie=`googtrans=/id/${lang};path=/`;document.cookie=`googtrans=/id/${lang};path=/;SameSite=Lax`;const apply=()=>{const combo=document.querySelector('.goog-te-combo');if(combo){combo.value=lang;combo.dispatchEvent(new Event('change'));return true;}return false;};if(apply())return;if(!window.googleTranslateLoading){window.googleTranslateLoading=true;window.googleTranslateElementInit=()=>{new google.translate.TranslateElement({pageLanguage:'id',includedLanguages:'id,en',autoDisplay:false,layout:google.translate.TranslateElement.InlineLayout.SIMPLE},'google_translate_element');let n=0;const timer=setInterval(()=>{if(apply()||++n>30)clearInterval(timer);},250);};const s=document.createElement('script');s.src='https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';s.async=true;s.onerror=()=>{window.googleTranslateLoading=false;};document.head.appendChild(s);}}
function initTranslate(){const btn=document.getElementById('translateBtn');if(!btn)return;btn.addEventListener('click',()=>setGoogleLanguage(getLang()==='id'?'en':'id'));applyLocal();if(getLang()==='en')setGoogleLanguage('en');}
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
    'index','login','register','forgot-password','watch','review','review-detail'
  ]);
  return publicPages.has(page)||path.startsWith('/v/')||path.startsWith('/r/');
}
async function initNavbar(){const drawer=document.getElementById('navDrawer'),shade=document.getElementById('navShade'),open=document.getElementById('navOpen');const toggle=v=>{drawer?.classList.toggle('open',v);shade?.classList.toggle('show',v);open?.setAttribute('aria-expanded',String(v));};open?.addEventListener('click',()=>toggle(true));document.getElementById('navClose')?.addEventListener('click',()=>toggle(false));shade?.addEventListener('click',()=>toggle(false));document.addEventListener('keydown',e=>{if(e.key==='Escape')toggle(false)});
let user=null;try{if(window.sb){const {data}=await sb.auth.getUser();user=data?.user||null;}}catch(e){console.warn('Auth check failed',e)}
const guest=document.getElementById('navGuest'),member=document.getElementById('navMember');if(guest)guest.hidden=!!user;if(member)member.hidden=!user;
if(user){document.getElementById('navLogout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.href='/index.html';});}
// Public access: homepage, authentication, video watch and Telegram review pages. Other pages require login.
if(!user&&!isPublicRoute()){const current=location.pathname+location.search;const next=current.startsWith('/')&&!current.startsWith('//')&&!/^\/(login|register|forgot-password)(\.html)?([/?]|$)/i.test(current)?current:'/dashboard.html';location.replace('/login.html?next='+encodeURIComponent(next));return;}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(user&&window.sb){try{const {data:cats,error}=await sb.from('categories').select('id,name').eq('status','published').order('name');if(!error){const target=document.getElementById('memberCategoryLinks');if(target)target.innerHTML=(cats||[]).map(c=>`<a href="/index.html?category=${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join('');}}catch(e){console.warn(e)}}
}
document.addEventListener('DOMContentLoaded',async()=>{await Promise.all([load('[data-component="navbar"]','/components/navbar.html'),load('[data-component="footer"]','/components/footer.html')]);const y=document.getElementById('footerYear');if(y)y.textContent=new Date().getFullYear();const ca=document.getElementById('cookieAccept'),cn=document.getElementById('cookieNotice');if(ca)ca.onclick=()=>{localStorage.setItem('boxcellink_cookie_ok','1');cn?.classList.add('is-hidden')};if(localStorage.getItem('boxcellink_cookie_ok')==='1')cn?.classList.add('is-hidden');if(isAuthRoute()){const guest=document.getElementById('navGuest'),member=document.getElementById('navMember');if(guest)guest.hidden=false;if(member)member.hidden=true;}else{await initNavbar();}initTranslate();});
})();