(() => {
'use strict';
const $ = id => document.getElementById(id);
const escA = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const langA = () => localStorage.getItem('boxcellink_lang') === 'en' ? 'en' : 'id';
const copyA = {
 id:{
  account:'Akun',membership:'Membership',membership_desc:'Status akses akun saat ini',security:'Keamanan',protected:'Akun terlindungi',security_desc:'Dikelola melalui Supabase Auth',
  personal_settings:'PENGATURAN PERSONAL',account_settings:'Pengaturan Akun',settings_desc:'Perbarui informasi login dan jaga keamanan akunmu.',
  change_email:'Ganti Email',email_desc:'Perbarui alamat email akun.',new_email:'Email baru',send_confirmation:'Kirim konfirmasi',email_hint:'Konfirmasi akan dikirim ke alamat email baru.',
  change_password:'Ganti Kata Sandi',password_desc:'Gunakan kata sandi yang kuat.',new_password:'Kata sandi baru',update_password:'Perbarui kata sandi',password_hint:'Minimal 8 karakter untuk keamanan akun.',
  your_library:'KOLEKSI MEDIA KAMU',telegram_media:'Media Telegram Saya',library_desc:'Semua review yang sudah berhasil kamu beli akan otomatis tersimpan di sini.',items:'MEDIA',verified_purchases:'Pembelian terverifikasi',access_anytime:'Akses dari halaman akun',loading_library:'Memuat media Telegram...',
  recent_activity:'AKTIVITAS TERBARU',watch_history:'Riwayat Tonton',watch_desc:'Lanjutkan video BoxVidey yang pernah kamu buka.',loading_history:'Memuat riwayat tontonan...',
  exclusive_access:'AKSES EKSKLUSIF',vip_groups:'Group VIP Telegram',groups_desc:'Kelola undangan group VIP yang sudah kamu beli.',loading_groups:'Memuat akses group...',
  basic:'Basic / Free',admin:'Administrator',premium_until:'Premium aktif sampai',vip_until:'VIP aktif sampai',account_error:'Gagal memuat informasi akun',
  purchased:'Dibeli',open_media:'Buka Media',details:'Detail Review',no_media:'Belum ada media yang dibeli.',no_media_desc:'Review yang kamu beli akan muncul otomatis di bagian ini setelah pembayaran berhasil diverifikasi.',purchase_success:'Pembelian berhasil',verified:'Akses aktif',price:'Total pembayaran',watch_again:'Tonton lagi',watched:'Ditonton',
  no_history:'Belum ada riwayat tontonan.',no_groups:'Belum ada Group VIP yang dibeli.',group_success:'Pembayaran Group VIP berhasil!',group_active:'Akses group aktif.',invite_until:'Link undangan aktif sampai',invite_expired:'Link undangan telah kedaluwarsa',join_group:'Masuk Group',expired:'Link berakhir',
  email_sent:'Tautan konfirmasi dikirim ke email baru.',password_updated:'Kata sandi berhasil diperbarui.',email_failed:'Gagal memperbarui email.',password_failed:'Gagal memperbarui kata sandi.',
  load_failed:'Riwayat media tidak dapat dimuat.',order_fallback:'Menampilkan pembelian yang telah terverifikasi.',retry:'Coba muat ulang',sign_in:'Silakan login untuk melihat akun.'
 },
 en:{
  account:'Account',membership:'Membership',membership_desc:'Your current account access',security:'Security',protected:'Account protected',security_desc:'Managed securely with Supabase Auth',
  personal_settings:'PERSONAL SETTINGS',account_settings:'Account settings',settings_desc:'Update your login details and keep your account secure.',
  change_email:'Change email',email_desc:'Update your account email address.',new_email:'New email',send_confirmation:'Send confirmation',email_hint:'A confirmation link will be sent to your new email.',
  change_password:'Change password',password_desc:'Choose a strong password.',new_password:'New password',update_password:'Update password',password_hint:'At least 8 characters for account security.',
  your_library:'YOUR MEDIA LIBRARY',telegram_media:'My Telegram Media',library_desc:'All reviews you have successfully purchased are automatically saved here.',items:'ITEMS',verified_purchases:'Verified purchases',access_anytime:'Access from your account page',loading_library:'Loading Telegram media...',
  recent_activity:'RECENT ACTIVITY',watch_history:'Watch history',watch_desc:'Continue watching BoxVidey videos you have opened.',loading_history:'Loading watch history...',
  exclusive_access:'EXCLUSIVE ACCESS',vip_groups:'VIP Telegram Groups',groups_desc:'Manage invitations for VIP groups you have purchased.',loading_groups:'Loading group access...',
  basic:'Basic / Free',admin:'Administrator',premium_until:'Premium active until',vip_until:'VIP active until',account_error:'Unable to load account information',
  purchased:'Purchased',open_media:'Open media',details:'Review details',no_media:'No purchased media yet.',no_media_desc:'Reviews you purchase will automatically appear here after payment is verified.',purchase_success:'Purchase successful',verified:'Access active',price:'Payment total',watch_again:'Watch again',watched:'Watched',
  no_history:'No watch history yet.',no_groups:'No VIP Telegram groups purchased yet.',group_success:'VIP Group payment successful!',group_active:'Group access is active.',invite_until:'Invitation link active until',invite_expired:'Invitation link has expired',join_group:'Join group',expired:'Link expired',
  email_sent:'A confirmation link has been sent to your new email.',password_updated:'Your password has been updated.',email_failed:'Unable to update email.',password_failed:'Unable to update password.',
  load_failed:'Unable to load purchased media.',order_fallback:'Showing verified purchases.',retry:'Reload',sign_in:'Please sign in to view your account.'
 }
};
const t = key => copyA[langA()][key] || copyA.id[key] || key;
const dateA = value => value ? new Date(value).toLocaleString(langA()==='en'?'en-US':'id-ID',{dateStyle:'medium',timeStyle:'short'}) : '—';
const moneyA = value => 'Rp '+Number(value||0).toLocaleString('id-ID');
function showNotice(message,type='info'){
 const el=$('accountNotice'); if(!el)return;
 el.hidden=false;el.className='account-notice '+(type==='error'?'is-error':type==='success'?'is-success':'');
 el.innerHTML=`<i class="fa-solid ${type==='error'?'fa-circle-exclamation':type==='success'?'fa-circle-check':'fa-circle-info'}"></i><span>${escA(message)}</span>`;
}
function emptyState(icon,title,desc=''){
 return `<div class="account-empty"><span><i class="fa-solid ${icon}"></i></span><b>${escA(title)}</b>${desc?`<p>${escA(desc)}</p>`:''}</div>`;
}
function renderPurchases(items,usingFallback=false){
 const host=$('purchaseLinks'),count=$('purchaseCount'); if(!host)return;
 if(count)count.innerHTML=`${items.length} <span>${escA(t('items'))}</span>`;
 if(!items.length){host.innerHTML=emptyState('fa-box-open',t('no_media'),t('no_media_desc'));return;}
 host.innerHTML=items.map(item=>{
  const title=item.review_items?.title||item.title||'Media Telegram';
  const slug=item.review_items?.slug||item.slug||'';
  const thumb=item.review_items?.thumbnail_url||item.thumbnail_url||'';
  const bought=item.created_at||item.settled_at;
  const price=item.amount??item.price;
  const mediaUrl=slug?`/paste/${encodeURIComponent(slug)}`:'#';
  const detailUrl=slug?`/r/${encodeURIComponent(slug)}`:'#';
  return `<article class="library-item">
    <div class="library-thumb">${thumb?`<img src="${escA(thumb)}" alt="${escA(title)}" loading="lazy" onerror="this.remove();this.parentElement.innerHTML='<i class=&quot;fa-brands fa-telegram&quot;></i>'">`:'<i class="fa-brands fa-telegram"></i>'}<span class="library-check"><i class="fa-solid fa-check"></i></span></div>
    <div class="library-info"><div class="library-tags"><span class="tag-purchased"><i class="fa-solid fa-circle-check"></i> ${escA(t('purchase_success'))}</span><span class="tag-access">${escA(t('verified'))}</span></div>
      <h3>${escA(title)}</h3><p><i class="fa-regular fa-calendar-check"></i> ${escA(t('purchased'))} ${escA(dateA(bought))}</p>
      ${price!=null?`<small class="library-price">${escA(t('price'))}: <b>${escA(moneyA(price))}</b></small>`:''}
    </div>
    <div class="library-actions">${slug?`<a class="account-action" href="${mediaUrl}"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${escA(t('open_media'))}</a><a class="library-detail-link" href="${detailUrl}">${escA(t('details'))} <i class="fa-solid fa-arrow-right"></i></a>`:'<span class="expired-link">Review unavailable</span>'}</div>
  </article>`;
 }).join('');
 if(usingFallback) showNotice(t('order_fallback'),'success');
}
async function loadPurchasedMedia(user){
 const host=$('purchaseLinks');
 // The entitlement is the canonical access record. Settled orders are also
 // queried as a recovery path so a completed payment remains visible if an
 // older settlement missed creating its entitlement row.
 const [entRes,orderRes]=await Promise.all([
  sb.from('review_entitlements').select('id,review_id,created_at,order_id,review_items(id,title,slug,thumbnail_url,price,access)').eq('user_id',user.id).order('created_at',{ascending:false}),
  sb.from('cashi_orders').select('order_id,review_id,amount,created_at,settled_at,status').eq('user_id',user.id).eq('purpose','review_download').eq('status','SETTLED').order('settled_at',{ascending:false})
 ]);
 if(entRes.error && orderRes.error){
  host.innerHTML=emptyState('fa-triangle-exclamation',t('load_failed'),entRes.error.message||orderRes.error.message);
  return;
 }
 const merged=new Map();
 for(const row of (entRes.data||[])){
  const item=row.review_items||{};
  merged.set(row.review_id,{...row,...item,review_items:item,created_at:row.created_at});
 }
 const orders=orderRes.data||[];
 const missingIds=[...new Set(orders.map(o=>o.review_id).filter(id=>{
  if(!id)return false;
  const existing=merged.get(id);
  return !existing || !(existing.slug || existing.review_items?.slug);
 }))];
 let missingItems=[];
 if(missingIds.length){
  const {data,error}=await sb.from('review_items').select('id,title,slug,thumbnail_url,price,access').in('id',missingIds);
  if(!error)missingItems=data||[];
 }
 const itemById=new Map(missingItems.map(x=>[x.id,x]));
 for(const order of orders){
  const existing=merged.get(order.review_id);
  const item=itemById.get(order.review_id);
  if(existing){
   if(item)merged.set(order.review_id,{...existing,...item,review_items:item,amount:order.amount,settled_at:order.settled_at});
   continue;
  }
  if(item)merged.set(order.review_id,{...item,review_items:item,order_id:order.order_id,created_at:order.settled_at||order.created_at,settled_at:order.settled_at,amount:order.amount});
 }
 const items=[...merged.values()].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
 renderPurchases(items,!!items.length&&!((entRes.data||[]).length));
}
async function initAccount(){
 if(!window.sb?.auth)throw new Error('Supabase client unavailable');
 const {data:{user},error:authError}=await sb.auth.getUser();
 if(authError)throw authError;
 if(!user){location.replace('/login.html?next='+encodeURIComponent('/account'));return;}
 const {data:p,error:profileError}=await sb.from('profiles').select('full_name,vip_expires_at,premium_expires_at,role').eq('id',user.id).maybeSingle();
 if(profileError)console.warn('Account profile:',profileError.message);
 $('accountName').textContent=p?.full_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'—';
 $('accountEmail').textContent=user.email||'—';
 const now=new Date(),premium=p?.premium_expires_at&&new Date(p.premium_expires_at)>now,vip=p?.vip_expires_at&&new Date(p.vip_expires_at)>now;
 $('accountStatus').textContent=p?.role==='admin'?t('admin'):premium?`${t('premium_until')} ${dateA(p.premium_expires_at)}`:vip?`${t('vip_until')} ${dateA(p.vip_expires_at)}`:t('basic');
 showNotice(langA()==='en'?'Email changes require confirmation from Supabase Auth.':'Perubahan email memerlukan konfirmasi dari Supabase Auth. Pastikan email baru dapat menerima pesan.');
 $('emailForm').onsubmit=async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;
  try{const {error}=await sb.auth.updateUser({email:$('newEmail').value.trim()});if(error)throw error;showNotice(t('email_sent'),'success');e.currentTarget.reset();}
  catch(err){showNotice(`${t('email_failed')} ${err.message||''}`,'error');}
  finally{btn.disabled=false;}
 };
 $('passwordForm').onsubmit=async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;
  try{const {error}=await sb.auth.updateUser({password:$('newPassword').value});if(error)throw error;showNotice(t('password_updated'),'success');e.currentTarget.reset();}
  catch(err){showNotice(`${t('password_failed')} ${err.message||''}`,'error');}
  finally{btn.disabled=false;}
 };
 await loadPurchasedMedia(user);

 const {data:groups,error:gerror}=await sb.rpc('get_my_vip_group_entitlements');
 $('groupLinks').innerHTML=gerror?emptyState('fa-triangle-exclamation',langA()==='en'?'Group history unavailable':'Riwayat group belum dapat dimuat',gerror.message):(groups||[]).map(x=>{
  const expires=x.invite_expires_at?new Date(x.invite_expires_at):new Date(new Date(x.purchased_at).getTime()+12*3600000),valid=expires>now;
  return `<article class="purchase-row account-simple-row"><span class="simple-row-icon"><i class="fa-brands fa-telegram"></i></span><div><b>${escA(x.group_name||'VIP Telegram')}</b><small>${valid?t('invite_until')+' '+escA(dateA(expires)):t('invite_expired')}</small></div>${valid&&x.telegram_url?`<a class="account-action" href="${escA(x.telegram_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${escA(t('join_group'))}</a>`:`<span class="expired-link">${escA(t('expired'))}</span>`}</article>`;
 }).join('')||emptyState('fa-users',t('no_groups'));
 const freshGroup=(groups||[]).find(x=>new Date(x.purchased_at)>new Date(Date.now()-12*3600000)&&x.telegram_url&&(!x.invite_expires_at||new Date(x.invite_expires_at)>now));
 const successBox=$('groupPurchaseSuccess');
 if(freshGroup&&successBox){successBox.hidden=false;successBox.innerHTML=`<i class="fa-solid fa-circle-check"></i><div><b>${escA(t('group_success'))}</b><span>${escA(t('group_active'))} ${escA(freshGroup.group_name||'VIP Telegram')} · ${escA(t('invite_until'))} ${escA(dateA(freshGroup.invite_expires_at||new Date(new Date(freshGroup.purchased_at).getTime()+12*3600000)))}</span></div>`;}

 const {data:history,error:historyError}=await sb.from('video_watch_history').select('watched_at,videos(title,slug,thumbnail_url)').eq('user_id',user.id).order('watched_at',{ascending:false}).limit(50);
 $('watchHistory').innerHTML=historyError?emptyState('fa-clock',langA()==='en'?'Watch history unavailable':'Riwayat tonton belum tersedia',historyError.message):(history||[]).map(x=>`<article class="purchase-row account-simple-row"><span class="simple-row-icon">${x.videos?.thumbnail_url?`<img src="${escA(x.videos.thumbnail_url)}" alt="">`:'<i class="fa-solid fa-play"></i>'}</span><div><b>${escA(x.videos?.title||'Video BoxVidey')}</b><small>${escA(t('watched'))} ${escA(dateA(x.watched_at))}</small></div>${x.videos?.slug?`<a class="account-action" href="/v/${encodeURIComponent(x.videos.slug)}"><i class="fa-solid fa-play"></i> ${escA(t('watch_again'))}</a>`:''}</article>`).join('')||emptyState('fa-clock',t('no_history'));
}
document.addEventListener('DOMContentLoaded',()=>initAccount().catch(error=>{
 console.error('BoxCellink account:',error);
 const notice=$('accountNotice');if(notice){notice.hidden=false;notice.className='account-notice is-error';notice.innerHTML=`<i class="fa-solid fa-circle-exclamation"></i><span>${escA(t('account_error'))}: ${escA(error.message||'Unknown error')}</span>`;}
}));
})();