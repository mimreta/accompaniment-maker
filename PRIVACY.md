# Privacy

Short version: the app has no accounts, no analytics and no server of its own that keeps anything. Here is exactly what happens to your data.

## Your recording
- The file is processed in your browser (split into parts, encoded) and then sent to **MVSEP** (mvsep.com), the third-party service that does the separation. MVSEP's own terms and privacy policy apply to what it receives. It states that it normally deletes uploads and results after about three days.
- The app never sends your real file name. MVSEP only receives a neutral name such as `audio.mp3`.
- In the web version the upload passes through a small **relay** because MVSEP does not allow direct calls from a browser. The hosted site uses a stateless Cloudflare Worker run by the author (source: `relay/cloudflare-worker.js`); it only accepts requests from this app's own site, forwards them to MVSEP and keeps nothing: no storage, no logging in the code. Your MVSEP key is sent through it with each request but is never stored by it. Cloudflare, which runs it, may keep ordinary infrastructure logs. MVSEP sees the relay's address, not yours. You can deploy your own relay (`relay/`, `docs/DEPLOY.md`) and paste its URL in Settings.
- In the Apps Script version the same job is done by your own deployment.

## Your MVSEP key
- Stored in your browser's local storage (web version) or in the Script Properties of the account that deployed the app (Apps Script version). It is sent with each request to the relay/MVSEP and is never part of this repository. Treat it like a password, and regenerate it at mvsep.com/user-api if you think it leaked.

## What stays only on your device
Markers, tuning, speed settings, PDF annotations, practice log and theme are saved in your browser (local storage). Your PDF part is read in the browser and never uploaded. Microphone recordings stay in memory until you close the page; nothing is uploaded. Clearing browser data removes everything.

## Third-party hosts the page contacts
The page loads the font and, when needed, the MP3 encoder and PDF viewer from public CDNs (jsDelivr, and unpkg as a fallback). Those hosts see your IP address and the request, like any website does. Nothing else is contacted except the relay/MVSEP when you make an accompaniment.

## Use only recordings you have the right to use
You are responsible for the content you upload (MVSEP's terms say the same).

## Questions
Open an issue on GitHub. Please do not post your API key or recordings there.
