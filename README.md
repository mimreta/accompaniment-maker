<p align="center"><img src="assets/icon.svg" width="96" alt="Accompaniment Maker icon"></p>

# Accompaniment Maker

Remove your own instrument from any recording (an orchestra, a band, an ensemble) and play along. Works in the browser, no installation, with practice tools and microphone recording.

همراهی‌ساز: اکامپانیمان هر ضبطی را می‌سازد؛ ساز خودت را از ضبط حذف می‌کند و جایش می‌نوازی.

**Open the app:** https://mimreta.github.io/accompaniment-maker/

<p align="center">
  <img src="docs/screenshots/d-start.png" width="560" alt="Desktop: first screen with the side menu">
  <img src="docs/screenshots/d-log.png" width="560" alt="Desktop: practice log with a daily goal">
</p>
<p align="center">
  <img src="docs/screenshots/m-start.png" width="150" alt="Phone: choose a file and your instrument">
  <img src="docs/screenshots/m-player.png" width="150" alt="Phone: practice player with waveform">
  <img src="docs/screenshots/m-player-dark.png" width="150" alt="Phone: dark theme">
  <img src="docs/screenshots/m-tools.png" width="150" alt="Phone: metronome and reference tone">
  <img src="docs/screenshots/m-score.png" width="150" alt="Phone: your own PDF part">
  <img src="docs/screenshots/m-log.png" width="150" alt="Phone: practice log">
</p>

The screenshots use a short synthetic demo tone and a sample PDF, not a real recording.

## Install

There is nothing to install: open the app in any modern browser. To keep it on your phone or computer, use **Add to Home screen** (or the install icon in the address bar); after the first visit it opens without internet (making an accompaniment still needs internet). Release notes for every version are in [CHANGELOG.md](CHANGELOG.md).

## First time? Start here

You need a free MVSEP account once (it does the separation). The hosted web version already includes a stateless relay (Cloudflare Worker, no Google quota used); to run your own copy you can deploy your own relay in about 3 minutes ([docs/DEPLOY.md](docs/DEPLOY.md)). Step by step: **[Getting started](docs/GETTING-STARTED.md)** · **[شروع سریع (فارسی)](docs/GETTING-STARTED.fa.md)**.

## Usage

Pick a recording and the instrument you play (16 choices, from cello and violin to flute and voice). The app removes that instrument and keeps the rest. Then practice with loops, named markers, gradual speed, tuning, a metronome, your own PDF part with pen notes, and recording yourself over the accompaniment. Finished accompaniments and your takes are saved in a library on your device; the practice log counts your daily minutes against a goal. Download any result as MP3 or WAV.

## Privacy in one paragraph

No accounts, no analytics. Your recording goes to MVSEP through a stateless relay and is processed under MVSEP's terms; your real file name is never sent; your MVSEP key stays in your browser; notes, markers and microphone takes stay on your device. Details: **[PRIVACY.md](PRIVACY.md)**.

## Repository layout

| Path | What it is |
|---|---|
| `src/` | The only place the app is edited: `app.js`, `app.css`, `body.html`, design tokens |
| `scripts/build.py` | Builds the two single-file pages from `src/` |
| `index.html`, `config.js`, `sw.js`, `manifest.webmanifest`, `assets/` (icons) | Web build, served by GitHub Pages (`sw.js` makes it work offline) |
| `apps-script/` | Google Apps Script build (`Code.gs`, `Index.html`, `appsscript.json`) for running your own private copy |
| `relay/` | The stateless relay the web build uses to reach MVSEP |
| `scripts/check.sh` | Checks that built files match `src/` and that no secrets or emails are present (also runs in CI) |
| `docs/` | Getting started (English and Persian), deploy guide, `screenshots/` |

## Build from source

- **Web build:** serve the repo root over HTTPS (needed for the microphone), with a relay (the default in `config.js` is the author's; to use your own, paste its address in Settings or set it in `config.js`). See [relay/README.md](relay/README.md).
- **Apps Script build:** see [docs/DEPLOY.md](docs/DEPLOY.md).
- **Change the code:** edit `src/`, run `python3 scripts/build.py`, then `./scripts/check.sh`, and commit the built files too.

## Contributing, security, conduct

[CONTRIBUTING](.github/CONTRIBUTING.md) · [SECURITY](.github/SECURITY.md) · [CODE OF CONDUCT](.github/CODE_OF_CONDUCT.md) · [CHANGELOG](CHANGELOG.md)

## License

[MIT](LICENSE). Third-party components and their licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). MVSEP and other names belong to their owners; this project is not affiliated with them.

---

<sub>Made by [MohammadReza Tayebi](https://github.com/mimreta) · [Instagram](https://instagram.com/mimreta) · [LinkedIn](https://linkedin.com/in/mimreta) · [X](https://x.com/1mimreta) · [Telegram](https://t.me/wanderingkite)</sub>
