# Changelog

## 2.4
- Web version (repo root, served by GitHub Pages): runs as a plain static page, no Apps Script needed. Installable as a PWA.
- Microphone recording over the accompaniment, up to five takes per session, in-sync listen-back with latency compensation, download of a take. Web version only.
- Stateless relay (`relay/`) between the web page and MVSEP; self-hostable.
- Each web user pastes their own MVSEP key, kept in the browser.
- The real file name is never sent to MVSEP (only `audio.<ext>`).
- Settings explain how to get an MVSEP key; Getting started guide in English and Persian; PRIVACY, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, THIRD_PARTY_NOTICES, issue and PR templates.
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
