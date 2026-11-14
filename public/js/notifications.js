(()=>{
'use strict';
const box=document.getElementById('noticeList');
const adminPanel=document.getElementById('adminAnnouncements');
const markAllButton=document.getElementById('markAll');
const deleteAllButton=document.getElementById('deleteAll');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null,busy=false,notificationRows=[];
function feedback(message,type='info'){
 let host=document.getElementById('noticeFeedback');
 if(!host){host=document.createElement('p');host.id='noticeFeedback';host.className='notice-feedback';host.setAttribute('role','status');host.setAttribute('aria-live','polite');document.querySelector('.notice-head')?.after(host);}
 host.textContent=message;host.dataset.type=type;
}
function syncActions(){
 if(markAllButton)markAllButton.disabled=busy||!notificationRows.some(n=>!n.is_read);
 if(deleteAllButton)deleteAllButton.disabled=busy||!notificationRows.some(n=>n.is_read);
}
function setBusy(value){busy=value;syncActions();}
function safeHref(value){const href=String(value||'');return href.startsWith('/')&&!href.startsWith('//')?href:'/notifications.html';}
function deleteButton(n){
 return n.is_read
  ? `<button type="button" data-delete-one="${esc(n.id)}">Hapus</button>`
  : `<span class="notice-cannot-delete">Baca notifikasi terlebih dahulu untuk menghapus</span>`;
}
function notificationCard(n){
 return `<article class="notice-card ${n.is_read?'':'unread'}"><h3>${n.kind==='announcement'?'<i class="fa-solid fa-bullhorn"></i> ':''}${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notice-meta"><span>${new Date(n.created_at).toLocaleString()} · ${esc(n.kind||'system')}</span><span>${n.is_read?'Sudah dibaca':'Belum dibaca'}</span><span>${n.href?`<a href="${esc(safeHref(n.href))}" data-mark-read="${esc(n.id)}">Buka</a>`:''}</span>${n.is_read?deleteButton(n):`<button type="button" data-mark-one="${esc(n.id)}">Tandai dibaca</button>${deleteButton(n)}`}</div></article>`;
}
async function load(){
 if(!window.sb?.auth){feedback('Koneksi database belum siap. Muat ulang halaman.','error');return;}
 try{
  const {data:authData,error:authError}=await sb.auth.getUser();
  if(authError)throw authError;
  user=authData?.user||null;
  if(!user){location.replace('/login.html?next=%2Fnotifications.html');return;}
  const {data,error}=await sb.from('boxcellink_notifications')
   .select('id,user_id,title,body,kind,href,is_read,is_admin_managed,created_at')
   .eq('user_id',user.id).order('created_at',{ascending:false}).limit(200);
  if(error)throw error;
  notificationRows=data||[];
  const announcements=notificationRows.filter(n=>n.kind==='announcement');
  const personal=notificationRows.filter(n=>n.kind!=='announcement');
  let siteCards=[];
  const {data:siteAnnouncements,error:announcementError}=await sb.from('announcements')
   .select('id,title,body,created_at').eq('active',true).order('created_at',{ascending:false}).limit(20);
  if(!announcementError)siteCards=(siteAnnouncements||[]).map(n=>`<article class="notice-card"><h3><i class="fa-solid fa-bullhorn"></i> ${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notice-meta"><span>${new Date(n.created_at).toLocaleString()}</span><span>Pengumuman resmi</span></div></article>`);
  const announcementCards=announcements.map(notificationCard);
  adminPanel.innerHTML=[...siteCards,...announcementCards].join('')||'<p class="wallet-muted">Belum ada pengumuman admin.</p>';
  box.innerHTML=personal.length?personal.map(notificationCard).join(''):'<div class="notice-empty"><i class="fa-regular fa-bell"></i><h3>Belum ada notifikasi aktivitas</h3><p>Notifikasi transaksi dan aktivitas akan muncul di sini.</p></div>';
  if(announcementError)console.warn('Pengumuman website belum tersedia:',announcementError.message);
  syncActions();
 }catch(error){console.error('Notification load failed:',error);feedback('Notifikasi gagal dimuat: '+(error.message||'Periksa koneksi dan kebijakan database.'),'error');}
}
async function markRead(id){
 if(!user||busy)return false;
 setBusy(true);
 try{
  const {error}=await sb.from('boxcellink_notifications').update({is_read:true}).eq('id',id).eq('user_id',user.id).eq('is_read',false);
  if(error)throw error;
  await load();feedback('Notifikasi ditandai sudah dibaca.','success');return true;
 }catch(e){feedback('Gagal menandai notifikasi: '+e.message,'error');return false;}
 finally{setBusy(false);}
}
async function deleteOne(id){
 if(!user||busy)return;
 const target=notificationRows.find(n=>n.id===id);
 if(!target||!target.is_read){feedback('Notifikasi yang belum dibaca tidak dapat dihapus. Tandai sudah dibaca terlebih dahulu.','error');return;}
 if(!confirm('Hapus notifikasi yang sudah dibaca ini?'))return;
 setBusy(true);
 try{
  const {error}=await sb.from('boxcellink_notifications').delete().eq('id',id).eq('user_id',user.id).eq('is_read',true);
  if(error)throw error;
  await load();feedback('Notifikasi berhasil dihapus.','success');
 }catch(e){feedback('Gagal menghapus notifikasi: '+e.message,'error');}
 finally{setBusy(false);}
}
async function handleListClick(e){
 const open=e.target.closest('a[data-mark-read]');
 if(open){e.preventDefault();const href=open.href;if(await markRead(open.dataset.markRead))location.assign(href);return;}
 const del=e.target.closest('[data-delete-one]');
 if(del){await deleteOne(del.dataset.deleteOne);return;}
 const mark=e.target.closest('[data-mark-one]');
 if(mark)await markRead(mark.dataset.markOne);
}
box?.addEventListener('click',handleListClick);
adminPanel?.addEventListener('click',handleListClick);
markAllButton?.addEventListener('click',async()=>{
 if(!user||busy||!notificationRows.some(n=>!n.is_read))return;
 setBusy(true);
 try{
  const {error}=await sb.from('boxcellink_notifications').update({is_read:true}).eq('user_id',user.id).eq('is_read',false);
  if(error)throw error;
  await load();feedback('Semua notifikasi berhasil ditandai sudah dibaca.','success');
 }catch(e){feedback('Gagal menandai semua notifikasi: '+e.message,'error');}
 finally{setBusy(false);}
});
deleteAllButton?.addEventListener('click',async()=>{
 if(!user||busy||!notificationRows.some(n=>n.is_read))return;
 if(!confirm('Hapus semua notifikasi yang sudah dibaca? Notifikasi yang belum dibaca akan tetap tersimpan.'))return;
 setBusy(true);
 try{
  const {error}=await sb.from('boxcellink_notifications').delete().eq('user_id',user.id).eq('is_read',true);
  if(error)throw error;
  await load();feedback('Semua notifikasi yang sudah dibaca berhasil dihapus.','success');
 }catch(e){feedback('Gagal menghapus notifikasi: '+e.message,'error');}
 finally{setBusy(false);}
});
load();
})();