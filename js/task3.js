(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code){location.replace('/x/'+encodeURIComponent(code));return;}
const API='/api/autolink?action=';
const COMMUNITY=window.BOXCELLINK_COMMUNITY_LINKS||{};
const TELE=COMMUNITY.telegram?.url||'';
const WA=COMMUNITY.whatsapp?.url||'';
const setCommunityHref=(id,url)=>{const el=$(id);if(el&&url)el.href=url;};
setCommunityHref('task3Telegram',TELE);
setCommunityHref('task3Whatsapp',WA);
setCommunityHref('task3TelegramNoticeJoin',TELE);
setCommunityHref('task3WhatsappNoticeJoin',WA);
const SPONSOR='https://www.profitableratecpmnetwork.com/vw721j6q?key=e997cbbb9bbee0de7820bd0c98fc8351';
let progressIndex=12,busy=false,telegramOpened=false,whatsappOpened=false;
const post=async(action,payload={})=>{const r=await fetch(API+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token,...payload})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Permintaan belum berhasil');return d;};
const advance=async(next)=>{const d=await post('advance',{next_index:next});progressIndex=d.progress_index;return d;};
const setText=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
const show=(id,on=true)=>{const el=$(id);if(el)el.hidden=!on;};
const lockPanel=(id,locked)=>$(id)?.classList.toggle('is-locked',locked);
const paintStepper=()=>{
 for(let n=1;n<=3;n++){
  const done=progressIndex>=12+n,active=progressIndex===11+n;
  $('stepper'+n)?.classList.toggle('is-done',done);
  $('stepper'+n)?.classList.toggle('is-active',active);
  setText('stepIcon'+n,done?'✓':String(n));
  if(n<3)$('stepLine'+n)?.classList.toggle('is-done',done);
 }
 lockPanel('task3Panel2',progressIndex<13);
 lockPanel('task3Panel3',progressIndex<14);
 $('task3RobotStart').disabled=progressIndex<13||progressIndex>=14;
 $('task3VerifyStart').disabled=progressIndex>=13;
 $('task3Done').disabled=progressIndex<14||!(telegramOpened&&whatsappOpened)||progressIndex>=15;
 if(progressIndex>=13){show('task3VerifySuccess');show('task3VerifyLoader',false);setText('task3VerifyStatus','Verifikasi awal telah tercatat.');}
 if(progressIndex>=14){show('task3ReactionSuccess');show('task3RobotLoader',false);setText('task3RobotStatus','Reaction telah tercatat.');}
 if(progressIndex>=15){setText('task3DoneStatus','Tahap akhir sudah tercatat.');}
};
const runTimer=async({seconds,loader,count,text,bar,phrases,finish})=>{
 if(busy)return;busy=true;show(loader);
 const b=$(bar),c=$(count),t=$(text);let left=seconds;
 const paint=()=>{if(c)c.textContent=String(left);if(b)b.style.width=((seconds-left)/seconds*100)+'%';if(t)t.textContent=phrases[(seconds-left)%phrases.length];};
 paint();
 await new Promise(resolve=>{const timer=setInterval(()=>{left=Math.max(0,left-1);paint();if(left===0){clearInterval(timer);resolve();}},1000);});
 try{await finish();}catch(e){const status=$('task3PageStatus');if(status)status.textContent=e.message||'Verifikasi belum berhasil. Silakan coba lagi.';throw e;}
 finally{busy=false;}
};
const safeRun=fn=>{Promise.resolve().then(fn).catch(e=>{console.warn(e);$('task3PageStatus').textContent=e.message||'Terjadi kendala. Silakan coba lagi.';});};

$('task3VerifyStart')?.addEventListener('click',()=>safeRun(async()=>{
 $('task3VerifyStart').disabled=true;
 try{await runTimer({seconds:10,loader:'task3VerifyLoader',count:'task3VerifyCount',text:'task3VerifyText',bar:'task3VerifyBar',phrases:['Mengecek tahap...','Memverifikasi...','Memeriksa sesi...','Menyiapkan reaction...'],finish:async()=>{await advance(13);show('task3VerifySuccess');setText('task3VerifyStatus','Verifikasi selesai. Langkah Reaction sudah terbuka.');paintStepper();}});}
 catch(e){$('task3VerifyStart').disabled=false;throw e;}
}));
$('task3RobotStart')?.addEventListener('click',()=>safeRun(async()=>{
 if(progressIndex!==13)return;
 $('task3RobotStart').disabled=true;
 try{
  await runTimer({seconds:5,loader:'task3RobotLoader',count:'task3RobotCount',text:'task3RobotText',bar:'task3RobotBar',phrases:['Mengecek aktivitas...','Memeriksa browser...','Memvalidasi sesi...'],finish:async()=>{
   show('task3SkipOverlay');loadAd($('task3SkipMount'),'896ad8ddb5ea1d057ac6d61226e3f54d',300,250);
   const skip=$('task3SkipButton'),label=$('task3SkipCount');let left=3;skip.disabled=true;skip.textContent='Lewati Iklan · '+left;label.textContent='Lewati dalam '+left+' detik';
   const timer=setInterval(()=>{left=Math.max(0,left-1);skip.textContent=left?'Lewati Iklan · '+left:'Lewati Iklan';label.textContent=left?'Lewati dalam '+left+' detik':'Iklan dapat dilewati';if(!left){clearInterval(timer);skip.disabled=false;}},1000);
   skip.onclick=async()=>{if(skip.disabled||busy)return;show('task3SkipOverlay',false);await runTimer({seconds:2,loader:'task3RobotLoader',count:'task3RobotCount',text:'task3RobotText',bar:'task3RobotBar',phrases:['Menyelesaikan pemeriksaan...','Menyiapkan langkah Done...'],finish:async()=>{await advance(14);show('task3ReactionSuccess');setText('task3RobotStatus','Reaction selesai. Langkah Done sudah terbuka.');paintStepper();}});};
  }});
 }catch(e){$('task3RobotStart').disabled=false;throw e;}
}));
const markOpened=(kind)=>{
 if(kind==='telegram'){telegramOpened=true;setText('task3TelegramLabel','Tautan grup sudah dibuka');$('task3TelegramMark').className='fa-solid fa-circle-check task3-check-mark';}
 if(kind==='whatsapp'){whatsappOpened=true;setText('task3WhatsappLabel','Tautan saluran sudah dibuka');$('task3WhatsappMark').className='fa-solid fa-circle-check task3-check-mark';}
 $('task3Done').disabled=!(telegramOpened&&whatsappOpened)||progressIndex<14;
};
$('task3Telegram')?.addEventListener('click',()=>markOpened('telegram'));
$('task3Whatsapp')?.addEventListener('click',()=>markOpened('whatsapp'));
$('task3Done')?.addEventListener('click',()=>safeRun(async()=>{
 if(progressIndex!==14||!telegramOpened||!whatsappOpened||busy)return;
 $('task3Done').disabled=true;
 try{await runTimer({seconds:10,loader:'task3DoneLoader',count:'task3DoneCount',text:'task3DoneText',bar:'task3DoneBar',phrases:['Memvalidasi tahap akhir...','Mengecek urutan task...','Menyimpan progres...','Menyiapkan halaman final...'],finish:async()=>{await advance(15);paintStepper();setText('task3DoneStatus','Semua tahap Task 3 selesai. Membuka halaman final...');location.assign('/final.html?code='+encodeURIComponent(code));}});}
 catch(e){$('task3Done').disabled=false;throw e;}
}));

// Status server dipakai agar refresh tidak mengulang nomor tahap yang sudah tercatat.
safeRun(async()=>{const d=await post('status');progressIndex=Number(d.progress_index||0);if(progressIndex<12){location.replace('/task1.html?code='+encodeURIComponent(code));return;}if(progressIndex>=15){location.replace('/final.html?code='+encodeURIComponent(code));return;}paintStepper();$('task3PageStatus').textContent='Sesi AutoLink aktif. Lanjutkan dari tahap yang belum selesai.';});

// Iklan banner menggunakan kode publisher yang disediakan. Iklan sponsor tidak menjadi syarat verifikasi.
function loadAd(mount,key,width,height){
 if(!mount||mount.dataset.loaded==='1')return;mount.dataset.loaded='1';
 const box=document.createElement('div');box.className='task3-ad-frame';box.style.width=width+'px';box.style.height=height+'px';mount.appendChild(box);
 const options=document.createElement('script');options.text=`window.atOptions={key:${JSON.stringify(key)},format:'iframe',height:${height},width:${width},params:{}};`;box.appendChild(options);
 const invoke=document.createElement('script');invoke.async=true;invoke.src='https://www.highrevenueformat.com/'+encodeURIComponent(key)+'/invoke.js';box.appendChild(invoke);
}
function loadNative(){const mount=$('task3NativeMount');if(!mount||mount.dataset.loaded)return;mount.dataset.loaded='1';const s=document.createElement('script');s.async=true;s.dataset.cfasync='false';s.src='https://pl32231888.profitableratecpmnetwork.com/d0c4535d3914ad4b2c4e09c4aa337646/invoke.js';mount.append(s);const d=document.createElement('div');d.id='container-d0c4535d3914ad4b2c4e09c4aa337646';mount.append(d);}
loadNative();loadAd($('task3BannerMount'),'e48004340d99ba399e04e57dd40239fa',320,50);

// Slide tetap tampil sampai X ditekan, lalu dicoba tampil lagi setelah 7 detik.
const slide=$('task3SlideAd');let slideTimer=null;
const showSlide=()=>{if(!slide)return;show('task3SlideAd');loadAd($('task3SlideMount'),'a658feb34047aeb8881f5e3dba68dd7d',160,300);};
setTimeout(showSlide,5000);
$('task3SlideClose')?.addEventListener('click',()=>{show('task3SlideAd',false);clearTimeout(slideTimer);slideTimer=setTimeout(showSlide,7000);});

// Popunder scripts are loaded once per Task 3 visit. The browser/provider controls whether a popunder is allowed.
['https://pl32231840.profitableratecpmnetwork.com/6a/04/a4/6a04a4d0015749a46994e2d7d16590df.js','https://pl32231845.profitableratecpmnetwork.com/63/28/51/6328510ed0ef36d32ce4589c0110531b.js'].forEach(src=>{const s=document.createElement('script');s.async=true;s.src=src;document.body.appendChild(s);});

// Notifikasi komunitas: Telegram 5 detik (kiri), WhatsApp 10 detik (kanan).
const dismiss=(dialog,float)=>{show(dialog,false);show(float,true);};
setTimeout(()=>show('task3TelegramNotice'),5000);
setTimeout(()=>show('task3WhatsappNotice'),10000);
$('task3TelegramNoticeJoin')?.addEventListener('click',()=>dismiss('task3TelegramNotice','task3TelegramFloat'));
$('task3TelegramNoticeDone')?.addEventListener('click',()=>dismiss('task3TelegramNotice','task3TelegramFloat'));
$('task3TelegramNoticeClose')?.addEventListener('click',()=>dismiss('task3TelegramNotice','task3TelegramFloat'));
$('task3TelegramFloat')?.addEventListener('click',()=>{if(TELE)window.open(TELE,'_blank','noopener,noreferrer');});
$('task3WhatsappNoticeJoin')?.addEventListener('click',()=>dismiss('task3WhatsappNotice','task3WhatsappFloat'));
$('task3WhatsappNoticeDone')?.addEventListener('click',()=>dismiss('task3WhatsappNotice','task3WhatsappFloat'));
$('task3WhatsappNoticeClose')?.addEventListener('click',()=>dismiss('task3WhatsappNotice','task3WhatsappFloat'));
$('task3WhatsappFloat')?.addEventListener('click',()=>{if(WA)window.open(WA,'_blank','noopener,noreferrer');});
})();