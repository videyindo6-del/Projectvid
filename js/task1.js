(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;
try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code){location.replace('/x/'+encodeURIComponent(code));return;}

let index=0,busy=false;
const advance=async()=>{
  const next=index+1;
  const response=await fetch('/api/autolink?action=advance',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({session_id:saved.id,token:saved.token,next_index:next})
  });
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw Error(data.error||'Tahap belum terverifikasi. Silakan coba lagi.');
  index=next;return data;
};
const scrollTo=id=>$(id)?.scrollIntoView({behavior:'smooth',block:'center'});
const status=(id,message)=>{const node=$(id);if(node)node.textContent=message;};

// Sponsor interstitial: a visible 320x50 banner for five seconds after each completed stage.
// It does not open tabs, simulate clicks, or claim that an ad click is required.
let sponsorTimer=null;
const showSponsorForFiveSeconds=()=>new Promise(resolve=>{
  const gate=$('task1AdGate');
  const timer=$('task1AdTimer');
  if(!gate){resolve();return;}
  gate.hidden=false;
  let remaining=5;
  if(timer)timer.textContent=`Sponsor · ${remaining} detik`;
  sponsorTimer=setInterval(()=>{
    remaining-=1;
    if(timer)timer.textContent=remaining>0?`Sponsor · ${remaining} detik`:'Sponsor selesai';
    if(remaining<=0){clearInterval(sponsorTimer);sponsorTimer=null;gate.hidden=true;resolve();}
  },1000);
});

const runCountdown=async({seconds,startId,progressId,countId,barId,statusId,onDone})=>{
  if(busy)return;
  busy=true;
  const start=$(startId),progress=$(progressId),count=$(countId),bar=$(barId);
  if(start)start.disabled=true;
  if(progress)progress.hidden=false;
  let remaining=seconds;
  const paint=()=>{
    if(count)count.textContent=String(remaining);
    if(bar)bar.style.width=((seconds-remaining)/seconds*100)+'%';
    status(statusId,`Memproses… ${remaining} detik`);
  };
  paint();
  await new Promise(resolve=>{
    const clock=setInterval(()=>{
      remaining=Math.max(0,remaining-1);paint();
      if(remaining===0){clearInterval(clock);resolve();}
    },1000);
  });
  if(bar)bar.style.width='100%';
  if(progress)progress.hidden=true;
  try{
    await advance();
    await showSponsorForFiveSeconds();
    await onDone();
    if(start)start.disabled=true;
  }catch(error){
    if(start)start.disabled=false;
    status(statusId,error.message||'Terjadi kendala. Silakan coba lagi.');
  }finally{busy=false;}
};

$('task1TopStart')?.addEventListener('click',()=>runCountdown({
  seconds:10,startId:'task1TopStart',progressId:'task1TopProgress',
  countId:'task1TopCountdown',barId:'task1TopBar',statusId:'task1TopStatus',
  onDone:async()=>{
    $('task1TopResult').hidden=false;
    status('task1TopStatus','Tahap pertama selesai. Tekan Lanjutkan untuk membuka tahap berikutnya.');
  }
}));
$('task1TopNext')?.addEventListener('click',()=>{
  const lower=$('task1LowerTask');
  if(lower)lower.hidden=false;
  scrollTo('task1LowerTask');
});
$('task1LowerStart')?.addEventListener('click',()=>runCountdown({
  seconds:10,startId:'task1LowerStart',progressId:'task1LowerProgress',
  countId:'task1LowerCountdown',barId:'task1LowerBar',statusId:'task1LowerStatus',
  onDone:async()=>{
    const middle=$('task1MiddleTask');
    if(middle)middle.hidden=false;
    status('task1LowerStatus','Selesai. Tahap verifikasi sudah terbuka di bawah.');
    scrollTo('task1MiddleTask');
  }
}));
$('task1MiddleStart')?.addEventListener('click',()=>runCountdown({
  seconds:5,startId:'task1MiddleStart',progressId:'task1MiddleProgress',
  countId:'task1MiddleCountdown',barId:'task1MiddleBar',statusId:'task1MiddleStatus',
  onDone:async()=>{
    $('task1Task2Wrap').hidden=false;
    status('task1MiddleStatus','Verifikasi selesai. Tombol GO ke Task 2 sudah tersedia.');
  }
}));
const task2Link=$('task1Task2Link');
if(task2Link){
  task2Link.href='/task2.html?code='+encodeURIComponent(code);
  task2Link.addEventListener('click',event=>{if(busy)event.preventDefault();});
}

// Slide/native Adsterra unit: stays visible until manually dismissed, then may return after 12s.
const slide=$('task1SlideAd');
let slideDismissedAt=0;
const showSlide=()=>{
  if(!slide||!slide.hidden)return;
  slide.hidden=false;
  slide.classList.add('is-visible');
};
$('task1SlideClose')?.addEventListener('click',()=>{
  if(!slide)return;
  slide.classList.remove('is-visible');
  slide.hidden=true;
  slideDismissedAt=Date.now();
});
if(slide){
  setTimeout(showSlide,12000);
  setInterval(()=>{
    if(slide.hidden&&slideDismissedAt&&Date.now()-slideDismissedAt>=12000)showSlide();
  },1000);
}

// No forced popunder windows. The sponsor prompt above is shown only after a user-started stage.
})();
