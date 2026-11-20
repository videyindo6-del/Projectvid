(()=>{'use strict';
const $=id=>document.getElementById(id),orderId=new URLSearchParams(location.search).get('order_id');
let pending=null,user=null,stopped=false,timer=null,busy=false,settled=false,attempt=0;
const money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
const MAX_CHECK_WINDOW=24*60*60*1000;
const safeMessage=value=>String(value??'').slice(0,600);
function status(message,type='pending'){
 const el=$('vgStatus');if(!el)return;
 el.className='vg-status'+(type==='success'?' is-success':type==='error'?' is-error':'');
 const icon=el.querySelector('i'),label=el.querySelector('span');
 if(icon)icon.className='fa-solid '+(type==='success'?'fa-circle-check':type==='error'?'fa-circle-exclamation':'fa-clock');
 if(label)label.textContent=safeMessage(message);
}
function expiryTime(){
 const parsed=pending?.expires_at?Date.parse(pending.expires_at):NaN;
 const created=pending?.created_at?Date.parse(pending.created_at):Date.now();
 return Number.isFinite(parsed)?parsed:created+MAX_CHECK_WINDOW;
}
function renderQr(){
 const panel=$('vgQr'),qr=String(pending?.qr_url||'').trim();if(!panel)return;panel.replaceChildren();
 if(qr&&(/^https:\/\//i.test(qr)||/^data:image\//i.test(qr))){
  const img=document.createElement('img');img.src=qr;img.alt='QRIS pembayaran Group VIP';img.loading='eager';img.referrerPolicy='no-referrer';
  img.onerror=()=>{panel.innerHTML='<div class="vg-qr-empty"><i class="fa-solid fa-qrcode"></i><b>QR tidak dapat dimuat</b><span>Buka halaman pembayaran Cashi untuk melihat QRIS.</span></div>';};panel.append(img);
 }else{
  panel.innerHTML='<div class="vg-qr-empty"><i class="fa-solid fa-qrcode"></i><b>QRIS dari Cashi</b><span>Jika QR tidak tampil, buka halaman pembayaran Cashi di bawah.</span></div>';
 }
 const fallback=$('vgFallback');if(fallback&&pending?.checkout_url){fallback.href=pending.checkout_url;fallback.hidden=false;}
}
function schedule(nextDelay){
 if(stopped||document.hidden)return;
 clearTimeout(timer);
 const remaining=expiryTime()-Date.now();
 // Keep checking after QR expiry if Cashi has already reported payment; the
 // server may still need a retry to publish the buyer's entitlement.
 if(!settled&&remaining<=0){stopped=true;status('Batas waktu pembayaran telah berakhir. Jika Anda sudah membayar, tekan Periksa pembayaran untuk verifikasi akhir.','error');return;}
 const delay=settled?5000:Math.min(15000,Math.max(5000,nextDelay||5000));
 timer=setTimeout(check,delay);
}
async function showAccess(){
 const {data,error}=await sb.rpc('get_my_vip_group_entitlements');if(error)throw error;
 const row=(data||[]).find(x=>x.group_id===pending.group_id&&x.telegram_url&&(!x.invite_expires_at||Date.parse(x.invite_expires_at)>Date.now()));
 if(!row)throw new Error('Pembayaran sudah berhasil. Sistem sedang menyiapkan akses grup. Pemeriksaan akan diulang otomatis.');
 const join=$('vgJoin');if(join)join.href=row.telegram_url;
 $('vgSuccess').hidden=false;$('vgQr').hidden=true;$('vgFallback').hidden=true;$('vgCheck').hidden=true;
 status('Pembayaran berhasil diverifikasi. Akses grup sudah aktif.','success');
}
async function check(){
 if(busy||!user||!orderId)return;
 if(stopped&&!settled)return;
 busy=true;const checkButton=$('vgCheck');if(checkButton)checkButton.disabled=true;
 status(settled?'Pembayaran berhasil. Memastikan link grup aktif…':'Memeriksa status pembayaran ke Cashi…');
 try{
  const {data,error}=await sb.functions.invoke('payment-status',{body:{order_id:orderId}});
  if(error)throw error;
  const state=String(data?.status||'').toUpperCase();
  if(state==='SETTLED'||state==='PAID'||state==='SUCCESS'){
   settled=true;attempt=0;
   try{await showAccess();stopped=true;clearTimeout(timer);return;}
   catch(e){status(e.message||'Pembayaran berhasil. Link grup sedang disiapkan.','pending');}
  }else if(['FAILED','EXPIRED','CANCELLED','CANCELED'].includes(state)){
   stopped=true;clearTimeout(timer);status('Pembayaran gagal atau kedaluwarsa. Silakan buat pesanan baru.','error');return;
  }else{
   attempt++;status('Menunggu pembayaran Anda. Status akan diperiksa otomatis.');
  }
 }catch(e){attempt++;status(e?.message||'Belum dapat memeriksa pembayaran. Sistem akan mencoba kembali.','error');}
 finally{busy=false;if(checkButton)checkButton.disabled=false;}
 schedule(attempt<3?5000:15000);
}
async function init(){
 try{
  if(!window.sb?.auth)throw new Error('Konfigurasi Supabase tidak tersedia.');
  if(!orderId)throw new Error('Order ID tidak ditemukan.');
  const {data:{user:u},error}=await sb.auth.getUser();if(error)throw error;user=u;
  if(!user)throw new Error('Silakan login dengan akun yang digunakan saat membeli Group VIP.');
  pending=JSON.parse(localStorage.getItem('boxcellink_pending_group_'+orderId)||'null');
  if(!pending||pending.order_id!==orderId||pending.user_id!==user.id)throw new Error('Data pesanan tidak ditemukan pada perangkat ini. Silakan kembali ke halaman Group VIP.');
  $('groupName').textContent=pending.group_name||'Group VIP';$('groupAmount').textContent=money(pending.amount);renderQr();
  await check();
 }catch(e){status(e.message||'Gagal memuat pembayaran.','error');}
}
$('vgCheck')?.addEventListener('click',()=>{clearTimeout(timer);stopped=false;check();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!stopped&&!busy){clearTimeout(timer);check();}});
init();
})();
