const root=document.getElementById('downloadCheckout'),slug=new URLSearchParams(location.search).get('slug')||location.pathname.split('/').filter(Boolean).pop(),rp=n=>'Rp '+Number(n||0).toLocaleString('id-ID'),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let item,order=null,couponOptions=[],vipActive=false;
async function init(){
 let {data}=await sb.from('review_items').select('id,slug,title,description,price,access,status').eq('slug',slug).maybeSingle();item=data;
 if(!item){const r=await sb.from('review_items').select('id,slug,title,description,price,access,status').eq('id',slug).maybeSingle();item=r.data}
 if(!item||item.status!=='published'){root.textContent='Konten tidak ditemukan';return}
 const {data:{user}}=await sb.auth.getUser();
 if(!user){root.innerHTML=`<h1>${esc(item.title)}</h1><p>Login diperlukan untuk melanjutkan download.</p><a class="btn primary" href="/login.html">Masuk / Daftar</a>`;return}
 const {data:owned}=await sb.from('review_entitlements').select('id').eq('review_id',item.id).eq('user_id',user.id).maybeSingle();
 if(item.access==='free'||owned){await unlock();return}
 const [{data:profile},{data:coupons}]=await Promise.all([
  sb.from('profiles').select('vip_expires_at').eq('id',user.id).maybeSingle(),
  sb.from('discount_coupons').select('code,discount_percent,uses_total,uses_used,uses_reserved').eq('user_id',user.id)
 ]);
 vipActive=!!profile?.vip_expires_at&&new Date(profile.vip_expires_at)>new Date();
 couponOptions=(coupons||[]).filter(c=>c.uses_used+c.uses_reserved<c.uses_total);
 root.innerHTML=`<span class="eyebrow">KONFIRMASI PEMBELIAN</span><h1>${esc(item.title)}</h1><p>${esc(item.description)}</p>
 <div class="watch-card"><b>Status:</b> Belum dibeli<br><b>Harga normal:</b> ${rp(item.price)}<br>
 ${vipActive?'<b>Benefit VIP:</b> Diskon 20%':'<b>Status VIP:</b> Tidak aktif'}
 <div style="margin-top:14px"><label for="couponCode"><b>Kode diskon referral (opsional)</b></label>
 <select id="couponCode" style="display:block;width:100%;padding:12px;margin-top:7px;border-radius:9px"><option value="">Tanpa kode diskon</option>
 ${couponOptions.map(c=>`<option value="${esc(c.code)}">${esc(c.code)} — ${c.discount_percent}% (${c.uses_total-c.uses_used-c.uses_reserved} kali tersisa)</option>`).join('')}</select>
 <p id="discountPreview" style="margin-top:10px">Total setelah diskon: <b>${rp(Math.round(item.price*(vipActive ? 0.8 : 1)))}</b></p></div></div>
 <button class="btn primary" id="buyNow">Buy Now</button>`;
 const coupon=document.getElementById('couponCode');
 coupon.onchange=updatePreview;updatePreview();
 document.getElementById('buyNow').onclick=confirmBuy;
}
function updatePreview(){
 const c=couponOptions.find(x=>x.code===document.getElementById('couponCode')?.value);
 const percent=Math.max(vipActive?20:0,c?.discount_percent||0);
 const amount=Math.round(Number(item.price)*(100-percent)/100);
 document.getElementById('discountPreview').innerHTML=`Diskon ${percent}% · Total: <b>${rp(amount)}</b>${c&&vipActive?'<small style="display:block">Diskon VIP dan kode referral tidak ditumpuk; sistem memakai diskon terbesar.</small>':''}`;
 document.getElementById('buyNow').textContent=`Buy Now · ${rp(amount)}`;
}
function confirmBuy(){
 root.insertAdjacentHTML('beforeend',`<div class="modal" id="confirmModal"><div><h2>Persetujuan Pembelian</h2><p>Pastikan judul dan nominal sudah benar. Diskon VIP/kode referral diterapkan otomatis pada checkout.</p><label><input type="checkbox" id="agreeBuy"> Saya setuju melanjutkan pembelian ${esc(item.title)}.</label><div class="watch-actions" style="margin-top:18px"><button class="btn" id="cancelBuy">Batal</button><button class="btn primary" id="agreeBtn" disabled>Setuju & Proses</button></div></div></div>`);
 document.getElementById('agreeBuy').onchange=e=>document.getElementById('agreeBtn').disabled=!e.target.checked;
 document.getElementById('cancelBuy').onclick=()=>document.getElementById('confirmModal').remove();
 document.getElementById('agreeBtn').onclick=createOrder;
}
async function createOrder(){
 const b=document.getElementById('agreeBtn');b.disabled=true;b.textContent='Memproses...';
 try{
  const couponCode=document.getElementById('couponCode')?.value||null;
  const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'review_download',review_id:item.id,coupon_code:couponCode}});
  if(error)throw error;if(!data?.checkout_url)throw new Error(data?.error||'Checkout gagal');
  order=data.order_id;
  root.innerHTML=`<h1>Pembayaran ${esc(item.title)}</h1><p>Harga normal: ${rp(data.base_amount)}</p><p>Diskon: <b>${data.discount_percent||0}%</b></p><p>Nominal bayar: <b>${rp(data.amount)}</b></p><p>Status: <b id="payState">MENUNGGU PEMBAYARAN</b></p>${data.qrUrl?`<img src="${esc(data.qrUrl)}" alt="QR pembayaran Cashi" style="display:block;width:min(300px,100%);margin:16px auto">`:'<p>QR tidak tersedia, gunakan halaman checkout Cashi.</p>'}<a class="btn primary" href="${esc(data.checkout_url)}" target="_blank" rel="noopener">Buka halaman pembayaran Cashi</a><h3>Cara bayar</h3><ol><li>Scan QR atau buka halaman Cashi.</li><li>Pilih metode pembayaran yang tersedia.</li><li>Selesaikan pembayaran sesuai nominal.</li><li>Tekan cek pembayaran; status juga diperiksa otomatis.</li></ol><button class="btn" id="checkPay">Cek pembayaran sekarang</button><p id="checkMessage">Memeriksa otomatis setiap 8 detik.</p>`;
  document.getElementById('checkPay').onclick=checkStatus;window.payTimer=setInterval(checkStatus,8000);
 }catch(e){root.innerHTML=`<p>Gagal membuat pembayaran: ${esc(e.message)}</p><button class="btn" onclick="location.reload()">Coba lagi</button>`}
}
async function checkStatus(){if(!order)return;const {data,error}=await sb.functions.invoke('payment-status',{body:{order_id:order}});if(error){document.getElementById('checkMessage').textContent='Belum dapat memeriksa status. Coba lagi.';return}document.getElementById('payState').textContent=data.status;if(data.status==='SETTLED'){clearInterval(window.payTimer);await unlock()}else document.getElementById('checkMessage').textContent='Status: '+data.status+' · Pemeriksaan otomatis aktif.'}
async function unlock(){const {data,error}=await sb.functions.invoke('download-link',{body:{review_id:item.id}});if(error){root.innerHTML=`<h2>Pembayaran berhasil / konten gratis</h2><p>${esc(error.message)}</p><p>Jika baru membayar, tunggu beberapa saat lalu muat ulang.</p>`;return}root.innerHTML=`<h1>Akses download tersedia</h1><p>${esc(item.title)}</p><p>Pembayaran telah terverifikasi.</p>${data.content_after_payment?`<div class="watch-card">${esc(data.content_after_payment)}</div>`:''}<a class="btn primary" href="${esc(data.download_url)}" target="_blank" rel="noopener">Download Sekarang</a>`}
init();
