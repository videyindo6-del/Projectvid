import { serveStaticPage } from "./_utils/serve-static-page.js";

// /dashboard harus menampilkan dashboard member, bukan publisher-dashboard.
export async function onRequest(context) {
  return serveStaticPage(context, "/dashboard.html");
}
