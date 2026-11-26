(()=>{'use strict';
const $=id=>document.getElementById(id);
const code=new URLSearchParams(location.search).get('code')||'';
let session=null,progressIndex=0,ready=false,busy=false;
try{session=JSON.parse(sessionStorage.getItem('al_session')||'null')}catch{}
if(!session||session.code!==code||!session.id||!session.token){location.replace('/x/'+encodeURIComponent(code));return;}
const api=async(action,payload={})=>{
  const response=await fetch('/api/autolink?action='+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:session.id,token:session.token,...payload})});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'Sesi AutoLink tidak dapat diverifikasi.');
  return data;
};
const showMessage=message=>{const el=$('alFinalMessage');if(el)el.textContent=message;};

function loadFinalAds(){
  if(!window.sb)return;
  window.sb.from('go_ad_settings').select('ad_code').eq('slot','final_banner').eq('active',true).maybeSingle().then(({data,error})=>{
    if(error||!data?.ad_code)return;
    const host=$('alFinalAdSlot');if(!host)return;
    const frame=document.createElement('iframe');frame.title='Iklan sponsor';frame.sandbox='allow-scripts allow-popups';
    frame.style.cssText='width:100%;min-height:110px;border:0';frame.srcdoc=data.ad_code;host.replaceChildren(frame);
  }).catch(()=>{});
  const slots=['final_top','final_middle','final_bottom'];
  const ids={final_top:'alFinalTop',final_middle:'alFinalMiddle',final_bottom:'alFinalBottom'};
  slots.forEach(slot=>{
    window.sb.from('endorse_settings').select('*').eq('slot',slot).eq('active',true).maybeSingle().then(({data,error})=>{
      const host=$(ids[slot]);if(error||!data||!host)return;
      if(data.starts_at&&Date.parse(data.starts_at)>Date.now())return;
      if(data.ends_at&&Date.parse(data.ends_at)<Date.now())return;
      host.replaceChildren();
      const media=data.media_url||data.admin_media_url;
      if(data.content_type==='image'&&media){
        const image=document.createElement('img');image.src=media;image.alt='Endorse banner';host.append(image);
        if(data.target_url){host.style.cursor='pointer';host.addEventListener('click',()=>window.open(data.target_url,'_blank','noopener,noreferrer'),{once:true});}
      }else if(data.content_type==='video'&&media){
        const video=document.createElement('video');video.src=media;video.controls=true;video.playsInline=true;host.append(video);
      }else if(data.content_type==='html'&&data.embed_html){
        const frame=document.createElement('iframe');frame.sandbox='allow-scripts allow-forms allow-popups';frame.title='Endorse';frame.srcdoc=data.embed_html;frame.style.cssText='width:100%;min-height:110px;border:0';host.append(frame);
      }
    }).catch(()=>{});
  });
}

function showReadyState(){
  ready=true;
  $('alFinalContinue').hidden=true;
  $('alFinalRedirect').hidden=false;
  $('alFinalRedirect').disabled=false;
  $('alFinalStatus').textContent='Tahap Final sudah diverifikasi. Tekan Redirect untuk melanjutkan ke tujuan AutoLink.';
  $('alFinalProgress').style.width='100%';
}

$('alFinalContinue')?.addEventListener('click',async()=>{
  if(busy||progressIndex!==15)return;
  busy=true;const button=$('alFinalContinue');button.disabled=true;
  let left=10;const status=$('alFinalStatus'),bar=$('alFinalProgress');
  status.textContent='Verifikasi akhir '+left+' detik...';bar.style.width='0%';
  const timer=window.setInterval(async()=>{
    left=Math.max(0,left-1);bar.style.width=((10-left)*10)+'%';status.textContent='Verifikasi akhir '+left+' detik...';
    if(left>0)return;
    window.clearInterval(timer);
    try{
      const data=await api('advance',{next_index:16});progressIndex=Number(data.progress_index||16);showReadyState();
    }catch(error){status.textContent=error?.message||'Verifikasi Final gagal.';showMessage(status.textContent);button.disabled=false;}
    finally{busy=false;}
  },1000);
});

$('alFinalRedirect')?.addEventListener('click',async()=>{
  const button=$('alFinalRedirect');if(!ready||busy)return;
  busy=true;button.disabled=true;
  try{
    const data=await api('ready');
    $('alFinalStatus').textContent=`Ready Redirect valid · WIF publisher bertambah · CPM ${data.cpm}%`;
    try{sessionStorage.removeItem('al_session')}catch{}
    location.replace(data.destination);
  }catch(error){showMessage(error?.message||'Redirect belum dapat diverifikasi.');button.disabled=false;}
  finally{busy=false;}
});

(async()=>{
  try{
    const data=await api('status');progressIndex=Number(data.progress_index||0);
    if(progressIndex<15){
      const target=progressIndex<6?'/task1.html':progressIndex<12?'/task2.html':'/task3.html';
      location.replace(target+'?code='+encodeURIComponent(code));return;
    }
    loadFinalAds();
    if(progressIndex>=16){showReadyState();return;}
    $('alFinalContinue').disabled=false;
    $('alFinalStatus').textContent='Task 1, Task 2, dan Task 3 sudah terverifikasi. Tekan Lanjutkan untuk pemeriksaan akhir 10 detik.';
  }catch(error){
    $('alFinalStatus').textContent=error?.message||'Sesi tidak valid. Silakan mulai kembali dari halaman AutoLink.';
    showMessage(error?.message||'Sesi tidak valid.');
    if(/sesi tidak valid|kedaluwarsa/i.test(error?.message||''))location.replace('/x/'+encodeURIComponent(code));
  }
})();
})();
