async function guardAdmin(){const {data:{user}}=await sb.auth.getUser();if(!user){location.href='login.html';return null}const {data:p,error}=await sb.from('profiles').select('role,is_banned').eq('id',user.id).single();if(error||p?.role!=='admin'||p?.is_banned){location.href='dashboard.html';return null}document.getElementById('adminEmail').textContent=user.email||'';return user}
document.getElementById('logout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.href='index.html'});


// Admin activity center: latest withdrawals + member support conversations.
const activityBox=document.getElementById('adminActivityFeed');
const announcementList=document.getElementById('adminAnnouncementList');
const safeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function loadAdminActivity(){
 if(!activityBox)return;
 activityBox.innerHTML='<article class="hub-card"><span class="hub-card-copy"><b>Memuat...</b><span>Memeriksa aktivitas member.</span></span></article>';
 const [withdrawals,support]=await Promise.all([
  sb.from('affiliate_withdrawals').select('id,user_id,amount,status,payout_provider,payout_method,created_at').order('created_at',{ascending:false}).limit(8),
  sb.from('support_conversations').select('id,user_id,subject,status,updated_at').order('updated_at',{ascending:false}).limit(8)
 ]);
 const items=[];
 if(!withdrawals.error)(withdrawals.data||[]).forEach(w=>items.push({time:w.created_at,html:`<a class="hub-card" href="affiliate-admin.html"><span class="hub-card-icon"><i class="fa-solid fa-wallet"></i></span><span class="hub-card-copy"><b>Pengajuan withdraw · Rp ${Number(w.amount||0).toLocaleString('id-ID')}</b><span>Status: ${safeText(w.status)} · ${safeText(w.payout_provider||w.payout_method||'Metode payout')}<br>${new Date(w.created_at).toLocaleString('id-ID')}</span></span><i class="fa-solid fa-arrow-up-right-from-square hub-arrow"></i></a>`}));
 if(!support.error)(support.data||[]).forEach(c=>items.push({time:c.updated_at,html:`<a class="hub-card" href="support-inbox.html"><span class="hub-card-icon"><i class="fa-solid fa-headset"></i></span><span class="hub-card-copy"><b>Support member · ${safeText(c.subject||'Chat Support')}</b><span>Status: ${safeText(c.status)} · ${new Date(c.updated_at).toLocaleString('id-ID')}</span></span><i class="fa-solid fa-arrow-up-right-from-square hub-arrow"></i></a>`}));
 items.sort((a,b)=>new Date(b.time)-new Date(a.time));
 activityBox.innerHTML=items.slice(0,10).map(x=>x.html).join('')||'<article class="hub-card"><span class="hub-card-copy"><b>Belum ada aktivitas baru</b><span>Pengajuan withdraw dan percakapan support akan muncul di sini.</span></span></article>';
 if(withdrawals.error)console.warn('Withdraw feed:',withdrawals.error.message);
 if(support.error)console.warn('Support feed:',support.error.message);
}
async function loadAdminAnnouncements(){
 if(!announcementList)return;
 const {data,error}=await sb.from('announcements').select('id,title,body,active,created_at').order('created_at',{ascending:false}).limit(20);
 if(error){announcementList.textContent='Pengumuman tidak dapat dimuat: '+error.message;return;}
 announcementList.innerHTML=(data||[]).map(a=>`<article class="hub-announcement-item"><div><b>${safeText(a.title)}</b><p>${safeText(a.body)}</p><small>${new Date(a.created_at).toLocaleString('id-ID')} · ${a.active?'Aktif':'Nonaktif'}</small></div><button type="button" data-announcement-toggle="${a.id}" data-active="${a.active?'1':'0'}">${a.active?'Nonaktifkan':'Aktifkan'}</button><button type="button" class="danger" data-announcement-delete="${a.id}">Hapus</button></article>`).join('')||'<p>Belum ada pengumuman.</p>';
}
document.getElementById('refreshAdminActivity')?.addEventListener('click',loadAdminActivity);
document.getElementById('adminAnnouncementForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const title=document.getElementById('announcementTitle').value.trim(),body=document.getElementById('announcementBody').value.trim(),msg=document.getElementById('announcementMessage'),btn=e.submitter;
 if(!title||!body)return;btn.disabled=true;msg.textContent='Menerbitkan...';
 const {error}=await sb.from('announcements').insert({title,body,active:true});
 btn.disabled=false;if(error){msg.textContent='Gagal menerbitkan: '+error.message;return;}e.target.reset();msg.textContent='Pengumuman berhasil diterbitkan dan disinkronkan ke notifikasi member.';await loadAdminAnnouncements();
});
announcementList?.addEventListener('click',async e=>{
 const toggle=e.target.closest('[data-announcement-toggle]'),del=e.target.closest('[data-announcement-delete]');if(!toggle&&!del)return;
 if(del&&!confirm('Hapus pengumuman ini?'))return;
 const id=(toggle||del).dataset.announcementToggle||(toggle||del).dataset.announcementDelete;
 const result=toggle?await sb.from('announcements').update({active:toggle.dataset.active!=='1'}).eq('id',id):await sb.from('announcements').delete().eq('id',id);
 if(result.error){alert('Perubahan pengumuman gagal: '+result.error.message);return;}await loadAdminAnnouncements();
});
guardAdmin().then(user=>{if(user){if(activityBox){loadAdminActivity();loadAdminAnnouncements();}loadCustomNavAdmin();}});


// Custom navbar menu manager.
const customNavList=document.getElementById('customNavList');
const navForm=document.getElementById('customNavForm');
const navHrefSelect=document.getElementById('navItemHref'),navCustomHref=document.getElementById('navCustomHref');
navHrefSelect?.addEventListener('change',()=>{if(navCustomHref){navCustomHref.hidden=navHrefSelect.value!=='__custom__';navCustomHref.required=navHrefSelect.value==='__custom__';}});
async function loadCustomNavAdmin(){if(!customNavList)return;const {data,error}=await sb.from('site_nav_items').select('*').order('sort_order').order('created_at',{ascending:false});if(error){customNavList.textContent='Menu belum dapat dimuat: '+error.message+' (jalankan migration site_nav_items.sql).';return;}customNavList.innerHTML=(data||[]).map(n=>`<article class="hub-announcement-item"><div><b><i class="${safeText(n.icon||'fa-solid fa-link')}"></i> ${safeText(n.label)}</b><p>${safeText(n.href)} · ${safeText(n.visibility||'all')} · ${safeText(n.tag||'Tanpa tag')}</p><small>${n.active?'Aktif':'Nonaktif'} · Urutan ${n.sort_order||0}</small></div><button type="button" data-nav-edit="${n.id}">Edit</button><button type="button" data-nav-toggle="${n.id}" data-active="${n.active?'1':'0'}">${n.active?'Nonaktifkan':'Aktifkan'}</button><button type="button" class="danger" data-nav-delete="${n.id}">Hapus</button></article>`).join('')||'<p>Belum ada menu tambahan.</p>';}
function resetNavForm(){navForm?.reset();document.getElementById('navItemId').value='';if(navHrefSelect)navHrefSelect.value='/dashboard.html';if(navCustomHref){navCustomHref.value='';navCustomHref.hidden=true;navCustomHref.required=false;}document.getElementById('navItemIcon').value='fa-solid fa-link';document.getElementById('navTagColor').value='#2563eb';document.getElementById('navBgColor').value='#eff6ff';document.getElementById('navTextColor').value='#334155';document.getElementById('navSortOrder').value='50';document.getElementById('navSaveButton').innerHTML='<i class="fa-solid fa-plus"></i> Simpan menu';document.getElementById('navCancelEdit').hidden=true;}
navForm?.addEventListener('submit',async e=>{e.preventDefault();const id=document.getElementById('navItemId').value,label=document.getElementById('navItemLabel').value.trim(),href=navHrefSelect?.value==='__custom__'?navCustomHref.value.trim():navHrefSelect?.value,icon=document.getElementById('navItemIcon').value.trim(),msg=document.getElementById('navMessage'),btn=document.getElementById('navSaveButton');if(!label||!(/^(https:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i.test(href))){msg.textContent='Nama menu wajib diisi dan tujuan harus berupa path website atau URL HTTPS.';return;}if(icon&&!/^(fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/.test(icon)){msg.textContent='Format ikon harus seperti: fa-solid fa-fire';return;}const payload={label,href,icon:icon||'fa-solid fa-link',tag:document.getElementById('navItemTag').value||null,tag_color:document.getElementById('navTagColor').value,bg_color:document.getElementById('navBgColor').value,text_color:document.getElementById('navTextColor').value,visibility:document.getElementById('navItemVisibility').value,sort_order:Number(document.getElementById('navSortOrder').value)||0};btn.disabled=true;const result=id?await sb.from('site_nav_items').update(payload).eq('id',id):await sb.from('site_nav_items').insert(payload);btn.disabled=false;if(result.error){msg.textContent='Gagal menyimpan menu: '+result.error.message;return;}msg.textContent='Menu navbar berhasil disimpan.';resetNavForm();await loadCustomNavAdmin();});
document.getElementById('navCancelEdit')?.addEventListener('click',resetNavForm);
customNavList?.addEventListener('click',async e=>{const edit=e.target.closest('[data-nav-edit]'),toggle=e.target.closest('[data-nav-toggle]'),del=e.target.closest('[data-nav-delete]');if(edit){const {data,error}=await sb.from('site_nav_items').select('*').eq('id',edit.dataset.navEdit).maybeSingle();if(error||!data){alert(error?.message||'Menu tidak ditemukan');return;}document.getElementById('navItemId').value=data.id;document.getElementById('navItemLabel').value=data.label;if(navHrefSelect){const opts=[...navHrefSelect.options];if(opts.some(o=>o.value===data.href)){navHrefSelect.value=data.href;navCustomHref.hidden=true;}else{navHrefSelect.value='__custom__';navCustomHref.hidden=false;navCustomHref.required=true;navCustomHref.value=data.href;}}document.getElementById('navItemIcon').value=data.icon||'fa-solid fa-link';document.getElementById('navItemTag').value=data.tag||'';document.getElementById('navItemVisibility').value=data.visibility||'all';document.getElementById('navTagColor').value=data.tag_color||'#2563eb';document.getElementById('navBgColor').value=data.bg_color||'#eff6ff';document.getElementById('navTextColor').value=data.text_color||'#334155';document.getElementById('navSortOrder').value=data.sort_order||0;document.getElementById('navSaveButton').textContent='Simpan perubahan';document.getElementById('navCancelEdit').hidden=false;navForm.scrollIntoView({behavior:'smooth',block:'center'});return;}if(toggle){const {error}=await sb.from('site_nav_items').update({active:toggle.dataset.active!=='1'}).eq('id',toggle.dataset.navToggle);if(error)alert(error.message);else loadCustomNavAdmin();}if(del&&confirm('Hapus menu navbar ini?')){const {error}=await sb.from('site_nav_items').delete().eq('id',del.dataset.navDelete);if(error)alert(error.message);else loadCustomNavAdmin();}});
