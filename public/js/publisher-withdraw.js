(()=>{'use strict';
const $=id=>document.getElementById(id),money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
const msg=(s,e=false)=>{$('alWithdrawMessage').innerHTML=`<div class="al-alert ${e?'error':''}" role="status">${String(s??'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</div>`;};
async function load(){
 if(!window.sb?.auth)throw Error('Supabase belum siap. Muat ulang halaman.');
 const {data:{user},error:userError}=await sb.auth.getUser();if(userError)throw userError;
 if(!user){location.replace('/login.html?next=%2Fwithdraw.html');return;}
 const [bal,rows]=await Promise.all([
  sb.from('publisher_balances').select('available_balance,pending_withdrawal,withdrawn_total').eq('publisher_id',user.id).maybeSingle(),
  sb.from('publisher_withdrawals').select('id,amount,payout_provider,account_number,status,admin_note,created_at').eq('publisher_id',user.id).order('created_at',{ascending:false})
 ]);
 if(bal.error||rows.error)throw (bal.error||rows.error);
 const b=bal.data||{};
 $('alWithdrawStats').innerHTML=[['Total saldo publisher',Number(b.available_balance||0)+Number(b.pending_withdrawal||0)+Number(b.withdrawn_total||0)],['Saldo tersedia',b.available_balance],['Dalam proses',b.pending_withdrawal],['Sudah ditarik',b.withdrawn_total]].map(x=>`<div class="al-stat"><small>${x[0]}</small><strong>${money(x[1])}</strong></div>`).join('');
 $('alWithdrawAmount').max=b.available_balance||0;
 $('alWithdrawRows').innerHTML=(rows.data||[]).length?rows.data.map(w=>`<tr><td>${new Date(w.created_at).toLocaleString('id-ID')}</td><td>${money(w.amount)}</td><td>${String(w.payout_provider||'').replace(/[<>&]/g,'')} · ${String(w.account_number||'').replace(/[<>&]/g,'')}</td><td><span class="al-pill">${String(w.status||'').replace(/[<>&]/g,'')}</span></td><td>${String(w.admin_note||'—').replace(/[<>&]/g,'')}</td></tr>`).join(''):'<tr><td colspan="5">Belum ada riwayat withdraw.</td></tr>';
}
$('alWithdrawForm')?.addEventListener('submit',async e=>{e.preventDefault();const b=$('alWithdrawSubmit');b.disabled=true;try{
 const {data,error}=await sb.rpc('request_publisher_withdrawal',{p_amount:Number($('alWithdrawAmount').value),p_method:$('alWithdrawMethod').value,p_provider:$('alWithdrawProvider').value,p_holder:$('alWithdrawHolder').value,p_account:$('alWithdrawAccount').value});
 if(error)throw error;if(!data?.ok)throw Error(data?.reason||'Permintaan gagal');
 msg('Permintaan withdraw berhasil diajukan.');$('alWithdrawForm').reset();await load();
 }catch(x){msg(x.message||'Terjadi kesalahan',true);}finally{b.disabled=false;}});
load().catch(e=>{console.error('Publisher withdraw load failed:',e);msg(e.message||'Gagal memuat saldo dan riwayat withdraw.',true);});
})();
