const root=document.getElementById('downloadCheckout');
function getRouteCode(prefix){const p=new URLSearchParams(location.search);const q=p.get('slug')||p.get('code')||'';if(q.trim())return q.trim();const a=location.pathname.split('/').filter(Boolean),i=a.findIndex(x=>x.toLowerCase()===prefix);if(i<0||!a[i+1])return'';try{return decodeURIComponent(a[i+1]).trim()}catch{return a[i+1].trim()}}
const slug=getRouteCode('d'),rp=n=>'Rp '+Number(n||0).toLocaleString((localStorage.getItem('boxcellink_lang')||'id')==='en'?'en-US':'id-ID'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let item,order=null,couponOptions=[],vipActive=false,guestCheckout=false,depositBalance=0,lang=localStorage.getItem('boxcellink_lang')||'id',payTimer=null,lastPaymentData=null,polling=false,expiredAccess=null;
const PAYMENT_POLL_INTERVAL=10000; // Pemeriksaan otomatis setiap 10 detik.
const words={
 id:{loading:'Menyiapkan halaman pembelian...',secure:'Checkout aman',guest:'Mode pembelian tamu aktif — tidak perlu login atau membuat akun.',title:'Konfirmasi pembelian',status:'Belum dibeli',access72:'Akses berbayar aktif selama 72 jam sejak pembayaran berhasil. Setelah kedaluwarsa, pembelian ulang diperlukan.',expired:'Pembelian sebelumnya sudah kedaluwarsa. Silakan bayar kembali untuk membuka akses selama 72 jam.',walletDiscount:'Saldo web dapat menggunakan saldo deposit, referral, affiliate, dan Publisher sesuai prioritas sistem. Diskon 20% hanya jika VIP aktif.',summary:'Ringkasan pesanan',digital:'Konten digital',freeContent:'Konten gratis',secureTransaction:'Transaksi diproses melalui Cashi · Pembayaran aman',footnote:'Pastikan nominal pembayaran sesuai yang tertera sebelum menyelesaikan transaksi.',qrNotLoaded:'QR tidak dapat dimuat. Muat ulang halaman atau hubungi admin dengan Order ID.',noQr:'Gateway belum mengirim data QR. Jangan melakukan pembayaran sebelum QR tersedia. Hubungi admin dengan Order ID.',qrisAmount:'Nominal sesuai order Cashi',secureMark:'Aman',orderId:'ID Pesanan',copyOrder:'Salin ID pesanan',badCode:'Kode produk tidak terbaca',routeHint:'Pastikan URL menggunakan format /d/KODE_REVIEW.',notFound:'Konten tidak ditemukan',unpublished:'Produk tidak tersedia atau belum dipublikasikan.',checkoutFail:'Gagal menyiapkan pembelian',retry:'Coba lagi',paymentFail:'Gagal membuat pembayaran',payRetry:'Coba lagi',walletFail:'Pembelian dengan saldo gagal.',walletAgreementTitle:'Konfirmasi pembayaran saldo',walletAgreementText:'Pembayaran akan langsung memotong saldo web yang tersedia sesuai urutan sumber saldo. Pastikan jumlah dan produk benar.',walletInsufficient:'Saldo web gabungan tidak mencukupi untuk pembelian ini.',activeAccess:'Akses media ini masih aktif. Halaman akan membuka PasteLink.',normal:'Harga normal',vip:'Status VIP',active:'Aktif · Diskon 20%',inactive:'Tidak aktif',coupon:'Kode diskon referral (opsional)',none:'Tanpa kode diskon',buy:'Beli sekarang',agreeTitle:'Persetujuan pembelian',agreeText:'Pastikan produk dan nominal pembayaran sudah benar. Setelah pembayaran dilakukan, transaksi akan diproses sesuai ketentuan.',agree:'Saya setuju untuk melanjutkan pembelian dan melakukan pembayaran sesuai nominal yang ditampilkan.',cancel:'Kembali',continue:'Setuju & lanjutkan',preparing:'Menyiapkan pembayaran',preparingText:'Menghubungkan ke Cashi dan membuat QR pembayaran yang sesuai dengan nominal transaksi.',payment:'Pembayaran Cashi',amount:'Total pembayaran',waiting:'Menunggu pembayaran',check:'Cek pembayaran',auto:'Pengecekan otomatis setiap 10 detik.',how:'Cara pembayaran',step1:'Buka aplikasi pembayaran yang mendukung QRIS dan siapkan fitur pemindai QR.',step2:'Pindai QR pembayaran yang tampil pada halaman ini.',step3:'Bayar tepat sesuai nominal yang tertera.',step4:'Biarkan halaman ini terbuka. Status akan diperiksa otomatis setiap 10 detik.',support:'Bantuan pembayaran',supportText:'Jika pembayaran berhasil tetapi status belum berubah, tunggu sebentar lalu cek kembali. Simpan bukti pembayaran dan Order ID untuk bantuan.',open:'Buka halaman Cashi',guestWarn:'Selesaikan pembayaran dan buka akses download pada browser/perangkat yang sama. Jangan hapus data situs sebelum akses terbuka.',processing:'Memeriksa pembayaran...',paid:'Pembayaran berhasil! Membuka akses...',failed:'Belum dapat memeriksa pembayaran. Silakan coba lagi.',discount:'Diskon',total:'Total setelah diskon',free:'Konten ini gratis.'},
 en:{loading:'Preparing checkout...',secure:'Secure checkout',guest:'Guest checkout is active — no login or account creation required.',title:'Confirm your purchase',status:'Not purchased',access72:'Paid access is valid for 72 hours from successful payment. A new purchase is required after it expires.',expired:'Your previous purchase has expired. Please pay again to unlock access for another 72 hours.',walletDiscount:'Website wallet can use deposit, referral, affiliate, and Publisher balances according to the system priority. The 20% discount applies only to active VIP accounts.',summary:'Order summary',digital:'Digital content',freeContent:'Free content',secureTransaction:'Processed securely through Cashi',footnote:'Verify the amount shown before completing payment.',qrNotLoaded:'QR failed to load. Refresh or contact support with the Order ID.',noQr:'The gateway did not return a QR code. Do not pay until a QR is available. Contact support with the Order ID.',qrisAmount:'Amount matches Cashi order',secureMark:'Secure',orderId:'Order ID',copyOrder:'Copy order ID',badCode:'Product code could not be read',routeHint:'Make sure the URL follows /d/REVIEW_CODE.',notFound:'Content not found',unpublished:'The product is unavailable or unpublished.',checkoutFail:'Unable to prepare checkout',retry:'Try again',paymentFail:'Unable to create payment',payRetry:'Try again',walletFail:'Wallet purchase failed.',walletAgreementTitle:'Confirm wallet payment',walletAgreementText:'This purchase will deduct your available website wallet balance according to the wallet-source priority. Verify the product and amount.',walletInsufficient:'Your combined website wallet balance is insufficient for this purchase.',activeAccess:'Access is still active. Opening PasteLink.',normal:'Regular price',vip:'VIP status',active:'Active · 20% discount',inactive:'Inactive',coupon:'Referral discount code (optional)',none:'No discount code',buy:'Buy now',agreeTitle:'Purchase agreement',agreeText:'Please verify the product and payment amount. Once payment is made, the transaction will be processed according to the terms.',agree:'I agree to continue with this purchase and pay the amount shown.',cancel:'Go back',continue:'Agree & continue',preparing:'Preparing payment',preparingText:'Connecting to Cashi and creating a payment QR for your exact order amount.',payment:'Cashi payment',amount:'Payment total',waiting:'Waiting for payment',check:'Check payment',auto:'Automatic payment check every 10 seconds.',how:'How to pay',step1:'Open a QRIS-supported payment app and prepare its QR scanner.',step2:'Scan the payment QR displayed on this page.',step3:'Pay the exact amount shown.',step4:'Keep this page open. Payment status is checked automatically every 10 seconds.',support:'Payment support',supportText:'If payment succeeds but the status has not updated, wait briefly and check again. Keep your payment receipt and Order ID for support.',open:'Open Cashi payment page',guestWarn:'Complete payment and open your download access in the same browser/device. Do not clear site data before access is available.',processing:'Checking payment...',paid:'Payment successful! Opening access...',failed:'Unable to check payment. Please try again.',discount:'Discount',total:'Total after discount',free:'This content is free.'}
};
const t=k=>words[lang][k]||words.id[k]||k;
function setLanguage(next){lang=next;localStorage.setItem('boxcellink_lang',lang);if(lastPaymentData)renderPayment(lastPaymentData);else if(item)renderCheckout();else init();}
function loadingView(title,desc){root.innerHTML=`<div class="checkout-loading"><div class="checkout-spinner"><i class="fa-solid fa-shield-halved"></i></div><h2>${esc(title)}</h2><p>${esc(desc)}</p><div class="loading-track"><span></span></div></div>`}
async function init(){
 if(!slug){root.innerHTML=`<div class="checkout-error"><h2>${t('badCode')}</h2><p>${t('routeHint')}</p></div>`;return}
 loadingView(t('loading'),t('secure'));
 try{
  let {data,error}=await sb.from('review_items').select('id,slug,title,description,price,access,status').eq('slug',slug).maybeSingle();
  if(!error&&!data){const alt=await sb.from('review_items').select('id,slug,title,description,price,access,status').ilike('slug',slug).maybeSingle();data=alt.data;error=alt.error}
  if(error)throw error;
  if(!data){const byId=await sb.from('review_items').select('id,slug,title,description,price,access,status').eq('id',slug).maybeSingle();data=byId.data}
  item=data;if(!item||item.status!=='published'){root.innerHTML=`<div class="checkout-error"><h2>${t('notFound')}</h2><p>${t('unpublished')}</p></div>`;return}
  let {data:{user}}=await sb.auth.getUser();
  const accessType=String(item.access||'').trim().toLowerCase();
  if(accessType==='free'){await unlock();return}
  if(!user){
   const {data:guestData,error:guestError}=await sb.auth.signInAnonymously();
   if(guestError||!guestData?.user)throw new Error('Pembelian tamu belum aktif. Admin perlu mengaktifkan Anonymous Sign-Ins di Supabase.');
   user=guestData.user;guestCheckout=true;
  }
  const {data:owned,error:entitlementError}=await sb.from('review_entitlements').select('id,expires_at').eq('review_id',item.id).eq('user_id',user.id).maybeSingle();
  if(entitlementError)throw entitlementError;
  if(owned?.expires_at && new Date(owned.expires_at)>new Date()){await unlock();return}
  expiredAccess=owned?.expires_at?owned.expires_at:null;
  const [profileRes,couponRes,claimRes,publisherRes]=await Promise.all([
   sb.from('profiles').select('vip_expires_at,deposit_balance,referral_balance,affiliate_balance').eq('id',user.id).maybeSingle(),
   guestCheckout?Promise.resolve({data:[]}):sb.from('discount_coupons').select('code,discount_percent,uses_total,uses_used,uses_reserved').eq('user_id',user.id),
   guestCheckout?Promise.resolve({data:[]}):sb.from('admin_discount_claims').select('used_at,admin_discount_codes(code,scope,discount_percent,min_purchase,expires_at)').eq('user_id',user.id),
   guestCheckout?Promise.resolve({data:null,error:null}):sb.from('publisher_balances').select('available_balance').eq('publisher_id',user.id).maybeSingle()
  ]);
  vipActive=!guestCheckout&&!!profileRes.data?.vip_expires_at&&new Date(profileRes.data.vip_expires_at)>new Date();depositBalance=Number(profileRes.data?.deposit_balance||0)+Number(profileRes.data?.referral_balance||0)+Number(profileRes.data?.affiliate_balance||0)+Number(publisherRes.data?.available_balance||0);
  couponOptions=guestCheckout?[]:(couponRes.data||[]).filter(c=>(c.uses_used||0)+(c.uses_reserved||0)<c.uses_total).concat((claimRes.data||[]).filter(x=>!x.used_at&&x.admin_discount_codes&&['all','telegram_review'].includes(x.admin_discount_codes.scope||'all')&&(!x.admin_discount_codes.expires_at||new Date(x.admin_discount_codes.expires_at)>new Date())).map(x=>({...x.admin_discount_codes,source:'admin'})));
  renderCheckout();
 }catch(e){root.innerHTML=`<div class="checkout-error"><i class="fa-solid fa-circle-exclamation"></i><h2>Gagal menyiapkan pembelian</h2><p>${esc(e.message||'Terjadi kesalahan.')}</p><button class="checkout-button" id="retryCheckout">Coba lagi</button></div>`;document.getElementById('retryCheckout')?.addEventListener('click',init)}
}
function calc(){const c=couponOptions.find(x=>x.code===document.getElementById('couponCode')?.value);const percent=Math.max(vipActive?20:0,Number(c?.discount_percent)||0);return{percent,amount:Math.round(Number(item.price)*(100-percent)/100),coupon:c}}
function renderCheckout(){
 root.innerHTML=`<div class="checkout-shell">
  <div class="checkout-header"><div class="checkout-brand"><span class="checkout-brand-icon"><i class="fa-solid fa-lock"></i></span><div><b>BoxCellink Checkout</b><small>${t('secure')}</small></div></div><span class="checkout-secure-mark"><i class="fa-solid fa-shield-halved"></i> ${t('secureMark')}</span></div>
  <div class="checkout-main"><div class="checkout-intro"><span class="checkout-eyebrow"><i class="fa-solid fa-bag-shopping"></i> ${t('title')}</span><h1>${esc(item.title)}</h1><p>${esc(item.description||'')}</p></div>
  ${guestCheckout?`<div class="guest-checkout-note"><i class="fa-solid fa-user-shield"></i><span>${t('guest')}</span></div>`:''}${expiredAccess?`<div class="checkout-expired-note"><i class="fa-solid fa-clock-rotate-left"></i><span>${t('expired')}</span></div>`:''}<div class="checkout-access-note"><i class="fa-solid fa-clock"></i><span>${t('access72')}</span></div>
  <section class="checkout-card"><div class="checkout-card-title"><span class="checkout-icon"><i class="fa-solid fa-receipt"></i></span><div><b>${t('summary')}</b><small>${lang==='en'?'Review media purchase':'Pembelian Review Media'}</small></div><span class="checkout-status">${t('status')}</span></div>
   <div class="checkout-product"><div class="checkout-product-icon"><i class="fa-solid fa-photo-film"></i></div><div class="checkout-product-info"><b>${esc(item.title)}</b><small>${String(item.access||'').trim().toLowerCase()==='paid'?t('digital'):t('freeContent')}</small></div><strong>${rp(item.price)}</strong></div>
   <div class="checkout-line"><span>${t('normal')}</span><b>${rp(item.price)}</b></div><div class="checkout-line"><span>${t('vip')}</span><b class="${vipActive?'text-success':''}">${vipActive?t('active'):t('inactive')}</b></div>
   <div class="checkout-field"><label for="couponCode"><i class="fa-solid fa-ticket"></i> ${t('coupon')}</label><select id="couponCode"><option value="">${t('none')}</option>${couponOptions.map(c=>`<option value="${esc(c.code)}">${esc(c.code)} — ${c.discount_percent}%</option>`).join('')}</select></div>
   <div class="checkout-total"><div><small id="discountLabel">${t('discount')} 0%</small><b>${t('total')}</b></div><strong id="totalAmount">${rp(item.price)}</strong></div>
   <button class="checkout-button" id="buyNow"><i class="fa-solid fa-shield-check"></i> ${t('buy')} · ${rp(calc().amount)} <i class="fa-solid fa-arrow-right"></i></button>
   ${!guestCheckout?`<button class="checkout-button wallet-purchase-button" id="buyWithDeposit" type="button"><i class="fa-solid fa-wallet"></i> ${lang==='en'?'Pay with website wallet':'Bayar dengan saldo web'} · ${rp(Math.round(Number(item.price)*(vipActive?0.8:1)))} ${vipActive?'(VIP −20%)':''}</button><small class="wallet-available">${lang==='en'?'Website wallet available:':'Saldo web tersedia:'} ${rp(depositBalance)}</small><small class="wallet-discount-note">${t('walletDiscount')}</small>`:''}
   <div class="checkout-secure"><i class="fa-solid fa-shield-halved"></i> ${t('secureTransaction')}</div>
  </section><div class="checkout-footnote"><i class="fa-solid fa-circle-info"></i> ${t('footnote')}</div>
  </div></div>`;
 document.getElementById('couponCode').onchange=updatePreview;updatePreview();document.getElementById('buyNow').onclick=confirmBuy;
 document.getElementById('buyWithDeposit')?.addEventListener('click',()=>confirmBuy('wallet'));
}
function updatePreview(){const {percent,amount}=calc();const label=document.getElementById('discountLabel'),total=document.getElementById('totalAmount'),buy=document.getElementById('buyNow');if(label)label.textContent=`${t('discount')} ${percent}%`;if(total)total.textContent=rp(amount);if(buy)buy.innerHTML=`<i class="fa-solid fa-shield-check"></i> ${t('buy')} · ${rp(amount)} <i class="fa-solid fa-arrow-right"></i>`}
function confirmBuy(method='cashi'){
 const isWallet=method==='wallet';
 const amount=isWallet?Math.round(Number(item.price)*(vipActive?0.8:1)):calc().amount;
 const modalId='confirmModal';
 root.insertAdjacentHTML('beforeend',`<div class="checkout-modal" id="${modalId}"><div class="checkout-dialog"><div class="dialog-icon"><i class="fa-solid ${isWallet?'fa-wallet':'fa-file-signature'}"></i></div><span class="checkout-eyebrow">${isWallet?t('walletAgreementTitle'):t('agreeTitle')}</span><h2>${esc(item.title)}</h2><p>${isWallet?t('walletAgreementText'):t('agreeText')}</p><div class="dialog-total"><span>${t('amount')}</span><b>${rp(amount)}</b></div><div class="dialog-access-terms"><i class="fa-solid fa-clock"></i> ${t('access72')}</div><label class="agreement-check"><input type="checkbox" id="agreeBuy"><span>${t('agree')}</span></label><div class="dialog-actions"><button class="checkout-button secondary" id="cancelBuy">${t('cancel')}</button><button class="checkout-button" id="agreeBtn" disabled>${t('continue')} <i class="fa-solid fa-arrow-right"></i></button></div></div></div>`);
 document.getElementById('agreeBuy').onchange=e=>document.getElementById('agreeBtn').disabled=!e.target.checked;
 document.getElementById('cancelBuy').onclick=()=>document.getElementById(modalId)?.remove();
 document.getElementById('agreeBtn').onclick=isWallet?buyWalletPurchase:createOrder;
}
async function buyWalletPurchase(){
 document.getElementById('confirmModal')?.remove();
 loadingView(lang==='en'?'Processing wallet purchase':'Memproses pembelian saldo',t('secure'));
 try{
  const {data,error}=await sb.rpc('buy_with_deposit_wallet',{p_purpose:'review_download',p_review_id:item.id,p_plan_id:null,p_vip_group_id:null,p_affiliate_code:localStorage.getItem('boxcellink_affiliate_code')||null});
  if(error)throw error;
  if(!data?.ok){const reason=data?.reason||'';if(reason==='INSUFFICIENT_COMBINED_BALANCE')throw new Error(t('walletInsufficient'));if(reason==='REVIEW_ALREADY_OWNED')throw new Error(t('activeAccess'));throw new Error(reason||t('walletFail'));}
  await unlock();
 }catch(err){
  root.innerHTML=`<div class="checkout-error"><i class="fa-solid fa-circle-exclamation"></i><h2>${t('walletFail')}</h2><p>${esc(err.message||'')}</p><button class="checkout-button" id="walletRetry">${t('retry')}</button></div>`;
  document.getElementById('walletRetry')?.addEventListener('click',renderCheckout);
 }
}

async function createOrder(){
 const modal=document.getElementById('confirmModal');if(modal)modal.remove();
 loadingView(t('preparing'),t('preparingText'));
 try{
  const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'review_download',review_id:item.id,coupon_code:document.getElementById('couponCode')?.value||null,affiliate_code:localStorage.getItem('boxcellink_affiliate_code')||null}});
  if(error)throw error;if(!data?.checkout_url)throw new Error(data?.error||'Cashi gagal membuat pembayaran.');
  order=data.order_id;renderPayment(data);
 }catch(e){root.innerHTML=`<div class="checkout-error"><i class="fa-solid fa-triangle-exclamation"></i><h2>${t('paymentFail')}</h2><p>${esc(e.message||'')}</p><button class="checkout-button" id="retryPayment">${t('payRetry')}</button></div>`;document.getElementById('retryPayment').onclick=()=>{renderCheckout();confirmBuy()}}
}
function renderPayment(data){
 lastPaymentData=data;
 const qr=data.qrUrl||data.qr_url||data.qr_code_url||null;
 root.innerHTML=`<div class="checkout-shell payment-shell"><div class="checkout-header"><div class="checkout-brand"><span class="checkout-brand-icon"><i class="fa-solid fa-shield-halved"></i></span><div><b>BoxCellink Checkout</b><small>${t('payment')}</small></div></div><div class="payment-head-actions"><span class="payment-secure-label"><i class="fa-solid fa-lock"></i> ${t('secureMark')}</span></div></div>
 <section class="payment-method-marquees" aria-label="Payment methods"><div class="payment-method-lane bank-lane"><span class="payment-lane-label"><i class="fa-solid fa-building-columns"></i> ${lang==='en'?'BANK OPTIONS':'BANK'}</span><div class="payment-marquee-track"><div class="payment-marquee-items">${['BCA','BRI','BNI','Mandiri','CIMB','Permata','BSI','BTN'].map(x=>`<span class="payment-method-chip">${x}</span>`).join('')}${['BCA','BRI','BNI','Mandiri','CIMB','Permata','BSI','BTN'].map(x=>`<span class="payment-method-chip">${x}</span>`).join('')}</div></div></div><div class="payment-method-lane wallet-lane"><span class="payment-lane-label"><i class="fa-solid fa-wallet"></i> ${lang==='en'?'E-WALLETS':'E-WALLET'}</span><div class="payment-marquee-track reverse"><div class="payment-marquee-items">${['GoPay','DANA','OVO','ShopeePay','LinkAja'].map(x=>`<span class="payment-method-chip">${x}</span>`).join('')}${['GoPay','DANA','OVO','ShopeePay','LinkAja'].map(x=>`<span class="payment-method-chip">${x}</span>`).join('')}</div></div></div><small class="payment-method-disclaimer">${lang==='en'?'QRIS availability and accepted providers depend on the gateway instructions.':'Ketersediaan QRIS dan penyedia pembayaran mengikuti instruksi gateway.'}</small></section><div class="payment-layout"><section class="payment-card"><div class="payment-heading"><span class="checkout-eyebrow"><i class="fa-solid fa-qrcode"></i> ${t('payment')}</span><h1>${t('waiting')}</h1><p>${esc(item.title)}</p></div>
 <div class="payment-amount"><small>${t('amount')}</small><strong>${rp(data.amount)}</strong><span><i class="fa-solid fa-circle-check"></i> ${t('qrisAmount')}</span></div>
 <div class="qr-stage">${qr?`<img src="${esc(qr)}" alt="${lang==='en'?'Cashi payment QR':'QR pembayaran Cashi'}" class="cashi-qr" onerror="this.style.display='none';this.nextElementSibling.hidden=false"><div class="qr-fallback" ${qr?'hidden':''}><i class="fa-solid fa-qrcode"></i><span>${t('qrNotLoaded')}</span></div>`:`<div class="qr-fallback"><i class="fa-solid fa-qrcode"></i><span>${t('noQr')}</span></div>`}</div>
 <div class="payment-state is-pending" id="paymentStateBox"><span class="state-pulse"></span><b id="payState">${t('waiting')}</b><small id="checkMessage">${t('auto')}</small></div>
 <button class="checkout-button check-payment" id="checkPay"><i class="fa-solid fa-rotate"></i> ${t('check')}</button>
 <div class="order-reference"><span>${t('orderId')}</span><b>${esc(data.order_id)}</b><button type="button" id="copyOrder" aria-label="${t('copyOrder')}"><i class="fa-regular fa-copy"></i></button></div>
 </section><aside class="payment-side"><section class="payment-info-card"><h3><i class="fa-solid fa-list-ol"></i> ${t('how')}</h3><ol><li>${t('step1')}</li><li>${t('step2')}</li><li>${t('step3')}</li><li>${t('step4')}</li></ol></section><section class="payment-info-card support-card"><h3><i class="fa-solid fa-headset"></i> ${t('support')}</h3><p>${t('supportText')}</p></section>${guestCheckout?`<div class="guest-checkout-note"><i class="fa-solid fa-user-shield"></i><span>${t('guestWarn')}</span></div>`:''}</aside></div></div>`;
 document.getElementById('checkPay').onclick=()=>checkStatus(true);
 document.getElementById('copyOrder').onclick=async()=>{try{await navigator.clipboard.writeText(data.order_id);document.getElementById('copyOrder').innerHTML='<i class="fa-solid fa-check"></i>'}catch{}};
 if(payTimer)clearTimeout(payTimer);polling=false;checkStatus(false);
}
function setPaymentVisual(state,title,message){
 const box=document.getElementById('paymentStateBox'),stateEl=document.getElementById('payState'),msg=document.getElementById('checkMessage');
 if(box)box.className='payment-state '+state;
 if(stateEl&&title)stateEl.textContent=title;
 if(msg&&message)msg.textContent=message;
}
async function checkStatus(manual=false){
 if(!order||polling)return;
 const msg=document.getElementById('checkMessage'),btn=document.getElementById('checkPay');if(!msg||!btn)return;
 polling=true;
 setPaymentVisual('is-checking',lang==='en'?'LIVE · CHECKING':'LIVE · SEDANG MENGECEK',t('processing'));
 if(manual){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> '+t('processing')}
 else {msg.textContent=t('processing')}
 try{
  const {data,error}=await sb.functions.invoke('payment-status',{body:{order_id:order}});
  if(error){
   let detail='';
   try{const response=error.context; if(response&&typeof response.clone==='function'){const body=await response.clone().json();detail=body?.error||body?.message||body?.detail?.message||''}}catch{}
   throw new Error(detail||error.message||'Fungsi payment-status gagal dipanggil.');
  }
  if(!data?.success)throw new Error(data?.error||data?.detail?.message||'Server tidak mengembalikan status pembayaran yang valid.');
  const state=String(data.status||'PENDING').toUpperCase();
  const stateEl=document.getElementById('payState');if(stateEl)stateEl.textContent=state;
  if(['SETTLED','PAID','SUCCESS','COMPLETED'].includes(state)){
   if(payTimer)clearTimeout(payTimer);setPaymentVisual('is-success',lang==='en'?'PAYMENT SUCCESS':'PEMBAYARAN BERHASIL',t('paid'));await unlock();return;
  }
  if(['FAILED','EXPIRED','CANCELLED','CANCELED'].includes(state)){
   setPaymentVisual('is-error',lang==='en'?`PAYMENT ${state}`:`PEMBAYARAN ${state}`,lang==='en'?`Status: ${state}. Contact support if you have been charged.`:`Status: ${state}. Hubungi admin jika pembayaran sudah terpotong.`);
  } else setPaymentVisual('is-pending',lang==='en'?'WAITING FOR PAYMENT':'MENUNGGU PEMBAYARAN',manual?`Status: ${state} · ${t('auto')}`:t('auto'));
 }catch(e){setPaymentVisual('is-error',lang==='en'?'CHECK FAILED':'PENGECEKAN GAGAL',`${t('failed')} (${String(e?.message||'Kesalahan tidak diketahui').slice(0,180)})`);console.error('BoxCellink payment-status:',e)}
 finally{
  polling=false;
  if(manual&&document.getElementById('checkPay')){btn.disabled=false;btn.innerHTML=`<i class="fa-solid fa-rotate"></i> ${t('check')}`}
  if(order&&document.getElementById('checkPay'))payTimer=setTimeout(()=>checkStatus(false),PAYMENT_POLL_INTERVAL);
 }
}
async function unlock(){if(payTimer)clearTimeout(payTimer);location.replace('/paste/'+encodeURIComponent(item.slug))}
window.addEventListener('beforeunload',()=>{if(payTimer)clearTimeout(payTimer)});
init();
