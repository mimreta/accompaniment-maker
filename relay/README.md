# Relay

A tiny Google Apps Script web app that forwards two calls (`create`, `get`) from the static web version to MVSEP, because MVSEP sends no CORS headers.

- Stateless: nothing is stored or logged. The MVSEP key travels in each request body and is used for that request only.
- Deploy: new Apps Script project, paste `Code.gs`, Deploy → New deployment → Web app, Execute as: Me, Access: Anyone (see `appsscript.json`).
- Then set `window.SOLO_RELAY` in `../config.js` to the `/exec` URL.
- Requests use `Content-Type: text/plain` so browsers send no preflight.
