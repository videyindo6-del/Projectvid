import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 try {
  const auth=req.headers.get('Authorization')||'';
  const bearerToken=auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()||'';
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin=createClient(url,service);
  const body=await req.json(); const purpose=body.purpose;
  let user:any=null;
  // supabase.functions.invoke may send the anon key as Authorization for guests.
  // Ignore that public key; validate only a real member access token.
  if(bearerToken && bearerToken!==anon){
   const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${bearerToken}`}}});
   const authResult=await userClient.auth.getUser();
   user=authResult.data?.user||null;
   // AutoLink Direct Access has a guest QRIS path. If the browser retained an
   // expired/stale session, allow guest checkout only when no member coupon is
   // requested. All other payment purposes still require a valid member session.
   if(!user && !(purpose==='autolink_direct_access' && !body.coupon_code)){
    return reply({error:'Sesi login tidak valid. Silakan login kembali.'},401);
   }
  }
  const apiKey=Deno.env.get('CASHI_API_KEY'); if(!apiKey) throw new Error('CASHI_API_KEY belum disetel');

  // AutoLink Direct Access supports guest QRIS checkout. Member-only wallets/coupons
  // are handled separately through the authenticated wallet RPC.
  if(purpose==='autolink_direct_access'){
   const shortCode=String(body.short_code||'').trim();
   if(!/^[A-Za-z0-9]{3,12}$/.test(shortCode)) return reply({error:'Kode AutoLink tidak valid'},400);
   const {data:link,error:linkError}=await admin.from('autolinks').select('id,publisher_id,target_url,title,status').eq('short_code',shortCode).eq('status','published').maybeSingle();
   if(linkError) throw linkError;
   if(!link) return reply({error:'AutoLink tidak ditemukan atau tidak aktif'},404);
   if(user?.id===link.publisher_id) return reply({error:'Kamu tidak dapat membeli akses AutoLink milik sendiri'},403);
   const requestedCoupon=user&&body.coupon_code?String(body.coupon_code).trim():'';
   if(!user&&body.coupon_code) return reply({error:'Kode diskon hanya tersedia untuk member yang login'},401);
   const order_id=`BCAL${Date.now()}${crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}`;
   const guestToken=user?null:crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
   const tokenHash=guestToken?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(guestToken)))).map(x=>x.toString(16).padStart(2,'0')).join(''):null;
   const {error:orderError}=await admin.from('cashi_orders').insert({
    order_id,user_id:user?.id||null,purpose:'autolink_direct_access',autolink_id:link.id,
    amount:3500,base_amount:3500,discount_percent:0,status:'PENDING'
   });
   if(orderError) throw orderError;
   let discountPercent=0,couponCode:string|null=null;
   if(requestedCoupon){
    const {data:reserved,error:reserveError}=await admin.rpc('reserve_referral_coupon',{p_user_id:user.id,p_code:requestedCoupon,p_order_id:order_id});
    if(reserveError||!reserved?.ok){
     await admin.from('cashi_orders').delete().eq('order_id',order_id);
     if(reserveError) throw reserveError;
     return reply({error:reserved?.reason||'Kode diskon tidak valid'},400);
    }
    couponCode=reserved.coupon_code;
    discountPercent=Number(reserved.discount_percent)||0;
   }
   const amount=Math.round(3500*(100-discountPercent)/100);
   if(amount<2000){
    if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
    await admin.from('cashi_orders').update({status:'FAILED'}).eq('order_id',order_id);
    return reply({error:'Nominal setelah diskon minimal Rp2.000'},400);
   }
   const {error:paymentError}=await admin.from('autolink_payments').insert({
    order_id,autolink_id:link.id,buyer_id:user?.id||null,publisher_id:link.publisher_id,
    target_url_snapshot:link.target_url,title_snapshot:link.title,amount,publisher_amount:2000,
    platform_amount:amount-2000,status:'pending',guest_token_hash:tokenHash
   });
   if(paymentError){
    if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
    await admin.from('cashi_orders').update({status:'FAILED'}).eq('order_id',order_id);
    throw paymentError;
   }
   const {error:orderUpdateError}=await admin.from('cashi_orders').update({amount,base_amount:3500,discount_percent:discountPercent,coupon_code:couponCode}).eq('order_id',order_id);
   if(orderUpdateError) throw orderUpdateError;
   let gateway:any;
   try{
    const response=await fetch('https://cashi.id/api/create-order',{method:'POST',headers:{'x-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({amount,order_id}),signal:AbortSignal.timeout(20000)});
    const raw=await response.text(); try{gateway=raw?JSON.parse(raw):{};}catch{throw new Error('Respons Cashi bukan JSON yang valid');}
    if(!response.ok||!gateway?.success||!gateway?.checkout_url||!String(gateway?.orderId||gateway?.order_id||'').trim()) throw new Error(gateway?.message||'Cashi gagal membuat pembayaran');
   }catch(gatewayError){
    await admin.from('cashi_orders').update({status:'FAILED',gateway_payload:{error:String(gatewayError)}}).eq('order_id',order_id);
    await admin.from('autolink_payments').update({status:'failed'}).eq('order_id',order_id);
    if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
    throw gatewayError;
   }
   const {error:updateError}=await admin.from('cashi_orders').update({checkout_url:gateway.checkout_url,gateway_payload:gateway}).eq('order_id',order_id);
   if(updateError) throw updateError;
   return reply({success:true,order_id,provider_order_id:String(gateway.orderId||gateway.order_id),amount,base_amount:3500,discount_percent:discountPercent,checkout_url:gateway.checkout_url,qrUrl:gateway.qrUrl||null,expires_at:gateway.expires_at||null,guest_token:guestToken});
  }

  if(!user) return reply({error:'Login diperlukan untuk jenis transaksi ini'},401);
  if(!['vip','review_download','vip_group','wallet_topup'].includes(purpose)) return reply({error:'Jenis transaksi tidak valid'},400);
  let baseAmount=0,plan_id=null,review_id=null,vip_group_id=null,vip_group_invite_url:string|null=null,discountPercent=0,couponCode:string|null=null,affiliateReferrerId:string|null=null;
  const requestedCoupon=body.coupon_code?String(body.coupon_code).trim():'';
  if(purpose==='wallet_topup' && requestedCoupon) return reply({error:'Kode diskon tidak berlaku untuk deposit saldo'},400);
  const order_id=`BC${Date.now()}${crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}`;
  if(purpose==='wallet_topup') {
   baseAmount=Number(body.amount);
   if(!Number.isSafeInteger(baseAmount)||baseAmount<10000||baseAmount>10000000) return reply({error:'Deposit minimal Rp10.000 dan maksimal Rp10.000.000'},400);
  } else if(purpose==='vip') {
   const {data,error}=await admin.from('vip_plans').select('id,price,status').eq('id',body.plan_id).single();
   if(error||!data||data.status!=='published') return reply({error:'Paket VIP tidak ditemukan'},404);
   baseAmount=Number(data.price); plan_id=data.id;
  } else if(purpose==='vip_group') {
   const {data,error}=await admin.from('vip_groups').select('id,price,status').eq('id',body.group_id).single();
   if(error||!data||data.status!=='published') return reply({error:'Group VIP tidak ditemukan'},404);
   // Invite links live in the private table after vip_group_secret_hardening.sql.
   const {data:secret,error:secretError}=await admin.from('vip_group_secrets').select('telegram_url').eq('group_id',data.id).maybeSingle();
   if(secretError) throw secretError;
   const inviteUrl=secret?.telegram_url;
   if(!inviteUrl||!/^https:\/\/(t\.me|telegram\.me)\//i.test(inviteUrl)) return reply({error:'Link undangan Telegram belum dikonfigurasi admin'},409);
   const {data:owned}=await admin.from('vip_group_entitlements').select('id').eq('user_id',user.id).eq('group_id',data.id).maybeSingle();
   if(owned) return reply({error:'Group ini sudah dibeli'},409);
   baseAmount=Number(data.price); vip_group_id=data.id; vip_group_invite_url=inviteUrl;
  } else {
   const {data,error}=await admin.from('review_items').select('id,price,access,status').eq('id',body.review_id).single();
   if(error||!data||data.status!=='published') return reply({error:'Konten review tidak ditemukan'},404);
   if(data.access==='free') return reply({error:'Konten ini gratis, tidak perlu checkout'},400);
   const {data:owned}=await admin.from('review_entitlements').select('id').eq('user_id',user.id).eq('review_id',data.id).maybeSingle();
   if(owned) return reply({error:'Konten sudah dibeli'},409);
   baseAmount=Number(data.price); review_id=data.id;
   const {data:profile}=await admin.from('profiles').select('vip_expires_at').eq('id',user.id).maybeSingle();
   if(profile?.vip_expires_at && new Date(profile.vip_expires_at)>new Date()) discountPercent=20;
  }
  if(purpose==='vip' && !requestedCoupon){ /* VIP member benefit is applied below when eligible. */ }
  if(!Number.isSafeInteger(baseAmount)||baseAmount<2000||baseAmount>10000000) return reply({error:'Nominal harus antara Rp2.000 sampai Rp10.000.000'},400);
  if(purpose!=='wallet_topup' && body.affiliate_code) {
   const {data:affiliate}=await admin.from('profiles').select('id,affiliate_status,referral_code').ilike('referral_code',String(body.affiliate_code).trim()).maybeSingle();
   if(affiliate?.affiliate_status==='approved' && affiliate.id!==user.id) affiliateReferrerId=affiliate.id;
  }

  // Insert first: reserve_referral_coupon locks and updates this order row.
  const {error:ins}=await admin.from('cashi_orders').insert({
   order_id,user_id:user.id,purpose,plan_id,review_id,vip_group_id,vip_group_invite_url,
   amount:baseAmount,base_amount:baseAmount,discount_percent:discountPercent,affiliate_referrer_id:affiliateReferrerId
  });
  if(ins) throw ins;

  if(requestedCoupon) {
   const {data:reserved,error:reserveError}=await admin.rpc('reserve_referral_coupon',{
    p_user_id:user.id,p_code:requestedCoupon,p_order_id:order_id
   });
   if(reserveError||!reserved?.ok) {
    await admin.from('cashi_orders').delete().eq('order_id',order_id).eq('user_id',user.id);
    if(reserveError) throw reserveError;
    return reply({error:reserved?.reason||'Kode diskon tidak valid'},400);
   }
   couponCode=reserved.coupon_code;
   discountPercent=Math.max(discountPercent,Number(reserved.discount_percent)||0);
  }

  const amount=Math.round(baseAmount*(100-discountPercent)/100);
  if(amount<2000) {
   if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
   await admin.from('cashi_orders').update({status:'FAILED'}).eq('order_id',order_id);
   return reply({error:'Nominal setelah diskon harus minimal Rp2.000'},400);
  }
  const {error:amountUpdateError}=await admin.from('cashi_orders').update({
   amount,base_amount:baseAmount,discount_percent:discountPercent,coupon_code:couponCode
  }).eq('order_id',order_id);
  if(amountUpdateError) {
   if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
   await admin.from('cashi_orders').update({status:'FAILED'}).eq('order_id',order_id);
   throw amountUpdateError;
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
  if(!response.ok||!result?.success||!result?.checkout_url||!String(result?.orderId||result?.order_id||'').trim()){
   await admin.from('cashi_orders').update({status:'FAILED',gateway_payload:result||{}}).eq('order_id',order_id);
   if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
   return reply({error:result?.message||'Cashi gagal membuat pembayaran atau tidak mengembalikan Order ID Cashi'},502);
  }
  const {error:updateError}=await admin.from('cashi_orders').update({checkout_url:result.checkout_url,gateway_payload:result}).eq('order_id',order_id);
  if(updateError){
   await admin.from('cashi_orders').update({status:'FAILED'}).eq('order_id',order_id);
   if(couponCode) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
   throw updateError;
  }
  return reply({success:true,order_id,provider_order_id:String(result.orderId||result.order_id),amount,base_amount:baseAmount,discount_percent:discountPercent,checkout_url:result.checkout_url,qrUrl:result.qrUrl||null,expires_at:result.expires_at||null});
 } catch(e) { console.error(e); return reply({error:e.message||'Internal error'},500); }
});
