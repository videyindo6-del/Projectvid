(()=>{'use strict';
const $=id=>document.getElementById(id);
const msg=(t,e=false)=>{$('alCreateMessage').innerHTML=`<div class="al-alert ${e?'error':''}" role="status">${t}</div>`;};
const copy=async value=>{try{await navigator.clipboard.writeText(value);return true;}catch(_){const x=document.createElement('textarea');x.value=value;x.setAttribute('readonly','');x.style.position='fixed';x.style.opacity='0';document.body.appendChild(x);x.select();const ok=document.execCommand('copy');x.remove();return ok;}};
$('alCreateForm')?.addEventListener('submit',async e=>{e.preventDefault();const b=$('alPublish');b.disabled=true;
try{
 if(!window.sb?.auth)throw Error('Supabase belum siap. Muat ulang halaman.');
 const {data:{session},error:sessionError}=await sb.auth.getSession();if(sessionError)throw sessionError;if(!session)throw Error('Silakan login terlebih dahulu.');
 const r=await fetch('/api/autolink?action=publish',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({target_url:$('alTarget').value.trim(),title:$('alTitle').value.trim(),description:$('alDescription').value.trim()})});
 const d=await r.json().catch(()=>({}));if(!r.ok||!d.success||!d.url)throw Error(d.error||'Gagal memublikasikan AutoLink');
 const url=new URL(d.url,location.origin).href;
 $('alPublished').hidden=false;
 $('alPublished').innerHTML=`<div class="al-alert" role="status"><i class="fa-solid fa-circle-check"></i> AutoLink berhasil dibuat dan dipublikasikan!</div><h2>Link pendek kamu</h2><div class="al-field"><input id="alPublishedUrl" readonly value="${url.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></div><div class="al-actions"><button type="button" class="al-btn" id="alCopyPublished"><i class="fa-regular fa-copy"></i> Salin Link</button><button type="button" class="al-btn secondary" id="alSharePublished"><i class="fa-solid fa-share"></i> Bagikan</button><a class="al-btn ghost" href="https://wa.me/?text=${encodeURIComponent(url)}" target="_blank" rel="noopener">WhatsApp</a><a class="al-btn ghost" href="https://t.me/share/url?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Telegram</a><a class="al-btn ghost" href="${url}" target="_blank" rel="noopener">Buka Link</a></div>`;
 $('alCopyPublished').onclick=async()=>{const ok=await copy(url);msg(ok?'Link berhasil disalin.':'Gagal menyalin link. Silakan salin manual.',!ok);};
 $('alSharePublished').onclick=async()=>{try{if(navigator.share)await navigator.share({title:d.autolink?.title||'AutoLink BoxCellink',url});else{const ok=await copy(url);msg(ok?'Link berhasil disalin.':'Gagal menyalin link.',!ok);}}catch(err){if(err.name!=='AbortError')msg(err.message||'Gagal membagikan link.',true);}};
 $('alCreateForm').reset();$('alPublished').scrollIntoView({behavior:'smooth',block:'center'});
}catch(x){msg(String(x.message||x),true);}finally{b.disabled=false;}
});})();
