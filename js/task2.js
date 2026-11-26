(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code||!saved.id||!saved.token){location.replace('/x/'+encodeURIComponent(code));return;}

let busy=true,index=0;
const status=text=>{const el=$('task2PageStatus');if(el)el.textContent=text;};
const setText=(id,text)=>{const el=$(id);if(el)el.textContent=text;};
const reveal=id=>{const el=$(id);if(el)el.hidden=false;};
const hide=id=>{const el=$(id);if(el)el.hidden=true;};
const scrollTo=id=>$(id)?.scrollIntoView({behavior:'smooth',block:'center'});
const persist=()=>{saved.progress_index=index;try{sessionStorage.setItem('al_session',JSON.stringify(saved));}catch{}};
const api=async(action,payload={})=>{
  const response=await fetch('/api/autolink?action='+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token,...payload})});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'Tidak dapat membaca status sesi AutoLink.');
  return data;
};
async function advance(next){
  if(next!==index+1)throw new Error(`Urutan Task 2 tidak sesuai. Tahap berikutnya harus ${index+1}.`);
  const data=await api('advance',{next_index:next});index=Number(data.progress_index??next);persist();return data;
}
function startPageAds(){
  if(!window.BoxTaskAds)return;
  window.BoxTaskAds.start();
  window.BoxTaskAds.initInlineAds('.task1-ad-mount',{max:22,exclude:['#task2AdGate','#task2SlideAd']});
}
function countdown(seconds,{countId,statusId}={}){
  return new Promise(resolve=>{
    let left=seconds;const count=$(countId);
    const paint=()=>{if(count)count.textContent=String(left);if(statusId)setText(statusId,`Verifikasi berlangsung… ${left} detik`);};
    paint();const timer=window.setInterval(()=>{left=Math.max(0,left-1);paint();if(left===0){window.clearInterval(timer);resolve();}},1000);
  });
}
async function runBusy(button,work){
  if(busy)return;busy=true;if(button)button.disabled=true;
  try{await work();}
  catch(error){status(error?.message||'Terjadi kendala. Silakan coba lagi.');if(button)button.disabled=false;}
  finally{busy=false;}
}
async function finishTask2Stages(){
  // Commit the final Task 2 records in server order; these are zero-delay bookkeeping steps.
  while(index<12)await advance(index+1);
  reveal('task2Task3Result');
  setText('task2FinalHint','Verifikasi berhasil. Tombol Download Now sudah tersedia untuk membuka Task 3.');
  status('Task 2 selesai dan progres 12 sudah tersimpan di server.');
}
function restoreProgress(){
  if(index>=12){location.replace('/task3.html?code='+encodeURIComponent(code));return false;}
  if(index<6){location.replace('/task1.html?code='+encodeURIComponent(code));return false;}
  if(index>=7){
    hide('task2TopLoader');reveal('task2TopResult');
    $('task2TopVerify').disabled=true;
    setText('task2TopHint','Tahap pertama sudah tersimpan. Tekan Scroll Down untuk menuju bagian bawah artikel.');
  }
  if(index>=8){
    reveal('task2ActionArea');hide('task2BottomLoader');reveal('task2BottomResult');
    $('task2BottomVerify').disabled=true;
    setText('task2DownloadHint','Verifikasi bagian bawah sudah tersimpan. Tekan Up Down untuk menuju tahap tengah.');
  }
  if(index>=9){
    reveal('task2MiddleStage');hide('task2FinalLoader');
  }
  if(index===6){$('task2TopVerify').disabled=false;status('Task 2 siap. Tekan Verifikasi tahap pertama untuk memulai.');}
  else if(index===7)status('Tahap pertama selesai. Lanjutkan ke bagian bawah.');
  else if(index===8)status('Bagian bawah selesai. Lanjutkan ke verifikasi tengah.');
  else if(index>=9)status('Melanjutkan penyimpanan progres Task 2…');
  startPageAds();
  return true;
}

$('task2TopVerify')?.addEventListener('click',()=>runBusy($('task2TopVerify'),async()=>{
  if(index!==6)throw new Error('Tahap pertama tidak sesuai. Muat ulang halaman.');
  hide('task2TopResult');reveal('task2TopLoader');
  await countdown(10,{countId:'task2TopCount',statusId:'task2TopStatus'});
  await advance(7);
  hide('task2TopLoader');reveal('task2TopResult');
  setText('task2TopHint','Selesai. Tekan Scroll Down untuk menuju bagian bawah artikel.');
  status('Verifikasi tahap pertama selesai.');
}));
$('task2BottomVerify')?.addEventListener('click',()=>runBusy($('task2BottomVerify'),async()=>{
  if(index!==7)throw new Error('Selesaikan tahap pertama Task 2 terlebih dahulu.');
  hide('task2BottomResult');reveal('task2BottomLoader');
  await countdown(10,{countId:'task2BottomCount',statusId:'task2BottomStatus'});
  await advance(8);
  hide('task2BottomLoader');reveal('task2BottomResult');
  setText('task2DownloadHint','Verifikasi bagian bawah selesai. Tekan Up Down untuk menuju tahap tengah.');
  status('Verifikasi bagian bawah selesai.');
}));
$('task2ScrollDown')?.addEventListener('click',()=>{
  if(busy||index<7)return;reveal('task2ActionArea');scrollTo('task2ActionArea');
  status('Bagian bawah terbuka. Selesaikan verifikasi bagian bawah.');
});
$('task2UpDown')?.addEventListener('click',()=>{
  if(busy||index<8)return;reveal('task2MiddleStage');scrollTo('task2MiddleStage');
  status('Bagian tengah terbuka. Verifikasi dapat dilakukan tanpa mengklik iklan.');
});
$('task2FinalVerify')?.addEventListener('click',()=>runBusy($('task2FinalVerify'),async()=>{
  if(index!==8)throw new Error('Selesaikan verifikasi bagian bawah terlebih dahulu.');
  hide('task2Task3Result');reveal('task2FinalLoader');
  await countdown(10,{countId:'task2FinalCount',statusId:'task2FinalStatus'});
  await advance(9);
  await finishTask2Stages();hide('task2FinalLoader');
}));
$('task2GoTask3')?.addEventListener('click',()=>{if(busy||index!==12)return;location.assign('/task3.html?code='+encodeURIComponent(code));});

/* Optional direct-access notice and community reminder. */
const directAccess=$('task2DirectAccess');if(directAccess)directAccess.href='/autolink-payment.html?code='+encodeURIComponent(code);
const directToast=$('task2DirectToast');
if(directToast){
  $('task2ToastClose')?.addEventListener('click',()=>{directToast.dataset.dismissed='1';directToast.classList.remove('is-visible');window.setTimeout(()=>{directToast.hidden=true;},220);});
  window.setTimeout(()=>{if(!directToast.dataset.dismissed){directToast.hidden=false;requestAnimationFrame(()=>directToast.classList.add('is-visible'));}},1400);
}
const waDialog=$('task2WaDialog'),waFloat=$('task2WaFloat');
const whatsappUrl=window.BOXCELLINK_COMMUNITY_LINKS?.whatsapp?.url||'';
if($('task2WaJoin')&&whatsappUrl)$('task2WaJoin').href=whatsappUrl;
function dismissWa(){if(waDialog){waDialog.classList.remove('is-visible');window.setTimeout(()=>{waDialog.hidden=true;},220);}if(waFloat)waFloat.hidden=false;}
if(waDialog){
  window.setTimeout(()=>{waDialog.hidden=false;requestAnimationFrame(()=>waDialog.classList.add('is-visible'));},10000);
  $('task2WaOkay')?.addEventListener('click',dismissWa);$('task2WaClose')?.addEventListener('click',dismissWa);$('task2WaJoin')?.addEventListener('click',dismissWa);
}
waFloat?.addEventListener('click',()=>{if(whatsappUrl)window.open(whatsappUrl,'_blank','noopener,noreferrer');});

(async()=>{
  try{
    const data=await api('status');index=Number(data.progress_index||0);persist();
    if(!restoreProgress())return;
    if(index>=9&&index<12){await finishTask2Stages();}
  }catch(error){
    status(error?.message||'Sesi belum siap. Silakan mulai kembali dari halaman AutoLink.');
    $('task2TopVerify').disabled=true;
    if(/sesi tidak valid|kedaluwarsa/i.test(error?.message||''))location.replace('/x/'+encodeURIComponent(code));
  }finally{busy=false;}
})();
})();
