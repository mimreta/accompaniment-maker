/**
 * Copyright (c) 2026 MohammadReza Tayebi
 * MIT License.
 *
 * Solo Remover relay: a tiny stateless forwarder between the web version of the app and MVSEP.
 * Browsers cannot call MVSEP directly (it sends no CORS headers), so this script does it for them.
 *
 * Privacy: nothing is stored or logged. The MVSEP key and the audio are used only for the single
 * request that carries them. You can deploy your own copy (see proxy/README.md) and point
 * web/config.js at it.
 */
var MVSEP = 'https://mvsep.com/api';

// instrument id -> MVSEP model id (keep in sync with web/index.html)
var MODELS = {
  cello: { sep: 70 }, violin: { sep: 65 }, viola: { sep: 69 }, dbass: { sep: 73 },
  flute: { sep: 67 }, oboe: { sep: 77 }, clarinet: { sep: 78 }, bassoon: { sep: 93 },
  sax: { sep: 61 }, trumpet: { sep: 71 }, horn: { sep: 82 }, trombone: { sep: 75 },
  tuba: { sep: 92 }, voice: { sep: 40 }, strings: { sep: 52, opts: { add_opt1: '1' } }, wind: { sep: 54 }
};

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return out_({ result: 'Solo Remover relay is running.' }); }

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (req.op === 'create') return out_({ result: create_(req) });
    if (req.op === 'get') return out_({ result: get_(req) });
    throw new Error('درخواست نامعتبر.');
  } catch (err) {
    return out_({ error: String(err && err.message ? err.message : err) });
  }
}

function algorithmDefaults_(sepType) {
  var cache = CacheService.getScriptCache(), ck = 'alg' + sepType, hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  var d = {};
  var res = UrlFetchApp.fetch(MVSEP + '/app/algorithms', { muteHttpExceptions: true });
  try {
    JSON.parse(res.getContentText()).forEach(function (a) {
      if (+a.render_id !== +sepType) return;
      (a.algorithm_fields || []).forEach(function (f) { if (f.default_key != null) d[f.name] = String(f.default_key); });
    });
  } catch (e) {}
  cache.put(ck, JSON.stringify(d), 21600);
  return d;
}

function create_(req) {
  var key = String(req.key || '').trim();
  if (!/^[A-Za-z0-9]{10,}$/.test(key)) throw new Error('کلید API تنظیم نشده یا معتبر نیست.');
  var inst = MODELS[req.inst];
  if (!inst) throw new Error('ساز ناشناخته.');
  if (!req.b64 || typeof req.b64 !== 'string') throw new Error('فایل صوتی دریافت نشد.');
  var blob = Utilities.newBlob(Utilities.base64Decode(req.b64), String(req.mime || 'audio/mpeg'), String(req.name || 'audio.mp3'));
  var payload = { api_token: key, audiofile: blob, sep_type: String(inst.sep), output_format: '0', is_demo: '0' };
  var d = algorithmDefaults_(inst.sep), k;
  for (k in d) payload[k] = d[k];
  if (inst.opts) for (k in inst.opts) payload[k] = inst.opts[k];
  var res = UrlFetchApp.fetch(MVSEP + '/separation/create', { method: 'post', payload: payload, muteHttpExceptions: true });
  var body = res.getContentText(), j;
  try { j = JSON.parse(body); } catch (e) { throw new Error('پاسخ نامعتبر از MVSEP (' + res.getResponseCode() + ')'); }
  if (!j.success) {
    var msg = j.errors ? [].concat(j.errors).join(' / ') : (j.data && j.data.message) || body.slice(0, 300);
    throw new Error('MVSEP: ' + msg);
  }
  return j.data.hash;
}

function get_(req) {
  var hash = String(req.hash || '');
  if (!/^[A-Za-z0-9]{6,80}$/.test(hash)) throw new Error('شناسه‌ی کار نامعتبر است.');
  var res = UrlFetchApp.fetch(MVSEP + '/separation/get?hash=' + encodeURIComponent(hash), { muteHttpExceptions: true });
  var j = JSON.parse(res.getContentText());
  var o = { status: j.status, message: j.data && j.data.message, queue: j.data && j.data.queue_count,
            order: j.data && j.data.current_order, eta: j.data && j.data.eta_seconds, files: [] };
  if (j.status === 'done') o.files = (j.data.files || []).map(function (f) { return { type: f.type, url: f.url, name: f.download }; });
  return o;
}
