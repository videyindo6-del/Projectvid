(()=>{'use strict';
const root=document.getElementById('adminLiveMetrics'),note=document.getElementById('adminLiveNote'),refresh=document.getElementById('adminLiveRefresh');
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('id-ID'):'—';
async function count(table,filters=[]){let q=sb.from(table).select('id',{count:'exact',head:true});filters.forEach(([key,val])=>q=q.eq(key,val));const r=await q;return r.error?null:r.count;}
function tile(label,icon,value,desc){return `<article class="admin-live-card"><span><i class="${icon}"></i> ${esc(label)}</span><strong>${value===null?'—':fmt(value)}</strong><small>${esc(desc)}</small></article>`;}
async function load(){
 if(!root||!window.sb)return;
 if(note)note.textContent='Memuat ringkasan kontrol...';
 const [auth,presence,videoCount,reviewCount,supportCount,affiliatePending,publisherPending]=await Promise.all([
  sb.auth.getUser(),sb.rpc('get_admin_presence_stats'),count('videos'),count('review_items'),count('support_conversations'),count('affiliate_withdrawals',[['status','pending']]),count('publisher_withdrawals',[['status','pending']])
 ]);
 const user=auth?.data?.user;
 if(!user){if(note)note.textContent='Sesi admin tidak aktif.';return;}
 const profile=await sb.from('profiles').select('role,is_banned').eq('id',user.id).maybeSingle();
 if(profile.error||profile.data?.role!=='admin'||profile.data?.is_banned){if(note)note.textContent='Akses ringkasan ditolak: akun admin diperlukan.';return;}
 const members=await count('profiles',[['role','user']]);
 const online=presence?.data?.online_members??null,guests=presence?.data?.guest_online??null;
 const pending=(affiliatePending===null&&publisherPending===null)?null:(Number(affiliatePending||0)+Number(publisherPending||0));
 root.innerHTML=[tile('Member','fa-solid fa-users',members,'Akun terdaftar'),tile('Member online','fa-solid fa-user-check',online,'Aktif dalam 2 menit terakhir'),tile('Pengunjung','fa-solid fa-user-clock',guests,'Tamu online tanpa login'),tile('Video','fa-solid fa-film',videoCount,'Video di katalog'),tile('Review Media','fa-solid fa-star',reviewCount,'Review tersimpan'),tile('Support','fa-solid fa-headset',supportCount,'Percakapan member'),tile('Withdraw pending','fa-solid fa-wallet',pending,'Affiliate + Publisher')].join('');
 const missing=[presence?.error?'Presence RPC':null,videoCount===null?'Video count':null,reviewCount===null?'Review count':null,supportCount===null?'Support count':null,members===null?'Member count':null].filter(Boolean);
 if(note)note.textContent=missing.length?`Sebagian statistik belum tersedia (${missing.join(', ')}). Pastikan migrasi dan izin admin/RLS sudah diterapkan.`:`Statistik berhasil diperbarui · ${new Date().toLocaleTimeString('id-ID')}`;
}
refresh?.addEventListener('click',()=>load().catch(e=>{if(note)note.textContent='Gagal memperbarui: '+(e.message||e)}));
load().catch(e=>{if(note)note.textContent='Gagal memuat ringkasan: '+(e.message||e)});
setInterval(()=>{if(document.visibilityState==='visible')load().catch(()=>{})},60000);
})();
