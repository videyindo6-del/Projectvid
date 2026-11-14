(()=>{
'use strict';
const box=document.getElementById('noticeList');
const adminPanel=document.getElementById('adminAnnouncements');
const markAllButton=document.getElementById('markAll');
const deleteAllButton=document.getElementById('deleteAll');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null,busy=false;
function feedback(message,type='info'){
 let host=document.getElementById('noticeFeedback');
 if(!host){host=document.createElement('p');host.id='noticeFeedback';host.className='notice-feedback';host.setAttribute('role','status');host.setAttribute('aria-live','polite');document.querySelector('.notice-head')?.after(host);}
 host.textContent=message;host.dataset.type=type;
}
function setBusy(value){busy=value;[markAllButton,deleteAllButton].forEach(b=>{if(b){b.disabled=value;b.setAttribute('aria-busy',String(value));}})}
async function load(){
 if(!window.sb?.auth){feedback('Koneksi database belum siap. Muat ulang halaman.','error');return;}
 try{
  const {data:authData,error:authError}=await sb.auth.getUser();
  if(authError)throw authError;
  user=authData?.user||null;
  if(!user){location.replace('/login.html?next=%2Fnotifications.html');return;}
  const {data,error}=await sb.from('boxcellink_notifications').select('id,user_id,title,body,kind,href,is_read,is_admin_managed,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(200);
  if(error)throw error;
  const rows=data||[],announcements=rows.filter(n=>n.kind==='announcement'),personal=rows.filter(n=>n.kind!=='announcement');
  let siteCards=[];
  const {data:siteAnnouncements,error:announcementError}=await sb.from('announcements').select('id,title,body,created_at').eq('active',true).order('created_at',{ascending:false}).limit(20);
  if(!announcementError)siteCards=(siteAnnouncements||[]).map(n=>`<article class="notice-card"><h3><i class="fa-solid fa-bullhorn"></i> ${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notice-meta"><span>${new Date(n.created_at).toLocaleString()}</span><span>Pengumuman resmi</span></div></article>`);
  const announcementCards=announcements.map(n=>`<article class="notice-card ${n.is_read?'':'unread'}"><h3><i class="fa-solid fa-bullhorn"></i> ${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notice-meta"><span>${new Date(n.created_at).toLocaleString()}</span><span>${n.is_read?'Sudah dibaca':'Belum dibaca'}</span><button type="button" data-mark-read="${esc(n.id)}" ${n.is_read?'disabled':''}>${n.is_read?'Sudah dibaca':'Tandai dibaca'}</button></div></article>`);
  adminPanel.innerHTML=[...siteCards,...announcementCards].join('')||'<p class="wallet-muted">Belum ada pengumuman admin.</p>';
  box.innerHTML=personal.length?personal.map(n=>`<article class="notice-card ${n.is_read?'':'unread'}"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notice-meta"><span>${new Date(n.created_at).toLocaleString()} · ${esc(n.kind)}</span><span>${n.is_read?'Sudah dibaca':'Belum dibaca'}</span><span>${n.href?`<a href="${esc((n.href||'').startsWith('/')?n.href:'/notifications.html')}" data-mark-read="${esc(n.id)}">Buka</a>`:''}</span><button type="button" data-delete-one="${esc(n.id)}">Hapus</button></div></article>`).join(''):'<div class="notice-empty"><i class="fa-regular fa-bell"></i><h3>Belum ada notifikasi aktivitas</h3><p>Notifikasi transaksi dan aktivitas akan muncul di sini.</p></div>';
  if(announcementError)console.warn('Pengumuman website belum tersedia:',announcementError.message);
 }catch(error){console.error('Notification load failed:',error);feedback('Notifikasi gagal dimuat: '+(error.message||'Periksa koneksi dan kebijakan database.'),'error');}
}
async function markRead(id){if(!user||busy)return false;setBusy(true);try{const {error}=await sb.from('boxcellink_notifications').update({is_read:true}).eq('id',id).eq('user_id',user.id);if(error)throw error;await load();feedback('Notifikasi ditandai sudah dibaca.','success');return true;}catch(e){feedback('Gagal menandai notifikasi: '+e.message,'error');return false;}finally{setBusy(false);}}
adminPanel?.addEventListener('click',e=>{const b=e.target.closest('[data-mark-read]');if(b){e.preventDefault();markRead(b.dataset.markRead);}});
box?.addEventListener('click',async e=>{const del=e.target.closest('[data-delete-one]');const open=e.target.closest('a[data-mark-read]');if(open){e.preventDefault();const href=open.href;if(await markRead(open.dataset.markRead))location.assign(href);return;}if(!del||!user||busy)return;if(!confirm('Hapus notifikasi ini?'))return;setBusy(true);try{const {error}=await sb.from('boxcellink_notifications').delete().eq('id',del.dataset.deleteOne).eq('user_id',user.id);if(error)throw error;await load();feedback('Notifikasi berhasil dihapus.','success');}catch(err){feedback('Gagal menghapus notifikasi: '+err.message,'error');}finally{setBusy(false);}});
markAllButton?.addEventListener('click',async()=>{if(!user||busy)return;setBusy(true);try{const {error}=await sb.from('boxcellink_notifications').update({is_read:true}).eq('user_id',user.id).eq('is_read',false);if(error)throw error;await load();feedback('Semua notifikasi berhasil ditandai sudah dibaca.','success');}catch(e){feedback('Gagal menandai semua notifikasi: '+e.message,'error');}finally{setBusy(false);}});
deleteAllButton?.addEventListener('click',async()=>{if(!user||busy)return;if(!confirm('Hapus seluruh notifikasi di akun ini? Pengumuman utama website tetap tersedia.'))return;setBusy(true);try{const {error}=await sb.from('boxcellink_notifications').delete().eq('user_id',user.id);if(error)throw error;await load();feedback('Semua notifikasi akun berhasil dihapus.','success');}catch(e){feedback('Gagal menghapus semua notifikasi: '+e.message,'error');}finally{setBusy(false);}});
load();
})();
