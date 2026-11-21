(()=>{'use strict';
const $=id=>document.getElementById(id);
const money=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>localStorage.getItem('boxcellink_lang')==='en'?'en':'id';
const t=(id,en)=>lang()==='en'?en:id;
const BANKS=['BCA','Bank Mandiri','BRI','BNI','BSI','Bank CIMB Niaga','BTN','Bank Danamon','PermataBank','Bank OCBC NISP','Bank Mega','Bank Jago','SeaBank','Bank Neo Commerce','Bank BTPN / Jenius','Bank Muamalat','Bank BJB','Bank Jatim','Bank DKI','Bank Sumut','Bank Nagari','Bankaltimtara','Bank Sulselbar','Bank Papua','Lainnya'];
const EWALLETS=['DANA','OVO','GoPay','ShopeePay','LinkAja','AstraPay','i.Saku','Sakuku','Lainnya'];
const AFFILIATE_FEE=7000;
let user=null,profile=null,publisher=null;

function applyLanguage(){
 document.documentElement.lang=lang();
 document.querySelectorAll('[data-wallet-id][data-wallet-en]').forEach(el=>{
  const value=el.getAttribute(lang()==='en'?'data-wallet-en':'data-wallet-id');
  if(value!==null)el.textContent=value;
 });
 const placeholders={
  'Contoh: 100000':'Example: 100000','08xxxxxxxxxx':'08xxxxxxxxxx',
  '@username atau URL':'@username or URL','URL channel':'Channel URL','URL profil':'Profile URL',
  'Masukkan nama penyedia':'Enter provider name','Contoh: BCA / DANA':'Example: BCA / DANA','08xxxxxxxxxx':'08xxxxxxxxxx'
 };
 if(lang()==='en')document.querySelectorAll('input[placeholder]').forEach(el=>{if(placeholders[el.placeholder])el.placeholder=placeholders[el.placeholder]});
}
function setProviders(method,selectId,wrapId,customWrapId,customId){
 const select=$(selectId);if(!select)return;
 const previous=select.value;const list=method==='bank'?BANKS:EWALLETS;
 select.innerHTML=`<option value="">${t('Pilih bank','Select bank/e-wallet')}</option>`+list.map(x=>`<option value="${esc(x)}">${esc(x==='Lainnya'&&lang()==='en'?'Other':x)}</option>`).join('');
 if(previous&&list.includes(previous))select.value=previous;
 if(wrapId&&$(wrapId))$(wrapId).hidden=false;
 const custom=select.value==='Lainnya';
 if(customWrapId&&$(customWrapId))$(customWrapId).hidden=!custom;
 if(customId&&$(customId))$(customId).required=custom;
 select.onchange=()=>{
  const isCustom=select.value==='Lainnya';
  if(customWrapId&&$(customWrapId))$(customWrapId).hidden=!isCustom;
  if(customId&&$(customId))$(customId).required=isCustom;
 };
}
function bindProviders(){
 const app=$('applicationMethod');if(app){const run=()=>setProviders(app.value,'applicationProvider','applicationProviderWrap','applicationCustomWrap','applicationCustom');app.addEventListener('change',run);run();}
 const payout=$('payoutMethod');if(payout){const run=()=>setProviders(payout.value,'payoutProvider','payoutProviderWrap','payoutCustomWrap','payoutCustom');payout.addEventListener('change',run);run();}
}
function setMessage(id,message,isError=false){const el=$(id);if(!el)return;el.textContent=message;el.classList.toggle('is-error',!!isError);el.classList.toggle('is-success',!isError&&!!message);}
function renderStatus(status){
 const s=String(status||'pending').toLowerCase();
 const labels={pending:t('Menunggu','Pending'),processing:t('Diproses','Processing'),revision:t('Perlu perbaikan','Needs revision'),success:t('Sukses','Successful'),rejected:t('Ditolak','Rejected')};
 return `<span class="wallet-status ${esc(s)}">${esc(labels[s]||s)}</span>`;
}
function emptyText(text){return `<p class="wallet-hint">${esc(text)}</p>`;}
function updateAffiliateWithdrawPreview(){
 const amount=Math.max(0,Number($('withdrawAmount')?.value||0));
 const fee=amount?Math.min(AFFILIATE_FEE,amount):0;
 $('withdrawGross').textContent=money(amount);$('withdrawFee').textContent=money(fee);$('withdrawNet').textContent=money(Math.max(0,amount-fee));
}
function setPanelVisibility(){
 document.querySelectorAll('.wallet-open-withdraw').forEach(button=>button.addEventListener('click',()=>{
  const target=$(button.dataset.target);if(!target)return;
  target.classList.toggle('wallet-hidden');target.scrollIntoView({behavior:'smooth',block:'start'});
 }));
}
function renderWalletHistory(ledger,publisherLedger){
 const rows=[...(ledger||[]).map(x=>({...x,source:'wallet'})),...(publisherLedger||[]).map(x=>({...x,wallet_type:'autolink',entry_type:x.transaction_type,source:'publisher'}))]
  .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,80);
 if(!rows.length){$('walletHistory').innerHTML=emptyText(t('Belum ada transaksi saldo.','No balance transactions yet.'));return;}
 const walletNames={deposit:t('Deposit','Deposit'),referral:t('Referral','Referral'),affiliate:t('Afiliasi','Affiliate'),autolink:'AutoLink'};
 $('walletHistory').innerHTML=rows.map(x=>{
  const amount=Number(x.amount||0),date=new Date(x.created_at).toLocaleString(lang()==='en'?'en-US':'id-ID');
  return `<div class="wallet-row"><div class="wallet-row-main"><strong>${esc(x.description||x.entry_type||'Transaksi')}</strong><div class="wallet-row-meta">${esc(walletNames[x.wallet_type]||x.wallet_type)} · ${esc(date)}</div></div><b class="${amount>=0?'wallet-positive':'wallet-negative'}">${amount>=0?'+':'−'}${money(Math.abs(amount))}</b></div>`;
 }).join('');
}
function renderWithdrawHistory(affiliateRows,publisherRows){
 const affiliate=(affiliateRows||[]);
 const publisher=(publisherRows||[]);
 $('withdrawHistory').innerHTML=affiliate.length?affiliate.map(x=>{
  const date=new Date(x.created_at).toLocaleString(lang()==='en'?'en-US':'id-ID');
  return `<div class="wallet-row"><div class="wallet-row-main"><strong>${money(x.amount)}</strong><div class="wallet-row-meta">${esc(date)} · ${esc(x.payout_provider||x.payout_method||'')} · ${esc(x.payout_account_number||'')}<br>${t('Biaya','Fee')} ${money(x.fee_amount)} · ${t('Diterima','Net')} ${money(x.net_amount)}${x.admin_note?' · '+esc(x.admin_note):''}<br>ID: ${esc(x.id)}</div></div>${renderStatus(x.status)}</div>`;
 }).join(''):emptyText(t('Belum ada withdraw afiliasi.','No affiliate withdrawals yet.'));
 $('publisherWithdrawHistory').innerHTML=publisher.length?publisher.map(x=>{
  const date=new Date(x.created_at).toLocaleString(lang()==='en'?'en-US':'id-ID');
  return `<div class="wallet-row"><div class="wallet-row-main"><strong>${money(x.amount)}</strong><div class="wallet-row-meta">${esc(date)} · ${esc(x.payout_provider||x.payout_method||'')} · ${esc(x.account_number||'')}<br>${x.admin_note?esc(x.admin_note):''}<br>ID: ${esc(x.id)}</div></div>${renderStatus(x.status)}</div>`;
 }).join(''):emptyText(t('Belum ada withdraw AutoLink.','No AutoLink withdrawals yet.'));
 const total=affiliate.filter(x=>x.status==='success').reduce((s,x)=>s+Number(x.amount||0),0)+publisher.filter(x=>x.status==='success').reduce((s,x)=>s+Number(x.amount||0),0);
 $('totalWithdrawn').textContent=money(total);
}
async function load(){
 const {data:{user:u},error:authError}=await sb.auth.getUser();if(authError)throw authError;user=u;
 if(!user){location.replace('/login.html?next=%2Fwallet.html');return;}
 const {data,error}=await sb.from('profiles').select('full_name,email,referral_code,affiliate_status,deposit_balance,referral_balance,affiliate_balance,payout_full_name,payout_address,payout_method,payout_account_number,payout_provider,payout_account_holder,payout_village,payout_district,payout_regency,payout_province').eq('id',user.id).single();
 if(error)throw new Error(t('Gagal membaca profil wallet. Pastikan migration wallet_source_separation_v1.sql sudah dijalankan. ','Could not load wallet profile. Make sure wallet_source_separation_v1.sql has been applied. ')+error.message);
 profile=data;
 $('depositBalance').textContent=money(data.deposit_balance);$('referralBalance').textContent=money(data.referral_balance);$('affiliateBalance').textContent=money(data.affiliate_balance);
 const status=data.affiliate_status||'none';
 $('affiliateState').textContent=t('Status affiliate: ','Affiliate status: ')+(status==='approved'?t('Disetujui','Approved'):status==='pending'?t('Menunggu persetujuan','Pending approval'):status==='rejected'?t('Ditolak','Rejected'):t('Belum terdaftar','Not enrolled'));

 const pubResult=await sb.from('publisher_balances').select('available_balance,pending_withdrawal,withdrawn_total,free_earned_total,direct_access_earned_total').eq('publisher_id',user.id).maybeSingle();
 if(pubResult.error){console.warn('publisher_balances:',pubResult.error);publisher={available_balance:0,pending_withdrawal:0,withdrawn_total:0};}
 else publisher=pubResult.data||{available_balance:0,pending_withdrawal:0,withdrawn_total:0};
 $('publisherBalance').textContent=money(Number(publisher.available_balance||0)+Number(publisher.pending_withdrawal||0));
 $('publisherAvailable').textContent=money(publisher.available_balance);$('publisherPending').textContent=money(publisher.pending_withdrawal);
 $('publisherWithdrawAmount').max=Number(publisher.available_balance||0);

 const approved=status==='approved';
 $('payoutSettingsCard').classList.toggle('wallet-hidden',!approved);
 $('withdrawForm').hidden=!approved;
 $('affiliateWithdrawUnavailable').hidden=approved;
 $('affiliateWithdrawPanel').classList.add('wallet-hidden');
 $('withdrawAmount').max=Number(data.affiliate_balance||0);updateAffiliateWithdrawPreview();
 if(status==='pending'){
  $('affiliateForm').hidden=true;setMessage('affiliateMessage',t('Pengajuan affiliate sedang menunggu pemeriksaan admin.','Your affiliate application is awaiting admin review.'));
 }else if(approved){$('affiliateForm').hidden=true;}
 else{$('affiliateForm').hidden=false;}
 if(data.referral_code&&approved){$('affiliateLinkBox').hidden=false;$('affiliateLink').value=location.origin+'/index.html?ref='+encodeURIComponent(data.referral_code);}
 if(approved){
  $('payoutMethod').value=data.payout_method||'bank';$('payoutMethod').dispatchEvent(new Event('change'));
  const provider=data.payout_provider||'';const select=$('payoutProvider');
  if([...select.options].some(o=>o.value===provider))select.value=provider;
  else if(provider){select.value='Lainnya';$('payoutCustomWrap').hidden=false;$('payoutCustom').required=true;$('payoutCustom').value=provider;}
  $('payoutAccountNumber').value=data.payout_account_number||'';$('payoutAccountHolder').value=data.payout_account_holder||'';
 }
 $('publisherWithdrawPanel').classList.add('wallet-hidden');
 if(data.payout_method)$('publisherPayoutMethod').value=data.payout_method;
 if(data.payout_provider)$('publisherWithdrawForm').elements.provider.value=data.payout_provider;
 if(data.payout_account_holder)$('publisherWithdrawForm').elements.holder.value=data.payout_account_holder;
 if(data.payout_account_number)$('publisherWithdrawForm').elements.account.value=data.payout_account_number;

 const [affiliateWithdrawals,publisherWithdrawals,ledger,publisherLedger]=await Promise.all([
  sb.from('affiliate_withdrawals').select('id,amount,fee_amount,net_amount,payout_method,payout_provider,payout_account_number,payout_full_name,status,admin_note,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50),
  sb.from('publisher_withdrawals').select('id,amount,payout_method,payout_provider,account_holder,account_number,status,admin_note,created_at').eq('publisher_id',user.id).order('created_at',{ascending:false}).limit(50),
  sb.from('wallet_ledger').select('wallet_type,amount,entry_type,description,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(60),
  sb.from('publisher_transactions').select('amount,transaction_type,description,created_at').eq('publisher_id',user.id).order('created_at',{ascending:false}).limit(60)
 ]);
 renderWithdrawHistory(affiliateWithdrawals.error?[]:affiliateWithdrawals.data,publisherWithdrawals.error?[]:publisherWithdrawals.data);
 renderWalletHistory(ledger.error?[]:ledger.data,publisherLedger.error?[]:publisherLedger.data);
 if(affiliateWithdrawals.error)console.warn('affiliate withdrawals:',affiliateWithdrawals.error);
 if(publisherWithdrawals.error)console.warn('publisher withdrawals:',publisherWithdrawals.error);
 if(ledger.error)console.warn('wallet ledger:',ledger.error);
 if(publisherLedger.error)console.warn('publisher transactions:',publisherLedger.error);
 applyLanguage();
}

$('withdrawAmount').addEventListener('input',updateAffiliateWithdrawPreview);
$('withdrawAll').addEventListener('click',()=>{$('withdrawAmount').value=String(Number(profile?.affiliate_balance||0));updateAffiliateWithdrawPreview();});
$('publisherWithdrawAll').addEventListener('click',()=>{$('publisherWithdrawAmount').value=String(Number(publisher?.available_balance||0));});
$('topupForm').addEventListener('submit',async e=>{
 e.preventDefault();const button=e.submitter;button.disabled=true;
 try{const amount=Number(e.target.amount.value);if(!Number.isSafeInteger(amount)||amount<10000||amount>10000000)throw new Error(t('Nominal top up minimal Rp10.000 dan maksimal Rp10.000.000.','Top-up must be between Rp10,000 and Rp10,000,000.'));
  const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'wallet_topup',amount}});if(error)throw error;if(!data?.success||!data?.order_id)throw new Error(data?.error||t('Gagal membuat transaksi.','Could not create payment.'));
  sessionStorage.setItem('boxcellink_topup_'+data.order_id,JSON.stringify({order_id:data.order_id,amount:data.amount,qr_url:data.qrUrl||null,checkout_url:data.checkout_url,expires_at:data.expires_at||null}));location.href='/topup-checkout.html?order_id='+encodeURIComponent(data.order_id);
 }catch(error){alert(error.message||t('Terjadi kesalahan.','Something went wrong.'));}finally{button.disabled=false;}
});
$('affiliateForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=new FormData(e.target),button=e.submitter;button.disabled=true;setMessage('affiliateMessage',t('Mengirim pengajuan...','Submitting application...'));
 try{const provider=form.get('provider'),custom=String(form.get('custom_provider')||'').trim();const payload={p_full_name:form.get('full_name'),p_phone:form.get('phone')||null,p_village:form.get('village'),p_district:form.get('district'),p_regency:form.get('regency'),p_province:form.get('province'),p_payout_method:form.get('payout_method'),p_payout_provider:provider==='Lainnya'?custom:provider,p_payout_account_number:form.get('account_number'),p_payout_account_holder:form.get('account_holder'),p_social:{telegram:form.get('telegram'),youtube:form.get('youtube'),facebook:form.get('facebook')}};
  if(!payload.p_payout_provider)throw new Error(t('Pilih bank/e-wallet atau isi nama penyedia lainnya.','Select a bank/e-wallet or enter another provider.'));
  const {data,error}=await sb.rpc('apply_for_affiliate_v2',payload);if(error)throw error;if(!data?.ok)throw new Error(data?.reason||t('Pengajuan gagal.','Application failed.'));
  setMessage('affiliateMessage',t('Pengajuan berhasil dikirim. Tunggu verifikasi admin.','Application submitted. Please wait for admin review.'));e.target.reset();$('applicationMethod').dispatchEvent(new Event('change'));await load();
 }catch(error){setMessage('affiliateMessage',error.message||t('Gagal mengirim pengajuan.','Could not submit application.'),true);}finally{button.disabled=false;}
});
$('payoutUpdateForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=new FormData(e.target),button=e.submitter;button.disabled=true;setMessage('payoutUpdateMessage',t('Menyimpan rekening...','Saving payout details...'));
 try{const provider=form.get('provider'),custom=String(form.get('custom_provider')||'').trim(),name=provider==='Lainnya'?custom:provider;if(!name)throw new Error(t('Pilih bank/e-wallet atau isi nama lainnya.','Select a bank/e-wallet or enter another provider.'));
  const {data,error}=await sb.rpc('update_affiliate_payout_v2',{p_method:form.get('method'),p_provider:name,p_account_number:form.get('account_number'),p_account_holder:form.get('account_holder')});if(error)throw error;if(!data?.ok)throw new Error(data?.reason||t('Gagal menyimpan rekening.','Could not save payout details.'));
  setMessage('payoutUpdateMessage',t('Rekening pencairan berhasil diperbarui.','Payout details updated.'));await load();
 }catch(error){setMessage('payoutUpdateMessage',error.message||t('Gagal menyimpan rekening.','Could not save payout details.'),true);}finally{button.disabled=false;}
});
$('withdrawForm').addEventListener('submit',async e=>{
 e.preventDefault();const amount=Number(e.target.amount.value),button=e.submitter;button.disabled=true;setMessage('withdrawMessage',t('Mengirim pengajuan withdraw...','Submitting withdrawal request...'));
 try{if(!Number.isSafeInteger(amount)||amount<10000)throw new Error(t('Minimal withdraw Rp10.000.','Minimum withdrawal is Rp10,000.'));if(amount>Number(profile?.affiliate_balance||0))throw new Error(t('Saldo afiliasi tidak mencukupi.','Insufficient affiliate balance.'));if(amount<=AFFILIATE_FEE)throw new Error(t('Nominal harus lebih besar dari biaya platform.','Amount must exceed the platform fee.'));
  const {data,error}=await sb.rpc('request_affiliate_withdrawal_v2',{p_amount:amount});if(error)throw error;if(!data?.ok)throw new Error(data?.reason||t('Pengajuan withdraw gagal.','Withdrawal request failed.'));
  setMessage('withdrawMessage',`${t('Pengajuan terkirim. Total diterima','Request submitted. Net amount')}: ${money(data.net_amount)} (${t('biaya','fee')} ${money(data.fee_amount)}).`);e.target.reset();await load();
 }catch(error){setMessage('withdrawMessage',error.message||t('Withdraw gagal.','Withdrawal failed.'),true);}finally{button.disabled=false;}
});
$('publisherWithdrawForm').addEventListener('submit',async e=>{
 e.preventDefault();const form=new FormData(e.target),amount=Number(form.get('amount')),button=e.submitter;button.disabled=true;setMessage('publisherWithdrawMessage',t('Mengirim pengajuan withdraw...','Submitting withdrawal request...'));
 try{if(!Number.isSafeInteger(amount)||amount<10000)throw new Error(t('Minimal withdraw Rp10.000.','Minimum withdrawal is Rp10,000.'));if(amount>Number(publisher?.available_balance||0))throw new Error(t('Saldo AutoLink tersedia tidak mencukupi.','Insufficient available AutoLink balance.'));
  const {data,error}=await sb.rpc('request_publisher_withdrawal',{p_amount:amount,p_method:form.get('method'),p_provider:form.get('provider'),p_holder:form.get('holder'),p_account:form.get('account')});if(error)throw error;if(!data?.ok)throw new Error(data?.reason||t('Pengajuan withdraw AutoLink gagal.','AutoLink withdrawal request failed.'));
  setMessage('publisherWithdrawMessage',t('Pengajuan withdraw AutoLink berhasil dikirim.','AutoLink withdrawal request submitted.'));e.target.elements.amount.value='';await load();
 }catch(error){setMessage('publisherWithdrawMessage',error.message||t('Withdraw AutoLink gagal.','AutoLink withdrawal failed.'),true);}finally{button.disabled=false;}
});
$('copyAffiliateLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('affiliateLink').value);alert(t('Link berhasil disalin.','Link copied.'));}catch{prompt(t('Salin link ini','Copy this link'),$('affiliateLink').value);}});
$('affiliateForm').addEventListener('invalid',event=>{event.target.closest('details')?.setAttribute('open','');},true);
setPanelVisibility();bindProviders();applyLanguage();
document.addEventListener('boxcellink:language-change',applyLanguage);
load().catch(error=>{console.error(error);const msg=error.message||String(error);$('walletHistory').innerHTML=`<p class="wallet-feedback is-error">${esc(msg)}</p>`;alert(t('Gagal memuat wallet: ','Could not load wallet: ')+msg);});
})();
