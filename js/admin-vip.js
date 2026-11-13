const $=id=>document.getElementById(id);
const escV=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null, busy=false;
const money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
function notify(message){let el=$('adminNotice');if(!el){el=document.createElement('div');el.id='adminNotice';el.setAttribute('role','status');el.style.cssText='position:sticky;top:12px;z-index:2000;padding:12px 16px;margin:12px 0;border-radius:12px;background:#eaf4ff;color:#124477;border:1px solid #b7d7f5;font-weight:700;';$('adminEmail')?.parentElement?.after(el)}el.textContent=message;el.hidden=false}
function showError(message){$('formError').textContent=message;notify(message)}
async function guard(){
 const {data:{user},error:authError}=await sb.auth.getUser();
 if(authError||!user){location.href='login.html';return false}
 const {data:p,error}=await sb.from('profiles').select('role,is_banned').eq('id',user.id).maybeSingle();
 if(error){notify('Gagal memeriksa hak admin: '+error.message);return false}
 if(p?.role!=='admin'||p?.is_banned){location.href='dashboard.html';return false}
 $('adminEmail').textContent=user.email||'';return true
}
async function readTable(table,query){const r=await query;if(r.error)notify('Gagal membaca '+table+': '+r.error.message);return r}
async function refresh(){
 if(!await guard())return;
 const [a,b,c,secrets]=await Promise.all([
  readTable('vip_plans',sb.from('vip_plans').select('id,name,duration_days,price,status,created_at').order('price')),
  readTable('vip_groups',sb.from('vip_groups').select('id,name,description,price,member_count,status,created_at').order('created_at',{ascending:false})),
  readTable('admin_discount_codes',sb.from('admin_discount_codes').select('*').order('created_at',{ascending:false})),
  readTable('vip_group_secrets',sb.from('vip_group_secrets').select('group_id,telegram_url'))
 ]);
 if(secrets.error)notify('Link undangan tidak dapat dibaca: '+secrets.error.message+' — periksa SQL/RLS vip_group_secrets.');
 const secretMap=new Map((secrets.data||[]).map(x=>[x.group_id,x.telegram_url]));
 $('planList').innerHTML=a.error?`<p class="error">${escV(a.error.message)}</p>`:(a.data||[]).map(x=>`<article class="manager-row"><div><b>${escV(x.name)}</b><small>${x.duration_days} hari · ${money(x.price)} · ${escV(x.status)}</small></div><div><button type="button" data-edit-plan="${x.id}">Edit</button><button type="button" data-del-plan="${x.id}" class="danger">Hapus</button></div></article>`).join('')||'<p>Belum ada paket VIP.</p>';
 $('groupList').innerHTML=b.error?`<p class="error">${escV(b.error.message)}</p>`:(b.data||[]).map(x=>`<article class="manager-row"><div><b>${escV(x.name)}</b><small>${money(x.price)} · ${x.member_count||0} member · ${escV(x.status)} · ${secretMap.has(x.id)?'Link: <a href="'+escV(secretMap.get(x.id))+'" target="_blank" rel="noopener">'+escV(secretMap.get(x.id))+'</a>':'Link belum diatur'}</small></div><div><button type="button" data-edit-group="${x.id}">Edit</button><button type="button" data-del-group="${x.id}" class="danger">Hapus</button></div></article>`).join('')||'<p>Belum ada group VIP.</p>';
 $('discountList').innerHTML=c.error?`<p class="error">${escV(c.error.message)}</p>`:(c.data||[]).map(x=>`<article class="manager-row"><div><b>${escV(x.code)} · Diskon ${x.discount_percent}%</b><small>${({'all':'Semua pembelian','vip_account':'VIP Akun','vip_group':'Group VIP','telegram_review':'Review Telegram'}[x.scope||'all'])} · ${money(x.min_purchase)} minimum · ${x.claimed_count||0}/${x.claim_limit} klaim · ${x.expires_at?'Expired '+new Date(x.expires_at).toLocaleString('id-ID'):'Tanpa batas waktu'}</small></div><div><button type="button" data-edit-discount="${x.id}">Edit</button><button type="button" data-del-discount="${x.id}" class="danger">Hapus</button></div></article>`).join('')||'<p>Belum ada kode diskon.</p>';
 (a.data||[]).forEach(x=>{$(`[data-edit-plan="${x.id}"]`)?.addEventListener('click',()=>openForm('plan',x));$(`[data-del-plan="${x.id}"]`)?.addEventListener('click',()=>remove('vip_plans',x.id,'plan'))});
 (b.data||[]).forEach(x=>{$(`[data-edit-group="${x.id}"]`)?.addEventListener('click',()=>openForm('group',{...x,telegram_url:secretMap.get(x.id)||''}));$(`[data-del-group="${x.id}"]`)?.addEventListener('click',()=>remove('vip_groups',x.id,'group'))});
 (c.data||[]).forEach(x=>{$(`[data-edit-discount="${x.id}"]`)?.addEventListener('click',()=>openForm('discount',x));$(`[data-del-discount="${x.id}"]`)?.addEventListener('click',()=>remove('admin_discount_codes',x.id,'discount'))});
}
function openForm(type,x=null){
 current=type;$('managerModal').hidden=false;$('recordType').value=type;$('recordId').value=x?.id||'';
 $('formTitle').textContent=(x?'Edit ':'Tambah ')+({plan:'VIP Akun',group:'Group VIP Telegram',discount:'Kode Diskon'}[type]);
 $('recordName').value=x?.name||'';$('recordDescription').value=x?.description||'';
 $('recordDuration').value=x?.duration_days??1;$('recordPrice').value=x?.price??15000;
 $('groupPrice').value=x?.price??5000;$('groupUrl').value=x?.telegram_url||'';
 $('memberCount').value=x?.member_count??0;$('recordStatus').value=x?.status||'published';
 $('discountCode').value=x?.code||'';$('discountScope').value=x?.scope||'all';$('discountPercent').value=x?.discount_percent??20;
 $('discountMin').value=x?.min_purchase??2000;$('discountLimit').value=x?.claim_limit??2;
 $('discountExpiry').value=x?.expires_at?new Date(new Date(x.expires_at).getTime()-new Date(x.expires_at).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
 $('planFields').hidden=type!=='plan';$('groupFields').hidden=type!=='group';$('discountFields').hidden=type!=='discount';
 $('descriptionField').hidden=type!=='group';$('statusField').hidden=type==='discount';
 $('recordName').required=type!=='discount';$('recordDuration').required=type==='plan';$('recordPrice').required=type==='plan';$('groupPrice').required=type==='group';$('discountCode').required=type==='discount';
 $('formError').textContent='';
}
async function remove(table,id,type){
 const label={vip_plans:'paket VIP',vip_groups:'Group VIP',admin_discount_codes:'kode diskon'}[table]||'data';
 if(!confirm(`Hapus ${label} ini? Jika sudah terkait transaksi, sistem akan mengarsipkannya agar riwayat pembayaran tetap aman.`))return;
 // Preserve historical purchases and paid access: a group with entitlements
 // is archived instead of hard-deleted (the entitlement FK cascades).
 if(type==='group'){
  const {count,error:countError}=await sb.from('vip_group_entitlements').select('id',{count:'exact',head:true}).eq('group_id',id);
  if(countError){notify('Tidak dapat memeriksa riwayat pembelian: '+countError.message);return}
  if((count||0)>0){
   const {error:archiveError}=await sb.from(table).update({status:'archived'}).eq('id',id);
   if(archiveError){notify('Gagal mengarsipkan group: '+archiveError.message);return}
   notify('Group diarsipkan karena sudah memiliki pembeli. Riwayat akses tetap aman.');await refresh();return;
  }
 }
 const {error}=await sb.from(table).delete().eq('id',id);
 if(error){
  if((type==='plan'||type==='group')&&(/foreign key|violates.*constraint|23503|constraint/i.test(error.message))){
   const {error:archiveError}=await sb.from(table).update({status:'archived'}).eq('id',id);
   if(archiveError){notify('Tidak bisa menghapus atau mengarsipkan: '+archiveError.message);return}
   notify(`${label} sudah dipakai transaksi, jadi diarsipkan. Riwayat pembayaran tetap aman.`);
  }else{notify('Gagal menghapus '+label+': '+error.message);return}
 }else notify(label+' berhasil dihapus.');
 await refresh();
}
$('addPlan').onclick=()=>openForm('plan');
$('addGroup').onclick=()=>openForm('group');
$('addDiscount').onclick=()=>openForm('discount');
$('closeManager').onclick=()=>$('managerModal').hidden=true;
$('logout').onclick=async()=>{await sb.auth.signOut();location.href='login.html'};
$('managerForm').onsubmit=async e=>{
 e.preventDefault();if(busy)return;busy=true;
 const submit=$('managerForm').querySelector('[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Menyimpan...'}
 try{
  const id=$('recordId').value,type=current;let table,payload;
  if(type==='plan'){
   table='vip_plans';payload={name:$('recordName').value.trim(),duration_days:Number($('recordDuration').value),price:Number($('recordPrice').value),status:$('recordStatus').value};
   if(!payload.name||!Number.isInteger(payload.duration_days)||payload.duration_days<1||!Number.isInteger(payload.price)||payload.price<2000)throw new Error('Nama, durasi, atau harga VIP tidak valid.');
  }else if(type==='group'){
   table='vip_groups';const url=$('groupUrl').value.trim();
   if(url&&!/^https:\/\/(t\.me|telegram\.me)\//i.test(url))throw new Error('Link harus berupa undangan Telegram https://t.me/ atau https://telegram.me/.');
   payload={name:$('recordName').value.trim(),description:$('recordDescription').value.trim(),price:Number($('groupPrice').value),member_count:Number($('memberCount').value||0),status:$('recordStatus').value};
   if(!payload.name||!Number.isInteger(payload.price)||payload.price<2000||!Number.isInteger(payload.member_count)||payload.member_count<0)throw new Error('Nama, harga, atau jumlah member Group VIP tidak valid.');
  }else{
   table='admin_discount_codes';const cap=Number($('discountLimit').value);
   if(cap<1||cap>10000)throw new Error('Kapasitas klaim harus 1 sampai 10.000 member.');
   payload={code:$('discountCode').value.trim().toUpperCase(),scope:$('discountScope').value,discount_percent:Number($('discountPercent').value),min_purchase:Number($('discountMin').value),claim_limit:cap,expires_at:$('discountExpiry').value?new Date($('discountExpiry').value).toISOString():null};
   if(!/^[A-Z0-9_-]{3,32}$/.test(payload.code))throw new Error('Kode diskon harus 3–32 karakter (huruf, angka, - atau _).');
   if(payload.discount_percent<1||payload.discount_percent>75)throw new Error('Diskon harus 10–75%.');
   if(!Number.isFinite(payload.min_purchase)||payload.min_purchase<2000)throw new Error('Minimal pembelian paling sedikit Rp2.000.');
  }
  let result;
  if(type==='group'){
   result=id?await sb.from(table).update(payload).eq('id',id).select('id').single():await sb.from(table).insert(payload).select('id').single();
   if(result.error)throw new Error('Gagal menyimpan data Group VIP: '+result.error.message);
   const groupId=result.data.id,url=$('groupUrl').value.trim();
   const secretResult=url
    ?await sb.from('vip_group_secrets').upsert({group_id:groupId,telegram_url:url,updated_at:new Date().toISOString()},{onConflict:'group_id'})
    :await sb.from('vip_group_secrets').delete().eq('group_id',groupId);
   if(secretResult.error)throw new Error('Data group tersimpan, tetapi link Telegram gagal disimpan: '+secretResult.error.message);
  }else{
   result=id?await sb.from(table).update(payload).eq('id',id).select('id').single():await sb.from(table).insert(payload).select('id').single();
   if(result.error)throw new Error('Gagal menyimpan '+({plan:'paket VIP',discount:'kode diskon'}[type])+': '+result.error.message);
  }
  $('managerModal').hidden=true;notify('Perubahan berhasil disimpan.');await refresh();
 }catch(err){showError(err.message||'Terjadi kesalahan saat menyimpan.')}
 finally{busy=false;if(submit){submit.disabled=false;submit.textContent='Simpan Perubahan'}}
};
refresh();
