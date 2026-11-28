(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code||!saved.id||!saved.token){location.replace('/x/'+encodeURIComponent(code));return;}
const API='/api/autolink?action=';
const COMMUNITY=window.BOXCELLINK_COMMUNITY_LINKS||{};
const TELE=COMMUNITY.telegram?.url||'';
const WA=COMMUNITY.whatsapp?.url||'';
let progressIndex=12,busy=false,telegramOpened=false,whatsappOpened=false;
const setText=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
const show=(id,on=true)=>{const el=$(id);if(el)el.hidden=!on;};
const lockPanel=(id,locked)=>$(id)?.classList.toggle('is-locked',locked);
const setCommunityHref=(id,url)=>{const el=$(id);if(el&&url)el.href=url;};
['task3Telegram','task3TelegramNoticeJoin'].forEach(id=>setCommunityHref(id,TELE));
['task3Whatsapp','task3WhatsappNoticeJoin'].forEach(id=>setCommunityHref(id,WA));
const post=async(action,payload={})=>{
  const response=await fetch(API+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token,...payload})});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'Permintaan belum berhasil');
  return data;
};
const advance=async(next)=>{
  if(next!==progressIndex+1)throw new Error('Urutan Task 3 tidak sesuai. Muat ulang halaman untuk menyelaraskan sesi.');
  const data=await post('advance',{next_index:next});
  progressIndex=Number(data.progress_index??next);saved.progress_index=progressIndex;
  try{sessionStorage.setItem('al_session',JSON.stringify(saved));}catch{}
  return data;
};
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
  if($('task3RobotStart'))$('task3RobotStart').disabled=progressIndex<13||progressIndex>=14||busy;
  if($('task3VerifyStart'))$('task3VerifyStart').disabled=progressIndex>=13||busy;
  if($('task3Done'))$('task3Done').disabled=progressIndex<14||!(telegramOpened&&whatsappOpened)||progressIndex>=15||busy;
  if(progressIndex>=13){show('task3VerifySuccess');show('task3VerifyLoader',false);setText('task3VerifyStatus','Verifikasi awal telah tercatat di server.');}
  if(progressIndex>=14){show('task3ReactionSuccess');show('task3RobotLoader',false);setText('task3RobotStatus','Reaction telah tercatat di server.');}
  if(progressIndex>=15)setText('task3DoneStatus','Tahap akhir sudah tercatat.');
};
const runTimer=async({seconds,loader,count,text,bar,phrases,finish})=>{
  if(busy)return;busy=true;show(loader);
  const progressBar=$(bar),counter=$(count),label=$(text);let left=seconds;
  const paint=()=>{if(counter)counter.textContent=String(left);if(progressBar)progressBar.style.width=((seconds-left)/seconds*100)+'%';if(label)label.textContent=phrases[(seconds-left)%phrases.length];};
  paint();
  try{
    await new Promise(resolve=>{const timer=window.setInterval(()=>{left=Math.max(0,left-1);paint();if(left===0){window.clearInterval(timer);resolve();}},1000);});
    await finish();
  }finally{busy=false;}
};
const safeRun=fn=>{Promise.resolve().then(fn).catch(error=>{console.warn(error);setText('task3PageStatus',error?.message||'Terjadi kendala. Silakan coba lagi.');paintStepper();});};

$('task3VerifyStart')?.addEventListener('click',()=>safeRun(async()=>{
  if(progressIndex!==12||busy)return;
  $('task3VerifyStart').disabled=true;
  try{
    await runTimer({seconds:10,loader:'task3VerifyLoader',count:'task3VerifyCount',text:'task3VerifyText',bar:'task3VerifyBar',phrases:['Mengecek tahap...','Memverifikasi sesi...','Memeriksa urutan...','Menyiapkan reaction...'],finish:async()=>{
      await advance(13);show('task3VerifySuccess');setText('task3VerifyStatus','Verifikasi selesai. Langkah Reaction sudah terbuka.');paintStepper();
    }});
  }catch(error){$('task3VerifyStart').disabled=false;throw error;}
}));

$('task3RobotStart')?.addEventListener('click',()=>safeRun(async()=>{
  if(progressIndex!==13||busy)return;
  $('task3RobotStart').disabled=true;
  try{
    await runTimer({seconds:5,loader:'task3RobotLoader',count:'task3RobotCount',text:'task3RobotText',bar:'task3RobotBar',phrases:['Mengecek aktivitas...','Memeriksa browser...','Memvalidasi sesi...'],finish:async()=>{
      show('task3SkipOverlay');
      window.BoxTaskAds?.mountBanner($('task3SkipMount'),'896ad8ddb5ea1d057ac6d61226e3f54d',300,250);
      const skip=$('task3SkipButton'),label=$('task3SkipCount');let left=3;
      skip.disabled=true;skip.textContent='Lewati Iklan · '+left;setText('task3SkipCount','Lewati dalam '+left+' detik');
      const timer=window.setInterval(()=>{
        left=Math.max(0,left-1);skip.textContent=left?'Lewati Iklan · '+left:'Lewati Iklan';
        setText('task3SkipCount',left?'Lewati dalam '+left+' detik':'Iklan dapat dilewati');
        if(!left){window.clearInterval(timer);skip.disabled=false;}
      },1000);
      skip.onclick=()=>{
        if(skip.disabled||busy)return;
        safeRun(async()=>{
          show('task3SkipOverlay',false);
          await runTimer({seconds:2,loader:'task3RobotLoader',count:'task3RobotCount',text:'task3RobotText',bar:'task3RobotBar',phrases:['Menyelesaikan pemeriksaan...','Menyiapkan langkah Done...'],finish:async()=>{
            await advance(14);show('task3ReactionSuccess');setText('task3RobotStatus','Reaction selesai. Langkah Done sudah terbuka.');paintStepper();
          }});
        });
      };
    }});
  }catch(error){$('task3RobotStart').disabled=false;throw error;}
}));

const markOpened=kind=>{
  if(kind==='telegram'){telegramOpened=true;setText('task3TelegramLabel','Tautan grup sudah dibuka');$('task3TelegramMark').className='fa-solid fa-circle-check task3-check-mark';}
  if(kind==='whatsapp'){whatsappOpened=true;setText('task3WhatsappLabel','Tautan saluran sudah dibuka');$('task3WhatsappMark').className='fa-solid fa-circle-check task3-check-mark';}
  paintStepper();
};
$('task3Telegram')?.addEventListener('click',()=>markOpened('telegram'));
$('task3Whatsapp')?.addEventListener('click',()=>markOpened('whatsapp'));
$('task3Done')?.addEventListener('click',()=>safeRun(async()=>{
  if(progressIndex!==14||!telegramOpened||!whatsappOpened||busy)return;
  $('task3Done').disabled=true;
  try{
    await runTimer({seconds:10,loader:'task3DoneLoader',count:'task3DoneCount',text:'task3DoneText',bar:'task3DoneBar',phrases:['Memvalidasi tahap akhir...','Mengecek urutan task...','Menyimpan progres...','Menyiapkan halaman final...'],finish:async()=>{
      await advance(15);paintStepper();setText('task3DoneStatus','Semua tahap Task 3 selesai. Membuka halaman final...');
      location.assign('/final.html?code='+encodeURIComponent(code));
    }});
  }catch(error){$('task3Done').disabled=false;throw error;}
}));

/* Ads and animated banners start only after the server confirms this is a valid Task 3 session. */
function startPageAds(){
  window.BoxVideoAdGate?.showTask3();
  window.BoxTaskAds?.start();
  window.BoxTaskAds?.mountBanner($('task3BannerMount'),'e48004340d99ba399e04e57dd40239fa',320,50);
  window.BoxTaskAds?.mountNative($('task3NativeMount'));
}

/* Community notice timing remains separate from AutoLink verification. */
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

(async()=>{
  try{
    const data=await post('status');progressIndex=Number(data.progress_index||0);
    if(progressIndex<12){location.replace((progressIndex<6?'/task1.html':'/task2.html')+'?code='+encodeURIComponent(code));return;}
    if(progressIndex>=15){location.replace('/final.html?code='+encodeURIComponent(code));return;}
    startPageAds();paintStepper();setText('task3PageStatus','Sesi AutoLink aktif. Lanjutkan dari langkah yang belum selesai.');
  }catch(error){
    setText('task3PageStatus',error?.message||'Sesi tidak valid. Silakan mulai kembali dari halaman AutoLink.');
    if(/sesi tidak valid|kedaluwarsa/i.test(error?.message||''))location.replace('/x/'+encodeURIComponent(code));
  }
})();
})();
