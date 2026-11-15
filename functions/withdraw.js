import { serveStaticPage } from "./_utils/serve-static-page.js";
export async function onRequest(context) { return serveStaticPage(context, "/withdraw.html"); }
