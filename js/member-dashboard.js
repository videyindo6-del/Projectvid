(() => {
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v||0).toLocaleString('id-ID');
  const rp=v=>'Rp '+Number(v||0).toLocaleString('id-ID');
  const thumb=(url,title,icon='fa-play')=>url
    ?`<img class="media-thumb" src="${esc(url)}" alt="${esc(title)}" loading="lazy" onerror="this.onerror=null;this.src='';this.parentElement.classList.add('thumb-fallback')">`
    :`<div class="media-thumb thumb-fallback"><i class="fa-solid ${icon}"></i></div>`;
  const empty=t=>`<div class="member-empty"><i class="fa-regular fa-folder-open"></i><b>${t}</b><span>Konten akan tampil setelah dipublikasikan admin.</span></div>`;
  const stat=(icon,val,label)=>`<span><i class="fa-solid ${icon}"></i><b>${n(val)}</b><small>${label}</small></span>`;
  function videoCard(v,stats={}){
    const href=v.slug?`/v/${encodeURIComponent(v.slug)}`:`/watch.html?id=${encodeURIComponent(v.id)}`;
    return `<article class="member-media-card"><a class="member-media-cover" href="${href}">${thumb(v.thumbnail_url,v.title)}<span class="media-kind">BOXVIDEY</span></a><div class="member-media-body"><h3><a href="${href}">${esc(v.title||'Video tanpa judul')}</a></h3><div class="member-media-stats">${stat('fa-eye',v.view_count,'View')}${stat('fa-heart',stats.total_likes,'Like')}${stat('fa-comment',stats.total_comments,'Komentar')}${stat('fa-share-nodes',stats.total_shares,'Share')}</div></div></article>`;
  }
  function reviewCard(r,s={}){
    const gallery=Array.isArray(r.gallery_urls)?r.gallery_urls:[];
    const galleryThumb=gallery.map(x=>typeof x==='string'?x:(x?.url||x?.src||x?.thumbnail_url||'')).find(Boolean);
    const href=`/r/${encodeURIComponent(r.slug||'')}`;
    return `<article class="member-media-card"><a class="member-media-cover" href="${href}">${thumb(r.thumbnail_url||galleryThumb,r.title,'fa-brands fa-telegram')}<span class="media-kind telegram-kind">MEDIA TELEGRAM</span></a><div class="member-media-body"><div class="media-price-row"><span>${r.access==='free'?'GRATIS':'REVIEW MEDIA'}</span><b>${r.access==='free'?'Gratis':rp(r.price)}</b></div><h3><a href="${href}">${esc(r.title||'Review tanpa judul')}</a></h3><p class="media-description">${esc(r.description||'Lihat detail media dan informasi pembelian.')}</p><div class="member-media-stats">${stat('fa-bag-shopping',s.total_sold,'Terjual')}${stat('fa-heart',s.total_likes,'Like')}${stat('fa-comment',s.total_comments,'Komentar')}${stat('fa-share-nodes',s.total_shares,'Share')}</div><a class="member-card-link" href="${href}">Lihat review <i class="fa-solid fa-arrow-right"></i></a></div></article>`;
  }
  async function init(){
    if(!window.sb){$('latestVideos').innerHTML=empty('Layanan belum tersedia');return}
    const {data:{user}}=await sb.auth.getUser();
    if(!user){location.replace('/login.html?next='+encodeURIComponent('/dashboard.html'));return}
    const {data:p}=await sb.from('profiles').select('full_name,role,is_banned').eq('id',user.id).maybeSingle();
    if(p?.is_banned){await sb.auth.signOut();location.replace('/login.html');return}
    await sb.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',user.id);
    const {data:ann}=await sb.from('announcements').select('title,body').eq('active',true).order('created_at',{ascending:false}).limit(1);
    if(ann?.[0]){$('announcement').querySelector('h2').textContent=ann[0].title;$('announcement').querySelector('p').textContent=ann[0].body}
    const {data:cats}=await sb.from('categories').select('id,name').eq('status','published').order('name');
    $('boxCategories').innerHTML=(cats||[]).map(c=>`<a class="cat-card" href="/index.html?category=${encodeURIComponent(c.id)}"><i class="fa-solid fa-layer-group"></i><b>${esc(c.name)}</b><span>Jelajahi BoxVidey</span></a>`).join('')||empty('Belum ada kategori');
    $('telegramCategories').innerHTML=`<a class="cat-card" href="/telegram.html"><i class="fa-brands fa-telegram"></i><b>Semua Media Telegram</b><span>Review, detail dan akses media</span></a>`+(cats||[]).map(c=>`<a class="cat-card" href="/telegram.html?category=${encodeURIComponent(c.id)}"><i class="fa-solid fa-folder-open"></i><b>${esc(c.name)}</b><span>Media Telegram</span></a>`).join('');
    const {data:videos,error:ve}=await sb.from('videos').select('id,slug,title,thumbnail_url,view_count,access,created_at').eq('status','published').order('created_at',{ascending:false}).limit(12);
    if(ve)console.warn('Dashboard videos:',ve.message);
    const videoIds=(videos||[]).map(v=>v.id);
    let vstats=new Map();
    if(videoIds.length){const {data}=await sb.rpc('get_public_video_stats',{p_video_ids:videoIds});(data||[]).forEach(x=>vstats.set(x.video_id,x))}
    $('latestVideos').innerHTML=(videos||[]).map(v=>videoCard(v,vstats.get(v.id)||{})).join('')||empty('Belum ada BoxVidey');
    $('vipVideos').innerHTML=(videos||[]).filter(v=>v.access==='vip').slice(0,6).map(v=>`<a class="mini-card" href="/v/${encodeURIComponent(v.slug||'')}">${thumb(v.thumbnail_url,v.title,'fa-crown')}<b>${esc(v.title)}</b><span><i class="fa-solid fa-eye"></i> ${n(v.view_count)} views</span></a>`).join('')||`<a class="mini-card" href="/vip.html"><i class="fa-solid fa-crown"></i><b>Jelajahi VIP</b><span>Akses konten khusus member</span></a>`;
    const {data:reviews,error:re}=await sb.from('review_items').select('id,slug,title,description,thumbnail_url,gallery_urls,price,access,view_count,created_at').eq('status','published').order('created_at',{ascending:false}).limit(12);
    if(re)console.warn('Dashboard Telegram media:',re.message);
    let rstats=new Map();
    if(reviews?.length){const {data,error}=await sb.rpc('get_public_review_stats');if(!error)(data||[]).forEach(x=>rstats.set(x.review_id,x));else console.warn('Review stats:',error.message)}
    $('reviews').innerHTML=(reviews||[]).map(r=>reviewCard(r,rstats.get(r.id)||{})).join('')||empty('Belum ada media Telegram');
    $('topTelegram').innerHTML=[...(reviews||[])].sort((a,b)=>Number(rstats.get(b.id)?.total_sold||0)-Number(rstats.get(a.id)?.total_sold||0)).slice(0,10).map(r=>`<a class="mini-card" href="/r/${encodeURIComponent(r.slug||'')}">${thumb(r.thumbnail_url||galleryThumb,r.title,'fa-brands fa-telegram')}<b>${esc(r.title)}</b><span>${n(rstats.get(r.id)?.total_sold)} terjual</span></a>`).join('')||empty('Belum ada media');
    $('topBox').innerHTML=[...(videos||[])].sort((a,b)=>Number(b.view_count||0)-Number(a.view_count||0)).slice(0,10).map(v=>`<a class="mini-card" href="/v/${encodeURIComponent(v.slug||'')}">${thumb(v.thumbnail_url,v.title)}<b>${esc(v.title)}</b><span>${n(v.view_count)} views</span></a>`).join('')||empty('Belum ada video');
  }
  init().catch(e=>{console.error(e);document.querySelectorAll('#latestVideos,#reviews').forEach(x=>x.innerHTML=empty('Gagal memuat konten'))});
})();