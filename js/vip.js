(()=>{
'use strict';
const $=id=>document.getElementById(id);
const statusBox=$('vipStatus'),plansBox=$('vipPlans');
const lang=()=>localStorage.getItem('boxcellink_lang')==='en'?'en':'id';
const text={
 id:{
  loading:'Memeriksa status membership…',loadingPlans:'Memuat paket VIP…',active:'VIP AKTIF',basic:'AKUN BASIC',signIn:'Login diperlukan',
  until:'Berlaku sampai',since:'Aktif sejak',expired:'Membership VIP telah berakhir',choose:'Pilih paket untuk mengaktifkan keuntungan VIP.',
  loginFirst:'Login terlebih dahulu untuk membeli paket VIP.',plansError:'Paket VIP tidak dapat dimuat.',noPlans:'Belum ada paket VIP yang tersedia.',
  planTag:'VIP MEMBERSHIP',days:'hari masa aktif',vipContent:'Konten khusus VIP',discount:'Diskon 20% konten berbayar yang memenuhi syarat',manage:'Kelola masa aktif di halaman Akun Saya',
  buy:'Beli paket ini',processing:'Membuat pembayaran…',checkoutError:'Gagal membuat pembayaran',successTitle:'Selamat! VIP berhasil diaktifkan',successText:'Upgrade account berhasil ke VIP! Nikmati semua video tanpa iklan dan diskon 20% untuk pembelian media Telegram yang memenuhi syarat.',expiredTitle:'Masa pembayaran berakhir',expiredText:'Pembayaran belum berhasil. Kamu bisa mencoba membeli paket kembali.',
  pending:'Pembayaran sedang diverifikasi…',checking:'Memeriksa pembayaran…',activeLabel:'STATUS MEMBERSHIP',startLabel:'WAKTU AKTIF',endLabel:'WAKTU EXPIRED',
  daysLeft:'Sisa masa aktif',daysLeftUnit:'hari',account:'Akun',checkout:'Lanjutkan pembayaran',genericError:'Terjadi kesalahan. Silakan coba lagi.'
 },
 en:{
  loading:'Checking membership status…',loadingPlans:'Loading VIP plans…',active:'VIP ACTIVE',basic:'BASIC ACCOUNT',signIn:'Sign-in required',
  until:'Expires on',since:'Active since',expired:'Your VIP membership has expired',choose:'Choose a plan to activate VIP benefits.',
  loginFirst:'Please sign in before purchasing a VIP plan.',plansError:'Unable to load VIP plans.',noPlans:'No VIP plans are currently available.',
  planTag:'VIP MEMBERSHIP',days:'days of access',vipContent:'VIP-only content',discount:'20% off eligible paid content',manage:'Manage membership in My Account',
  buy:'Buy this plan',processing:'Creating payment…',checkoutError:'Unable to create payment',successTitle:'Congratulations! VIP is now active',successText:'Your payment has been verified. Your account is now a VIP member.',expiredTitle:'Payment expired',expiredText:'The payment was not completed. You can try purchasing a plan again.',
  pending:'Payment is being verified…',checking:'Checking payment…',activeLabel:'MEMBERSHIP STATUS',startLabel:'ACTIVATED AT',endLabel:'EXPIRES AT',
  daysLeft:'Time remaining',daysLeftUnit:'days',account:'Account',checkout:'Continue to payment',genericError:'Something went wrong. Please try again.'
 }
};
const t=k=>text[lang()][k]||text.id[k]||k;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
const date=v=>v?new Intl.DateTimeFormat(lang()==='en'?'en-US':'id-ID',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v)):'—';
let currentUser=null,pollToken=0,vipCoupons=[];
function notice(title,message,type='success'){
 const box=$('vipNotice');if(!box)return;
 box.hidden=false;box.className='vip-notice '+(type==='error'?'is-error':'is-success');
 $('vipNoticeTitle').textContent=title;$('vipNoticeText').textContent=message;
}
function hideNotice(){const box=$('vipNotice');if(box)box.hidden=true;}
$('vipNoticeClose')?.addEventListener('click',hideNotice);
function renderStatus(profile){
 const now=new Date(),expires=profile?.vip_expires_at?new Date(profile.vip_expires_at):null;
 const active=!!(expires&&expires>now);
 const started=profile?.vip_started_at?new Date(profile.vip_started_at):null;
 if(!currentUser){
  statusBox.innerHTML=`<span class="vip-status-kicker">${safe(t('activeLabel'))}</span><b><i class="fa-solid fa-lock"></i> ${safe(t('signIn'))}</b><span>${safe(t('loginFirst'))}</span><a class="vip-status-link" href="/login.html?next=%2Fvip.html">${safe(lang()==='en'?'Sign in':'Masuk')}</a>`;
  return;
 }
 if(active){
  const remaining=Math.max(0,Math.ceil((expires-now)/86400000));
  statusBox.innerHTML=`<span class="vip-status-kicker">${safe(t('activeLabel'))}</span><b class="vip-active-title"><i class="fa-solid fa-circle-check"></i> ${safe(t('active'))}</b>
   <div class="vip-timeline">
    <div><span>${safe(t('startLabel'))}</span><strong>${safe(date(started||profile.vip_expires_at))}</strong></div>
    <div><span>${safe(t('endLabel'))}</span><strong>${safe(date(profile.vip_expires_at))}</strong></div>
   </div><span class="vip-remaining"><i class="fa-regular fa-clock"></i> ${safe(t('daysLeft'))}: <b>${remaining} ${safe(t('daysLeftUnit'))}</b></span>`;
 }else{
  statusBox.innerHTML=`<span class="vip-status-kicker">${safe(t('activeLabel'))}</span><b><i class="fa-regular fa-user"></i> ${safe(t('basic'))}</b><span>${safe(expires?t('expired'):t('choose'))}</span>`;
 }
}
async function loadProfile(){
 if(!currentUser)return null;
 let result=await sb.from('profiles').select('vip_started_at,vip_expires_at').eq('id',currentUser.id).maybeSingle();
 if(result.error && (result.error.code==='42703'||/vip_started_at/i.test(result.error.message||''))){
  result=await sb.from('profiles').select('vip_expires_at').eq('id',currentUser.id).maybeSingle();
 }
 if(result.error)throw result.error;
 const profile=result.data||{};
 if(!profile.vip_started_at && profile.vip_expires_at){
  const {data:orders}=await sb.from('cashi_orders').select('settled_at,created_at').eq('user_id',currentUser.id).eq('purpose','vip').eq('status','SETTLED').order('settled_at',{ascending:false}).limit(1);
  profile.vip_started_at=orders?.[0]?.settled_at||orders?.[0]?.created_at||null;
 }
 return profile;
}
async function refreshMembership(){
 const profile=await loadProfile();renderStatus(profile);return profile;
}
function renderPlans(plans){
 const en=lang()==='en';
 plansBox.innerHTML=(plans||[]).map(v=>{const gold=/premium|gold|emas/i.test(String(v.name||''));return `<article class="plan-card premium-plan ${gold?'is-gold':''}">
  <span class="plan-tag"><i class="fa-solid ${gold?'fa-crown':'fa-sparkles'}"></i> ${gold?'GOLD MEMBER':safe(t('planTag'))}</span>
  <div class="premium-plan-icon"><i class="fa-solid fa-crown"></i></div>
  <h3>${safe(v.name)}</h3>
  <div class="plan-price">${safe(money(v.price))}</div>
  <p class="plan-duration"><i class="fa-regular fa-calendar"></i> ${Number(v.duration_days)||0} ${safe(t('days'))}</p>
  <ul><li><i class="fa-solid fa-check"></i> ${safe(t('vipContent'))}</li><li><i class="fa-solid fa-check"></i> ${safe(t('discount'))}</li><li><i class="fa-solid fa-check"></i> ${safe(t('manage'))}</li></ul>
  <label class="vip-coupon-field" style="display:grid;gap:6px;margin:12px 0;font-size:12px;font-weight:700">Kode diskon yang sudah di-claim<select data-vip-coupon="${safe(v.id)}" style="padding:10px;border:1px solid #dbe4ef;border-radius:10px;background:#fff"><option value="">Tanpa kode diskon</option>${vipCoupons.filter(c=>['all','vip_account'].includes(c.scope||'all')).map(c=>`<option value="${safe(c.code)}">${safe(c.code)} · ${Number(c.discount_percent)}%</option>`).join('')}</select></label><button class="btn primary vip-buy-button" type="button" data-buy-plan="${safe(v.id)}"><i class="fa-solid fa-lock"></i> ${safe(t('buy'))}</button>
 </article>`}).join('')||`<div class="empty-state">${safe(t('noPlans'))}</div>`;
 plansBox.querySelectorAll('[data-buy-plan]').forEach(button=>button.addEventListener('click',()=>buyVip(button.dataset.buyPlan,button)));
}
async function loadPlans(){
 if(currentUser){const {data}=await sb.from('admin_discount_claims').select('used_at,admin_discount_codes(code,scope,discount_percent,expires_at)').eq('user_id',currentUser.id);vipCoupons=(data||[]).filter(x=>!x.used_at&&x.admin_discount_codes&&(!x.admin_discount_codes.expires_at||new Date(x.admin_discount_codes.expires_at)>new Date())).map(x=>x.admin_discount_codes)}
 plansBox.innerHTML=`<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i> ${safe(t('loadingPlans'))}</div>`;
 const {data,error}=await sb.from('vip_plans').select('id,name,duration_days,price').eq('status','published').order('price');
 if(error)throw error;renderPlans(data||[]);
}
async function buyVip(id,button){
 if(!currentUser){notice(t('signIn'),t('loginFirst'),'error');return}
 const old=button?.innerHTML;if(button){button.disabled=true;button.innerHTML=`<i class="fa-solid fa-circle-notch fa-spin"></i> ${safe(t('processing'))}`}
 try{
  const coupon=document.querySelector(`[data-vip-coupon="${CSS.escape(String(id))}"]`)?.value||'';
  const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'vip',plan_id:id,coupon_code:coupon||undefined}});
  if(error)throw error;if(!data?.checkout_url||!data?.order_id)throw new Error(data?.error||t('checkoutError'));
  const plan=(window.__vipPlans||[]).find(x=>String(x.id)===String(id));
  localStorage.setItem('boxcellink_pending_vip',JSON.stringify({order_id:data.order_id,user_id:currentUser.id,plan_name:plan?.name||'',amount:data.amount,qr_url:data.qrUrl||null,checkout_url:data.checkout_url||null,expires_at:data.expires_at||null,created_at:new Date().toISOString()}));
  location.href='/vip-checkout.html?order_id='+encodeURIComponent(data.order_id);
 }catch(error){
  notice(t('checkoutError'),error?.message||t('genericError'),'error');
  if(button){button.disabled=false;button.innerHTML=old||safe(t('buy'));}
 }
}
async function verifyPendingPayment(orderId){
 const myToken=++pollToken,started=Date.now();
 const check=async()=>{
  if(myToken!==pollToken||!currentUser)return;
  try{
   const {data,error}=await sb.functions.invoke('payment-status',{body:{order_id:orderId}});
   if(error)throw error;
   const state=String(data?.status||'').toUpperCase();
   if(state==='SETTLED'){
    localStorage.removeItem('boxcellink_pending_vip');
    await new Promise(resolve=>setTimeout(resolve,450));
    await refreshMembership();
    notice(t('successTitle'),t('successText'),'success');
    $('vipStatus')?.scrollIntoView({behavior:'smooth',block:'center'});
    return;
   }
   if(['FAILED','EXPIRED','CANCELLED','CANCELED'].includes(state)){
    localStorage.removeItem('boxcellink_pending_vip');notice(t('expiredTitle'),t('expiredText'),'error');return;
   }
  }catch(error){console.warn('VIP payment status check:',error?.message||error)}
  if(Date.now()-started<8*60*1000){window.setTimeout(check,4000)}
  else notice(t('pending'),lang()==='en'?'Payment is not confirmed yet. Refresh this page in a moment.':'Pembayaran belum terkonfirmasi. Muat ulang halaman beberapa saat lagi.','error');
 };
 check();
}
async function init(){
 if(!window.sb?.auth){statusBox.textContent=t('genericError');return}
 try{
  statusBox.innerHTML=`<span class="vip-status-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> ${safe(t('loading'))}</span>`;
  const {data:{user},error}=await sb.auth.getUser();if(error)throw error;currentUser=user||null;
  await refreshMembership();
  if(currentUser){const {data:claims,error:claimError}=await sb.from('admin_discount_claims').select('used_at,admin_discount_codes(code,scope,discount_percent,expires_at)').eq('user_id',currentUser.id);if(claimError)console.warn('VIP discount list:',claimError.message);vipCoupons=(claims||[]).filter(x=>!x.used_at&&x.admin_discount_codes&&(!x.admin_discount_codes.expires_at||new Date(x.admin_discount_codes.expires_at)>new Date())).map(x=>x.admin_discount_codes)}
  const {data:plans,error:planError}=await sb.from('vip_plans').select('id,name,duration_days,price').eq('status','published').order('price');
  if(planError)throw planError;
  window.__vipPlans=plans||[];renderPlans(window.__vipPlans);
  if(currentUser){
   const params=new URLSearchParams(location.search);
   const queryOrder=params.get('order_id')||params.get('orderId');
   let pending=null;try{pending=JSON.parse(localStorage.getItem('boxcellink_pending_vip')||'null')}catch{}
   if(queryOrder&&(!pending||pending.order_id!==queryOrder)){
    pending={order_id:queryOrder,user_id:currentUser.id};localStorage.setItem('boxcellink_pending_vip',JSON.stringify(pending));
   }
   if(pending?.order_id&&pending.user_id===currentUser.id)verifyPendingPayment(pending.order_id);
   // A webhook may have completed while the browser was away. Check recent settled VIP
   // orders and notify only once for the matching pending checkout.
  }
 }catch(error){
  console.error('VIP page initialization failed:',error);
  statusBox.innerHTML=`<b>${safe(t('genericError'))}</b><span>${safe(error?.message||'')}</span>`;
  plansBox.innerHTML=`<div class="empty-state error-state">${safe(t('plansError'))} ${safe(error?.message||'')}</div>`;
 }
}
init();
})();