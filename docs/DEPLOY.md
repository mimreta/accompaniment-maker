# Deploy your own copy

Accompaniment Maker is a Google Apps Script web app. Nothing is hosted for you: you run your own copy under your own Google account, and your own MVSEP key does the separation.

## What you need
- A Google account.
- A free [MVSEP](https://mvsep.com) account and its API key (account page, "API").

## Steps
1. Open [script.google.com](https://script.google.com) and create a new project.
2. Replace the default `Code.gs` with `apps-script/Code.gs`.
3. Add an HTML file named exactly `Index` (File → New → HTML file) and paste `apps-script/Index.html` into it.
4. Open Project Settings, enable "Show appsscript.json manifest file in editor", and paste `apps-script/appsscript.json`.
5. Deploy → New deployment → type "Web app". Keep "Execute as: Me". Access: "Only myself" to start.
6. Open the web app link while signed in to the same account, go to Settings and paste your MVSEP key. It is stored in your Script Properties, not in the code.
7. Every time you change a file, deploy a **new version** of the same deployment (Deploy → Manage deployments → pencil → Version: New version) so the link stays the same.

## Keep every copy in sync
GitHub is the single source of truth. Never edit the code inside the Apps Script editor: change `src/`, run `python3 scripts/build.py`, commit, then paste the new `apps-script/Code.gs` and `apps-script/Index.html` into your Apps Script project and deploy a new version. The version shown in the app's About screen tells you which copy you are running. (With `clasp` you can push `apps-script/` instead of pasting.)

## Letting others use it
Change the deployment access to "Anyone" (or "Anyone with a Google account"). Others use your MVSEP quota, but only you can see or change the key.

## Optional settings (Script Properties)
- `MVSEP_API_KEY`: set it here if the key box does not appear.
- `APP_ICON`: a public `.png` URL for the browser tab icon.

## Troubleshooting
- **"Library did not load" for MP3 or PDF:** the server fetches lamejs and PDF.js from jsDelivr. Check that the script has permission to call external services (the first run asks you to authorize it), then retry.
- **The page is blank for about ten seconds on first open:** normal for Apps Script web apps.
- **Microphone:** Apps Script blocks microphone access inside web apps, so recording is only available in the web version (the web version).
- **Your data:** markers, notes, tuning, practice log and settings are stored in the browser (localStorage) on each device. Clearing browser data removes them.

## Web version (no Apps Script for the app itself)
0. Easiest: deploy `relay/cloudflare-worker.js` as a Cloudflare Worker (free) and use its `https://….workers.dev` address in step 2. No Google quota is used. The Apps Script relay below also works.
1. Or deploy the Apps Script relay once: create an Apps Script project, paste `relay/Code.gs`, Deploy → New deployment → Web app, Execute as: Me, Access: Anyone. Authorize when asked.
2. Copy the deployment's `/exec` URL and paste it in the app under Settings, "Your relay address" (stored only in your browser). Keep the URL private: anyone who has it can spend your Apps Script daily quota. If it leaks, make a new deployment and delete the old one.
3. Publish the repo root (it contains `index.html`) on any static host (it needs HTTPS for the microphone).
