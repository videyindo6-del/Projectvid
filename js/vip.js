(()=>{
const statusBox=document.getElementById('vipStatus'),plansBox=document.getElementById('vipPlans');
const rupiah=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>localStorage.getItem('boxcellink_lang')||'id';
async function init(){
 const en=lang()==='en';
 statusBox.innerHTML=`<span class="vip-status-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> ${en?'Checking membership status…':'Memeriksa status membership…'}</span>`;
 plansBox.innerHTML='<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Memuat paket VIP…</div>';
 try{
  const {data:{user}}=await sb.auth.getUser();
  if(user){const {data:p,error}=await sb.from('profiles').select('vip_expires_at').eq('id',user.id).maybeSingle();if(error)throw error;
   const active=p?.vip_expires_at&&new Date(p.vip_expires_at)>new Date();
   statusBox.innerHTML=active?`<b><i class="fa-solid fa-circle-check"></i> ${en?'VIP ACTIVE':'VIP AKTIF'}</b><span>${en?'Valid until':'Berlaku sampai'} ${new Date(p.vip_expires_at).toLocaleString(en?'en-US':'id-ID')}</span>`:`<b>${en?'BASIC ACCOUNT':'AKUN BASIC'}</b><span>${en?'Choose a plan to activate VIP benefits.':'Pilih paket untuk mengaktifkan keuntungan VIP.'}</span>`;
  }else statusBox.innerHTML=`<b>${en?'Sign in required':'Login diperlukan'}</b><span>${en?'Sign in before purchasing a plan.':'Login terlebih dahulu untuk membeli paket VIP.'}</span>`;
  const {data,error}=await sb.from('vip_plans').select('id,name,duration_days,price').eq('status','published').order('price');if(error)throw error;
  plansBox.innerHTML=(data||[]).map((v,i)=>`<article class="plan-card premium-plan"><span class="plan-tag">${en?'VIP MEMBERSHIP':'VIP MEMBERSHIP'}</span><div class="premium-plan-icon"><i class="fa-solid fa-crown"></i></div><h3>${safe(v.name)}</h3><div class="plan-price">${rupiah(v.price)}</div><p class="plan-duration"><i class="fa-regular fa-calendar"></i> ${v.duration_days} ${en?'days':'hari'} ${en?'membership':'masa aktif'}</p><ul><li><i class="fa-solid fa-check"></i> ${en?'VIP-only content':'Konten khusus VIP'}</li><li><i class="fa-solid fa-check"></i> ${en?'20% discount on eligible paid content':'Diskon 20% konten berbayar yang memenuhi syarat'}</li><li><i class="fa-solid fa-check"></i> ${en?'Manage membership in My Account':'Kelola masa aktif di Akun Saya'}</li></ul><button class="btn primary" data-buy-plan="${safe(v.id)}"><i class="fa-solid fa-lock"></i> ${en?'Buy this plan':'Beli paket ini'}</button></article>`).join('')||`<div class="empty-state">${en?'No VIP plans are currently available.':'Belum ada paket VIP yang tersedia.'}</div>`;
  plansBox.querySelectorAll('[data-buy-plan]').forEach(b=>b.addEventListener('click',()=>buyVip(b.dataset.buyPlan)));
 }catch(e){statusBox.innerHTML='<b>Informasi membership tidak tersedia</b>';plansBox.innerHTML=`<div class="empty-state error-state">Gagal memuat paket VIP: ${safe(e.message||e)}</div>`;}
}
async function buyVip(id){const {data:{user}}=await sb.auth.getUser();if(!user){location.href='login.html?next='+encodeURIComponent('/vip.html');return}try{const {data,error}=await sb.functions.invoke('create-payment',{body:{purpose:'vip',plan_id:id}});if(error)throw error;if(!data?.checkout_url)throw new Error(data?.error||'Checkout gagal');location.href=data.checkout_url}catch(e){alert(e.message||'Gagal membuat pembayaran')}}
window.buyVip=buyVip;init();
})();