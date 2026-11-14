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
const navHrefSelect=document.getElementById('navItemHref');
const navCustomHref=document.getElementById('navCustomHref');
const navCustomHrefLabel=document.getElementById('navCustomHrefLabel');
const navIconInput=document.getElementById('navItemIcon');
const navIconPreview=document.getElementById('navIconPreview');
const navMessage=document.getElementById('navMessage');
const navField=id=>document.getElementById(id);
function syncNavDestination(){const custom=navHrefSelect?.value==='__custom__';if(navCustomHref){navCustomHref.hidden=!custom;navCustomHref.required=custom;}if(navCustomHrefLabel)navCustomHrefLabel.hidden=!custom;}
function syncNavIcon(){if(!navIconPreview||!navIconInput)return;const value=navIconInput.value.trim();navIconPreview.innerHTML=/^(fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/.test(value)?`<i class="${value}" aria-hidden="true"></i>`:'<i class="fa-solid fa-circle-question" aria-hidden="true"></i>';}
navHrefSelect?.addEventListener('change',syncNavDestination);navIconInput?.addEventListener('input',syncNavIcon);syncNavDestination();syncNavIcon();
async function loadCustomNavAdmin(){
 if(!customNavList)return;
 customNavList.textContent='Memuat menu navbar...';
 try{const {data,error}=await sb.from('site_nav_items').select('*').order('sort_order').order('created_at',{ascending:false});if(error)throw error;
 customNavList.innerHTML=(data||[]).map(n=>`<article class="hub-announcement-item"><div><b><i class="${safeText(n.icon||'fa-solid fa-link')}"></i> ${safeText(n.label)}</b><p>${safeText(n.href)} · ${safeText(n.visibility||'all')} · ${safeText(n.tag||'Tanpa badge')}</p><small>${n.active?'Aktif':'Nonaktif'} · Urutan ${n.sort_order||0}</small></div><button type="button" data-nav-edit="${safeText(n.id)}">Edit</button><button type="button" data-nav-toggle="${safeText(n.id)}" data-active="${n.active?'1':'0'}">${n.active?'Nonaktifkan':'Aktifkan'}</button><button type="button" class="danger" data-nav-delete="${safeText(n.id)}">Hapus</button></article>`).join('')||'<p>Belum ada menu tambahan.</p>';
 }catch(error){customNavList.textContent='Menu navbar belum dapat dimuat: '+(error.message||error)+'. Pastikan migration supabase/site_nav_items.sql sudah dijalankan dan akun memiliki role admin.';}
}
function resetNavForm(){navForm?.reset();navField('navItemId').value='';if(navHrefSelect)navHrefSelect.value='/dashboard.html';if(navCustomHref)navCustomHref.value='';navField('navItemIcon').value='fa-solid fa-link';navField('navTagColor').value='#2563eb';navField('navBgColor').value='#eff6ff';navField('navTextColor').value='#334155';navField('navSortOrder').value='50';navField('navSaveButton').innerHTML='<i class="fa-solid fa-plus"></i> Simpan menu';navField('navCancelEdit').hidden=true;if(navMessage)navMessage.textContent='';syncNavDestination();syncNavIcon();}
navForm?.addEventListener('submit',async e=>{
 e.preventDefault();if(!navForm.reportValidity())return;
 const id=navField('navItemId').value,label=navField('navItemLabel').value.trim(),href=navHrefSelect?.value==='__custom__'?navCustomHref?.value.trim():navHrefSelect?.value,icon=navIconInput?.value.trim()||'fa-solid fa-link',btn=navField('navSaveButton');
 if(!label||!(/^(https:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i.test(href||''))){navMessage.textContent='Nama menu wajib diisi dan tujuan harus berupa path website atau URL HTTPS.';return;}
 if(!/^(fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/.test(icon)){navMessage.textContent='Format ikon tidak valid. Contoh: fa-solid fa-fire.';return;}
 const payload={label,href,icon,tag:navField('navItemTag').value||null,tag_color:navField('navTagColor').value,bg_color:navField('navBgColor').value,text_color:navField('navTextColor').value,visibility:navField('navItemVisibility').value,sort_order:Number(navField('navSortOrder').value)||0};
 btn.disabled=true;btn.setAttribute('aria-busy','true');navMessage.textContent='Menyimpan menu...';
 try{const result=id?await sb.from('site_nav_items').update(payload).eq('id',id).select('id').maybeSingle():await sb.from('site_nav_items').insert(payload).select('id').maybeSingle();if(result.error)throw result.error;if(!result.data)throw new Error('Database tidak mengembalikan data tersimpan. Periksa policy admin/RLS.');navMessage.textContent='Menu navbar berhasil disimpan.';resetNavForm();await loadCustomNavAdmin();}
 catch(error){navMessage.textContent='Gagal menyimpan menu: '+(error.message||error);}
 finally{btn.disabled=false;btn.removeAttribute('aria-busy');}
});
navField('navCancelEdit')?.addEventListener('click',resetNavForm);
customNavList?.addEventListener('click',async e=>{
 const edit=e.target.closest('[data-nav-edit]'),toggle=e.target.closest('[data-nav-toggle]'),del=e.target.closest('[data-nav-delete]');
 try{
  if(edit){const {data,error}=await sb.from('site_nav_items').select('*').eq('id',edit.dataset.navEdit).maybeSingle();if(error)throw error;if(!data)throw new Error('Menu tidak ditemukan.');navField('navItemId').value=data.id;navField('navItemLabel').value=data.label;if(navHrefSelect){const opts=[...navHrefSelect.options];if(opts.some(o=>o.value===data.href)){navHrefSelect.value=data.href;navCustomHref.value='';}else{navHrefSelect.value='__custom__';navCustomHref.value=data.href;}}syncNavDestination();navIconInput.value=data.icon||'fa-solid fa-link';navField('navItemTag').value=data.tag||'';navField('navItemVisibility').value=data.visibility||'all';navField('navTagColor').value=data.tag_color||'#2563eb';navField('navBgColor').value=data.bg_color||'#eff6ff';navField('navTextColor').value=data.text_color||'#334155';navField('navSortOrder').value=data.sort_order??50;navField('navSaveButton').textContent='Simpan perubahan';navField('navCancelEdit').hidden=false;syncNavIcon();navForm.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(toggle){const {error}=await sb.from('site_nav_items').update({active:toggle.dataset.active!=='1'}).eq('id',toggle.dataset.navToggle);if(error)throw error;await loadCustomNavAdmin();return;}
  if(del&&confirm('Hapus menu navbar ini?')){const {error}=await sb.from('site_nav_items').delete().eq('id',del.dataset.navDelete);if(error)throw error;await loadCustomNavAdmin();}
 }catch(error){if(navMessage)navMessage.textContent='Aksi menu gagal: '+(error.message||error);}
});
