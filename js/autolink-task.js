(()=>{'use strict';
const $=id=>document.getElementById(id),code=new URLSearchParams(location.search).get('code')||'';
let saved=null;try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code){location.replace('/x/'+encodeURIComponent(code));return;}
let index=0,busy=false;
const sponsor='https://www.profitableratecpmnetwork.com/vw721j6q?key=e997cbbb9bbee0de7820bd0c98fc8351';
const advance=async()=>{const next=index+1;const r=await fetch('/api/autolink?action=advance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token,next_index:next})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Tahap belum terverifikasi. Silakan coba lagi.');index=next;return d;};
const scrollTo=id=>$(id)?.scrollIntoView({behavior:'smooth',block:'center'});
const setStatus=(id,msg)=>{const el=$(id);if(el)el.textContent=msg;};
const runCountdown=async({seconds,startId,progressId,countId,barId,statusId,onDone})=>{
 if(busy)return;busy=true;
 const start=$(startId),progress=$(progressId),count=$(countId),bar=$(barId);
 if(start)start.disabled=true;if(progress)progress.hidden=false;
 let left=seconds;const paint=()=>{if(count)count.textContent=String(left);if(bar)bar.style.width=((seconds-left)/seconds*100)+'%';setStatus(statusId,`Proses berjalan. Mohon tunggu ${left} detik.`)};
 paint();
 await new Promise(resolve=>{const timer=setInterval(()=>{left=Math.max(0,left-1);paint();if(left===0){clearInterval(timer);resolve();}},1000)});
 if(bar)bar.style.width='100%';if(progress)progress.hidden=true;if(start)start.disabled=false;
 try{await onDone();if(start)start.disabled=true;}catch(e){setStatus(statusId,e.message||'Terjadi kendala. Silakan coba lagi.');}
 busy=false;
};
$('task1TopStart')?.addEventListener('click',()=>runCountdown({seconds:10,startId:'task1TopStart',progressId:'task1TopProgress',countId:'task1TopCountdown',barId:'task1TopBar',statusId:'task1TopStatus',onDone:async()=>{await advance();$('task1TopResult').hidden=false;setStatus('task1TopStatus','Selesai. Pilih Next untuk menuju bagian tahapan berikutnya atau Save untuk membuka sponsor.');}}));
$('task1TopNext')?.addEventListener('click',()=>scrollTo('task1LowerTask'));
$('task1LowerStart')?.addEventListener('click',()=>runCountdown({seconds:10,startId:'task1LowerStart',progressId:'task1LowerProgress',countId:'task1LowerCountdown',barId:'task1LowerBar',statusId:'task1LowerStatus',onDone:async()=>{await advance();setStatus('task1LowerStatus','Selesai. Halaman bergerak ke bagian tengah.');scrollTo('task1MiddleTask');}}));
$('task1MiddleStart')?.addEventListener('click',()=>runCountdown({seconds:5,startId:'task1MiddleStart',progressId:'task1MiddleProgress',countId:'task1MiddleCountdown',barId:'task1MiddleBar',statusId:'task1MiddleStatus',onDone:async()=>{await advance();$('task1Task2Wrap').hidden=false;setStatus('task1MiddleStatus','Tahap selesai. Tombol Task 2 sudah tersedia.');}}));
$('task1Task2Link')?.addEventListener('click',async e=>{e.preventDefault();const a=$('task1Task2Link');if(busy)return;busy=true;a.style.opacity='.6';a.style.pointerEvents='none';try{await advance();await advance();await advance();location.href='/task2.html?code='+encodeURIComponent(code);}catch(err){setStatus('task1MiddleStatus',err.message||'Tidak dapat membuka Task 2.');a.style.opacity='1';a.style.pointerEvents='auto';busy=false;}});
/* 300x250 ad is visible for 15 seconds; skip becomes available after 5 seconds. */
const gate=$('task1AdGate'),skip=$('task1AdSkip'),timer=$('task1AdTimer');
if(gate&&skip){let elapsed=0;const adClock=setInterval(()=>{elapsed++;if(elapsed>=5){skip.disabled=false;if(timer)timer.textContent='Iklan dapat dilewati';}else if(timer)timer.textContent=`Lewati dalam ${5-elapsed} detik`;if(elapsed>=15){clearInterval(adClock);gate.hidden=true;}},1000);skip.addEventListener('click',()=>{if(skip.disabled)return;clearInterval(adClock);gate.hidden=true;});}
})();