const g=document.getElementById('reviewGrid'),pager=document.getElementById('reviewPagination');let page=1;
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function reviewThumb(item){
  const raw=typeof item==='string'?item:(item?.thumbnail_url||item?.url||item?.src||'');
  if(!raw)return '';
  const iframe=raw.match(/<iframe[^>]+src=["']([^"']+)/i);const value=iframe?iframe[1]:raw;
  try{
    const u=new URL(value,location.origin);
    if(!['http:','https:'].includes(u.protocol))return '';
    if(/drive\.google\.com$/i.test(u.hostname)){const id=u.pathname.match(/\/file\/d\/([^/]+)/)?.[1]||u.searchParams.get('id');if(id)return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w900`;}
    if(/youtube\.com|youtu\.be/i.test(u.hostname)){const id=u.hostname==='youtu.be'?u.pathname.split('/').filter(Boolean)[0]:(u.searchParams.get('v')||u.pathname.match(/\/embed\/([^/]+)/)?.[1]);if(id)return `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;}
    if(/videy\.co$/i.test(u.hostname)){const id=u.searchParams.get('id')||u.pathname.match(/\/v\/([^/]+)/)?.[1];if(id)return `https://cdn.videy.co/${encodeURIComponent(id)}.jpg`;}
    if(/\.(mp4|webm|m3u8)(?:$|\?)/i.test(value)){const id=u.pathname.split('/').pop().replace(/\.(mp4|webm|m3u8)$/i,'');if(/cdn\.videy\.co$/i.test(u.hostname))return `https://cdn.videy.co/${encodeURIComponent(id)}.jpg`;return '';}
    return value;
  }catch{return '';}
}
async function load(){
 const {data,error,count}=await sb.from('review_items').select('id,slug,title,description,thumbnail_url,gallery_urls,price,access',{count:'exact'}).eq('status','published').order('created_at',{ascending:false}).range((page-1)*12,page*12-1);
 if(error){g.textContent=error.message;return}
 g.innerHTML=(data||[]).map(x=>{
  let gallery=x.gallery_urls||[];if(typeof gallery==='string'){try{gallery=JSON.parse(gallery)}catch{gallery=[gallery]}}
  const candidates=[reviewThumb(x.thumbnail_url),...(Array.isArray(gallery)?gallery.map(reviewThumb):[])].filter((v,i,a)=>v&&a.indexOf(v)===i);
  const img=candidates.length?`<img src="${esc(candidates[0])}" data-candidates="${esc(JSON.stringify(candidates))}" data-index="0" alt="${esc(x.title)}" loading="lazy" onerror="(function(el){let a=JSON.parse(el.dataset.candidates||'[]'),n=+el.dataset.index+1;if(n<a.length){el.dataset.index=n;el.src=a[n]}else{el.remove();el.parentElement.classList.add('review-thumb-fallback')}})(this)">`:'<div class="ad-banner review-thumb-fallback"><i class="fa-solid fa-images"></i> REVIEW</div>';
  return `<a class="video-card" href="/r/${encodeURIComponent(x.slug)}">${img}<div><b>${esc(x.title)}</b><p>${esc(x.description).slice(0,110)}</p><small>${x.access==='paid'?'Rp '+Number(x.price).toLocaleString('id-ID'):'Gratis'}</small></div></a>`;
 }).join('')||'<p>Belum ada review.</p>';
 pager.innerHTML='';for(let n=1;n<=Math.ceil((count||0)/12);n++){const b=document.createElement('button');b.textContent=n;b.disabled=n===page;b.onclick=()=>{page=n;load()};pager.append(b)}
}
load();