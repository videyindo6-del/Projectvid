(() => {
'use strict';
const $ = id => document.getElementById(id);
const escA = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const langA = () => localStorage.getItem('boxcellink_lang') === 'en' ? 'en' : 'id';
const copyA = {
 id:{
  account:'Akun',hero_title:'Akun Saya',hero_desc:'Kelola profil, keamanan akun, membership, dan seluruh media yang sudah kamu beli dalam satu tempat.',secure_label:'Secure account',instant_label:'Akses instan',upgrade_title:'Upgrade Status Account',upgrade_desc:'Nikmati pengalaman BoxCellink yang lebih nyaman dengan status VIP.',benefit_no_ads:'Nonton BoxVidey tanpa iklan',benefit_discount:'Diskon 20% untuk pembelian Review yang memenuhi syarat',benefit_exclusive:'Akses video khusus VIP selama masa aktif',upgrade_button:'Upgrade ke VIP',old_email:'Gmail lama',current_email:'Gmail akun',membership:'Membership',membership_desc:'Status akses akun saat ini',security:'Keamanan',protected:'Akun terlindungi',security_desc:'Dikelola melalui Supabase Auth',
  personal_settings:'PENGATURAN PERSONAL',account_settings:'Pengaturan Akun',settings_desc:'Perbarui informasi login dan jaga keamanan akunmu.',
  change_email:'Ganti Email',email_desc:'Masukkan Gmail lama dan Gmail baru untuk mengajukan perubahan alamat akun.',new_email:'Gmail baru',send_confirmation:'Ganti Gmail',change_email_button:'Ganti Gmail sekarang',email_hint:'Gmail akun akan langsung diperbarui setelah berhasil diproses.',
  change_password:'Ganti Kata Sandi',password_desc:'Konfirmasi Gmail akun saat ini, lalu masukkan kata sandi baru.',new_password:'Kata sandi baru',update_password:'Perbarui kata sandi',password_hint:'Masukkan Gmail akun dan kata sandi baru (minimal 8 karakter).',
  your_library:'KOLEKSI MEDIA KAMU',telegram_media:'Media Telegram Saya',library_desc:'Semua review yang sudah berhasil kamu beli akan otomatis tersimpan di sini.',items:'MEDIA',verified_purchases:'Pembelian terverifikasi',access_anytime:'Akses dari halaman akun',loading_library:'Memuat media Telegram...',
  recent_activity:'AKTIVITAS TERBARU',watch_history:'Riwayat Tonton',watch_desc:'Lanjutkan video BoxVidey yang pernah kamu buka.',loading_history:'Memuat riwayat tontonan...',
  exclusive_access:'AKSES EKSKLUSIF',vip_groups:'Group VIP Telegram',groups_desc:'Kelola undangan group VIP yang sudah kamu beli.',loading_groups:'Memuat akses group...',
  basic:'Basic / Free',admin:'Administrator',premium_until:'Premium aktif sampai',vip_until:'VIP aktif sampai',account_error:'Gagal memuat informasi akun',
  purchased:'Dibeli',open_media:'Buka Media',details:'Detail Review',no_media:'Belum ada media yang dibeli.',no_media_desc:'Review yang kamu beli akan muncul otomatis di bagian ini setelah pembayaran berhasil diverifikasi.',purchase_success:'Pembelian berhasil',verified:'Akses aktif',price:'Total pembayaran',watch_again:'Tonton lagi',watched:'Ditonton',
  no_history:'Belum ada riwayat tontonan.',no_groups:'Belum ada Group VIP yang dibeli.',group_success:'Pembayaran Group VIP berhasil!',group_active:'Akses group aktif.',invite_until:'Link undangan aktif sampai',invite_expired:'Link undangan tidak tersedia. Hubungi admin untuk pembaruan.',join_group:'Masuk Group',expired:'Link tidak tersedia',check_link:'Cek link terbaru',copy_link:'Salin link',link_updated:'Link undangan mengikuti pengaturan terbaru admin.',group_notice:'Pembayaran berhasil! Akses Group VIP kamu sudah aktif.',
  email_sent:'Tautan konfirmasi dikirim ke email baru.',password_updated:'Kata sandi berhasil diperbarui.',email_failed:'Gagal memperbarui email.',password_failed:'Gagal memperbarui kata sandi.',
  load_failed:'Riwayat media tidak dapat dimuat.',order_fallback:'Menampilkan pembelian yang telah terverifikasi.',retry:'Coba muat ulang',previous:'Sebelumnya',next:'Berikutnya',email_request_ok:'Gmail berhasil diganti.',email_confirm_pending:'Alamat Gmail akun telah diperbarui.',sign_in:'Silakan login untuk melihat akun.'
 },
 en:{
  account:'Account',hero_title:'My Account',hero_desc:'Manage your profile, account security, membership, and all purchased media in one place.',secure_label:'Secure account',instant_label:'Instant access',upgrade_title:'Upgrade Account Status',upgrade_desc:'Enjoy a better BoxCellink experience with VIP membership.',benefit_no_ads:'Watch BoxVidey without ads',benefit_discount:'20% off eligible Review purchases',benefit_exclusive:'Access VIP-only videos while membership is active',upgrade_button:'Upgrade to VIP',old_email:'Old Gmail',current_email:'Account Gmail',membership:'Membership',membership_desc:'Your current account access',security:'Security',protected:'Account protected',security_desc:'Managed securely with Supabase Auth',
  personal_settings:'PERSONAL SETTINGS',account_settings:'Account settings',settings_desc:'Update your login details and keep your account secure.',
  change_email:'Change email',email_desc:'Enter your old and new Gmail addresses to update your account.',new_email:'New Gmail',send_confirmation:'Change Gmail',change_email_button:'Change Gmail now',email_hint:'Your account Gmail will be updated immediately after processing.',
  change_password:'Change password',password_desc:'Enter your account Gmail and a new password.',new_password:'New password',update_password:'Update password',password_hint:'Enter your account Gmail and a new password (at least 8 characters).',
  your_library:'YOUR MEDIA LIBRARY',telegram_media:'My Telegram Media',library_desc:'All reviews you have successfully purchased are automatically saved here.',items:'ITEMS',verified_purchases:'Verified purchases',access_anytime:'Access from your account page',loading_library:'Loading Telegram media...',
  recent_activity:'RECENT ACTIVITY',watch_history:'Watch history',watch_desc:'Continue watching BoxVidey videos you have opened.',loading_history:'Loading watch history...',
  exclusive_access:'EXCLUSIVE ACCESS',vip_groups:'VIP Telegram Groups',groups_desc:'Manage invitations for VIP groups you have purchased.',loading_groups:'Loading group access...',
  basic:'Basic / Free',admin:'Administrator',premium_until:'Premium active until',vip_until:'VIP active until',account_error:'Unable to load account information',
  purchased:'Purchased',open_media:'Open media',details:'Review details',no_media:'No purchased media yet.',no_media_desc:'Reviews you purchase will automatically appear here after payment is verified.',purchase_success:'Purchase successful',verified:'Access active',price:'Payment total',watch_again:'Watch again',watched:'Watched',
  no_history:'No watch history yet.',no_groups:'No VIP Telegram groups purchased yet.',group_success:'VIP Group payment successful!',group_active:'Group access is active.',invite_until:'Invitation link active until',invite_expired:'Invitation link has expired',join_group:'Join group',expired:'Link expired',
  email_sent:'A confirmation link has been sent to your new email.',password_updated:'Your password has been updated.',email_failed:'Unable to update email.',password_failed:'Unable to update password.',
  load_failed:'Unable to load purchased media.',order_fallback:'Showing verified purchases.',retry:'Reload',previous:'Previous',next:'Next',email_request_ok:'Gmail changed successfully.',email_confirm_pending:'Your account Gmail address has been updated.',sign_in:'Please sign in to view your account.'
 }
};
const t = key => copyA[langA()][key] || copyA.id[key] || key;
const dateA = value => value ? new Date(value).toLocaleString(langA()==='en'?'en-US':'id-ID',{dateStyle:'medium',timeStyle:'short'}) : '—';
const moneyA = value => 'Rp '+Number(value||0).toLocaleString('id-ID');
const accountThumbUrl = value => {
 let raw=typeof value==='string'?value.trim():String(value?.url||value?.src||value?.thumbnail_url||value?.embed_url||'').trim();
 if(!raw)return '';
 const iframe=raw.match(/<iframe[^>]+src=[\"']([^\"']+)/i),image=raw.match(/<img[^>]+src=[\"']([^\"']+)/i);
 if(iframe)raw=iframe[1];else if(image)raw=image[1];
 try{
  const u=new URL(raw,location.origin);if(!['http:','https:'].includes(u.protocol))return '';
  const driveId=u.pathname.match(/\/file\/d\/([^/]+)/)?.[1]||u.searchParams.get('id');
  if(u.hostname.includes('drive.google.com')&&driveId)return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`;
  if(u.hostname.includes('youtube.com')||u.hostname==='youtu.be'){
   const id=u.hostname==='youtu.be'?u.pathname.split('/').filter(Boolean)[0]:(u.searchParams.get('v')||u.pathname.match(/\/(?:embed|shorts|live)\/([^/]+)/)?.[1]);
   if(id)return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  }
  return u.href;
 }catch{return ''}
};
const accountThumbMarkup=(values,title,icon='fa-brands fa-telegram')=>{
 const candidates=(Array.isArray(values)?values:[values]).flatMap(value=>{
  if(typeof value==='string'){try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed;}catch{}}
  return [value];
 });
 const src=candidates.map(accountThumbUrl).find(Boolean)||'';
 if(!src)return `<span class="thumb-unavailable"><i class="${icon}"></i></span>`;
 if(/\\.(mp4|webm|ogg|m4v)(?:[?#].*)?$/i.test(src))return `<video class="account-thumb-media" src="${escA(src)}" muted playsinline autoplay loop preload="metadata" aria-label="${escA(title)}"></video>`;
 return `<img class="account-thumb-media" src="${escA(src)}" alt="${escA(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.remove();this.parentElement.classList.add('thumb-unavailable')">`;
};

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
 const pageSize=8;let page=1;
 const draw=()=>{
  const slice=items.slice((page-1)*pageSize,page*pageSize);
  host.innerHTML=`<div class="account-library-grid">${slice.map(item=>{
   const title=item.review_items?.title||item.title||'Media Telegram',slug=item.review_items?.slug||item.slug||'',thumb=item.review_items?.thumbnail_url||item.thumbnail_url||'',embed=item.review_items?.review_embed_url||item.review_embed_url||'',gallery=item.review_items?.gallery_urls||item.gallery_urls||[],bought=item.created_at||item.settled_at,price=item.amount??item.price;
   const mediaUrl=slug?`/paste/${encodeURIComponent(slug)}`:'#',detailUrl=slug?`/r/${encodeURIComponent(slug)}`:'#';
   return `<article class="library-item"><div class="library-thumb">${accountThumbMarkup([thumb,embed,gallery],title)}<span class="library-check"><i class="fa-solid fa-check"></i></span></div><div class="library-info"><div class="library-tags"><span class="tag-purchased"><i class="fa-solid fa-circle-check"></i> ${escA(t('purchase_success'))}</span><span class="tag-access">${escA(t('verified'))}</span></div><h3>${escA(title)}</h3><p><i class="fa-regular fa-calendar-check"></i> ${escA(t('purchased'))} ${escA(dateA(bought))}</p>${price!=null?`<small class="library-price">${escA(t('price'))}: <b>${escA(moneyA(price))}</b></small>`:''}</div><div class="library-actions">${slug?`<a class="account-action" href="${mediaUrl}"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${escA(t('open_media'))}</a><a class="library-detail-link" href="${detailUrl}">${escA(t('details'))} <i class="fa-solid fa-arrow-right"></i></a>`:'<span class="expired-link">Review unavailable</span>'}</div></article>`;
  }).join('')}</div>${items.length>pageSize?`<div class="account-pagination"><button type="button" data-page="prev" ${page===1?'disabled':''}>‹ ${escA(t('previous'))}</button><span>${page} / ${Math.ceil(items.length/pageSize)}</span><button type="button" data-page="next" ${page===Math.ceil(items.length/pageSize)?'disabled':''}>${escA(t('next'))} ›</button></div>`:''}`;
  host.querySelector('[data-page="prev"]')?.addEventListener('click',()=>{page--;draw()});host.querySelector('[data-page="next"]')?.addEventListener('click',()=>{page++;draw()});
 };
 draw();if(usingFallback)showNotice(t('order_fallback'),'success');
}
async function loadPurchasedMedia(user){
 const host=$('purchaseLinks');
 // The entitlement is the canonical access record. Settled orders are also
 // queried as a recovery path so a completed payment remains visible if an
 // older settlement missed creating its entitlement row.
 const [entRes,orderRes]=await Promise.all([
  sb.from('review_entitlements').select('id,review_id,created_at,order_id,review_items(id,title,slug,thumbnail_url,review_embed_url,gallery_urls,price,access)').eq('user_id',user.id).order('created_at',{ascending:false}),
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
  const {data,error}=await sb.from('review_items').select('id,title,slug,thumbnail_url,review_embed_url,gallery_urls,price,access').in('id',missingIds);
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
function applyAccountLanguage(){
 document.querySelectorAll('[data-account-i18n]').forEach(el=>{
  const key=el.dataset.accountI18n;if(!copyA[langA()][key])return;
  const icon=el.querySelector('i');
  if(icon){el.textContent='';el.append(icon,document.createTextNode(' '+t(key)));}else el.textContent=t(key);
 });
 const old=$('oldEmail'),fresh=$('newEmail'),passEmail=$('passwordEmail'),pass=$('newPassword');
 if(old)old.placeholder=langA()==='en'?'current-email@gmail.com':'email-lama@gmail.com';
 if(fresh)fresh.placeholder=langA()==='en'?'new-email@gmail.com':'email-baru@gmail.com';
 if(passEmail)passEmail.placeholder=langA()==='en'?'account-gmail@gmail.com':'gmail-akun@gmail.com';
 if(pass)pass.placeholder=langA()==='en'?'At least 8 characters':'Minimal 8 karakter';
 const title=document.querySelector('title');if(title)title.textContent=langA()==='en'?'My Account — BoxCellink':'Akun Saya — BoxCellink';
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
 $('emailForm').onsubmit=async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;
  const oldEmail=$('oldEmail').value.trim().toLowerCase(),newEmail=$('newEmail').value.trim().toLowerCase();
  try{
   if(oldEmail!==(user.email||'').toLowerCase())throw new Error(langA()==='en'?'Old Gmail does not match this account.':'Gmail lama tidak cocok dengan akun ini.');
   if(!newEmail||oldEmail===newEmail)throw new Error(langA()==='en'?'Enter a different new Gmail address.':'Masukkan Gmail baru yang berbeda.');
   const {data,error}=await sb.functions.invoke('change-account-email',{body:{oldEmail,newEmail}});
   if(error)throw error;
   const confirmedEmail=data?.email||newEmail;
   $('accountEmail').textContent=confirmedEmail;
   const notice=$('accountNotice');notice.hidden=false;notice.className='account-notice is-success email-change-notice';
   notice.innerHTML=`<i class="fa-solid fa-circle-check"></i><div><b>${escA(t('email_request_ok'))}</b><div class="email-change-flow"><del>${escA(oldEmail)}</del><i class="fa-solid fa-arrow-right"></i><strong>${escA(confirmedEmail)}</strong></div><small>${escA(t('email_confirm_pending'))}</small></div>`;
   e.currentTarget.reset();
  }catch(err){showNotice(`${t('email_failed')} ${err.message||''}`,'error');}
  finally{btn.disabled=false;}
 };
$('passwordForm').onsubmit=async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;
  try{
   if($('passwordEmail').value.trim().toLowerCase()!==(user.email||'').toLowerCase())throw new Error(langA()==='en'?'Account Gmail does not match the signed-in account.':'Gmail akun tidak cocok dengan akun yang sedang login.');
   const {error}=await sb.auth.updateUser({password:$('newPassword').value});if(error)throw error;
   showNotice(t('password_updated'),'success');e.currentTarget.reset();
  }catch(err){showNotice(`${t('password_failed')} ${err.message||''}`,'error');}
  finally{btn.disabled=false;}
 };
 await loadPurchasedMedia(user);

 const {data:groups,error:gerror}=await sb.rpc('get_my_vip_group_entitlements');
 const groupRows=(groups||[]);
 $('groupLinks').innerHTML=gerror?emptyState('fa-triangle-exclamation',langA()==='en'?'Group history unavailable':'Riwayat group belum dapat dimuat',gerror.message):groupRows.map(x=>{
  const link=/^https:\/\/(t\.me|telegram\.me)\//i.test(x.telegram_url||'')?x.telegram_url:'';
  return `<article class="purchase-row account-simple-row vip-owned-group"><span class="simple-row-icon"><i class="fa-brands fa-telegram"></i></span><div><b>${escA(x.group_name||'VIP Telegram')}</b><small>${escA(t('purchased'))} ${escA(dateA(x.purchased_at))} · ${escA(t('link_updated'))}</small></div><div class="vip-owned-actions">${link?`<a class="account-action" href="${escA(link)}" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i> ${escA(t('join_group'))}</a><button class="account-action vip-copy-link" type="button" data-link="${escA(link)}"><i class="fa-regular fa-copy"></i> ${escA(t('copy_link'))}</button>`:`<span class="expired-link">${escA(t('invite_expired'))}</span>`}<button class="library-detail-link vip-refresh-link" type="button" onclick="location.reload()">${escA(t('check_link'))} <i class="fa-solid fa-rotate"></i></button></div></article>`;
 }).join('')||emptyState('fa-users',t('no_groups'));
 $('groupLinks')?.querySelectorAll('.vip-copy-link').forEach(btn=>btn.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(btn.dataset.link);btn.innerHTML='<i class="fa-solid fa-check"></i> '+(langA()==='en'?'Copied':'Tersalin');}
  catch{showNotice(langA()==='en'?'Could not copy the link. Open the group button instead.':'Link tidak dapat disalin. Gunakan tombol Masuk Group.','error');}
 }));
 const freshGroup=groupRows.find(x=>new Date(x.purchased_at)>new Date(Date.now()-24*3600000)&&x.telegram_url);
 const successBox=$('groupPurchaseSuccess');
 if(freshGroup&&successBox){successBox.hidden=false;successBox.innerHTML=`<i class="fa-solid fa-circle-check"></i><div><b>${escA(t('group_notice'))}</b><span>${escA(freshGroup.group_name||'VIP Telegram')} · ${escA(t('link_updated'))}</span>${freshGroup.telegram_url?`<a class="account-action" href="${escA(freshGroup.telegram_url)}" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i> ${escA(t('join_group'))}</a>`:''}</div>`;}

 const {data:history,error:historyError}=await sb.from('video_watch_history').select('watched_at,videos(title,slug,thumbnail_url,embed_url)').eq('user_id',user.id).order('watched_at',{ascending:false}).limit(50);
 const historyHost=$('watchHistory');
 if(historyError){historyHost.innerHTML=emptyState('fa-clock',langA()==='en'?'Watch history unavailable':'Riwayat tonton belum tersedia',historyError.message);}
 else{
  const rows=history||[];
  historyHost.innerHTML=rows.length?`<div class="watch-history-strip">${rows.map(x=>`<article class="history-card">${accountThumbMarkup([x.videos?.thumbnail_url,x.videos?.embed_url],x.videos?.title||"Video BoxVidey","fa-solid fa-play")}<div class="history-card-info"><b>${escA(x.videos?.title||'Video BoxVidey')}</b><small>${escA(t('watched'))} ${escA(dateA(x.watched_at))}</small>${x.videos?.slug?`<a href="/v/${encodeURIComponent(x.videos.slug)}">${escA(t('watch_again'))} <i class="fa-solid fa-arrow-right"></i></a>`:''}</div></article>`).join('')}</div>`:emptyState('fa-clock',t('no_history'));
 }

}
document.addEventListener('DOMContentLoaded',()=>{applyAccountLanguage();initAccount().catch(error=>{
 console.error('BoxCellink account:',error);
 const notice=$('accountNotice');if(notice){notice.hidden=false;notice.className='account-notice is-error';notice.innerHTML=`<i class="fa-solid fa-circle-exclamation"></i><span>${escA(t('account_error'))}: ${escA(error.message||'Unknown error')}</span>`;}
});});
})();