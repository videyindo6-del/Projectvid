const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'}});
const b64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const hash=async s=>b64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const randomToken=()=>b64url(crypto.getRandomValues(new Uint8Array(32)));
const cleanUrl=value=>{try{const u=new URL(String(value||''));if(!['http:','https:'].includes(u.protocol)||u.username||u.password) return null;return u.href;}catch{return null;}};
async function db(env,path,opts={}){const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');const key=env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)throw new Error('Server Supabase environment is not configured');const r=await fetch(base+'/rest/v1/'+path,{...opts,headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json',...(opts.headers||{})}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(typeof d==='string'?d:(d?.message||d?.hint||'Database request failed'));return d;}
async function userFrom(req,env){const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return null;const r=await fetch(env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:env.SUPABASE_ANON_KEY||env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+token}});if(!r.ok)return null;return await r.json();}
const code=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';let out='';const bytes=crypto.getRandomValues(new Uint8Array(5));for(let i=0;i<5;i++)out+=chars[bytes[i]%chars.length];return out;};
export async function onRequest({request,env}) {
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'}});
 const url=new URL(request.url),action=url.searchParams.get('action')||'';
 try {
  if(request.method==='GET'&&action==='resolve'){
   const c=(url.searchParams.get('code')||'').trim();if(!/^[A-Za-z0-9]{3,12}$/.test(c))return json({error:'Kode AutoLink tidak valid'},400);
   const rows=await db(env,`autolinks?select=id,short_code,title,description,status,total_wif,created_at&short_code=eq.${encodeURIComponent(c)}&status=eq.published&limit=1`);
   if(!rows?.length)return json({error:'AutoLink tidak ditemukan'},404);
   return json({autolink:rows[0]});
  }
  if(request.method==='GET'&&action==='edit-details'){
   const user=await userFrom(request,env);if(!user?.id)return json({error:'Login diperlukan'},401);
   const id=String(url.searchParams.get('id')||'');const rows=await db(env,`autolinks?select=id,publisher_id,target_url,title,description&id=eq.${id}&limit=1`);
   const admins=await db(env,`profiles?select=role&id=eq.${user.id}&limit=1`);
   if(!rows?.[0]||(rows[0].publisher_id!==user.id&&admins?.[0]?.role!=='admin'))return json({error:'Akses ditolak'},403);
   return json({success:true,autolink:rows[0]});
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const contentType=request.headers.get('content-type')||'';const body=contentType.includes('application/json')?await request.json():Object.fromEntries(new URLSearchParams(await request.text()));
  if(action==='publish'||action==='update'||action==='delete'){
   const user=await userFrom(request,env);if(!user?.id)return json({error:'Silakan login terlebih dahulu'},401);
   if(action==='publish'){
    const target=cleanUrl(body.target_url),title=String(body.title||'').trim(),description=String(body.description||'').trim();
    if(!target||title.length<3||title.length>140||description.length>1200)return json({error:'Link, judul (3–140 karakter), atau deskripsi tidak valid'},400);
    let inserted=null;
    for(let n=0;n<5&&!inserted;n++){const short_code=code();try{const rows=await db(env,'autolinks?select=id,short_code,title,description,status,total_wif,created_at',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({publisher_id:user.id,short_code,target_url:target,title,description,status:'published'})});inserted=rows?.[0]||null;}catch(e){if(!/duplicate|unique/i.test(e.message)||n===4)throw e;}}
    if(!inserted)throw new Error('Tidak berhasil membuat kode pendek unik');
    return json({success:true,autolink:inserted,url:new URL('/x/'+inserted.short_code,url.origin).href});
   }
   const id=String(body.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'ID tidak valid'},400);
   const owned=await db(env,`autolinks?select=id,publisher_id& id=eq.${id}`.replace('& id','&id'));
   const adminRows=await db(env,`profiles?select=role&id=eq.${user.id}&limit=1`);
   if(!owned?.length||(owned[0].publisher_id!==user.id&&adminRows?.[0]?.role!=='admin'))return json({error:'Akses ditolak'},403);
   if(action==='delete'){await db(env,`autolinks?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'deleted',updated_at:new Date().toISOString()})});return json({success:true});}
   const patch={};if(body.title!==undefined){const title=String(body.title).trim();if(title.length<3||title.length>140)return json({error:'Judul harus 3–140 karakter'},400);patch.title=title;}if(body.description!==undefined)patch.description=String(body.description).trim().slice(0,1200);if(body.target_url!==undefined){const u=cleanUrl(body.target_url);if(!u)return json({error:'Link tujuan tidak valid'},400);patch.target_url=u;}
   patch.updated_at=new Date().toISOString();await db(env,`autolinks?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});return json({success:true});
  }
  if(action==='start'){
   const c=String(body.code||'').trim(),visitor=String(body.visitor||'').slice(0,100)||'visitor';
   const rows=await db(env,`autolinks?select=id,publisher_id,target_url&short_code=eq.${encodeURIComponent(c)}&status=eq.published&limit=1`);
   if(!rows?.length)return json({error:'AutoLink tidak tersedia'},404);
   const token=randomToken(),tokenHash=await hash(token),profile=await userFrom(request,env);
   let vip=false;if(profile?.id){const ps=await db(env,`profiles?select=vip_expires_at&id=eq.${profile.id}&limit=1`);vip=!!(ps?.[0]?.vip_expires_at&&Date.parse(ps[0].vip_expires_at)>Date.now());}
   const visitorHash=await hash(visitor+'|'+(request.headers.get('cf-connecting-ip')||''));
   const rateKey=await hash((request.headers.get('cf-connecting-ip')||'unknown')+'|'+(request.headers.get('user-agent')||''));
   const recent=await db(env,`autolink_sessions?select=id&rate_key=eq.${rateKey}&started_at=gte.${encodeURIComponent(new Date(Date.now()-86400000).toISOString())}&limit=20`);
   if((recent||[]).length>=20)return json({error:'Batas sesi harian tercapai. Coba kembali nanti.'},429);
   const startIndex=vip?12:0;
   const sessions=await db(env,'autolink_sessions?select=id',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({autolink_id:rows[0].id,publisher_id:rows[0].publisher_id,token_hash:tokenHash,progress_index:startIndex,vip_bypass:vip,visitor_hash:visitorHash,rate_key:rateKey})});
   await db(env,'rpc/record_autolink_visit',{method:'POST',body:JSON.stringify({p_autolink_id:rows[0].id,p_visitor_hash:visitorHash})});

   return json({success:true,session_id:sessions[0].id,token,progress_index:startIndex,vip});
  }
  if(action==='advance'){
   const sid=String(body.session_id||''),token=String(body.token||''),next=Number(body.next_index);
   if(!sid||!token||!Number.isInteger(next)||next<1||next>16)return json({error:'Tahap tidak valid'},400);
   const rows=await db(env,`autolink_sessions?select=id,progress_index,stage_started_at,expires_at& id=eq.${sid}&token_hash=eq.${await hash(token)}&limit=1`.replace('& id=','&id='));
   const s=rows?.[0];if(!s||Date.parse(s.expires_at)<Date.now())return json({error:'Sesi tidak valid atau kedaluwarsa'},401);
   if(next!==Number(s.progress_index)+1)return json({error:'Urutan tahapan tidak valid'},409);
   const min=[0,10,5,10,0,5,0,10,5,10,0,5,0,10,10,10,10][next]||0;
   const elapsed=(Date.now()-Date.parse(s.stage_started_at))/1000;
   if(elapsed<min)return json({error:`Tunggu ${Math.ceil(min-elapsed)} detik lagi`},429);
   await db(env,`autolink_sessions?id=eq.${sid}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({progress_index:next,stage_started_at:new Date().toISOString()})});
   const task=next<=6?1:next<=12?2:3;
   await db(env,'autolink_tasks',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({session_id:sid,task_number:task,stage_number:next})});
   return json({success:true,progress_index:next});
  }
  if(action==='ready'){
   const sid=String(body.session_id||''),token=String(body.token||'');if(!sid||!token)return json({error:'Sesi tidak valid'},400);
   const result=await db(env,'rpc/record_autolink_ready_redirect',{method:'POST',body:JSON.stringify({p_session_id:sid,p_token_hash:await hash(token)})});
   if(!result?.ok)return json({error:result?.reason||'Redirect tidak dapat diverifikasi'},409);
   if((request.headers.get('accept')||'').includes('text/html'))return new Response(null,{status:303,headers:{location:result.destination,'cache-control':'no-store','referrer-policy':'no-referrer'}});
   return json({success:true,destination:result.destination,publisher_amount:result.publisher_amount,total_wif:result.total_wif,cpm:result.cpm});
  }
  if(action==='paid-access'){
   const user=await userFrom(request,env);if(!user?.id)return json({error:'Login diperlukan'},401);
   const order=String(body.order_id||'');const rows=await db(env,`autolink_payments?select=order_id,buyer_id,autolink_id,status,target_url_snapshot,title_snapshot&order_id=eq.${encodeURIComponent(order)}&limit=1`);
   const payment=rows?.[0];if(!payment||payment.buyer_id!==user.id||payment.status!=='settled')return json({error:'Pembayaran belum terverifikasi'},403);
   if(!payment.target_url_snapshot)return json({error:'Tujuan akses tidak tersedia'},404);
   return json({success:true,destination:payment.target_url_snapshot,title:payment.title_snapshot});
  }
  return json({error:'Action tidak dikenal'},404);
 }catch(e){return json({error:e?.message||'Internal server error'},500);}
}
