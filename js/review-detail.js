
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

const reviewLang = () => localStorage.getItem('boxcellink_lang') || 'id';
const reviewEN = () => reviewLang() === 'en';
const reviewText = (id, en) => reviewEN() ? en : id;
const reviewToast = (message, type = 'info') => {
  let host = document.getElementById('reviewToastHost');
  if (!host) { host = document.createElement('div'); host.id = 'reviewToastHost'; host.className = 'review-toast-host'; host.setAttribute('aria-live','polite'); host.setAttribute('aria-atomic','true'); document.body.appendChild(host); }
  const toast = document.createElement('div'); toast.className = `review-toast review-toast-${type}`;
  const icon = type === 'error' ? 'fa-circle-exclamation' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span></span>`; toast.querySelector('span').textContent = message; host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => { toast.classList.remove('is-visible'); setTimeout(() => toast.remove(), 250); }, 3200);
};
const reviewTranslations = {
 'Menyiapkan detail produk':'Preparing product details','Memuat media dan informasi produk...':'Loading media and product information...',
 'Media belum tersedia':'Media is not available','Konten media akan ditampilkan di sini setelah diunggah oleh penjual.':'Media will appear here once uploaded by the seller.',
 'Media ini tidak dapat dibaca.':'This media could not be displayed.','Buka media asli':'Open original media','Tutup':'Close',
 'Akun login dapat mengirim komentar teks maupun tautan.':'Signed-in users can post text and links.',
 'Pengunjung dapat berkomentar dengan teks. Untuk menyertakan tautan, silakan login.':'Guests can post text comments. Please sign in to include links.',
 'Komentar belum tersedia. Admin perlu menjalankan migration komentar publik.':'Comments are unavailable. The administrator needs to run the public comments migration.',
 'Belum ada komentar. Jadilah yang pertama berkomentar.':'No comments yet. Be the first to comment.',
 'Hapus komentar':'Delete comment','Komentar':'Comments','Pengunjung':'Guest','Member BoxCellink':'BoxCellink Member',
 'Kode review tidak terbaca':'Review code is invalid','Pastikan URL berbentuk /r/KODE_REVIEW.':'Make sure the URL follows /r/REVIEW_CODE.',
 'Supabase belum tersedia':'Supabase is unavailable','Periksa konfigurasi Supabase dan koneksi JavaScript.':'Check the Supabase configuration and JavaScript connection.',
 'Gagal memuat review':'Unable to load review','Review tidak ditemukan':'Review not found',
 'Pastikan slug benar dan review sudah dipublikasikan.':'Make sure the slug is correct and the review has been published.',
 'Terjadi kesalahan':'Something went wrong','Gagal memuat halaman review.':'Unable to load the review page.',
 'DETAIL PRODUK':'PRODUCT DETAILS','Cek review terlebih dahulu. Jika Anda berminat, silakan klik tombol Download / Beli di bawah untuk melanjutkan.':'Review the details first. If you are interested, select Download / Buy below to continue.',
 'Premium content':'Premium content','Free content':'Free content','Preview media produk':'Product media preview','Geser ke samping untuk melihat semua media':'Swipe sideways to view all media','Media':'Media','dari':'of',
 'Seluruh media ditampilkan di halaman ini agar bisa diperiksa sebelum membeli.':'All media is displayed here so you can review it before purchasing.',
 'TENTANG PRODUK':'ABOUT THIS PRODUCT','Informasi produk belum ditambahkan oleh penjual.':'The seller has not added product information yet.',
 'Terjual':'Sold','Views':'Views','Total like':'Total likes','Total komentar':'Total comments','Published':'Published',
 'HARGA AKSES':'ACCESS PRICE','AKSES KONTEN':'CONTENT ACCESS','Gratis':'Free',
 'Pembayaran dan akses diproses melalui BoxCellink.':'Payment and access are handled through BoxCellink.',
 'COMMUNITY':'COMMUNITY','Bagikan pengalamanmu':'Share your experience','Bantu pengguna lain menemukan konten menarik.':'Help others discover interesting content.',
 'Suka':'Like','Bagikan':'Share','Memuat...':'Loading...','Username / Nama':'Username / Name',
 'Masukkan nama yang ingin ditampilkan':'Enter the name you want to display','Tulis komentar yang sopan dan relevan...':'Write a polite and relevant comment...',
 'Kirim komentar':'Post comment','Memuat komentar...':'Loading comments...','Review lainnya':'More reviews',
 'Temukan koleksi dan konten pilihan lainnya.':'Discover more collections and featured content.',
 'Komentar gagal dikirim. Periksa koneksi atau jalankan migration komentar.':'Comment failed. Check your connection or run the comments migration.',
 'Komentar gagal dihapus. Pastikan policy admin sudah diterapkan.':'Could not delete comment. Make sure the admin policy has been applied.',
 'Hapus komentar ini?':'Delete this comment?', 'Download':'Download','Download / Beli':'Download / Buy'
};
function applyReviewTranslations(root = document) {
 if (!reviewEN()) return;
 const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node;
 while ((node = walker.nextNode())) { const raw = node.nodeValue, trimmed = raw.trim(); if (reviewTranslations[trimmed]) node.nodeValue = raw.replace(trimmed, reviewTranslations[trimmed]); }
 root.querySelectorAll?.('[placeholder],[aria-label],[title]').forEach(el => { for (const attr of ['placeholder','aria-label','title']) { const value = el.getAttribute(attr); if (value && reviewTranslations[value]) el.setAttribute(attr, reviewTranslations[value]); } });
}
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
  applyReviewTranslations(box);
}

function setReviewLoading(message = 'Memuat media dan informasi produk...') {
  if (!box) return;
  box.innerHTML = `
    <div class="review-loading" role="status" aria-live="polite">
      <div class="loading-brand"><span class="loading-mark"><i class="fa-solid fa-layer-group"></i></span><div><b>BoxCellink</b><small>Menyiapkan detail produk</small></div></div>
      <div class="loading-track"><span></span></div>
      <p><i class="fa-solid fa-circle-notch fa-spin"></i> ${esc(message)}</p>
      <div class="loading-skeleton loading-skeleton-media"></div>
      <div class="loading-skeleton loading-skeleton-line"></div>
      <div class="loading-skeleton loading-skeleton-line short"></div>
    </div>`;
  applyReviewTranslations(box);
}

function formatCommentContent(value) {
  const text = String(value ?? '');
  const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  let output = '', cursor = 0;
  for (const match of text.matchAll(urlPattern)) {
    const raw = match[0], start = match.index ?? 0;
    output += esc(text.slice(cursor, start));
    const clean = raw.replace(/[),.!?;:]+$/g, ''), trailing = raw.slice(clean.length);
    const href = /^www\./i.test(clean) ? `https://${clean}` : clean;
    let safe = false;
    try { safe = ['http:', 'https:'].includes(new URL(href).protocol); } catch {}
    output += safe ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer nofollow">${esc(clean)}</a>${esc(trailing)}` : esc(raw);
    cursor = start + raw.length;
  }
  return output + esc(text.slice(cursor));
}
function containsExternalLink(value) { return /(?:https?:\/\/|www\.)/i.test(String(value || '')); }

// =====================================================
// GOOGLE DRIVE / EMBED URL HANDLER
// =====================================================

function extractEmbedSource(value) {
  return window.ProjectVIDEmbed?.extract(value) || '';
}
function getDriveId(value) {
  const info=window.ProjectVIDEmbed?.parse(value);
  return info?.provider==='Google Drive'?(info.src.match(/\/file\/d\/([^/]+)/)?.[1]||''):'';
}
function getEmbedInfo(value) {
  return window.ProjectVIDEmbed?.parse(value) || null;
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
  if (!items.length) return `<div class="review-gallery-empty"><i class="fa-regular fa-images"></i><b>Media belum tersedia</b><span>Konten media akan ditampilkan di sini setelah diunggah oleh penjual.</span></div>`;
  return `<div class="review-gallery-track" id="reviewGalleryTrack">${items.map((item, index) => {
    const info = getEmbedInfo(item);
    if (!info) return `<div class="review-gallery-item review-gallery-error"><span class="media-index">MEDIA ${index + 1}</span><p>Media ini tidak dapat dibaca.</p></div>`;
    if (info.type === 'video') return `
      <article class="review-gallery-item review-gallery-embed">
        <div class="media-item-head"><span class="media-index">MEDIA ${String(index + 1).padStart(2, '0')}</span><span>${esc(title)}</span></div>
        <video src="${esc(info.src)}" controls playsinline preload="metadata" aria-label="${esc(title)} - media ${index + 1}"></video>
      </article>`;
    if (info.type === 'audio') return `
      <article class="review-gallery-item review-gallery-audio">
        <div class="media-item-head"><span class="media-index">MEDIA ${String(index + 1).padStart(2, '0')}</span><span>${esc(title)}</span></div>
        <audio src="${esc(info.src)}" controls preload="metadata"></audio>
      </article>`;
    if (info.type === 'link') return `
      <article class="review-gallery-item review-gallery-error">
        <div class="media-item-head"><span class="media-index">MEDIA ${String(index + 1).padStart(2, '0')}</span><span>${esc(info.provider)}</span></div>
        <p>${reviewText('Provider ini memerlukan kode embed resmi.','This provider requires its official embed code.')}</p>
        <a class="review-open-original" href="${esc(info.src)}" target="_blank" rel="noopener noreferrer">${reviewText('Buka sumber asli','Open original source')} ↗</a>
      </article>`;
    if (info.type === 'iframe') return `
      <article class="review-gallery-item review-gallery-embed">
        <div class="media-item-head"><span class="media-index">MEDIA ${String(index + 1).padStart(2, '0')}</span><span>${esc(title)}</span></div>
        <iframe src="${esc(info.src)}" title="${esc(title)} - media ${index + 1}" loading="lazy" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        <a class="review-open-original" href="${esc(info.original)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka media asli</a>
      </article>`;
    return `
      <article class="review-gallery-item">
        <div class="media-item-head"><span class="media-index">MEDIA ${String(index + 1).padStart(2, '0')}</span><span>${esc(title)}</span></div>
        <img src="${esc(info.src)}" alt="${esc(title)} - media ${index + 1}" loading="lazy" data-full="${esc(info.src)}" onerror="this.closest('.review-gallery-item').classList.add('image-failed')">
        <div class="review-image-fallback"><span>Media gagal dimuat</span><a href="${esc(info.original)}" target="_blank" rel="noopener noreferrer">Buka media asli ↗</a></div>
      </article>`;
  }).join('')}</div>`;
}

// =====================================================
// TELEGRAM PREVIEW CONSENT GATE
// =====================================================
function setupTelegramPreviewGate() {
  const gate = document.getElementById('reviewTelegramGate');
  const content = document.getElementById('reviewGalleryAccess');
  const confirm = document.getElementById('reviewTelegramConfirm');
  if (!gate || !content || !confirm) return;
  document.body.classList.add('review-telegram-gate-open');
  const allowPreview = () => {
    gate.hidden = true;
    content.hidden = false;
    document.body.classList.remove('review-telegram-gate-open');
  };
  confirm.addEventListener('click', allowPreview, { once: true });
  gate.addEventListener('keydown', event => {
    if (event.key === 'Escape') event.preventDefault();
  });
  confirm.focus({ preventScroll: true });
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
  const controls=document.querySelector('.gallery-controls');
  if(controls && track.children.length <= 1) controls.hidden=true;
  const counter=document.getElementById('galleryCounter');
  const items=[...track.children];
  const update=()=>{const first=items[0];const step=first?first.getBoundingClientRect().width+14:track.clientWidth||1;const index=Math.min(items.length,Math.max(1,Math.round(track.scrollLeft/step)+1));if(counter)counter.textContent=`${index} / ${items.length}`;};
  document.getElementById('galleryPrev')?.addEventListener('click',()=>track.scrollBy({left:-track.clientWidth,behavior:'smooth'}));
  document.getElementById('galleryNext')?.addEventListener('click',()=>track.scrollBy({left:track.clientWidth,behavior:'smooth'}));
  track.addEventListener('scroll',update,{passive:true});
  let sx=0;track.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true});
}
async function getCurrentReviewUser() {
  try { const { data: { user } = {} } = await sb.auth.getUser(); return user && !user.is_anonymous ? user : null; }
  catch { return null; }
}

async function setupReviewSocial(reviewId, title) {
  const likeBtn = document.getElementById('reviewLike');
  const commentForm = document.getElementById('reviewCommentForm');
  const commentBox = document.getElementById('reviewComments');
  const commentInput = document.getElementById('reviewCommentInput');
  const guestNameInput = document.getElementById('reviewGuestName');
  const authHint = document.getElementById('reviewCommentHint');
  let currentUser = await getCurrentReviewUser(), isAdmin = false;
  try { if (currentUser) { const { data } = await sb.rpc('is_admin'); isAdmin = data === true; } } catch {}

  const updateCommentForm = () => {
    const guestFields = document.getElementById('guestCommentFields');
    if (guestFields) guestFields.hidden = !!currentUser;
    if (authHint) authHint.textContent = currentUser
      ? reviewText('Akun login dapat mengirim komentar teks maupun tautan.','Signed-in users can post text and links.')
      : reviewText('Pengunjung dapat berkomentar dengan teks. Untuk menyertakan tautan, silakan login.','Guests can post text comments. Please sign in to include links.');
  };

  const loadSocial = async () => {
    const [likes, comments] = await Promise.all([
      sb.from('review_likes').select('id,user_id', { count: 'exact' }).eq('review_id', reviewId),
      sb.from('review_comments').select('id,content,created_at,user_id,guest_name').eq('review_id', reviewId).eq('is_hidden', false).order('created_at', { ascending: false }).limit(50)
    ]);
    if (!likes.error) {
      const count = document.getElementById('reviewLikeCount');
      if (count) count.textContent = likes.count ?? (likes.data || []).length;
      const mine = (likes.data || []).some(x => x.user_id === currentUser?.id);
      likeBtn?.classList.toggle('is-liked', mine);
      const icon = likeBtn?.querySelector('i');
      if (icon) icon.className = mine ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    }
    if (comments.error) {
      commentBox.innerHTML = '<div class="comment-empty">Komentar belum tersedia. Admin perlu menjalankan migration komentar publik.</div>'; applyReviewTranslations(commentBox);
      document.getElementById('commentCount').textContent = reviewText('0 komentar','0 comments'); return;
    }
    const rows = comments.data || [];
    document.getElementById('commentCount').textContent = `${rows.length} ${reviewText('komentar','comments')}`;
    commentBox.innerHTML = rows.length ? rows.map(c => {
      const name = c.guest_name || (c.user_id ? 'Member BoxCellink' : 'Pengunjung');
      const del = isAdmin ? `<button type="button" class="comment-delete" data-comment-delete="${esc(c.id)}" title="Hapus komentar" aria-label="Hapus komentar"><i class="fa-solid fa-trash-can"></i></button>` : '';
      return `<article class="review-comment"><div class="comment-avatar"><i class="fa-solid fa-user"></i></div><div class="comment-body"><div class="comment-meta"><b>${esc(name)}</b><time>${new Date(c.created_at).toLocaleString(reviewEN() ? 'en-US' : 'id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</time>${del}</div><p>${formatCommentContent(c.content)}</p></div></article>`;
    }).join('') : '<div class="comment-empty">Belum ada komentar. Jadilah yang pertama berkomentar.</div>';
    applyReviewTranslations(commentBox);
  };

  updateCommentForm(); await loadSocial();
  likeBtn?.addEventListener('click', async () => {
    if (!currentUser) { reviewToast(reviewText('Silakan login terlebih dahulu untuk menggunakan fitur suka.','Please sign in to use likes.'),'info'); location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    likeBtn.disabled = true;
    try {
      const { data: existing } = await sb.from('review_likes').select('id').eq('review_id', reviewId).eq('user_id', currentUser.id).maybeSingle();
      if (existing) { const { error } = await sb.from('review_likes').delete().eq('id', existing.id); if (error) throw error; }
      else { const { error } = await sb.from('review_likes').insert({ review_id: reviewId, user_id: currentUser.id }); if (error) throw error; }
      await loadSocial();
    } catch (e) { console.error(e); reviewToast(reviewText('Like belum dapat diproses. Coba lagi beberapa saat.','Could not update your like. Please try again.'),'error'); }
    finally { likeBtn.disabled = false; }
  });
  document.getElementById('reviewCommentJump')?.addEventListener('click', () => commentInput?.focus());
  document.getElementById('reviewShare')?.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title, url: location.href, text: title });
      else { await navigator.clipboard.writeText(location.href); reviewToast(reviewText('Link review berhasil disalin.','Review link copied.'),'success'); }
      await sb.rpc('increment_review_share', { p_review_id: reviewId });
    } catch (e) { if (e.name !== 'AbortError') reviewToast(reviewText('Tidak dapat membagikan link.','Unable to share the link.'),'error'); }
  });
  commentForm?.addEventListener('submit', async e => {
    e.preventDefault(); currentUser = await getCurrentReviewUser();
    const content = commentInput.value.trim(), guestName = guestNameInput?.value.trim() || '';
    if (!content) return;
    if (!currentUser && containsExternalLink(content)) { reviewToast(reviewText('Komentar yang berisi tautan hanya dapat dikirim oleh pengguna yang sudah login.','Only signed-in users can post comments containing links.'),'info'); return; }
    if (!currentUser && !guestName) { guestNameInput?.focus(); reviewToast(reviewText('Masukkan username/nama sebelum mengirim komentar.','Enter a username/name before posting your comment.'),'info'); return; }
    const button = commentForm.querySelector('button[type="submit"]');
    button.disabled = true; button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${reviewText('Mengirim...','Posting...')}`;
    try {
      const payload = { review_id: reviewId, user_id: currentUser?.id || null, guest_name: currentUser ? null : guestName.slice(0, 40), content };
      const { error } = await sb.from('review_comments').insert(payload); if (error) throw error;
      commentInput.value = ''; if (guestNameInput) guestNameInput.value = ''; await loadSocial();
    } catch (err) { console.error('Comment insert failed:', err); reviewToast(err?.message || reviewText('Komentar gagal dikirim. Periksa koneksi atau jalankan migration komentar.','Comment failed. Check your connection or run the comments migration.'),'error'); }
    finally { button.disabled = false; button.innerHTML = `<i class="fa-regular fa-paper-plane"></i> ${reviewText('Kirim komentar','Post comment')}`; }
  });
  commentBox?.addEventListener('click', async e => {
    const button = e.target.closest('[data-comment-delete]'); if (!button || !isAdmin) return;
    if (!confirm(reviewText('Hapus komentar ini?','Delete this comment?'))) return;
    button.disabled = true;
    const { error } = await sb.from('review_comments').delete().eq('id', button.dataset.commentDelete);
    if (error) { console.error(error); reviewToast(reviewText('Komentar gagal dihapus. Pastikan policy admin sudah diterapkan.','Could not delete comment. Check the admin policy.'),'error'); button.disabled = false; return; }
    await loadSocial();
  });
}

async function getPublicReviewStats(reviewId) {
  try {
    const { data, error } = await sb.rpc('get_public_review_stats');
    if (error) throw error;
    return (data || []).find(row => row.review_id === reviewId) || null;
  } catch (error) { console.warn('Statistik review tidak tersedia:', error); return null; }
}

// =====================================================
// MAIN REVIEW
// =====================================================

async function load() {
  setReviewLoading();
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
      'id,slug,title,description,review_embed_url,thumbnail_url,price,access,created_at';

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
    if (v.review_embed_url && !galleryImages.includes(v.review_embed_url)) galleryImages.unshift(v.review_embed_url);
    if (v.thumbnail_url && !galleryImages.includes(v.thumbnail_url)) galleryImages.unshift(v.thumbnail_url);
    v.view_count = Number(extra?.view_count || 0);
    const stats = await getPublicReviewStats(v.id);
    const totalViews = Number(stats?.total_links ?? v.view_count);
    const totalSold = Number(stats?.total_sold ?? 0);
    const totalLikes = Number(stats?.total_likes ?? 0);
    const totalComments = Number(stats?.total_comments ?? 0);
    incrementReviewView(v.id);
    const galleryHTML = renderGallery(galleryImages, v.title);
    const reviewSlug = v.slug || v.id;
    const downloadLabel = v.access === 'paid'
      ? reviewText('Download / Beli','Download / Buy') + ' ' + rp(v.price)
      : reviewText('Download','Download');

    box.innerHTML = `
      <div class="review-shell">
        <div class="review-topline"><span class="eyebrow"><i class="fa-solid fa-shield-halved"></i> BOXCELLINK MARKETPLACE</span><span class="review-live"><i class="fa-solid fa-circle"></i> ${v.access === 'paid' ? 'Premium content' : 'Free content'}</span></div>
        <header class="review-heading"><div><p class="review-kicker">DETAIL PRODUK</p><h1>${esc(v.title)}</h1><p class="review-lead">Cek review terlebih dahulu. Jika Anda berminat, silakan klik tombol Download / Beli di bawah untuk melanjutkan.</p></div></header>
        <section class="gallery-panel"><div class="gallery-head"><div><b><i class="fa-regular fa-images"></i> Preview media produk</b><small>${reviewText('Seluruh media ditampilkan di halaman ini agar bisa diperiksa sebelum membeli.','All media is displayed here so you can review it before purchasing.')}</small></div><span class="gallery-count"><i class="fa-regular fa-images"></i> ${galleryImages.length} ${reviewText('media','items')}</span></div><div id="reviewGalleryAccess" hidden><div class="review-gallery">${galleryHTML}</div><div class="gallery-controls" aria-label="Kontrol galeri"><button type="button" id="galleryPrev" aria-label="Media sebelumnya"><i class="fa-solid fa-chevron-left"></i></button><span id="galleryCounter">1 / ${galleryImages.length}</span><button type="button" id="galleryNext" aria-label="Media berikutnya"><i class="fa-solid fa-chevron-right"></i></button><small>${reviewText("Geser ke samping untuk melihat semua media","Swipe sideways to view all media")}</small></div></div></section>
        <div class="review-telegram-gate" id="reviewTelegramGate" role="dialog" aria-modal="true" aria-labelledby="reviewTelegramGateTitle"><div class="review-telegram-gate-card"><span class="review-telegram-gate-icon"><i class="fa-brands fa-telegram"></i></span><span class="review-telegram-gate-kicker">BOXCELLINK MEDIA ACCESS</span><h2 id="reviewTelegramGateTitle">${reviewText('Media khusus pengguna Telegram','Media for Telegram users')}</h2><p>${reviewText('Semua media di halaman ini ditujukan khusus untuk pengguna Telegram. Apakah kamu sudah memiliki Telegram?','All media on this page is intended for Telegram users. Do you have Telegram?')}</p><div class="review-telegram-gate-actions"><a class="review-telegram-join" href="https://t.me/+03WCfVAwaWUzZTkx" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-telegram"></i> ${reviewText('Gabung Grup Resmi','Join Official Group')}</a><button class="review-telegram-confirm" type="button" id="reviewTelegramConfirm">${reviewText('Ya, Punya Telegram','Yes, I Have Telegram')} <i class="fa-solid fa-arrow-right"></i></button></div><small class="review-telegram-gate-foot"><i class="fa-solid fa-shield-halved"></i> ${reviewText('Akses media tetap mengikuti ketentuan dan izin pembelian.','Media access remains subject to access and purchase permissions.')}</small></div></div>
        <div class="review-viewer" id="reviewViewer" hidden><button type="button" class="viewer-close" aria-label="Tutup">×</button><img alt="Pratinjau gambar"></div>
        <section class="product-info-panel"><div class="product-description"><span class="review-kicker">TENTANG PRODUK</span><h2>${esc(v.title)}</h2><p>${esc(v.description || 'Informasi produk belum ditambahkan oleh penjual.')}</p></div>
          <div class="product-stats product-stats-grid">
            <div><i class="fa-solid fa-bag-shopping"></i><span><b>${totalSold.toLocaleString(reviewEN() ? 'en-US' : 'id-ID')}</b><small>Terjual</small></span></div>
            <div><i class="fa-regular fa-eye"></i><span><b>${totalViews.toLocaleString(reviewEN() ? 'en-US' : 'id-ID')}</b><small>Views</small></span></div>
            <div><i class="fa-regular fa-heart"></i><span><b>${totalLikes.toLocaleString(reviewEN() ? 'en-US' : 'id-ID')}</b><small>Total like</small></span></div>
            <div><i class="fa-regular fa-comments"></i><span><b>${totalComments.toLocaleString(reviewEN() ? 'en-US' : 'id-ID')}</b><small>Total komentar</small></span></div>
            <div><i class="fa-regular fa-calendar"></i><span><b>${v.created_at ? new Date(v.created_at).toLocaleDateString(reviewEN() ? 'en-US' : 'id-ID') : '-'}</b><small>Published</small></span></div>
          </div>
          <div class="purchase-strip"><div><small>${v.access === 'paid' ? 'HARGA AKSES' : 'AKSES KONTEN'}</small><strong>${v.access === 'paid' ? rp(v.price) : 'Gratis'}</strong><span class="purchase-note">${reviewText('Link postingan asli Telegram dibuka setelah akses gratis atau pembayaran terverifikasi.','The original Telegram post link is revealed after free access or verified payment.')}</span></div><a class="btn primary purchase-btn" href="/d/${encodeURIComponent(reviewSlug)}"><i class="fa-solid fa-download"></i> ${esc(downloadLabel)}</a></div>
        </section>
        <section class="social-panel" id="reviewSocial"><div class="social-title"><div><span class="review-kicker">COMMUNITY</span><h2>Bagikan pengalamanmu</h2></div><span class="social-subtitle">Bantu pengguna lain menemukan konten menarik.</span></div>
          <div class="social-actions"><button type="button" id="reviewLike" class="social-action"><i class="fa-regular fa-heart"></i><span>Suka</span><b id="reviewLikeCount">${totalLikes}</b></button><button type="button" id="reviewCommentJump" class="social-action"><i class="fa-regular fa-comment"></i><span>Komentar</span></button><button type="button" id="reviewShare" class="social-action"><i class="fa-solid fa-share-nodes"></i><span>Bagikan</span></button></div>
          <div class="comment-area"><div class="comment-heading"><h3>Komentar</h3><span id="commentCount">Memuat...</span></div>
            <form id="reviewCommentForm"><div id="guestCommentFields" class="guest-comment-fields"><label for="reviewGuestName">Username / Nama</label><input id="reviewGuestName" type="text" maxlength="40" autocomplete="nickname" placeholder="Masukkan nama yang ingin ditampilkan"></div>
              <textarea id="reviewCommentInput" maxlength="1000" placeholder="Tulis komentar yang sopan dan relevan..." required></textarea>
              <div class="comment-submit"><small id="reviewCommentHint">Pengunjung dapat berkomentar dengan teks. Untuk menyertakan tautan, silakan login.</small><button class="btn primary" type="submit"><i class="fa-regular fa-paper-plane"></i> Kirim komentar</button></div>
            </form><div id="reviewComments" class="review-comments"><div class="comment-empty">Memuat komentar...</div></div>
          </div>
        </section>
      </div>`;
    applyReviewTranslations(box);
    setupTelegramPreviewGate();
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
  const pages = document.getElementById('reviewPages');
  if (!target) return;
  const perPage = 8;
  let allReviews = [];
  let currentPage = 1;

  function renderPage(page) {
    currentPage = page;
    const totalPages = Math.max(1, Math.ceil(allReviews.length / perPage));
    const rows = allReviews.slice((page - 1) * perPage, page * perPage);
    target.innerHTML = rows.map(x => {
      const thumbnail = x.thumbnail_url ? getEmbedInfo(x.thumbnail_url) : null;
      const thumbUrl = thumbnail
        ? (thumbnail.thumbnail || (thumbnail.type === 'image' ? thumbnail.src : ''))
        : '';
      return `
        <a class="video-card premium-related-card" href="/r/${encodeURIComponent(x.slug || '')}">
          <div class="related-thumb">${thumbUrl ? `<img src="${esc(thumbUrl)}" alt="${esc(x.title)}" loading="lazy">` : `<span class="related-thumb-empty"><i class="fa-regular fa-image"></i></span>`}</div>
          <div class="related-card-info">
            <b>${esc(x.title)}</b>
            <small class="related-price">${x.access === 'paid' ? rp(x.price) : reviewText('Gratis','Free')}</small>
            <div class="related-card-stats">
              <span><i class="fa-solid fa-bag-shopping"></i> ${Number(x.total_sold || 0).toLocaleString(reviewEN() ? 'en-US' : 'id-ID')} ${reviewText('terjual','sold')}</span>
              <span><i class="fa-regular fa-heart"></i> ${Number(x.total_likes || 0).toLocaleString(reviewEN() ? 'en-US' : 'id-ID')}</span>
              <span><i class="fa-regular fa-comment"></i> ${Number(x.total_comments || 0).toLocaleString(reviewEN() ? 'en-US' : 'id-ID')}</span>
            </div>
          </div>
        </a>`;
    }).join('');
    if (pages) {
      if (totalPages <= 1) pages.innerHTML = '';
      else {
        let buttons = `<button type="button" class="page-arrow" data-page="${Math.max(1,page-1)}" aria-label="Previous page" ${page===1?'disabled':''}><i class="fa-solid fa-chevron-left"></i></button>`;
        for (let n=1;n<=totalPages;n++) buttons += `<button type="button" class="page-number ${n===page?'active':''}" data-page="${n}" aria-current="${n===page?'page':'false'}">${n}</button>`;
        buttons += `<button type="button" class="page-arrow" data-page="${Math.min(totalPages,page+1)}" aria-label="Next page" ${page===totalPages?'disabled':''}><i class="fa-solid fa-chevron-right"></i></button>`;
        pages.innerHTML = buttons;
        pages.querySelectorAll('button[data-page]').forEach(btn => btn.addEventListener('click', () => {
          renderPage(Number(btn.dataset.page));
          document.querySelector('.related-section')?.scrollIntoView({behavior:'smooth',block:'start'});
        }));
      }
    }
    applyReviewTranslations(target);
  }

  try {
    const { data, error } = await sb.from('review_items')
      .select('id,slug,title,thumbnail_url,price,access')
      .eq('status', 'published')
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    allReviews = data || [];
    // Public aggregate stats are loaded in one request for all related reviews.
    let statsByReview = new Map();
    try {
      const { data: statRows, error: statsError } = await sb.rpc('get_public_review_stats');
      if (!statsError && Array.isArray(statRows)) {
        statsByReview = new Map(statRows.map(row => [String(row.review_id), row]));
      }
    } catch (statsError) {
      console.warn('Statistik review terkait tidak tersedia:', statsError);
    }
    allReviews = allReviews.map(item => {
      const row = statsByReview.get(String(item.id)) || {};
      return {
        ...item,
        total_sold: Number(row.total_sold || 0),
        total_likes: Number(row.total_likes || 0),
        total_comments: Number(row.total_comments || 0)
      };
    });
    renderPage(1);
  } catch (error) {
    console.warn('Gagal memuat rekomendasi:', error);
    target.innerHTML = '';
    if (pages) pages.innerHTML = '';
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
      display:block;
      width:100%;
      margin:20px 0;
      overflow:hidden;
      border-radius:18px;
    }
    .review-gallery-track{
      display:flex;
      width:100%;
      gap:14px;
      overflow-x:auto;
      scroll-snap-type:x mandatory;
      scroll-behavior:smooth;
      scrollbar-width:none;
      -webkit-overflow-scrolling:touch;
    }
    .review-gallery-track::-webkit-scrollbar{display:none}
    .review-gallery-track>.review-gallery-item{
      flex:0 0 100%;
      width:100%;
      min-width:100%;
      scroll-snap-align:start;
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

applyReviewTranslations(document);
if (reviewEN()) { const reviewObserver = new MutationObserver(() => applyReviewTranslations(document)); reviewObserver.observe(document.body, { childList:true, subtree:true }); }
