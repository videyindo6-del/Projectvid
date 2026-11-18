(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
const orderKey='al_direct_order_'+code,guestKey='al_direct_guest_'+code;
let order=sessionStorage.getItem(orderKey)||null;
let guestToken=sessionStorage.getItem(guestKey)||null;
let currentUser=null,profile=null;
const message=(s,e=false)=>{$('alPaymentMessage').innerHTML=`<div class="al-alert ${e?'error':''}">${s}</div>`;};
const money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
const authHeaders=async()=>{const {data:{session}}=await sb.auth.getSession();return session?.access_token?{authorization:'Bearer '+session.access_token}:{};};
async function init(){
 $('alPaymentInfo').textContent='AutoLink: '+code+' · Harga dasar Rp3.500.';
 const {data:{session}}=await sb.auth.getSession();
 currentUser=session?.user||null;
 if(currentUser){
  const {data}=await sb.from('profiles').select('deposit_balance,affiliate_balance,affiliate_status').eq('id',currentUser.id).maybeSingle();
  profile=data||{};
  $('alMemberPayment').hidden=false;
  $('alWalletInfo').textContent='Saldo deposit: '+money(profile.deposit_balance)+' · Saldo afiliasi: '+money(profile.affiliate_balance);
  const affiliateOption=$('alPaymentMethod').querySelector('option[value="affiliate"]');
  if(profile.affiliate_status!=='approved')affiliateOption.disabled=true;
 }else{
  $('alMemberPayment').hidden=true;
  $('alPaymentInfo').textContent+=' Pembayaran QRIS dapat dilakukan tanpa login.';
 }
 if(order){
  $('alPaymentInfo').textContent+=' · Order ID: '+order;
  $('alCheckPayment').hidden=false;
  $('alCreatePayment').disabled=true;
  $('alCreatePayment').textContent='Pembayaran sudah dibuat';
 }
}
$('alCreatePayment').onclick=async()=>{
 const b=$('alCreatePayment');b.disabled=true;
 try{
  const method=currentUser?$('alPaymentMethod').value:'qris';
  const coupon=currentUser?($('alCouponCode').value||'').trim():'';
  if(method==='deposit'||method==='affiliate'){
   const {data,error}=await sb.rpc('buy_autolink_direct_access_with_wallet',{p_short_code:code,p_wallet_type:method,p_coupon_code:coupon||null});
   if(error)throw error;
   if(!data?.ok){
    const reasons={CANNOT_BUY_OWN_LINK:'Kamu tidak dapat membeli AutoLink milik sendiri.',INSUFFICIENT_DEPOSIT:'Saldo deposit tidak mencukupi.',INSUFFICIENT_AFFILIATE_BALANCE:'Saldo afiliasi tidak mencukupi.',AFFILIATE_NOT_APPROVED:'Saldo afiliasi hanya tersedia untuk akun afiliasi yang disetujui.',LOGIN_REQUIRED:'Silakan login kembali.',AUTOLINK_UNAVAILABLE:'AutoLink tidak tersedia.',MINIMUM_AFTER_DISCOUNT:'Nominal setelah diskon terlalu rendah.'};
    throw Error(reasons[data?.reason]||data?.reason||'Pembayaran saldo gagal.');
   }
   order=data.order_id;sessionStorage.setItem(orderKey,order);
   const headers=await authHeaders();
   const r=await fetch('/api/autolink?action=paid-access',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({order_id:order})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Akses belum dapat dibuka.');
   message('Pembayaran saldo berhasil. Publisher menerima Rp2.000. Mengalihkan ke link asli...');
   setTimeout(()=>location.replace(d.destination),900);
   return;
  }
  const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'autolink_direct_access',short_code:code,coupon_code:coupon||undefined}});
  if(error)throw error;
  if(!data?.success)throw Error(data?.error||'Gagal membuat pembayaran.');
  order=data.order_id;guestToken=data.guest_token||null;
  sessionStorage.setItem(orderKey,order);
  if(guestToken)sessionStorage.setItem(guestKey,guestToken);
  $('alPaymentInfo').textContent='Order ID: '+order+' · Tagihan '+money(data.amount)+(data.discount_percent?' · Diskon '+data.discount_percent+'%':'');
  $('alPaymentCheckout').href=data.checkout_url;$('alPaymentCheckout').hidden=false;
  $('alCheckPayment').hidden=false;
  $('alCreatePayment').textContent='Pembayaran dibuat';
  message('Order berhasil dibuat. Selesaikan pembayaran Cashi QRIS, lalu tekan Periksa Status.');
 }catch(e){message(e.message||'Gagal membuat pembayaran.',true);b.disabled=false;}
};
$('alCheckPayment').onclick=async()=>{
 if(!order)return;
 try{
  const body={order_id:order,...(guestToken?{guest_token:guestToken}:{})};
  const {data,error}=await sb.functions.invoke('payment-status',{body});
  if(error)throw error;
  if(data?.status!=='SETTLED'){message('Pembayaran belum terverifikasi. Silakan periksa kembali setelah membayar.');return;}
  const headers=await authHeaders();
  const r=await fetch('/api/autolink?action=paid-access',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Akses belum tersedia.');
  message('Pembayaran berhasil diverifikasi. Publisher menerima Rp2.000. Mengalihkan ke link asli...');
  setTimeout(()=>location.replace(d.destination),900);
 }catch(e){message(e.message||'Status pembayaran belum tersedia.',true);}
};
$('alPaymentMethod')?.addEventListener('change',()=>{
 const method=$('alPaymentMethod').value;
 $('alCreatePayment').textContent=method==='qris'?'Buat Pembayaran Cashi QRIS · Rp3.500':'Bayar dengan '+(method==='deposit'?'Saldo Deposit':'Saldo Afiliasi');
});
init().catch(e=>message(e.message||'Gagal memuat metode pembayaran.',true));
})();