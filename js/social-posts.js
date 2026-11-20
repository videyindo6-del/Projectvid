(() => {
'use strict';
const $ = id => document.getElementById(id);
const feed = $('bcPostFeed');
if (!feed) return;
const sb = window.sb;
const PAGE_SIZE = 12;
const params = new URLSearchParams(location.search);
const sharedPostId = params.get('post');
let viewer = null, page = 0, loading = false, hasMore = true, channel = null;
let newPostIds = new Set(), firstLoadedAt = new Date().toISOString();
const lang = () => localStorage.getItem('boxcellink_lang') === 'en' ? 'en' : 'id';
const words = {
  id: {
    title:'Apa yang ingin kamu bagikan hari ini?', intro:'Bagikan AutoLink atau PasteLink dan temukan publikasi terbaru dari member lainnya.',
    createAuto:'Buat AutoLink', createPaste:'Buat PasteLink', feedTitle:'Publikasi Member', feedIntro:'AutoLink dan PasteLink terbaru dalam satu tempat.',
    live:'Live Feed', loading:'Memuat postingan...', like:'Love', comment:'Komentar', share:'Share', copy:'Salin link',
    likes:'love', comments:'komentar', shares:'dibagikan', empty:'Belum ada publikasi. Jadilah member pertama yang membagikan AutoLink atau PasteLink!',
    more:'Muat publikasi lainnya', newOne:'publikasi terbaru · Tampilkan', newMany:'publikasi terbaru · Tampilkan',
    writeComment:'Tulis komentar...', send:'Kirim komentar', loginLike:'Masuk terlebih dahulu untuk memberikan Love.',
    loginComment:'Masuk terlebih dahulu untuk menulis komentar.', noComment:'Belum ada komentar. Mulai percakapan!',
    commentError:'Komentar gagal dikirim.', likeError:'Love gagal diperbarui.', linkCopied:'Link berhasil disalin.',
    typeAuto:'AutoLink', typePaste:'PasteLink', linkUnavailable:'Link tidak tersedia.',
    loadError:'Publikasi belum dapat dimuat. Periksa koneksi atau migrasi Social Posts di Supabase.',
    name:'Member', shareTitle:'Publikasi BoxCellink', copyShare:'Link publikasi disalin.',
    signInComment:'Login untuk ikut berkomentar.'
  },
  en: {
    title:'What would you like to share today?', intro:'Share an AutoLink or PasteLink and discover the latest posts from other members.',
    createAuto:'Create AutoLink', createPaste:'Create PasteLink', feedTitle:'Member Posts', feedIntro:'The latest AutoLink and PasteLink publications in one place.',
    live:'Live Feed', loading:'Loading posts...', like:'Love', comment:'Comment', share:'Share', copy:'Copy link',
    likes:'loves', comments:'comments', shares:'shares', empty:'No publications yet. Be the first member to share an AutoLink or PasteLink!',
    more:'Load more posts', newOne:'new publication · Show', newMany:'new publications · Show',
    writeComment:'Write a comment...', send:'Send comment', loginLike:'Sign in first to leave a Love.',
    loginComment:'Sign in first to write a comment.', noComment:'No comments yet. Start the conversation!',
    commentError:'Could not send comment.', likeError:'Could not update Love.', linkCopied:'Link copied.',
    typeAuto:'AutoLink', typePaste:'PasteLink', linkUnavailable:'Link unavailable.',
    loadError:'Posts could not be loaded. Check the connection or Supabase Social Posts migration.',
    name:'Member', shareTitle:'BoxCellink post', copyShare:'Post link copied.',
    signInComment:'Sign in to join the conversation.'
  }
};
const t = key => words[lang()][key] || key;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel = value => { const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; return new Intl.DateTimeFormat(lang()==='en'?'en-US':'id-ID',{dateStyle:'medium',timeStyle:'short'}).format(d); };
const shortUrl = value => { try { const u = new URL(value, location.origin); return u.hostname + (u.pathname==='/'?'':u.pathname) + u.search; } catch { return String(value||''); } };
const safeUrl = value => { try { const u = new URL(value, location.origin); return ['http:','https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };
const linkify = value => esc(value).replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, raw => { const clean=raw.replace(/[),.!?;:]+$/,''); const tail=raw.slice(clean.length); const href=safeUrl(/^https?:\/\//i.test(clean)?clean:'https://'+clean); return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${clean}</a>${tail}`; });
function toast(message) { let el=$('bcSocialPageToast'); if(!el){el=document.createElement('div');el.id='bcSocialPageToast';el.className='bc-social-page-toast';document.body.appendChild(el);} el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,2800); }
function updateStaticLanguage(){
 const title=$('.bc-composer-copy h1'), intro=$('.bc-composer-copy p'), feedTitle=$('.bc-feed-heading h2'), feedIntro=$('.bc-feed-heading p'), live=$('.bc-feed-live');
 if(title)title.textContent=t('title'); if(intro)intro.textContent=t('intro'); if(feedTitle)feedTitle.textContent=t('feedTitle'); if(feedIntro)feedIntro.textContent=t('feedIntro'); if(live)live.innerHTML=`<i class="fa-solid fa-circle"></i> ${t('live')}`;
 const auto=$('.bc-create-auto span'),paste=$('.bc-create-paste span');if(auto)auto.textContent=t('createAuto');if(paste)paste.textContent=t('createPaste');
}
function postUrl(post){const isAuto=post.post_type==='auto_link';if(post.short_code)return new URL((isAuto?'/z/':'/pas/')+encodeURIComponent(post.short_code),location.origin).href;return safeUrl(post.public_url);}
function postCard(post, liked=false){
 const isAuto=post.post_type==='auto_link', type=isAuto?t('typeAuto'):t('typePaste'), link=postUrl(post);
 const display=post.full_name||post.username||t('name'), username=post.username||'member';
 const title=post.title||((lang()==='en'?'Untitled publication':'Publikasi tanpa judul'));
 const likeCount=Number(post.like_count||0), commentCount=Number(post.comment_count||0), shareCount=Number(post.share_count||0);
 return `<article class="bc-post-card ${isAuto?'is-autolink':'is-pastelink'}" data-post-id="${esc(post.id)}">
  <header class="bc-post-author"><div class="bc-post-author-main"><div class="bc-post-avatar">${esc((display.trim()[0]||'M').toUpperCase())}</div><div class="bc-post-author-copy"><a href="/member-profile.html?id=${encodeURIComponent(post.user_id)}">${esc(display)}</a><span class="bc-post-username">@${esc(username)}</span><time class="bc-post-date" datetime="${esc(post.created_at)}">${esc(dateLabel(post.created_at))}</time></div></div>
  <span class="bc-post-type ${isAuto?'auto':'paste'}"><i class="fa-solid ${isAuto?'fa-bolt':'fa-link'}"></i>${type}</span></header>
  <div class="bc-post-content"><h3 class="bc-post-title">${esc(title)}</h3><a class="bc-post-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-link"></i><span>${esc(shortUrl(link))}</span><i class="fa-solid fa-arrow-up-right-from-square bc-link-open"></i></a></div>
  <div class="bc-post-stats"><span class="bc-post-love-total"><i class="fa-solid fa-heart"></i> <b data-like-count>${likeCount.toLocaleString(lang()==='en'?'en-US':'id-ID')}</b> ${t('likes')}</span><span><b data-comment-count>${commentCount.toLocaleString(lang()==='en'?'en-US':'id-ID')}</b> ${t('comments')} · <b data-share-count>${shareCount.toLocaleString(lang()==='en'?'en-US':'id-ID')}</b> ${t('shares')}</span></div>
  <div class="bc-post-actions"><button type="button" class="bc-post-action ${liked?'is-liked':''}" data-action="like" aria-pressed="${liked}"><i class="${liked?'fa-solid':'fa-regular'} fa-heart"></i><span>${t('like')}</span></button><button type="button" class="bc-post-action" data-action="comments"><i class="fa-regular fa-comment"></i><span>${t('comment')}</span></button><button type="button" class="bc-post-action" data-action="share"><i class="fa-solid fa-share-nodes"></i><span>${t('share')}</span></button></div>
  <section class="bc-post-comments" data-comments hidden><div class="bc-comment-list"><div class="bc-post-loading">${esc(t('loading'))}</div></div><form class="bc-comment-form"><input type="text" name="comment" maxlength="800" placeholder="${esc(t('writeComment'))}" aria-label="${esc(t('writeComment'))}" required><button type="submit" aria-label="${esc(t('send'))}"><i class="fa-solid fa-paper-plane"></i></button></form></section>
 </article>`;
}
async function resolveNames(rows){const ids=[...new Set(rows.map(x=>x.user_id).filter(Boolean))];if(!ids.length)return new Map();const {data,error}=await sb.rpc('get_public_usernames',{p_user_ids:ids});if(error)throw error;return new Map((data||[]).map(x=>[x.user_id,{username:x.username,full_name:x.full_name}]));}
async function likedPosts(posts){if(!viewer||!posts.length)return new Set();const {data,error}=await sb.from('social_post_likes').select('post_id').eq('user_id',viewer.id).in('post_id',posts.map(p=>p.id));if(error)throw error;return new Set((data||[]).map(x=>x.post_id));}
async function loadPosts(reset=false){
 if(loading||(!hasMore&&!reset))return;loading=true;
 if(reset){page=0;hasMore=true;feed.innerHTML=`<div class="bc-post-loading"><i class="fa-solid fa-spinner fa-spin"></i> ${esc(t('loading'))}</div>`;}
 try{
  let query=sb.from('social_posts').select('id,user_id,public_url,short_code,title,post_type,like_count,comment_count,share_count,created_at').eq('status','published').or('expires_at.is.null,expires_at.gt.'+new Date().toISOString()).order('created_at',{ascending:false}).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
  const {data,error}=await query;if(error)throw error;const posts=data||[];hasMore=posts.length===PAGE_SIZE;
  const names=await resolveNames(posts);posts.forEach(p=>{const n=names.get(p.user_id)||{};p.username=n.username||'member';p.full_name=n.full_name||p.username;});
  const liked=await likedPosts(posts);if(reset)feed.innerHTML='';
  if(posts.length)feed.insertAdjacentHTML('beforeend',posts.map(p=>postCard(p,liked.has(p.id))).join(''));
  else if(reset)feed.innerHTML=`<div class="bc-post-empty"><i class="fa-regular fa-rectangle-list"></i>${esc(t('empty'))}</div>`;
  page++;const more=$('bcPostMore');if(more)more.innerHTML=hasMore&&posts.length?`<button type="button" id="bcLoadMore">${esc(t('more'))}</button>`:'';
  $('bcLoadMore')?.addEventListener('click',()=>loadPosts());
 }catch(error){console.error('Load social posts failed:',error);if(reset)feed.innerHTML=`<div class="bc-post-error">${esc(t('loadError'))}<br><small>${esc(error.message||'')}</small></div>`;toast(error.message||t('loadError'));}
 finally{loading=false;}
}
async function loadComments(card){
 const box=card.querySelector('[data-comments]'),list=box.querySelector('.bc-comment-list');
 const {data,error}=await sb.from('social_post_comments').select('id,user_id,body,created_at').eq('post_id',card.dataset.postId).order('created_at',{ascending:true}).limit(50);if(error)throw error;
 const names=await resolveNames(data||[]);
 list.innerHTML=(data||[]).length?data.map(c=>{const n=names.get(c.user_id)||{};return `<div class="bc-comment"><div class="bc-comment-avatar">${esc((n.username||'m').slice(0,1).toUpperCase())}</div><div class="bc-comment-body"><a href="/member-profile.html?id=${encodeURIComponent(c.user_id)}">${esc(n.full_name||n.username||'member')}</a><span class="bc-comment-username">@${esc(n.username||'member')}</span><p>${linkify(c.body)}</p><time>${esc(dateLabel(c.created_at))}</time></div></div>`;}).join(''):`<p class="bc-post-empty bc-comment-empty">${esc(t('noComment'))}</p>`;
}
async function refreshOne(postId){
 const card=feed.querySelector(`[data-post-id="${CSS.escape(postId)}"]`);if(!card)return;
 const {data,error}=await sb.from('social_posts').select('like_count,comment_count,share_count').eq('id',postId).maybeSingle();if(error||!data)return;
 const fmt=n=>Number(n||0).toLocaleString(lang()==='en'?'en-US':'id-ID');
 const like=card.querySelector('[data-like-count]'),comment=card.querySelector('[data-comment-count]'),share=card.querySelector('[data-share-count]');if(like)like.textContent=fmt(data.like_count);if(comment)comment.textContent=fmt(data.comment_count);if(share)share.textContent=fmt(data.share_count);
}
feed.addEventListener('click',async event=>{
 const button=event.target.closest('button[data-action]');if(!button)return;const card=button.closest('[data-post-id]');if(!card)return;const postId=card.dataset.postId;button.disabled=true;
 try{
  if(button.dataset.action==='like'){
   if(!viewer){toast(t('loginLike'));return;}
   const liked=button.getAttribute('aria-pressed')==='true';
   if(liked){const {error}=await sb.from('social_post_likes').delete().eq('post_id',postId).eq('user_id',viewer.id);if(error)throw error;}
   else{const {error}=await sb.from('social_post_likes').insert({post_id:postId,user_id:viewer.id});if(error&&error.code!=='23505')throw error;}
   button.setAttribute('aria-pressed',String(!liked));button.classList.toggle('is-liked',!liked);button.querySelector('i').className=`${!liked?'fa-solid':'fa-regular'} fa-heart`;await refreshOne(postId);
  } else if(button.dataset.action==='comments'){
   const box=card.querySelector('[data-comments]');box.hidden=!box.hidden;if(!box.hidden){await loadComments(card);box.querySelector('input')?.focus();}
  } else if(button.dataset.action==='share'){
   const shareUrl=new URL('/posts.html?post='+encodeURIComponent(postId),location.origin).href;let completed=false;
   if(navigator.share){try{await navigator.share({title:t('shareTitle'),url:shareUrl});completed=true;}catch(e){if(e.name==='AbortError')return;throw e;}}
   else {try{await navigator.clipboard.writeText(shareUrl);toast(t('copyShare'));completed=true;}catch(_){prompt(t('copyShare'),shareUrl);}}
   if(completed&&viewer){const {error}=await sb.rpc('increment_social_post_share',{p_post_id:postId});if(error)console.warn('Share counter update failed:',error.message);await refreshOne(postId);}
  }
 }catch(error){console.error('Social action failed:',error);toast(error.message||t('likeError'));}
 finally{button.disabled=false;}
});
feed.addEventListener('submit',async event=>{
 const form=event.target.closest('.bc-comment-form');if(!form)return;event.preventDefault();if(!viewer){toast(t('loginComment'));return;}
 const input=form.elements.comment,body=input.value.trim();if(!body)return;const button=form.querySelector('button');button.disabled=true;
 try{
  const card=form.closest('[data-post-id]');const {data:profile,error:pe}=await sb.from('profiles').select('username').eq('id',viewer.id).maybeSingle();if(pe)throw pe;if(!profile?.username)throw new Error(lang()==='en'?'Set a public username in My Account before commenting.':'Atur username publik di halaman Akun Saya sebelum berkomentar.');
  const {error}=await sb.from('social_post_comments').insert({post_id:card.dataset.postId,user_id:viewer.id,body});if(error)throw error;input.value='';await loadComments(card);await refreshOne(card.dataset.postId);
 }catch(error){console.error('Comment failed:',error);toast(error.message||t('commentError'));}
 finally{button.disabled=false;}
});
function showNewNotice(){const notice=$('bcNewPosts'),button=$('bcShowNewPosts');if(!notice||!button)return;const count=newPostIds.size;button.querySelector('span').textContent=`${count} ${count===1?t('newOne'):t('newMany')}`;notice.hidden=count===0;}
async function handleNewPost(row){if(!row?.id||newPostIds.has(row.id)||feed.querySelector(`[data-post-id="${CSS.escape(row.id)}"]`))return;if(row.user_id===viewer?.id)return;newPostIds.add(row.id);showNewNotice();}
function subscribeFeed(){
 try{
  channel=sb.channel('boxcellink-social-posts-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'social_posts'},payload=>{const row=payload.new;if(row?.status==='published'&&(!row.expires_at||Date.parse(row.expires_at)>Date.now())&&Date.parse(row.created_at||'')>=Date.parse(firstLoadedAt))handleNewPost(row);}).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Live feed subscription unavailable; polling remains active.');});
 }catch(e){console.warn('Realtime setup failed:',e);}
 // Fallback for projects where Realtime has not yet been enabled.
 setInterval(async()=>{
  try{const {data,error}=await sb.from('social_posts').select('id,user_id,created_at,status,expires_at').eq('status','published').gt('created_at',firstLoadedAt).order('created_at',{ascending:false}).limit(20);if(error)throw error;(data||[]).forEach(handleNewPost);}catch(e){console.warn('Feed refresh check:',e.message);}
 },30000);
}
$('bcShowNewPosts')?.addEventListener('click',async()=>{newPostIds.clear();showNewNotice();await loadPosts(true);window.scrollTo({top:feed.getBoundingClientRect().top+window.scrollY-90,behavior:'smooth'});});
$('bcPageCreate')?.addEventListener('click',()=>{const open=$('bcOpenPasteComposer');if(open)open.click();else location.href='/pastelink-create.html';});
async function focusSharedPost(){if(!sharedPostId)return;let card=feed.querySelector(`[data-post-id="${CSS.escape(sharedPostId)}"]`);if(!card){const {data:post,error}=await sb.from('social_posts').select('id,user_id,public_url,short_code,title,post_type,like_count,comment_count,share_count,created_at').eq('id',sharedPostId).eq('status','published').maybeSingle();if(error)throw error;if(post){const names=await resolveNames([post]),n=names.get(post.user_id)||{};post.username=n.username||'member';post.full_name=n.full_name||post.username;const liked=await likedPosts([post]);feed.insertAdjacentHTML('afterbegin',postCard(post,liked.has(post.id)));card=feed.querySelector(`[data-post-id="${CSS.escape(sharedPostId)}"]`);}}
 if(card){card.classList.add('bc-post-highlight');card.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>card.classList.remove('bc-post-highlight'),2600);}
}
async function init(){
 updateStaticLanguage();if(!sb?.auth){feed.innerHTML=`<div class="bc-post-error">${esc(t('loadError'))}</div>`;return;}
 const {data:{user}}=await sb.auth.getUser();viewer=user||null;await loadPosts(true);await focusSharedPost();subscribeFeed();
 const paramsNow=new URLSearchParams(location.search);if(paramsNow.get('new'))toast(lang()==='en'?'Your PasteLink has been published.':'PasteLink berhasil dipublikasikan.');
}
init().catch(error=>{console.error('Social page init failed:',error);feed.innerHTML=`<div class="bc-post-error">${esc(t('loadError'))}</div>`;});
})();
