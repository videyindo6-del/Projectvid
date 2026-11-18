
(()=>{
'use strict';

const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
const orderKey='al_direct_order_'+code;
const guestKey='al_direct_guest_'+code;

let order=sessionStorage.getItem(orderKey)||null;
let guestToken=sessionStorage.getItem(guestKey)||null;
let currentUser=null;
let profile=null;
let busy=false;

const message=(s,e=false)=>{
 const el=$('alPaymentMessage');
 if(el) el.innerHTML=`<div class="al-alert ${e?'error':''}">${s}</div>`;
};

const money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');

const authHeaders=async()=>{
 const {data:{session}}=await sb.auth.getSession();
 return session?.access_token
  ? {authorization:'Bearer '+session.access_token}
  : {};
};

async function invokeFunction(name,options){
 const {data,error}=await sb.functions.invoke(name,options);

 if(error){
  let detail='';

  try{
   const response=error.context;

   if(response&&typeof response.clone==='function'){
    const payload=await response.clone().json();
    detail=payload?.error||payload?.message||'';
   }
  }catch(_){}

  throw new Error(detail||error.message||'Permintaan pembayaran gagal.');
 }

 if(!data) throw new Error('Server tidak memberikan respons.');

 return data;
}

async function paidAccess(body){
 const headers=await authHeaders();

 const response=await fetch('/api/autolink?action=paid-access',{
  method:'POST',
  headers:{
   'content-type':'application/json',
   ...headers
  },
  body:JSON.stringify(body)
 });

 let result={};

 try{
  result=await response.json();
 }catch(_){}

 if(!response.ok){
  throw new Error(result.error||'Akses belum dapat dibuka.');
 }

 if(!result.destination){
  throw new Error('Link tujuan tidak ditemukan.');
 }

 return result;
}

function setCreateButton(text,disabled){
 const button=$('alCreatePayment');
 if(!button)return;
 button.textContent=text;
 button.disabled=disabled;
}

async function init(){
 if(!code){
  throw new Error('Kode AutoLink tidak ditemukan.');
 }

 $('alPaymentInfo').textContent=
  'AutoLink: '+code+' · Harga dasar Rp3.500.';

 const {data:{session},error:sessionError}=await sb.auth.getSession();

 if(sessionError) throw sessionError;

 currentUser=session?.user||null;

 if(currentUser){
  const {data,error}=await sb
   .from('profiles')
   .select('deposit_balance,affiliate_balance,affiliate_status')
   .eq('id',currentUser.id)
   .maybeSingle();

  if(error) throw error;

  profile=data||{};

  $('alMemberPayment').hidden=false;

  $('alWalletInfo').textContent=
   'Saldo deposit: '+money(profile.deposit_balance)+
   ' · Saldo afiliasi: '+money(profile.affiliate_balance);

  const affiliateOption=
   $('alPaymentMethod').querySelector('option[value="affiliate"]');

  if(affiliateOption){
   affiliateOption.disabled=profile.affiliate_status!=='approved';
  }
 }else{
  $('alMemberPayment').hidden=true;

  $('alPaymentInfo').textContent+=
   ' Pembayaran QRIS dapat dilakukan tanpa login.';
 }

 if(order){
  $('alPaymentInfo').textContent+=' · Order ID: '+order;
  $('alCheckPayment').hidden=false;
  setCreateButton('Pembayaran sudah dibuat',true);

  // Tampilkan kembali link checkout hanya jika URL-nya tersimpan.
  const savedCheckout=sessionStorage.getItem('al_direct_checkout_'+code);

  if(savedCheckout){
   $('alPaymentCheckout').href=savedCheckout;
   $('alPaymentCheckout').hidden=false;
  }
 }
}

async function createWalletPayment(method,coupon){
 const {data,error}=await sb.rpc(
  'buy_autolink_direct_access_with_wallet',
  {
   p_short_code:code,
   p_wallet_type:method,
   p_coupon_code:coupon||null
  }
 );

 if(error) throw error;

 if(!data?.ok){
  const reasons={
   CANNOT_BUY_OWN_LINK:'Kamu tidak dapat membeli AutoLink milik sendiri.',
   INSUFFICIENT_DEPOSIT:'Saldo deposit tidak mencukupi.',
   INSUFFICIENT_AFFILIATE_BALANCE:'Saldo afiliasi tidak mencukupi.',
   AFFILIATE_NOT_APPROVED:'Akun afiliasi belum disetujui.',
   LOGIN_REQUIRED:'Silakan login kembali.',
   AUTOLINK_UNAVAILABLE:'AutoLink tidak tersedia.',
   MINIMUM_AFTER_DISCOUNT:'Nominal setelah diskon terlalu rendah.'
  };

  throw new Error(
   reasons[data?.reason]||data?.reason||'Pembayaran saldo gagal.'
  );
 }

 order=data.order_id;
 sessionStorage.setItem(orderKey,order);

 const result=await paidAccess({order_id:order});

 message(
  'Pembayaran saldo berhasil. Publisher menerima Rp2.000. Mengalihkan ke link asli...'
 );

 setTimeout(()=>location.replace(result.destination),900);
}

async function createQrisPayment(coupon){
 const data=await invokeFunction('create-payment',{
  body:{
   purpose:'autolink_direct_access',
   short_code:code,
   coupon_code:coupon||undefined
  }
 });

 if(!data.success){
  throw new Error(data.error||'Gagal membuat pembayaran.');
 }

 if(!data.order_id){
  throw new Error('Order ID tidak diterima dari server.');
 }

 order=data.order_id;
 guestToken=data.guest_token||null;

 sessionStorage.setItem(orderKey,order);

 if(guestToken){
  sessionStorage.setItem(guestKey,guestToken);
 }

 $('alPaymentInfo').textContent=
  'Order ID: '+order+
  ' · Tagihan '+money(data.amount)+
  (data.discount_percent?' · Diskon '+data.discount_percent+'%':'');

 if(data.checkout_url){
  $('alPaymentCheckout').href=data.checkout_url;
  $('alPaymentCheckout').hidden=false;
  sessionStorage.setItem(
   'al_direct_checkout_'+code,
   data.checkout_url
  );
 }

 $('alCheckPayment').hidden=false;
 setCreateButton('Pembayaran dibuat',true);

 message(
  'Order berhasil dibuat. Selesaikan pembayaran Cashi QRIS, lalu tekan Periksa Status.'
 );
}

$('alCreatePayment').onclick=async()=>{
 if(busy||order)return;

 busy=true;
 setCreateButton('Memproses pembayaran...',true);

 try{
  const method=currentUser
   ? $('alPaymentMethod').value
   : 'qris';

  const coupon=currentUser
   ? ($('alCouponCode').value||'').trim()
   : '';

  if(method==='deposit'||method==='affiliate'){
   await createWalletPayment(method,coupon);
  }else{
   await createQrisPayment(coupon);
  }
 }catch(e){
  message(e.message||'Gagal membuat pembayaran.',true);
  setCreateButton('Coba Lagi',false);
 }finally{
  busy=false;
 }
};

$('alCheckPayment').onclick=async()=>{
 const button=$('alCheckPayment');

 if(!order||button.disabled)return;

 button.disabled=true;
 button.textContent='Memeriksa...';

 try{
  const body={
   order_id:order,
   ...(guestToken?{guest_token:guestToken}:{})
  };

  const data=await invokeFunction('payment-status',{body});

  if(data?.status!=='SETTLED'){
   message(
    'Pembayaran belum terverifikasi. Silakan periksa kembali setelah membayar.'
   );
   return;
  }

  const result=await paidAccess(body);

  message(
   'Pembayaran berhasil diverifikasi. Publisher menerima Rp2.000. Mengalihkan ke link asli...'
  );

  setTimeout(()=>location.replace(result.destination),900);

 }catch(e){
  message(e.message||'Status pembayaran belum tersedia.',true);
 }finally{
  button.disabled=false;
  button.textContent='Periksa Status';
 }
};

$('alPaymentMethod')?.addEventListener('change',()=>{
 const method=$('alPaymentMethod').value;

 setCreateButton(
  method==='qris'
   ? 'Buat Pembayaran Cashi QRIS · Rp3.500'
   : 'Bayar dengan '+(
      method==='deposit'
       ? 'Saldo Deposit'
       : 'Saldo Afiliasi'
     ),
  !!order
 );
});

init().catch(e=>{
 message(e.message||'Gagal memuat metode pembayaran.',true);
});

})();
