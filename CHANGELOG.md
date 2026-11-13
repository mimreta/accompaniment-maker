# Changelog

## 3.6
- The signature shows the Telegram badge again (GitHub, Instagram, LinkedIn, X, Telegram).

## 3.5
- The app's signature now shows GitHub, Instagram, LinkedIn and X (the Telegram badge was removed from the app; it stays in the README).
- The About screen now says correctly that your recorded takes stay on this device next to their accompaniment.

## 3.4
- Security: the MP3 encoder and PDF viewer downloaded from public CDNs are now verified against fixed checksums before they run.
- Fixed: on phones, opening a PDF part could make the page wider than the screen.
- Repository tidy-up: icons moved to `assets/`, community files to `.github/`, fresh screenshots in `docs/screenshots/`, refreshed docs (library, offline use, practice log, saved takes).
- The Apps Script tab icon now comes from this repository.

## 3.3
- Your recorded takes are now saved on this device next to the accompaniment they belong to (up to 10 per accompaniment), and come back when you reopen it from the library. Deleting a library item or clearing the library removes its takes too.

## 3.2
- Works offline after the first visit: the app shell and its pinned libraries are cached by a small service worker (sw.js). Making an accompaniment still needs internet.

## 3.1
- Practice log: daily goal (10-60 min) with a progress bar, dimmed bars for days below the goal, and a toast when the goal is reached.

## 3.0
- Library: finished accompaniments are saved on the device (IndexedDB, up to 12, MP3-compressed) and can be reopened from the first screen without processing again. Auto-save toggle, manual "Save to library" and "Clear library" in Settings.

## 2.9
- Settings: once a key is saved, the key field is replaced by a "Key saved" row with a "Change key" button (and Cancel).
- Practice log: a plain explanation of what it is, what fills it, and what it stores; clearer empty state and a note about the streak rule.

## 2.8
- Key guide: "Open the site" and "Open the API page" buttons that open MVSEP in a new tab.
- Desktop: first screen is a two-column layout (steps beside the main card); Settings is two balanced columns (instrument on one side, appearance, key and data on the other).

## 2.7
- "My instrument" card in Settings; the first screen shows the chosen instrument as one line with a "Change" button.
- Calmer desktop layouts: Settings in one readable column, About as story cards in a row with full-width sections, Practice log in two equal cards.
- Larger desktop titles and card padding; fixed the missing step number in About.

## 2.6
- Instrument picker with an icon for each instrument, grouped by family.
- Illustrated 4-step guide for getting the MVSEP key (first-run card and Settings).
- A short "how it works" strip on the first screen; plainer wording, no technical details in the key card.

## 2.5
- Responsive layout: side navigation and a two-column workspace on wide screens (waveform on top, score beside the tools), bottom tabs on phones.
- The practice log is now its own section instead of living in Settings.
- One "Step 1: MVSEP key" card on first run instead of repeated notices.
- Settings and About use two columns on wide screens.

## 2.4
- Web version (repo root, served by GitHub Pages): runs as a plain static page, no Apps Script needed. Installable as a PWA.
- Microphone recording over the accompaniment, up to five takes per session, in-sync listen-back with latency compensation, download of a take. Web version only.
- Stateless relay (`relay/`) between the web page and MVSEP; self-hostable.
- Each web user pastes their own MVSEP key, kept in the browser.
- The real file name is never sent to MVSEP (only `audio.<ext>`).
- Settings explain how to get an MVSEP key; Getting started guide in English and Persian; PRIVACY, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, THIRD_PARTY_NOTICES, issue and PR templates.
- No shared relay: each web user deploys their own and pastes its address in Settings, so nobody's Apps Script quota is used by others.
- Cloudflare Worker relay (`relay/cloudflare-worker.js`) as the no-Google-quota option.
- Renamed to Accompaniment Maker (repo `accompaniment-maker`).
- The hosted site works out of the box through a stateless Cloudflare Worker relay (`accompaniment-relay`) that only accepts requests from the site's own origin and holds no keys.
- One source of truth: everything is edited in `src/` and built by `scripts/build.py`; `scripts/check.sh` verifies the build and scans for secrets.

## 2.3
- Metronome (tempo, beats per bar, tap tempo) and a reference tone based on your instrument's tuning.
- Full-screen score mode: tap the left or right side to turn pages, `PageUp`/`PageDown` or the arrow keys (Bluetooth page-turn pedals work), "fit page" zoom.
- Pen, highlighter and eraser notes on the score, undo and clear page. Stored on the device only.
- Practice log in Settings: today, last seven days, streak, top pieces, CSV export, clear.

## 2.2
- Open your own PDF part next to the player (PDF.js, loaded at run time; the file never leaves the browser).
- Link markers to pages; the page turns by itself when playback reaches a marker.

## 2.1
- Named markers (A, B, C…), saved per recording on the device.
- Gradual speed: raise the speed by a step every few loop repeats.
- Tuning and transposition for playback (A=415…445, up to six semitones), tempo unchanged.

## 2.0
- Accompaniment concept for any instrument and any ensemble recording, shared design system, About screen with the story, tab title and icon.
