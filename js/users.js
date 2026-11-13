const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleString('id-ID'):'—';
async function guardAdmin(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){location.replace('/login.html?next='+encodeURIComponent('/users.html'));return false}
 const {data:p,error}=await sb.from('profiles').select('role,is_banned').eq('id',user.id).maybeSingle();
 if(error||p?.role!=='admin'||p?.is_banned){location.replace('/dashboard.html');return false}
 document.getElementById('adminEmail').textContent=user.email||'';return true;
}
async function load(){
 if(!await guardAdmin())return;
 const root=document.getElementById('list');root.innerHTML='<p>Memuat data member...</p>';
 const {data,error}=await sb.from('profiles').select('id,email,full_name,role,is_banned,vip_expires_at,created_at,last_seen_at,membership_tier,affiliate_status').eq('role','user').not('email','is',null).not('last_seen_at','is',null).order('last_seen_at',{ascending:false});
 if(error){root.textContent=error.message;return}
 const rows=data||[];
 root.innerHTML=`<div class="user-admin-total"><strong>${rows.length}</strong><span>Member yang sudah pernah login</span></div><div class="user-table-scroll"><table class="table user-table"><thead><tr><th>Username / Gmail</th><th>Status</th><th>Paket</th><th>Kontrol</th></tr></thead><tbody>${rows.map(x=>{
  const activeVip=x.vip_expires_at&&new Date(x.vip_expires_at)>new Date();
  const tier=x.affiliate_status==='approved'?'affiliate':(activeVip?'vip':'basic');
  return `<tr><td><b>${esc(x.full_name||'Member')}</b><small>${esc(x.email||'')}</small></td><td><span class="user-status ${x.is_banned?'banned':'active'}">${x.is_banned?'Diblokir':'Aktif'}</span><small>Login terakhir: ${date(x.last_seen_at)}</small></td><td><div class="membership-control"><select data-tier="${esc(x.id)}"><option value="basic" ${tier==='basic'?'selected':''}>Basic / Free</option><option value="vip" ${tier==='vip'?'selected':''}>VIP</option><option value="affiliate" ${tier==='affiliate'?'selected':''}>Published / Affiliate</option></select><input type="number" min="1" max="3650" value="30" aria-label="Masa aktif hari" data-days="${esc(x.id)}"><span>hari</span><button class="btn primary" data-upgrade="${esc(x.id)}">Terapkan</button></div><small>VIP sampai: ${date(x.vip_expires_at)} · Afiliasi: ${esc(x.affiliate_status||'none')}</small></td><td><div class="user-actions"><button class="btn" data-ban="${esc(x.id)}" data-state="${!!x.is_banned}">${x.is_banned?'Buka blokir':'Blokir'}</button><button class="btn danger" data-delete="${esc(x.id)}">Hapus user</button></div></td></tr>`;
 }).join('')}</tbody></table></div>`;
 root.querySelectorAll('[data-ban]').forEach(b=>b.onclick=async()=>{const next=b.dataset.state!=='true';if(!confirm(`${next?'Blokir':'Buka blokir'} akun ini?`))return;const {error}=await sb.from('profiles').update({is_banned:next}).eq('id',b.dataset.ban);if(error)alert(error.message);else load()});
 root.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.upgrade,tier=root.querySelector(`[data-tier="${id}"]`).value,days=Number(root.querySelector(`[data-days="${id}"]`).value),member=rows.find(x=>x.id===id);
  if(tier==='vip'&&(!Number.isInteger(days)||days<1||days>3650)){alert('Masa aktif VIP harus 1–3650 hari.');return}
  if(!confirm(`Terapkan status ${tier.toUpperCase()} untuk member ini?`))return;
  const expiry=tier==='vip'?new Date(Date.now()+days*86400000).toISOString():(tier==='basic'?null:member?.vip_expires_at||null);
  const payload={membership_tier:tier,affiliate_status:tier==='affiliate'?'approved':'none',vip_expires_at:expiry,premium_expires_at:null};
  const {error}=await sb.from('profiles').update(payload).eq('id',id);if(error)alert(error.message);else load();
 });
 root.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{
  if(!confirm('Hapus akun ini secara permanen? Tindakan ini tidak dapat dibatalkan.'))return;
  b.disabled=true;b.textContent='Menghapus...';
  const {data,error}=await sb.functions.invoke('admin-user',{body:{action:'delete',user_id:b.dataset.delete}});
  if(error||!data?.success){alert(data?.error||error?.message||'Penghapusan gagal.');b.disabled=false;b.textContent='Hapus user';return}
  alert('Akun berhasil dihapus.');load();
 });
}
document.getElementById('logout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.replace('/login.html')});
load();
