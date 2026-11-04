(()=>{
 const root=document.getElementById('groups'),modal=document.getElementById('groupModal');let selected=null,busy=false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rp=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
 const features=['Koleksi media pilihan yang dapat ditonton langsung','Media yang tersedia dapat disimpan','Konten viral dan terbaru sesuai tema group','Akses permanen setelah pembayaran berhasil'];
 function card(g,i){return `<article class="vip-group-card"><div class="vip-card-top"><span class="vip-card-icon"><i class="fa-brands fa-telegram"></i></span><span class="vip-card-label">${i===0?'PREMIUM ACCESS':'LIFETIME MEMBERSHIP'}</span></div><h3>${esc(g.name)}</h3><p>${esc(g.description||'Group Telegram eksklusif dengan koleksi media pilihan dan pembaruan rutin.')}</p><ul class="vip-card-features">${features.map(x=>`<li><i class="fa-solid fa-circle-check"></i>${x}</li>`).join('')}</ul><div class="vip-card-bottom"><div class="vip-price"><small>SEKALI BAYAR · PERMANEN</small><strong>${rp(g.price)}</strong></div><button class="vip-buy" type="button" data-group="${esc(g.id)}">Pilih Group <i class="fa-solid fa-arrow-right"></i></button></div></article>`}
 async function loadGroups(){
  if(!window.sb){root.innerHTML='<div class="vip-empty">Layanan pembayaran belum tersedia.</div>';return}
  root.innerHTML='<div class="vip-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Memuat pilihan group...</div>';
  const {data,error}=await sb.from('vip_groups').select('id,name,description,price,status').eq('status','published').order('price',{ascending:false});
  if(error){root.innerHTML=`<div class="vip-empty">${esc(error.message)}<br><small>Pastikan migrasi Group VIP terbaru sudah dijalankan.</small></div>`;return}
  root.innerHTML=(data||[]).map(card).join('')||'<div class="vip-empty">Belum ada Group VIP yang tersedia. Silakan hubungi admin.</div>';
  root.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>show((data||[]).find(g=>g.id===b.dataset.group))));
 }
 function show(g){
  if(!g)return;selected=g;
  document.getElementById('groupDetail').innerHTML=`<h2 id="groupModalTitle">${esc(g.name)}</h2><p>${esc(g.description||'Akses permanen ke koleksi media Telegram pilihan.')}</p><div class="vip-modal-price">${rp(g.price)}</div><ul><li>Pembayaran satu kali, akses permanen.</li><li>Link group tersedia di halaman Akun Saya selama 12 jam setelah pembayaran berhasil.</li><li>Pastikan akun Telegram kamu aktif sebelum bergabung.</li></ul>`;
  document.getElementById('groupPay').hidden=false;document.getElementById('groupJoin').hidden=true;modal.hidden=false;
 }
 async function pay(){
  if(!selected||busy)return;busy=true;const btn=document.getElementById('groupPay');btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Menyiapkan pembayaran...';
  try{
   const {data:{user},error:authError}=await sb.auth.getUser();if(authError)throw authError;
   if(!user){location.href='/login.html?next='+encodeURIComponent('/vip-groups.html');return}
   const {data:owned,error:ownedError}=await sb.from('vip_group_entitlements').select('id,invite_expires_at').eq('user_id',user.id).eq('group_id',selected.id).maybeSingle();
   if(ownedError)throw ownedError;
   if(owned){
    const expiry=owned.invite_expires_at?new Date(owned.invite_expires_at):null;
    if(expiry&&expiry>Date.now())throw new Error('Group ini sudah kamu beli. Link undangan tersedia di halaman Akun Saya.');
    throw new Error('Group ini sudah pernah dibeli. Link undangan telah berakhir; hubungi admin untuk bantuan akses.');
   }
   const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'vip_group',group_id:selected.id}});
   if(error)throw error;if(!data?.checkout_url)throw new Error(data?.error||'Cashi belum mengembalikan link pembayaran.');
   sessionStorage.setItem('boxcellink_pending_group_order',data.order_id||'');
   location.href=data.checkout_url;
  }catch(e){alert(e.message||'Tidak dapat membuat pembayaran.');}
  finally{busy=false;btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-lock"></i> Lanjut ke pembayaran'}
 }
 document.getElementById('modalClose').addEventListener('click',()=>modal.hidden=true);
 modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});
 document.getElementById('groupPay').addEventListener('click',pay);
 loadGroups();
})();