import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try {
  const auth=req.headers.get('Authorization'); if(!auth) return reply({error:'Login diperlukan'},401);
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await userClient.auth.getUser(); if(!user) return reply({error:'Sesi tidak valid'},401);
  const admin=createClient(url,service); const apiKey=Deno.env.get('CASHI_API_KEY'); if(!apiKey) throw new Error('CASHI_API_KEY belum disetel'); const body=await req.json(); const purpose=body.purpose;
  if(!['vip','review_download','vip_group'].includes(purpose)) return reply({error:'Jenis transaksi tidak valid'},400);
  let baseAmount=0,plan_id=null,review_id=null,vip_group_id=null,vip_group_invite_url:string|null=null,discountPercent=0,couponCode:string|null=null;
  const order_id=`BC${Date.now()}${crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}`;
  if(purpose==='vip') {
   const {data,error}=await admin.from('vip_plans').select('id,price,status').eq('id',body.plan_id).single();
   if(error||!data||data.status!=='published') return reply({error:'Paket VIP tidak ditemukan'},404);
   baseAmount=Number(data.price); plan_id=data.id;
  } else if(purpose==='vip_group') {
   const {data,error}=await admin.from('vip_groups').select('id,price,status,telegram_url').eq('id',body.group_id).single();
   if(error||!data||data.status!=='published') return reply({error:'Group VIP tidak ditemukan'},404);
   if(!data.telegram_url||!/^https:\/\/(t\.me|telegram\.me)\//i.test(data.telegram_url)) return reply({error:'Link undangan Telegram belum dikonfigurasi admin'},409);
   const {data:owned}=await admin.from('vip_group_entitlements').select('id').eq('user_id',user.id).eq('group_id',data.id).maybeSingle();
   if(owned) return reply({error:'Group ini sudah dibeli'},409);
   baseAmount=Number(data.price); vip_group_id=data.id; vip_group_invite_url=data.telegram_url;
  } else {
   const {data,error}=await admin.from('review_items').select('id,price,access,status').eq('id',body.review_id).single();
   if(error||!data||data.status!=='published') return reply({error:'Konten review tidak ditemukan'},404);
   if(data.access==='free') return reply({error:'Konten ini gratis, tidak perlu checkout'},400);
   const {data:owned}=await admin.from('review_entitlements').select('id').eq('user_id',user.id).eq('review_id',data.id).maybeSingle();
   if(owned) return reply({error:'Konten sudah dibeli'},409);
   baseAmount=Number(data.price); review_id=data.id;
   const {data:profile}=await admin.from('profiles').select('vip_expires_at').eq('id',user.id).maybeSingle();
   if(profile?.vip_expires_at && new Date(profile.vip_expires_at)>new Date()) discountPercent=20;
   if(body.coupon_code && String(body.coupon_code).trim()) {
    const {data:reserved,error:reserveError}=await admin.rpc('reserve_referral_coupon',{p_user_id:user.id,p_code:String(body.coupon_code).trim(),p_order_id:order_id});
    if(reserveError) throw reserveError;
    if(!reserved?.ok) return reply({error:reserved?.reason||'Kode diskon tidak valid'},400);
    couponCode=reserved.coupon_code;
    discountPercent=Math.max(discountPercent,Number(reserved.discount_percent)||0);
   }
  }
  const amount=Math.round(baseAmount*(100-discountPercent)/100);
  if(!Number.isInteger(baseAmount)||baseAmount<2000||baseAmount>10000000||amount<2000) {
   if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
   return reply({error:'Nominal setelah diskon harus minimal Rp2.000'},400);
  }
  const {error:ins}=await admin.from('cashi_orders').insert({
   order_id,user_id:user.id,purpose,plan_id,review_id,vip_group_id,vip_group_invite_url,amount,base_amount:baseAmount,
   discount_percent:discountPercent,coupon_code:couponCode
  });
  if(ins) {
   if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
   throw ins;
  }
  let response:Response;
  let result:any;
  try {
   response=await fetch('https://cashi.id/api/create-order',{method:'POST',headers:{'x-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({amount,order_id}),signal:AbortSignal.timeout(20000)});
   const raw=await response.text();
   try { result=raw ? JSON.parse(raw) : {}; } catch { throw new Error('Respons Cashi bukan JSON yang valid'); }
  } catch(gatewayError) {
   await admin.from('cashi_orders').update({status:'FAILED',gateway_payload:{error:String(gatewayError)}}).eq('order_id',order_id);
   if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
   throw gatewayError;
  }
  if(!response.ok||!result?.success||!result?.checkout_url){
   await admin.from('cashi_orders').update({status:'FAILED',gateway_payload:result||{}}).eq('order_id',order_id);
   if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
   return reply({error:result?.message||'Cashi gagal membuat pembayaran'},502);
  }
  const {error:updateError}=await admin.from('cashi_orders').update({checkout_url:result.checkout_url,gateway_payload:result}).eq('order_id',order_id);
  if(updateError){
   await admin.from('cashi_orders').update({status:'FAILED'}).eq('order_id',order_id);
   if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
   throw updateError;
  }
  return reply({success:true,order_id,amount,base_amount:baseAmount,discount_percent:discountPercent,checkout_url:result.checkout_url,qrUrl:result.qrUrl||null,expires_at:result.expires_at||null});
 } catch(e) { console.error(e); return reply({error:e.message||'Internal error'},500); }
});
