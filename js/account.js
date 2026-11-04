const escA=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateA=v=>v?new Date(v).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'—';
async function initAccount(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){location.href='login.html?next='+encodeURIComponent('/account.html');return}
 const {data:p}=await sb.from('profiles').select('full_name,vip_expires_at,premium_expires_at,role').eq('id',user.id).maybeSingle();
 document.getElementById('accountName').textContent=p?.full_name||user.user_metadata?.full_name||'—';
 document.getElementById('accountEmail').textContent=user.email||'—';
 const now=new Date(),premium=p?.premium_expires_at&&new Date(p.premium_expires_at)>now,vip=p?.vip_expires_at&&new Date(p.vip_expires_at)>now;
 document.getElementById('accountStatus').textContent=p?.role==='admin'?'Administrator':premium?'Premium aktif sampai '+dateA(p.premium_expires_at):vip?'VIP aktif sampai '+dateA(p.vip_expires_at):'Basic / Free';
 const notice=document.getElementById('accountNotice');notice.hidden=false;notice.textContent='Perubahan email memerlukan konfirmasi dari Supabase Auth. Pastikan email baru dapat menerima pesan.';
 document.getElementById('emailForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.auth.updateUser({email:document.getElementById('newEmail').value.trim()});alert(error?.message||'Tautan konfirmasi dikirim ke email baru.');};
 document.getElementById('passwordForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.auth.updateUser({password:document.getElementById('newPassword').value});alert(error?.message||'Kata sandi berhasil diperbarui.');if(!error)e.target.reset()};
 const purchases=document.getElementById('purchaseLinks');
 const {data:ents,error}=await sb.from('review_entitlements').select('id,created_at,review_items(title,slug,thumbnail_url)').eq('user_id',user.id).order('created_at',{ascending:false});
 purchases.innerHTML=error?`<p class="account-error">${escA(error.message)}</p>`:(ents||[]).map(x=>`<article class="purchase-row"><div class="account-row-main">${x.review_items?.thumbnail_url?`<img src="${escA(x.review_items.thumbnail_url)}" alt="">`:'<span class="account-row-icon"><i class="fa-brands fa-telegram"></i></span>'}<span><b>${escA(x.review_items?.title||'Media Telegram')}</b><small>Dibeli ${dateA(x.created_at)}</small></span></div><a class="btn primary" href="/r/${encodeURIComponent(x.review_items?.slug||'')}">Buka media</a></article>`).join('')||'<p>Belum ada pembelian media Telegram.</p>';
 const {data:groups,gerror}=await sb.rpc('get_my_vip_group_entitlements');
 document.getElementById('groupLinks').innerHTML=gerror?'<p>Riwayat group belum dapat dimuat. Jalankan migrasi Group VIP terbaru.</p>':(groups||[]).map(x=>{
   const expires=x.invite_expires_at?new Date(x.invite_expires_at):new Date(new Date(x.purchased_at).getTime()+12*3600000),valid=expires>now;
   return `<article class="purchase-row"><div><b>${escA(x.group_name||'VIP Telegram')}</b><small>Pembelian berhasil · ${valid?'Link aktif sampai '+dateA(expires):'Link undangan telah kedaluwarsa'}</small></div>${valid&&x.telegram_url?`<a class="btn primary" href="${escA(x.telegram_url)}" target="_blank" rel="noopener">Masuk Group</a>`:'<span class="expired-link">Link berakhir</span>'}</article>`;
 }).join('')||'<p>Belum ada Group VIP yang dibeli.</p>';
 const freshGroup=(groups||[]).find(x=>new Date(x.purchased_at)>new Date(Date.now()-12*3600000)&&x.telegram_url&&(!x.invite_expires_at||new Date(x.invite_expires_at)>now));
 const successBox=document.getElementById('groupPurchaseSuccess');
 if(freshGroup&&successBox){successBox.hidden=false;successBox.innerHTML=`<i class="fa-solid fa-circle-check"></i><div><b>Pembayaran Group VIP berhasil!</b><span>Akses ${escA(freshGroup.group_name||'Group VIP')} sudah aktif. Link undangan tersedia sampai ${dateA(freshGroup.invite_expires_at||new Date(new Date(freshGroup.purchased_at).getTime()+12*3600000))}.</span></div>`;}
 const watch=document.getElementById('watchHistory');
 const {data:history,error:historyError}=await sb.from('video_watch_history').select('watched_at,videos(title,slug,thumbnail_url)').eq('user_id',user.id).order('watched_at',{ascending:false}).limit(50);
 watch.innerHTML=historyError?`<p class="account-error">Riwayat tonton belum tersedia. Jalankan migrasi BoxCellink terbaru.</p>`:(history||[]).map(x=>`<article class="purchase-row"><div class="account-row-main">${x.videos?.thumbnail_url?`<img src="${escA(x.videos.thumbnail_url)}" alt="">`:'<span class="account-row-icon"><i class="fa-solid fa-play"></i></span>'}<span><b>${escA(x.videos?.title||'Video BoxVidey')}</b><small>Ditonton ${dateA(x.watched_at)}</small></span></div>${x.videos?.slug?`<a class="btn primary" href="/v/${encodeURIComponent(x.videos.slug)}">Tonton lagi</a>`:''}</article>`).join('')||'<p>Belum ada riwayat tontonan BoxVidey.</p>';
}
initAccount().catch(e=>{console.error(e);document.getElementById('accountNotice').textContent='Gagal memuat informasi akun: '+(e.message||'Kesalahan tidak diketahui')});