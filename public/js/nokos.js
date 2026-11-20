(()=>{
 'use strict';
 const feed=document.getElementById('nokosChatMessages'),form=document.getElementById('nokosChatForm');
 const input=document.getElementById('nokosChatInput'),send=form?.querySelector('button');
 if(!feed||!form||!input||!send)return;
 const HUB='https://chat.whatsapp.com/LCBrSdRWPWp2yk3pTeuMdM?s=cl&p=a&iam=2';
 let busy=false,stage='start',selectedApp='',selectedType='';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const scroll=()=>{feed.scrollTop=feed.scrollHeight;};
 function message(text,who='bot',actions=[]){
   const wrap=document.createElement('div');wrap.className=`nokos-msg ${who==='user'?'is-user':'is-bot'}`;
   const bubble=document.createElement('div');bubble.className='nokos-bubble';bubble.innerHTML=esc(text).replace(/\n/g,'<br>');wrap.appendChild(bubble);
   if(actions.length){const row=document.createElement('div');row.className='nokos-actions';actions.forEach(a=>{const el=document.createElement('button');el.type='button';el.textContent=a.label;el.addEventListener('click',a.run);row.appendChild(el);});wrap.appendChild(row);}
   feed.appendChild(wrap);scroll();
 }
 function typing(){const el=document.createElement('div');el.className='nokos-msg is-bot nokos-typing';el.innerHTML='<div class="nokos-bubble"><i></i><i></i><i></i></div>';feed.appendChild(el);scroll();return el;}
 function reply(text,actions=[],delay=450){
   if(busy)return;busy=true;input.disabled=true;send.disabled=true;const wait=typing();
   setTimeout(()=>{wait.remove();message(text,'bot',actions);busy=false;input.disabled=false;send.disabled=false;input.focus();},delay);
 }
 const apps=['Telegram','WhatsApp','Facebook','Gmail / Google','Instagram','TikTok','Discord','Aplikasi lainnya'];
 function appButtons(){return apps.map(app=>({label:app,run:()=>chooseApp(app)}));}
 function showStart(){stage='app';reply('Halo! Saya asisten layanan Ready Nokos. Pilih aplikasi yang kamu butuhkan. Kami akan bantu teruskan permintaan ke admin untuk pengecekan ketersediaan nomor dan OTP.',appButtons(),350);}
 function chooseApp(app){selectedApp=app;stage='type';message(app,'user');reply('Untuk '+app+', kamu membutuhkan layanan yang mana?',[
   {label:'Nomor siap pakai',run:()=>chooseType('Nomor siap pakai')},
   {label:'Kode OTP / Verifikasi',run:()=>chooseType('Kode OTP / Verifikasi')}
 ]);}
 function chooseType(type){selectedType=type;stage='country';message(type,'user');reply('Baik. Untuk '+selectedApp+' — '+selectedType+'. Sebutkan negara atau kode negara yang kamu inginkan. Jika belum tahu, ketik “bebas”.');}
 function sendToAdmin(){
   stage='done';
   reply('Permintaan kamu sudah dirangkum:\n• Aplikasi: '+selectedApp+'\n• Layanan: '+selectedType+'\n\nSilakan gabung ke grup WhatsApp resmi dan ikuti arahan admin. Admin akan memeriksa ketersediaan, harga, serta proses pesanan. Jangan kirim kata sandi atau OTP akun pribadi ke siapa pun.',[
    {label:'GABUNG GRUP WHATSAPP & HUBUNGI ADMIN',run:()=>window.open(HUB,'_blank','noopener,noreferrer')},
    {label:'Pilih layanan lain',run:()=>{selectedApp='';selectedType='';showStart();}}
   ],550);
 }
 function handle(raw){
   const v=raw.trim();if(!v||busy)return;message(v,'user');const q=v.toLowerCase();
   if(/^(mulai|menu|start|ulang|kembali)$/.test(q)){showStart();return;}
   if(stage==='app'){
     const found=apps.find(a=>a.toLowerCase()===q)||apps.find(a=>q.includes(a.toLowerCase()));
     if(found){chooseApp(found);return;}
     if(/otp|nomor|nokos|telegram|whatsapp|facebook|gmail|google|instagram|tiktok|discord/.test(q)){
       const app=apps.find(a=>q.includes(a.toLowerCase()))||(q.includes('google')?'Gmail / Google':q.includes('otp')?'Aplikasi lainnya':'');
       if(app){chooseApp(app);return;}
     }
     reply('Silakan pilih salah satu aplikasi berikut agar permintaanmu tercatat dengan benar.',appButtons());return;
   }
   if(stage==='type'){
     if(/otp|kode|verifikasi/.test(q)){chooseType('Kode OTP / Verifikasi');return;}
     if(/nomor|ready|siap pakai/.test(q)){chooseType('Nomor siap pakai');return;}
     reply('Pilih jenis layanan terlebih dahulu.',[
       {label:'Nomor siap pakai',run:()=>chooseType('Nomor siap pakai')},
       {label:'Kode OTP / Verifikasi',run:()=>chooseType('Kode OTP / Verifikasi')}
     ]);return;
   }
   if(stage==='country'){message('Negara/kode negara: '+v,'user');sendToAdmin();return;}
   if(stage==='done'){reply('Jika ingin membuat permintaan baru, tekan tombol “Pilih layanan lain”. Untuk melanjutkan pesanan, gabung grup WhatsApp resmi.',[
     {label:'GABUNG GRUP WHATSAPP',run:()=>window.open(HUB,'_blank','noopener,noreferrer')},
     {label:'Pilih layanan lain',run:showStart}
   ]);return;}
   showStart();
 }
 form.addEventListener('submit',e=>{e.preventDefault();const v=input.value;input.value='';handle(v);});
 // Input tetap bisa dipakai sejak awal; pesan pembuka tidak mengunci form.
 input.disabled=false;send.disabled=false;
 setTimeout(()=>{feed.innerHTML='';message('Selamat datang di layanan Ready Nokos.');showStart();},250);
})();