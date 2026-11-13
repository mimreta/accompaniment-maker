// Copyright (c) 2026 MohammadReza Tayebi. MIT License.
/**
 * همراهی‌ساز — حذف ساز خودت از هر ضبط (ارکستر، گروه، پیانو…) و ماندن بقیۀ اثر، با MVSEP
 * سرور: نگه‌داری کلید API، ارسال فایل به MVSEP و پیگیری وضعیت.
 */

var MVSEP = 'https://mvsep.com/api';

// سازی که می‌نوازی → شناسۀ مدل MVSEP و نام بخش آن ساز در خروجی
var INSTRUMENTS = [
  { id: 'cello',     label: 'ویولنسل',            sep: 70,  solo: 'cello' },
  { id: 'violin',    label: 'ویولن',              sep: 65,  solo: 'violin' },
  { id: 'viola',     label: 'ویولا',              sep: 69,  solo: 'viola' },
  { id: 'dbass',     label: 'کنترباس',            sep: 73,  solo: 'doublebass' },
  { id: 'flute',     label: 'فلوت',               sep: 67,  solo: 'flute' },
  { id: 'oboe',      label: 'اوبوا',              sep: 77,  solo: 'oboe' },
  { id: 'clarinet',  label: 'کلارینت',            sep: 78,  solo: 'clarinet' },
  { id: 'bassoon',   label: 'باسون',              sep: 93,  solo: 'bassoon' },
  { id: 'sax',       label: 'ساکسوفون',           sep: 61,  solo: 'saxophone' },
  { id: 'trumpet',   label: 'ترومپت',             sep: 71,  solo: 'trumpet' },
  { id: 'horn',      label: 'هورن',               sep: 82,  solo: 'frenchhorn' },
  { id: 'trombone',  label: 'ترومبون',            sep: 75,  solo: 'trombone' },
  { id: 'tuba',      label: 'توبا',               sep: 92,  solo: 'tuba' },
  { id: 'voice',     label: 'آواز (خواننده)',     sep: 40,  solo: 'vocals' },
  { id: 'strings',   label: 'زهی آرشه‌ای (کلی)',  sep: 52,  solo: 'strings', opts: { add_opt1: '1' } },
  { id: 'wind',      label: 'سازهای بادی (کلی)',  sep: 54,  solo: 'wind' }
];

// Browser identity (design system, "Browser identity"): the tab title is the app name exactly as shown in the app bar; the tab icon is the app icon.
var APP_NAME = 'همراهی‌ساز';
var APP_ICON = PropertiesService.getScriptProperties().getProperty('APP_ICON') || 'https://raw.githubusercontent.com/mimreta/mimreta/main/favicons/solo-remover.png';

function doGet() {
  var page = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  if (APP_ICON) page.setFaviconUrl(APP_ICON);
  return page;
}

function getKey_() {
  return PropertiesService.getScriptProperties().getProperty('MVSEP_API_KEY') || '';
}

// True only when the person using the app is the one who deployed it.
// Fails closed: if the visitor's email is unavailable, they are not treated as the owner.
function isOwner_() {
  var owner = Session.getEffectiveUser().getEmail();
  var visitor = Session.getActiveUser().getEmail();
  return !!owner && !!visitor && owner === visitor;
}

function getConfig() {
  return {
    hasKey: !!getKey_(),
    canSetKey: isOwner_(),
    instruments: INSTRUMENTS.map(function (i) { return { id: i.id, label: i.label, solo: i.solo }; })
  };
}

function setApiKey(key) {
  if (!isOwner_()) throw new Error('فقط صاحب اپ می‌تواند کلید را تغییر دهد.');
  key = String(key || '').trim();
  if (!/^[A-Za-z0-9]{10,}$/.test(key)) throw new Error('کلید API معتبر نیست.');
  PropertiesService.getScriptProperties().setProperty('MVSEP_API_KEY', key);
  return true;
}

// پیش‌فرض‌های هر مدل (add_opt1/2/3) را از خود MVSEP می‌خوانیم.
function algorithmDefaults_(sepType) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('alg_' + sepType);
  if (hit) return JSON.parse(hit);
  var res = UrlFetchApp.fetch(MVSEP + '/app/algorithms', { muteHttpExceptions: true });
  var defaults = {};
  if (res.getResponseCode() === 200) {
    JSON.parse(res.getContentText()).forEach(function (a) {
      var d = {};
      (a.algorithm_fields || []).forEach(function (f) { if (f.default_key != null) d[f.name] = String(f.default_key); });
      cache.put('alg_' + a.render_id, JSON.stringify(d), 21600);
      if (a.render_id === sepType) defaults = d;
    });
  }
  return defaults;
}

function findInstrument_(id) {
  for (var i = 0; i < INSTRUMENTS.length; i++) if (INSTRUMENTS[i].id === id) return INSTRUMENTS[i];
  throw new Error('ساز ناشناخته: ' + id);
}

/** فایل (base64) را برای جداسازی به MVSEP می‌فرستد و hash کار را برمی‌گرداند. */
// Never forward the user's real file name to MVSEP: keep only a neutral name and the extension.
function safeName_(name) {
  var m = String(name || '').match(/\.([A-Za-z0-9]{2,5})$/);
  return 'audio.' + (m ? m[1].toLowerCase() : 'mp3');
}

function createJob(b64, fileName, mimeType, instrumentId) {
  var key = getKey_();
  if (!key) throw new Error('کلید API تنظیم نشده است.');
  var inst = findInstrument_(instrumentId);
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mimeType || 'audio/mpeg', safeName_(fileName));
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

/** وضعیت کار؛ وقتی تمام شد لینک فایل‌ها را برمی‌گرداند. */
function getJob(hash) {
  var res = UrlFetchApp.fetch(MVSEP + '/separation/get?hash=' + encodeURIComponent(hash), { muteHttpExceptions: true });
  var j = JSON.parse(res.getContentText());
  var out = { status: j.status, message: j.data && j.data.message, queue: j.data && j.data.queue_count,
              order: j.data && j.data.current_order, eta: j.data && j.data.eta_seconds, files: [] };
  if (j.status === 'done') {
    out.files = (j.data.files || []).map(function (f) { return { type: f.type, url: f.url, name: f.download }; });
  }
  return out;
}

/** کتابخانۀ MP3 (lamejs) را از سرور گوگل می‌گیرد تا به فیلتر CDN در مرورگر وابسته نباشد. */
function getLame() {
  var cache = CacheService.getScriptCache();
  var parts = cache.getAll(['lame0', 'lame1', 'lame2']);
  if (parts.lame0 && parts.lame1 && parts.lame2) return parts.lame0 + parts.lame1 + parts.lame2;
  var src = UrlFetchApp.fetch('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js').getContentText();
  var n = Math.ceil(src.length / 3);
  cache.putAll({ lame0: src.slice(0, n), lame1: src.slice(n, 2 * n), lame2: src.slice(2 * n) }, 21600);
  return src;
}

/** کتابخانۀ نمایش PDF (PDF.js، Apache-2.0) را از سرور گوگل می‌گیرد؛ فایل PDF خود کاربر هرگز به سرور نمی‌آید. */
var PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
function fetchChunked_(name, url) {
  var cache = CacheService.getScriptCache(), n = +cache.get(name + '_n');
  if (n) {
    var keys = [], i; for (i = 0; i < n; i++) keys.push(name + i);
    var got = cache.getAll(keys), out = '';
    for (i = 0; i < n; i++) { if (!got[name + i]) { out = null; break; } out += got[name + i]; }
    if (out) return out;
  }
  var src = UrlFetchApp.fetch(url).getContentText(), size = 90000, put = {}, k = 0;
  for (var p = 0; p < src.length; p += size) put[name + k++] = src.slice(p, p + size);
  try { put[name + '_n'] = String(k); cache.putAll(put, 21600); } catch (e) {}
  return src;
}
function getPdfLib() { return fetchChunked_('pdfl', PDFJS + 'pdf.min.js'); }
function getPdfWorker() { return fetchChunked_('pdfw', PDFJS + 'pdf.worker.min.js'); }
