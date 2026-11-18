const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleString('id-ID'):'Belum pernah login';
const isOnline=v=>!!v && (Date.now()-new Date(v).getTime())<=120000;
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
 const [{data,error,count},{data:stats,error:statsError}]=await Promise.all([
   sb.from('profiles').select('id,email,full_name,username,game_id,role,is_banned,vip_expires_at,created_at,last_seen_at,membership_tier,affiliate_status',{count:'exact'}).eq('role','user').order('last_seen_at',{ascending:false,nullsFirst:false}),
   sb.rpc('get_admin_presence_stats')
 ]);
 if(error){root.textContent=error.message;return}
 const rows=data||[];
 const balanceResult=await sb.from('publisher_balances').select('publisher_id,available_balance,pending_withdrawal,withdrawn_total');
 const publisherBalances=new Map((balanceResult.data||[]).map(x=>[x.publisher_id,x]));
 const onlineMembers=Number(stats?.online_members ?? rows.filter(x=>!x.is_banned&&isOnline(x.last_seen_at)).length);
 const guestOnline=Number(stats?.guest_online ?? 0);
 const registered=Number(stats?.registered_members ?? count ?? rows.length);
 const statsWarning=statsError?'<div class="presence-warning">Statistik pengunjung belum aktif. Jalankan <b>supabase/member_presence_v1.sql</b> di Supabase SQL Editor.</div>':'';
 root.innerHTML=`<section class="presence-stats" aria-label="Statistik kehadiran">
   <article class="presence-card"><span><i class="fa-solid fa-users"></i> Akun terdaftar</span><strong>${registered}</strong><small>Total akun member terdaftar</small></article>
   <article class="presence-card is-online"><span><i class="fa-solid fa-user-check"></i> Member online</span><strong>${onlineMembers}</strong><small>Member login aktif · 2 menit terakhir</small></article>
   <article class="presence-card is-guest"><span><i class="fa-solid fa-user-clock"></i> Pengunjung online</span><strong>${guestOnline}</strong><small>Belum login / tamu</small></article>
 </section>${statsWarning}
 <div class="presence-caption"><span class="presence-live-dot"></span> Status diperbarui otomatis saat pengunjung membuka halaman. Batas online: aktivitas 2 menit terakhir.</div>
 <div class="user-admin-total"><strong>${rows.length}</strong><span>Daftar seluruh akun member terdaftar</span></div>
 <div class="user-table-scroll"><table class="table user-table"><thead><tr><th>Username / Gmail</th><th>Status</th><th>Terakhir dilihat</th><th>Paket</th><th>Kontrol</th></tr></thead><tbody>${rows.map(x=>{
  const activeVip=x.vip_expires_at&&new Date(x.vip_expires_at)>new Date();
  const tier=x.affiliate_status==='approved'?'affiliate':(activeVip?'vip':(x.membership_tier||'basic'));
  const online=isOnline(x.last_seen_at);
  return `<tr><td><b>${esc(x.full_name||x.username||'Member')}</b><small>@${esc(x.username||'belum ada username')} · ${esc(x.email||'')}</small><small>Game ID: ${esc(x.game_id||'Belum diatur')}</small><div class="membership-control"><input type="text" maxlength="80" placeholder="Atur Game ID" value="${esc(x.game_id||'')}" data-gameid="${esc(x.id)}"><button class="btn" data-save-gameid="${esc(x.id)}">Simpan ID</button></div><small>Daftar: ${date(x.created_at)}</small></td><td><span class="user-status ${x.is_banned?'banned':'active'}">${x.is_banned?'Diblokir':'Aktif'}</span><small class="presence-member-state ${online&&!x.is_banned?'online':''}">${online&&!x.is_banned?'● Online':'○ Offline'}</small></td><td>${esc(date(x.last_seen_at))}</td><td><div class="membership-control"><select data-tier="${esc(x.id)}"><option value="basic" ${tier==='basic'?'selected':''}>Basic / Free</option><option value="vip" ${tier==='vip'?'selected':''}>VIP</option><option value="affiliate" ${tier==='affiliate'?'selected':''}>Publisher / Afiliasi</option></select><input type="number" min="1" max="3650" value="30" aria-label="Masa aktif hari" data-days="${esc(x.id)}"><span>hari</span><button class="btn primary" data-upgrade="${esc(x.id)}">Terapkan</button></div><small>VIP sampai: ${date(x.vip_expires_at)} · Afiliasi: ${esc(x.affiliate_status||'none')}</small><small>Saldo publisher: Rp ${Number(publisherBalances.get(x.id)?.available_balance||0).toLocaleString('id-ID')} · Pending: Rp ${Number(publisherBalances.get(x.id)?.pending_withdrawal||0).toLocaleString('id-ID')}</small></td><td><div class="user-actions"><button class="btn" data-ban="${esc(x.id)}" data-state="${!!x.is_banned}">${x.is_banned?'Buka blokir':'Blokir'}</button><button class="btn danger" data-delete="${esc(x.id)}">Hapus user</button></div></td></tr>`;
 }).join('')||'<tr><td colspan="5">Belum ada akun member terdaftar.</td></tr>'}</tbody></table></div>`;
 root.querySelectorAll('[data-save-gameid]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveGameid,value=root.querySelector(`[data-gameid="${id}"]`).value.trim();if(value.length>80){alert('Game ID maksimal 80 karakter.');return;}b.disabled=true;const {error}=await sb.from('profiles').update({game_id:value||null}).eq('id',id);b.disabled=false;if(error)alert(error.message);else{alert('Game ID diperbarui.');load();}});
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
// Perbarui angka online berkala saat halaman admin tetap terbuka.
setInterval(()=>{if(document.visibilityState==='visible')load()},60000);
