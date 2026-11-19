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
  your_library:'KOLEKSI MEDIA KAMU',telegram_media:'Histori Pembelian Review Media',library_desc:'Pembelian saat login tersimpan permanen. Pembelian tanpa login tidak masuk ke histori akun.',items:'MEDIA',verified_purchases:'Pembelian terverifikasi',access_anytime:'Akses dari halaman akun',loading_library:'Memuat media Telegram...',
  recent_activity:'AKTIVITAS TERBARU',watch_history:'Riwayat Tonton',watch_desc:'Lanjutkan video BoxVidey yang pernah kamu buka.',loading_history:'Memuat riwayat tontonan...',
  exclusive_access:'AKSES EKSKLUSIF',vip_groups:'Group VIP Telegram',groups_desc:'Link undangan aktif selama 24 jam setelah pembelian. Histori transaksi tetap tersimpan.',loading_groups:'Memuat akses group...',
  basic:'Basic / Free',admin:'Administrator',premium_until:'Premium aktif sampai',vip_until:'VIP aktif sampai',account_error:'Gagal memuat informasi akun',
  purchased:'Dibeli',open_media:'Buka Media',details:'Detail Review',no_media:'Belum ada media yang dibeli.',no_media_desc:'Review yang kamu beli akan muncul otomatis di bagian ini setelah pembayaran berhasil diverifikasi.',purchase_success:'Pembelian berhasil',verified:'Akses aktif',history_only:'Riwayat tersimpan',price:'Total pembayaran',watch_again:'Tonton lagi',watched:'Ditonton',
  no_history:'Belum ada riwayat tontonan.',no_groups:'Belum ada Group VIP yang dibeli.',group_success:'Pembayaran Group VIP berhasil!',group_active:'Akses group aktif.',invite_until:'Link undangan aktif sampai',invite_expired:'Link undangan tidak tersedia. Hubungi admin untuk pembaruan.',join_group:'Masuk Group',expired:'Link tidak tersedia',check_link:'Cek link terbaru',copy_link:'Salin link',link_updated:'Link undangan mengikuti pengaturan terbaru admin.',group_notice:'Pembayaran berhasil! Akses Group VIP kamu sudah aktif.',
  email_sent:'Tautan konfirmasi dikirim ke email baru.',password_updated:'Kata sandi berhasil diperbarui.',email_failed:'Gagal memperbarui email.',password_failed:'Gagal memperbarui kata sandi.',
  load_failed:'Riwayat media tidak dapat dimuat.',order_fallback:'Menampilkan pembelian yang telah terverifikasi.',retry:'Coba muat ulang',previous:'Sebelumnya',next:'Berikutnya',email_request_ok:'Gmail berhasil diganti.',email_confirm_pending:'Alamat Gmail akun telah diperbarui.',sign_in:'Silakan login untuk melihat akun.',
  profile_title:'Profil Publik',profile_desc:'Atur username yang akan dikenali pengguna lain di BoxCellink.',public_identity:'Identitas publik',username_label:'Username publik',username_hint:'3–24 karakter. Gunakan huruf, angka, titik, atau garis bawah.',save_username:'Simpan username',username_saved:'Username berhasil diperbarui.',username_failed:'Gagal memperbarui username.',
  payout_eyebrow:'WITHDRAWAL SETTINGS',payout_title:'Rekening Saya',payout_desc:'Simpan rekening bank atau e-wallet untuk pencairan saldo.',payout_secure:'Informasi rekening hanya digunakan untuk proses pencairan saldo.',payout_holder:'Nama pemilik rekening',payout_method:'Jenis rekening',payout_provider:'Pilih bank / e-wallet',payout_other:'Nama lainnya',payout_number:'Nomor rekening / e-wallet',payout_save:'Simpan rekening',payout_saved:'Rekening pencairan berhasil disimpan.',payout_failed:'Gagal menyimpan rekening.',payout_unavailable:'Rekening pencairan tersedia setelah status Affiliate disetujui.',payout_bank:'Pilih bank',payout_wallet:'Pilih e-wallet',payout_empty:'Rekening belum disimpan.',edit_payout:'Ubah rekening',saved_payout:'Rekening tersimpan',
  current_email:'Email saat ini',email_desc:'Masukkan alamat email baru untuk akunmu.',email_hint:'Email akun akan diperbarui setelah berhasil diproses.',new_email:'Email baru',change_email_button:'Simpan email baru',
  confirm_password:'Konfirmasi kata sandi baru',password_desc:'Buat kata sandi baru untuk login berikutnya.',password_hint:'Minimal 8 karakter dan pastikan kedua kolom sama.',
  vip_history_eyebrow:'PURCHASE HISTORY',vip_history_title:'Histori Pembelian VIP',vip_history_desc:'Riwayat transaksi VIP tetap tersimpan meskipun link undangan sudah kedaluwarsa.',loading_vip_history:'Memuat histori pembelian VIP...',no_vip_history:'Belum ada pembelian VIP.',vip_order:'Pembelian VIP',invite_until:'Link undangan aktif sampai',invite_expired:'Link undangan sudah kedaluwarsa. Beli kembali untuk mendapatkan link baru.',buy_again:'Beli lagi',watch_duration:'Durasi ditonton',sort_history:'Urutkan',sort_recent:'Terbaru ditonton',sort_oldest:'Terlama ditonton',sort_duration:'Durasi terpanjang',
  security_eyebrow:'ACCOUNT SECURITY',login_devices:'Perangkat Login',login_devices_desc:'Periksa browser dan perangkat yang pernah digunakan untuk masuk ke akun ini.',loading_devices:'Memuat perangkat...',current_device:'Perangkat ini',other_device:'Perangkat lain',last_login:'Login terakhir',signout_others:'Keluar dari perangkat lain',signout_current:'Keluar dari akun ini',security_note:'Jika ada perangkat yang tidak kamu kenali, keluarkan semua sesi lain lalu segera ganti kata sandi.',devices_unavailable:'Riwayat perangkat belum tersedia. Jalankan migration Account Center.',devices_signed_out:'Semua sesi perangkat lain telah dikeluarkan. Segera ganti kata sandi jika login tersebut bukan milikmu.',no_other_devices:'Tidak ada perangkat lain yang tercatat.',unknown_device:'Perangkat tidak dikenal',bank:'Bank',ewallet:'E-Wallet'
 },
 en:{
  account:'Account',hero_title:'My Account',hero_desc:'Manage your profile, account security, membership, and all purchased media in one place.',secure_label:'Secure account',instant_label:'Instant access',upgrade_title:'Upgrade Account Status',upgrade_desc:'Enjoy a better BoxCellink experience with VIP membership.',benefit_no_ads:'Watch BoxVidey without ads',benefit_discount:'20% off eligible Review purchases',benefit_exclusive:'Access VIP-only videos while membership is active',upgrade_button:'Upgrade to VIP',old_email:'Old Gmail',current_email:'Account Gmail',membership:'Membership',membership_desc:'Your current account access',security:'Security',protected:'Account protected',security_desc:'Managed securely with Supabase Auth',
  personal_settings:'PERSONAL SETTINGS',account_settings:'Account settings',settings_desc:'Update your login details and keep your account secure.',
  change_email:'Change email',email_desc:'Enter your old and new Gmail addresses to update your account.',new_email:'New Gmail',send_confirmation:'Change Gmail',change_email_button:'Change Gmail now',email_hint:'Your account Gmail will be updated immediately after processing.',
  change_password:'Change password',password_desc:'Enter your account Gmail and a new password.',new_password:'New password',update_password:'Update password',password_hint:'Enter your account Gmail and a new password (at least 8 characters).',
  your_library:'YOUR MEDIA LIBRARY',telegram_media:'Review Media Purchase History',library_desc:'Purchases made while signed in are saved permanently. Guest purchases are not added to account history.',items:'ITEMS',verified_purchases:'Verified purchases',access_anytime:'Access from your account page',loading_library:'Loading Telegram media...',
  recent_activity:'RECENT ACTIVITY',watch_history:'Watch history',watch_desc:'Continue watching BoxVidey videos you have opened.',loading_history:'Loading watch history...',
  exclusive_access:'EXCLUSIVE ACCESS',vip_groups:'VIP Telegram Groups',groups_desc:'Invitation links remain active for 24 hours after purchase. Transaction history is retained.',loading_groups:'Loading group access...',
  basic:'Basic / Free',admin:'Administrator',premium_until:'Premium active until',vip_until:'VIP active until',account_error:'Unable to load account information',
  purchased:'Purchased',open_media:'Open media',details:'Review details',no_media:'No purchased media yet.',no_media_desc:'Reviews you purchase will automatically appear here after payment is verified.',purchase_success:'Purchase successful',verified:'Access active',history_only:'Purchase history saved',price:'Payment total',watch_again:'Watch again',watched:'Watched',
  no_history:'No watch history yet.',no_groups:'No VIP Telegram groups purchased yet.',group_success:'VIP Group payment successful!',group_active:'Group access is active.',invite_until:'Invitation link active until',invite_expired:'Invitation link has expired',join_group:'Join group',expired:'Link expired',
  email_sent:'A confirmation link has been sent to your new email.',password_updated:'Your password has been updated.',email_failed:'Unable to update email.',password_failed:'Unable to update password.',
  load_failed:'Unable to load purchased media.',order_fallback:'Showing verified purchases.',retry:'Reload',previous:'Previous',next:'Next',email_request_ok:'Gmail changed successfully.',email_confirm_pending:'Your account Gmail address has been updated.',sign_in:'Please sign in to view your account.',
  profile_title:'Public profile',profile_desc:'Set the username other BoxCellink users can recognize.',public_identity:'Public identity',username_label:'Public username',username_hint:'3–24 characters. Use letters, numbers, dots, or underscores.',save_username:'Save username',username_saved:'Username updated successfully.',username_failed:'Unable to update username.',
  payout_eyebrow:'WITHDRAWAL SETTINGS',payout_title:'My payout account',payout_desc:'Save a bank or e-wallet account for withdrawals.',payout_secure:'Payout details are only used to process withdrawals.',payout_holder:'Account holder name',payout_method:'Account type',payout_provider:'Choose bank / e-wallet',payout_other:'Other provider',payout_number:'Account / e-wallet number',payout_save:'Save payout account',payout_saved:'Payout account saved successfully.',payout_failed:'Unable to save payout account.',payout_unavailable:'Payout settings become available after Affiliate approval.',payout_bank:'Choose a bank',payout_wallet:'Choose an e-wallet',payout_empty:'No payout account saved.',edit_payout:'Edit account',saved_payout:'Saved payout account',
  current_email:'Current email',email_desc:'Enter the new email address for your account.',email_hint:'Your account email will be updated after processing.',new_email:'New email',change_email_button:'Save new email',
  confirm_password:'Confirm new password',password_desc:'Create a new password for your next sign-in.',password_hint:'At least 8 characters; both fields must match.',
  vip_history_eyebrow:'PURCHASE HISTORY',vip_history_title:'VIP purchase history',vip_history_desc:'VIP transactions remain in your history even after invitation links expire.',loading_vip_history:'Loading VIP purchase history...',no_vip_history:'No VIP purchases yet.',vip_order:'VIP purchase',invite_until:'Invitation link active until',invite_expired:'The invitation link has expired. Purchase again to get a new link.',buy_again:'Buy again',watch_duration:'Time watched',sort_history:'Sort by',sort_recent:'Recently watched',sort_oldest:'Oldest watched',sort_duration:'Longest watch time',
  security_eyebrow:'ACCOUNT SECURITY',login_devices:'Login devices',login_devices_desc:'Review browsers and devices that have been used to access this account.',loading_devices:'Loading devices...',current_device:'This device',other_device:'Other device',last_login:'Last login',signout_others:'Sign out other devices',signout_current:'Sign out',security_note:'If you see a device you do not recognize, sign out other sessions and change your password immediately.',devices_unavailable:'Device history is unavailable. Run the Account Center migration.',devices_signed_out:'All other device sessions have been signed out. Change your password if that login was not yours.',no_other_devices:'No other devices recorded.',unknown_device:'Unknown device',bank:'Bank',ewallet:'E-Wallet'
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
   const mediaUrl=slug?`/paste/${encodeURIComponent(slug)}`:'#',detailUrl=slug?`/r/${encodeURIComponent(slug)}`:'#',accessLabel=slug?t('verified'):t('history_only');
   return `<article class="library-item"><div class="library-thumb">${accountThumbMarkup([thumb,embed,gallery],title)}<span class="library-check"><i class="fa-solid fa-check"></i></span></div><div class="library-info"><div class="library-tags"><span class="tag-purchased"><i class="fa-solid fa-circle-check"></i> ${escA(t('purchase_success'))}</span><span class="tag-access">${escA(accessLabel)}</span></div><h3>${escA(title)}</h3><p><i class="fa-regular fa-calendar-check"></i> ${escA(t('purchased'))} ${escA(dateA(bought))}</p>${price!=null?`<small class="library-price">${escA(t('price'))}: <b>${escA(moneyA(price))}</b></small>`:''}</div><div class="library-actions">${slug?`<a class="account-action" href="${mediaUrl}"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${escA(t('open_media'))}</a><a class="library-detail-link" href="${detailUrl}">${escA(t('details'))} <i class="fa-solid fa-arrow-right"></i></a>`:'<span class="expired-link">Review unavailable</span>'}</div></article>`;
  }).join('')}</div>${items.length>pageSize?`<div class="account-pagination"><button type="button" data-page="prev" ${page===1?'disabled':''}>‹ ${escA(t('previous'))}</button><span>${page} / ${Math.ceil(items.length/pageSize)}</span><button type="button" data-page="next" ${page===Math.ceil(items.length/pageSize)?'disabled':''}>${escA(t('next'))} ›</button></div>`:''}`;
  host.querySelector('[data-page="prev"]')?.addEventListener('click',()=>{page--;draw()});host.querySelector('[data-page="next"]')?.addEventListener('click',()=>{page++;draw()});
 };
 draw();if(usingFallback)showNotice(t('order_fallback'),'success');
}
async function loadPurchasedMedia(user){
 const host=$('purchaseLinks');
 // Immutable snapshots preserve a member's paid purchase history even if the
 // source review is removed. Entitlements/orders remain recovery paths.
 const [snapshotRes,entRes,orderRes]=await Promise.all([
  sb.from('review_purchase_history').select('order_id,review_id,title,slug,thumbnail_url,review_embed_url,gallery_urls,amount,purchased_at').eq('user_id',user.id).order('purchased_at',{ascending:false}),
  sb.from('review_entitlements').select('id,review_id,created_at,order_id,review_items(id,title,slug,thumbnail_url,review_embed_url,gallery_urls,price,access)').eq('user_id',user.id).order('created_at',{ascending:false}),
  sb.from('cashi_orders').select('order_id,review_id,amount,created_at,settled_at,status').eq('user_id',user.id).eq('purpose','review_download').eq('status','SETTLED').order('settled_at',{ascending:false})
 ]);
 if(snapshotRes.error&&entRes.error&&orderRes.error){
  host.innerHTML=emptyState('fa-triangle-exclamation',t('load_failed'),snapshotRes.error.message||entRes.error.message||orderRes.error.message);
  return;
 }
 const merged=new Map();
 for(const row of (snapshotRes.data||[])){
  const item={id:row.review_id,title:row.title,slug:row.slug,thumbnail_url:row.thumbnail_url,review_embed_url:row.review_embed_url,gallery_urls:row.gallery_urls,price:row.amount};
  merged.set(row.review_id||`order:${row.order_id}`,{...item,review_items:item,order_id:row.order_id,amount:row.amount,created_at:row.purchased_at,settled_at:row.purchased_at});
 }
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
 const fresh=$('newEmail'),pass=$('newPassword'),confirm=$('confirmPassword');
 if(fresh)fresh.placeholder=langA()==='en'?'new-email@gmail.com':'email-baru@gmail.com';
 if(pass)pass.placeholder=langA()==='en'?'At least 8 characters':'Minimal 8 karakter';
 if(confirm)confirm.placeholder=langA()==='en'?'Repeat new password':'Ulangi kata sandi baru';
 const sort=$('watchHistorySort');
 if(sort){const values=[['recent','sort_recent'],['oldest','sort_oldest'],['duration','sort_duration']];sort.innerHTML=values.map(([v,k])=>`<option value="${v}">${escA(t(k))}</option>`).join('');}
 const title=document.querySelector('title');if(title)title.textContent=langA()==='en'?'My Account — BoxCellink':'Akun Saya — BoxCellink';
}
const BANKS_A=['BCA','Bank Mandiri','BRI','BNI','BSI','Bank CIMB Niaga','BTN','Bank Danamon','PermataBank','Bank OCBC NISP','Bank Mega','Bank Jago','SeaBank','Bank Neo Commerce','Bank BTPN / Jenius','Bank Muamalat','Bank BJB','Bank Jatim','Bank DKI','Bank Sumut','Bank Nagari','Bankaltimtara','Bank Sulselbar','Bank Papua','Lainnya'];
const EWALLETS_A=['DANA','OVO','GoPay','ShopeePay','LinkAja','AstraPay','i.Saku','Sakuku','Lainnya'];
const deviceIdA=()=>{
 try{
  let id=localStorage.getItem('boxcellink_device_id');
  if(!id){id=crypto?.randomUUID?crypto.randomUUID():`dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;localStorage.setItem('boxcellink_device_id',id);}
  return id;
 }catch{return 'browser-session';}
};
const deviceLabelA=()=>{
 const ua=navigator.userAgent||'';
 const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Browser';
 const os=/Android/i.test(ua)?'Android':/iPhone|iPad/i.test(ua)?'iOS':/Windows/i.test(ua)?'Windows':/Mac OS/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'Device';
 return `${browser} · ${os}`;
};
const durationA=value=>{
 const s=Math.max(0,Math.floor(Number(value)||0)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),r=s%60;
 return h?`${h}j ${m}m`:m?`${m}m ${r}d`: `${r}d`;
};
async function loadVipPurchaseHistory(user){
 const host=$('vipPurchaseHistory');if(!host)return;
 const {data:orders,error}=await sb.from('cashi_orders').select('order_id,vip_group_id,amount,settled_at,created_at').eq('user_id',user.id).eq('purpose','vip_group').eq('status','SETTLED').order('settled_at',{ascending:false}).limit(100);
 if(error){host.innerHTML=emptyState('fa-triangle-exclamation',t('load_failed'),error.message);return;}
 const rows=orders||[];
 if(!rows.length){host.innerHTML=emptyState('fa-crown',t('no_vip_history'));return;}
 const ids=[...new Set(rows.map(x=>x.vip_group_id).filter(Boolean))];
 const {data:groups}=ids.length?await sb.from('vip_groups').select('id,name').in('id',ids):{data:[]};
 const names=new Map((groups||[]).map(x=>[x.id,x.name]));
 host.innerHTML=rows.map(x=>`<article class="purchase-row account-simple-row vip-history-row"><span class="simple-row-icon"><i class="fa-solid fa-crown"></i></span><div><b>${escA(names.get(x.vip_group_id)||t('vip_order'))}</b><small>${escA(t('purchased'))} ${escA(dateA(x.settled_at||x.created_at))} · ID ${escA(x.order_id)}</small></div><strong class="vip-history-price">${escA(moneyA(x.amount))}</strong></article>`).join('');
}
async function loadLoginDevices(user){
 const host=$('loginDevices');if(!host)return;
 const current=deviceIdA();
 const {data,error}=await sb.from('account_login_devices').select('device_id,device_label,user_agent,first_seen_at,last_seen_at').eq('user_id',user.id).order('last_seen_at',{ascending:false}).limit(20);
 if(error){host.innerHTML=emptyState('fa-shield-halved',t('devices_unavailable'));return;}
 const rows=data||[];
 if(!rows.length){host.innerHTML=emptyState('fa-laptop',t('no_other_devices'));return;}
 host.innerHTML=rows.map(x=>{
  const own=x.device_id===current;
  return `<div class="login-device-row"><span class="device-icon"><i class="fa-solid ${/android|iphone|mobile/i.test(x.user_agent||'')?'fa-mobile-screen-button':'fa-laptop'}"></i></span><div class="device-main"><b>${escA(x.device_label||t('unknown_device'))} ${own?`<span class="device-current">${escA(t('current_device'))}</span>`:''}</b><small>${escA(t('last_login'))}: ${escA(dateA(x.last_seen_at))}</small></div><span class="device-state ${own?'is-current':'is-other'}">${own?'●':'○'} ${escA(own?t('current_device'):t('other_device'))}</span></div>`;
 }).join('');
}
function fillPayoutProviders(method,selected=''){
 const select=$('payoutProvider');if(!select)return;
 const values=method==='bank'?BANKS_A:EWALLETS_A;
 select.innerHTML=`<option value="">${escA(t(method==='bank'?'payout_bank':'payout_wallet'))}</option>`+values.map(x=>`<option value="${escA(x)}">${escA(x)}</option>`).join('');
 if(selected&&values.includes(selected))select.value=selected;
 else if(selected){select.value='Lainnya';$('payoutCustomWrap').hidden=false;$('payoutCustom').value=selected;$('payoutCustom').required=true;}
}
async function initAccount(){
 if(!window.sb?.auth)throw new Error('Supabase client unavailable');
 const {data:{user},error:authError}=await sb.auth.getUser();
 if(authError)throw authError;
 if(!user){location.replace('/login.html?next='+encodeURIComponent('/account.html'));return;}
 let p=null;
 let profileResult=await sb.from('profiles').select('full_name,username,game_id,vip_expires_at,premium_expires_at,role,membership_tier,affiliate_status,payout_method,payout_provider,payout_account_number,payout_account_holder').eq('id',user.id).maybeSingle();
 if(profileResult.error){
  console.warn('Account profile extended fields:',profileResult.error.message);
  profileResult=await sb.from('profiles').select('full_name,vip_expires_at,premium_expires_at,role,affiliate_status').eq('id',user.id).maybeSingle();
 }
 p=profileResult.data||null;
 if(profileResult.error)console.warn('Account profile:',profileResult.error.message);
 const fullName=p?.full_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'—';
 const username=p?.username||'';
 $('accountName').textContent=fullName;
 $('accountEmail').textContent=user.email||'—';
 $('emailCurrentValue').textContent=user.email||'—';
 $('publicProfileName').textContent=fullName;
 $('publicProfileUsername').textContent=username?`@${username}`:'@—';
 $('publicUsername').value=username;
 $('memberGameId') && ($('memberGameId').value=p?.game_id||'');
 $('profileAvatar').textContent=String(fullName).trim().charAt(0).toUpperCase()||'U';
 const now=new Date(),premium=p?.premium_expires_at&&new Date(p.premium_expires_at)>now,vip=p?.vip_expires_at&&new Date(p.vip_expires_at)>now;
 $('accountStatus').textContent=p?.role==='admin'?t('admin'):premium?`${t('premium_until')} ${dateA(p.premium_expires_at)}`:vip?`${t('vip_until')} ${dateA(p.vip_expires_at)}`:t('basic');

 $('gameIdForm')?.addEventListener('submit',async e=>{e.preventDefault();const value=String($('memberGameId')?.value||'').trim();if(value.length>80){showNotice('Game ID maksimal 80 karakter.','error');return;}try{const {error}=await sb.from('profiles').update({game_id:value||null}).eq('id',user.id);if(error)throw error;showNotice('Game ID berhasil diperbarui.','success');}catch(err){showNotice('Gagal menyimpan Game ID: '+(err.message||''),'error');}});
 $('usernameForm').onsubmit=async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;
  const value=$('publicUsername').value.trim().replace(/^@/,'');
  try{
   if(!/^[A-Za-z0-9_.]{3,24}$/.test(value))throw new Error(langA()==='en'?'Use 3–24 letters, numbers, dots, or underscores.':'Gunakan 3–24 karakter berupa huruf, angka, titik, atau garis bawah.');
   const {data,error}=await sb.rpc('update_my_username',{p_username:value});if(error)throw error;
   if(data?.ok===false)throw new Error(data.reason||t('username_failed'));
   $('publicProfileUsername').textContent='@'+value;showNotice(t('username_saved'),'success');
  }catch(err){showNotice(`${t('username_failed')} ${err.message||''}`,'error');}
  finally{btn.disabled=false;}
 };

 const payoutEligible=p?.affiliate_status==='approved'||p?.membership_tier==='affiliate';
 const payoutSection=$('payoutAccountSection');
 if(payoutEligible){
  payoutSection.hidden=false;
  $('payoutHolder').value=p?.payout_account_holder||p?.full_name||'';
  $('payoutNumber').value=p?.payout_account_number||'';
  $('payoutMethod').value=p?.payout_method||'bank';
  fillPayoutProviders($('payoutMethod').value,p?.payout_provider||'');
  $('payoutProvider').addEventListener('change',()=>{
   const custom=$('payoutProvider').value==='Lainnya';
   $('payoutCustomWrap').hidden=!custom;$('payoutCustom').required=custom;
   if(!custom)$('payoutCustom').value='';
  });
  $('payoutMethod').addEventListener('change',()=>{fillPayoutProviders($('payoutMethod').value);$('payoutCustomWrap').hidden=true;$('payoutCustom').required=false;$('payoutCustom').value='';});
  let hasPayout=!!(p?.payout_account_number&&p?.payout_provider&&p?.payout_account_holder);
  const saved=$('payoutSavedView'),form=$('payoutForm');
  const showSaved=()=>{
   if(!hasPayout){saved.hidden=true;form.hidden=false;return;}
   saved.hidden=false;form.hidden=true;
   saved.innerHTML=`<div class="payout-saved-card"><span class="payout-saved-icon"><i class="fa-solid ${p.payout_method==='ewallet'?'fa-wallet':'fa-building-columns'}"></i></span><div><small>${escA(t('saved_payout'))}</small><b>${escA(p.payout_provider)}</b><span>${escA(p.payout_account_holder)} · ${escA(p.payout_account_number)}</span></div><button type="button" class="library-detail-link" id="editPayoutButton"><i class="fa-solid fa-pen"></i> ${escA(t('edit_payout'))}</button></div>`;
   $('editPayoutButton').onclick=()=>{saved.hidden=true;form.hidden=false;};
  };
  showSaved();
  $('payoutForm').onsubmit=async e=>{
   e.preventDefault();const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;
   try{
    const method=$('payoutMethod').value,provider=$('payoutProvider').value,custom=$('payoutCustom').value.trim();
    const name=provider==='Lainnya'?custom:provider;
    if(!name)throw new Error(langA()==='en'?'Choose a provider or enter its name.':'Pilih penyedia atau isi nama lainnya.');
    const {data,error}=await sb.rpc('update_affiliate_payout_v2',{p_method:method,p_provider:name,p_account_number:$('payoutNumber').value.trim(),p_account_holder:$('payoutHolder').value.trim()});
    if(error)throw error;if(data?.ok===false)throw new Error(data.reason||t('payout_failed'));
    p.payout_method=method;p.payout_provider=name;p.payout_account_number=$('payoutNumber').value.trim();p.payout_account_holder=$('payoutHolder').value.trim();
    hasPayout=true;showSaved();$('payoutMessage').textContent=t('payout_saved');showNotice(t('payout_saved'),'success');
   }catch(err){$('payoutMessage').textContent=`${t('payout_failed')} ${err.message||''}`;showNotice(t('payout_failed'),'error');}
   finally{btn.disabled=false;}
  };
 }else{
  payoutSection.hidden=true;
 }

 $('emailForm').onsubmit=async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;
  const newEmail=$('newEmail').value.trim().toLowerCase();
  try{
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail))throw new Error(langA()==='en'?'Enter a valid email address.':'Masukkan alamat email yang valid.');
   if(newEmail===(user.email||'').toLowerCase())throw new Error(langA()==='en'?'The new email is the same as the current email.':'Email baru sama dengan email saat ini.');
   const {data,error}=await sb.functions.invoke('change-account-email',{body:{oldEmail:user.email,newEmail}});
   if(error)throw error;
   const confirmedEmail=data?.email||newEmail;
   user.email=confirmedEmail;$('accountEmail').textContent=confirmedEmail;$('emailCurrentValue').textContent=confirmedEmail;
   $('newEmail').value='';showNotice(t('email_request_ok'),'success');
  }catch(err){showNotice(`${t('email_failed')} ${err.message||''}`,'error');}
  finally{btn.disabled=false;}
 };
 $('passwordForm').onsubmit=async e=>{
  e.preventDefault();const btn=e.currentTarget.querySelector('button');
  const password=$('newPassword').value,confirm=$('confirmPassword').value;btn.disabled=true;
  try{
   if(password.length<8)throw new Error(langA()==='en'?'Password must be at least 8 characters.':'Kata sandi minimal 8 karakter.');
   if(password!==confirm)throw new Error(langA()==='en'?'Password confirmation does not match.':'Konfirmasi kata sandi tidak sama.');
   const {error}=await sb.auth.updateUser({password});if(error)throw error;
   showNotice(t('password_updated'),'success');e.currentTarget.reset();
  }catch(err){showNotice(`${t('password_failed')} ${err.message||''}`,'error');}
  finally{btn.disabled=false;}
 };

 await loadPurchasedMedia(user);
 await loadVipPurchaseHistory(user);

 // Repair paid Group VIP orders before reading the member's access list.
 // This is idempotent and only processes SETTLED orders owned by this account.
 const {data:syncResult,error:syncError}=await sb.rpc('sync_my_vip_group_entitlements');
 if(syncError)console.warn('VIP Group history sync:',syncError.message);
 else if(syncResult?.ok===false)console.warn('VIP Group history sync:',syncResult.reason);
 const {data:groups,error:gerror}=await sb.rpc('get_my_vip_group_entitlements');
 const groupRows=groups||[];
 $('groupLinks').innerHTML=gerror?emptyState('fa-triangle-exclamation',langA()==='en'?'Group history unavailable':'Riwayat group belum dapat dimuat',gerror.message):groupRows.map(x=>{
  const link=/^https:\/\/(t\.me|telegram\.me)\//i.test(x.telegram_url||'')?x.telegram_url:'';
  const expires=x.invite_expires_at?dateA(x.invite_expires_at):'—';
  return `<article class="purchase-row account-simple-row vip-owned-group"><span class="simple-row-icon"><i class="fa-brands fa-telegram"></i></span><div><b>${escA(x.group_name||'VIP Telegram')}</b><small>${escA(t('purchased'))} ${escA(dateA(x.purchased_at))} · ${link?`${escA(t('invite_until'))} ${escA(expires)}`:escA(t('invite_expired'))}</small></div><div class="vip-owned-actions">${link?`<a class="account-action" href="${escA(link)}" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i> ${escA(t('join_group'))}</a><button class="account-action vip-copy-link" type="button" data-link="${escA(link)}"><i class="fa-regular fa-copy"></i> ${escA(t('copy_link'))}</button>`:`<a class="account-action" href="/vip-groups.html"><i class="fa-solid fa-cart-shopping"></i> ${escA(t('buy_again'))}</a>`}</div></article>`;
 }).join('')||emptyState('fa-users',t('no_groups'));
 $('groupLinks')?.querySelectorAll('.vip-copy-link').forEach(btn=>btn.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(btn.dataset.link);btn.innerHTML='<i class="fa-solid fa-check"></i> '+(langA()==='en'?'Copied':'Tersalin');}
  catch{showNotice(langA()==='en'?'Could not copy the link.':'Link tidak dapat disalin.','error');}
 }));
 const freshGroup=groupRows.find(x=>new Date(x.invite_expires_at)>new Date()&&x.telegram_url);
 const successBox=$('groupPurchaseSuccess');
 if(freshGroup&&successBox){successBox.hidden=false;successBox.innerHTML=`<i class="fa-solid fa-circle-check"></i><div><b>${escA(t('group_notice'))}</b><span>${escA(freshGroup.group_name||'VIP Telegram')} · ${escA(t('invite_until'))} ${escA(dateA(freshGroup.invite_expires_at))}</span></div>`;}

 let historyRows=[];
 const historyHost=$('watchHistory');
 const drawHistory=()=>{
  const mode=$('watchHistorySort')?.value||'recent';
  const rows=[...historyRows];
  if(mode==='oldest')rows.sort((a,b)=>new Date(a.watched_at)-new Date(b.watched_at));
  else if(mode==='duration')rows.sort((a,b)=>Number(b.watched_seconds||0)-Number(a.watched_seconds||0));
  else rows.sort((a,b)=>new Date(b.watched_at)-new Date(a.watched_at));
  historyHost.innerHTML=rows.length?`<div class="watch-history-strip">${rows.map(x=>`<article class="history-card">${accountThumbMarkup([x.videos?.thumbnail_url,x.videos?.embed_url],x.videos?.title||"Video BoxVidey","fa-solid fa-play")}<div class="history-card-info"><b>${escA(x.videos?.title||'Video BoxVidey')}</b><small>${escA(t('watched'))} ${escA(dateA(x.watched_at))}</small><small class="history-duration">${escA(t('watch_duration'))}: ${escA(durationA(x.watched_seconds))}</small>${x.videos?.slug?`<a href="/v/${encodeURIComponent(x.videos.slug)}">${escA(t('watch_again'))} <i class="fa-solid fa-arrow-right"></i></a>`:''}</div></article>`).join('')}</div>`:emptyState('fa-clock',t('no_history'));
 };
 let historyResult=await sb.from('video_watch_history').select('watched_at,watched_seconds,videos(title,slug,thumbnail_url,embed_url)').eq('user_id',user.id).order('watched_at',{ascending:false}).limit(50);
 if(historyResult.error){
  console.warn('Watch history extended fields:',historyResult.error.message);
  historyResult=await sb.from('video_watch_history').select('watched_at,videos(title,slug,thumbnail_url,embed_url)').eq('user_id',user.id).order('watched_at',{ascending:false}).limit(50);
 }
 if(historyResult.error){historyHost.innerHTML=emptyState('fa-clock',langA()==='en'?'Watch history unavailable':'Riwayat tonton belum tersedia',historyResult.error.message);}
 else{historyRows=historyResult.data||[];drawHistory();}
 $('watchHistorySort')?.addEventListener('change',drawHistory);

 try{await sb.rpc('record_account_login',{p_device_id:deviceIdA(),p_device_label:deviceLabelA(),p_user_agent:navigator.userAgent||''});}catch(deviceError){console.warn('Current device registration unavailable:',deviceError);}
 await loadLoginDevices(user);
 $('signOutOtherDevices')?.addEventListener('click',async()=>{
  const btn=$('signOutOtherDevices');btn.disabled=true;
  try{const {error}=await sb.auth.signOut({scope:'others'});if(error)throw error;showNotice(t('devices_signed_out'),'success');}
  catch(err){showNotice(err.message||t('devices_unavailable'),'error');}
  finally{btn.disabled=false;}
 });
 $('signOutCurrent')?.addEventListener('click',async()=>{
  const btn=$('signOutCurrent');btn.disabled=true;
  try{const {error}=await sb.auth.signOut();if(error)throw error;location.replace('/login.html');}
  catch(err){showNotice(err.message||'Logout failed','error');btn.disabled=false;}
 });
 // Load and save public bio/social links. Data is intentionally limited to public fields.
 const socialFields={instagram:'socialInstagram',facebook:'socialFacebook',youtube:'socialYoutube',telegram:'socialTelegram',whatsapp:'socialWhatsapp',x:'socialX',other:'socialOther'};
 try{
  const {data:pub,error:pubError}=await sb.from('profiles').select('bio,social_links').eq('id',user.id).maybeSingle();
  if(pubError)throw pubError;
  $('profileBio').value=pub?.bio||'';
  Object.entries(socialFields).forEach(([key,id])=>{const el=$(id);if(el)el.value=pub?.social_links?.[key]||'';});
 }catch(err){console.warn('Public profile fields unavailable:',err);}
 $('socialProfileForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{
   const links={};for(const [key,id] of Object.entries(socialFields)){const value=String($(id)?.value||'').trim();if(!value)continue;const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw new Error('Gunakan tautan https:// atau http:// untuk '+key+'.');links[key]=url.href;}
   const bio=String($('profileBio').value||'').trim();if(bio.length>500)throw new Error('Bio maksimal 500 karakter.');
   const {error}=await sb.from('profiles').update({bio,social_links:links}).eq('id',user.id);if(error)throw error;
   showNotice('Bio dan tautan sosial berhasil disimpan.','success');
  }catch(err){showNotice('Gagal menyimpan profil: '+(err.message||'Periksa kembali tautan.'),'error');}
  finally{button.disabled=false;}
 });
}
document.addEventListener('DOMContentLoaded',()=>{applyAccountLanguage();initAccount().catch(error=>{
 console.error('BoxCellink account:',error);
 const notice=$('accountNotice');if(notice){notice.hidden=false;notice.className='account-notice is-error';notice.innerHTML=`<i class="fa-solid fa-circle-exclamation"></i><span>${escA(t('account_error'))}: ${escA(error.message||'Unknown error')}</span>`;}
});});

})();
