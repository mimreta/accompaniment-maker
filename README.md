<p align="center"><img src="icon.svg" width="96" alt="Accompaniment Maker icon"></p>

# Accompaniment Maker

Remove your own instrument from any recording (an orchestra, a band, an ensemble) and play along. Works in the browser, no installation, with practice tools and microphone recording.

همراهی‌ساز: اکامپانیمان هر ضبطی را می‌سازد؛ ساز خودت را از ضبط حذف می‌کند و جایش می‌نوازی.

**Open the app:** https://mimreta.github.io/accompaniment-maker/

<p align="center">
  <img src="docs/task-light.png" width="190" alt="Choose a file and the instrument">
  <img src="docs/player-light.png" width="190" alt="Practice player">
  <img src="docs/player-dark.png" width="190" alt="Practice player, dark">
</p>
<p align="center">
  <img src="docs/tools-light.png" width="190" alt="Metronome and reference tone">
  <img src="docs/score-light.png" width="190" alt="Your own PDF part with a pen note">
</p>

The screenshots use a short synthetic demo tone, not a real recording.

## First time? Start here

You need a free MVSEP account once (it does the separation). The hosted web version already includes a stateless relay (Cloudflare Worker, no Google quota used); to run your own copy you can deploy your own relay in about 3 minutes ([docs/DEPLOY.md](docs/DEPLOY.md)). Step by step: **[Getting started](docs/GETTING-STARTED.md)** · **[شروع سریع (فارسی)](docs/GETTING-STARTED.fa.md)**.

## What it does

Pick a recording and the instrument you play (16 choices, from cello and violin to flute and voice). The app removes that instrument and keeps the rest. Then practice with loops, named markers, gradual speed, tuning, a metronome, your own PDF part with pen notes, and recording yourself over the accompaniment. Download the result as MP3 or WAV.

## Privacy in one paragraph

No accounts, no analytics. Your recording goes to MVSEP through a stateless relay and is processed under MVSEP's terms; your real file name is never sent; your MVSEP key stays in your browser; notes, markers and microphone takes stay on your device. Details: **[PRIVACY.md](PRIVACY.md)**.

## Repository layout

| Path | What it is |
|---|---|
| `src/` | The only place the app is edited: `app.js`, `app.css`, `body.html`, design tokens |
| `scripts/build.py` | Builds the two single-file pages from `src/` |
| `index.html`, `config.js`, `manifest.webmanifest`, icons | Web build, served by GitHub Pages |
| `apps-script/` | Google Apps Script build (`Code.gs`, `Index.html`, `appsscript.json`) for running your own private copy |
| `relay/` | The stateless relay the web build uses to reach MVSEP |
| `scripts/check.sh` | Checks that built files match `src/` and that no secrets or emails are present (also runs in CI) |
| `docs/` | Getting started, deploy guide, screenshots |

## Run or build it yourself

- **Web build:** serve the repo root over HTTPS (needed for the microphone), with a relay (the default in `config.js` is the author's; to use your own, paste its address in Settings or set it in `config.js`). See [relay/README.md](relay/README.md).
- **Apps Script build:** see [docs/DEPLOY.md](docs/DEPLOY.md).
- **Change the code:** edit `src/`, run `python3 scripts/build.py`, then `./scripts/check.sh`, and commit the built files too.

## Contributing, security, conduct

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE). Third-party components and their licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). MVSEP and other names belong to their owners; this project is not affiliated with them.

---

<sub>Made by [MohammadReza Tayebi](https://github.com/mimreta) · [Instagram](https://instagram.com/mimreta) · [LinkedIn](https://linkedin.com/in/mimreta) · [X](https://x.com/1mimreta) · [Telegram](https://t.me/wanderingkite)</sub>
