# Relay

A tiny Google Apps Script web app that forwards two calls (`create`, `get`) from the static web version to MVSEP, because MVSEP sends no CORS headers.

- Stateless: nothing is stored or logged. The MVSEP key travels in each request body and is used for that request only.
- **Recommended: Cloudflare Worker** (`cloudflare-worker.js`, free, no Google quota involved): Workers & Pages → Create → Worker → paste the file → Deploy. It only accepts calls from the app's own origin (see `ALLOWED_ORIGINS` at the top of the file; add your site if you host your own copy).
- Alternative: Apps Script. Deploy: new Apps Script project, paste `Code.gs`, Deploy → New deployment → Web app, Execute as: Me, Access: Anyone (see `appsscript.json`).
- Then paste the `/exec` URL in the app under Settings (stored in your browser only). The hosted site uses the author's own Cloudflare Worker (set in `config.js`); no one's Google quota is used. If you self-host, keep your URL private; if it leaks, create a new deployment and remove the old one.
- Requests use `Content-Type: text/plain` so browsers send no preflight.
