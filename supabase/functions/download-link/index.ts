import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
 const auth=req.headers.get('Authorization');if(!auth)return out({error:'Login diperlukan'},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user}}=await userClient.auth.getUser();if(!user)return out({error:'Sesi tidak valid'},401);
 const {review_id}=await req.json();const admin=createClient(url,service);const {data:item}=await admin.from('review_items').select('access,status').eq('id',review_id).single();if(!item||item.status!=='published')return out({error:'Konten tidak ditemukan'},404);
 const {data:secret}=await admin.from('review_download_secrets').select('download_url').eq('review_id',review_id).single();if(!secret?.download_url)return out({error:'Link download belum diatur admin'},404);const {data:content}=await admin.from('review_content_secrets').select('content_after_payment').eq('review_id',review_id).maybeSingle();
 if(item.access!=='free'){ const {data:ent}=await admin.from('review_entitlements').select('id').eq('user_id',user.id).eq('review_id',review_id).maybeSingle();if(!ent)return out({error:'Pembelian belum ditemukan'},403)}
 return out({success:true,download_url:secret.download_url,content_after_payment:content?.content_after_payment||''});
}catch(e){return out({error:e.message||'Internal error'},500)}});
