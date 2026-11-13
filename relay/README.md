# Relay

A tiny Google Apps Script web app that forwards two calls (`create`, `get`) from the static web version to MVSEP, because MVSEP sends no CORS headers.

- Stateless: nothing is stored or logged. The MVSEP key travels in each request body and is used for that request only.
- Deploy: new Apps Script project, paste `Code.gs`, Deploy → New deployment → Web app, Execute as: Me, Access: Anyone (see `appsscript.json`).
- Then paste the `/exec` URL in the app under Settings (stored in your browser only). This repository ships **no public relay**, so nobody's Apps Script quota is shared. Keep your URL private; if it leaks, create a new deployment and remove the old one.
- Requests use `Content-Type: text/plain` so browsers send no preflight.
