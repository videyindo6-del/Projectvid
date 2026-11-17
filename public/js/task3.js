(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code){location.replace('/x/'+encodeURIComponent(code));return;}
// Iklan Task 3: terpisah dari pengelola iklan Task 1 dan Task 2.
document.querySelectorAll('[data-ads-slot]').forEach(async el=>{
  try{if(typeof sb==='undefined')return;const {data}=await sb.from('go_ad_settings').select('ad_code,active').eq('slot',el.dataset.adsSlot).eq('active',true).maybeSingle();if(data?.ad_code){const frame=document.createElement('iframe');frame.title='Iklan';frame.sandbox='allow-scripts allow-popups';frame.style.cssText='width:100%;min-height:110px;border:0';frame.srcdoc=data.ad_code;el.replaceChildren(frame);}}
  catch(error){console.warn('Slot iklan Task 3 tidak tersedia',error);}
});
let stage=0,busy=false,complete=false;
const title=$('alTask3Title'),copy=$('alTask3Text'),status=$('alTask3Status'),progress=$('alTask3Progress'),button=$('alTask3Button');
const advance=async next=>{const r=await fetch('/api/autolink?action=advance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token,next_index:next})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Tahap belum terverifikasi');return d;};
button?.addEventListener('click',async()=>{
 if(complete){location.assign('/final.html?code='+encodeURIComponent(code));return;}
 if(busy||stage>=3)return;
 busy=true;button.disabled=true;let left=10;status.textContent=`Memuat selama ${left} detik...`;
 const timer=setInterval(async()=>{left--;status.textContent=`Memuat selama ${Math.max(0,left)} detik...`;if(left>0)return;clearInterval(timer);
  try{await advance(13+stage);stage++;progress.style.width=(stage/3*100)+'%';
   if(stage<3){title.textContent=`Tahap ${stage+1} dari 3`;copy.textContent='Tahap sebelumnya selesai. Lanjutkan tahap berikutnya.';button.textContent='Mulai Tahap '+(stage+1);button.disabled=false;status.textContent='Tahap berhasil diselesaikan.';}
   else{complete=true;title.textContent='Semua tahap selesai';copy.textContent='Terima kasih. Anda dapat melanjutkan ke halaman akhir.';button.textContent='Lanjut ke halaman akhir';button.classList.add('red');button.disabled=false;status.textContent='Semua tahapan berhasil diselesaikan.';}
  }catch(error){status.textContent=error.message;button.disabled=false;}
  finally{busy=false;}
 },1000);
});
})();
