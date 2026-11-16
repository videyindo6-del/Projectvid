(()=>{'use strict';
const feed=document.getElementById('bcPostFeed');if(!feed||!window.sb)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const box=document.createElement('section');box.className='al-card';box.style.margin='18px 0';
box.innerHTML='<div class="al-head"><div><span class="al-kicker">AutoLink Publisher</span><h2>Semua AutoLink</h2><p>AutoLink publik dari seluruh member akan tampil di sini.</p></div><a class="al-btn" href="/autolink.html"><i class="fa-solid fa-plus"></i> Buat AutoLink</a></div><div id="alPostList" aria-live="polite"><span class="al-loading">Memuat daftar AutoLink...</span></div>';
feed.parentElement.insertBefore(box,feed);
const list=box.querySelector('#alPostList');
const copy=async v=>{try{await navigator.clipboard.writeText(v);return true;}catch(_){const x=document.createElement('textarea');x.value=v;document.body.appendChild(x);x.select();const ok=document.execCommand('copy');x.remove();return ok;}};
async function load(){
 list.textContent='Memuat daftar AutoLink...';
 try{
  const {data:{user}}=await sb.auth.getUser();
  const {data,error}=await sb.from('autolink_public').select('id,publisher_id,short_code,title,description,status,total_wif,created_at').eq('status','published').order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  const rows=data||[];
  list.innerHTML=rows.length?rows.map(a=>{const url=new URL('/z/'+encodeURIComponent(a.short_code),location.origin).href;return `<article style="padding:14px 0;border-bottom:1px solid var(--al-line)"><b>${esc(a.title)}</b><p style="color:var(--al-muted);margin:5px 0">${esc(a.description)}</p><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a><div class="al-actions"><button type="button" class="al-btn ghost" data-copy="${esc(url)}">Salin Link</button><span style="font-size:12px;color:var(--al-muted)">Dibuat ${new Date(a.created_at).toLocaleString('id-ID')} · ${Number(a.total_wif||0)} WIF</span>${a.publisher_id===user?.id?`<button class="al-btn ghost" data-edit="${a.id}">Edit</button> <button class="al-btn ghost" data-del="${a.id}">Hapus</button>`:''}</div></article>`;}).join(''):'<p>Belum ada AutoLink yang dipublikasikan.</p>';
  list.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{b.textContent=await copy(b.dataset.copy)?'Link disalin ✓':'Salin gagal';});
  list.querySelectorAll('[data-edit]').forEach(b=>b.onclick=async()=>{try{const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Silakan login ulang');const auth={authorization:'Bearer '+session.access_token};const details=await fetch('/api/autolink?action=edit-details&id='+encodeURIComponent(b.dataset.edit),{headers:auth}).then(r=>r.json());if(!details.success)throw Error(details.error||'Tidak dapat memuat AutoLink');const title=prompt('Judul AutoLink',details.autolink.title);if(title===null)return;const description=prompt('Deskripsi AutoLink',details.autolink.description||'');if(description===null)return;const target_url=prompt('Link asli',details.autolink.target_url);if(target_url===null)return;const r=await fetch('/api/autolink?action=update',{method:'POST',headers:{'content-type':'application/json',...auth},body:JSON.stringify({id:b.dataset.edit,title,description,target_url})});const d=await r.json();if(!r.ok)throw Error(d.error||'Gagal memperbarui');await load();}catch(e){alert(e.message||'Gagal memperbarui');}});
  list.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Hapus AutoLink ini?'))return;try{const {data:{session}}=await sb.auth.getSession();const r=await fetch('/api/autolink?action=delete',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({id:b.dataset.del})});const d=await r.json();if(!r.ok)throw Error(d.error||'Gagal menghapus');await load();}catch(e){alert(e.message||'Gagal menghapus');}});
 }catch(error){console.error('Load AutoLink posts failed:',error);list.innerHTML=`<p class="al-alert error">AutoLink belum dapat dimuat: ${esc(error.message||'Periksa koneksi dan jalankan migration AutoLink.')}</p>`;}
}
load();
})();
