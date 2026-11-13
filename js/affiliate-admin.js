(()=>{
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function guard(){const {data:{user}}=await sb.auth.getUser();if(!user){location.replace('/login.html');return false}const {data:p,error}=await sb.from('profiles').select('role').eq('id',user.id).single();if(error||p?.role!=='admin'){location.replace('/dashboard.html');return false}return true}
async function load(){
 if(!await guard())return;
 const [a,w]=await Promise.all([
  sb.from('affiliate_applications').select('*').order('created_at',{ascending:false}).limit(100),
  sb.from('affiliate_withdrawals').select('*').order('created_at',{ascending:false}).limit(100)
 ]);
 const apps=document.getElementById('applications'),outs=document.getElementById('withdrawals');
 apps.innerHTML=a.error?esc(a.error.message):`<table><thead><tr><th>Nama / User</th><th>Alamat</th><th>Rekening</th><th>Sosial</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${(a.data||[]).map(x=>`<tr><td><b>${esc(x.full_name)}</b><br><small>${esc(x.user_id)}</small></td><td>${esc(x.full_address)}</td><td>${esc(x.payout_method)}<br>${esc(x.payout_account_number)}</td><td>${esc(JSON.stringify(x.social_links||{}))}</td><td>${esc(x.status)}</td><td>${x.status==='pending'?`<button class="approve" data-app="${x.id}" data-status="approved">Setujui</button> <button class="reject" data-app="${x.id}" data-status="rejected">Tolak</button>`:'—'}</td></tr>`).join('')}</tbody></table>`;
 outs.innerHTML=w.error?esc(w.error.message):`<table><thead><tr><th>User</th><th>Nominal</th><th>Rekening</th><th>Status</th><th>Catatan / Aksi</th></tr></thead><tbody>${(w.data||[]).map(x=>`<tr><td>${esc(x.user_id)}</td><td>Rp ${Number(x.amount).toLocaleString('id-ID')}</td><td>${esc(x.payout_full_name)}<br>${esc(x.payout_method)} · ${esc(x.payout_account_number)}</td><td>${esc(x.status)}</td><td>${esc(x.admin_note||'')}${!['success','rejected'].includes(x.status)?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px"><button data-w="${x.id}" data-s="processing">Proses</button><button class="reject" data-w="${x.id}" data-s="rejected">Reject</button><button class="approve" data-w="${x.id}" data-s="success">Sukses</button></div>`:'—'}</td></tr>`).join('')}</tbody></table>`;
 apps.querySelectorAll('[data-app]').forEach(b=>b.onclick=async()=>{let note=null;if(b.dataset.status==='rejected'){note=prompt('Masukkan alasan penolakan:');if(note===null)return;if(!note.trim()){alert('Alasan penolakan wajib diisi.');return}}const {error}=await sb.rpc('admin_review_affiliate',{p_application_id:b.dataset.app,p_status:b.dataset.status,p_note:note});if(error)alert(error.message);else load()});
 outs.querySelectorAll('[data-w]').forEach(b=>b.onclick=async()=>{let note=null;if(b.dataset.s==='rejected'){note=prompt('Alasan reject withdraw:');if(note===null)return;if(!note.trim()){alert('Alasan reject wajib diisi.');return}}const {error}=await sb.rpc('admin_process_affiliate_withdrawal',{p_withdrawal_id:b.dataset.w,p_status:b.dataset.s,p_note:note});if(error)alert(error.message);else load()});
}
load();
})();