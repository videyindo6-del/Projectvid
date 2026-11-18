(()=>{
 'use strict';
 const feed=document.getElementById('nokosChatMessages'),form=document.getElementById('nokosChatForm');
 const input=document.getElementById('nokosChatInput'),send=form?.querySelector('button');
 if(!feed||!form||!input||!send)return;
 const HUB='https://chat.whatsapp.com/LCBrSdRWPWp2yk3pTeuMdM?s=cl&p=a&iam=2';
 let busy=false,stage='start',lastService='';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const scroll=()=>{feed.scrollTop=feed.scrollHeight;};
 function message(text,who='bot',actions=[]){
   const wrap=document.createElement('div');wrap.className=`nokos-msg ${who==='user'?'is-user':'is-bot'}`;
   const bubble=document.createElement('div');bubble.className='nokos-bubble';bubble.innerHTML=esc(text).replace(/\n/g,'<br>');wrap.appendChild(bubble);
   if(actions.length){const row=document.createElement('div');row.className='nokos-actions';actions.forEach(a=>{const el=document.createElement('button');el.type='button';el.textContent=a.label;el.addEventListener('click',a.run);row.appendChild(el);});wrap.appendChild(row);}
   feed.appendChild(wrap);scroll();
 }
 function typing(){const el=document.createElement('div');el.className='nokos-msg is-bot nokos-typing';el.innerHTML='<div class="nokos-bubble"><i></i><i></i><i></i></div>';feed.appendChild(el);scroll();return el;}
 function reply(text,actions=[],delay=850){if(busy)return;busy=true;input.disabled=true;send.disabled=true;const wait=typing();setTimeout(()=>{wait.remove();message(text,'bot',actions);busy=false;input.disabled=false;send.disabled=false;input.focus();},delay);}
 function hub(){reply('Oke Ready, Silahkan Langsung Masuk Kesini dan mengikuti Aturan Dan Privasi.\nJangan Percayakan Yang Mengatasnamakan Kita.',[{label:'Hub Admin / Gabung Grup',run:()=>window.open(HUB,'_blank','noopener,noreferrer')}],700);}
 function showStart(){reply('🌐 Layanan Tersedia\n\n➡️ Telegram\nPembelian nomor Telegram yang siap pakai\n\n➡️ Layanan Lain\nPembelian OTP berbagai aplikasi seperti WhatsApp, Google, dan Facebook',[
  {label:'Telegram',run:telegram},{label:'Layanan Lain',run:other}
],900);}
 function telegram(){stage='telegram-country';reply('Syarat & Ketentuan:\n——————————————\n• Nomor yang dibeli tidak dapat dikembalikan\n• Kami tidak bertanggung jawab atas penyalahgunaan nomor\n• Dilarang menghapus akun secara permanen\n• Perangkat/server tidak dikeluarkan\n• Akun dapat terkena pembatasan jika melanggar aturan aplikasi\n\nKalian wajib membaca informasi tersebut untuk menghindari masalah di kemudian hari.',[],900);setTimeout(()=>{if(stage==='telegram-country')reply('Silahkan Beritahu saya negara mana atau nomor mana yang anda mau.',[],3000);},950);}
 function other(){stage='other-app';reply('Silahkan Kirim atau beritahu saya Aplikasi Yang Anda Mau.',[],800);}
 function handle(raw){
   const v=raw.trim();if(!v||busy)return;message(v,'user');
   const q=v.toLowerCase();
   if(/^(telegram|tele|tg)$/.test(q)){telegram();return;}
   if(/^(layanan lain|lainnya|other)$/.test(q)){other();return;}
   if(stage==='start'){if(/whatsapp|google|facebook|instagram|tiktok|discord|aplikasi|otp/.test(q)){stage='other-app';reply('Silahkan Kirim atau beritahu saya Aplikasi Yang Anda Mau.');}else{showStart();}return;}
   if(stage==='other-app'){
     if(/^(hai|halo|hello|p|test|tes)$/.test(q)){reply('Halo! Saya bantu arahkan. Aplikasi apa yang kamu cari?');return;}
     lastService=v;stage='other-country';reply('Untuk '+v+', silahkan kirim negara mana yang anda mau karena setiap negara memiliki harga dan ketersediaan yang berbeda.');return;
   }
   if(stage==='telegram-country'||stage==='other-country'){stage='hub';hub();return;}
   if(/nomor|no.?kos|otp|kode|negara|country|telegram|whatsapp|google|facebook|harga|beli|pesan|aplikasi|ready/.test(q)){stage='hub';hub();return;}
   if(/anjing|babi|kontol|memek|ngentot|fuck|bitch|porno|jorok/.test(q)){reply('Mari gunakan bahasa yang sopan agar kami bisa membantu dengan baik. Jika ingin konsultasi nomor atau OTP, silakan hubungi admin melalui grup resmi.',[{label:'Hub Admin / Gabung Grup',run:()=>window.open(HUB,'_blank','noopener,noreferrer')}]);return;}
   reply('Saya siap membantu pertanyaan seputar layanan nomor dan OTP. Silahkan pilih layanan yang ingin ditanyakan.',[{label:'Telegram',run:telegram},{label:'Layanan Lain',run:other},{label:'Hub Admin',run:()=>window.open(HUB,'_blank','noopener,noreferrer')}]);
 }
 form.addEventListener('submit',e=>{e.preventDefault();const v=input.value;input.value='';handle(v);});
 setTimeout(()=>{feed.innerHTML='';message('Halo! Selamat datang di layanan Ready Nokos. Saya akan membantu menanyakan kebutuhan kamu.');showStart();},1100);
})();