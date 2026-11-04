/**
 * Internal asset renderer for parameterized Cloudflare Pages routes.
 * The browser URL stays /r/:slug, /d/:slug, or /paste/:slug.
 * The HTML asset is fetched internally; the original slug is also forwarded
 * as ?slug= for diagnostics/fallbacks.
 */
export async function serveSlugPage(context, assetPath) {
  const request = context.request;
  const slug = String(context.params?.slug || "").trim();

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!slug || slug.length > 180 || /[\/\\\u0000-\u001f]/.test(slug)) {
    return new Response("Kode URL tidak valid.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const assets = context.env?.ASSETS;
  if (!assets || typeof assets.fetch !== "function") {
    return new Response(
      "Cloudflare Pages ASSETS binding tidak tersedia. Deploy project melalui Git integration atau Wrangler Pages agar Pages Functions aktif.",
      {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      },
    );
  }

  const target = new URL(assetPath, request.url);
  target.searchParams.set("slug", slug);

  try {
    const assetRequest = new Request(target.toString(), {
      method: request.method,
      headers: request.headers,
    });
    const response = await assets.fetch(assetRequest);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Boxcelink-Route", "pages-function");
    headers.set("X-Boxcelink-Slug", slug);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    return new Response(`Gagal memuat halaman ${assetPath}: ${error?.message || error}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
