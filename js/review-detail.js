const box=document.getElementById('reviewDetail');
function getRouteCode(prefix){
 const params=new URLSearchParams(location.search);
 const fromQuery=params.get('slug')||params.get('code')||'';
 if(fromQuery.trim())return fromQuery.trim();
 const parts=location.pathname.split('/').filter(Boolean);
 const prefixIndex=parts.findIndex(p=>p.toLowerCase()===prefix);
 if(prefixIndex<0||!parts[prefixIndex+1])return '';
 try{return decodeURIComponent(parts[prefixIndex+1]).trim()}catch{return parts[prefixIndex+1].trim()}
}
const slug=getRouteCode('r');
const rp=n=>'Rp '+Number(n||0).toLocaleString('id-ID');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
 if(!slug){box.innerHTML='<h1>Kode review tidak terbaca</h1><p>Pastikan URL berbentuk /r/KODE_REVIEW dan file _redirects terbaru sudah terpasang.</p>';return}
 try{
  let {data:v,error:queryError}=await sb.from('review_items').select('id,slug,title,description,thumbnail_url,price,access,created_at').eq('slug',slug).maybeSingle();
  if(!queryError&&!v){const alt=await sb.from('review_items').select('id,slug,title,description,thumbnail_url,price,access,created_at').ilike('slug',slug).maybeSingle();v=alt.data;queryError=alt.error;}
  if(queryError){box.innerHTML=`<h1>Gagal memuat review</h1><p>${esc(queryError.message)}</p><p>Periksa izin SELECT dan policy RLS tabel review_items di Supabase.</p>`;return}
  if(!v){const r=await sb.from('review_items').select('id,slug,title,description,thumbnail_url,price,access,created_at').eq('id',slug).maybeSingle();v=r.data}
  if(!v){box.innerHTML=`<h1>Review tidak ditemukan</h1><p>Kode yang dicari: <b>${esc(slug)}</b>. Pastikan slug benar dan status review adalah published.</p>`;return}
  // Kolom tambahan dan RPC bersifat opsional; kegagalannya tidak boleh memblokir halaman.
  const [extra]=await Promise.all([sb.from('review_items').select('gallery_urls,view_count').eq('id',v.id).maybeSingle().then(r=>r.error?null:r.data).catch(()=>null),sb.rpc('increment_review_view',{p_review_id:v.id}).catch(()=>null)]);
  v.gallery_urls=extra?.gallery_urls||[];v.view_count=extra?.view_count||0;
  const imgs=Array.isArray(v.gallery_urls)?v.gallery_urls:[];box.innerHTML=`<span class="eyebrow">REVIEW GALLERY</span><h1>${esc(v.title)}</h1><div class="review-gallery">${(imgs.length?imgs:[v.thumbnail_url].filter(Boolean)).map((u,i)=>`<img src="${esc(u)}" alt="${esc(v.title)} — gambar ${i+1}" loading="lazy" data-full="${esc(u)}">`).join('')||'<div class="ad-banner">Belum ada gambar review</div>'}</div><div class="review-viewer" id="reviewViewer" hidden><button type="button" class="viewer-close" aria-label="Tutup">×</button><img alt="Pratinjau gambar"></div><p>${esc(v.description)}</p><div class="watch-meta"><span>${Number(v.view_count||0)+1} views</span><span>Publish ${new Date(v.created_at).toLocaleDateString('id-ID')}</span></div><a class="btn primary" href="/d/${encodeURIComponent(v.slug)}">${v.access==='paid'?'Download / Beli '+rp(v.price):'Download'}</a>`;box.querySelectorAll('.review-gallery img').forEach(img=>img.addEventListener('click',()=>openViewer(img.dataset.full||img.src)));
const viewer=document.getElementById('reviewViewer'),viewerImg=viewer.querySelector('img');let scale=1,drag=false,startX=0,startY=0,tx=0,ty=0;
function render(){viewerImg.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`}
function openViewer(src){viewer.hidden=false;viewerImg.src=src;scale=1;tx=0;ty=0;render()}
viewer.querySelector('.viewer-close').onclick=()=>viewer.hidden=true;
viewer.onclick=e=>{if(e.target===viewer)viewer.hidden=true};
viewerImg.onwheel=e=>{e.preventDefault();scale=Math.min(5,Math.max(1,scale+(e.deltaY<0?.15:-.15)));render()};
viewerImg.onpointerdown=e=>{drag=true;startX=e.clientX-tx;startY=e.clientY-ty;viewerImg.setPointerCapture(e.pointerId)};
viewerImg.onpointermove=e=>{if(!drag)return;tx=e.clientX-startX;ty=e.clientY-startY;render()};
viewerImg.onpointerup=()=>drag=false;
loadMore(v.id);
 }catch(e){box.innerHTML=`<h1>Terjadi kesalahan</h1><p>${esc(e.message||e)}</p><p>Muat ulang halaman. Jika masih gagal, periksa koneksi Supabase dan izin tabel review_items.</p>`}
}
async function loadMore(id){const {data}=await sb.from('review_items').select('slug,title,thumbnail_url,price,access').eq('status','published').neq('id',id).order('created_at',{ascending:false}).limit(12);document.getElementById('moreReviews').innerHTML=(data||[]).map(x=>`<a class="video-card" href="/r/${esc(x.slug)}">${x.thumbnail_url?`<img src="${esc(x.thumbnail_url)}">`:''}<div><b>${esc(x.title)}</b><small style="display:block">${x.access==='paid'?rp(x.price):'Gratis'}</small></div></a>`).join('')}load();
