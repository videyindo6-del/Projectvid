/**
 * Serve an existing static HTML asset through the Cloudflare Pages ASSETS
 * binding. Used by /dashboard, /endorse, and /withdraw Pages Functions.
 *
 * The requested page is fetched internally, so the browser keeps its
 * friendly route while the HTML file remains in /public.
 */
export async function serveStaticPage(context, assetPath) {
  const request = context.request;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // Only allow an absolute path to a static asset, never a URL or traversal.
  if (
    typeof assetPath !== "string" ||
    !assetPath.startsWith("/") ||
    assetPath.startsWith("//") ||
    assetPath.includes("\\") ||
    /[\u0000-\u001f]/.test(assetPath) ||
    assetPath.split("/").some((part) => part === "." || part === "..")
  ) {
    return new Response("Path halaman tidak valid.", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const assets = context.env?.ASSETS;
  if (!assets || typeof assets.fetch !== "function") {
    return new Response(
      "Cloudflare Pages ASSETS binding tidak tersedia. Pastikan project dijalankan sebagai Cloudflare Pages dengan folder output public.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const target = new URL(assetPath, request.url);
  // Preserve the original query string for page-level parameters.
  target.search = new URL(request.url).search;

  try {
    const assetRequest = new Request(target.toString(), {
      method: request.method,
      headers: request.headers,
    });
    const response = await assets.fetch(assetRequest);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Boxcelink-Route", "pages-function");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    return new Response(
      `Gagal memuat halaman ${assetPath}: ${error?.message || error}`,
      {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
