const root=document.getElementById('downloadCheckout');
function getRouteCode(prefix){const p=new URLSearchParams(location.search);const q=p.get('slug')||p.get('code')||'';if(q.trim())return q.trim();const a=location.pathname.split('/').filter(Boolean),i=a.findIndex(x=>x.toLowerCase()===prefix);if(i<0||!a[i+1])return'';try{return decodeURIComponent(a[i+1]).trim()}catch{return a[i+1].trim()}}
const slug=getRouteCode('d'),rp=n=>'Rp '+Number(n||0).toLocaleString('id-ID'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let item,order=null,couponOptions=[],vipActive=false,guestCheckout=false,lang=localStorage.getItem('boxcellink_lang')||'id',payTimer=null,lastPaymentData=null;
const words={
 id:{loading:'Menyiapkan halaman pembelian...',secure:'Checkout aman',guest:'Mode pembelian tamu aktif — tidak perlu login atau membuat akun.',title:'Konfirmasi pembelian',status:'Belum dibeli',normal:'Harga normal',vip:'Status VIP',active:'Aktif · Diskon 20%',inactive:'Tidak aktif',coupon:'Kode diskon referral (opsional)',none:'Tanpa kode diskon',buy:'Beli sekarang',agreeTitle:'Persetujuan pembelian',agreeText:'Pastikan produk dan nominal pembayaran sudah benar. Setelah pembayaran dilakukan, transaksi akan diproses sesuai ketentuan.',agree:'Saya setuju untuk melanjutkan pembelian dan melakukan pembayaran sesuai nominal yang ditampilkan.',cancel:'Kembali',continue:'Setuju & lanjutkan',preparing:'Menyiapkan pembayaran',preparingText:'Menghubungkan ke Cashi dan membuat QR pembayaran yang sesuai dengan nominal transaksi.',payment:'Pembayaran Cashi',amount:'Total pembayaran',waiting:'Menunggu pembayaran',check:'Cek pembayaran',auto:'Status diperiksa otomatis setiap 8 detik.',how:'Cara pembayaran',step1:'Tampilkan QR Cashi atau buka halaman pembayaran.',step2:'Scan QR menggunakan aplikasi pembayaran yang mendukung QRIS, atau ikuti pilihan metode yang tersedia di halaman Cashi.',step3:'Bayar tepat sesuai nominal yang tertera.',step4:'Kembali ke halaman ini. Status akan diperiksa otomatis atau tekan tombol cek pembayaran.',support:'Bantuan pembayaran',supportText:'Jika pembayaran berhasil tetapi status belum berubah, tunggu sebentar lalu cek kembali. Simpan bukti pembayaran dan Order ID untuk bantuan.',open:'Buka halaman Cashi',guestWarn:'Selesaikan pembayaran dan buka akses download pada browser/perangkat yang sama. Jangan hapus data situs sebelum akses terbuka.',processing:'Memeriksa pembayaran...',paid:'Pembayaran berhasil! Membuka akses...',failed:'Belum dapat memeriksa pembayaran. Silakan coba lagi.',discount:'Diskon',total:'Total setelah diskon',free:'Konten ini gratis.'},
 en:{loading:'Preparing checkout...',secure:'Secure checkout',guest:'Guest checkout is active — no login or account creation required.',title:'Confirm your purchase',status:'Not purchased',normal:'Regular price',vip:'VIP status',active:'Active · 20% discount',inactive:'Inactive',coupon:'Referral discount code (optional)',none:'No discount code',buy:'Buy now',agreeTitle:'Purchase agreement',agreeText:'Please verify the product and payment amount. Once payment is made, the transaction will be processed according to the terms.',agree:'I agree to continue with this purchase and pay the amount shown.',cancel:'Go back',continue:'Agree & continue',preparing:'Preparing payment',preparingText:'Connecting to Cashi and creating a payment QR for your exact order amount.',payment:'Cashi payment',amount:'Payment total',waiting:'Waiting for payment',check:'Check payment',auto:'Payment status is checked automatically every 8 seconds.',how:'How to pay',step1:'Display the Cashi QR or open the payment page.',step2:'Scan the QR using a QRIS-compatible payment app, or follow the available methods on Cashi.',step3:'Pay the exact amount shown.',step4:'Return here. The status is checked automatically, or tap the check button.',support:'Payment support',supportText:'If payment succeeds but the status has not updated, wait briefly and check again. Keep your payment receipt and Order ID for support.',open:'Open Cashi payment page',guestWarn:'Complete payment and open your download access in the same browser/device. Do not clear site data before access is available.',processing:'Checking payment...',paid:'Payment successful! Opening access...',failed:'Unable to check payment. Please try again.',discount:'Discount',total:'Total after discount',free:'This content is free.'}
};
const t=k=>words[lang][k]||words.id[k]||k;
function setLanguage(next){lang=next;localStorage.setItem('boxcellink_lang',lang);if(lastPaymentData)renderPayment(lastPaymentData);else if(item)renderCheckout();else init();}
function loadingView(title,desc){root.innerHTML=`<div class="checkout-loading"><div class="checkout-spinner"><i class="fa-solid fa-shield-halved"></i></div><h2>${esc(title)}</h2><p>${esc(desc)}</p><div class="loading-track"><span></span></div></div>`}
async function init(){
 if(!slug){root.innerHTML='<div class="checkout-error"><h2>Kode produk tidak terbaca</h2><p>Pastikan URL menggunakan format /d/KODE_REVIEW.</p></div>';return}
 loadingView(t('loading'),t('secure'));
 try{
  let {data,error}=await sb.from('review_items').select('id,slug,title,description,price,access,status').eq('slug',slug).maybeSingle();
  if(!error&&!data){const alt=await sb.from('review_items').select('id,slug,title,description,price,access,status').ilike('slug',slug).maybeSingle();data=alt.data;error=alt.error}
  if(error)throw error;
  if(!data){const byId=await sb.from('review_items').select('id,slug,title,description,price,access,status').eq('id',slug).maybeSingle();data=byId.data}
  item=data;if(!item||item.status!=='published'){root.innerHTML='<div class="checkout-error"><h2>Konten tidak ditemukan</h2><p>Produk tidak tersedia atau belum dipublikasikan.</p></div>';return}
  let {data:{user}}=await sb.auth.getUser();
  if(item.access==='free'){await unlock();return}
  if(!user){
   const {data:guestData,error:guestError}=await sb.auth.signInAnonymously();
   if(guestError||!guestData?.user)throw new Error('Pembelian tamu belum aktif. Admin perlu mengaktifkan Anonymous Sign-Ins di Supabase.');
   user=guestData.user;guestCheckout=true;
  }
  const {data:owned}=await sb.from('review_entitlements').select('id').eq('review_id',item.id).eq('user_id',user.id).maybeSingle();
  if(owned){await unlock();return}
  const [profileRes,couponRes,claimRes]=await Promise.all([
   sb.from('profiles').select('vip_expires_at').eq('id',user.id).maybeSingle(),
   guestCheckout?Promise.resolve({data:[]}):sb.from('discount_coupons').select('code,discount_percent,uses_total,uses_used,uses_reserved').eq('user_id',user.id),
   guestCheckout?Promise.resolve({data:[]}):sb.from('admin_discount_claims').select('used_at,admin_discount_codes(code,discount_percent,min_purchase,expires_at)').eq('user_id',user.id)
  ]);
  vipActive=!guestCheckout&&!!profileRes.data?.vip_expires_at&&new Date(profileRes.data.vip_expires_at)>new Date();
  couponOptions=guestCheckout?[]:(couponRes.data||[]).filter(c=>(c.uses_used||0)+(c.uses_reserved||0)<c.uses_total).concat((claimRes.data||[]).filter(x=>!x.used_at&&x.admin_discount_codes&&(!x.admin_discount_codes.expires_at||new Date(x.admin_discount_codes.expires_at)>new Date())).map(x=>({...x.admin_discount_codes,source:'admin'})));
  renderCheckout();
 }catch(e){root.innerHTML=`<div class="checkout-error"><i class="fa-solid fa-circle-exclamation"></i><h2>Gagal menyiapkan pembelian</h2><p>${esc(e.message||'Terjadi kesalahan.')}</p><button class="checkout-button" id="retryCheckout">Coba lagi</button></div>`;document.getElementById('retryCheckout')?.addEventListener('click',init)}
}
function calc(){const c=couponOptions.find(x=>x.code===document.getElementById('couponCode')?.value);const percent=Math.max(vipActive?20:0,Number(c?.discount_percent)||0);return{percent,amount:Math.round(Number(item.price)*(100-percent)/100),coupon:c}}
function renderCheckout(){
 root.innerHTML=`<div class="checkout-shell">
  <div class="checkout-header"><div class="checkout-brand"><span class="checkout-brand-icon"><i class="fa-solid fa-lock"></i></span><div><b>BoxCellink Checkout</b><small>${t('secure')}</small></div></div><button class="language-switch" id="languageSwitch">${lang==='id'?'🇮🇩 ID':'🇬🇧 EN'} <i class="fa-solid fa-chevron-down"></i></button></div>
  <div class="checkout-main"><div class="checkout-intro"><span class="checkout-eyebrow"><i class="fa-solid fa-bag-shopping"></i> ${t('title')}</span><h1>${esc(item.title)}</h1><p>${esc(item.description||'')}</p></div>
  ${guestCheckout?`<div class="guest-checkout-note"><i class="fa-solid fa-user-shield"></i><span>${t('guest')}</span></div>`:''}
  <section class="checkout-card"><div class="checkout-card-title"><span class="checkout-icon"><i class="fa-solid fa-receipt"></i></span><div><b>Ringkasan pesanan</b><small>Order summary</small></div><span class="checkout-status">${t('status')}</span></div>
   <div class="checkout-product"><div class="checkout-product-icon"><i class="fa-solid fa-photo-film"></i></div><div class="checkout-product-info"><b>${esc(item.title)}</b><small>${item.access==='paid'?'Digital content':'Free content'}</small></div><strong>${rp(item.price)}</strong></div>
   <div class="checkout-line"><span>${t('normal')}</span><b>${rp(item.price)}</b></div><div class="checkout-line"><span>${t('vip')}</span><b class="${vipActive?'text-success':''}">${vipActive?t('active'):t('inactive')}</b></div>
   <div class="checkout-field"><label for="couponCode"><i class="fa-solid fa-ticket"></i> ${t('coupon')}</label><select id="couponCode"><option value="">${t('none')}</option>${couponOptions.map(c=>`<option value="${esc(c.code)}">${esc(c.code)} — ${c.discount_percent}%</option>`).join('')}</select></div>
   <div class="checkout-total"><div><small id="discountLabel">${t('discount')} 0%</small><b>${t('total')}</b></div><strong id="totalAmount">${rp(item.price)}</strong></div>
   <button class="checkout-button" id="buyNow"><i class="fa-solid fa-shield-check"></i> ${t('buy')} · ${rp(item.price)} <i class="fa-solid fa-arrow-right"></i></button>
   <div class="checkout-secure"><i class="fa-solid fa-shield-halved"></i> Transaksi diproses melalui Cashi · Secure payment</div>
  </section><div class="checkout-footnote"><i class="fa-solid fa-circle-info"></i> Pastikan nominal pembayaran sesuai dengan yang tertera sebelum menyelesaikan transaksi.</div>
  </div></div>`;
 document.getElementById('languageSwitch').onclick=()=>setLanguage(lang==='id'?'en':'id');
 document.getElementById('couponCode').onchange=updatePreview;updatePreview();document.getElementById('buyNow').onclick=confirmBuy;
}
function updatePreview(){const {percent,amount}=calc();document.getElementById('discountLabel').textContent=`${t('discount')} ${percent}%`;document.getElementById('totalAmount').textContent=rp(amount);document.getElementById('buyNow').innerHTML=`<i class="fa-solid fa-shield-check"></i> ${t('buy')} · ${rp(amount)} <i class="fa-solid fa-arrow-right"></i>`}
function confirmBuy(){
 const {amount}=calc();
 root.insertAdjacentHTML('beforeend',`<div class="checkout-modal" id="confirmModal"><div class="checkout-dialog"><div class="dialog-icon"><i class="fa-solid fa-file-signature"></i></div><span class="checkout-eyebrow">${t('agreeTitle')}</span><h2>${esc(item.title)}</h2><p>${t('agreeText')}</p><div class="dialog-total"><span>${t('amount')}</span><b>${rp(amount)}</b></div><label class="agreement-check"><input type="checkbox" id="agreeBuy"><span>${t('agree')}</span></label><div class="dialog-actions"><button class="checkout-button secondary" id="cancelBuy">${t('cancel')}</button><button class="checkout-button" id="agreeBtn" disabled>${t('continue')} <i class="fa-solid fa-arrow-right"></i></button></div></div></div>`);
 document.getElementById('agreeBuy').onchange=e=>document.getElementById('agreeBtn').disabled=!e.target.checked;
 document.getElementById('cancelBuy').onclick=()=>document.getElementById('confirmModal')?.remove();
 document.getElementById('agreeBtn').onclick=createOrder;
}
async function createOrder(){
 const modal=document.getElementById('confirmModal');if(modal)modal.remove();
 loadingView(t('preparing'),t('preparingText'));
 try{
  const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'review_download',review_id:item.id,coupon_code:document.getElementById('couponCode')?.value||null}});
  if(error)throw error;if(!data?.checkout_url)throw new Error(data?.error||'Cashi gagal membuat pembayaran.');
  order=data.order_id;renderPayment(data);
 }catch(e){root.innerHTML=`<div class="checkout-error"><i class="fa-solid fa-triangle-exclamation"></i><h2>Gagal membuat pembayaran</h2><p>${esc(e.message||'Silakan coba kembali.')}</p><button class="checkout-button" id="retryPayment">Coba lagi</button></div>`;document.getElementById('retryPayment').onclick=()=>{renderCheckout();confirmBuy()}}
}
function renderPayment(data){
 lastPaymentData=data;
 const qr=data.qrUrl||data.qr_url||data.qr_code_url||null;
 root.innerHTML=`<div class="checkout-shell payment-shell"><div class="checkout-header"><div class="checkout-brand"><span class="checkout-brand-icon"><i class="fa-solid fa-shield-halved"></i></span><div><b>BoxCellink Checkout</b><small>${t('payment')}</small></div></div><div class="payment-head-actions"><button class="language-switch" id="paymentLanguage">${lang==='id'?'🇮🇩 ID':'🇬🇧 EN'}</button><span class="payment-secure-label"><i class="fa-solid fa-lock"></i> Secure</span></div></div>
 <div class="payment-layout"><section class="payment-card"><div class="payment-heading"><span class="checkout-eyebrow"><i class="fa-solid fa-qrcode"></i> ${t('payment')}</span><h1>${t('waiting')}</h1><p>${esc(item.title)}</p></div>
 <div class="payment-amount"><small>${t('amount')}</small><strong>${rp(data.amount)}</strong><span><i class="fa-solid fa-circle-check"></i> Nominal sesuai order Cashi</span></div>
 <div class="qr-stage">${qr?`<img src="${esc(qr)}" alt="QR pembayaran Cashi" class="cashi-qr" onerror="this.style.display='none';this.nextElementSibling.hidden=false"><div class="qr-fallback" ${qr?'hidden':''}><i class="fa-solid fa-qrcode"></i><span>QR tidak dapat ditampilkan. Buka halaman pembayaran Cashi.</span></div>`:`<div class="qr-fallback"><i class="fa-solid fa-qrcode"></i><span>QR Cashi tidak tersedia pada respons gateway. Gunakan halaman pembayaran Cashi.</span></div>`}</div>
 <a class="checkout-button cashi-open" href="${esc(data.checkout_url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${t('open')}</a>
 <div class="payment-state"><span class="state-pulse"></span><b id="payState">${t('waiting')}</b><small id="checkMessage">${t('auto')}</small></div>
 <button class="checkout-button check-payment" id="checkPay"><i class="fa-solid fa-rotate"></i> ${t('check')}</button>
 <div class="order-reference"><span>Order ID</span><b>${esc(data.order_id)}</b><button type="button" id="copyOrder" aria-label="Copy order ID"><i class="fa-regular fa-copy"></i></button></div>
 </section><aside class="payment-side"><section class="payment-info-card"><h3><i class="fa-solid fa-list-ol"></i> ${t('how')}</h3><ol><li>${t('step1')}</li><li>${t('step2')}</li><li>${t('step3')}</li><li>${t('step4')}</li></ol></section><section class="payment-info-card support-card"><h3><i class="fa-solid fa-headset"></i> ${t('support')}</h3><p>${t('supportText')}</p></section>${guestCheckout?`<div class="guest-checkout-note"><i class="fa-solid fa-user-shield"></i><span>${t('guestWarn')}</span></div>`:''}</aside></div></div>`;
 document.getElementById('paymentLanguage').onclick=()=>setLanguage(lang==='id'?'en':'id');
 document.getElementById('checkPay').onclick=()=>checkStatus(true);
 document.getElementById('copyOrder').onclick=async()=>{try{await navigator.clipboard.writeText(data.order_id);document.getElementById('copyOrder').innerHTML='<i class="fa-solid fa-check"></i>'}catch{}};
 if(payTimer)clearInterval(payTimer);payTimer=setInterval(()=>checkStatus(false),8000);checkStatus(false);
}
async function checkStatus(manual=false){
 if(!order)return;const msg=document.getElementById('checkMessage'),btn=document.getElementById('checkPay');if(!msg||!btn)return;
 if(manual){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> '+t('processing')}
 try{const {data,error}=await sb.functions.invoke('payment-status',{body:{order_id:order}});if(error||!data?.success)throw new Error(data?.error||error?.message||'Status check failed');
 const state=String(data.status||'PENDING').toUpperCase();document.getElementById('payState').textContent=state;
 if(state==='SETTLED'){if(payTimer)clearInterval(payTimer);msg.textContent=t('paid');await unlock();return}
 msg.textContent=manual?`Status: ${state}`:t('auto');
 }catch(e){msg.textContent=t('failed')}finally{if(manual&&document.getElementById('checkPay')){btn.disabled=false;btn.innerHTML=`<i class="fa-solid fa-rotate"></i> ${t('check')}`}}
}
async function unlock(){if(payTimer)clearInterval(payTimer);location.replace('/paste/'+encodeURIComponent(item.slug))}
window.addEventListener('beforeunload',()=>{if(payTimer)clearInterval(payTimer)});
init();
