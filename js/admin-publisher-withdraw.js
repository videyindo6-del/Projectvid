(()=>{'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
async function load(){
 const {data:{user}}=await sb.auth.getUser();if(!user){location.replace('/login.html');return;}
 const {data:p}=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle();if(p?.role!=='admin'){location.replace('/dashboard');return;}
 const [common,affiliate,publisher]=await Promise.all([
  sb.from('withdrawal_requests').select('*').order('created_at',{ascending:false}).limit(300),
  sb.from('affiliate_withdrawals').select('*').order('created_at',{ascending:false}).limit(300),
  sb.from('publisher_withdrawals').select('*').order('created_at',{ascending:false}).limit(300)
 ]);
 const err=common.error||affiliate.error||publisher.error;if(err)throw err;
 const rows=[...(common.data||[]).map(x=>({...x,_source:'combined',_user:x.user_id,_holder:x.payout_account_holder,_number:x.payout_account_number})),...(affiliate.data||[]).map(x=>({...x,_source:'affiliate',_user:x.user_id,_holder:x.payout_account_holder||x.payout_full_name,_number:x.payout_account_number})),...(publisher.data||[]).map(x=>({...x,_source:'publisher',_user:x.publisher_id,_holder:x.account_holder,_number:x.account_number,fee_amount:0,net_amount:x.amount}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const ids=[...new Set(rows.map(x=>x._user))];const profiles=ids.length?await sb.from('profiles').select('id,full_name,email,username').in('id',ids):{data:[]};const names=new Map((profiles.data||[]).map(x=>[x.id,x]));
 $('alAdminWithdrawRows').innerHTML=rows.length?rows.map(w=>{const m=names.get(w._user)||{};return `<tr><td>${new Date(w.created_at).toLocaleString('id-ID')}</td><td><b>${esc(m.full_name||'Member')}</b><br>@${esc(m.username||'—')}<br><small>${esc(m.email||'')}</small></td><td>${money(w.amount)}<br><small>Fee ${money(w.fee_amount)} · Bersih ${money(w.net_amount)}</small>${w._source==='combined'?`<br><small>Afiliasi ${money(w.affiliate_reserved)} · AutoLink ${money(w.publisher_reserved)}</small>`:''}</td><td>${esc(w.payout_method||w.payout_method)} · ${esc(w.payout_provider||'—')}<br>${esc(w._holder)}<br>${esc(w._number)}</td><td><span class="al-pill">${esc(w.status)}</span><br><small>${esc(w._source)}</small></td><td>${esc(w.admin_note||'—')}</td><td><div class="wd-admin-actions"><button class="al-btn" data-action="processing" data-source="${w._source}" data-id="${w.id}">Proses</button><button class="al-btn" data-action="rejected" data-source="${w._source}" data-id="${w.id}">Reject</button><button class="al-btn" data-action="success" data-source="${w._source}" data-id="${w.id}">Sukses</button></div></td></tr>`}).join(''):'<tr><td colspan="7">Belum ada permintaan withdrawal.</td></tr>';
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=async()=>{
  const status=b.dataset.action,id=b.dataset.id,source=b.dataset.source;let note='';
  if(status==='rejected')note=prompt('Masukkan alasan penolakan (wajib):','Nomor rekening atau data penerima perlu diperbaiki.')||'';
  else if(status==='success')note=prompt('Masukkan keterangan pembayaran (wajib):','Saldo sudah dikirim ke rekening Anda.')||'';
  else note=prompt('Keterangan proses (opsional):','Permintaan sedang diproses admin.')||'';
  if((status==='rejected'||status==='success')&&!note.trim())return alert('Keterangan wajib diisi.');b.disabled=true;
  try{
   let rpc,args;
   if(source==='combined'){rpc='admin_update_withdrawal_v1';args={p_id:id,p_status:status,p_note:note};}
   else if(source==='affiliate'){rpc='admin_process_affiliate_withdrawal_v2';args={p_withdrawal_id:id,p_status:status,p_note:note};}
   else{rpc='admin_update_publisher_withdrawal';args={p_id:id,p_status:status,p_note:note};}
   const {data,error}=await sb.rpc(rpc,args);if(error)throw error;if(data?.ok===false)throw Error(data.reason||'Gagal memperbarui status.');
   // Pengumuman dan bukti pembayaran dibagikan manual oleh admin ke grup Telegram setelah pembayaran benar-benar selesai.
   alert('Status withdrawal diperbarui.');await load();
  }catch(e){alert(e.message||'Gagal menyimpan.');b.disabled=false;}
 });
}
load().catch(e=>$('alAdminWithdrawRows').innerHTML=`<tr><td colspan="7">${esc(e.message)}</td></tr>`);
})();
