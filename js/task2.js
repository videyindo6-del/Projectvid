(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code){location.replace('/x/'+encodeURIComponent(code));return;}
let busy=true,index=Number(saved.progress_index??0),gateTimer=null;
const status=text=>{const el=$('task2PageStatus');if(el)el.textContent=text;};
const setText=(id,text)=>{const el=$(id);if(el)el.textContent=text;};
const reveal=id=>{const el=$(id);if(el)el.hidden=false;};
const hide=id=>{const el=$(id);if(el)el.hidden=true;};
const scrollTo=id=>$(id)?.scrollIntoView({behavior:'smooth',block:'center'});
const persist=()=>{saved.progress_index=index;try{sessionStorage.setItem('al_session',JSON.stringify(saved));}catch{}};

async function serverStatus(){
  const response=await fetch('/api/autolink?action=status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token})});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'Tidak dapat membaca status sesi AutoLink.');
  return Number(data.progress_index||0);
}
async function advance(next){
  if(next!==index+1)throw new Error(`Urutan tahap tidak cocok. Tahap saat ini ${index}, tahap berikutnya ${index+1}.`);
  const response=await fetch('/api/autolink?action=advance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token,next_index:next})});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'Tahap belum dapat diverifikasi. Silakan coba lagi.');
  index=next;persist();return data;
}

function mountAd(slot){
  if(!slot||slot.dataset.loaded==='1')return;
  const key=slot.dataset.adKey,width=Number(slot.dataset.adWidth),height=Number(slot.dataset.adHeight);
  if(!key||!width||!height)return;
  slot.dataset.loaded='1';
  const frame=document.createElement('iframe');frame.title='Iklan sponsor';frame.loading='lazy';frame.width=String(width);frame.height=String(height);
  frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');
  frame.style.cssText=`display:block;border:0;width:min(100%,${width}px);height:${height}px;max-width:100%;margin:0 auto;background:transparent`;
  const src=`https://www.highrevenueformat.com/${encodeURIComponent(key)}/invoke.js`;
  frame.srcdoc='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;overflow:hidden"><script>var atOptions={'+`'key':'${key}','format':'iframe','height':${height},'width':${width},'params':{}`+'};<\/script><script src="'+src+'"><\/script></body></html>';
  slot.replaceChildren(frame);
}
const adSlots=[...document.querySelectorAll('.task1-ad-mount')];
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){mountAd(entry.target);observer.unobserve(entry.target);}}},{rootMargin:'320px 0px'});
  adSlots.forEach(slot=>observer.observe(slot));
}else adSlots.forEach(mountAd);

function countdown(seconds,{countId,statusId,label}={}){
  return new Promise(resolve=>{
    let left=seconds;const count=$(countId);
    const paint=()=>{if(count)count.textContent=String(left);if(statusId)setText(statusId,`${label||'Memproses'} · ${left} detik`);};
    paint();const timer=setInterval(()=>{left=Math.max(0,left-1);paint();if(left===0){clearInterval(timer);resolve();}},1000);
  });
}
function showSponsorGate(){
  return new Promise(resolve=>{
    const gate=$('task2AdGate'),skip=$('task2AdSkip'),timer=$('task2AdTimer');
    if(!gate||!skip){resolve();return;}
    if(gateTimer){clearInterval(gateTimer);gateTimer=null;}
    gate.hidden=false;mountAd(gate.querySelector('.task1-ad-mount'));
    let left=5;skip.disabled=true;skip.textContent=`Tunggu ${left} detik`;if(timer)timer.textContent=`Lewati tersedia dalam ${left} detik`;
    const finish=()=>{if(skip.disabled)return;if(gateTimer)clearInterval(gateTimer);gateTimer=null;gate.hidden=true;skip.removeEventListener('click',finish);resolve();};
    skip.addEventListener('click',finish);
    gateTimer=setInterval(()=>{left=Math.max(0,left-1);if(timer)timer.textContent=left?`Lewati tersedia dalam ${left} detik`:'Iklan selesai';if(left){skip.textContent=`Tunggu ${left} detik`;}else{clearInterval(gateTimer);gateTimer=null;skip.disabled=false;skip.textContent='Lewati iklan';}},1000);
  });
}
async function runBusy(button,work){
  if(busy)return;busy=true;if(button)button.disabled=true;
  try{await work();}
  catch(error){status(error?.message||'Terjadi kendala. Silakan coba lagi.');if(button)button.disabled=false;}
  finally{busy=false;}
}
async function finishTask2Stages(){
  // Stage 8 is the visible five-second verification; later Task 2 records are committed in order.
  for(let next=index+1;next<=12;next++)await advance(next);
  reveal('task2Task3Result');setText('task2FinalHint','Verifikasi berhasil. Tombol Download Now sudah tersedia untuk membuka Task 3.');
  status('Task 2 selesai. Kamu dapat melanjutkan ke Task 3.');
}

$('task2TopVerify')?.addEventListener('click',()=>runBusy($('task2TopVerify'),async()=>{
  hide('task2TopResult');reveal('task2TopLoader');
  await countdown(10,{countId:'task2TopCount',statusId:'task2TopStatus',label:'Verifikasi tahap pertama'});
  if(index<7)await advance(7);
  await showSponsorGate();
  hide('task2TopLoader');reveal('task2TopResult');
  setText('task2TopHint','Selesai. Tekan Scroll Down untuk menuju bagian bawah artikel.');
  status('Verifikasi tahap pertama selesai.');
}));
$('task2ScrollDown')?.addEventListener('click',()=>{
  if(busy)return;reveal('task2ActionArea');scrollTo('task2ActionArea');
  status('Bagian bawah terbuka. Tekan Up Down untuk menuju verifikasi tengah.');
});
$('task2UpDown')?.addEventListener('click',()=>{
  if(busy)return;reveal('task2MiddleStage');scrollTo('task2MiddleStage');
  status('Bagian tengah terbuka. Verifikasi dapat dilakukan tanpa mengklik iklan.');
});
$('task2FinalVerify')?.addEventListener('click',()=>runBusy($('task2FinalVerify'),async()=>{
  hide('task2Task3Result');reveal('task2FinalLoader');
  if(index<8){
    await countdown(5,{countId:'task2FinalCount',statusId:'task2FinalStatus',label:'Memverifikasi Task 2'});
    await advance(8);
  }
  await finishTask2Stages();hide('task2FinalLoader');
}));
$('task2GoTask3')?.addEventListener('click',()=>{if(busy||index!==12)return;location.assign('/task3.html?code='+encodeURIComponent(code));});

// Floating sponsor banner appears once after 7 seconds and stays dismissed after close.
const slide=$('task2SlideAd');
function showSlide(){if(!slide||!slide.hidden)return;slide.hidden=false;slide.classList.add('is-visible');mountAd(slide.querySelector('.task1-ad-mount'));}
$('task2SlideClose')?.addEventListener('click',()=>{if(!slide)return;slide.classList.remove('is-visible');slide.hidden=true;});
if(slide)setTimeout(showSlide,7000);

// Restore session and bridge older Task 1 sessions (three-stage versions) to Task 2's stage 7.
(async()=>{
  try{
    index=await serverStatus();persist();
    if(index>=3&&index<6){
      status('Menyelaraskan sesi Task 1…');
      if(index===3)await advance(4);
      if(index===4){await new Promise(resolve=>setTimeout(resolve,5000));await advance(5);}
      if(index===5)await advance(6);
      status('Sesi Task 1 berhasil diselaraskan. Task 2 siap.');
    }
    if(index===6){$('task2TopVerify').disabled=false;}
    else if(index===7){hide('task2TopLoader');reveal('task2TopResult');$('task2TopVerify').disabled=true;}
    else if(index>=8&&index<12){
      reveal('task2ActionArea');reveal('task2MiddleStage');reveal('task2FinalLoader');
      await finishTask2Stages();hide('task2FinalLoader');$('task2FinalVerify').disabled=true;
    }
    else if(index===12){reveal('task2TopResult');reveal('task2ActionArea');reveal('task2MiddleStage');reveal('task2Task3Result');$('task2TopVerify').disabled=true;$('task2FinalVerify').disabled=true;}
    else if(index>12){reveal('task2MiddleStage');reveal('task2Task3Result');status('Sesi sudah melewati Task 2. Lanjutkan ke Task 3.');}
    else throw new Error('Selesaikan Task 1 terlebih dahulu sebelum membuka Task 2.');
  }catch(error){
    status(error?.message||'Sesi belum siap. Silakan mulai kembali dari halaman AutoLink.');
    const button=$('task2TopVerify');if(button)button.disabled=true;
  }finally{busy=false;}
})();
})();
