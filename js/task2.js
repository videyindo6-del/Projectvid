(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let saved=null;try{saved=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!saved||saved.code!==code){location.replace('/x/'+encodeURIComponent(code));return;}
let index=6,busy=false;

// Iklan Task 2: setiap slot dikelola dari file JS halaman ini sendiri.
document.querySelectorAll('[data-ads-slot]').forEach(async el=>{
  try{
    if(typeof sb==='undefined') return;
    const {data}=await sb.from('go_ad_settings').select('ad_code,active').eq('slot',el.dataset.adsSlot).eq('active',true).maybeSingle();
    if(data?.ad_code){const frame=document.createElement('iframe');frame.title='Iklan';frame.sandbox='allow-scripts allow-popups';frame.style.cssText='width:100%;min-height:110px;border:0';frame.srcdoc=data.ad_code;el.replaceChildren(frame);}
  }catch(error){console.warn('Slot iklan Task 2 tidak tersedia',error);}
});

const call=async next=>{const r=await fetch('/api/autolink?action=advance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:saved.id,token:saved.token,next_index:next})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Tahap belum terverifikasi');index=next;return d;};
const wait=(seconds,button,status,done)=>{if(busy)return;busy=true;button.disabled=true;let left=seconds;status.textContent=`Memuat selama ${left} detik...`;const timer=setInterval(async()=>{left--;status.textContent=`Memuat selama ${Math.max(0,left)} detik...`;if(left<=0){clearInterval(timer);try{await done();}catch(e){status.textContent=e.message;button.disabled=false;}finally{busy=false;}}},1000);};
const status=$('alTaskStatus'),progress=$('alProgress'),primary=$('alTaskPrimary'),secondary=$('alTaskSecondary'),up=$('alTaskUp'),cont=$('alTaskContinue'),go=$('alTaskGo');
const setProgress=n=>{if(progress)progress.style.width=(n/6*100)+'%';};
primary?.addEventListener('click',()=>wait(10,primary,status,async()=>{await call(index+1);primary.hidden=true;secondary.hidden=false;setProgress(1);status.textContent='Tahap pertama selesai. Lanjutkan ke artikel.';}));
secondary?.addEventListener('click',()=>wait(5,secondary,status,async()=>{await call(index+1);setProgress(2);const article=$('alTaskArticle');if(article){article.hidden=false;article.style.display='block';article.scrollIntoView({behavior:'smooth',block:'start'});}secondary.hidden=true;const actions=$('alTaskControls')?.querySelector('.al-actions');const download=document.createElement('button');download.type='button';download.className='al-btn';download.id='alTaskDownloadSecond';download.textContent='Download Kedua';actions?.prepend(download);download.addEventListener('click',()=>wait(10,download,status,async()=>{await call(index+1);setProgress(3);download.hidden=true;up.hidden=false;status.textContent='Tahap kedua selesai. Kembali ke atas untuk melanjutkan.';}));status.textContent='Baca artikel hingga selesai, lalu gunakan tombol Download Kedua.';}));
up?.addEventListener('click',async()=>{if(busy)return;busy=true;up.disabled=true;try{await call(index+1);setProgress(4);window.scrollTo({top:0,behavior:'smooth'});up.hidden=true;cont.hidden=false;status.textContent='Kembali ke atas. Tekan Lanjutkan.';}catch(e){status.textContent=e.message;up.disabled=false;}finally{busy=false;}});
cont?.addEventListener('click',()=>wait(5,cont,status,async()=>{await call(index+1);setProgress(5);cont.hidden=true;go.hidden=false;status.textContent='Tahap siap. Tekan GO untuk menyelesaikan Task 2.';}));
go?.addEventListener('click',async()=>{if(busy)return;busy=true;go.disabled=true;try{await call(index+1);setProgress(6);location.assign('/task3.html?code='+encodeURIComponent(code));}catch(e){status.textContent=e.message;go.disabled=false;busy=false;}});
})();
