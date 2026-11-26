/* BoxCellink AutoLink task ad controller.
   Loads publisher formats once per page, isolates banner units in iframes,
   rotates one animated banner every 10 seconds, and exposes copy helpers
   only when ?adtools=1 is present. */
(()=>{'use strict';
  if(window.BoxTaskAds)return;

  const UNITS={
    '728x90': {key:'b5df562e06e9e080a144e679bdd04b11',width:728,height:90,icon:'fa-rectangle-ad',label:'Leaderboard 728×90'},
    '468x60': {key:'32b22531e798b31302788d3f353a1b96',width:468,height:60,icon:'fa-rectangle-ad',label:'Banner 468×60'},
    '320x50': {key:'e48004340d99ba399e04e57dd40239fa',width:320,height:50,icon:'fa-mobile-screen-button',label:'Mobile banner 320×50'},
    '300x250':{key:'896ad8ddb5ea1d057ac6d61226e3f54d',width:300,height:250,icon:'fa-square',label:'Medium rectangle 300×250'},
    '160x300':{key:'a658feb34047aeb8881f5e3dba68dd7d',width:160,height:300,icon:'fa-rectangle-portrait',label:'Vertical 160×300'},
    '160x600':{key:'596986d6909968eec943bfa00d2ad02b',width:160,height:600,icon:'fa-arrows-up-down',label:'Skyscraper 160×600'}
  };
  const SOCIALBAR='https://pl32231840.profitableratecpmnetwork.com/6a/04/a4/6a04a4d0015749a46994e2d7d16590df.js';
  const POPUNDER='https://pl32231845.profitableratecpmnetwork.com/63/28/51/6328510ed0ef36d32ce4589c0110531b.js';
  const NATIVE='https://pl32231888.profitableratecpmnetwork.com/d0c4535d3914ad4b2c4e09c4aa337646/invoke.js';
  const effects=['float','slide-up','slide-down','slide-left','slide-right','expand'];
  let started=false,rotationTimer=null,overlay=null;

  function injectOnce(src,marker,delay){
    window.setTimeout(()=>{
      if(!document.body||!document.body.isConnected||document.querySelector(`script[${marker}]`))return;
      const script=document.createElement('script');
      script.src=src;script.async=true;script.setAttribute('data-cfasync','false');
      script.setAttribute(marker,'1');document.body.appendChild(script);
    },delay);
  }

  function mountBanner(host,key,width,height){
    if(!host||host.dataset.loaded==='1')return false;
    const unitKey=String(key||host.dataset.adKey||'').trim();
    const w=Number(width||host.dataset.adWidth),h=Number(height||host.dataset.adHeight);
    if(!unitKey||!w||!h)return false;
    host.dataset.loaded='1';
    const frame=document.createElement('iframe');
    frame.title='Iklan sponsor';frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.width=String(w);frame.height=String(h);frame.setAttribute('scrolling','no');
    frame.style.cssText=`display:block;border:0;max-width:100%;width:min(100%,${w}px);height:${h}px;margin:0 auto;background:transparent;overflow:hidden`;
    const safeKey=unitKey.replace(/[^a-zA-Z0-9]/g,'');
    const src=`https://www.highrevenueformat.com/${safeKey}/invoke.js`;
    frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}body{display:grid;place-items:center}</style></head><body><script>var atOptions={'+`'key':'${safeKey}','format':'iframe','height':${h},'width':${w},'params':{}`+'};<\/script><script src="'+src+'"><\/script></body></html>';
    host.replaceChildren(frame);
    return true;
  }

  function mountNative(host){
    if(!host||host.dataset.loaded==='1')return false;
    host.dataset.loaded='1';
    const frame=document.createElement('iframe');
    frame.title='Iklan native';frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.style.cssText='display:block;width:100%;min-height:250px;height:280px;border:0;background:transparent;overflow:hidden';
    frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;width:100%;min-height:250px;background:transparent}</style></head><body><div id="container-d0c4535d3914ad4b2c4e09c4aa337646"></div><script async data-cfasync="false" src="'+NATIVE+'"><\/script></body></html>';
    host.replaceChildren(frame);
    return true;
  }

  function evenSelection(items,max){
    if(items.length<=max)return items;
    const picked=[];const seen=new Set();
    for(let i=0;i<max;i++){
      const index=Math.round(i*(items.length-1)/(max-1));
      if(!seen.has(index)){seen.add(index);picked.push(items[index]);}
    }
    return picked;
  }

  function initInlineAds(selector,{max=18,exclude=[]}={}){
    const slots=[...document.querySelectorAll(selector)].filter(slot=>!exclude.some(sel=>slot.closest(sel)));
    const active=evenSelection(slots,Math.max(1,Number(max)||slots.length));
    const activeSet=new Set(active);
    slots.forEach(slot=>{
      const wrapper=slot.closest('.task1-inline-ad,.task2-between-ad')||slot;
      if(!activeSet.has(slot)){
        wrapper.classList.add('box-task-ad-suppressed');
        wrapper.setAttribute('aria-hidden','true');
      }else{
        wrapper.classList.remove('box-task-ad-suppressed');
        wrapper.removeAttribute('aria-hidden');
      }
    });
    const load=slot=>mountBanner(slot);
    if('IntersectionObserver'in window){
      const observer=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){load(entry.target);observer.unobserve(entry.target);}
        });
      },{rootMargin:'420px 0px'});
      active.forEach(slot=>observer.observe(slot));
    }else active.forEach(load);
    return {total:slots.length,active:active.length};
  }

  function makeOverlay(){
    if(overlay)return overlay;
    overlay=document.createElement('aside');
    overlay.id='boxTaskAdMotion';overlay.className='box-task-ad-motion';
    overlay.hidden=true;overlay.setAttribute('aria-label','Iklan sponsor');
    overlay.innerHTML='<div class="box-task-ad-motion-card"><div class="box-task-ad-motion-head"><span><i class="fa-solid fa-rectangle-ad" aria-hidden="true"></i> Iklan sponsor</span><button type="button" class="box-task-ad-motion-close" aria-label="Tutup iklan"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div><div class="box-task-ad-motion-mount" id="boxTaskAdMotionMount"></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.box-task-ad-motion-close')?.addEventListener('click',()=>{overlay.hidden=true;overlay.classList.remove('is-entering');});
    mountBanner(overlay.querySelector('#boxTaskAdMotionMount'),UNITS['300x250'].key,300,250);
    return overlay;
  }

  function showMotionAd(){
    const node=makeOverlay();
    const effect=effects[(Math.floor(Date.now()/10000)-1)%effects.length];
    node.dataset.effect=effect;
    node.style.left='auto';node.style.right='14px';node.style.top='auto';node.style.bottom='82px';
    if(effect==='slide-down') { node.style.top='78px';node.style.bottom='auto'; }
    if(effect==='slide-left') { node.style.left='14px';node.style.right='auto'; }
    node.hidden=false;node.classList.remove('is-entering');
    // Force a style boundary so the entry animation can replay on each 10-second cycle.
    void node.offsetWidth;
    node.classList.add('is-entering');
    window.setTimeout(()=>{if(node.dataset.effect===effect)node.hidden=true;},6500);
  }

  function scriptText(src,attrs={}){
    const attrText=Object.entries(attrs).map(([k,v])=>`${k}="${v}"`).join(' ');
    return `<script ${attrText} src="${src}"><\/script>`;
  }
  function bannerText(unit){
    return `<script>var atOptions = {'key':'${unit.key}','format':'iframe','height':${unit.height},'width':${unit.width},'params':{}};<\/script>\n<script src="https://www.highrevenueformat.com/${unit.key}/invoke.js"><\/script>`;
  }
  async function copyText(text){
    try{
      if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true;}
    }catch{}
    const field=document.createElement('textarea');field.value=text;field.setAttribute('readonly','');
    field.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.appendChild(field);field.select();
    let ok=false;try{ok=document.execCommand('copy');}catch{}
    field.remove();return ok;
  }
  function showCopyTools(){
    if(new URLSearchParams(location.search).get('adtools')!=='1')return;
    const panel=document.createElement('section');panel.className='box-task-ad-tools';panel.id='boxTaskAdTools';
    panel.innerHTML='<div class="box-task-ad-tools-head"><div><strong><i class="fa-solid fa-code"></i> Kode unit iklan</strong><small>Salin script banner, Social Bar, atau Popunder</small></div><button type="button" class="box-task-ad-tools-close" aria-label="Tutup panel"><i class="fa-solid fa-xmark"></i></button></div><div class="box-task-ad-tools-grid"></div><p class="box-task-ad-tools-note" aria-live="polite">Panel ini hanya tampil dengan parameter <code>?adtools=1</code>.</p>';
    const grid=panel.querySelector('.box-task-ad-tools-grid');
    Object.entries(UNITS).forEach(([name,unit])=>{
      const card=document.createElement('div');card.className='box-task-ad-tools-item';
      const icon=document.createElement('i');icon.className=`fa-solid ${unit.icon}`;icon.setAttribute('aria-hidden','true');
      const info=document.createElement('span');info.innerHTML=`<strong>${unit.label}</strong><small>Publisher key · ${unit.key.slice(0,8)}…</small>`;
      const button=document.createElement('button');button.type='button';button.innerHTML='<i class="fa-regular fa-copy" aria-hidden="true"></i><span>Salin script</span>';
      button.addEventListener('click',async()=>{
        const ok=await copyText(bannerText(unit));button.innerHTML=ok?'<i class="fa-solid fa-check"></i><span>Tersalin</span>':'<i class="fa-solid fa-triangle-exclamation"></i><span>Gagal menyalin</span>';
        panel.querySelector('.box-task-ad-tools-note').textContent=ok?`${unit.label}: script berhasil disalin.`:'Clipboard tidak tersedia. Coba buka halaman melalui HTTPS.';
        window.setTimeout(()=>{button.innerHTML='<i class="fa-regular fa-copy" aria-hidden="true"></i><span>Salin script</span>';},1800);
      });
      card.append(icon,info,button);grid.append(card);
    });
    const extras=[
      {label:'Social Bar',icon:'fa-bars-staggered',src:SOCIALBAR},
      {label:'Popunder',icon:'fa-arrow-up-right-from-square',src:POPUNDER},
      {label:'Native ad',icon:'fa-newspaper',src:NATIVE,container:'<div id="container-d0c4535d3914ad4b2c4e09c4aa337646"></div>\n'}
    ];
    extras.forEach(item=>{
      const card=document.createElement('div');card.className='box-task-ad-tools-item';
      const icon=document.createElement('i');icon.className=`fa-solid ${item.icon}`;icon.setAttribute('aria-hidden','true');
      const info=document.createElement('span');info.innerHTML=`<strong>${item.label}</strong><small>Script publisher</small>`;
      const button=document.createElement('button');button.type='button';button.innerHTML='<i class="fa-regular fa-copy" aria-hidden="true"></i><span>Salin script</span>';
      button.addEventListener('click',async()=>{const attrs={async:'async','data-cfasync':'false'};const code=(item.container||'')+scriptText(item.src,attrs);const ok=await copyText(code);button.innerHTML=ok?'<i class="fa-solid fa-check"></i><span>Tersalin</span>':'<i class="fa-solid fa-triangle-exclamation"></i><span>Gagal</span>';window.setTimeout(()=>button.innerHTML='<i class="fa-regular fa-copy"></i><span>Salin script</span>',1800);});
      card.append(icon,info,button);grid.append(card);
    });
    panel.querySelector('.box-task-ad-tools-close')?.addEventListener('click',()=>panel.remove());
    document.body.appendChild(panel);
  }

  function start(){
    if(started)return;started=true;
    // Adsterra formats are registered once per task page; fill and frequency are provider-controlled.
    injectOnce(SOCIALBAR,'data-box-task-socialbar',2000);
    injectOnce(POPUNDER,'data-box-task-popunder',3000);
    showCopyTools();
    const cycle=()=>{showMotionAd();rotationTimer=window.setTimeout(cycle,10000);};
    rotationTimer=window.setTimeout(cycle,10000);
  }

  window.BoxTaskAds={units:UNITS,start,mountBanner,mountNative,initInlineAds};
})();
