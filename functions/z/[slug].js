const SUPABASE_URL='https://djxcdwnpheufoojfzorx.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeGNkd25waGV1Zm9vamZ6b3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDUxNTQsImV4cCI6MjEwOTI4MTE1NH0.FjWsw4XWoHvjUiFR7zmXMKNHBTZAxr8Sct8SKnrdFsQ';
import { serveSlugPage } from "../_utils/serve-slug-page.js";
export async function onRequest(context) {
  const code=String(context.params?.slug||'').trim();
  if(!/^[A-Za-z0-9]{3,12}$/.test(code)) return new Response('Kode link tidak valid.',{status:400});
  const base=String(context.env?.SUPABASE_URL||SUPABASE_URL).replace(/\/$/,'');
  const headers={apikey:context.env?.SUPABASE_ANON_KEY||SUPABASE_ANON_KEY};
  try {
    const [auto,paste]=await Promise.all([
      fetch(base+'/rest/v1/autolinks?select=id&short_code=eq.'+encodeURIComponent(code)+'&status=eq.published&limit=1',{headers}),
      fetch(base+'/rest/v1/social_posts?select=public_url&short_code=eq.'+encodeURIComponent(code)+'&status=eq.published&limit=1',{headers})
    ]);
    if(auto.ok){const rows=await auto.json();if(rows?.length)return serveSlugPage(context,'/go.html');}
    if(paste.ok){const rows=await paste.json();if(rows?.[0]?.public_url){const dest=new URL(rows[0].public_url);if(['http:','https:'].includes(dest.protocol))return Response.redirect(dest.href,302);}}
    return new Response('Link tidak ditemukan atau sudah tidak tersedia.',{status:404,headers:{'Cache-Control':'no-store'}});
  } catch(e) { return new Response('Gagal memuat link. Silakan coba lagi.',{status:502,headers:{'Cache-Control':'no-store'}}); }
}
