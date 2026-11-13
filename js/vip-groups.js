(()=>{
'use strict';
const root=document.getElementById('groups'),modal=document.getElementById('groupModal');
let selected=null,busy=false,lang=localStorage.getItem('boxcellink_lang')==='en'?'en':'id';
const T={
 id:{brandLabel:'BOXCELLINK MEMBERSHIP',modalLabel:'KEANGGOTAAN GROUP',tagUpdates:'Update terbaru',tagLifetime:'Akses permanen',heroDesc:'Akses koleksi media pilihan, tonton langsung, simpan media, dan nikmati pembaruan konten secara berkala. Pilih komunitas yang paling sesuai untukmu.',point1:'Bisa ditonton & disimpan',point2:'Update rutin',point3:'Sekali bayar, permanen',chooseGroup:'Pilih Group',benefit1:'Tonton langsung',benefit1d:'Media bisa dinikmati tanpa alur yang rumit.',benefit2:'Simpan media',benefit2d:'Unduh dan simpan media yang tersedia.',benefit3:'Update rutin',benefit3d:'Koleksi diperbarui dengan konten pilihan.',benefit4:'Akses tercatat',benefit4d:'Pembelian tercatat di akun BoxCellink.',sectionEyebrow:'PILIH AKSES',sectionTitle:'Temukan Group Favoritmu',sectionDesc:'Satu kali pembayaran untuk akses permanen ke group yang dipilih.',cashi:'Pembayaran Cashi',accessInfo:'Informasi akses',accessInfoDesc:'Setelah pembayaran berhasil diverifikasi, akses group akan tercatat otomatis di halaman Akun Saya. Link undangan mengikuti link terbaru yang diatur admin.',continuePayment:'Lanjut ke pembayaran',joinGroup:'Masuk ke Group',loading:'Memuat pilihan group...',empty:'Belum ada Group VIP yang tersedia. Silakan hubungi admin.',serviceError:'Layanan belum tersedia. Coba muat ulang halaman.',select:'Pilih Group',once:'SEKALI BAYAR · PERMANEN',tag:'PREMIUM ACCESS',description:'Group Telegram eksklusif dengan koleksi media pilihan dan pembaruan rutin.',feature1:'Koleksi media pilihan yang dapat ditonton langsung',feature2:'Media yang tersedia dapat disimpan',feature3:'Konten terbaru sesuai tema group',feature4:'Akses permanen setelah pembayaran berhasil',modal1:'Pembayaran satu kali, akses permanen.',modal2:'Link undangan selalu mengikuti pengaturan terbaru admin dan tersedia di Akun Saya.',modal3:'Pastikan akun Telegram kamu aktif sebelum bergabung.',paymentBusy:'Menyiapkan pembayaran...',payment:'Lanjut ke pembayaran',login:'Silakan login untuk membeli Group VIP.',owned:'Group ini sudah kamu beli. Buka Akun Saya untuk melihat link undangan.',failed:'Tidak dapat membuat pembayaran.',secure:'Akses diberikan setelah pembayaran terverifikasi.',close:'Tutup',dbHint:'Jalankan migrasi SQL VIP Groups di Supabase.'},
 en:{brandLabel:'BOXCELLINK MEMBERSHIP',modalLabel:'GROUP MEMBERSHIP',tagUpdates:'Latest updates',tagLifetime:'Lifetime access',heroDesc:'Explore curated media, watch instantly, save available content, and enjoy regular updates. Choose the community that fits you.',point1:'Watch & save content',point2:'Regular updates',point3:'One-time payment',chooseGroup:'Explore groups',benefit1:'Watch instantly',benefit1d:'Enjoy media without a complicated process.',benefit2:'Save media',benefit2d:'Download and keep available media.',benefit3:'Regular updates',benefit3d:'Curated collections with fresh updates.',benefit4:'Account-backed access',benefit4d:'Your purchase is recorded in your BoxCellink account.',sectionEyebrow:'CHOOSE YOUR ACCESS',sectionTitle:'Find Your Community',sectionDesc:'One-time payment for permanent access to your selected group.',cashi:'Cashi secure payment',accessInfo:'Access information',accessInfoDesc:'Once payment is verified, your group access is automatically saved to My Account. Invitation links use the latest link configured by the admin.',continuePayment:'Continue to payment',joinGroup:'Join Telegram group',loading:'Loading available groups...',empty:'No VIP groups are available yet. Please contact the admin.',serviceError:'The service is unavailable. Please reload the page.',select:'Choose group',once:'ONE-TIME PAYMENT · LIFETIME ACCESS',tag:'PREMIUM ACCESS',description:'An exclusive Telegram group with curated media and regular updates.',feature1:'Curated media to watch instantly',feature2:'Save available media',feature3:'Fresh content based on the group theme',feature4:'Permanent access after successful payment',modal1:'One-time payment for permanent access.',modal2:'The invitation link follows the latest admin settings and is available in My Account.',modal3:'Make sure your Telegram account is active before joining.',paymentBusy:'Preparing payment...',payment:'Continue to payment',login:'Please sign in to purchase a VIP group.',owned:'You already own this group. Open My Account to view its invitation link.',failed:'Unable to create the payment.',secure:'Access is granted after payment verification.',close:'Close',dbHint:'Run the VIP Groups SQL migration in Supabase.'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rp=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
const tr=k=>T[lang][k]||T.id[k]||k;
function applyLanguage(){
 document.documentElement.lang=lang;
 document.querySelectorAll('[data-vip-i18n]').forEach(el=>{
  const key=el.dataset.vipI18n;if(key==='heroTitle')el.innerHTML=lang==='en'?'Telegram Groups <em>Premium Access</em>':'Group Telegram <em>Premium Access</em>';
  else if(key==='accessInfoDesc')el.innerHTML=lang==='en'?'After your payment is verified, group access is saved automatically in <a href="/account.html">My Account</a>. Invitation links always use the latest link configured by the admin.':'Setelah pembayaran berhasil diverifikasi, akses group otomatis tersimpan di <a href="/account.html">Akun Saya</a>. Link undangan mengikuti link terbaru yang diatur admin.';
  else el.textContent=tr(key);
 });
 const close=document.getElementById('modalClose');if(close)close.setAttribute('aria-label',tr('close'));
 const title=document.querySelector('.vip-modal-secure [data-vip-i18n="secure"]');if(title)title.textContent=tr('secure');
 document.title=lang==='en'?'VIP Telegram Groups — BoxCellink':'Group VIP Telegram — BoxCellink';
}
function card(g,i){const f=[tr('feature1'),tr('feature2'),tr('feature3'),tr('feature4')];return `<article class="vip-group-card"><div class="vip-card-top"><span class="vip-card-icon"><i class="fa-brands fa-telegram"></i></span><span class="vip-card-label">${tr('tag')}</span></div><h3>${esc(g.name)}</h3><p>${esc(g.description||tr('description'))}</p><ul class="vip-card-features">${f.map(x=>`<li><i class="fa-solid fa-circle-check"></i>${esc(x)}</li>`).join('')}</ul><div class="vip-card-bottom"><div class="vip-price"><small>${tr('once')}</small><strong>${rp(g.price)}</strong></div><button class="vip-buy" type="button" data-group="${esc(g.id)}">${tr('select')} <i class="fa-solid fa-arrow-right"></i></button></div></article>`}
async function loadGroups(){
 if(!window.sb){root.innerHTML=`<div class="vip-empty">${tr('serviceError')}</div>`;return}
 root.innerHTML=`<div class="vip-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> ${tr('loading')}</div>`;
 const {data,error}=await sb.from('vip_groups').select('id,name,description,price,status').eq('status','published').order('price',{ascending:false});
 if(error){root.innerHTML=`<div class="vip-empty">${esc(error.message)}<br><small>${tr('dbHint')}</small></div>`;return}
 root.innerHTML=(data||[]).map(card).join('')||`<div class="vip-empty">${tr('empty')}</div>`;
 root.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>show((data||[]).find(g=>g.id===b.dataset.group))));
}
async function show(g){
 if(!g)return;selected=g;let coupons=[];const {data:{user}}=await sb.auth.getUser();if(user){const r=await sb.from('admin_discount_claims').select('used_at,admin_discount_codes(code,scope,discount_percent,expires_at)').eq('user_id',user.id);coupons=(r.data||[]).filter(x=>!x.used_at&&x.admin_discount_codes&&['all','vip_group'].includes(x.admin_discount_codes.scope||'all')&&(!x.admin_discount_codes.expires_at||new Date(x.admin_discount_codes.expires_at)>new Date())).map(x=>x.admin_discount_codes)}
 document.getElementById('groupDetail').innerHTML=`<h2 id="groupModalTitle">${esc(g.name)}</h2><p>${esc(g.description||tr('description'))}</p><div class="vip-modal-price">${rp(g.price)}</div><label style="display:grid;gap:7px;margin:14px 0;font-weight:700;font-size:13px">Kode diskon yang sudah di-claim<select id="groupCoupon" style="padding:11px;border:1px solid #dbe4ef;border-radius:10px"><option value="">Tanpa kode diskon</option>${coupons.map(c=>`<option value="${esc(c.code)}">${esc(c.code)} · ${Number(c.discount_percent)}%</option>`).join('')}</select></label><ul><li>${tr('modal1')}</li><li>${tr('modal2')}</li><li>${tr('modal3')}</li></ul>`;
 document.getElementById('groupPay').hidden=false;document.getElementById('groupJoin').hidden=true;modal.hidden=false;
}
async function pay(){
 if(!selected||busy)return;busy=true;const btn=document.getElementById('groupPay');btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> '+tr('paymentBusy');
 try{
  const {data:{user},error:authError}=await sb.auth.getUser();if(authError)throw authError;
  if(!user){location.href='/login.html?next='+encodeURIComponent('/vip-groups.html');return}
  const {data:owned,error:ownedError}=await sb.from('vip_group_entitlements').select('id').eq('user_id',user.id).eq('group_id',selected.id).maybeSingle();
  if(ownedError)throw ownedError;if(owned)throw new Error(tr('owned'));
  const coupon=document.getElementById('groupCoupon')?.value||'';
  const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'vip_group',group_id:selected.id,coupon_code:coupon||undefined}});
  if(error)throw error;if(!data?.checkout_url)throw new Error(data?.error||tr('failed'));
  sessionStorage.setItem('boxcellink_pending_group_order',data.order_id||'');location.href=data.checkout_url;
 }catch(e){alert(e.message||tr('failed'))}
 finally{busy=false;btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-lock"></i> '+tr('payment')}
}
document.addEventListener('boxcellink:language-change',e=>{lang=e.detail?.lang==='en'?'en':'id';applyLanguage();loadGroups();if(selected&&!modal.hidden)show(selected);});
document.getElementById('modalClose').addEventListener('click',()=>modal.hidden=true);
modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});
document.getElementById('groupPay').addEventListener('click',pay);
applyLanguage();loadGroups();
})();