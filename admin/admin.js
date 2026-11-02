import { sb } from '../js/config.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let cats=[],servers=[];
async function guard(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){location.href='../pages/login.html?next=admin';return false}
 const {data:p,error}=await sb.from('profiles').select('role').eq('id',user.id).single();
 if(error||p?.role!=='admin'){alert('Akses admin ditolak.');location.href='../index.html';return false}
 $('adminEmail').textContent=user.email||'Administrator';return true;
}
function table(headers,rows){return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||'<tr><td colspan="8">Belum ada data.</td></tr>'}</tbody></table>`}
async function stats(){
 const tables=['videos','telegram_items','profiles'];const counts=await Promise.all(tables.map(t=>sb.from(t).select('*',{count:'exact',head:true})));
 $('stats').innerHTML=['Total video','Konten Telegram','Pengguna'].map((n,i)=>`<div class="stat-card"><span>${n}</span><strong>${counts[i].count??'—'}</strong></div>`).join('');
}
async function loadVideos(){
 const {data,error}=await sb.from('videos').select('id,title,provider,access,status,download_enabled').order('created_at',{ascending:false});
 if(error){$('videoAdmin').textContent=error.message;return}
 $('videoAdmin').innerHTML=table(['Judul','Provider','Akses','Status','Download','Aksi'],(data||[]).map(v=>`<tr><td>${esc(v.title)}</td><td>${esc(v.provider)}</td><td>${esc(v.access)}</td><td><span class="status-pill ${v.status==='published'?'published':''}">${esc(v.status)}</span></td><td>${v.download_enabled?'Aktif':'Nonaktif'}</td><td><button data-edit-video="${v.id}">Edit</button><button data-toggle-video="${v.id}" data-status="${v.status}">${v.status==='published'?'Draft':'Publish'}</button><button class="danger" data-delete-video="${v.id}">Hapus</button></td></tr>`).join(''));
}
async function loadTelegram(){
 const {data,error}=await sb.from('telegram_items').select('id,title,type,price,status').order('created_at',{ascending:false});
 if(error){$('telegramAdmin').textContent=error.message;return}
 $('telegramAdmin').innerHTML=table(['Judul','Tipe','Harga','Status','Aksi'],(data||[]).map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.type)}</td><td>Rp ${Number(x.price||0).toLocaleString('id-ID')}</td><td>${esc(x.status)}</td><td><button data-edit-telegram="${x.id}">Edit</button><button data-toggle-telegram="${x.id}" data-status="${x.status}">${x.status==='published'?'Draft':'Publish'}</button><button class="danger" data-delete-telegram="${x.id}">Hapus</button></td></tr>`).join(''))
}
async function loadOrders(){
 const [t,v]=await Promise.all([
  sb.from('telegram_orders').select('id,user_id,item_id,amount,status,created_at').order('created_at',{ascending:false}).limit(100),
  sb.from('vip_orders').select('id,user_id,plan_id,amount,status,created_at').order('created_at',{ascending:false}).limit(100)
 ]);
 if(t.error||v.error){$('orderAdmin').textContent=t.error?.message||v.error?.message;return}
 const rows=[...(t.data||[]).map(x=>({...x,kind:'Telegram'})),...(v.data||[]).map(x=>({...x,kind:'VIP'}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 $('orderAdmin').innerHTML=table(['Jenis','Order ID','User ID','Nominal','Status','Aksi'],rows.map(o=>`<tr><td>${o.kind}</td><td>${esc(o.id)}</td><td>${esc(o.user_id)}</td><td>Rp ${Number(o.amount).toLocaleString('id-ID')}</td><td>${esc(o.status)}</td><td>${o.status==='pending'?`<button data-mark-order="${o.id}" data-kind="${o.kind}">Tandai Lunas</button>`:'—'}</td></tr>`).join(''))
}
async function loadPlans(){
 const {data,error}=await sb.from('vip_plans').select('*').order('price');
 if(error){$('planAdmin').textContent=error.message;return}
 $('planAdmin').innerHTML=table(['Nama','Durasi','Harga','Status','Aksi'],(data||[]).map(p=>`<tr><td>${esc(p.name)}</td><td>${p.duration_days} hari</td><td>Rp ${Number(p.price).toLocaleString('id-ID')}</td><td>${esc(p.status)}</td><td><button data-edit-plan="${p.id}">Edit</button><button class="danger" data-delete-plan="${p.id}">Hapus</button></td></tr>`).join(''))
}
async function loadCats(){const {data,error}=await sb.from('categories').select('*').order('name');if(error){$('categoryAdmin').textContent=error.message;return}cats=data||[];$('categoryAdmin').innerHTML=table(['Nama','Status','Aksi'],cats.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.status)}</td><td><button data-edit-cat="${c.id}">Edit</button><button class="danger" data-del-cat="${c.id}">Hapus</button></td></tr>`).join(''))}
async function loadServers(){const {data,error}=await sb.from('servers').select('*').order('name');if(error){$('serverAdmin').textContent=error.message;return}servers=data||[];$('serverAdmin').innerHTML=table(['Nama','Tipe','Status','Aksi'],servers.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.type)}</td><td>${esc(s.status)}</td><td><button data-edit-server="${s.id}">Edit</button><button class="danger" data-del-server="${s.id}">Hapus</button></td></tr>`).join(''))}
async function loadUsers(){const {data,error}=await sb.from('profiles').select('id,full_name,role,vip_expires_at,created_at').order('created_at',{ascending:false});$('userAdmin').innerHTML=error?esc(error.message):table(['Nama','Role','VIP sampai','Terdaftar','Aksi'],(data||[]).map(u=>`<tr><td>${esc(u.full_name||'—')}</td><td>${esc(u.role)}</td><td>${u.vip_expires_at?new Date(u.vip_expires_at).toLocaleString('id-ID'):'—'}</td><td>${new Date(u.created_at).toLocaleDateString('id-ID')}</td><td><button data-set-vip="${u.id}">Atur VIP</button></td></tr>`).join(''))}
async function refresh(){await Promise.all([stats(),loadVideos(),loadTelegram(),loadCats(),loadServers(),loadUsers(),loadPlans(),loadOrders()])}
function show(id){document.querySelectorAll('.admin-section').forEach(s=>s.classList.toggle('hidden',s.id!==id));document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===id));$('pageTitle').textContent=({overview:'Dashboard',videos:'Video & Embed',telegram:'Code Bot Telegram',categories:'Kategori',servers:'Server',users:'Pengguna',plans:'Paket VIP',orders:'Pesanan'})[id]||'Admin'}
document.querySelectorAll('[data-section]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.section)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
$('logout').onclick=async()=>{await sb.auth.signOut();location.href='../pages/login.html'};
$('addVideo').onclick=async()=>{
 const title=prompt('Judul video:');if(!title?.trim())return;
 const provider=prompt('Provider (Videy / Custom):','Videy');if(!provider)return;
 const embed_url=prompt('URL embed:');if(!embed_url)return;
 const access=prompt('Akses: public atau vip','public');if(!['public','vip'].includes(access))return alert('Akses harus public atau vip.');
 const download_url=prompt('URL download (kosongkan jika tidak ada):','')||null;
 const category_id=prompt('ID kategori (opsional, kosongkan jika tidak ada):','')||null;
 const status=confirm('Publikasikan sekarang?')?'published':'draft';
 const {error}=await sb.from('videos').insert({title:title.trim(),provider,embed_url,download_url,access,download_enabled:!!download_url,category_id,status});
 if(error)alert(error.message);else{await loadVideos();await stats()}
};
$('addCategory').onclick=async()=>{const name=prompt('Nama kategori:');if(!name?.trim())return;const {error}=await sb.from('categories').insert({name:name.trim()});if(error)alert(error.message);else loadCats()};
$('addServer').onclick=async()=>{const name=prompt('Nama server:');if(!name?.trim())return;const type=prompt('Tipe server:','storage')||'storage';const folder_endpoint=prompt('Endpoint/folder (opsional):','')||null;const {error}=await sb.from('servers').insert({name:name.trim(),type,folder_endpoint});if(error)alert(error.message);else loadServers()};
$('addTelegram').onclick=async()=>{
 const title=prompt('Judul konten:');if(!title?.trim())return;
 const type=prompt('Tipe: free atau paid','free');if(!['free','paid'].includes(type))return alert('Tipe harus free atau paid.');
 const price=type==='paid'?Number(prompt('Harga (Rupiah):','3000')||0):0;
 if(!Number.isFinite(price)||price<0)return alert('Harga tidak valid.');
 const review_embed_url=type==='paid'?(prompt('URL embed review (opsional):','')||null):null;
 const download_url=prompt('URL download (wajib):','');if(!download_url?.trim())return alert('URL download wajib diisi.');
 const status=confirm('Publikasikan sekarang?')?'published':'draft';
 const {data,error}=await sb.from('telegram_items').insert({title:title.trim(),type,price,review_embed_url,status}).select('id').single();
 if(error){alert(error.message);return}
 const {error:assetError}=await sb.from('telegram_assets').upsert({item_id:data.id,download_url:download_url.trim()});
 if(assetError){alert('Konten dibuat, tetapi URL download gagal disimpan: '+assetError.message);return}
 await loadTelegram();await stats();
};
$('refreshOrders').onclick=loadOrders;\n$('addPlan').onclick=async()=>{
 const name=prompt('Nama paket VIP:');if(!name?.trim())return;
 const duration_days=Number(prompt('Durasi (hari):','30')),price=Number(prompt('Harga (Rupiah):','50000'));
 if(!Number.isInteger(duration_days)||duration_days<1||!Number.isFinite(price)||price<0)return alert('Durasi/harga tidak valid.');
 const {error}=await sb.from('vip_plans').insert({name:name.trim(),duration_days,price,status:'published'});
 if(error)alert(error.message);else loadPlans();
};
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.deleteVideo){if(confirm('Hapus video ini?')){const {error}=await sb.from('videos').delete().eq('id',b.dataset.deleteVideo);if(error)alert(error.message);else{loadVideos();stats()}}}
 if(b.dataset.toggleVideo){const {error}=await sb.from('videos').update({status:b.dataset.status==='published'?'draft':'published'}).eq('id',b.dataset.toggleVideo);if(error)alert(error.message);else loadVideos()}
 if(b.dataset.editVideo){const {data:v}=await sb.from('videos').select('*').eq('id',b.dataset.editVideo).single();if(!v)return;const title=prompt('Judul:',v.title);if(title===null)return;const embed_url=prompt('URL embed:',v.embed_url);if(embed_url===null)return;const download_url=prompt('URL download:',v.download_url||'');if(download_url===null)return;const {error}=await sb.from('videos').update({title,embed_url,download_url:download_url||null,download_enabled:!!download_url}).eq('id',v.id);if(error)alert(error.message);else loadVideos()}
 if(b.dataset.editCat){const c=cats.find(x=>x.id===b.dataset.editCat);const name=prompt('Nama kategori:',c?.name);if(name?.trim()){const {error}=await sb.from('categories').update({name:name.trim()}).eq('id',c.id);if(error)alert(error.message);else loadCats()}}
 if(b.dataset.delCat){if(confirm('Hapus kategori? Video terkait tidak ikut terhapus.')){const {error}=await sb.from('categories').delete().eq('id',b.dataset.delCat);if(error)alert(error.message);else loadCats()}}
 if(b.dataset.editServer){const s=servers.find(x=>x.id===b.dataset.editServer);const name=prompt('Nama server:',s?.name);if(name?.trim()){const {error}=await sb.from('servers').update({name:name.trim()}).eq('id',s.id);if(error)alert(error.message);else loadServers()}}
 if(b.dataset.delServer){if(confirm('Hapus server?')){const {error}=await sb.from('servers').delete().eq('id',b.dataset.delServer);if(error)alert(error.message);else loadServers()}}
 if(b.dataset.deleteTelegram){if(confirm('Hapus konten Telegram?')){const {error}=await sb.from('telegram_items').delete().eq('id',b.dataset.deleteTelegram);if(error)alert(error.message);else{loadTelegram();stats()}}}
 if(b.dataset.toggleTelegram){const {error}=await sb.from('telegram_items').update({status:b.dataset.status==='published'?'draft':'published'}).eq('id',b.dataset.toggleTelegram);if(error)alert(error.message);else loadTelegram()}
 if(b.dataset.editTelegram){const {data:v}=await sb.from('telegram_items').select('*').eq('id',b.dataset.editTelegram).single();if(!v)return;const title=prompt('Judul:',v.title);if(title===null)return;const type=prompt('Tipe free/paid:',v.type);if(!['free','paid'].includes(type))return alert('Tipe tidak valid');const price=type==='paid'?Number(prompt('Harga:',v.price)||0):0;const review_embed_url=type==='paid'?(prompt('URL review:',v.review_embed_url||'')||null):null;const {data:a}=await sb.from('telegram_assets').select('download_url').eq('item_id',v.id).maybeSingle();const download_url=prompt('URL download:',a?.download_url||'');if(download_url===null)return;const {error}=await sb.from('telegram_items').update({title,type,price,review_embed_url}).eq('id',v.id);if(error){alert(error.message);return}const {error:ae}=await sb.from('telegram_assets').upsert({item_id:v.id,download_url});if(ae)alert(ae.message);else loadTelegram()}
 if(b.dataset.editPlan){const {data:p}=await sb.from('vip_plans').select('*').eq('id',b.dataset.editPlan).single();if(!p)return;const name=prompt('Nama:',p.name);if(name===null)return;const duration_days=Number(prompt('Durasi hari:',p.duration_days));const price=Number(prompt('Harga:',p.price));const status=prompt('Status published/draft/archived:',p.status);if(!['published','draft','archived'].includes(status))return alert('Status tidak valid');const {error}=await sb.from('vip_plans').update({name,duration_days,price,status}).eq('id',p.id);if(error)alert(error.message);else loadPlans()}
 if(b.dataset.deletePlan){if(confirm('Hapus paket VIP?')){const {error}=await sb.from('vip_plans').delete().eq('id',b.dataset.deletePlan);if(error)alert(error.message);else loadPlans()}}
 if(b.dataset.markOrder){
  if(!confirm('Pastikan pembayaran sudah diterima sebelum menandai lunas. Lanjutkan?'))return;
  const tableName=b.dataset.kind==='VIP'?'vip_orders':'telegram_orders';
  const {error}=await sb.from(tableName).update({status:'paid',paid_at:new Date().toISOString()}).eq('id',b.dataset.markOrder);
  if(error)alert(error.message);else{await loadOrders();await loadUsers()}
 }
 if(b.dataset.setVip){const days=Number(prompt('Tambahkan VIP berapa hari? (0 untuk cabut VIP)','30'));if(!Number.isInteger(days)||days<0)return alert('Durasi tidak valid');const {data:u}=await sb.from('profiles').select('vip_expires_at').eq('id',b.dataset.setVip).single();const base=u?.vip_expires_at&&new Date(u.vip_expires_at)>new Date()?new Date(u.vip_expires_at):new Date();if(days===0){const {error}=await sb.from('profiles').update({vip_expires_at:null}).eq('id',b.dataset.setVip);if(error)alert(error.message);else loadUsers()}else{base.setDate(base.getDate()+days);const {error}=await sb.from('profiles').update({vip_expires_at:base.toISOString()}).eq('id',b.dataset.setVip);if(error)alert(error.message);else loadUsers()}}
});
if(await guard()){show('overview');await refresh()}
