import { sb } from '../js/config.js';
import { mountNavbar } from '../components/navbar.js';
mountNavbar('telegram');
const gridT=document.getElementById('telegramGrid');
const esc=s=>String(s??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function loadT(){
 const {data,error}=await sb.from('telegram_items').select('id,title,type,review_embed_url,price,categories(name)').eq('status','published').order('created_at',{ascending:false});
 if(error){gridT.innerHTML='<div class="empty">Gagal memuat konten: '+esc(error.message)+'</div>';return}
 gridT.innerHTML=(data||[]).map(x=>`<article class="media-card"><div class="media-thumb">${x.type==='paid'?'▶':'↓'}</div><div class="media-body"><h3>${esc(x.title)}</h3><p>${x.type==='paid'?'Paid · Rp '+Number(x.price).toLocaleString('id-ID'):'Free · langsung download'}</p><div class="row"><span class="pill ${x.type==='paid'?'orange':'green'}">${esc(x.type.toUpperCase())}</span><a class="btn primary" href="watch.html?telegram=${encodeURIComponent(x.id)}">${x.type==='paid'?'Lihat detail':'Download'}</a></div></div></article>`).join('')||'<div class="empty">Belum ada konten.</div>';
}
loadT();
