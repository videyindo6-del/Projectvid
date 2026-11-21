import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
serve(async (req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return new Response("Method not allowed",{status:405,headers:corsHeaders});
 const url=Deno.env.get("SUPABASE_URL")!, key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const supabase=createClient(url,key); const now=new Date(); const years=[now.getUTCFullYear(),now.getUTCFullYear()+1]; let total=0;
 for(const year of years){const r=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`);if(!r.ok)continue;const days=await r.json();const rows=days.map((d:any)=>({holiday_date:d.date,holiday_name:d.localName||d.name,source:"Nager.Date",updated_at:new Date().toISOString()}));if(rows.length){const {error}=await supabase.from("indonesia_public_holidays").upsert(rows,{onConflict:"holiday_date"});if(error)throw error;total+=rows.length;}}
 return Response.json({ok:true,holidays_synced:total,years},{headers:corsHeaders});
});