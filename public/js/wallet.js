(()=>{
'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
let user=null,profile=null;
async function load(){
 const a=await sb.auth.getUser();user=a.data?.user;if(!user){location.replace('/login.html?next=%2Fwallet.html');return}
 const {data,error}=await sb.from('profiles').select('full_name,email,referral_code,affiliate_status,deposit_balance,affiliate_balance,payout_full_name,payout_address,payout_method,payout_account_number,payout_social').eq('id',user.id).single();
 if(error){alert('Gagal memuat saldo: '+error.message);return}profile=data;
 $('depositBalance').textContent=money(data.deposit_balance);$('affiliateBalance').textContent=money(data.affiliate_balance);
 $('affiliateState').textContent='Status afiliasi: '+(data.affiliate_status||'none');
 $('withdrawForm').hidden=data.affiliate_status!=='approved';$('transferForm').hidden=data.affiliate_status!=='approved';
 if(data.affiliate_status==='approved'){
  $('affiliateForm').hidden=true;
  if(data.referral_code){$('affiliateLinkBox').hidden=false;$('affiliateLink').value=location.origin+'/index.html?ref='+encodeURIComponent(data.referral_code)}
 }else if(data.affiliate_status==='pending'){$('affiliateForm').hidden=true;$('affiliateMessage').textContent='Pengajuan sedang menunggu persetujuan admin.'}
 const pf=$('payoutForm');['payout_full_name','payout_address','payout_method','payout_account_number'].forEach(k=>{if(pf.elements[k])pf.elements[k].value=data[k]||''});
 const {data:withdrawals,error:we}=await sb.from('affiliate_withdrawals').select('amount,status,admin_note,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30);
 $('withdrawHistory').innerHTML=we?esc(we.message):((withdrawals||[]).map(x=>`<div class="wallet-row"><span><b>${esc(x.status.toUpperCase())}</b><br><small>${new Date(x.created_at).toLocaleString('id-ID')} · ${esc(x.admin_note||'')}</small></span><strong>${money(x.amount)}</strong></div>`).join('')||'<p class="wallet-muted">Belum ada permintaan withdraw.</p>');
 const {data:ledger,error:le}=await sb.from('wallet_ledger').select('wallet_type,amount,entry_type,description,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
 $('walletHistory').innerHTML=le?esc(le.message):((ledger||[]).map(x=>`<div class="wallet-row"><span><b>${esc(x.description||x.entry_type)}</b><br><small>${esc(x.wallet_type)} · ${new Date(x.created_at).toLocaleString('id-ID')}</small></span><strong class="${x.amount>=0?'wallet-positive':'wallet-negative'}">${x.amount>=0?'+':'−'}${money(Math.abs(x.amount))}</strong></div>`).join('')||'<p class="wallet-muted">Belum ada transaksi saldo.</p>');
}
$('topupForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const amount=Number(e.target.amount.value);if(!Number.isSafeInteger(amount)||amount<10000)throw new Error('Minimal deposit Rp10.000.');const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'wallet_topup',amount}});if(error||!data?.checkout_url)throw new Error(data?.error||error?.message||'Gagal membuat pembayaran.');location.href=data.checkout_url}catch(x){alert(x.message)}finally{b.disabled=false}};
$('affiliateForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),b=e.submitter;b.disabled=true;try{const social={telegram:f.get('telegram'),youtube:f.get('youtube'),facebook:f.get('facebook')};const {data,error}=await sb.rpc('apply_for_affiliate',{p_full_name:f.get('full_name'),p_address:f.get('address'),p_payout_method:f.get('payout_method'),p_payout_account_number:f.get('payout_account_number'),p_social:social});if(error)throw error;if(!data?.ok)throw new Error(data?.reason||'Pengajuan gagal');$('affiliateMessage').textContent='Pengajuan berhasil dikirim. Tunggu persetujuan admin.';e.target.reset();await load()}catch(x){$('affiliateMessage').textContent=x.message||'Gagal mengajukan afiliasi.'}finally{b.disabled=false}};
$('payoutForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),payload={payout_full_name:f.get('payout_full_name'),payout_address:f.get('payout_address'),payout_method:f.get('payout_method'),payout_account_number:f.get('payout_account_number')};const {error}=await sb.from('profiles').update(payload).eq('id',user.id);$('payoutMessage').textContent=error?'Gagal menyimpan: '+error.message:'Rekening berhasil diperbarui.';if(!error)await load()};
$('withdrawForm').onsubmit=async e=>{e.preventDefault();const amount=Number(e.target.amount.value),b=e.submitter;b.disabled=true;try{const {data,error}=await sb.rpc('request_affiliate_withdrawal',{p_amount:amount});if(error)throw error;if(!data?.ok)throw new Error(data?.reason||'Withdraw gagal');alert('Permintaan withdraw berhasil dikirim.');e.target.reset();await load()}catch(x){alert(x.message)}finally{b.disabled=false}};
$('copyAffiliateLink').onclick=async()=>{try{await navigator.clipboard.writeText($('affiliateLink').value);alert('Link berhasil disalin.')}catch{prompt('Salin link ini',$('affiliateLink').value)}};
load();
})();
$('transferForm').onsubmit=async e=>{e.preventDefault();const amount=Number(e.target.amount.value),b=e.submitter;b.disabled=true;try{const {data,error}=await sb.rpc('transfer_affiliate_to_deposit',{p_amount:amount});if(error)throw error;if(!data?.ok)throw new Error(data?.reason||'Pemindahan saldo gagal');alert('Saldo berhasil dipindahkan ke deposit.');e.target.reset();await load()}catch(x){alert(x.message)}finally{b.disabled=false}};
