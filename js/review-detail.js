
const box = document.getElementById('reviewDetail');

function getRouteCode(prefix) {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('slug') || params.get('code') || '';
  if (fromQuery.trim()) return fromQuery.trim();

  const parts = location.pathname.split('/').filter(Boolean);
  const index = parts.findIndex(p => p.toLowerCase() === prefix.toLowerCase());
  if (index < 0 || !parts[index + 1]) return '';

  try {
    return decodeURIComponent(parts[index + 1]).trim();
  } catch {
    return parts[index + 1].trim();
  }
}

const slug = getRouteCode('r');
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

function showError(title, message) {
  if (!box) return;
  box.innerHTML = `<h1>${esc(title)}</h1><p>${esc(message)}</p>`;
}

// =====================================================
// GOOGLE DRIVE / EMBED URL HANDLER
// =====================================================

function extractEmbedSource(value) {
  let raw = String(value ?? '').trim();
  if (!raw) return '';

  // Jika database menyimpan kode iframe HTML.
  if (/<iframe[\s>]/i.test(raw)) {
    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      raw = doc.querySelector('iframe')?.getAttribute('src') || '';
    } catch {
      return '';
    }
  }

  // Tolak javascript:, data:, dan URL berbahaya.
  try {
    const parsed = new URL(raw, location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function getDriveId(url) {
  const raw = extractEmbedSource(url);
  if (!raw) return '';

  try {
    const u = new URL(raw);
    if (!/(^|\.)drive\.google\.com$/i.test(u.hostname)) return '';

    const patterns = [
      /\/file\/d\/([^/]+)/i,
      /\/document\/d\/([^/]+)/i,
      /\/spreadsheets\/d\/([^/]+)/i,
      /\/presentation\/d\/([^/]+)/i
    ];

    for (const pattern of patterns) {
      const match = u.pathname.match(pattern);
      if (match) return match[1];
    }

    return u.searchParams.get('id') || '';
  } catch {
    return '';
  }
}

function getEmbedInfo(value) {
  const raw = extractEmbedSource(value);
  if (!raw) return null;

  const driveId = getDriveId(raw);

  if (driveId) {
    return {
      type: 'iframe',
      src: `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`,
      original: raw,
      isDrive: true
    };
  }

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();

    // URL embed yang memang sudah berupa iframe.
    if (
      host === 'drive.google.com' ||
      host === 'docs.google.com'
    ) {
      return {
        type: 'iframe',
        src: raw,
        original: raw,
        isDrive: true
      };
    }

    // Embed video YouTube.
    if (host.includes('youtube.com') || host === 'youtu.be') {
      let id = '';

      if (host === 'youtu.be') {
        id = u.pathname.split('/').filter(Boolean)[0] || '';
      } else {
        id = u.searchParams.get('v') || '';
        if (!id) {
          const match = u.pathname.match(/\/embed\/([^/]+)/);
          if (match) id = match[1];
        }
      }

      if (id) {
        return {
          type: 'iframe',
          src: `https://www.youtube.com/embed/${encodeURIComponent(id)}`,
          original: raw,
          isDrive: false
        };
      }
    }

    return {
      type: 'image',
      src: raw,
      original: raw,
      isDrive: false
    };
  } catch {
    return null;
  }
}

function normalizeGalleryItem(item) {
  if (typeof item === 'string') return item;

  if (item && typeof item === 'object') {
    return item.url ||
      item.src ||
      item.embed_url ||
      item.embed ||
      item.thumbnail_url ||
      '';
  }

  return '';
}

function normalizeGallery(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeGalleryItem).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeGalleryItem).filter(Boolean);
      }
      if (typeof parsed === 'string') return [parsed];
    } catch {
      return [value.trim()];
    }
  }

  return [];
}

// =====================================================
// REVIEW VIEW COUNT
// =====================================================

async function incrementReviewView(id) {
  try {
    if (!sb || typeof sb.rpc !== 'function') return;

    await sb.rpc('increment_review_view', {
      p_review_id: id
    });
  } catch (error) {
    console.warn('Increment review view gagal:', error);
  }
}

// =====================================================
// LOAD EXTRA DATA
// =====================================================

async function getReviewExtra(id) {
  try {
    const result = await sb
      .from('review_items')
      .select('gallery_urls,view_count')
      .eq('id', id)
      .maybeSingle();

    if (result.error) {
      console.warn('Data tambahan review:', result.error);
      return null;
    }

    return result.data || null;
  } catch (error) {
    console.warn('Gagal mengambil data tambahan:', error);
    return null;
  }
}

// =====================================================
// GALLERY HTML
// =====================================================

function renderGallery(items, title) {
  if (!items.length) {
    return '<div class="ad-banner">Belum ada gambar review</div>';
  }

  return `<div class="review-gallery-track" id="reviewGalleryTrack">${items.map((item, index) => {
    const info = getEmbedInfo(item);

    if (!info) {
      return `
        <div class="review-gallery-error">
          <p>Gambar ${index + 1} tidak dapat dibaca.</p>
        </div>
      `;
    }

    if (info.type === 'iframe') {
      return `
        <div class="review-gallery-item review-gallery-embed">
          <iframe
            src="${esc(info.src)}"
            title="${esc(title)} - gambar ${index + 1}"
            loading="lazy"
            allow="autoplay; fullscreen"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
          <a
            class="review-open-original"
            href="${esc(info.original)}"
            target="_blank"
            rel="noopener noreferrer"
          >Buka embed asli ↗</a>
        </div>
      `;
    }

    return `
      <div class="review-gallery-item">
        <img
          src="${esc(info.src)}"
          alt="${esc(title)} - gambar ${index + 1}"
          loading="lazy"
          data-full="${esc(info.src)}"
          onerror="this.closest('.review-gallery-item').classList.add('image-failed')"
        >
        <div class="review-image-fallback">
          <span>Gambar gagal dimuat</span>
          <a href="${esc(info.original)}" target="_blank" rel="noopener noreferrer">
            Buka gambar ↗
          </a>
        </div>
      </div>
    `;
  }).join('')}</div><div class="gallery-controls"><button type="button" id="galleryPrev" aria-label="Sebelumnya"><i class="fa-solid fa-chevron-left"></i></button><span id="galleryCounter">1 / ${items.length}</span><button type="button" id="galleryNext" aria-label="Berikutnya"><i class="fa-solid fa-chevron-right"></i></button></div>`;
}

// =====================================================
// GALLERY VIEWER FOR NORMAL IMAGES
// =====================================================

function setupGalleryViewer() {
  const viewer = document.getElementById('reviewViewer');
  const viewerImg = viewer?.querySelector('img');
  if (!viewer || !viewerImg) return;

  let scale = 1;
  let drag = false;
  let startX = 0;
  let startY = 0;
  let tx = 0;
  let ty = 0;

  function render() {
    viewerImg.style.transform =
      `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function open(src) {
    viewer.hidden = false;
    viewerImg.src = src;
    scale = 1;
    tx = 0;
    ty = 0;
    render();
  }

  box.querySelectorAll('.review-gallery img[data-full]').forEach(img => {
    img.addEventListener('click', () => {
      if (!img.closest('.review-gallery-item')?.classList.contains('image-failed')) {
        open(img.dataset.full || img.src);
      }
    });
  });

  viewer.querySelector('.viewer-close').onclick = () => {
    viewer.hidden = true;
    viewerImg.src = '';
  };

  viewer.onclick = e => {
    if (e.target === viewer) {
      viewer.hidden = true;
      viewerImg.src = '';
    }
  };

  viewerImg.onwheel = e => {
    e.preventDefault();
    scale = Math.min(5, Math.max(1, scale + (e.deltaY < 0 ? 0.15 : -0.15)));
    render();
  };

  viewerImg.onpointerdown = e => {
    if (scale <= 1) return;
    drag = true;
    startX = e.clientX - tx;
    startY = e.clientY - ty;
    viewerImg.setPointerCapture(e.pointerId);
  };

  viewerImg.onpointermove = e => {
    if (!drag) return;
    tx = e.clientX - startX;
    ty = e.clientY - startY;
    render();
  };

  viewerImg.onpointerup = () => drag = false;
  viewerImg.onpointercancel = () => drag = false;
}


// =====================================================
// GALLERY CONTROLS + SOCIAL INTERACTIONS
// =====================================================
function setupGalleryControls(){
  const track=document.getElementById('reviewGalleryTrack');
  if(!track)return;
  const counter=document.getElementById('galleryCounter');
  const items=[...track.children];
  const update=()=>{const width=track.clientWidth||1;const index=Math.min(items.length,Math.max(1,Math.round(track.scrollLeft/width)+1));if(counter)counter.textContent=`${index} / ${items.length}`;};
  document.getElementById('galleryPrev')?.addEventListener('click',()=>track.scrollBy({left:-track.clientWidth,behavior:'smooth'}));
  document.getElementById('galleryNext')?.addEventListener('click',()=>track.scrollBy({left:track.clientWidth,behavior:'smooth'}));
  track.addEventListener('scroll',update,{passive:true});
  let sx=0;track.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true});
}
async function ensureReviewUser(){
  const {data:{user}}=await sb.auth.getUser();
  if(user)return user;
  const {data,error}=await sb.auth.signInAnonymously();
  if(error)throw error;
  return data.user;
}
async function setupReviewSocial(reviewId,title){
  const likeBtn=document.getElementById('reviewLike'),commentForm=document.getElementById('reviewCommentForm');
  const commentBox=document.getElementById('reviewComments');
  const loadSocial=async()=>{
    const [likes,comments]=await Promise.all([
      sb.from('review_likes').select('id,user_id',{count:'exact'}).eq('review_id',reviewId),
      sb.from('review_comments').select('id,content,created_at,user_id').eq('review_id',reviewId).eq('is_hidden',false).order('created_at',{ascending:false}).limit(30)
    ]);
    if(!likes.error){document.getElementById('reviewLikeCount').textContent=likes.count??(likes.data||[]).length;const {data:{user}}=await sb.auth.getUser();const mine=(likes.data||[]).some(x=>x.user_id===user?.id);likeBtn.classList.toggle('is-liked',mine);likeBtn.querySelector('i').className=mine?'fa-solid fa-heart':'fa-regular fa-heart';}
    if(comments.error){commentBox.innerHTML='<div class="comment-empty">Komentar belum tersedia. Admin perlu memasang migration interaksi review.</div>';document.getElementById('commentCount').textContent='0 komentar';return;}
    const rows=comments.data||[];document.getElementById('commentCount').textContent=`${rows.length} komentar`;
    commentBox.innerHTML=rows.length?rows.map(c=>`<article class="review-comment"><div class="comment-avatar"><i class="fa-solid fa-user"></i></div><div><div class="comment-meta"><b>${c.user_id?'Member BoxCellink':'Pengunjung'}</b><time>${new Date(c.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</time></div><p>${esc(c.content)}</p></div></article>`).join(''):'<div class="comment-empty">Belum ada komentar. Jadilah yang pertama berkomentar.</div>';
  };
  await loadSocial();
  likeBtn?.addEventListener('click',async()=>{
    likeBtn.disabled=true;
    try{const user=await ensureReviewUser();const {data:existing}=await sb.from('review_likes').select('id').eq('review_id',reviewId).eq('user_id',user.id).maybeSingle();if(existing)await sb.from('review_likes').delete().eq('id',existing.id);else{const {error}=await sb.from('review_likes').insert({review_id:reviewId,user_id:user.id});if(error)throw error;}await loadSocial();}catch(e){alert('Like belum dapat diproses. Pastikan migration interaksi review sudah dijalankan.');}finally{likeBtn.disabled=false;}
  });
  document.getElementById('reviewCommentJump')?.addEventListener('click',()=>document.getElementById('reviewCommentInput')?.focus());
  document.getElementById('reviewShare')?.addEventListener('click',async()=>{
    const shareData={title,url:location.href,text:title};
    try{if(navigator.share){await navigator.share(shareData);await sb.rpc('increment_review_share',{p_review_id:reviewId})}else{await navigator.clipboard.writeText(location.href);await sb.rpc('increment_review_share',{p_review_id:reviewId});const b=document.getElementById('reviewShare');b.querySelector('span').textContent='Link tersalin';setTimeout(()=>b.querySelector('span').textContent='Bagikan',1800);}}catch(e){if(e.name!=='AbortError')alert('Tidak dapat membagikan link.');}
  });
  commentForm?.addEventListener('submit',async e=>{
    e.preventDefault();const input=document.getElementById('reviewCommentInput'),button=commentForm.querySelector('button'),content=input.value.trim();if(!content)return;
    button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
    try{const user=await ensureReviewUser();const {error}=await sb.from('review_comments').insert({review_id:reviewId,user_id:user.id,content});if(error)throw error;input.value='';await loadSocial();}catch(err){alert('Komentar gagal dikirim. Pastikan migration interaksi review sudah dijalankan.');}finally{button.disabled=false;button.innerHTML='<i class="fa-regular fa-paper-plane"></i> Kirim komentar';}
  });
}

// =====================================================
// MAIN REVIEW
// =====================================================

async function load() {
  if (!box) {
    console.error('Elemen reviewDetail tidak ditemukan.');
    return;
  }

  if (!slug) {
    showError('Kode review tidak terbaca', 'Pastikan URL berbentuk /r/KODE_REVIEW.');
    return;
  }

  if (typeof sb === 'undefined' || !sb) {
    showError('Supabase belum tersedia', 'Periksa konfigurasi Supabase dan koneksi JavaScript.');
    return;
  }

  try {
    const selectFields =
      'id,slug,title,description,thumbnail_url,price,access,created_at';

    let v = null;
    let queryError = null;

    const primary = await sb
      .from('review_items')
      .select(selectFields)
      .eq('slug', slug)
      .maybeSingle();

    v = primary.data;
    queryError = primary.error;

    if (!queryError && !v) {
      const alt = await sb
        .from('review_items')
        .select(selectFields)
        .ilike('slug', slug)
        .maybeSingle();

      v = alt.data;
      queryError = alt.error;
    }

    if (!queryError && !v) {
      const byId = await sb
        .from('review_items')
        .select(selectFields)
        .eq('id', slug)
        .maybeSingle();

      v = byId.data;
      queryError = byId.error;
    }

    if (queryError) {
      console.error('Review query error:', queryError);
      showError('Gagal memuat review', queryError.message || 'Terjadi kesalahan saat mengambil data review.');
      return;
    }

    if (!v) {
      showError(
        'Review tidak ditemukan',
        'Kode yang dicari: ' + slug + '. Pastikan slug benar dan review sudah dipublikasikan.'
      );
      return;
    }

    const extra = await getReviewExtra(v.id);
    const galleryImages = normalizeGallery(extra?.gallery_urls);

    if (!galleryImages.length && v.thumbnail_url) {
      galleryImages.push(v.thumbnail_url);
    }

    v.view_count = Number(extra?.view_count || 0);

    // Tidak perlu menunggu RPC selesai.
    incrementReviewView(v.id);

    const galleryHTML = renderGallery(galleryImages, v.title);
    const reviewSlug = v.slug || v.id;
    const downloadLabel = v.access === 'paid'
      ? 'Download / Beli ' + rp(v.price)
      : 'Download';

    box.innerHTML = `
      <div class="review-shell">
        <div class="review-topline"><span class="eyebrow"><i class="fa-solid fa-shield-halved"></i> BOXCELLINK MARKETPLACE</span><span class="review-live"><i class="fa-solid fa-circle"></i> ${v.access === 'paid' ? 'Premium content' : 'Free content'}</span></div>
        <div class="review-heading"><div><p class="review-kicker">DETAIL PRODUK</p><h1>${esc(v.title)}</h1><p class="review-lead">${esc(v.description)}</p></div></div>
        <section class="gallery-panel">
          <div class="gallery-head"><div><b>Galeri produk</b><small>${galleryImages.length} media · Geser untuk melihat semua</small></div><span class="gallery-count"><i class="fa-regular fa-images"></i> ${galleryImages.length} media</span></div>
          <div class="review-gallery">${galleryHTML}</div>
        </section>
        <div class="review-viewer" id="reviewViewer" hidden><button type="button" class="viewer-close" aria-label="Tutup">×</button><img alt="Pratinjau gambar"></div>
        <section class="product-info-panel">
          <div class="product-description"><span class="review-kicker">TENTANG PRODUK</span><h2>${esc(v.title)}</h2><p>${esc(v.description)}</p></div>
          <div class="product-stats"><div><i class="fa-regular fa-eye"></i><span><b>${v.view_count + 1}</b><small>Views</small></span></div><div><i class="fa-regular fa-calendar"></i><span><b>${v.created_at ? new Date(v.created_at).toLocaleDateString('id-ID') : '-'}</b><small>Published</small></span></div></div>
          <div class="purchase-strip"><div><small>${v.access === 'paid' ? 'HARGA AKSES' : 'AKSES KONTEN'}</small><strong>${v.access === 'paid' ? rp(v.price) : 'Gratis'}</strong></div><a class="btn primary purchase-btn" href="/d/${encodeURIComponent(reviewSlug)}"><i class="fa-solid fa-bag-shopping"></i> ${esc(downloadLabel)}</a></div>
        </section>
        <section class="social-panel" id="reviewSocial">
          <div class="social-title"><div><span class="review-kicker">COMMUNITY</span><h2>Bagikan pengalamanmu</h2></div><span class="social-subtitle">Bantu pengguna lain menemukan konten menarik</span></div>
          <div class="social-actions"><button type="button" id="reviewLike" class="social-action"><i class="fa-regular fa-heart"></i><span>Suka</span><b id="reviewLikeCount">—</b></button><button type="button" id="reviewCommentJump" class="social-action"><i class="fa-regular fa-comment"></i><span>Komentar</span></button><button type="button" id="reviewShare" class="social-action"><i class="fa-solid fa-share-nodes"></i><span>Bagikan</span></button></div>
          <div class="comment-area"><div class="comment-heading"><h3>Komentar</h3><span id="commentCount">Memuat...</span></div><form id="reviewCommentForm"><textarea id="reviewCommentInput" maxlength="1000" placeholder="Tulis komentar yang sopan dan relevan..." required></textarea><div class="comment-submit"><small>Gunakan bahasa yang baik dan saling menghargai.</small><button class="btn primary" type="submit"><i class="fa-regular fa-paper-plane"></i> Kirim komentar</button></div></form><div id="reviewComments" class="review-comments"><div class="comment-empty">Memuat komentar...</div></div></div>
        </section>
      </div>
    `;
    setupGalleryViewer();
    setupGalleryControls();
    setupReviewSocial(v.id, v.title);
    loadMore(v.id);

  } catch (error) {
    console.error('Review detail error:', error);
    showError('Terjadi kesalahan', error?.message || 'Gagal memuat halaman review.');
  }
}

// =====================================================
// RELATED REVIEWS
// =====================================================

async function loadMore(id) {
  const target = document.getElementById('moreReviews');
  if (!target) return;

  try {
    const { data, error } = await sb
      .from('review_items')
      .select('slug,title,thumbnail_url,price,access')
      .eq('status', 'published')
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) throw error;

    target.innerHTML = (data || []).map(x => {
      const thumbnail = x.thumbnail_url
        ? getEmbedInfo(x.thumbnail_url)
        : null;

      // Thumbnail kartu harus berupa gambar, bukan iframe.
      const thumbUrl = thumbnail
        ? thumbnail.isDrive
          ? (() => {
              const id = getDriveId(x.thumbnail_url);
              return id
                ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600`
                : '';
            })()
          : thumbnail.src
        : '';

      return `
        <a class="video-card premium-related-card" href="/r/${encodeURIComponent(x.slug || '')}">
          ${
            thumbUrl
              ? `<img src="${esc(thumbUrl)}" alt="${esc(x.title)}" loading="lazy">`
              : ''
          }
          <div>
            <b>${esc(x.title)}</b>
            <small style="display:block">
              ${x.access === 'paid' ? rp(x.price) : 'Gratis'}
            </small>
          </div>
        </a>
      `;
    }).join('');

  } catch (error) {
    console.warn('Gagal memuat rekomendasi:', error);
    target.innerHTML = '';
  }
}

// =====================================================
// GALLERY STYLE
// =====================================================

(function addGalleryStyles() {
  if (document.getElementById('reviewGalleryEmbedStyles')) return;

  const style = document.createElement('style');
  style.id = 'reviewGalleryEmbedStyles';
  style.textContent = `
    .review-gallery{
      display:grid;
      grid-template-columns:1fr;
      gap:16px;
      margin:20px 0;
    }
    .review-gallery-item{
      position:relative;
      width:100%;
      overflow:hidden;
      border-radius:16px;
      background:#101827;
    }
    .review-gallery-item>img{
      display:block;
      width:100%;
      max-height:600px;
      object-fit:contain;
      cursor:zoom-in;
    }
    .review-gallery-embed{
      min-height:300px;
    }
    .review-gallery-embed iframe{
      display:block;
      width:100%;
      height:420px;
      border:0;
      background:#101827;
    }
    .review-open-original{
      display:block;
      padding:10px 14px;
      color:inherit;
      text-decoration:none;
      font-size:13px;
      background:rgba(0,0,0,.2);
    }
    .review-image-fallback{
      display:none;
      padding:20px;
      text-align:center;
      color:#fff;
    }
    .review-gallery-item.image-failed .review-image-fallback{
      display:block;
    }
    .review-gallery-item.image-failed>img{
      display:none;
    }
    .review-image-fallback a{
      display:block;
      margin-top:8px;
      color:#8ab4ff;
    }
    .review-gallery-error{
      padding:20px;
      border-radius:12px;
      background:#101827;
    }
    .review-viewer[hidden]{
      display:none!important;
    }
    @media(max-width:600px){
      .review-gallery-embed{
        min-height:280px;
      }
      .review-gallery-embed iframe{
        height:300px;
      }
    }
  `;

  document.head.appendChild(style);
})();

// Jalankan halaman.
load();
