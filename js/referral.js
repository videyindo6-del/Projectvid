const mainBox=document.getElementById('refMain'),progressBox=document.getElementById('refProgress'),couponBox=document.getElementById('refCoupons'),rewardBox=document.getElementById('refRewards');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function initReferral(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){mainBox.innerHTML='<p>Silakan <a href="/login.html">login</a> untuk melihat referral kamu.</p>';progressBox.innerHTML='';couponBox.innerHTML='';rewardBox.innerHTML='';return}
 const {data,error}=await sb.rpc('get_referral_summary');
 if(error){mainBox.textContent='Gagal memuat referral: '+error.message;return}
 const count=Number(data.referral_count||0),link=`${location.origin}/register.html?ref=${encodeURIComponent(data.referral_code||'')}`;
 mainBox.innerHTML=`<div class="ref-muted">Link referral kamu</div><div class="ref-link"><input id="myRefLink" readonly value="${esc(link)}"><button class="ref-btn" id="copyRef">Salin link</button></div><h2 style="margin-top:22px">${count} referral</h2><p class="ref-muted">Ajak teman mendaftar menggunakan link ini untuk membuka hadiah berikutnya.</p>`;
 document.getElementById('copyRef').onclick=async()=>{try{await navigator.clipboard.writeText(link);document.getElementById('copyRef').textContent='Tersalin!'}catch{document.getElementById('myRefLink').select();document.execCommand('copy');document.getElementById('copyRef').textContent='Tersalin!'}};
 const milestones=[{n:5,title:'Diskon 20%',detail:'2 kali pembelian'},{n:10,title:'Diskon 50%',detail:'4 kali pembelian'},{n:30,title:'VIP 2 hari',detail:'Bonus masa aktif VIP'},{n:50,title:'VIP 7 hari',detail:'Bonus masa aktif VIP'},{n:100,title:'VIP 30 hari',detail:'Bonus masa aktif VIP'}];
 progressBox.innerHTML=milestones.map(m=>`<article class="ref-card"><b>${m.n} referral — ${m.title}</b><p class="ref-muted">${m.detail}</p><div class="ref-progress"><span style="width:${Math.min(100,count/m.n*100)}%"></span></div><small class="ref-muted">${Math.min(count,m.n)} / ${m.n} referral ${count>=m.n?'· Tercapai':'· '+(m.n-count)+' lagi'}</small></article>`).join('');
 const coupons=data.coupons||[];couponBox.innerHTML=coupons.length?coupons.map(c=>`<div style="padding:12px 0;border-bottom:1px solid #263247"><span class="ref-code">${esc(c.code)}</span> <b>Diskon ${c.discount_percent}%</b><p class="ref-muted">${Math.max(0,c.uses_total-c.uses_used-c.uses_reserved)} dari ${c.uses_total} pemakaian tersisa</p></div>`).join(''):'<p class="ref-muted">Belum ada kode diskon. Capai 5 referral untuk mendapatkan kode pertama.</p>';
 const rewards=data.rewards||[];rewardBox.innerHTML=rewards.length?rewards.map(r=>`<p>✓ <b>${esc(r.description)}</b> <span class="ref-muted">(${new Date(r.created_at).toLocaleDateString('id-ID')})</span></p>`).join(''):'<p class="ref-muted">Hadiah akan muncul otomatis saat target referral tercapai.</p>';
}
initReferral();
