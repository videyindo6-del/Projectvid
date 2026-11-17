(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;
try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code){location.replace('/x/'+encodeURIComponent(code));return;}

let stageIndex=0,busy=false;
const sponsorUrl='https://www.profitableratecpmnetwork.com/vw721j6q?key=e997cbbb9bbee0de7820bd0c98fc8351';
const setStatus=(id,message)=>{const el=$(id);if(el)el.textContent=message;};
const reveal=id=>{const el=$(id);if(el)el.hidden=false;};
const scrollTo=id=>$(id)?.scrollIntoView({behavior:'smooth',block:'center'});

async function advanceStage(){
  const next=stageIndex+1;
  const response=await fetch('/api/autolink?action=advance',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({session_id:saved.id,token:saved.token,next_index:next})
  });
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'Tahap belum dapat diverifikasi. Silakan coba lagi.');
  stageIndex=next;return data;
}

/* Each banner runs in its own iframe document so repeated atOptions keys cannot overwrite one another. */
function mountAd(slot){
  if(!slot||slot.dataset.loaded==='1')return;
  const key=slot.dataset.adKey, width=Number(slot.dataset.adWidth), height=Number(slot.dataset.adHeight);
  if(!key||!width||!height)return;
  slot.dataset.loaded='1';
  const frame=document.createElement('iframe');
  frame.title='Iklan sponsor';
  frame.loading='lazy';
  frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.width=String(width);frame.height=String(height);
  frame.style.cssText=`display:block;border:0;width:min(100%,${width}px);height:${height}px;max-width:100%;margin:0 auto;background:transparent;`;
  const scriptUrl=`https://www.highrevenueformat.com/${encodeURIComponent(key)}/invoke.js`;
  const doc='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;overflow:hidden;">'
    +'<script>var atOptions={'+`'key':'${key}','format':'iframe','height':${height},'width':${width},'params':{}`+'};<\/script>'
    +'<script src="'+scriptUrl+'"><\/script></body></html>';
  frame.srcdoc=doc;
  slot.replaceChildren(frame);
}
const adSlots=[...document.querySelectorAll('.task1-ad-mount')];
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){mountAd(entry.target);observer.unobserve(entry.target);}
  },{rootMargin:'300px 0px'});
  adSlots.forEach(slot=>observer.observe(slot));
}else adSlots.forEach(mountAd);

/* The five-second sponsor interstitial appears after every completed 10-second stage.
   The continue control becomes active after five seconds; an ad click is never required. */
let gateTimer=null;
function showSponsorGate(){
  return new Promise(resolve=>{
    const gate=$('task1AdGate'),timer=$('task1AdTimer'),skip=$('task1AdSkip');
    if(!gate||!skip){resolve();return;}
    if(gateTimer){clearInterval(gateTimer);gateTimer=null;}
    gate.hidden=false;
    const mount=gate.querySelector('.task1-ad-mount');mountAd(mount);
    let remaining=5;
    if(timer)timer.textContent=`Lewati tersedia dalam ${remaining} detik`;
    skip.disabled=true;skip.textContent=`Tunggu ${remaining} detik`;
    const finish=()=>{
      if(gateTimer){clearInterval(gateTimer);gateTimer=null;}
      gate.hidden=true;skip.removeEventListener('click',finish);resolve();
    };
    skip.addEventListener('click',finish,{once:true});
    gateTimer=setInterval(()=>{
      remaining=Math.max(0,remaining-1);
      if(timer)timer.textContent=remaining?`Lewati tersedia dalam ${remaining} detik`:'Iklan selesai';
      if(remaining){skip.textContent=`Tunggu ${remaining} detik`;}
      else{clearInterval(gateTimer);gateTimer=null;skip.disabled=false;skip.textContent='Lewati iklan';}
    },1000);
  });
}

function runTimer({seconds,progressId,countId,barId,statusId,onTick}){
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
    if(onTick)onTick(remaining,percent);
  };
  paint();
  return new Promise(resolve=>{
    const clock=setInterval(()=>{
      remaining=Math.max(0,remaining-1);paint();
      if(remaining===0){
        clearInterval(clock);
        if(progress)progress.hidden=true;
        resolve();
      }
    },1000);
  });
}

async function runStage({startId,progressId,countId,barId,statusId,onDone}){
  if(busy)return;
  const start=$(startId);busy=true;if(start)start.disabled=true;
  try{
    await runTimer({seconds:10,progressId,countId,barId,statusId});
    await advanceStage();
    await showSponsorGate();
    await onDone();
    if(start)start.disabled=true;
  }catch(error){
    if(start)start.disabled=false;
    setStatus(statusId,error?.message||'Terjadi kendala. Silakan coba lagi.');
  }finally{busy=false;}
}

$('task1TopStart')?.addEventListener('click',()=>runStage({
  startId:'task1TopStart',progressId:'task1TopProgress',countId:'task1TopCountdown',
  barId:'task1TopBar',statusId:'task1TopStatus',
  onDone:async()=>{reveal('task1TopResult');setStatus('task1TopStatus','Tahap pertama selesai. Tekan Lanjutkan untuk turun ke tahap berikutnya.');}
}));
$('task1TopNext')?.addEventListener('click',()=>{
  if(busy)return;reveal('task1LowerTask');scrollTo('task1LowerTask');
});
$('task1LowerStart')?.addEventListener('click',()=>runStage({
  startId:'task1LowerStart',progressId:'task1LowerProgress',countId:'task1LowerCountdown',
  barId:'task1LowerBar',statusId:'task1LowerStatus',
  onDone:async()=>{reveal('task1LowerResult');setStatus('task1LowerStatus','Tahap kedua selesai. Lanjutkan ke verifikasi di bagian tengah.');}
}));
$('task1LowerNext')?.addEventListener('click',()=>{
  if(busy)return;reveal('task1MiddleTask');scrollTo('task1MiddleTask');
});
$('task1MiddleStart')?.addEventListener('click',()=>runStage({
  startId:'task1MiddleStart',progressId:'task1MiddleProgress',countId:'task1MiddleCountdown',
  barId:'task1MiddleBar',statusId:'task1MiddleStatus',
  onDone:async()=>{reveal('task1RobotWrap');setStatus('task1MiddleStatus','Waktu selesai. Centang verifikasi untuk melanjutkan.');}
}));

$('task1RobotCheck')?.addEventListener('change',async event=>{
  const check=event.currentTarget;
  if(!check.checked||busy)return;
  busy=true;check.disabled=true;
  try{
    const progress=$('task1VerifyProgress');if(progress)progress.hidden=false;
    await runTimer({seconds:5,progressId:'task1VerifyProgress',countId:'task1VerifyCountdown',
      barId:'task1VerifyBar',statusId:'task1RobotStatus'});
    reveal('task1Task2Wrap');
    setStatus('task1RobotStatus','Verifikasi selesai. Tombol GO sudah tersedia.');
  }catch(error){
    check.checked=false;check.disabled=false;
    setStatus('task1RobotStatus',error?.message||'Verifikasi gagal. Coba lagi.');
  }finally{busy=false;}
});

const task2Link=$('task1Task2Link');
if(task2Link){
  task2Link.href='/task2.html?code='+encodeURIComponent(code);
  task2Link.addEventListener('click',event=>{if(busy)event.preventDefault();});
}

/* Floating sponsor banner appears once after 7 seconds and stays dismissed after close. */
const slide=$('task1SlideAd');
function showSlide(){
  if(!slide||!slide.hidden)return;
  slide.hidden=false;
  slide.classList.add('is-visible');
  mountAd(slide.querySelector('.task1-ad-mount'));
}
$('task1SlideClose')?.addEventListener('click',()=>{
  if(!slide)return;
  slide.classList.remove('is-visible');
  slide.hidden=true;
});
if(slide)window.setTimeout(showSlide,7000);
})();