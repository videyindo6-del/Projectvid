import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
 const auth=req.headers.get('Authorization');if(!auth)return out({error:'Login diperlukan'},401);const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user}}=await userClient.auth.getUser();if(!user)return out({error:'Sesi tidak valid'},401);
 const {order_id}=await req.json();const admin=createClient(url,service);const {data:o}=await admin.from('cashi_orders').select('order_id,user_id,status,amount,coupon_code').eq('order_id',order_id).eq('user_id',user.id).single();if(!o)return out({error:'Order tidak ditemukan'},404);if(o.status==='SETTLED')return out({success:true,status:'SETTLED'});
 const key=Deno.env.get('CASHI_API_KEY');const r=await fetch(`https://cashi.id/api/check-status/${encodeURIComponent(order_id)}`,{headers:{'x-api-key':key||''}});const d=await r.json();if(!r.ok||!d.success)return out({error:'Gagal memeriksa status Cashi',detail:d},502);if(String(d.order_id||order_id)!==String(order_id))return out({error:'Order ID Cashi tidak cocok'},409);
 if(d.status==='SETTLED'){const {data,error}=await admin.rpc('settle_cashi_order',{p_order_id:order_id,p_amount:Math.round(Number(d.amount||0)),p_payload:d});if(error||!data?.ok)return out({error:'Settlement gagal'},500)}
 if(['EXPIRED','FAILED','CANCELLED'].includes(String(d.status).toUpperCase()) && o.coupon_code){
  await admin.rpc('release_referral_coupon',{p_order_id:order_id});
  await admin.from('cashi_orders').update({status:String(d.status).toUpperCase()==='CANCELLED'?'FAILED':String(d.status).toUpperCase()}).eq('order_id',order_id);
 }
 return out({success:true,status:d.status,amount:d.amount});
}catch(e){return out({error:e.message||'Internal error'},500)}});
