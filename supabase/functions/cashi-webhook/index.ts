import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 if(req.method!=='POST') return new Response('Method not allowed',{status:405});
 const raw=await req.text(); const signature=req.headers.get('x-gateway-signature')||''; const secret=Deno.env.get('CASHI_SECRET_KEY')||'';
 if(!signature||!secret) return new Response('Missing signature configuration',{status:401});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const expected=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)));
 const a=new TextEncoder().encode(expected),b=new TextEncoder().encode(signature.toLowerCase());
 if(a.length!==b.length||!crypto.subtle) return new Response('Invalid signature',{status:401});
 let diff=0; for(let i=0;i<a.length;i++) diff|=a[i]^b[i]; if(diff!==0) return new Response('Invalid signature',{status:401});
 try {
  const payload=JSON.parse(raw); if(payload.event!=='PAYMENT_SETTLED') return new Response('Ignored',{status:200});
  const d=payload.data||{}; if(d.status!=='SETTLED'||!d.order_id) return new Response('Ignored',{status:200});
  if(String(d.order_id).startsWith('TEST-')) return new Response('Test connection successful',{status:200});
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const paid=Number(d.amount??payload.amount??0); if(!Number.isFinite(paid)) return new Response('Invalid amount',{status:400});
  const {data:order,error:orderError}=await admin.from('cashi_orders').select('amount').eq('order_id',String(d.order_id)).maybeSingle();
  if(orderError||!order) return new Response('Order not found',{status:404});
  const expected=Number(order.amount), maxAllowed=expected+Math.ceil(expected*0.03)+100;
  if(paid<expected||paid>maxAllowed) return new Response('Amount mismatch',{status:400});
  const {data,error}=await admin.rpc('settle_cashi_order',{p_order_id:String(d.order_id),p_amount:expected,p_payload:payload});
  if(error){console.error(error);return new Response('Settlement failed',{status:500})}
  if(!data?.ok) return new Response(data?.reason||'Rejected',{status:400});
  return new Response('OK',{status:200});
 } catch(e){console.error(e);return new Response('Bad payload',{status:400})}
});
