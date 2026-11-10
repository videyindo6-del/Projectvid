(() => {
  if (window.__boxcellinkSupportLoaded) return;
  window.__boxcellinkSupportLoaded = true;
  const $ = (s, r=document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css = document.createElement('link'); css.rel='stylesheet'; css.href='/css/support-widget.css'; document.head.appendChild(css);

  const path=(location.pathname||'').toLowerCase();
  if (/\/(admin|admin-vip|review-admin|telegram-admin|users|payments|support-inbox)(\.html)?$/.test(path)) return;
  if (!window.sb?.auth || !window.sb?.from) return;

  const groupUrl='https://t.me/+03WCfVAwaWUzZTkx';
  // Channel URL can be configured without editing this file.
  const channelUrl=window.BOXCELLINK_TELEGRAM_CHANNEL_URL || '';
  const root=document.createElement('div'); root.id='bc-support-root';
  root.innerHTML=`
    <div class="bc-support-menu" id="bcSupportMenu" aria-hidden="true">
      <a class="bc-support-choice bc-support-admin" href="#" id="bcSupportChat"><span class="bc-support-choice-icon"><i class="fa-solid fa-headset"></i></span><span>Chat Support Admin</span></a>
      <a class="bc-support-choice bc-support-channel" href="${channelUrl ? esc(channelUrl) : '#'}" ${channelUrl ? 'target="_blank" rel="noopener"' : 'aria-disabled="true"'}><span class="bc-support-choice-icon"><i class="fa-brands fa-telegram"></i></span><span>Channel Telegram</span></a>
      <a class="bc-support-choice bc-support-group" href="${groupUrl}" target="_blank" rel="noopener"><span class="bc-support-choice-icon"><i class="fa-brands fa-telegram"></i></span><span>Group Chat Telegram</span></a>
    </div>
    <button class="bc-support-toggle" id="bcSupportToggle" aria-label="Buka menu support" aria-expanded="false"><i class="fa-solid fa-comments"></i></button>
    <section class="bc-support-chat" id="bcSupportPanel" aria-label="Chat Support Admin" hidden>
      <header><div><b><i class="fa-solid fa-headset"></i> Chat Support Admin</b><small>Tim bantuan Boxcelink</small></div><button id="bcSupportClose" aria-label="Tutup chat"><i class="fa-solid fa-xmark"></i></button></header>
      <div class="bc-support-messages" id="bcSupportMessages"><div class="bc-support-empty">Memuat percakapan...</div></div>
      <form id="bcSupportForm"><input id="bcSupportInput" maxlength="4000" placeholder="Tulis pesan..." autocomplete="off" required><button aria-label="Kirim pesan"><i class="fa-solid fa-paper-plane"></i></button></form>
      <div class="bc-support-foot" id="bcSupportFoot"></div>
    </section>`;
  document.body.appendChild(root);

  const toggle=$('#bcSupportToggle'), menu=$('#bcSupportMenu'), panel=$('#bcSupportPanel');
  toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));toggle.innerHTML=open?'<i class="fa-solid fa-comments"></i>':'<i class="fa-solid fa-xmark"></i>';toggle.setAttribute('aria-label',open?'Buka menu support':'Tutup menu support');menu.classList.toggle('is-open',!open);menu.setAttribute('aria-hidden',String(open));});
  $('#bcSupportChat').addEventListener('click',async e=>{e.preventDefault();panel.hidden=false;menu.classList.remove('is-open');menu.setAttribute('aria-hidden','true');toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<i class="fa-solid fa-comments"></i>';toggle.setAttribute('aria-label','Buka menu support');await loadChat();});
  $('#bcSupportClose').addEventListener('click',()=>panel.hidden=true);

  let currentUser=null, conversation=null, busy=false, refreshTimer=null;
  const messagesEl=$('#bcSupportMessages'), foot=$('#bcSupportFoot');
  async function loadChat(){
    const {data:{user},error}=await sb.auth.getUser(); currentUser=user;
    if(error||!user){messagesEl.innerHTML='<div class="bc-support-empty">Silakan masuk ke akun untuk mengirim pesan ke admin.</div>';$('#bcSupportForm').hidden=true;foot.innerHTML='<a href="/login.html">Masuk ke akun</a>';return;}
    $('#bcSupportForm').hidden=false;foot.textContent='Pesan hanya dapat dilihat oleh Anda dan admin.';
    const {data:rows,error:findErr}=await sb.from('support_conversations').select('id,status').eq('user_id',user.id).order('updated_at',{ascending:false}).limit(1);
    if(findErr){messagesEl.innerHTML='<div class="bc-support-empty">Fitur chat belum siap. Pastikan SQL Support Chat sudah dijalankan di Supabase.</div>';return;}
    conversation=rows?.[0]||null;
    if(!conversation){
      const {data:newRow,error:createErr}=await sb.from('support_conversations').insert({user_id:user.id,subject:'Chat Support'}).select('id,status').single();
      if(createErr){messagesEl.innerHTML='<div class="bc-support-empty">Tidak dapat memulai chat. Silakan coba lagi.</div>';console.error(createErr);return;}
      conversation=newRow;
    }
    await renderMessages();
    if(refreshTimer)clearInterval(refreshTimer);
    refreshTimer=setInterval(renderMessages,5000);
  }
  async function renderMessages(){
    if(!conversation)return;
    const {data,error}=await sb.from('support_messages').select('id,sender_id,body,created_at,edited_at').eq('conversation_id',conversation.id).order('created_at',{ascending:true});
    if(error){console.warn(error);return;}
    if(!data?.length){messagesEl.innerHTML='<div class="bc-support-empty">Belum ada pesan. Silakan sampaikan kebutuhan bantuan Anda.</div>';return;}
    messagesEl.innerHTML=data.map(m=>`<div class="bc-support-bubble ${m.sender_id===currentUser?.id?'mine':'theirs'}"><div>${esc(m.body)}</div><small>${m.sender_id===currentUser?.id?'Anda':'Admin'} · ${new Date(m.created_at).toLocaleString('id-ID')}${m.edited_at?' · diedit':''}</small></div>`).join('');
    messagesEl.scrollTop=messagesEl.scrollHeight;
  }
  $('#bcSupportForm').addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!conversation||!currentUser)return;
    const input=$('#bcSupportInput'),body=input.value.trim();if(!body)return;busy=true;
    const btn=$('#bcSupportForm button');btn.disabled=true;
    const {error}=await sb.from('support_messages').insert({conversation_id:conversation.id,sender_id:currentUser.id,body});
    if(error){foot.textContent='Pesan gagal dikirim. Coba lagi.';console.error(error);}else{input.value='';await renderMessages();}
    btn.disabled=false;busy=false;
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&& !panel.hidden)renderMessages();});
})();