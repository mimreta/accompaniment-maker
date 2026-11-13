/**
 * Copyright (c) 2026 MohammadReza Tayebi
 * MIT License.
 *
 * Accompaniment Maker relay for Cloudflare Workers: a tiny stateless forwarder between the web
 * version of the app and MVSEP. Browsers cannot call MVSEP directly (it sends no CORS headers).
 *
 * Privacy: nothing is stored or logged. The MVSEP key and the audio are used only for the single
 * request that carries them. Same protocol as relay/Code.gs (Apps Script), so either can be used.
 */
const MVSEP = 'https://mvsep.com/api';
const ALLOWED_ORIGINS = ['https://mimreta.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];

// instrument id -> MVSEP model id (keep in sync with relay/Code.gs and apps-script/Code.gs)
const MODELS = {
  cello: { sep: 70 }, violin: { sep: 65 }, viola: { sep: 69 }, dbass: { sep: 73 },
  flute: { sep: 67 }, oboe: { sep: 77 }, clarinet: { sep: 78 }, bassoon: { sep: 93 },
  sax: { sep: 61 }, trumpet: { sep: 71 }, horn: { sep: 82 }, trombone: { sep: 75 },
  tuba: { sep: 92 }, voice: { sep: 40 }, strings: { sep: 52, opts: { add_opt1: '1' } }, wind: { sep: 54 }
};

function cors(origin) {
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin' };
  if (ALLOWED_ORIGINS.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return h;
}
const out = (obj, origin, status = 200) => new Response(JSON.stringify(obj), { status, headers: cors(origin) });

// Never forward the user's real file name to MVSEP: keep only a neutral name and the extension.
function safeName(name) {
  const m = String(name || '').match(/\.([A-Za-z0-9]{2,5})$/);
  return 'audio.' + (m ? m[1].toLowerCase() : 'mp3');
}

async function algorithmDefaults(sepType) {
  const d = {};
  try {
    const res = await fetch(MVSEP + '/app/algorithms', { cf: { cacheTtl: 21600, cacheEverything: true } });
    const list = await res.json();
    for (const a of list) {
      if (+a.render_id !== +sepType) continue;
      for (const f of a.algorithm_fields || []) if (f.default_key != null) d[f.name] = String(f.default_key);
    }
  } catch (e) { /* defaults are optional */ }
  return d;
}

function b64ToBytes(b64) {
  const bin = atob(b64), n = bin.length, u = new Uint8Array(n);
  for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
  return u;
}

async function create(req) {
  const key = String(req.key || '').trim();
  if (!/^[A-Za-z0-9]{10,}$/.test(key)) throw new Error('کلید API تنظیم نشده یا معتبر نیست.');
  const inst = MODELS[req.inst];
  if (!inst) throw new Error('ساز ناشناخته.');
  if (!req.b64 || typeof req.b64 !== 'string') throw new Error('فایل صوتی دریافت نشد.');
  const fd = new FormData();
  fd.append('api_token', key);
  fd.append('audiofile', new Blob([b64ToBytes(req.b64)], { type: String(req.mime || 'audio/mpeg') }), safeName(req.name));
  fd.append('sep_type', String(inst.sep));
  fd.append('output_format', '0');
  fd.append('is_demo', '0');
  const d = await algorithmDefaults(inst.sep);
  for (const k in d) fd.set(k, d[k]);
  if (inst.opts) for (const k in inst.opts) fd.set(k, inst.opts[k]);
  const res = await fetch(MVSEP + '/separation/create', { method: 'POST', body: fd });
  const body = await res.text();
  let j; try { j = JSON.parse(body); } catch (e) { throw new Error('پاسخ نامعتبر از MVSEP (' + res.status + ')'); }
  if (!j.success) {
    const msg = j.errors ? [].concat(j.errors).join(' / ') : (j.data && j.data.message) || body.slice(0, 300);
    throw new Error('MVSEP: ' + msg);
  }
  return j.data.hash;
}

async function get(req) {
  const hash = String(req.hash || '');
  if (!/^[A-Za-z0-9._-]{6,120}$/.test(hash)) throw new Error('شناسۀ کار نامعتبر است.');
  const res = await fetch(MVSEP + '/separation/get?hash=' + encodeURIComponent(hash));
  const j = await res.json();
  const o = { status: j.status, message: j.data && j.data.message, queue: j.data && j.data.queue_count,
              order: j.data && j.data.current_order, eta: j.data && j.data.eta_seconds, files: [] };
  if (j.status === 'done') o.files = (j.data.files || []).map(f => ({ type: f.type, url: f.url, name: f.download }));
  return o;
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method === 'GET') return out({ result: 'Accompaniment Maker relay is running.' }, origin);
    if (request.method !== 'POST') return out({ error: 'درخواست نامعتبر.' }, origin, 405);
    // Browsers always send Origin; refuse other websites so the relay is only usable from the app.
    if (!ALLOWED_ORIGINS.includes(origin)) return out({ error: 'این ریلی فقط برای خود اپ است.' }, origin, 403);
    try {
      const req = JSON.parse(await request.text());
      if (req.op === 'create') return out({ result: await create(req) }, origin);
      if (req.op === 'get') return out({ result: await get(req) }, origin);
      throw new Error('درخواست نامعتبر.');
    } catch (err) {
      return out({ error: String(err && err.message ? err.message : err) }, origin);
    }
  }
};
