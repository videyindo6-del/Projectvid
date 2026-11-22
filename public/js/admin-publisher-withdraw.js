(()=>{'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
const statusText={pending:'Antrian',queued:'Antrian',processing:'Proses',revision:'Perlu revisi',rejected:'Tolak',success:'Sukses',completed:'Sukses',failed:'Tolak'};
let loading=false;
async function load(){
 if(loading)return;loading=true;
 try{
  const {data:{user},error:authError}=await sb.auth.getUser();if(authError)throw authError;if(!user){location.replace('/login.html');return;}
  const {data:p,error:profileError}=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle();if(profileError)throw profileError;if(p?.role!=='admin'){location.replace('/dashboard');return;}
  const [common,affiliate,publisher]=await Promise.all([
   sb.from('withdrawal_requests').select('*').order('created_at',{ascending:false}).limit(300),
   sb.from('affiliate_withdrawals').select('*').order('created_at',{ascending:false}).limit(300),
   sb.from('publisher_withdrawals').select('*').order('created_at',{ascending:false}).limit(300)
  ]);
  const err=common.error||affiliate.error||publisher.error;if(err)throw err;
  const rows=[...(common.data||[]).map(x=>({...x,_source:'combined',_user:x.user_id,_holder:x.payout_account_holder,_number:x.payout_account_number})),...(affiliate.data||[]).map(x=>({...x,_source:'affiliate',_user:x.user_id,_holder:x.payout_account_holder||x.payout_full_name,_number:x.payout_account_number})),...(publisher.data||[]).map(x=>({...x,_source:'publisher',_user:x.publisher_id,_holder:x.account_holder,_number:x.account_number,fee_amount:0,net_amount:x.amount}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const ids=[...new Set(rows.map(x=>x._user).filter(Boolean))];const profiles=ids.length?await sb.from('profiles').select('id,full_name,email,username').in('id',ids):{data:[],error:null};if(profiles.error)throw profiles.error;const names=new Map((profiles.data||[]).map(x=>[x.id,x]));
  const pending=rows.filter(w=>['pending','queued','processing'].includes(String(w.status||'').toLowerCase())).length;
  const target=$('alAdminWithdrawRows');if(!target)throw Error('Elemen daftar withdrawal tidak ditemukan.');
  target.innerHTML=rows.length?rows.map(w=>{const m=names.get(w._user)||{},method=String(w.payout_method||'').toLowerCase()==='ewallet'?'E-Wallet':'Bank',status=String(w.status||'pending').toLowerCase();return `<tr><td>${new Date(w.created_at).toLocaleString('id-ID')}</td><td><b>${esc(m.full_name||'Member')}</b><br><strong>@${esc(m.username||'—')}</strong><br><small>${esc(m.email||'')}</small></td><td><b>${money(w.amount)}</b><br><small>Fee ${money(w.fee_amount)} · Bersih ${money(w.net_amount)}</small>${w._source==='combined'?`<br><small>Afiliasi ${money(w.affiliate_reserved)} · AutoLink ${money(w.publisher_reserved)}</small>`:''}</td><td><b>${method} · ${esc(w.payout_provider||'—')}</b><br>${esc(w._holder||'—')}<br><code>${esc(w._number||'—')}</code></td><td><span class="al-pill">${esc(statusText[status]||status)}</span><br><small>${esc(w._source)}</small></td><td>${esc(w.admin_note||'—')}</td><td><div class="wd-admin-actions">${!['success','rejected','completed','failed'].includes(status)?`<button class="al-btn" data-wd-action="processing" data-source="${w._source}" data-id="${w.id}"><i class="fa-solid fa-gears"></i> Proses</button><button class="al-btn" data-wd-action="rejected" data-source="${w._source}" data-id="${w.id}"><i class="fa-solid fa-xmark"></i> Tolak</button><button class="al-btn" data-wd-action="success" data-source="${w._source}" data-id="${w.id}"><i class="fa-solid fa-check"></i> Sukses</button>`:'<small>Sudah selesai</small>'}</div></td></tr>`}).join(''):'<tr><td colspan="7">Belum ada permintaan withdrawal.</td></tr>';
  const count=$('wdAdminPendingCount');if(count)count.textContent=String(pending);
  const stamp=$('wdAdminLastUpdated');if(stamp)stamp.textContent='Diperbarui '+new Date().toLocaleTimeString('id-ID');
 }finally{loading=false;}
}
async function process(button){
 const status=button.dataset.wdAction,id=button.dataset.id,source=button.dataset.source;
 const label=status==='processing'?'memproses':status==='rejected'?'menolak':'menandai sukses';
 if(!confirm(`Yakin ingin ${label} pengajuan withdrawal ini?`))return;
 const promptLabel=status==='rejected'?'Masukkan alasan penolakan (boleh dikosongkan):':status==='success'?'Masukkan keterangan pembayaran (boleh dikosongkan):':'Masukkan keterangan proses (boleh dikosongkan):';
 const note=prompt(promptLabel,'');if(note===null)return;
 button.disabled=true;
 try{
  let rpc,args;
  if(source==='combined'){rpc='admin_update_withdrawal_v1';args={p_id:id,p_status:status,p_note:note.trim()||null};}
  else if(source==='affiliate'){rpc='admin_process_affiliate_withdrawal_v2';args={p_withdrawal_id:id,p_status:status,p_note:note.trim()||null};}
  else{rpc='admin_update_publisher_withdrawal';args={p_id:id,p_status:status,p_note:note.trim()||null};}
  const {data,error}=await sb.rpc(rpc,args);if(error)throw error;if(data?.ok===false)throw Error(data.reason||'Gagal memperbarui status.');
  alert('Status withdrawal berhasil diperbarui.');await load();
 }catch(e){alert(e.message||'Gagal menyimpan status withdrawal.');button.disabled=false;}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-wd-action]');if(b)process(b);});
$('wdAdminRefresh')?.addEventListener('click',()=>load().catch(e=>alert(e.message)));
load().catch(e=>{const target=$('alAdminWithdrawRows');if(target)target.innerHTML=`<tr><td colspan="7">${esc(e.message)}</td></tr>`;}).finally(()=>{setInterval(()=>load().catch(console.error),45000);});
})();