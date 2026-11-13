(()=>{
'use strict';
const box=document.getElementById('noticeList');const adminPanel=document.getElementById('adminAnnouncements');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null;
async function load(){
 const auth=await sb.auth.getUser();user=auth.data?.user;
 if(!user){location.replace('/login.html?next=%2Fnotifications.html');return}
 const {data,error}=await sb.from('boxcellink_notifications').select('id,title,body,kind,href,is_read,is_admin_managed,created_at').order('created_at',{ascending:false}).limit(100);
 if(error){box.textContent='Gagal memuat notifikasi: '+error.message;return}
 const announcements=(data||[]).filter(n=>n.kind==='announcement');
 const personal=(data||[]).filter(n=>n.kind!=='announcement');
 const {data:siteAnnouncements,error:announcementError}=await sb.from('announcements').select('id,title,body,created_at').eq('active',true).order('created_at',{ascending:false}).limit(20);
 const siteCards=(siteAnnouncements||[]).map(n=>`<article class="notice-card"><h3><i class="fa-solid fa-bullhorn"></i> ${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notice-meta"><span>${new Date(n.created_at).toLocaleString('id-ID')}</span><span>Pengumuman resmi</span></div></article>`);
 const personalAnnouncementCards=announcements.map(n=>`<article class="notice-card ${n.is_read?'':'unread'}"><h3><i class="fa-solid fa-bullhorn"></i> ${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notice-meta"><span>${new Date(n.created_at).toLocaleString('id-ID')}</span><span>${n.is_read?'Sudah dibaca':'Belum dibaca'}</span><button type="button" data-open="${esc(n.id)}">Tandai dibaca</button></div></article>`);
 adminPanel.innerHTML=[...siteCards,...personalAnnouncementCards].join('')||'<p class="wallet-muted">Belum ada pengumuman admin.</p>';
 if(announcementError)console.warn('Pengumuman website belum tersedia:',announcementError.message);
 if(!personal.length){box.innerHTML='<div class="notice-empty"><i class="fa-regular fa-bell"></i><h3>Belum ada notifikasi aktivitas</h3><p>Notifikasi transaksi dan aktivitas akan muncul di sini.</p></div>';}
 else box.innerHTML=personal.map(n=>`<article class="notice-card ${n.is_read?'':'unread'}"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="notice-meta"><span>${new Date(n.created_at).toLocaleString('id-ID')} · ${esc(n.kind)}</span><span>${n.is_read?'Sudah dibaca':'Belum dibaca'}</span><span>${n.href?`<a href="${esc(n.href.startsWith('/')?n.href:'/notifications.html')}" data-open="${esc(n.id)}">Buka</a>`:''}</span><button type="button" data-delete="${esc(n.id)}">Hapus</button></div></article>`).join('');
 adminPanel.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',async()=>{const {error}=await sb.from('boxcellink_notifications').update({is_read:true}).eq('id',b.dataset.open);if(error)alert(error.message);else load()}));
 box.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',async()=>{const {error}=await sb.from('boxcellink_notifications').delete().eq('id',b.dataset.delete);if(error)alert(error.message);else load()}));
 box.querySelectorAll('[data-open]').forEach(a=>a.addEventListener('click',async()=>{await sb.from('boxcellink_notifications').update({is_read:true}).eq('id',a.dataset.open)}));
}
document.getElementById('markAll').onclick=async()=>{if(!user)return;const {error}=await sb.from('boxcellink_notifications').update({is_read:true}).eq('user_id',user.id).eq('is_read',false);if(error)alert(error.message);else load()};
document.getElementById('deleteAll').onclick=async()=>{if(!user||!confirm('Hapus semua notifikasi pribadi? Pengumuman admin akan tetap tersimpan.'))return;const {error}=await sb.from('boxcellink_notifications').delete().eq('user_id',user.id).eq('is_admin_managed',false);if(error)alert(error.message);else load()};
load();
})();