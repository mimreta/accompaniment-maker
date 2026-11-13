// Copyright (c) 2026 MohammadReza Tayebi. MIT License.
// Stateless relay (Cloudflare Worker, source in relay/cloudflare-worker.js) that forwards
// requests to MVSEP. It stores nothing and never holds anyone's API key; it only accepts
// requests coming from this app's own site. You can deploy your own and paste its URL in Settings.
window.SOLO_RELAY = 'https://accompaniment-relay.mimreta.workers.dev';
