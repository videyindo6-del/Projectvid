const root=document.getElementById('pasteContent');
function getRouteCode(prefix){
 const params=new URLSearchParams(location.search);
 const fromQuery=params.get('slug')||params.get('code')||'';
 if(fromQuery.trim())return fromQuery.trim();
 const parts=location.pathname.split('/').filter(Boolean);
 const prefixIndex=parts.findIndex(p=>p.toLowerCase()===prefix);
 if(prefixIndex<0||!parts[prefixIndex+1])return '';
 try{return decodeURIComponent(parts[prefixIndex+1]).trim()}catch{return parts[prefixIndex+1].trim()}
}
const slug=getRouteCode('paste');const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function run(){try{if(!slug)throw Error('Kode review tidak terbaca dari URL. Pastikan URL berbentuk /paste/KODE_REVIEW.');let {data:item,error}=await sb.from('review_items').select('id,title,slug,access,status').eq('slug',slug).maybeSingle();
 if(!error&&!item){const alt=await sb.from('review_items').select('id,title,slug,access,status').ilike('slug',slug).maybeSingle();item=alt.data;error=alt.error;}
 if(error)throw Error('Gagal membaca review: '+error.message);
 if(!item||item.status!=='published')throw Error('Review tidak ditemukan atau belum published. Kode: '+slug);const {data,error:accessError}=await sb.functions.invoke('download-link',{body:{review_id:item.id}});if(accessError||!data?.success)throw Error(data?.error||accessError?.message||'Akses belum valid.');root.innerHTML=`<span class="eyebrow">AKSES TERVERIFIKASI</span><h1>${esc(item.title)}</h1><p>Hak akses valid. Link download tersedia di bawah ini.</p>${data.content_after_payment?`<div class="watch-card">${esc(data.content_after_payment)}</div>`:''}<a class="btn primary" href="${esc(data.download_url)}" target="_blank" rel="noopener noreferrer">Download Sekarang</a>`}catch(e){root.innerHTML=`<h1>Akses belum tersedia</h1><p>${esc(e.message)}</p><a class="btn primary" href="/d/${encodeURIComponent(slug)}">Periksa status / lanjutkan pembayaran</a>`}}run();