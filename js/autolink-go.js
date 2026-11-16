(()=>{'use strict';
const $=id=>document.getElementById(id);
const pathCode=location.pathname.split('/').filter(Boolean).pop()||'';
const code=decodeURIComponent((new URLSearchParams(location.search).get('slug')||(pathCode.toLowerCase()==='go.html'?'':pathCode)).trim());
let item=null;
const api=(action,body)=>fetch('/api/autolink?action='+action,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Request gagal');return d;});
function showEndorseInfo(label){
  let modal=$('alEndorseModal');
  if(!modal){
    modal=document.createElement('div');modal.id='alEndorseModal';modal.className='al-modal';modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<div class="al-modal-backdrop" data-close="1"></div><section class="al-modal-panel" role="dialog" aria-modal="true" aria-labelledby="alEndorseModalTitle"><button class="al-modal-close" type="button" aria-label="Tutup" data-close="1"><i class="fa-solid fa-xmark"></i></button><span class="al-modal-icon"><i class="fa-solid fa-bullhorn"></i></span><span class="al-kicker">PROMOSI DI BOXCELLINK</span><h2 id="alEndorseModalTitle">Pasang Endorse Anda</h2><p class="al-modal-copy"></p><div class="al-modal-steps"><div><b>1</b><span><strong>Login ke akun</strong><small>Masuk menggunakan akun BoxCellink Anda.</small></span></div><div><b>2</b><span><strong>Buka menu Endorse</strong><small>Pilih menu Endorse dari navigasi akun.</small></span></div><div><b>3</b><span><strong>Pilih slot dan ajukan</strong><small>Pilih posisi yang diinginkan, lalu kirim pengajuan endorse.</small></span></div></div><a class="al-btn al-modal-login" href="/login.html"><i class="fa-solid fa-right-to-bracket"></i> Login untuk Mengajukan</a><p class="al-modal-foot">Pengajuan akan diproses sesuai ketentuan BoxCellink.</p></section>`;
    document.body.append(modal);
    modal.addEventListener('click',e=>{if(e.target.closest('[data-close]')){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}});
  }
  modal.querySelector('.al-modal-copy').textContent=`Slot ${label} sedang tersedia. Ingin menampilkan promosi Anda di halaman AutoLink? Login terlebih dahulu, lalu buka menu Endorse dan pilih slot ${label} untuk mengajukan penempatan.`;
  const login=modal.querySelector('.al-modal-login');
  login.href='/login.html?next='+encodeURIComponent(location.pathname+location.search);
  modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');
}
function slot(el,slotName,label){
  if(!el)return;
  el.addEventListener('click',()=>{if(el.classList.contains('al-endorse-empty'))showEndorseInfo(label);});
  if(!window.sb)return;
  window.sb.from('endorse_settings').select('*').eq('slot',slotName).eq('active',true).maybeSingle().then(({data,error})=>{
    if(error||!data||(data.starts_at&&Date.parse(data.starts_at)>Date.now())||(data.ends_at&&Date.parse(data.ends_at)<Date.now()))return;
    el.innerHTML='';
    el.classList.remove('al-endorse-empty');
    if(data.content_type==='image'&&data.media_url){const img=document.createElement('img');img.src=data.media_url;img.alt='Endorse';el.append(img);}
    else if(data.content_type==='video'&&data.media_url){const v=document.createElement('video');v.src=data.media_url;v.controls=true;v.playsInline=true;el.append(v);}
    else if(data.content_type==='html'&&data.embed_html){const frame=document.createElement('iframe');frame.sandbox='allow-scripts allow-forms allow-popups';frame.srcdoc=data.embed_html;frame.title='Endorse';frame.style='width:100%;min-height:120px;border:0';el.append(frame);}
    if(data.target_url){el.style.cursor='pointer';el.onclick=()=>window.open(data.target_url,'_blank','noopener,noreferrer');}
  }).catch(()=>{});
}
async function start(){
  try{
    const r=await fetch('/api/autolink?action=resolve&code='+encodeURIComponent(code));
    const d=await r.json();if(!r.ok)throw Error(d.error||'AutoLink tidak dapat dimuat');
    item=d.autolink;
    $('alGoTitle').textContent=item.title||'AutoLink';
    $('alGoDescription').textContent=item.description||'Pilih metode akses untuk melanjutkan.';
    slot($('alGoTop'),'go_top','Endorse Atas');
    slot($('alGoMiddle'),'go_middle','Endorse Tengah');
    slot($('alGoBottom'),'go_bottom','Endorse Bawah');
  }catch(e){
    $('alGoTitle').textContent='AutoLink tidak ditemukan';
    $('alGoDescription').textContent=e.message;
    $('alFree').disabled=true;$('alDirect').disabled=true;
  }
}
async function createSession(){
  const {data:{session}}=await window.sb.auth.getSession();
  const visitor=localStorage.getItem('al_visitor')||(localStorage.setItem('al_visitor',crypto.randomUUID()),localStorage.getItem('al_visitor'));
  const d=await fetch('/api/autolink?action=start',{method:'POST',headers:{'content-type':'application/json',...(session?.access_token?{authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({code,visitor})}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Gagal memulai akses');return x;});
  sessionStorage.setItem('al_session',JSON.stringify({id:d.session_id,token:d.token,code}));
  return d;
}
$('alFree').onclick=async()=>{try{$('alFree').disabled=true;const d=await createSession();location.href='/task'+(d.vip?3:1)+'.html?code='+encodeURIComponent(code);}catch(e){$('alGoMessage').innerHTML=`<div class="al-alert error">${e.message}</div>`;$('alFree').disabled=false;}};
$('alDirect').onclick=()=>location.href='/autolink-payment.html?code='+encodeURIComponent(code);
start();
})();