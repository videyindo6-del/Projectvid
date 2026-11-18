(()=>{'use strict';
const $=id=>document.getElementById(id);
const pages=[
 ['watch','Halaman Watch','dual'],
 ['review','Halaman Review Media','dual'],
 ['telegram','Halaman Telegram','single'],
 ['review_detail','Halaman Detail Review','dual'],
 ['widget','Widget Support (ikon komunitas)','dual']
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let settings={};
async function init(){
 if(!window.sb){$('saveStatus').textContent='Supabase belum siap.';return}
 const {data:{user}}=await sb.auth.getUser();
 if(!user){location.href='/login.html';return}
 const {data:p}=await sb.from('profiles').select('role,is_banned').eq('id',user.id).single();
 if(p?.role!=='admin'||p?.is_banned){location.href='/dashboard.html';return}
 const {data,error}=await sb.from('site_link_settings').select('key,value');
 if(error){$('saveStatus').textContent='Gagal memuat: '+error.message+'. Jalankan SQL migrasi.';return}
 for(const r of data||[])settings[r.key]=r.value||{};
 $('main_whatsapp').value=settings.main_whatsapp?.url||'';
 $('main_telegram').value=settings.main_telegram?.url||'';
 $('noticePanels').innerHTML=pages.map(([k,t,type])=>{
  const n=settings['notice_'+k]||{};
  if(type==='dual') return `<section class="panel">
   <h2>${t}</h2>
   <label class="switch"><input type="checkbox" id="${k}_enabled" ${n.enabled?'checked':''}> Aktifkan notifikasi di lokasi ini</label>
   <label>Judul notifikasi<input id="${k}_title" maxlength="120" value="${esc(n.title||'Gabung komunitas resmi')}"></label>
   <label>Deskripsi<textarea id="${k}_description" maxlength="500">${esc(n.description||'Dapatkan informasi dan update terbaru BoxCellink.')}</textarea></label>
   <div class="row">
    <label>Link Telegram<input id="${k}_telegram_url" type="url" value="${esc(n.telegram_url||'')}" placeholder="https://t.me/..."></label>
    <label>Teks tombol Telegram<input id="${k}_telegram_button" maxlength="60" value="${esc(n.telegram_button||'Gabung Telegram')}"></label>
   </div>
   <div class="row">
    <label>Link WhatsApp<input id="${k}_whatsapp_url" type="url" value="${esc(n.whatsapp_url||'')}" placeholder="https://whatsapp.com/channel/..."></label>
    <label>Teks tombol WhatsApp<input id="${k}_whatsapp_button" maxlength="60" value="${esc(n.whatsapp_button||'Gabung WhatsApp')}"></label>
   </div>
   <label>Link YouTube<input id="${k}_youtube_url" type="url" value="${esc(n.youtube_url||'')}" placeholder="https://youtube.com/@channel"></label>
   <p class="muted">Ikon Telegram ditampilkan di kiri. Ikon WhatsApp dan YouTube ditampilkan di kanan (YouTube di bawah WhatsApp). Link dan notifikasi di bagian ini hanya berlaku untuk ${t}. Kosongkan salah satu link jika kanal tersebut tidak ingin ditampilkan.</p>
  </section>`;
  return `<section class="panel"><h2>${t}</h2>
   <label class="switch"><input type="checkbox" id="${k}_enabled" ${n.enabled?'checked':''}> Aktifkan notifikasi di halaman ini</label>
   <div class="row"><label>Jenis kanal<select id="${k}_channel"><option value="telegram" ${n.channel==='telegram'?'selected':''}>Telegram</option><option value="whatsapp" ${n.channel==='whatsapp'?'selected':''}>WhatsApp</option></select></label><label>Judul<input id="${k}_title" maxlength="120" value="${esc(n.title||'')}"></label></div>
   <label>Deskripsi / isi<textarea id="${k}_description" maxlength="500">${esc(n.description||'')}</textarea></label>
   <div class="row"><label>Teks tombol<input id="${k}_button" maxlength="60" value="${esc(n.button||'Gabung sekarang')}"></label><label>Link tujuan<input id="${k}_url" type="url" value="${esc(n.url||'')}" placeholder="https://..."></label></div>
  </section>`;
 }).join('');
 $('settingsForm').onsubmit=save;
}
async function save(e){
 e.preventDefault();$('saveStatus').textContent='Menyimpan...';
 const rows=[['main_whatsapp',{url:$('main_whatsapp').value.trim()}],['main_telegram',{url:$('main_telegram').value.trim()}]];
 for(const [k,,type] of pages){
  let value;
  if(type==='dual') value={
   enabled:$(k+'_enabled').checked,title:$(k+'_title').value.trim(),description:$(k+'_description').value.trim(),
   telegram_url:$(k+'_telegram_url').value.trim(),telegram_button:$(k+'_telegram_button').value.trim(),
   whatsapp_url:$(k+'_whatsapp_url').value.trim(),whatsapp_button:$(k+'_whatsapp_button').value.trim(),
   youtube_url:$(k+'_youtube_url').value.trim()
  };
  else value={enabled:$(k+'_enabled').checked,channel:$(k+'_channel').value,title:$(k+'_title').value.trim(),description:$(k+'_description').value.trim(),button:$(k+'_button').value.trim(),url:$(k+'_url').value.trim()};
  rows.push(['notice_'+k,value]);
 }
 for(const [key,value] of rows){
  const {error}=await sb.from('site_link_settings').upsert({key,value,updated_at:new Date().toISOString()},{onConflict:'key'});
  if(error){$('saveStatus').textContent='Gagal menyimpan '+key+': '+error.message;return}
 }
 $('saveStatus').textContent='Pengaturan berhasil disimpan.';
}
init().catch(e=>$('saveStatus').textContent=e.message);
})();