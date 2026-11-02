import { sb } from '../js/config.js';
const params=new URLSearchParams(location.search), id=params.get('id'), telegramId=params.get('telegram');
const box=document.getElementById('watchContent');
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl=u=>{try{const x=new URL(u);return ['https:'].includes(x.protocol)?x.href:null}catch{return null}};
async function download(itemId){
 const {data,error}=await sb.rpc('get_telegram_download',{p_item_id:itemId});
 if(error){box.insertAdjacentHTML('beforeend',`<p class="notice">${esc(error.message.includes('PAYMENT_REQUIRED')?'Pembayaran belum terverifikasi. Silakan selesaikan pembayaran terlebih dahulu.':error.message)}</p>`);return}
 const url=safeUrl(data); if(!url){box.insertAdjacentHTML('beforeend','<p class="notice">URL download tidak valid.</p>');return}
 window.open(url,'_blank','noopener');
}
async function load(){
 if(telegramId){
  const {data:v,error}=await sb.from('telegram_items').select('id,title,type,review_embed_url,price,categories(name)').eq('id',telegramId).eq('status','published').single();
  if(error||!v){box.textContent='Konten tidak ditemukan.';return}
  if(v.type==='free'){box.innerHTML=`<h1>${esc(v.title)}</h1><p>Konten Free siap diunduh.</p><button class="btn primary" id="downloadTelegram">Download</button>`;document.getElementById('downloadTelegram').onclick=()=>download(v.id);return}
  const review=safeUrl(v.review_embed_url||'');
  box.innerHTML=`<h1>${esc(v.title)}</h1><p>${esc(v.categories?.name||'Konten Paid')} · Rp ${Number(v.price).toLocaleString('id-ID')}</p>${review?`<div class="player"><iframe src="${esc(review)}" allowfullscreen loading="lazy" referrerpolicy="no-referrer"></iframe></div>`:'<p>Review belum tersedia.</p>'}<p>Download hanya tersedia setelah pembayaran diverifikasi.</p><button class="btn primary" id="createOrder">Buat pesanan</button><p id="orderMessage" class="notice"></p>`;
  document.getElementById('createOrder').onclick=async()=>{const {data:{user}}=await sb.auth.getUser();if(!user){location.href='login.html';return}const {data,error}=await sb.rpc('create_telegram_order',{p_item_id:v.id});document.getElementById('orderMessage').textContent=error?error.message:`Pesanan ${data} dibuat. Pembayaran otomatis belum dikonfigurasi; admin perlu memverifikasi pembayaran.`};
  return;
 }
 if(!id){box.textContent='Video tidak ditemukan.';return}
 const {data:{user}}=await sb.auth.getUser();
 const {data:v,error}=await sb.from('videos').select('id,title,provider,embed_url,access,download_enabled,download_url,categories(name)').eq('id',id).eq('status','published').single();
 if(error||!v){box.innerHTML='<h1>Video tidak tersedia</h1><p>Konten memerlukan akses yang sesuai atau sudah tidak dipublikasikan.</p><a class="btn primary" href="login.html">Login</a>';return}
 if(v.access==='vip'&&!user){box.innerHTML='<h1>Video VIP</h1><p>Silakan login dan pastikan VIP aktif.</p><a class="btn primary" href="login.html">Login</a>';return}
 const embed=safeUrl(v.embed_url||'');if(!embed){box.textContent='URL video tidak valid.';return}
 box.innerHTML=`<div class="player"><iframe src="${esc(embed)}" allowfullscreen loading="lazy" referrerpolicy="no-referrer"></iframe></div><h1>${esc(v.title)}</h1><p>${esc(v.categories?.name||'')}</p>${v.download_enabled&&v.download_url&&safeUrl(v.download_url)?`<a class="btn primary" href="${esc(safeUrl(v.download_url))}" target="_blank" rel="noopener">↓ Download</a>`:'<div class="notice">Download tidak aktif untuk konten ini.</div>'}`;
}
load();
