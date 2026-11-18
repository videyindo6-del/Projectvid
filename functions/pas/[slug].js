import { serveSlugPage } from "../_utils/serve-slug-page.js";

export async function onRequest(context) {
  return serveSlugPage(context, "/pastelink-view.html");
}
