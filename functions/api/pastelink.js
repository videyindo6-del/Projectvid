const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const SUPABASE_URL_FALLBACK='https://djxcdwnpheufoojfzorx.supabase.co';

const base=env=>String(env.SUPABASE_URL||env.BOXCELLINK_SUPABASE_URL||SUPABASE_URL_FALLBACK).replace(/\/$/,'');
const cleanText=(v,max)=>String(v??'').trim().slice(0,max);
const cleanSlug=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';const bytes=crypto.getRandomValues(new Uint8Array(8));return [...bytes].map(b=>chars[b%chars.length]).join('');};
async function db(env,path,opts={}){const key=env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('Secret SUPABASE_SERVICE_ROLE_KEY belum diatur di Cloudflare Pages.');const r=await fetch(base(env)+'/rest/v1/'+path,{...opts,headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json',...(opts.headers||{})}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.hint||String(d||'Database error'));return d;}
async function getUser(request,env){const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return null;const key=env.SUPABASE_ANON_KEY||env.BOXCELLINK_SUPABASE_ANON_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeGNkd25waGV1Zm9vamZ6b3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDUxNTQsImV4cCI6MjEwOTI4MTE1NH0.FjWsw4XWoHvjUiFR7zmXMKNHBTZAxr8Sct8SKnrdFsQ';if(!key)return null;const r=await fetch(base(env)+'/auth/v1/user',{headers:{apikey:key,authorization:'Bearer '+token}});return r.ok?r.json():null;}
async function passwordHash(password,salt){const enc=new TextEncoder();const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:120000,hash:'SHA-256'},material,256);return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function readBody(request){try{return await request.json();}catch{return {};}}
export async function onRequest({request,env}) {
 if(request.method==='OPTIONS')return new Response(null,{status:204});
 const url=new URL(request.url),action=url.searchParams.get('action')||'';
 try {
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const body=await readBody(request);
  if(action==='resolve'){
   const slug=cleanText(url.searchParams.get('slug')||body.slug,20);
   if(!/^[A-Za-z0-9]{5,20}$/.test(slug))return json({error:'Kode PasteLink tidak valid.'},400);
   const rows=await db(env,`paste_links?select=id,slug,title,content,password_salt,password_hash,status,expires_at,created_at,user_id&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`);
   const item=rows?.[0];if(!item||(item.expires_at&&Date.parse(item.expires_at)<=Date.now()))return json({error:'PasteLink tidak ditemukan atau sudah kedaluwarsa.'},404);
   if(item.password_hash){const password=String(body.password||'');if(!password)return json({error:'Konten ini dilindungi password.',password_required:true,title:item.title},403);const hash=await passwordHash(password,item.password_salt);if(hash!==item.password_hash)return json({error:'Password salah.',password_required:true,title:item.title},403);}
   return json({success:true,item:{slug:item.slug,title:item.title,content:item.content,created_at:item.created_at}});
  }
  const user=await getUser(request,env);if(!user?.id)return json({error:'Silakan login terlebih dahulu.'},401);
  if(action==='create'){
   const profile=await db(env,`profiles?select=username&id=eq.${user.id}&limit=1`);
   if(!profile?.[0]?.username||!String(profile[0].username).trim())return json({error:'Atur username publik terlebih dahulu di halaman Akun Saya sebelum membuat PasteLink.'},400);
   const title=cleanText(body.title,140),content=String(body.content||'').trim(),password=String(body.password||'');
   if(title.length<2)return json({error:'Judul minimal 2 karakter.'},400);
   if(!content||content.length>12000)return json({error:'Konten wajib diisi dan maksimal 12.000 karakter.'},400);
   if(password.length>120)return json({error:'Password maksimal 120 karakter.'},400);
   const days=body.expires_days==null||body.expires_days===''||Number(body.expires_days)===0?null:Number(body.expires_days);
   if(days!==null&&![1,7,30,90].includes(days))return json({error:'Pilihan masa aktif tidak valid.'},400);
   let item=null;
   for(let i=0;i<5&&!item;i++){
    const slug=cleanSlug(),salt=password?crypto.randomUUID():null,hash=password?await passwordHash(password,salt):null;
    const expires_at=days?new Date(Date.now()+days*86400000).toISOString():null;
    try{const rows=await db(env,'paste_links?select=id,slug,title,created_at,expires_at',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:user.id,slug,title,content,password_salt:salt,password_hash:hash,expires_at,status:'published'})});item=rows?.[0]||null;}
    catch(e){if(!/duplicate|unique/i.test(e.message)||i===4)throw e;}
   }
   if(!item)throw new Error('Gagal membuat kode PasteLink.');
   return json({success:true,item,url:new URL('/pas/'+item.slug,url.origin).href});
  }
  if(action==='edit'||action==='update'){
   const id=cleanText(body.id||url.searchParams.get('id'),50);if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'ID PasteLink tidak valid.'},400);
   const rows=await db(env,`paste_links?select=id,user_id,slug,title,content,password_salt,password_hash,expires_at,status&id=eq.${id}&limit=1`);
   const item=rows?.[0];if(!item)return json({error:'PasteLink tidak ditemukan.'},404);
   const profiles=await db(env,`profiles?select=role&id=eq.${user.id}&limit=1`);
   if(item.user_id!==user.id&&profiles?.[0]?.role!=='admin')return json({error:'Tidak memiliki akses untuk mengubah PasteLink ini.'},403);
   if(action==='edit')return json({success:true,item:{id:item.id,slug:item.slug,title:item.title,content:item.content,expires_at:item.expires_at}});
   const patch={updated_at:new Date().toISOString()};
   if(body.title!==undefined){patch.title=cleanText(body.title,140);if(patch.title.length<2)return json({error:'Judul minimal 2 karakter.'},400);}
   if(body.content!==undefined){patch.content=String(body.content||'').trim();if(!patch.content||patch.content.length>12000)return json({error:'Konten wajib diisi dan maksimal 12.000 karakter.'},400);}
   if(body.password){const password=String(body.password);if(password.length>120)return json({error:'Password maksimal 120 karakter.'},400);patch.password_salt=crypto.randomUUID();patch.password_hash=await passwordHash(password,patch.password_salt);}
   if(body.clear_password===true){patch.password_salt=null;patch.password_hash=null;}
   if(body.expires_days!==undefined&&body.expires_days!==''){const days=body.expires_days==null||Number(body.expires_days)===0?null:Number(body.expires_days);if(days!==null&&![1,7,30,90].includes(days))return json({error:'Pilihan masa aktif tidak valid.'},400);patch.expires_at=days?new Date(Date.now()+days*86400000).toISOString():null;}
   const updated=await db(env,`paste_links?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
   return json({success:true,item:updated?.[0]||{slug:item.slug}});
  }
  return json({error:'Action tidak dikenal.'},404);
 }catch(error){return json({error:error?.message||'Internal server error.'},500);}
}
