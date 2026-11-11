(() => {
 const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let admin=null, selected=null, rows=[];
 async function guard(){const {data:{user}}=await sb.auth.getUser();if(!user){location.replace('/login.html');return false;}const {data:p,error}=await sb.from('profiles').select('role,is_banned').eq('id',user.id).single();if(error||p?.role!=='admin'||p?.is_banned){location.replace('/dashboard.html');return false;}admin=user;return true;}
 async function loadList(){const box=$('#siConversations');const {data,error}=await sb.from('support_conversations').select('id,user_id,subject,status,created_at,updated_at').order('updated_at',{ascending:false});if(error){box.innerHTML='<p class="si-muted">Gagal memuat inbox. Jalankan SQL Support Chat di Supabase.</p>';console.error(error);return;}
 rows=data||[];if(!rows.length){box.innerHTML='<p class="si-muted">Belum ada pesan dari member.</p>';return;}
 // Profile lookups are intentionally separate and limited to the listed member IDs.
 const ids=[...new Set(rows.map(r=>r.user_id))];const {data:profiles}=await sb.from('profiles').select('id,full_name').in('id',ids);
 const map=new Map((profiles||[]).map(p=>[p.id,p]));
 box.innerHTML=rows.map(r=>{const p=map.get(r.user_id)||{};return `<button class="si-conv ${selected===r.id?'active':''}" data-id="${r.id}"><b>${esc(p.full_name||'Member')}</b><small>ID ${esc(r.user_id)} · ${new Date(r.updated_at).toLocaleString('id-ID')}</small><p>${esc(r.subject||'Chat Support')} · ${esc(r.status)}</p></button>`}).join('');
 box.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>openConversation(b.dataset.id)));
 }
 async function openConversation(id){selected=id;const row=rows.find(x=>x.id===id);$('#siChatHead').innerHTML=`<div class="si-chat-title"><div><b>${esc(row?.subject||'Chat Support')}</b><span>Member ID: ${esc(row?.user_id||'')}</span></div><button class="si-delete-chat" id="siDeleteChat"><i class="fa-solid fa-trash"></i> Hapus Chat</button></div>`;$('#siDeleteChat').onclick=deleteConversation;$('#siReplyForm').hidden=false;await loadMessages();await loadList();}
 async function loadMessages(){if(!selected)return;const {data,error}=await sb.from('support_messages').select('id,sender_id,body,created_at,edited_at').eq('conversation_id',selected).order('created_at',{ascending:true});if(error){console.error(error);return;}
 const el=$('#siMessages');if(!data?.length){el.innerHTML='<div class="si-empty">Belum ada pesan di percakapan ini.</div>';return;}
 el.innerHTML=data.map(m=>{const own=m.sender_id===admin.id;return `<article class="si-msg ${own?'admin':''}" data-msg="${m.id}"><div class="si-body">${esc(m.body)}</div><small>${own?'Admin':'Member'} · ${new Date(m.created_at).toLocaleString('id-ID')}${m.edited_at?' · diedit':''}</small><div class="si-msg-actions"><button data-edit="${m.id}"><i class="fa-solid fa-pen"></i> Edit</button><button class="delete" data-delete="${m.id}"><i class="fa-solid fa-trash"></i> Hapus</button></div></article>`}).join('');
 el.scrollTop=el.scrollHeight;
 el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editMessage(b.dataset.edit,data.find(m=>m.id===b.dataset.edit)));
 el.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteMessage(b.dataset.delete));
 }
 async function editMessage(id,m){const next=prompt('Edit pesan admin:',m?.body||'');if(next===null)return;if(!next.trim())return alert('Pesan tidak boleh kosong.');const {error}=await sb.from('support_messages').update({body:next.trim(),edited_at:new Date().toISOString()}).eq('id',id);if(error)alert('Gagal mengedit pesan.');else await loadMessages();}
 async function deleteConversation(){if(!selected||!confirm('Hapus seluruh percakapan ini beserta semua pesannya?'))return;const id=selected;const {error}=await sb.from('support_conversations').delete().eq('id',id);if(error){alert('Gagal menghapus percakapan.');return;}selected=null;$('#siReplyForm').hidden=true;$('#siChatHead').innerHTML='<b>Pilih percakapan</b><span>Pesan member akan tampil di sini.</span>';$('#siMessages').innerHTML='<div class="si-empty">Percakapan telah dihapus.</div>';await loadList();}
 async function deleteMessage(id){if(!confirm('Hapus pesan ini?'))return;const {error}=await sb.from('support_messages').delete().eq('id',id);if(error)alert('Gagal menghapus pesan.');else await loadMessages();}
 $('#siReplyForm').addEventListener('submit',async e=>{e.preventDefault();if(!selected)return;const input=$('#siReply'),body=input.value.trim();if(!body)return;const btn=e.submitter;btn.disabled=true;const {error}=await sb.from('support_messages').insert({conversation_id:selected,sender_id:admin.id,body});if(error)alert('Balasan gagal dikirim.');else{input.value='';await loadMessages();await sb.from('support_conversations').update({updated_at:new Date().toISOString()}).eq('id',selected);await loadList();}btn.disabled=false;});
 $('#siRefresh').onclick=loadList;
 (async()=>{if(await guard()){await loadList();setInterval(async()=>{await loadList();if(selected)await loadMessages();},7000);}})();
})();