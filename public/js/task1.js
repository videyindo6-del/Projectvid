(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;
try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code||!saved.id||!saved.token){location.replace('/x/'+encodeURIComponent(code));return;}

let progressIndex=0,busy=false;
const setStatus=(id,message)=>{const el=$(id);if(el)el.textContent=message;};
const reveal=id=>{const el=$(id);if(el)el.hidden=false;};
const scrollTo=id=>$(id)?.scrollIntoView({behavior:'smooth',block:'center'});
const syncSaved=()=>{saved.progress_index=progressIndex;try{sessionStorage.setItem('al_session',JSON.stringify(saved));}catch{}};
const api=async(action,payload={})=>{
  const response=await fetch('/api/autolink?action='+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token,...payload})});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'Sesi AutoLink tidak dapat diverifikasi.');
  return data;
};
async function advance(next){
  if(next!==progressIndex+1)throw new Error('Urutan Task 1 tidak sesuai. Muat ulang halaman untuk menyelaraskan sesi.');
  const result=await api('advance',{next_index:next});
  progressIndex=Number(result.progress_index??next);syncSaved();return result;
}
function startPageAds(){
  if(!window.BoxTaskAds)return;
  window.BoxTaskAds.start();
  window.BoxTaskAds.initInlineAds('.task1-ad-mount',{max:18,exclude:['#task1AdGate','#task1SlideAd']});
}
function runTimer({seconds,progressId,countId,barId,statusId}){
  const progress=$(progressId),count=$(countId),bar=$(barId);
  if(progress)progress.hidden=false;
  let remaining=seconds;
  const paint=()=>{
    const percent=((seconds-remaining)/seconds)*100;
    if(count)count.textContent=String(remaining);
    if(bar)bar.style.width=percent+'%';
    const ring=progress?.querySelector('.task1-spinner');
    if(ring)ring.style.setProperty('--task-progress',percent+'%');
    setStatus(statusId,`Memproses… ${remaining} detik`);
  };
  paint();
  return new Promise(resolve=>{
    const clock=window.setInterval(()=>{
      remaining=Math.max(0,remaining-1);paint();
      if(remaining===0){window.clearInterval(clock);if(progress)progress.hidden=true;resolve();}
    },1000);
  });
}
async function runStage({expected,startId,progressId,countId,barId,statusId,onDone}){
  if(busy||progressIndex!==expected-1)return;
  const start=$(startId);busy=true;if(start)start.disabled=true;
  try{
    await runTimer({seconds:10,progressId,countId,barId,statusId});
    await advance(expected);
    await onDone();
    if(start)start.disabled=true;
  }catch(error){
    if(start)start.disabled=false;
    setStatus(statusId,error?.message||'Terjadi kendala. Silakan coba lagi.');
  }finally{busy=false;}
}

$('task1TopStart')?.addEventListener('click',()=>runStage({
  expected:1,startId:'task1TopStart',progressId:'task1TopProgress',countId:'task1TopCountdown',
  barId:'task1TopBar',statusId:'task1TopStatus',
  onDone:async()=>{reveal('task1TopResult');setStatus('task1TopStatus','Tahap pertama selesai. Tekan Lanjutkan untuk menuju tahap berikutnya.');}
}));
$('task1TopNext')?.addEventListener('click',()=>{if(busy)return;reveal('task1LowerTask');scrollTo('task1LowerTask');});
$('task1LowerStart')?.addEventListener('click',()=>runStage({
  expected:2,startId:'task1LowerStart',progressId:'task1LowerProgress',countId:'task1LowerCountdown',
  barId:'task1LowerBar',statusId:'task1LowerStatus',
  onDone:async()=>{reveal('task1LowerResult');setStatus('task1LowerStatus','Tahap kedua selesai. Lanjutkan ke verifikasi bagian tengah.');}
}));
$('task1LowerNext')?.addEventListener('click',()=>{if(busy)return;reveal('task1MiddleTask');scrollTo('task1MiddleTask');});
$('task1MiddleStart')?.addEventListener('click',()=>runStage({
  expected:3,startId:'task1MiddleStart',progressId:'task1MiddleProgress',countId:'task1MiddleCountdown',
  barId:'task1MiddleBar',statusId:'task1MiddleStatus',
  onDone:async()=>{reveal('task1RobotWrap');setStatus('task1MiddleStatus','Waktu selesai. Centang verifikasi untuk menyelesaikan Task 1.');}
}));

async function completeTask1(){
  // Task 1 records server stages 4, 5 and 6; Task 2 never needs to invent or auto-fill them.
  if(progressIndex<4)await advance(4);
  if(progressIndex<5){
    setStatus('task1RobotStatus','Menyinkronkan tahap berikutnya…');
    await runTimer({seconds:5,progressId:'task1VerifyProgress',countId:'task1VerifyCountdown',barId:'task1VerifyBar',statusId:'task1RobotStatus'});
    await advance(5);
  }
  if(progressIndex<6)await advance(6);
  reveal('task1Task2Wrap');
  setStatus('task1RobotStatus','Task 1 selesai dan sudah tersimpan di server. Silakan lanjut ke Task 2.');
}
$('task1RobotCheck')?.addEventListener('change',async event=>{
  const check=event.currentTarget;
  if(!check.checked||busy)return;
  if(progressIndex<3){check.checked=false;setStatus('task1RobotStatus','Selesaikan tiga tahap Task 1 terlebih dahulu.');return;}
  busy=true;check.disabled=true;
  try{
    await completeTask1();
  }catch(error){check.checked=false;check.disabled=false;setStatus('task1RobotStatus',error?.message||'Verifikasi gagal. Coba lagi.');}
  finally{busy=false;}
});

const task2Link=$('task1Task2Link');
if(task2Link){
  task2Link.href='/task2.html?code='+encodeURIComponent(code);
  task2Link.addEventListener('click',event=>{if(busy||progressIndex<6)event.preventDefault();});
}

/* Direct-access notice and optional community invitation are not part of task verification. */
const directToast=$('task1DirectToast');
if(directToast){
  const directLink=$('task1DirectAccess');if(directLink)directLink.href='/autolink-payment.html?code='+encodeURIComponent(code);
  $('task1ToastClose')?.addEventListener('click',()=>{directToast.dataset.dismissed='1';directToast.classList.remove('is-visible');window.setTimeout(()=>{directToast.hidden=true;},220);});
  window.setTimeout(()=>{if(!directToast.dataset.dismissed){directToast.hidden=false;requestAnimationFrame(()=>directToast.classList.add('is-visible'));}},1400);
}
const telegramDialog=$('task1TelegramDialog'),telegramFloat=$('task1TelegramFloat');
const telegramUrl=window.BOXCELLINK_COMMUNITY_LINKS?.telegram?.url||'';
if($('task1TelegramJoin')&&telegramUrl)$('task1TelegramJoin').href=telegramUrl;
function dismissTelegram(){
  if(telegramDialog){telegramDialog.classList.remove('is-visible');window.setTimeout(()=>{telegramDialog.hidden=true;},220);}
  if(telegramFloat)telegramFloat.hidden=false;
}
if(telegramDialog){
  window.setTimeout(()=>{telegramDialog.hidden=false;requestAnimationFrame(()=>telegramDialog.classList.add('is-visible'));},10000);
  $('task1TelegramOkay')?.addEventListener('click',dismissTelegram);
  $('task1TelegramClose')?.addEventListener('click',dismissTelegram);
  $('task1TelegramJoin')?.addEventListener('click',dismissTelegram);
}
telegramFloat?.addEventListener('click',()=>{if(telegramUrl)window.open(telegramUrl,'_blank','noopener,noreferrer');});

function restoreProgress(){
  if(progressIndex>=12){location.replace('/task3.html?code='+encodeURIComponent(code));return false;}
  if(progressIndex>=6){location.replace('/task2.html?code='+encodeURIComponent(code));return false;}
  if(progressIndex>=1){reveal('task1TopResult');$('task1TopStart').disabled=true;}
  if(progressIndex>=2){reveal('task1LowerTask');reveal('task1LowerResult');$('task1LowerStart').disabled=true;}
  if(progressIndex>=3){reveal('task1MiddleTask');reveal('task1RobotWrap');$('task1MiddleStart').disabled=true;}
  if(progressIndex>=4){setStatus('task1RobotStatus','Task 1 hampir selesai. Lanjutkan sinkronisasi untuk menyimpan tahap berikutnya.');}
  if(progressIndex===0)setStatus('task1TopStatus','Sesi aktif. Mulai tahap pertama.');
  startPageAds();
  return true;
}
(async()=>{
  try{
    const data=await api('status');progressIndex=Number(data.progress_index||0);syncSaved();
    restoreProgress();
  }catch(error){
    setStatus('task1TopStatus',error?.message||'Sesi tidak valid. Silakan mulai kembali dari halaman AutoLink.');
    ['task1TopStart','task1LowerStart','task1MiddleStart'].forEach(id=>{if($(id))$(id).disabled=true;});
    if(/sesi tidak valid|kedaluwarsa/i.test(error?.message||''))location.replace('/x/'+encodeURIComponent(code));
  }
})();
})();
