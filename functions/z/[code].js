import { serveSlugPage } from "../_utils/serve-slug-page.js";

export async function onRequest(context) {
  const code = String(context.params?.code || "").trim();
  context.params = { ...(context.params || {}), slug: code };
  return serveSlugPage(context, "/go.html");
}
