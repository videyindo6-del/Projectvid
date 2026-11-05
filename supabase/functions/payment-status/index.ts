import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const out = (body:unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers:cors});
  if (req.method !== 'POST') return out({error:'Method tidak diizinkan'},405);
  try {
    const auth=req.headers.get('Authorization');
    if(!auth) return out({error:'Login diperlukan'},401);
    const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:authError}=await userClient.auth.getUser();
    if(authError||!user) return out({error:'Sesi tidak valid. Muat ulang halaman lalu coba lagi.'},401);
    const body=await req.json(); const order_id=String(body?.order_id||'').trim();
    if(!order_id) return out({error:'Order ID tidak dikirim'},400);
    const admin=createClient(url,service);
    const {data:o,error:orderError}=await admin.from('cashi_orders').select('order_id,user_id,status,amount,coupon_code,gateway_payload').eq('order_id',order_id).eq('user_id',user.id).maybeSingle();
    if(orderError) throw orderError;
    if(!o) return out({error:'Order tidak ditemukan atau bukan milik akun ini'},404);
    if(o.status==='SETTLED') return out({success:true,status:'SETTLED'});
    if(['EXPIRED','FAILED'].includes(String(o.status).toUpperCase())) return out({success:true,status:o.status});
    const key=Deno.env.get('CASHI_API_KEY');
    if(!key) return out({error:'CASHI_API_KEY belum disetel pada Supabase Edge Functions'},500);
    // Cashi create-order response uses camelCase `orderId`. Use that provider ID
    // for GET /check-status/:orderId; keep our own order_id for database ownership.
    const providerOrderIdFromCreate=String(o.gateway_payload?.orderId ?? o.gateway_payload?.order_id ?? order_id).trim();
    const r=await fetch(`https://cashi.id/api/check-status/${encodeURIComponent(providerOrderIdFromCreate)}`,{method:'GET',headers:{'x-api-key':key,'Accept':'application/json'},signal:AbortSignal.timeout(15000)});
    const raw=await r.text(); let d:any;
    try { d=raw?JSON.parse(raw):{}; } catch { return out({error:'Respons check-status Cashi bukan JSON yang valid'},502); }
    if(!r.ok||!d?.success) return out({error:d?.message||'Cashi gagal memeriksa status transaksi',detail:d},502);
    // Cashi response may wrap transaction fields in data/result. Never mark paid
    // unless a provider order identifier is present and matches our stored order.
    const provider = d?.data ?? d?.result ?? d?.transaction ?? d;
    // Official Cashi check-status response documents `order_id`; compare it
    // with the `orderId` returned by create-order, not blindly with our DB ID.
    const providerOrderId = String(provider?.order_id ?? provider?.orderId ?? '').trim();
    if(!providerOrderId) {
      console.error('Cashi check-status response missing order_id; response keys:', Object.keys(provider||{}));
      return out({error:'Respons check-status Cashi tidak menyertakan order_id',provider_fields:Object.keys(provider||{})},502);
    }
    if(providerOrderId!==providerOrderIdFromCreate) {
      console.error('Cashi order mismatch', {expected_provider_order_id:providerOrderIdFromCreate, received:providerOrderId});
      return out({error:'Order ID dari Cashi tidak cocok',expected_provider_order_id:providerOrderIdFromCreate,provider_order_id:providerOrderId},409);
    }
    const state=String(provider?.status ?? 'PENDING').toUpperCase();
    if(state==='SETTLED') {
      const paid=Number(provider?.amount ?? provider?.paid_amount);
      const expected=Number(o.amount);
      // Cashi dapat melaporkan nominal terbayar termasuk biaya gateway. Cocokkan order
      // dan batasi selisih biaya; RPC tetap menerima nominal order asli untuk settlement.
      const maxAllowed=expected+Math.ceil(expected*0.03)+100;
      if(!Number.isFinite(paid)||paid<expected||paid>maxAllowed) return out({error:'Nominal pembayaran tidak sesuai dengan order',expected_amount:expected,provider_amount:d.amount},409);
      const {data,error}=await admin.rpc('settle_cashi_order',{p_order_id:order_id,p_amount:expected,p_payload:d});
      if(error||!data?.ok) { console.error('Cashi settlement rejected',error||data); return out({error:'Pembayaran terdeteksi SETTLED tetapi aktivasi akses gagal. Hubungi admin dengan Order ID.',detail:data||error?.message},500); }
    }
    if(['EXPIRED','FAILED','CANCELLED','CANCELED'].includes(state)) {
      if(o.coupon_code) await admin.rpc('release_referral_coupon',{p_order_id:order_id});
      await admin.from('cashi_orders').update({status:state==='CANCELLED'||state==='CANCELED'?'FAILED':state}).eq('order_id',order_id);
    }
    return out({success:true,status:state,amount:provider?.amount,order_id});
  } catch(e) {
    console.error('payment-status error',e);
    return out({error:e?.message||'Kesalahan internal saat memeriksa pembayaran'},500);
  }
});
