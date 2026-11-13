const form=document.getElementById('videoForm');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const embedInput=form?.elements.embed_url;
const providerInput=form?.elements.provider;
const preview=document.getElementById('videoEmbedPreview');
const hint=document.getElementById('embedProviderHint');
let saving=false;

async function guardAdmin(){
  const {data:{user},error:authError}=await sb.auth.getUser();
  if(authError||!user){location.href='login.html';return false;}
  const {data:p,error}=await sb.from('profiles').select('role').eq('id',user.id).single();
  if(error||p?.role!=='admin'){location.href='/';return false;}
  document.getElementById('adminEmail').textContent=user.email||'';
  return true;
}
function renderEmbedPreview(){
  if(!preview||!embedInput)return;
  const info=window.ProjectVIDEmbed?.parse(embedInput.value);
  if(!info){preview.innerHTML='';providerInput.value='';if(hint)hint.textContent='Tempel URL atau kode iframe yang valid.';return;}
  providerInput.value=info.provider||'External';
  if(hint)hint.textContent=info.type==='link'?`${info.provider}: link berbagi terdeteksi. Untuk pemutaran langsung, tempel URL embed resmi atau kode iframe.`:`Provider terdeteksi: ${info.provider} · Tipe: ${info.type}`;
  if(info.type==='iframe')preview.innerHTML=`<div class="admin-note"><b>Preview ${esc(info.provider)}</b><iframe src="${esc(info.src)}" title="Preview embed" loading="lazy" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen style="width:100%;height:320px;border:0;border-radius:12px"></iframe></div>`;
  else if(info.type==='video')preview.innerHTML=`<div class="admin-note"><b>Preview ${esc(info.provider)}</b><video src="${esc(info.src)}" controls playsinline preload="metadata" style="width:100%;max-height:360px"></video></div>`;
  else if(info.type==='audio')preview.innerHTML=`<div class="admin-note"><b>Preview ${esc(info.provider)}</b><audio src="${esc(info.src)}" controls></audio></div>`;
  else if(info.type==='image')preview.innerHTML=`<div class="admin-note"><b>Preview ${esc(info.provider)}</b><img src="${esc(info.src)}" alt="Preview" style="max-width:100%;max-height:280px;object-fit:contain"></div>`;
  else preview.innerHTML=`<div class="admin-note"><b>${esc(info.provider)}</b><p>Link ini belum berupa player embed. Gunakan tombol Embed/Bagikan dari provider lalu tempel kode iframe-nya.</p><a href="${esc(info.src)}" target="_blank" rel="noopener noreferrer">Buka sumber asli ↗</a></div>`;
}
async function load(){
  if(!await guardAdmin())return;
  const box=document.getElementById('videoAdmin');
  const {data,error}=await sb.from('videos').select('id,title,slug,provider,access_scope,download_enabled,status').order('created_at',{ascending:false});
  if(error){box.textContent=error.message;return;}
  box.innerHTML='<table class="table"><thead><tr><th>Judul</th><th>URL</th><th>Provider</th><th>Akses</th><th>Download</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+(data||[]).map(v=>`<tr><td>${esc(v.title)}</td><td><a href="/v/${encodeURIComponent(v.slug)}" target="_blank" rel="noopener">/v/${esc(v.slug)}</a></td><td>${esc(v.provider)}</td><td>${esc(v.access_scope)}</td><td>${v.download_enabled?'ON':'OFF'}</td><td>${esc(v.status)}</td><td><button class="btn" data-delete="${esc(v.id)}">Hapus</button></td></tr>`).join('')+'</tbody></table>';
  box.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>deleteVideo(btn.dataset.delete)));
}
async function deleteVideo(id){
  if(!confirm('Hapus video ini secara permanen? Data like, komentar, dan riwayat tontonan terkait juga akan dihapus.'))return;
  const {data,error}=await sb.from('videos').delete().eq('id',id).select('id').maybeSingle();
  if(error){alert('Gagal menghapus video: '+error.message);return;}
  if(!data){alert('Video tidak ditemukan atau akses admin ditolak.');return;}
  document.getElementById('videoMessage').textContent='Video berhasil dihapus.';await load();
}
window.deleteVideo=deleteVideo;

document.getElementById('addVideo')?.addEventListener('click',async()=>{
  form.style.display='grid';
  const {data,error}=await sb.from('categories').select('id,name').eq('status','published').eq('content_type','box_video');
  if(error){document.getElementById('videoMessage').textContent='Kategori gagal dimuat: '+error.message;return;}
  document.getElementById('videoCategory').innerHTML='<option value="">Pilih kategori</option>'+(data||[]).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
});
document.getElementById('cancelVideo')?.addEventListener('click',()=>{form.style.display='none';form.reset();renderEmbedPreview();});
embedInput?.addEventListener('input',renderEmbedPreview);
form?.addEventListener('submit',async e=>{
  e.preventDefault();if(saving)return;
  const f=new FormData(form),v=Object.fromEntries(f.entries());
  const info=window.ProjectVIDEmbed?.parse(v.embed_url);
  if(!info){document.getElementById('videoMessage').textContent='URL atau kode embed tidak valid. Gunakan HTTP/HTTPS.';return;}
  if(info.type==='link'){document.getElementById('videoMessage').textContent=`${info.provider} memerlukan URL embed resmi atau kode iframe, bukan sekadar link berbagi.`;return;}
  if(!['iframe','video'].includes(info.type)){document.getElementById('videoMessage').textContent='Sumber harus berupa player video atau video langsung.';return;}
  saving=true;const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
  try{
    const slug=crypto.randomUUID().replaceAll('-','').slice(0,8);
    const payload={title:v.title,provider:info.provider||v.provider||'External',embed_url:info.src,thumbnail_url:v.thumbnail_url||null,orientation:v.orientation||'auto',category_id:v.category_id||null,access:v.access_scope==='vip'?'vip':'public',access_scope:v.access_scope,download_enabled:f.has('download_enabled'),download_url:v.download_url||null,status:v.status,slug};
    const {error}=await sb.from('videos').insert(payload);
    if(error)throw error;
    document.getElementById('videoMessage').textContent='Video berhasil disimpan. URL: /v/'+slug;
    form.reset();form.style.display='none';renderEmbedPreview();await load();
  }catch(error){document.getElementById('videoMessage').textContent='Gagal menyimpan video: '+(error.message||error);}
  finally{saving=false;if(submit)submit.disabled=false;}
});
document.getElementById('logout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.href='login.html';});
load();

document.getElementById('addVideoCategory')?.addEventListener('click',async()=>{
  const name=prompt('Nama kategori Box Video baru:');if(name===null)return;if(!name.trim())return alert('Nama kategori wajib diisi.');
  const {data,error}=await sb.from('categories').insert({name:name.trim(),status:'published',content_type:'box_video'}).select('id,name').single();
  if(error){alert('Gagal membuat kategori: '+error.message);return;}
  const select=document.getElementById('videoCategory');const option=new Option(data.name,data.id,true,true);select.add(option);
});
