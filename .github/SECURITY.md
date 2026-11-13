# Security policy

## Reporting a vulnerability
Please report it privately with GitHub's **Report a vulnerability** button on the repository's Security tab. Do not open a public issue for anything that could be abused (for example a way to leak someone's key or use the relay without limits).

I will read reports as soon as I can; this is a small personal project, so there is no guaranteed response time.

## What matters most here
- **API keys:** the app must never store or log a user's MVSEP key anywhere except that user's own browser or Script Properties.
- **The relay** (`relay/cloudflare-worker.js`, and the Apps Script alternative `relay/Code.gs`) must stay stateless: no storage, no logging, no forwarding of anything except the two documented operations, and only for the app's own origin.
- **Downloaded libraries** (MP3 encoder, PDF viewer) are pinned to exact versions and checked against fixed checksums before use. Update the version and the checksum together.
- **No secrets in the repository.** If you find a key, token or personal data in the code or history, report it.

## Supported versions
Only the latest release / the current `main` branch.
