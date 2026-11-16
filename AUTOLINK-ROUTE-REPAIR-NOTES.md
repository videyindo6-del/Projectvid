# AutoLink route repair — verified package

## Fixes
- Removed duplicate Cloudflare Pages dynamic route `functions/z/[code].js`; the project now has only `functions/z/[slug].js` for `/z/:slug`.
- Updated the route lookup from `public.autolinks` to `public.autolink_public`. The migration revokes direct anon access to `autolinks` and grants public read access to `autolink_public`, so the previous lookup could fail even when the link existed.
- Kept PasteLink lookup in `social_posts` and its redirect behavior.
- Added `_redirects` fallback `/z/* /go.html 200` in source and generated `public/`. `go.html` reads the short code from the preserved `/z/:code` browser path.
- Confirmed `/z/*` is present in both `_routes.json` files.

## Build checks performed
- `npm run build` completed successfully (50 HTML pages copied to `public/`).
- `node --check` passed for `functions/z/[slug].js` and `js/autolink-go.js`.
- Confirmed only one dynamic handler remains under `functions/z/`.
- Confirmed generated `public/go.html` and both `/z/*` route configurations exist.

## Deploy requirement
Deploy with the project root as the Cloudflare Pages root so the root `functions/` directory is detected, and use `npm run build` with output directory `public`. If deploying only the `public/` folder as a static upload, the `_redirects` fallback can render `go.html`, but Pages Functions such as `/api/autolink` will not be deployed; full AutoLink resolution and sessions require the Functions directory to be deployed too.

This package does not deploy itself or modify the live Cloudflare site. After deployment, test `https://boxcelink.pages.dev/z/MfQbV` and confirm it shows the AutoLink page and title rather than the homepage.
