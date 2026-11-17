(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;
try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code){location.replace('/x/'+encodeURIComponent(code));return;}

let index=0,busy=false;
const sponsor='https://www.profitableratecpmnetwork.com/vw721j6q?key=e997cbbb9bbee0de7820bd0c98fc8351';
const advance=async()=>{
  const next=index+1;
  const r=await fetch('/api/autolink?action=advance',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({session_id:saved.id,token:saved.token,next_index:next})
  });
  let d={};try{d=await r.json()}catch{}
  if(!r.ok)throw Error(d.error||'Tahap belum terverifikasi. Silakan coba lagi.');
  index=next;return d;
};
const scrollTo=id=>$(id)?.scrollIntoView({behavior:'smooth',block:'center'});
const setStatus=(id,msg)=>{const el=$(id);if(el)el.textContent=msg;};
const runCountdown=async({seconds,startId,progressId,countId,barId,statusId,onDone})=>{
  if(busy)return;
  busy=true;
  const start=$(startId),progress=$(progressId),count=$(countId),bar=$(barId);
  if(start)start.disabled=true;
  if(progress)progress.hidden=false;
  let left=seconds;
  const paint=()=>{
    if(count)count.textContent=String(left);
    if(bar)bar.style.width=((seconds-left)/seconds*100)+'%';
    setStatus(statusId,`Proses berjalan. Mohon tunggu ${left} detik.`);
  };
  paint();
  await new Promise(resolve=>{
    const timer=setInterval(()=>{
      left=Math.max(0,left-1);paint();
      if(left===0){clearInterval(timer);resolve();}
    },1000);
  });
  if(bar)bar.style.width='100%';
  if(progress)progress.hidden=true;
  if(start)start.disabled=false;
  try{
    await onDone();
    if(start)start.disabled=true;
  }catch(e){
    setStatus(statusId,e.message||'Terjadi kendala. Silakan coba lagi.');
  }
  busy=false;
};

$('task1TopStart')?.addEventListener('click',()=>runCountdown({
  seconds:10,startId:'task1TopStart',progressId:'task1TopProgress',
  countId:'task1TopCountdown',barId:'task1TopBar',statusId:'task1TopStatus',
  onDone:async()=>{
    await advance();
    $('task1TopResult').hidden=false;
    setStatus('task1TopStatus','Selesai. Pilih Next untuk menuju tahap berikutnya atau Save untuk membuka sponsor.');
  }
}));
$('task1TopNext')?.addEventListener('click',()=>scrollTo('task1LowerTask'));
$('task1LowerStart')?.addEventListener('click',()=>runCountdown({
  seconds:10,startId:'task1LowerStart',progressId:'task1LowerProgress',
  countId:'task1LowerCountdown',barId:'task1LowerBar',statusId:'task1LowerStatus',
  onDone:async()=>{
    await advance();
    setStatus('task1LowerStatus','Selesai. Halaman bergerak ke bagian tengah.');
    scrollTo('task1MiddleTask');
  }
}));
$('task1MiddleStart')?.addEventListener('click',()=>runCountdown({
  seconds:5,startId:'task1MiddleStart',progressId:'task1MiddleProgress',
  countId:'task1MiddleCountdown',barId:'task1MiddleBar',statusId:'task1MiddleStatus',
  onDone:async()=>{
    await advance();
    $('task1Task2Wrap').hidden=false;
    setStatus('task1MiddleStatus','Tahap selesai. Tombol Task 2 sudah tersedia.');
  }
}));

/* FIX: Tahap 1, 2, dan 3 sudah diverifikasi pada countdown masing-masing.
   Jangan memanggil advance() tiga kali lagi saat tombol Task 2 diklik. */
const task2Link=$('task1Task2Link');
if(task2Link){
  task2Link.href='/task2.html?code='+encodeURIComponent(code);
  task2Link.addEventListener('click',e=>{
    if(busy){e.preventDefault();return;}
    // Biarkan navigasi native berjalan agar tidak tertahan oleh request advance tambahan.
  });
}

/* 300x250 interstitial: tampil penuh 15 detik; tombol skip aktif setelah 5 detik.
   Waktu dihitung saat halaman dimuat, bukan ketika pengunjung baru menggulir ke lokasinya. */
const gate=$('task1AdGate'),skip=$('task1AdSkip'),timer=$('task1AdTimer');
if(gate&&skip){
  gate.hidden=false;
  skip.disabled=true;
  let elapsed=0;
  const paintGate=()=>{
    if(elapsed<5){
      if(timer)timer.textContent=`Lewati dalam ${5-elapsed} detik`;
      skip.textContent=`Lewati dalam ${5-elapsed} detik`;
    }else{
      skip.disabled=false;
      if(timer)timer.textContent='Iklan tampil hingga 15 detik';
      skip.textContent='Lewati iklan';
    }
  };
  paintGate();
  const adClock=setInterval(()=>{
    elapsed++;
    paintGate();
    if(elapsed>=15){
      clearInterval(adClock);
      gate.hidden=true;
    }
  },1000);
  skip.addEventListener('click',()=>{
    if(skip.disabled)return;
    clearInterval(adClock);
    gate.hidden=true;
  });
}

/* Slide banner: mulai pada detik ke-7, lalu muncul kembali tiap 7 detik.
   Satu slot iklan dimuat sekali dan panel hanya disembunyikan/ditampilkan. */
const slide=$('task1SlideAd');
let slideDismissed=false;
$('task1SlideClose')?.addEventListener('click',()=>{
  slideDismissed=true;
  if(slide)slide.hidden=true;
});
if(slide){
  const showSlide=()=>{
    if(slideDismissed)return;
    slide.hidden=false;
    slide.classList.add('is-visible');
    setTimeout(()=>{
      slide.classList.remove('is-visible');
      slide.hidden=true;
    },5000);
  };
  setTimeout(()=>{
    showSlide();
    setInterval(showSlide,7000);
  },7000);
}

/* Popunder-style in-page panel setiap 10 detik.
   Provider popunder eksternal yang ada di HTML tetap dimuat satu kali; browser dapat
   memblokir tab/pop-up otomatis, jadi panel ini menjadi fallback yang terlihat. */
const pop=$('task1PopunderAd');
let popDismissed=false;
$('task1PopunderClose')?.addEventListener('click',()=>{
  popDismissed=true;
  if(pop)pop.hidden=true;
});
if(pop){
  const showPop=()=>{
    if(popDismissed)return;
    pop.hidden=false;
    pop.classList.add('is-visible');
    setTimeout(()=>{
      pop.classList.remove('is-visible');
      pop.hidden=true;
    },5000);
  };
  setTimeout(()=>{
    showPop();
    setInterval(showPop,10000);
  },10000);
}
})();