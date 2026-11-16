const SUPABASE_URL = "https://djxcdwnpheufoojfzorx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeGNkd25waGV1Zm9vamZ6b3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MDUxNTQsImV4cCI6MjEwOTI4MTE1NH0.FjWsw4XWoHvjUiFR7zmXMKNHBTZAxr8Sct8SKnrdFsQ";
import { serveSlugPage } from "../_utils/serve-slug-page.js";

const noStore = { "Cache-Control": "no-store" };

export async function onRequest(context) {
  const code = String(context.params?.slug || "").trim();
  if (!/^[A-Za-z0-9]{3,12}$/.test(code)) {
    return new Response("Kode link tidak valid.", {
      status: 400,
      headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const base = String(context.env?.SUPABASE_URL || SUPABASE_URL).replace(/\/$/, "");
  const anonKey = context.env?.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  };

  try {
    const [autoResponse, pasteResponse] = await Promise.all([
      fetch(
        `${base}/rest/v1/autolink_public?select=id&short_code=eq.${encodeURIComponent(code)}&status=eq.published&limit=1`,
        { headers },
      ),
      fetch(
        `${base}/rest/v1/social_posts?select=public_url&short_code=eq.${encodeURIComponent(code)}&status=eq.published&limit=1`,
        { headers },
      ),
    ]);

    // A permission/schema/network error is not the same as a missing link.
    if (!autoResponse.ok && !pasteResponse.ok) {
      return new Response("Layanan tautan sedang bermasalah. Silakan coba lagi.", {
        status: 502,
        headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (autoResponse.ok) {
      const rows = await autoResponse.json();
      if (Array.isArray(rows) && rows.length) {
        return serveSlugPage(context, "/go.html");
      }
    }

    if (pasteResponse.ok) {
      const rows = await pasteResponse.json();
      const target = rows?.[0]?.public_url;
      if (target) {
        const destination = new URL(target);
        if (["http:", "https:"].includes(destination.protocol)) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: destination.href,
              ...noStore,
              "Referrer-Policy": "no-referrer",
            },
          });
        }
      }
    }

    return new Response("Link tidak ditemukan atau sudah tidak tersedia.", {
      status: 404,
      headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return new Response("Gagal memuat link. Silakan coba lagi.", {
      status: 502,
      headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
