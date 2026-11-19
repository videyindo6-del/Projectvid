import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const out = (body:unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers:cors});
  if (req.method !== 'POST') return out({error:'Method tidak diizinkan'},405);
  try {
    const auth=req.headers.get('Authorization')||'';
    const bearerToken=auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()||'';
    const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let user:any=null;
    // Guest requests can carry the Supabase anon key in Authorization.
    // Only validate a non-anon Bearer token as a signed-in member session.
    if(bearerToken && bearerToken!==anon){
      const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${bearerToken}`}}});
      const authResult=await userClient.auth.getUser();
      user=authResult.data?.user||null;
      // Guest AutoLink orders are authorized below by their one-time guest token.
      // Do not reject them just because the browser also sent a stale session.
    }
    const body=await req.json(); const order_id=String(body?.order_id||'').trim();
    if(!order_id) return out({error:'Order ID tidak dikirim'},400);
    const admin=createClient(url,service);
    const {data:o,error:orderError}=await admin.from('cashi_orders').select('order_id,user_id,purpose,status,amount,coupon_code,gateway_payload').eq('order_id',order_id).maybeSingle();
    if(orderError) throw orderError;
    if(!o) return out({error:'Order tidak ditemukan'},404);
    if(o.user_id){
      if(!user||o.user_id!==user.id) return out({error:'Order bukan milik akun ini'},403);
    }else{
      if(o.purpose!=='autolink_direct_access') return out({error:'Order tamu tidak diizinkan untuk transaksi ini'},403);
      const guestToken=String(body?.guest_token||'');
      if(guestToken.length<32) return out({error:'Token pembayaran tamu tidak valid'},401);
      const {data:payment,error:paymentError}=await admin.from('autolink_payments').select('guest_token_hash').eq('order_id',order_id).maybeSingle();
      if(paymentError) throw paymentError;
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(guestToken));
      const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
      if(!payment?.guest_token_hash||payment.guest_token_hash!==hash) return out({error:'Token pembayaran tidak cocok'},403);
    }
    if(o.status==='SETTLED'){
      if(o.purpose==='vip_group'){
        const {data:grantData,error:grantError}=await admin.rpc('ensure_vip_group_entitlement_for_order',{p_order_id:order_id});
        if(grantError||!grantData?.ok){
          console.error('VIP Group entitlement recovery failed for settled order',grantError||grantData);
          return out({error:'Pembayaran sudah tercatat berhasil, tetapi link Group VIP belum dapat diterbitkan. Hubungi admin dengan Order ID.',detail:grantData||grantError?.message,order_id},500);
        }
      }
      return out({success:true,status:'SETTLED',order_id});
    }
    if(['EXPIRED','FAILED'].includes(String(o.status).toUpperCase())) return out({success:true,status:o.status});
    const key=Deno.env.get('CASHI_API_KEY');
    if(!key) return out({error:'CASHI_API_KEY belum disetel pada Supabase Edge Functions'},500);
    // Cashi create-order mengembalikan orderId (camelCase); ID ini dipakai pada endpoint check-status.
    const providerOrderIdFromCreate=String(o.gateway_payload?.orderId ?? o.gateway_payload?.order_id ?? order_id).trim();
    const r=await fetch(`https://cashi.id/api/check-status/${encodeURIComponent(providerOrderIdFromCreate)}`,{method:'GET',headers:{'x-api-key':key,'Accept':'application/json'},signal:AbortSignal.timeout(15000)});
    const raw=await r.text(); let d:any;
    try { d=raw?JSON.parse(raw):{}; } catch { return out({error:'Respons check-status Cashi bukan JSON yang valid'},502); }
    const pickObject = (root:any):any => {
      let cur=root;
      for(let i=0;i<4;i++){
        if(!cur || typeof cur!=='object') break;
        if(cur.data && typeof cur.data==='object'){cur=cur.data;continue;}
        if(cur.result && typeof cur.result==='object'){cur=cur.result;continue;}
        if(cur.transaction && typeof cur.transaction==='object'){cur=cur.transaction;continue;}
        break;
      }
      return cur || {};
    };
    const provider = pickObject(d);
    const success = d?.success === true || d?.data?.success === true || d?.result?.success === true;
    if(!r.ok||!success) return out({error:d?.message||d?.error||'Cashi gagal memeriksa status transaksi',detail:d},502);

    const echoedOrderId=String(provider?.order_id ?? provider?.orderId ?? d?.order_id ?? d?.orderId ?? '').trim();
    const allowedOrderIds=new Set([order_id,providerOrderIdFromCreate]);
    if(echoedOrderId && !allowedOrderIds.has(echoedOrderId)){
      console.error('Cashi order mismatch',{merchant_order_id:order_id,expected_provider_order_id:providerOrderIdFromCreate,received_order_id:echoedOrderId});
      return out({error:'Order ID dari Cashi tidak cocok',expected_merchant_order_id:order_id,expected_provider_order_id:providerOrderIdFromCreate,provider_order_id:echoedOrderId},409);
    }
    // Jika Cashi tidak mengirim ulang order_id, korelasi tetap aman karena URL
    // check-status memakai provider ID yang diambil dari gateway_payload order milik user.
    const state=String(provider?.status ?? d?.status ?? 'PENDING').toUpperCase();
    if(state==='SETTLED'){
      // Beberapa respons Cashi membungkus data di data/result/transaction.
      // Ambil amount dari level transaksi yang sebenarnya, bukan metadata envelope.
      const amountCandidates=[
        provider?.amount, provider?.paid_amount, provider?.total_amount,
        d?.amount, d?.paid_amount, d?.total_amount,
        d?.data?.amount, d?.data?.paid_amount,
        d?.result?.amount, d?.result?.paid_amount,
        d?.transaction?.amount, d?.transaction?.paid_amount
      ];
      const rawPaidAmount=amountCandidates.find(v=>v!==undefined&&v!==null&&String(v).trim()!=='');
      const expected=Number(o.amount);
      // Sebagian respons check-status Cashi hanya mengembalikan success + status
      // (tanpa amount), meskipun dokumentasi juga menampilkan contoh yang berisi amount.
      // Jika amount status tidak ada, gunakan amount yang Cashi kembalikan saat create-order
      // sebagai batas nominal order. Ini aman hanya karena request status memakai API key,
      // provider order ID milik order user ini, dan status harus SETTLED.
      const createAmount=o.gateway_payload?.amount ?? o.gateway_payload?.data?.amount ?? null;
      const amountForValidation=rawPaidAmount ?? createAmount;
      const paid=Number(amountForValidation);
      const amountSource=rawPaidAmount!==undefined?'check-status':'create-order-fallback';
      // Cashi dapat mengembalikan jumlah setelah biaya gateway (contoh dokumentasi:
      // 50.000 menjadi 50.078). Nilai di atas tagihan dalam toleransi wajar diterima.
      const maxAllowed=expected+Math.ceil(expected*0.03)+100;
      if(!Number.isSafeInteger(paid)||paid<=0||!Number.isSafeInteger(expected)||expected<=0||paid<expected||paid>maxAllowed){
        console.error('Cashi settled amount mismatch',{merchant_order_id:order_id,provider_order_id:providerOrderIdFromCreate,expected_amount:expected,provider_amount:Number.isFinite(paid)?paid:null,raw_amount:rawPaidAmount??null,create_order_amount:createAmount,amount_source:amountSource});
        return out({error:'Nominal transaksi Cashi tidak cocok dengan tagihan',expected_amount:expected,provider_amount:Number.isFinite(paid)?paid:null,provider_amount_raw:rawPaidAmount??null,provider_status:state,amount_source:amountSource,order_id},409);
      }
      const {data,error}=await admin.rpc('settle_cashi_order',{p_order_id:order_id,p_amount:expected,p_payload:d});
      if(error||!data?.ok){console.error('Cashi settlement rejected',error||data);return out({error:'Pembayaran terdeteksi SETTLED tetapi aktivasi akses gagal. Hubungi admin dengan Order ID.',detail:data||error?.message},500);}
      // Idempotent recovery: settlement may have succeeded earlier while the
      // VIP Group entitlement insert failed or the invite URL was not configured.
      if(o.purpose==='vip_group'){
        const {data:grantData,error:grantError}=await admin.rpc('ensure_vip_group_entitlement_for_order',{p_order_id:order_id});
        if(grantError||!grantData?.ok){
          console.error('VIP Group entitlement recovery failed',grantError||grantData);
          return out({error:'Pembayaran berhasil, tetapi link Group VIP belum dapat diterbitkan. Hubungi admin dengan Order ID.',detail:grantData||grantError?.message,order_id},500);
        }
      }
    }
    if(['EXPIRED','FAILED','CANCELLED','CANCELED'].includes(state)) {
      if(o.coupon_code) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
      await admin.from('cashi_orders').update({status:state==='CANCELLED'||state==='CANCELED'?'FAILED':state}).eq('order_id',order_id);
    }
    return out({success:true,status:state,amount:provider?.amount ?? provider?.paid_amount ?? d?.amount ?? d?.paid_amount ?? o.gateway_payload?.amount ?? null,order_id});
  } catch(e) {
    console.error('payment-status error',e);
    return out({error:e?.message||'Kesalahan internal saat memeriksa pembayaran'},500);
  }
});
