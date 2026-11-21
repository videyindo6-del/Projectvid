(() => {
'use strict';
const $ = id => document.getElementById(id);
const feed = $('bcPostFeed');
if (!feed) return;
const sb = window.sb;
const PAGE_SIZE = 12;
const params = new URLSearchParams(location.search);
const sharedPostId = params.get('post');
const publicProfileId = location.pathname.endsWith('/member-profile.html') ? params.get('id') : null;
const profileWords = {id:{public_profile:'PROFIL PUBLIK',posts_title:'Publikasi',posts_desc:'AutoLink dan PasteLink yang dibagikan member ini.',chat_title:'Chat',chat_empty:'Belum ada pesan. Mulai percakapan.',chat_placeholder:'Tulis pesan...',send:'Kirim',add_friend:'Tambah teman',request_sent:'Permintaan terkirim',accept_request:'Terima permintaan',friends:'Sudah berteman',chat:'Chat',login_friend:'Login untuk menambahkan teman atau chat.',profile_error:'Profil tidak ditemukan atau belum memiliki username.',friend_error:'Aksi pertemanan gagal.',chat_error:'Chat belum tersedia. Jalankan migrasi direct_messages_profile_v1.sql terlebih dahulu.',profile_activity:'Aktivitas member',basic:'Basic',vip:'VIP',publisher:'Publisher',published:'Publisher'},en:{public_profile:'PUBLIC PROFILE',posts_title:'Posts',posts_desc:'AutoLink and PasteLink shared by this member.',chat_title:'Chat',chat_empty:'No messages yet. Start the conversation.',chat_placeholder:'Write a message...',send:'Send',add_friend:'Add friend',request_sent:'Request sent',accept_request:'Accept request',friends:'Friends',chat:'Chat',login_friend:'Sign in to add friends or chat.',profile_error:'Profile not found or no public username.',friend_error:'Friend action failed.',chat_error:'Chat is unavailable. Run direct_messages_profile_v1.sql migration first.',profile_activity:'Member activity',basic:'Basic',vip:'VIP',publisher:'Publisher',published:'Publisher'}};
const pt = key => profileWords[lang()][key] || key;
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
  if(publicProfileId) query=query.eq('user_id',publicProfileId);
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
function setMemberProfileStaticText(){if(!publicProfileId)return;const en=lang()==='en';const set=(id,value)=>{const el=$(id);if(el)el.textContent=value;};set('bcProfileStatus','');set('bcProfileUsername','@username');set('bcChatPartner',en?'Direct message':'Pesan langsung');const h=document.querySelector('[data-profile-i18n=public_profile]');if(h)h.textContent=en?'PUBLIC PROFILE':'PROFIL PUBLIK';const eyebrow=document.querySelector('[data-profile-i18n=member_activity]');if(eyebrow)eyebrow.textContent=en?'MEMBER ACTIVITY':'AKTIVITAS MEMBER';set('bcProfilePostsTitle',en?'Posts':'Publikasi');set('bcProfilePostsDesc',en?'AutoLink and PasteLink shared by this member.':'AutoLink dan PasteLink yang dibagikan member ini.');const chatTitle=document.querySelector('[data-profile-i18n=chat_title]');if(chatTitle)chatTitle.textContent=en?'Chat':'Chat';const input=$('bcChatInput');if(input)input.placeholder=en?'Write a message...':'Tulis pesan...';}
async function initPublicMemberProfile(){
 setMemberProfileStaticText();
 const id=publicProfileId;const actions=$('bcProfileActions');if(!id){feed.innerHTML=`<div class="bc-post-error">${esc(pt('profile_error'))}</div>`;return;}
 try{
  const {data:profile,error}=await sb.rpc('get_public_member_profile',{p_user_id:id});if(error)throw error;if(!profile){feed.innerHTML=`<div class="bc-post-empty">${esc(pt('profile_error'))}</div>`;return;}
  const name=profile.full_name||profile.username||'Member',username=profile.username||'member';
  $('bcProfileName').textContent=name;$('bcProfileUsername').textContent='@'+username;$('bcProfileAvatar').textContent=(name.trim()[0]||'M').toUpperCase();
  const status=profile.status_label||pt('basic'),statusEl=$('bcProfileStatus');statusEl.innerHTML=`<div class="bc-profile-status-wrap"><span class="bc-profile-status ${status==='VIP'?'vip':status==='Publisher'?'published':''}"><i class="fa-solid ${status==='VIP'?'fa-crown':status==='Publisher'?'fa-bullhorn':'fa-user'}"></i>${esc(status)}</span></div>`;
  $('bcProfileBio').textContent=profile.bio||'';
  const labels={instagram:['Instagram','fa-brands fa-instagram'],facebook:['Facebook','fa-brands fa-facebook'],youtube:['YouTube','fa-brands fa-youtube'],telegram:['Telegram','fa-brands fa-telegram'],whatsapp:['WhatsApp','fa-brands fa-whatsapp'],x:['X','fa-brands fa-x-twitter'],other:['Website','fa-solid fa-link']};
  const socials=$('bcProfileSocials');socials.innerHTML=Object.entries(profile.social_links||{}).filter(([k,v])=>labels[k]&&typeof v==='string'&&/^https?:\/\//i.test(v)).map(([k,v])=>`<a href="${esc(v)}" target="_blank" rel="noopener noreferrer"><i class="${labels[k][1]}"></i>${labels[k][0]}</a>`).join('');
  if(!viewer){actions.innerHTML=`<a class="bc-friend-action primary" href="/login.html?next=${encodeURIComponent('/member-profile.html?id='+id)}"><i class="fa-solid fa-user-plus"></i>${esc(pt('add_friend'))}</a><a class="bc-friend-action chat" href="/login.html?next=${encodeURIComponent('/member-profile.html?id='+id)}"><i class="fa-solid fa-message"></i>${esc(pt('chat'))}</a>`;return;}
  if(viewer.id===id){actions.innerHTML='';return;}
  const friendState=profile.friend_state||'none';
  if(friendState==='friends')actions.innerHTML=`<span class="bc-friend-action"><i class="fa-solid fa-user-check"></i>${esc(pt('friends'))}</span><button class="bc-friend-action chat" type="button" id="bcOpenProfileChat"><i class="fa-solid fa-message"></i>${esc(pt('chat'))}</button>`;
  else if(friendState==='sent')actions.innerHTML=`<span class="bc-friend-action"><i class="fa-solid fa-clock"></i>${esc(pt('request_sent'))}</span><button class="bc-friend-action chat" type="button" id="bcOpenProfileChat"><i class="fa-solid fa-message"></i>${esc(pt('chat'))}</button>`;
  else if(friendState==='received')actions.innerHTML=`<button class="bc-friend-action primary" type="button" id="bcAcceptProfileFriend"><i class="fa-solid fa-user-check"></i>${esc(pt('accept_request'))}</button><button class="bc-friend-action chat" type="button" id="bcOpenProfileChat"><i class="fa-solid fa-message"></i>${esc(pt('chat'))}</button>`;
  else actions.innerHTML=`<button class="bc-friend-action primary" type="button" id="bcAddProfileFriend"><i class="fa-solid fa-user-plus"></i>${esc(pt('add_friend'))}</button><button class="bc-friend-action chat" type="button" id="bcOpenProfileChat"><i class="fa-solid fa-message"></i>${esc(pt('chat'))}</button>`;
  $('bcAddProfileFriend')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;try{const {data,error}=await sb.rpc('send_social_friend_request',{p_user_id:id});if(error)throw error;toast(data==='sent'?pt('request_sent'):pt(data==='friends'?'friends':'request_sent'));await initPublicMemberProfile();}catch(err){toast(err.message||pt('friend_error'));b.disabled=false;}});
  $('bcAcceptProfileFriend')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;try{const {data,error}=await sb.rpc('get_my_social_friend_requests');if(error)throw error;const req=(data||[]).find(x=>x.user_id===id);if(!req)throw new Error('FRIEND_REQUEST_NOT_FOUND');const {error:re}=await sb.rpc('respond_social_friend_request',{p_request_id:req.request_id,p_accept:true});if(re)throw re;await initPublicMemberProfile();}catch(err){toast(err.message||pt('friend_error'));b.disabled=false;}});
  $('bcOpenProfileChat')?.addEventListener('click',()=>openProfileChat(id,name));
 }catch(error){console.error('Public member profile failed:',error);feed.innerHTML=`<div class="bc-post-error">${esc(pt('profile_error'))}</div>`;}
}
async function openProfileChat(targetId,targetName){
 const panel=$('bcProfileChat');panel.hidden=false;$('bcChatPartner').textContent=targetName;const messages=$('bcChatMessages');messages.innerHTML=`<div class="bc-post-loading">${esc(pt('chat_empty'))}</div>`;panel.scrollIntoView({behavior:'smooth',block:'start'});
 try{const {data:conv,error}=await sb.rpc('get_or_create_direct_conversation',{p_other_user_id:targetId});if(error)throw error;const convId=typeof conv==='string'?conv:conv?.conversation_id||conv?.id;if(!convId)throw new Error('CHAT_CONVERSATION_MISSING');panel.dataset.conversationId=convId;await loadDirectMessages(convId);if(panel.dataset.pollTimer)clearInterval(Number(panel.dataset.pollTimer));panel.dataset.pollTimer=String(setInterval(()=>loadDirectMessages(convId).catch(err=>console.warn('Chat polling failed:',err)),6000));
 }catch(error){console.error('Direct chat open failed:',error);messages.innerHTML=`<div class="bc-post-error">${esc(pt('chat_error'))}</div>`;}
}
async function loadDirectMessages(conversationId){const box=$('bcChatMessages');const {data,error}=await sb.rpc('get_direct_messages',{p_conversation_id:conversationId,p_limit:80});if(error)throw error;const rows=data||[];box.innerHTML=rows.length?rows.map(m=>`<div class="bc-direct-message ${m.sender_id===viewer?.id?'mine':''}">${esc(m.body)}<time>${esc(dateLabel(m.created_at))}</time></div>`).join(''):`<div class="bc-post-empty">${esc(pt('chat_empty'))}</div>`;box.scrollTop=box.scrollHeight;
}
$('bcChatClose')?.addEventListener('click',()=>{const panel=$('bcProfileChat');panel.hidden=true;if(panel.dataset.pollTimer)clearInterval(Number(panel.dataset.pollTimer));});
$('bcChatForm')?.addEventListener('submit',async e=>{e.preventDefault();const panel=$('bcProfileChat'),convId=panel.dataset.conversationId,input=$('bcChatInput'),body=input.value.trim();if(!convId||!body)return;const btn=e.submitter||panel.querySelector('button[type=submit]');if(btn)btn.disabled=true;try{const {error}=await sb.rpc('send_direct_message',{p_conversation_id:convId,p_body:body});if(error)throw error;input.value='';await loadDirectMessages(convId);}catch(error){console.error(error);toast(error.message||pt('chat_error'));}finally{if(btn)btn.disabled=false;}});
async function init(){
 updateStaticLanguage();if(!sb?.auth){feed.innerHTML=`<div class="bc-post-error">${esc(t('loadError'))}</div>`;return;}
 const {data:{user}}=await sb.auth.getUser();viewer=user||null;await loadPosts(true);if(!publicProfileId)await focusSharedPost();if(!publicProfileId)subscribeFeed();else await initPublicMemberProfile();
 const paramsNow=new URLSearchParams(location.search);if(paramsNow.get('new'))toast(lang()==='en'?'Your PasteLink has been published.':'PasteLink berhasil dipublikasikan.');
}
init().catch(error=>{console.error('Social page init failed:',error);feed.innerHTML=`<div class="bc-post-error">${esc(t('loadError'))}</div>`;});
})();
