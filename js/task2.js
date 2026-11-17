(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code){location.replace('/x/'+encodeURIComponent(code));return;}
const sponsorUrl='https://www.profitableratecpmnetwork.com/vw721j6q?key=e997cbbb9bbee0de7820bd0c98fc8351';
let busy=false,index=6,adGateTimer=null,slideClosedAt=0;
const status=text=>{const el=$('task2PageStatus');if(el)el.textContent=text;};
const reveal=id=>{const el=$(id);if(el)el.hidden=false;};
const hide=id=>{const el=$(id);if(el)el.hidden=true;};
const scrollTo=id=>$(id)?.scrollIntoView({behavior:'smooth',block:'center'});

async function advance(next){
  const response=await fetch('/api/autolink?action=advance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token,next_index:next})});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'Tahap belum dapat diverifikasi. Silakan coba lagi.');
  index=next;return data;
}

function mountAd(slot,refresh=false){
  if(!slot)return;
  if(refresh){slot.dataset.loaded='';slot.replaceChildren();}
  if(slot.dataset.loaded==='1')return;
  const key=slot.dataset.adKey,width=Number(slot.dataset.adWidth),height=Number(slot.dataset.adHeight);
  if(!key||!width||!height)return;
  slot.dataset.loaded='1';
  const frame=document.createElement('iframe');frame.title='Iklan sponsor';frame.loading='eager';frame.width=String(width);frame.height=String(height);
  frame.referrerPolicy='strict-origin-when-cross-origin';frame.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');
  frame.style.cssText=`display:block;border:0;width:min(100%,${width}px);height:${height}px;max-width:100%;margin:0 auto;background:transparent`;
  const src=`https://www.highrevenueformat.com/${encodeURIComponent(key)}/invoke.js`;
  frame.srcdoc='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;overflow:hidden"><script>var atOptions={'+`'key':'${key}','format':'iframe','height':${height},'width':${width},'params':{}`+' };</script><script src="'+src+'"></script></body></html>';
  slot.replaceChildren(frame);
}

// Slot iklan yang dikelola dari pengaturan admin tetap dipertahankan.
document.querySelectorAll('[data-ads-slot]').forEach(async el=>{
  try{if(typeof sb==='undefined')return;const {data}=await sb.from('go_ad_settings').select('ad_code,active').eq('slot',el.dataset.adsSlot).eq('active',true).maybeSingle();
    if(data?.ad_code){const frame=document.createElement('iframe');frame.title='Iklan sponsor';frame.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');frame.referrerPolicy='strict-origin-when-cross-origin';frame.style.cssText='width:100%;max-width:100%;min-height:90px;border:0';frame.srcdoc=data.ad_code;el.replaceChildren(frame);}
  }catch(error){console.warn('Slot iklan Task 2 tidak tersedia',error);}
});

function countdown(seconds,{countId,statusText,barId}={}){
  return new Promise(resolve=>{
    let left=seconds;const count=$(countId),bar=$(barId);
    const paint=()=>{if(count)count.textContent=String(left);if(bar)bar.style.width=((seconds-left)/seconds*100)+'%';if(statusText)status(statusText(left));};
    paint();const timer=setInterval(()=>{left=Math.max(0,left-1);paint();if(left===0){clearInterval(timer);resolve();}},1000);
  });
}

function showAdGate(){
  return new Promise(resolve=>{
    const gate=$('task2AdGate'),skip=$('task2AdSkip'),label=$('task2AdCountdown');
    if(!gate||!skip){resolve();return;}
    if(adGateTimer){clearInterval(adGateTimer);adGateTimer=null;}
    gate.hidden=false;const slot=gate.querySelector('.task2-ad-mount');mountAd(slot,true);
    let left=5;skip.disabled=true;skip.textContent=`Tunggu ${left} detik`;if(label)label.textContent=`Iklan · ${left} detik`;
    let finished=false;
    const finish=()=>{if(finished)return;finished=true;if(adGateTimer)clearInterval(adGateTimer);adGateTimer=null;gate.hidden=true;skip.removeEventListener('click',finish);resolve();};
    skip.addEventListener('click',finish);
    adGateTimer=setInterval(()=>{left=Math.max(0,left-1);if(label)label.textContent=left?`Iklan · ${left} detik`:'Iklan selesai';if(left){skip.textContent=`Tunggu ${left} detik`;}else{clearInterval(adGateTimer);adGateTimer=null;skip.disabled=false;skip.textContent='Lewati iklan';}},1000);
  });
}

async function runBusy(button,work){if(busy)return;busy=true;if(button)button.disabled=true;try{await work();}catch(error){status(error?.message||'Terjadi kendala. Silakan coba lagi.');if(button)button.disabled=false;}finally{busy=false;}}

$('task2TopVerify')?.addEventListener('click',()=>runBusy($('task2TopVerify'),async()=>{
  reveal('task2TopLoader');hide('task2TopResult');
  await countdown(10,{countId:'task2TopCount',statusText:left=>`Verifikasi tahap pertama · ${left} detik`});
  await advance(7);
  await showAdGate();
  hide('task2TopLoader');reveal('task2TopResult');status('Tahap pertama selesai. Gunakan Scroll Down untuk menuju bagian berikutnya.');
}));

$('task2ScrollDown')?.addEventListener('click',()=>{reveal('task2LowerStage');scrollTo('task2LowerStage');status('Bagian kedua terbuka. Pilih Save untuk melanjutkan atau Download untuk membuka sponsor.');});

$('task2Save')?.addEventListener('click',()=>runBusy($('task2Save'),async()=>{
  reveal('task2SaveLoader');hide('task2SaveResult');
  await countdown(20,{barId:'task2SaveBar',statusText:left=>{const el=$('task2SaveStatus');if(el)el.textContent=`Memproses Save · ${left} detik`;return 'Memproses penyimpanan';}});
  await advance(8);
  await showAdGate();
  hide('task2SaveLoader');reveal('task2SaveResult');status('Save selesai. Tekan Next untuk menuju verifikasi akhir.');
}));

$('task2NextToMiddle')?.addEventListener('click',()=>{reveal('task2MiddleStage');scrollTo('task2MiddleStage');status('Verifikasi akhir siap. Tombol sponsor bersifat opsional.');});

$('task2FinalVerify')?.addEventListener('click',()=>runBusy($('task2FinalVerify'),async()=>{
  reveal('task2FinalLoader');hide('task2Task3Result');
  await countdown(5,{countId:'task2FinalCount',statusText:left=>`Memproses verifikasi · ${left} detik`});
  await advance(9);
  await advance(10);
  // Tahap 11 memiliki waktu minimum 5 detik pada backend; gunakan progres halus tanpa meminta klik tambahan.
  const finalStatus=$('task2FinalStatus');
  for(let left=5;left>0;left--){if(finalStatus)finalStatus.textContent=`Menyelesaikan validasi · ${left} detik`;await new Promise(resolve=>setTimeout(resolve,1000));}
  await advance(11);
  await advance(12);
  await showAdGate();
  hide('task2FinalLoader');reveal('task2Task3Result');status('Verifikasi berhasil. Kamu sudah bisa melanjutkan ke Task 3.');
}));

$('task2GoTask3')?.addEventListener('click',()=>{if(busy)return;location.assign('/task3.html?code='+encodeURIComponent(code));});

// Banner slide: tampil setelah 7 detik, hanya ditutup oleh pengunjung, lalu boleh tampil lagi 7 detik kemudian.
const slide=$('task2SlideAd');
function showSlide(){if(!slide||!slide.hidden)return;slide.hidden=false;mountAd(slide.querySelector('.task2-ad-mount'));}
$('task2SlideClose')?.addEventListener('click',()=>{if(!slide)return;slide.hidden=true;slideClosedAt=Date.now();});
if(slide){setTimeout(showSlide,7000);setInterval(()=>{if(slide.hidden&&slideClosedAt&&Date.now()-slideClosedAt>=7000)showSlide();},500);}
})();
