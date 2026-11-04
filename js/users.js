const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleDateString('id-ID'):'—';
async function guardAdmin(){
 const {data:{user}}=await sb.auth.getUser();if(!user){location.replace('/login.html?next='+encodeURIComponent('/users.html'));return false}
 const {data:p,error}=await sb.from('profiles').select('role,is_banned').eq('id',user.id).maybeSingle();
 if(error||p?.role!=='admin'||p?.is_banned){location.replace('/dashboard.html');return false}
 document.getElementById('adminEmail').textContent=user.email||'';return true
}
async function load(){
 if(!await guardAdmin())return;const root=document.getElementById('list');root.innerHTML='<p>Memuat data member...</p>';
 const {data,error}=await sb.from('profiles').select('id,email,full_name,role,is_banned,vip_expires_at,premium_expires_at,created_at').order('created_at',{ascending:false});
 if(error){root.textContent=error.message;return}
 root.innerHTML='<div class="user-table-scroll"><table class="table user-table"><thead><tr><th>Member</th><th>Status</th><th>Paket & Masa Aktif</th><th>Kontrol</th></tr></thead><tbody>'+(data||[]).map(x=>{
  const now=new Date(),vip=x.vip_expires_at&&new Date(x.vip_expires_at)>now,premium=x.premium_expires_at&&new Date(x.premium_expires_at)>now,tier=premium?'premium':vip?'vip':'basic';
  return `<tr><td><b>${esc(x.full_name||'Member')}</b><small>${esc(x.email||'')}</small><small class="user-id">${esc(x.id)}</small></td><td><span class="user-status ${x.is_banned?'banned':'active'}">${x.is_banned?'Diblokir':'Aktif'}</span><small>${esc(x.role||'user')}</small></td><td><div class="membership-control"><select data-tier="${x.id}"><option value="basic" ${tier==='basic'?'selected':''}>Basic / Free</option><option value="vip" ${tier==='vip'?'selected':''}>VIP</option><option value="premium" ${tier==='premium'?'selected':''}>Premium</option></select><input type="number" min="1" max="3650" value="30" aria-label="Masa aktif hari" data-days="${x.id}"><span>hari</span><button class="btn primary" data-upgrade="${x.id}">Terapkan</button></div><small>VIP: ${date(x.vip_expires_at)} · Premium: ${date(x.premium_expires_at)}</small></td><td><div class="user-actions"><button class="btn" data-ban="${x.id}" data-state="${!!x.is_banned}">${x.is_banned?'Buka blokir':'Blokir'}</button>${x.role!=='admin'?`<button class="btn danger" data-delete="${x.id}">Hapus user</button>`:'<small>Admin dilindungi</small>'}</div></td></tr>`;
 }).join('')+'</tbody></table></div>';
 root.querySelectorAll('[data-ban]').forEach(b=>b.onclick=async()=>{const next=b.dataset.state!=='true';if(!confirm(`${next?'Blokir':'Buka blokir'} akun ini?`))return;const {error}=await sb.from('profiles').update({is_banned:next}).eq('id',b.dataset.ban);if(error)alert(error.message);else load()});
 root.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.upgrade,tier=root.querySelector(`[data-tier="${id}"]`).value,days=Number(root.querySelector(`[data-days="${id}"]`).value);
  if(tier!=='basic'&&(!Number.isInteger(days)||days<1||days>3650)){alert('Masa aktif harus 1–3650 hari.');return}
  if(!confirm(`Terapkan paket ${tier.toUpperCase()} untuk ${days} hari?`))return;
  const expiry=tier==='basic'?null:new Date(Date.now()+days*86400000).toISOString();
  const payload={vip_expires_at:tier==='basic'?null:expiry,premium_expires_at:tier==='premium'?expiry:null};
  const {error}=await sb.from('profiles').update(payload).eq('id',id);if(error)alert(error.message);else load();
 });
 root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{
  if(!confirm('Hapus akun ini secara permanen? Semua data yang terhubung dengan akun dapat ikut terhapus. Tindakan ini tidak dapat dibatalkan.'))return;
  b.disabled=true;b.textContent='Menghapus...';
  const {data,error}=await sb.functions.invoke('admin-user',{body:{action:'delete',user_id:b.dataset.delete}});
  if(error||!data?.success){alert(data?.error||error?.message||'Penghapusan gagal.');b.disabled=false;b.textContent='Hapus user';return}
  alert('Akun berhasil dihapus.');load();
 });
}
document.getElementById('logout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.replace('/login.html')});
load();