(function () {
  'use strict';
  var APP_VERSION = '2.4';
  var SR = 44100, MAX_CHUNK = 480, OVERLAP = 10, DIRECT_MAX_BYTES = 15e6, DIRECT_MAX_SEC = 590;
  var $ = function (id) { return document.getElementById(id); };
  var fa = function (n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); };
  var CFG = null, file = null, cancelled = false, busy = false;
  var result = null; // { acc:[L,R], solo:[M], name, instLabel }
  var audio = new Audio(), audioUrl = null, loopA = null, loopB = null, builtKey = '', K = 1, marks = [], markPages = {};
  var ICON = function (n) { return '<svg class="wk-icon" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };

  // ---------- small helpers ----------
  function getPref(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
  function setPref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function delPref(k) { try { localStorage.removeItem(k); } catch (e) {} }
  // Backend: inside Apps Script we call google.script.run; as a plain web page we call a stateless relay
  // (MVSEP does not allow direct browser calls) and keep the MVSEP key in this browser only.
  var WEB = typeof google === 'undefined' || !google.script || !google.script.run;
  var CDN = {
    lame: ['https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js', 'https://fastly.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js', 'https://unpkg.com/lamejs@1.2.1/lame.min.js'],
    pdfLib: ['https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', 'https://fastly.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'],
    pdfWorker: ['https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js', 'https://fastly.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js', 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js']
  };
  var cdnCache = {};
  async function cdnText(key) {
    if (cdnCache[key]) return cdnCache[key];
    var list = CDN[key], err;
    for (var i = 0; i < list.length; i++) {
      try { var r = await fetch(list[i]); if (r.ok) { var t = await r.text(); if (t.length > 1000) return (cdnCache[key] = t); } } catch (e) { err = e; }
    }
    throw new Error('دریافت کتابخانه ممکن نشد. اینترنت را بررسی کن و دوباره امتحان کن.');
  }
  function relayUrl() { return (getPref('relay_url', '') || window.SOLO_RELAY || '').trim(); }
  function validRelay(u) { return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/.test(u) || /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/?$/.test(u); }
  async function relay(body) {
    if (!relayUrl()) throw new Error('آدرس ریلی ثبت نشده است. از «تنظیمات» وارد کن.');
    var r;
    try { r = await fetch(relayUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('به سرور واسط وصل نشد. اینترنت را بررسی کن.'); }
    var j; try { j = await r.json(); } catch (e) { throw new Error('پاسخ نامعتبر از سرور واسط.'); }
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  var webBackend = {
    getConfig: async function () { return { hasKey: !!getPref('mvsep_key', ''), canSetKey: true, instruments: window.SOLO_INSTRUMENTS || [] }; },
    setApiKey: async function (key) {
      key = String(key || '').trim();
      if (!/^[A-Za-z0-9]{10,}$/.test(key)) throw new Error('کلید API معتبر نیست.');
      setPref('mvsep_key', key); return true;
    },
    createJob: function (b64, name, mime, inst) { return relay({ op: 'create', key: getPref('mvsep_key', ''), b64: b64, name: name, mime: mime, inst: inst }); },
    getJob: function (hash) { return relay({ op: 'get', hash: hash }); },
    getLame: function () { return cdnText('lame'); },
    getPdfLib: function () { return cdnText('pdfLib'); },
    getPdfWorker: function () { return cdnText('pdfWorker'); }
  };
  function gs(name) {
    var args = [].slice.call(arguments, 1);
    if (WEB) return webBackend[name].apply(null, args);
    return new Promise(function (res, rej) {
      var r = google.script.run.withSuccessHandler(res).withFailureHandler(function (e) { rej(e && e.message ? new Error(e.message) : new Error(String(e))); });
      r[name].apply(r, args);
    });
  }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function fmt(sec) { sec = Math.max(0, sec || 0); var m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
  function checkCancel() { if (cancelled) throw new Error('لغو شد.'); }

  // ---------- messages: alert (inline), toast, dialog ----------
  function showAlert(id, kind, label, msg) {
    var box = $(id); box.innerHTML = '';
    var a = document.createElement('div'); a.className = 'wk-alert' + (kind === 'error' ? ' wk-alert--error' : '');
    a.setAttribute('role', kind === 'error' ? 'alert' : 'note');
    a.innerHTML = ICON(kind === 'error' ? 'alert' : 'info') + '<p style="margin:0"><span class="wk-alert__label"></span> <span class="wk-alert__msg"></span></p>';
    a.querySelector('.wk-alert__label').textContent = label;
    a.querySelector('.wk-alert__msg').textContent = msg;
    box.appendChild(a);
  }
  function clearAlert(id) { $(id).innerHTML = ''; }
  var toastTimer = null;
  function toast(msg) {
    var box = $('toasts'); box.innerHTML = '';
    var t = document.createElement('div'); t.className = 'wk-toast'; t.innerHTML = ICON('check') + '<span></span>';
    t.lastChild.textContent = msg; box.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { box.innerHTML = ''; }, 3500);
  }
  // One question, two buttons. opts: {title, text, confirm, cancel, danger}. Resolves true/false.
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var opener = document.activeElement, root = $('dialogRoot');
      var scrim = document.createElement('div'); scrim.className = 'wk-scrim';
      var d = document.createElement('div'); d.className = 'wk-dialog';
      d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'dlgTitle');
      d.innerHTML = '<h2 class="wk-dialog__title" id="dlgTitle"></h2><p class="wk-dialog__text"></p><div class="wk-dialog__actions"><button class="wk-btn" data-yes></button><button class="wk-btn wk-btn--secondary" data-no></button></div>';
      d.querySelector('h2').textContent = opts.title; d.querySelector('p').textContent = opts.text;
      var yes = d.querySelector('[data-yes]'), no = d.querySelector('[data-no]');
      yes.textContent = opts.confirm; no.textContent = opts.cancel;
      yes.className = 'wk-btn ' + (opts.danger ? 'wk-btn--danger' : 'wk-btn--primary');
      scrim.appendChild(d); root.appendChild(scrim);
      var bg = [$('screen'), document.querySelector('.wk-tabbar'), document.querySelector('.wk-appbar')];
      bg.forEach(function (n) { if (n) n.setAttribute('inert', ''); });
      function close(v) {
        document.removeEventListener('keydown', onKey, true);
        bg.forEach(function (n) { if (n) n.removeAttribute('inert'); });
        scrim.remove(); if (opener && opener.focus) opener.focus(); resolve(v);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!opts.danger) close(false); else no.focus(); }
        else if (e.key === 'Tab') {
          var f = [yes, no], i = f.indexOf(document.activeElement);
          e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
        }
      }
      document.addEventListener('keydown', onKey, true);
      yes.onclick = function () { close(true); };
      no.onclick = function () { close(false); };
      scrim.addEventListener('mousedown', function (e) { if (e.target === scrim && !opts.danger) close(false); });
      (opts.danger ? no : yes).focus();
    });
  }
  function dialogOpen() { return !!$('dialogRoot').firstChild; }

  // ---------- theme ----------
  var cssCache = {};
  function getCss(v) { return cssCache[v] || (cssCache[v] = getComputedStyle(document.documentElement).getPropertyValue(v).trim()); }
  function applyTheme(mode) {
    var el = document.documentElement;
    if (mode === 'light' || mode === 'dark') el.setAttribute('data-theme', mode); else el.removeAttribute('data-theme');
    cssCache = {}; if (result) draw();
  }
  function initSeg(seg, value, onChange) {
    var opts = [].slice.call(seg.querySelectorAll('[role=radio]'));
    function set(v, focus) {
      opts.forEach(function (o) { var on = o.getAttribute('data-v') === v; o.setAttribute('aria-checked', on); o.tabIndex = on ? 0 : -1; if (on && focus) o.focus(); });
    }
    set(value);
    opts.forEach(function (o, i) {
      o.onclick = function () { set(o.getAttribute('data-v')); onChange(o.getAttribute('data-v')); };
      o.onkeydown = function (e) {
        var step = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? -1 : 0;
        if (!step) return; e.preventDefault();
        var n = opts[(i + step + opts.length) % opts.length]; set(n.getAttribute('data-v'), true); onChange(n.getAttribute('data-v'));
      };
    });
    return set;
  }
  var themeMode = getPref('theme', 'auto');
  var setThemeSeg = initSeg($('themeSeg'), themeMode, function (v) { themeMode = v; setPref('theme', v); applyTheme(v); });
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { cssCache = {}; if (result) draw(); }); } catch (e) {}

  // ---------- tabs ----------
  var views = ['task', 'settings', 'about'];
  function showView(name, noFocus) {
    views.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    [].forEach.call(document.querySelectorAll('.wk-tab'), function (t) {
      if (t.getAttribute('data-tab') === name) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (!noFocus) $('screen').focus({ preventScroll: true });
    if (name === 'task' && result) { sizeCanvas(); draw(); }
    if (name === 'settings') renderLog();
  }
  [].forEach.call(document.querySelectorAll('.wk-tab'), function (t) { t.onclick = function () { showView(t.getAttribute('data-tab')); }; });

  // ---------- switch + prefs ----------
  function setSwitch(btn, on) { btn.setAttribute('aria-checked', on ? 'true' : 'false'); }
  function isOn(btn) { return btn.getAttribute('aria-checked') === 'true'; }
  function upd(r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }
  function syncCtrls() {
    $('speedVal').textContent = fa($('speed').value) + '٪';
    $('guideVal').textContent = $('guide').value == 0 ? 'خاموش' : fa($('guide').value) + '٪';
    upd($('speed')); upd($('guide'));
    var on = isOn($('ciOn')); $('ciBeats').disabled = !on; $('ciBpm').disabled = !on;
    var tr = isOn($('trOn')); $('trEvery').disabled = !tr; $('trStep').disabled = !tr;
  }
  function savePrefs() {
    setPref('acc_prefs', JSON.stringify({ speed: +$('speed').value, guide: +$('guide').value, ci: isOn($('ciOn')), beats: +$('ciBeats').value, bpm: +$('ciBpm').value, tuneMine: +$('tuneMine').value, tuneRec: +$('tuneRec').value, trEvery: +$('trEvery').value, trStep: +$('trStep').value }));
  }
  function loadPrefs() {
    try {
      var p = JSON.parse(getPref('acc_prefs', 'null')); if (!p) return;
      if (p.speed >= 50 && p.speed <= 125) $('speed').value = p.speed;
      if (p.guide >= 0 && p.guide <= 100) $('guide').value = p.guide;
      setSwitch($('ciOn'), !!p.ci);
      if (p.beats >= 1 && p.beats <= 8) $('ciBeats').value = p.beats;
      if (p.bpm >= 30 && p.bpm <= 220) $('ciBpm').value = p.bpm;
      if (p.tuneMine >= 400 && p.tuneMine <= 460) $('tuneMine').value = p.tuneMine;
      if (p.tuneRec >= 400 && p.tuneRec <= 460) $('tuneRec').value = p.tuneRec;
      if (p.trEvery >= 1 && p.trEvery <= 10) $('trEvery').value = p.trEvery;
      if (p.trStep === 5 || p.trStep === 10) $('trStep').value = p.trStep;
    } catch (e) {}
  }
  // tuning, semitone and step options
  function addOpt(sel, v, label) { var o = document.createElement('option'); o.value = v; o.textContent = label; sel.appendChild(o); }
  [415, 430, 432, 435, 438, 440, 442, 443, 444, 445].forEach(function (hz) { addOpt($('tuneRec'), hz, fa(hz) + ' هرتز'); addOpt($('tuneMine'), hz, fa(hz) + ' هرتز'); });
  $('tuneRec').value = 440; $('tuneMine').value = 440;
  for (var sm = -6; sm <= 6; sm++) addOpt($('tuneSemi'), sm, sm === 0 ? 'بدون انتقال' : fa(Math.abs(sm)) + ' نیم‌پرده ' + (sm > 0 ? 'بالاتر' : 'پایین‌تر'));
  $('tuneSemi').value = 0;
  addOpt($('trStep'), 5, '۵٪'); addOpt($('trStep'), 10, '۱۰٪'); $('trStep').value = 5;
  loadPrefs(); syncCtrls();
  $('ciOn').onclick = function () { setSwitch(this, !isOn(this)); syncCtrls(); savePrefs(); };
  $('ciBeats').onchange = $('ciBpm').onchange = savePrefs;

  // ---------- init ----------
  gs('getConfig').then(function (cfg) {
    CFG = cfg;
    cfg.instruments.forEach(function (i) { var o = document.createElement('option'); o.value = i.id; o.textContent = i.label; $('instSelect').appendChild(o); });
    var last = getPref('acc_inst', ''); if (last) $('instSelect').value = last;
    if (cfg.canSetKey) {
      $('cardKey').hidden = false;
      $('keyHint').textContent = cfg.hasKey ? 'یک کلید ذخیره شده است. برای تغییر، کلید تازه را وارد کنید.' : 'هنوز کلیدی ذخیره نشده است.';
      if (WEB) { $('keyNote').hidden = false; $('relayField').hidden = !!(window.SOLO_RELAY || '').trim(); if (relayUrl()) $('relayHint').textContent = 'یک آدرس ریلی ذخیره شده است. برای تغییر، آدرس تازه را وارد کن.'; }
    }
    keyNotice(); updateProcessBtn();
  }).catch(function (e) { showAlert('inputAlert', 'error', 'خطا:', 'اپ بارگذاری نشد (' + e.message + '). صفحه را دوباره باز کنید.'); });

  function keyNotice() {
    if (WEB && !relayUrl()) { showAlert('inputAlert', 'note', 'توجه:', 'آدرس ریلی ثبت نشده است. از «تنظیمات» ثبتش کن (راهنما در README).'); return; }
    if (!CFG || CFG.hasKey) { return; }
    showAlert('inputAlert', 'note', 'توجه:', CFG.canSetKey ? 'کلید API هنوز ثبت نشده است. از «تنظیمات» ثبتش کنید.' : 'صاحب اپ هنوز کلید API را ثبت نکرده است.');
  }
  $('btnSaveKey').onclick = function () {
    clearAlert('keyAlert');
    if (WEB && $('relayInput').value.trim()) {
      var ru = $('relayInput').value.trim();
      if (!validRelay(ru)) { showAlert('keyAlert', 'error', 'خطا:', 'آدرس ریلی باید شبیه https://…workers.dev یا https://script.google.com/macros/s/…/exec باشد.'); return; }
      setPref('relay_url', ru); $('relayInput').value = ''; $('relayHint').textContent = 'یک آدرس ریلی ذخیره شده است. برای تغییر، آدرس تازه را وارد کن.';
      clearAlert('inputAlert'); toast('آدرس ریلی ذخیره شد');
      if (!$('keyInput').value.trim()) { keyNotice(); updateProcessBtn(); return; }
    }
    gs('setApiKey', $('keyInput').value).then(function () {
      CFG.hasKey = true; $('keyInput').value = '';
      $('keyHint').textContent = 'یک کلید ذخیره شده است. برای تغییر، کلید تازه را وارد کنید.';
      clearAlert('inputAlert'); toast('کلید ذخیره شد'); updateProcessBtn();
    }).catch(function (e) { showAlert('keyAlert', 'error', 'خطا:', e.message); });
  };
  $('instSelect').onchange = function () { setPref('acc_inst', this.value); };

  $('btnReset').onclick = function () {
    confirmDialog({ title: 'ترجیحات این دستگاه پاک شود؟', text: 'ساز، سرعت، صدای راهنما، شمارش و ظاهر به حالت اول برمی‌گردد.', confirm: 'بازنشانی', cancel: 'نگه دار', danger: true }).then(function (yes) {
      if (!yes) return;
      ['theme', 'acc_inst', 'acc_prefs'].forEach(delPref);
      themeMode = 'auto'; setThemeSeg('auto'); applyTheme('auto');
      $('speed').value = 100; $('guide').value = 0; setSwitch($('ciOn'), false); $('ciBeats').value = 4; $('ciBpm').value = 72;
      $('tuneRec').value = 440; $('tuneMine').value = 440; $('tuneSemi').value = 0; setSwitch($('trOn'), false); $('trEvery').value = 3; $('trStep').value = 5;
      if ($('instSelect').options.length) $('instSelect').selectedIndex = 0;
      syncCtrls(); updateTune(); updateTr(); if (result) buildAudio(); else audio.playbackRate = rate();
      toast('ترجیحات بازنشانی شد');
    });
  };

  // ---------- file pick ----------
  var drop = $('drop');
  function openPicker() { if (!busy) $('fileInput').click(); }
  drop.onclick = openPicker;
  drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } };
  $('fileInput').onchange = function () { if (this.files[0]) pickFile(this.files[0]); this.value = ''; };
  drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('is-over'); };
  drop.ondragleave = function () { drop.classList.remove('is-over'); };
  drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('is-over'); if (!busy && e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]); };
  function pickFile(f) {
    var isAudio = /^audio\//.test(f.type) || /\.(mp3|wav|flac|m4a|ogg|opus|aac)$/i.test(f.name);
    if (!isAudio) { showAlert('inputAlert', 'error', 'خطا:', 'این فایل صوتی نیست. یک فایل MP3، WAV، FLAC یا M4A انتخاب کنید.'); return; }
    if (!f.size) { showAlert('inputAlert', 'error', 'خطا:', 'این فایل خالی است. فایل دیگری انتخاب کنید.'); return; }
    clearAlert('inputAlert'); keyNotice();
    file = f; $('dropTitle').textContent = f.name;
    $('dropInfo').textContent = fa((f.size / 1e6).toFixed(1)) + ' مگابایت · برای تغییر بزنید';
    $('dropInfo').removeAttribute('dir');
    updateProcessBtn();
  }
  function updateProcessBtn() {
    var reason = '';
    if (!CFG) reason = 'در حال بارگذاری…';
    else if (!CFG.hasKey) reason = CFG.canSetKey ? 'اول کلید API را در «تنظیمات» ثبت کنید.' : 'اپ هنوز آماده نیست.';
    else if (!file) reason = 'اول یک فایل انتخاب کنید.';
    $('btnProcess').disabled = !!reason || busy;
    $('processHint').textContent = busy ? '' : reason;
  }
  drop.setAttribute('aria-disabled', 'false');

  // ---------- keep the screen on and warn before leaving while work is at stake ----------
  var wake = null;
  function lockScreen() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }, function () {}); } catch (e) {} }
  function unlockScreen() { try { if (wake) wake.release(); } catch (e) {} wake = null; }
  document.addEventListener('visibilitychange', function () { if (busy && document.visibilityState === 'visible') lockScreen(); });
  window.addEventListener('beforeunload', function (e) { if (busy || result) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- audio helpers ----------
  function decode(arrayBuf) {
    var ctx = new OfflineAudioContext(2, 1, SR);
    return new Promise(function (res, rej) { ctx.decodeAudioData(arrayBuf, res, function () { rej(new Error('فایل صوتی قابل خواندن نیست.')); }); });
  }
  function channels(ab) { var L = ab.getChannelData(0); return [L, ab.numberOfChannels > 1 ? ab.getChannelData(1) : L]; }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = rej; r.readAsDataURL(blob);
    });
  }
  var LAME_SRC = null;
  function ensureLame() {
    if (LAME_SRC) return Promise.resolve();
    return gs('getLame').then(function (src) {
      LAME_SRC = src;
      var el = document.createElement('script'); el.textContent = src; document.head.appendChild(el);
    });
  }
  var WORKER_TAIL = ";" +
    "onmessage=function(e){var d=e.data,L=d.L,R=d.R,n=L.length;" +
    "function i16(x){var o=new Int16Array(x.length);for(var i=0;i<x.length;i++){var v=x[i];v=v>1?1:v<-1?-1:v;o[i]=v<0?v*32768:v*32767;}return o;}" +
    "var l=i16(L),r=i16(R),enc=new lamejs.Mp3Encoder(2,d.sr,d.kbps),parts=[],B=1152*100,k=0;" +
    "for(var i=0;i<n;i+=B){var b=enc.encodeBuffer(l.subarray(i,i+B),r.subarray(i,i+B));if(b.length)parts.push(new Uint8Array(b));if(++k%10==0)postMessage({p:i/n});}" +
    "var f=enc.flush();if(f.length)parts.push(new Uint8Array(f));postMessage({done:true,parts:parts});};";
  var workerUrl = null;
  function mp3(L, R, kbps, onP) { return ensureLame().then(function () { return mp3_(L, R, kbps, onP); }); }
  function mp3_(L, R, kbps, onP) {
    return new Promise(function (resolve, reject) {
      var w;
      try {
        if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([LAME_SRC, WORKER_TAIL], { type: 'text/javascript' }));
        w = new Worker(workerUrl);
      } catch (e) { w = null; }
      var fallback = function () {
        if (!window.lamejs) return reject(new Error('کتابخانۀ MP3 بارگذاری نشد.'));
        AccCore.encodeMp3(window.lamejs, [L, R], SR, kbps, onP).then(function (parts) { resolve(new Blob(parts, { type: 'audio/mpeg' })); }, reject);
      };
      if (!w) return fallback();
      var Lc = new Float32Array(L), Rc = R === L ? Lc.slice() : new Float32Array(R);
      w.onmessage = function (e) {
        if (e.data.done) { w.terminate(); resolve(new Blob(e.data.parts, { type: 'audio/mpeg' })); }
        else if (onP) onP(e.data.p);
      };
      w.onerror = function (ev) { ev.preventDefault(); w.terminate(); fallback(); };
      w.postMessage({ L: Lc, R: Rc, sr: SR, kbps: kbps }, [Lc.buffer, Rc.buffer]);
    });
  }
  function fetchWithProgress(url, onP) {
    return fetch(url).then(function (resp) {
      if (!resp.ok) throw new Error('دانلود نتیجه ناموفق بود (' + resp.status + ')');
      var total = +resp.headers.get('content-length') || 0;
      if (!resp.body || !total) return resp.arrayBuffer();
      var reader = resp.body.getReader(), got = 0, chunks = [];
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) { var out = new Uint8Array(got), p = 0; chunks.forEach(function (c) { out.set(c, p); p += c.length; }); return out.buffer; }
          chunks.push(r.value); got += r.value.length; if (onP) onP(got / total); return pump();
        });
      })();
    });
  }
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); };

  // ---------- processing ----------
  function setStatus(t, frac) {
    $('statusText').textContent = t;
    if (frac != null) { var p = Math.round(frac * 100); $('barFill').style.width = p + '%'; $('bar').setAttribute('aria-valuenow', p); }
  }
  function log(t) { var li = document.createElement('li'); li.textContent = t; $('log').appendChild(li); $('log').scrollTop = 1e9; }

  $('btnCancel').onclick = function () {
    confirmDialog({ title: 'پردازش لغو شود؟', text: 'کارهایی که تمام شده ذخیره نمی‌شود؛ از اول شروع می‌کنید.', confirm: 'لغو پردازش', cancel: 'ادامه بده', danger: true }).then(function (yes) {
      if (yes && busy) { cancelled = true; setStatus('در حال لغو…'); }
    });
  };
  $('btnProcess').onclick = function () {
    var go = function () {
      run().catch(function (e) {
        if (e.message === 'لغو شد.') { setStatus('لغو شد'); showAlert('progAlert', 'note', 'توجه:', 'پردازش لغو شد. هر وقت خواستید دوباره شروع کنید.'); }
        else { setStatus('متوقف شد'); showAlert('progAlert', 'error', 'خطا:', e.message + ' دوباره امتحان کنید.'); }
      }).then(function () { busy = false; unlockScreen(); updateProcessBtn(); $('btnCancel').hidden = true; });
    };
    if (result) {
      confirmDialog({ title: 'نتیجۀ فعلی عوض شود؟', text: 'همراهی‌ای که الان داری با نتیجۀ تازه جایگزین می‌شود. اگر لازمش داری، اول دانلودش کن.', confirm: 'جایگزین کن', cancel: 'برگرد', danger: true }).then(function (yes) { if (yes) go(); });
    } else go();
  };

  async function run() {
    busy = true; cancelled = false; lockScreen(); updateProcessBtn();
    audio.pause(); result = null; $('cardPlayer').hidden = true; $('cardTools').hidden = true; $('cardRec').hidden = true; $('cardScore').hidden = true; closePdf(); stopTools(); if (recS) stopRec(); clearTakes(); peaks = peaksSolo = null;
    var instId = $('instSelect').value, inst = CFG.instruments.filter(function (i) { return i.id === instId; })[0];
    $('cardProgress').hidden = false; $('btnCancel').hidden = false; $('log').innerHTML = ''; clearAlert('progAlert');
    $('cardProgress').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStatus('در حال خواندن فایل…', 0.02);
    var buf = await file.arrayBuffer();
    var ab = await decode(buf.slice(0)); checkCancel();
    var mix = channels(ab), total = ab.length, dur = total / SR;
    var direct = dur <= DIRECT_MAX_SEC && file.size <= DIRECT_MAX_BYTES && /\.(mp3|m4a|aac|ogg|opus|flac)$/i.test(file.name);
    var chunks = direct ? [{ start: 0, end: total }] : AccCore.planChunks(total, SR, MAX_CHUNK, OVERLAP);
    var refs = chunks.map(function (c) { return AccCore.prepRef(mix, c, SR); });
    var out = AccCore.newOutput(total), n = chunks.length;
    log('مدت فایل ' + fa(fmt(dur)) + (n > 1 ? ' — در ' + fa(n) + ' بخش با هم‌پوشانی پردازش می‌شود' : ''));
    var share = function (i, f) { return 0.05 + 0.93 * (i + f) / n; };

    var payload = function (i) {
      if (direct) return blobToB64(file).then(function (b) { return { b64: b, name: 'audio' + ((file.name.match(/\.[A-Za-z0-9]{2,5}$/) || ['.mp3'])[0]).toLowerCase(), mime: file.type || 'audio/mpeg' }; });
      var c = chunks[i];
      return mp3(mix[0].subarray(c.start, c.end), mix[1].subarray(c.start, c.end), 192, function (p) {
        if (curStage === 'encode' && curIdx === i) setStatus(partLbl(i) + 'آماده‌سازی فایل… ' + fa(Math.round(p * 100)) + '٪', share(i, 0.15 * p));
      }).then(blobToB64).then(function (b) { return { b64: b, name: 'part' + (i + 1) + '.mp3', mime: 'audio/mpeg' }; });
    };
    var partLbl = function (i) { return n > 1 ? 'بخش ' + fa(i + 1) + ' از ' + fa(n) + ': ' : ''; };
    var curStage = 'encode', curIdx = 0;
    var next = payload(0);

    for (var i = 0; i < n; i++) {
      curStage = 'encode'; curIdx = i;
      setStatus(partLbl(i) + 'آماده‌سازی فایل…', share(i, 0));
      var p = await next; checkCancel();
      curStage = 'upload';
      setStatus(partLbl(i) + 'ارسال به MVSEP…', share(i, 0.18));
      var hash = await gs('createJob', p.b64, p.name, p.mime, instId);
      p = null;
      if (i + 1 < n) next = payload(i + 1);
      log(partLbl(i) + 'ارسال شد');

      var st, fails = 0;
      while (true) {
        await sleep(window.__POLL_MS || 5000); checkCancel();
        try { st = await gs('getJob', hash); fails = 0; } catch (e) { if (++fails > 4) throw e; continue; }
        if (st.status === 'done') break;
        if (st.status === 'failed' || st.status === 'error') throw new Error('MVSEP: ' + (st.message || 'پردازش ناموفق بود.'));
        if (st.status === 'waiting') setStatus(partLbl(i) + 'در صف MVSEP' + (st.eta ? ' — حدود ' + fa(Math.ceil(st.eta / 60)) + ' دقیقه' : ''), share(i, 0.25));
        else setStatus(partLbl(i) + 'جداسازی ساز تو از بقیۀ اثر…', share(i, 0.45));
      }
      var solo = null, acc = null;
      st.files.forEach(function (f) { var t = norm(f.type); if (t === inst.solo || t.indexOf(inst.solo) >= 0) solo = f; });
      var rest = st.files.filter(function (f) { return f !== solo; });
      acc = rest.filter(function (f) { return /other|instrum|music/.test(norm(f.type)); })[0] || rest[0];
      if (!acc) throw new Error('فایل همراهی در خروجی پیدا نشد.');
      var dl = function (f, a, b) {
        return fetchWithProgress(f.url, function (q) { setStatus(partLbl(i) + 'دریافت نتیجه… ' + fa(Math.round(q * 100)) + '٪', share(i, a + (b - a) * q)); })
          .then(decode).then(channels);
      };
      var accCh = await dl(acc, 0.6, 0.78); checkCancel();
      var soloCh = solo ? await dl(solo, 0.78, 0.95) : null; checkCancel();
      setStatus(partLbl(i) + 'اتصال…', share(i, 0.97));
      var fl = AccCore.addChunk(out, chunks, i, { acc: accCh, solo: soloCh }, refs[i], SR, OVERLAP);
      if (fl.score < 0.6) showAlert('progAlert', 'note', 'توجه:', partLbl(i) + 'هم‌ترازی زمانی مطمئن نیست؛ نتیجه را یک بار گوش کنید.');
      log(partLbl(i) + 'تمام شد');
    }
    mix = null; ab = null; buf = null;
    setStatus('آماده است', 1);
    result = { acc: out.acc, solo: out.solo, name: file.name.replace(/\.[^.]+$/, ''), instLabel: inst.label };
    setupPlayer();
    toast('همراهی آماده است');
  }

  // ---------- player ----------
  audio.preservesPitch = true; audio.mozPreservesPitch = true; audio.webkitPreservesPitch = true;
  function rate() { return ($('speed').value / 100) / K; }
  function cur() { return audio.currentTime * K; }
  function setCur(t) { audio.currentTime = t / K; }
  function dur() { return (audio.duration || 0) * K; }
  function tuneRatio() { var r = (+$('tuneMine').value / +$('tuneRec').value) * Math.pow(2, +$('tuneSemi').value / 12); return Math.abs(r - 1) < 1e-6 ? 1 : r; }
  function updateTune() {
    var r = tuneRatio(), c = Math.round(1200 * Math.log(r) / Math.LN2);
    $('tuneInfo').textContent = c === 0 ? 'بدون تغییر' : (c > 0 ? '+' : '−') + Math.abs(c) + ' cent';
  }
  var canvas = $('wave'), cctx = canvas.getContext('2d'), peaks = null, peaksSolo = null;

  function computePeaks(chs, bins) {
    var x = chs[0], y = chs[1] || chs[0], n = x.length, step = n / bins, out = new Float32Array(bins);
    for (var b = 0; b < bins; b++) {
      var s = Math.floor(b * step), e = Math.min(n, Math.floor((b + 1) * step)), m = 0;
      for (var i = s; i < e; i += 7) { var v = Math.abs(x[i]) + Math.abs(y[i]); if (v > m) m = v; }
      out[b] = m / 2;
    }
    return out;
  }
  function sizeCanvas() {
    var r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    canvas.width = Math.max(300, Math.round(r.width * dpr)); canvas.height = Math.round(120 * dpr);
    if (result) { var bins = Math.floor(canvas.width / (2 * dpr)); peaks = computePeaks(result.acc, bins); peaksSolo = computePeaks(result.solo, bins); }
  }
  function draw() {
    if (!peaks) return;
    var W = canvas.width, H = canvas.height, dur = audio.duration ? audio.duration * K : (result.acc[0].length / SR);
    cctx.clearRect(0, 0, W, H);
    var max = 0.0001; for (var i = 0; i < peaks.length; i++) max = Math.max(max, peaks[i], peaksSolo[i]);
    var bw = W / peaks.length, mid = H / 2, accent = getCss('--accent');
    if (loopA != null && loopB != null) { cctx.globalAlpha = 0.18; cctx.fillStyle = accent; cctx.fillRect(loopA / dur * W, 0, (loopB - loopA) / dur * W, H); cctx.globalAlpha = 1; }
    cctx.globalAlpha = 0.45; cctx.fillStyle = accent;
    for (i = 0; i < peaks.length; i++) { var hs = peaksSolo[i] / max * (H * 0.46); cctx.fillRect(i * bw, mid - hs, Math.max(1, bw - 1), hs * 2); }
    cctx.globalAlpha = 1; cctx.fillStyle = getCss('--ink-muted');
    for (i = 0; i < peaks.length; i++) { var h = Math.max(1, peaks[i] / max * (H * 0.46)); cctx.fillRect(i * bw, mid - h, Math.max(1, bw - 1), h * 2); }
    cctx.fillStyle = accent;
    [loopA, loopB].forEach(function (t) { if (t != null) cctx.fillRect(t / dur * W - 1, 0, 2, H); });
    var dpr = window.devicePixelRatio || 1;
    cctx.font = '600 ' + Math.round(11 * dpr) + 'px sans-serif'; cctx.textBaseline = 'top';
    marks.forEach(function (t, i) {
      var x = t / dur * W; cctx.fillStyle = getCss('--ink-muted'); cctx.fillRect(x - 0.5 * dpr, 0, dpr, H);
      cctx.fillStyle = getCss('--ink'); cctx.fillText(markLabel(i), x + 3 * dpr, 2 * dpr);
    });
    cctx.fillStyle = getCss('--ink'); cctx.fillRect(cur() / dur * W - 1, 0, 2, H);
  }

  function buildAudio(fresh) {
    var g = $('guide').value / 100, r = tuneRatio(), key = g + '|' + r;
    if (!fresh && key === builtKey) return;
    var t = fresh ? 0 : cur(), playing = fresh ? false : !audio.paused;
    var mixed = AccCore.mixGuide(result.acc, result.solo, g);
    if (r !== 1) mixed = AccCore.resample(mixed, r);
    var url = URL.createObjectURL(new Blob([AccCore.encodeWav(mixed, SR)], { type: 'audio/wav' }));
    audio.pause(); K = r; audio.src = url; if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = url; builtKey = key;
    audio.playbackRate = rate();
    audio.addEventListener('loadedmetadata', function once() { audio.removeEventListener('loadedmetadata', once); audio.currentTime = t / K; audio.playbackRate = rate(); if (playing) audio.play(); });
  }
  function setupPlayer() {
    $('cardPlayer').hidden = false; $('cardTools').hidden = false; $('cardRec').hidden = false; $('cardScore').hidden = false; clearTakes();
    $('playerSub').textContent = '«' + result.name + '» · بدون ' + result.instLabel;
    loopA = loopB = null; trCount = 0; $('tuneSemi').value = 0; $('tuneRec').value = 440; updateTune(); loadMarks(); renderMarks(); updateLoopInfo(); clearAlert('dlAlert'); $('dlMsg').textContent = '';
    sizeCanvas(); buildAudio(true); draw();
    $('cardPlayer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.addEventListener('resize', function () { if (result) { sizeCanvas(); draw(); } });

  var counting = false;
  async function togglePlay() {
    if (!result || counting) return;
    if (!audio.paused) { audio.pause(); return; }
    if (loopA != null && loopB != null && (cur() < loopA || cur() >= loopB)) setCur(loopA);
    if (isOn($('ciOn'))) await countIn();
    audio.play();
  }
  async function countIn() {
    counting = true;
    var beats = Math.max(1, Math.min(8, +$('ciBeats').value || 4)), bpm = Math.max(30, Math.min(220, +$('ciBpm').value || 72));
    var ac = new (window.AudioContext || window.webkitAudioContext)(), spb = 60 / bpm, t0 = ac.currentTime + 0.1;
    for (var b = 0; b < beats; b++) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = b === 0 ? 1500 : 1000; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, t0 + b * spb); g.gain.exponentialRampToValueAtTime(0.5, t0 + b * spb + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + b * spb + 0.08); o.start(t0 + b * spb); o.stop(t0 + b * spb + 0.1);
    }
    for (b = 0; b < beats; b++) { $('beat').textContent = fa(b + 1); await sleep(spb * 1000); }
    $('beat').textContent = ''; counting = false; setTimeout(function () { ac.close(); }, 300);
  }
  $('btnPlay').onclick = togglePlay;
  function setPlayIcon(p) { ['btnPlay', 'btnPlay2'].forEach(function (id) { $(id).innerHTML = ICON(p ? 'pause' : 'play'); $(id).setAttribute('aria-label', p ? 'توقف' : 'پخش'); }); }
  $('btnPlay2').onclick = togglePlay;
  audio.onplay = function () { setPlayIcon(true); };
  audio.onpause = function () { setPlayIcon(false); };
  audio.onloadedmetadata = function () { $('tDur').textContent = fmt(dur()); };
  function seek(d) { if (result) setCur(Math.max(0, Math.min(dur(), cur() + d))); }
  $('btnBack').onclick = function () { seek(-5); };
  $('btnFwd').onclick = function () { seek(5); };

  $('speed').oninput = function () { audio.playbackRate = rate(); syncCtrls(); updateTr(); };
  $('speed').onchange = savePrefs;
  $('guide').oninput = syncCtrls;
  $('guide').onchange = function () { savePrefs(); if (result) buildAudio(); };
  ['tuneRec', 'tuneMine', 'tuneSemi'].forEach(function (id) { $(id).onchange = function () { updateTune(); savePrefs(); if (result) buildAudio(); }; });

  function updateLoopInfo() {
    $('loopInfo').textContent = loopA != null && loopB != null ? fmt(loopA) + ' → ' + fmt(loopB) : loopA != null ? fmt(loopA) + ' → …' : '—';
    updateTr(); draw();
  }
  function setA() { if (!result) return; loopA = cur(); if (loopB != null && loopB <= loopA) loopB = null; trCount = 0; updateLoopInfo(); }
  function setB() { if (!result) return; var t = cur(); if (loopA == null || t <= loopA) return; loopB = t; trCount = 0; updateLoopInfo(); }
  $('btnA').onclick = setA; $('btnB').onclick = setB;
  $('btnClearLoop').onclick = function () { loopA = loopB = null; trCount = 0; updateLoopInfo(); };

  // pointer events: tap to seek, drag to choose a loop (works with mouse and touch)
  var dragX = null, dragT0 = 0;
  function xToTime(e) { var r = canvas.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur(); }
  canvas.addEventListener('pointerdown', function (e) { if (!result) return; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} dragX = e.clientX; dragT0 = xToTime(e); });
  canvas.addEventListener('pointermove', function (e) {
    if (dragX == null || Math.abs(e.clientX - dragX) < 6) return;
    var t = xToTime(e); loopA = Math.min(dragT0, t); loopB = Math.max(dragT0, t); trCount = 0; updateLoopInfo();
  });
  canvas.addEventListener('pointerup', function (e) {
    if (dragX == null) return;
    if (Math.abs(e.clientX - dragX) < 6) setCur(xToTime(e)); else setCur(loopA);
    dragX = null; draw();
  });
  canvas.addEventListener('pointercancel', function () { dragX = null; });

  // ---------- gradual speed ----------
  var trCount = 0;
  function trActive() { return isOn($('trOn')) && loopA != null && loopB != null; }
  function updateTr() {
    var el = $('trInfo'); if (!isOn($('trOn'))) { el.textContent = ''; return; }
    if (loopA == null || loopB == null) { el.textContent = 'اول بخشی را برای تکرار انتخاب کن.'; return; }
    var sp = +$('speed').value, every = Math.max(1, Math.min(10, +$('trEvery').value || 3));
    el.textContent = sp >= 100 ? 'به سرعت اصلی رسیده‌ای. برای شروع دوباره، سرعت را کمتر کن.' : 'دور ' + fa(trCount + 1) + ' از ' + fa(every) + ' · سرعت ' + fa(sp) + '٪';
  }
  function onLoopWrap() {
    if (!trActive()) return;
    var every = Math.max(1, Math.min(10, +$('trEvery').value || 3)), step = +$('trStep').value === 10 ? 10 : 5, sp = +$('speed').value;
    if (sp >= 100) return;
    trCount++;
    if (trCount >= every) {
      trCount = 0; sp = Math.min(100, sp + step); $('speed').value = sp; audio.playbackRate = rate(); syncCtrls();
      if (sp >= 100) toast('به سرعت اصلی رسیدی');
    }
    updateTr();
  }
  $('trOn').onclick = function () { setSwitch(this, !isOn(this)); trCount = 0; syncCtrls(); updateTr(); };
  $('trEvery').onchange = function () { trCount = 0; updateTr(); savePrefs(); };
  $('trStep').onchange = function () { updateTr(); savePrefs(); };

  // ---------- named markers ----------
  function markLabel(i) { return i < 26 ? String.fromCharCode(65 + i) : String(i - 25); }
  function markKey() { return 'acc_marks_' + result.name + '_' + Math.round(result.acc[0].length / SR); }
  function loadMarks() {
    marks = [];
    try { var a = JSON.parse(getPref(markKey(), '[]')); if (Array.isArray(a)) marks = a.filter(function (x) { return typeof x === 'number' && isFinite(x) && x >= 0; }).sort(function (x, y) { return x - y; }).slice(0, 26); } catch (e) {}
    markPages = {};
    try { var p = JSON.parse(getPref(markKey() + '_p', '{}')); if (p && typeof p === 'object') marks.forEach(function (t) { var n = p[mk(t)]; if (n > 0 && n < 5000) markPages[mk(t)] = Math.floor(n); }); } catch (e) {}
  }
  function mk(t) { return t.toFixed(2); }
  function saveMarks() {
    if (marks.length) setPref(markKey(), JSON.stringify(marks)); else delPref(markKey());
    var keep = {}, any = false; marks.forEach(function (t) { if (markPages[mk(t)]) { keep[mk(t)] = markPages[mk(t)]; any = true; } });
    markPages = keep; if (any) setPref(markKey() + '_p', JSON.stringify(keep)); else delPref(markKey() + '_p');
  }
  function renderMarks() {
    var box = $('marks'); box.innerHTML = '';
    marks.forEach(function (t, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'wk-btn wk-btn--secondary app-mark';
      var pg = markPages[mk(t)];
      b.setAttribute('aria-label', 'نشانه ' + markLabel(i) + '، ' + fmt(t) + (pg ? '، صفحۀ ' + fa(pg) : '') + '. برای حذف نگه دارید.');
      b.innerHTML = '<b>' + markLabel(i) + '</b><span>' + fmt(t) + '</span>' + (pg ? '<em>ص ' + fa(pg) + '</em>' : '');
      var timer = null, held = false;
      b.addEventListener('pointerdown', function () { held = false; timer = setTimeout(function () { held = true; removeMark(i); }, 650); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { clearTimeout(timer); }); });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () { if (held) { held = false; return; } if (result) { setCur(t); if (pdfDoc && markPages[mk(t)]) showPage(markPages[mk(t)]); } });
      b.addEventListener('keydown', function (e) { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeMark(i); } });
      box.appendChild(b);
    });
    $('btnMarksClear').disabled = !marks.length; draw();
  }
  function addMark() {
    if (!result) return;
    var t = cur();
    if (marks.length >= 26) { toast('حداکثر ۲۶ نشانه'); return; }
    if (marks.some(function (m) { return Math.abs(m - t) < 0.5; })) { toast('این‌جا نشانه‌ای هست'); return; }
    marks.push(t); marks.sort(function (x, y) { return x - y; }); if (pdfDoc) markPages[mk(t)] = pageNum; saveMarks(); renderMarks();
    toast('نشانه ' + markLabel(marks.indexOf(t)) + ' افزوده شد');
  }
  function removeMark(i) { var l = markLabel(i); marks.splice(i, 1); saveMarks(); renderMarks(); toast('نشانه ' + l + ' حذف شد'); }
  $('btnMark').onclick = addMark;
  $('btnMarksClear').onclick = function () {
    if (!marks.length) return;
    confirmDialog({ title: 'همۀ نشانه‌ها حذف شود؟', text: 'نشانه‌های این ضبط پاک می‌شوند.', confirm: 'حذف همه', cancel: 'نگه دار', danger: true }).then(function (yes) { if (!yes) return; marks = []; saveMarks(); renderMarks(); toast('نشانه‌ها حذف شد'); });
  };
  updateTune();


  // ---------- record yourself (needs the microphone; works in the web build) ----------
  var recS = null, takes = [], takeAudio = null, recTimer = 0, recRaf = 0, recCtx = null;
  function micMsg(e) {
    if (!WEB) return 'ضبط با میکروفون فقط در نسخۀ وب اپ کار می‌کند؛ گوگل میکروفون را در اپ‌اسکریپت می‌بندد.';
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'اجازۀ میکروفون داده نشد. در تنظیمات مرورگر برای این سایت میکروفون را مجاز کن.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'میکروفونی پیدا نشد. یکی را وصل کن و دوباره امتحان کن.';
    return 'میکروفون باز نشد. دوباره امتحان کن.';
  }
  function recMime() {
    var c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < c.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported(c[i])) return c[i];
    return '';
  }
  function latSec() { return (+$('recLat').value || 0) / 1000; }
  $('recLat').oninput = function () { $('recLatVal').textContent = fa(this.value) + ' میلی‌ثانیه'; };
  $('recLat').onchange = function () { setPref('acc_lat', this.value); };
  (function () { var v = +getPref('acc_lat', '120'); if (v >= 0 && v <= 400) $('recLat').value = v; $('recLatVal').textContent = fa($('recLat').value) + ' میلی‌ثانیه'; })();
  if (!WEB) { $('btnRec').disabled = true; $('recMsg').textContent = micMsg(); }
  function meterLoop() {
    if (!recS) return;
    var a = recS.an, d = recS.buf; a.getFloatTimeDomainData(d);
    var s = 0, i; for (i = 0; i < d.length; i++) s += d[i] * d[i];
    var lv = Math.min(1, Math.sqrt(s / d.length) * 4);
    $('recMeter').firstElementChild.style.width = Math.round(lv * 100) + '%';
    recRaf = requestAnimationFrame(meterLoop);
  }
  async function startRec() {
    if (!result || recS || counting) return;
    stopTake(); clearAlert('recAlert'); audio.pause();
    var stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (e) { showAlert('recAlert', 'error', 'خطا:', micMsg(e)); return; }
    var mime = recMime(), mr;
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); showAlert('recAlert', 'error', 'خطا:', 'این مرورگر ضبط صدا را پشتیبانی نمی‌کند.'); return; }
    recCtx = new (window.AudioContext || window.webkitAudioContext)();
    var src = recCtx.createMediaStreamSource(stream), an = recCtx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    recS = { stream: stream, mr: mr, chunks: [], an: an, buf: new Float32Array(an.fftSize), mime: mr.mimeType || mime || 'audio/webm', wall0: performance.now(), lead: 0, snap: null };
    mr.ondataavailable = function (e) { if (e.data && e.data.size) recS.chunks.push(e.data); };
    mr.onstop = finishRec;
    mr.start(250);
    $('recMeter').hidden = false; meterLoop();
    $('btnRec').textContent = 'پایان ضبط'; $('btnRec').classList.remove('wk-btn--primary'); $('btnRec').classList.add('wk-btn--secondary');
    var t0 = Date.now(); recTimer = setInterval(function () { $('recMsg').textContent = 'در حال ضبط… ' + fmt((Date.now() - t0) / 1000); }, 500); $('recMsg').textContent = 'در حال ضبط… ۰:۰۰';
    audio.addEventListener('play', function once() {
      audio.removeEventListener('play', once);
      if (recS) { recS.lead = (performance.now() - recS.wall0) / 1000; recS.snap = { t: audio.currentTime, speed: +$('speed').value, key: builtKey, loopA: loopA, loopB: loopB }; }
    });
    await togglePlay();
    if (!recS) return;
  }
  function stopRec() {
    if (!recS) return;
    audio.pause();
    try { recS.mr.stop(); } catch (e) { finishRec(); }
  }
  function finishRec() {
    var s = recS; if (!s) return; recS = null;
    clearInterval(recTimer); cancelAnimationFrame(recRaf); $('recMeter').hidden = true; $('recMeter').firstElementChild.style.width = '0';
    s.stream.getTracks().forEach(function (t) { t.stop(); }); try { recCtx.close(); } catch (e) {} recCtx = null;
    $('btnRec').textContent = 'شروع ضبط'; $('btnRec').classList.add('wk-btn--primary'); $('btnRec').classList.remove('wk-btn--secondary');
    if (!s.snap || !s.chunks.length) { $('recMsg').textContent = ''; showAlert('recAlert', 'note', 'توجه:', 'چیزی ضبط نشد.'); return; }
    var blob = new Blob(s.chunks, { type: s.mime });
    if (takes.length >= 5) { var old = takes.shift(); URL.revokeObjectURL(old.url); }
    var n = (takes.length ? takes[takes.length - 1].n : 0) + 1;
    takes.push({ n: n, blob: blob, url: URL.createObjectURL(blob), lead: s.lead, snap: s.snap, mime: s.mime, secs: Math.max(0, (performance.now() - s.wall0) / 1000 - s.lead) });
    $('recMsg').textContent = ''; renderTakes(); toast('ضبط ذخیره شد');
  }
  $('btnRec').onclick = function () { if (recS) stopRec(); else startRec(); };
  audio.addEventListener('ended', function () { if (recS) stopRec(); });
  function stopTake() {
    if (takeAudio) { try { takeAudio.pause(); } catch (e) {} takeAudio = null; }
    [].forEach.call($('takes').querySelectorAll('[data-act=play]'), function (b) { b.textContent = 'گوش کن'; });
  }
  audio.addEventListener('pause', function () { if (takeAudio) stopTake(); });
  function playTake(t, btn) {
    if (recS || counting) return;
    if (takeAudio) { stopTake(); audio.pause(); return; }
    audio.pause();
    var sn = t.snap;
    if (sn.key !== builtKey) toast('کوک یا ترکیب صدا عوض شده؛ ممکن است هم‌زمان نباشد');
    $('speed').value = sn.speed; $('speed').dispatchEvent(new Event('input'));
    loopA = sn.loopA; loopB = sn.loopB;
    audio.currentTime = sn.t;
    var ta = new Audio(t.url); takeAudio = ta; ta.preload = 'auto';
    ta.onended = function () { if (takeAudio === ta) { audio.pause(); stopTake(); } };
    var go = function () {
      if (takeAudio !== ta) return;
      try { ta.currentTime = Math.max(0, t.lead + latSec()); } catch (e) {}
      btn.textContent = 'توقف'; audio.play(); ta.play();
    };
    if (ta.readyState >= 1) go(); else ta.onloadedmetadata = go;
  }
  function renderTakes() {
    var ul = $('takes'); ul.innerHTML = '';
    takes.forEach(function (t, i) {
      var li = document.createElement('li');
      var nm = document.createElement('span'); nm.textContent = 'ضبط ' + fa(t.n) + ' · ' + fa(fmt(t.secs));
      var bx = document.createElement('span'); bx.className = 'app-takebtns';
      function mk(act, txt, fn) { var b = document.createElement('button'); b.className = 'wk-btn wk-btn--secondary'; b.dataset.act = act; b.textContent = txt; b.onclick = function () { fn(b); }; bx.appendChild(b); }
      mk('play', 'گوش کن', function (b) { playTake(t, b); });
      mk('dl', 'دانلود', function () { save(t.blob, 'take-' + t.n + (/mp4/.test(t.mime) ? '.m4a' : /ogg/.test(t.mime) ? '.ogg' : '.webm')); });
      mk('rm', 'حذف', function () { stopTake(); URL.revokeObjectURL(t.url); takes.splice(takes.indexOf(t), 1); renderTakes(); });
      li.appendChild(nm); li.appendChild(bx); ul.appendChild(li);
    });
    $('takesWrap').hidden = !takes.length;
  }
  function clearTakes() { stopTake(); takes.forEach(function (t) { URL.revokeObjectURL(t.url); }); takes = []; renderTakes(); }

  // ---------- player's own PDF part (local only) ----------
  var pdfDoc = null, pageNum = 1, renderTask = null, renderSeq = 0, lastAutoIdx = -2, PDF_LIB = null;
  function ensurePdf() {
    if (PDF_LIB) return PDF_LIB;
    PDF_LIB = Promise.all([gs('getPdfLib'), gs('getPdfWorker')]).then(function (r) {
      var el = document.createElement('script'); el.textContent = r[0]; document.head.appendChild(el);
      var lib = window['pdfjs-dist/build/pdf'];
      if (!lib) throw new Error('کتابخانۀ نمایش PDF بارگذاری نشد.');
      lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([r[1]], { type: 'text/javascript' }));
      return lib;
    });
    PDF_LIB.catch(function () { PDF_LIB = null; });
    return PDF_LIB;
  }
  function pdfBusy(on, msg) { $('btnPdf').disabled = on; $('pdfMsg').textContent = msg || ''; if (on) clearAlert('pdfAlert'); }
  function pdfFail(m) { pdfBusy(false); showAlert('pdfAlert', 'error', 'خطا:', m); }
  $('btnPdf').onclick = function () { $('pdfInput').click(); };
  $('pdfInput').onchange = function () {
    var f = this.files && this.files[0]; this.value = '';
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { pdfFail('این فایل PDF نیست. فایل پارت را با پسوند PDF انتخاب کن.'); return; }
    pdfBusy(true, 'در حال بازکردن PDF…');
    Promise.all([ensurePdf(), f.arrayBuffer()]).then(function (r) {
      return r[0].getDocument({ data: new Uint8Array(r[1]) }).promise;
    }).then(function (doc) {
      if (pdfDoc) pdfDoc.destroy();
      pdfDoc = doc; pageNum = 1; lastAutoIdx = -2; pdfKey = f.name + '_' + f.size + '_' + doc.numPages; loadInk();
      pdfBusy(false); $('scoreBox').hidden = false; $('btnPdfTxt').textContent = 'انتخاب PDF دیگر';
      showPage(1); toast('PDF باز شد');
    }).catch(function (e) {
      if (e && e.name === 'PasswordException') pdfFail('این PDF رمز دارد. نسخۀ بدون رمز را باز کن.');
      else if (e && e.name === 'InvalidPDFException') pdfFail('این فایل PDF سالم نیست.');
      else pdfFail((e && e.message ? e.message : 'PDF باز نشد.') + ' دوباره امتحان کن.');
    });
  };
  function closePdf() {
    if (renderTask) { try { renderTask.cancel(); } catch (e) {} }
    if (pdfDoc) { try { pdfDoc.destroy(); } catch (e) {} }
    exitStage(); pdfDoc = null; pageNum = 1; renderSeq++; ink = {};
    $('scoreBox').hidden = true; $('btnPdfTxt').textContent = 'انتخاب PDF پارت'; $('pdfMsg').textContent = ''; clearAlert('pdfAlert');
  }
  $('btnPdfClose').onclick = function () { closePdf(); toast('PDF بسته شد'); };
  function showPage(n) {
    if (!pdfDoc) return;
    n = Math.max(1, Math.min(pdfDoc.numPages, n | 0));
    pageNum = n; $('pgInfo').textContent = 'صفحۀ ' + fa(n) + ' از ' + fa(pdfDoc.numPages);
    $('pgPrev').disabled = n <= 1; $('pgNext').disabled = n >= pdfDoc.numPages;
    renderPage();
  }
  async function renderPage() {
    var seq = ++renderSeq, doc = pdfDoc, cv = $('score');
    try {
      if (renderTask) { renderTask.cancel(); try { await renderTask.promise; } catch (e) {} renderTask = null; }
      var page = await doc.getPage(pageNum);
      if (seq !== renderSeq) return;
      var base = page.getViewport({ scale: 1 }), z = $('scoreZoom').value, wrapW = Math.max(200, $('scoreWrap').clientWidth);
      var maxH = stageOn ? Math.max(200, $('scoreWrap').clientHeight - 2) : Math.min(window.innerHeight * 0.75, 760);
      var cssW = z === 'page' ? Math.min(wrapW, maxH * base.width / base.height) : wrapW * (+z / 100);
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5), vp = page.getViewport({ scale: cssW / base.width * dpr });
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height); cv.style.width = cssW + 'px'; cv.style.height = (vp.height / dpr) + 'px';
      var ic = $('ink'); ic.width = cv.width; ic.height = cv.height; ic.style.width = cv.style.width; ic.style.height = cv.style.height; drawInk();
      renderTask = page.render({ canvasContext: cv.getContext('2d'), viewport: vp });
      await renderTask.promise; renderTask = null;
    } catch (e) {
      if (e && e.name === 'RenderingCancelledException') return;
      showAlert('pdfAlert', 'error', 'خطا:', 'این صفحه نمایش داده نشد. صفحۀ دیگری را امتحان کن.');
    }
  }
  $('pgPrev').onclick = function () { showPage(pageNum - 1); };
  $('pgNext').onclick = function () { showPage(pageNum + 1); };
  $('scoreZoom').value = '100';
  $('scoreZoom').onchange = function () { $('scoreWrap').scrollTo(0, 0); renderPage(); };
  var rzT = null;
  window.addEventListener('resize', function () { if (!pdfDoc) return; clearTimeout(rzT); rzT = setTimeout(renderPage, 200); });
  $('pgAuto').onclick = function () { setSwitch(this, !isOn(this)); lastAutoIdx = -2; setPref('pgAuto', isOn(this) ? '1' : '0'); };
  setSwitch($('pgAuto'), getPref('pgAuto', '1') !== '0');
  function currentMarkIdx(linkedOnly) {
    var t = cur() + 0.05, idx = -1;
    for (var i = 0; i < marks.length; i++) { if (marks[i] <= t && (!linkedOnly || markPages[mk(marks[i])])) idx = i; }
    return idx;
  }
  function autoTurn() {
    if (!isOn($('pgAuto'))) return;
    var idx = currentMarkIdx(true);
    if (idx === lastAutoIdx) return;
    lastAutoIdx = idx;
    if (idx >= 0 && markPages[mk(marks[idx])] !== pageNum) showPage(markPages[mk(marks[idx])]);
  }
  $('btnLinkPage').onclick = function () {
    if (!pdfDoc) return;
    var i = currentMarkIdx(false);
    if (i < 0) { toast('اول یک نشانه بساز'); return; }
    markPages[mk(marks[i])] = pageNum; saveMarks(); renderMarks(); lastAutoIdx = -2;
    toast('نشانه ' + markLabel(i) + ' به صفحۀ ' + fa(pageNum) + ' وصل شد');
  };

  // ---------- metronome + reference tone ----------
  var mtCtx = null, mtTimer = null, mtNext = 0, mtBeat = 0, mtQ = [], mtRaf = 0, toneNodes = null, taps = [];
  function toolCtx() {
    if (!mtCtx || mtCtx.state === 'closed') mtCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (mtCtx.state === 'suspended') mtCtx.resume();
    return mtCtx;
  }
  function toolGain() { var v = (+$('toolVol').value || 60) / 100; return v * v; }
  function mtBpm() { return Math.max(30, Math.min(240, Math.round(+$('mtBpm').value) || 72)); }
  function mtBeats() { return +$('mtBeats').value || 4; }
  function mtClick(t, accent) {
    var ac = mtCtx, o = ac.createOscillator(), g = ac.createGain(), v = Math.max(0.002, toolGain() * 0.7);
    o.type = 'sine'; o.frequency.value = accent ? 1568 : 1046;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.09);
  }
  function mtSched() {
    var ac = mtCtx, spb = 60 / mtBpm();
    while (mtNext < ac.currentTime + 0.12) { mtClick(mtNext, mtBeat === 0); mtQ.push({ t: mtNext, i: mtBeat }); mtNext += spb; mtBeat = (mtBeat + 1) % mtBeats(); }
  }
  function mtDots() {
    var box = $('mtDots'); box.innerHTML = '';
    for (var i = 0; i < mtBeats(); i++) { var d = document.createElement('i'); if (i === 0) d.className = 'first'; box.appendChild(d); }
  }
  function mtLight(i) { [].forEach.call($('mtDots').children, function (d, k) { d.classList.toggle('on', k === i); }); }
  function mtDraw() {
    var now = mtCtx.currentTime;
    while (mtQ.length && mtQ[0].t <= now) mtLight(mtQ.shift().i);
    mtRaf = requestAnimationFrame(mtDraw);
  }
  function mtInfo() { $('mtInfo').textContent = mtTimer ? fa(mtBpm()) + ' ضرب در دقیقه' : 'خاموش'; $('btnMt').textContent = mtTimer ? 'توقف مترونوم' : 'شروع مترونوم'; }
  function mtStart() { var ac = toolCtx(); mtBeat = 0; mtQ = []; mtNext = ac.currentTime + 0.06; mtDots(); mtSched(); mtTimer = setInterval(mtSched, 25); mtRaf = requestAnimationFrame(mtDraw); mtInfo(); }
  function mtStop() { clearInterval(mtTimer); mtTimer = null; cancelAnimationFrame(mtRaf); mtQ = []; mtLight(-1); mtInfo(); }
  $('btnMt').onclick = function () { if (mtTimer) mtStop(); else mtStart(); };
  $('mtBpm').onchange = function () { $('mtBpm').value = mtBpm(); mtInfo(); saveTools(); };
  $('mtBeats').onchange = function () { mtBeat = 0; mtDots(); saveTools(); };
  $('btnTap').onclick = function () {
    var now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
    taps.push(now); if (taps.length > 6) taps.shift();
    if (taps.length < 2) { toast('چند بار دیگر بزن'); return; }
    var avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    $('mtBpm').value = Math.max(30, Math.min(240, Math.round(60000 / avg))); mtInfo(); saveTools();
  };
  var NOTE_NAMES = ['دو C', 'دو♯ C♯', 'ر D', 'ر♯ D♯', 'می E', 'فا F', 'فا♯ F♯', 'سل G', 'سل♯ G♯', 'لا A', 'لا♯ A♯', 'سی B'];
  NOTE_NAMES.forEach(function (n, i) { addOpt($('toneNote'), i, n); });
  for (var oc = 1; oc <= 6; oc++) addOpt($('toneOct'), oc, fa(oc));
  $('toneNote').value = 9; $('toneOct').value = 4;
  function toneFreq() { var A = +$('tuneMine').value || 440, midi = 12 * ((+$('toneOct').value) + 1) + (+$('toneNote').value); return A * Math.pow(2, (midi - 69) / 12); }
  function toneInfo() {
    var f = toneFreq(); $('toneInfo').textContent = fa(f.toFixed(1)).replace('.', '٫') + ' هرتز'; $('btnTone').textContent = toneNodes ? 'توقف نت مرجع' : 'پخش نت مرجع';
    if (toneNodes) toneNodes.o.frequency.setTargetAtTime(f, mtCtx.currentTime, 0.01);
  }
  function toneStart() {
    var ac = toolCtx(), o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = toneFreq();
    g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(Math.max(0.002, toolGain() * 0.5), ac.currentTime + 0.05);
    o.connect(g); g.connect(ac.destination); o.start(); toneNodes = { o: o, g: g }; toneInfo();
  }
  function toneStop() {
    if (!toneNodes) return;
    var t = mtCtx.currentTime, n = toneNodes; n.g.gain.cancelScheduledValues(t); n.g.gain.setTargetAtTime(0.0001, t, 0.03);
    setTimeout(function () { try { n.o.stop(); } catch (e) {} }, 250); toneNodes = null; toneInfo();
  }
  $('btnTone').onclick = function () { if (toneNodes) toneStop(); else toneStart(); };
  ['toneNote', 'toneOct', 'tuneMine'].forEach(function (id) { $(id).addEventListener('change', function () { toneInfo(); saveTools(); }); });
  $('toolVol').oninput = function () {
    $('toolVolVal').textContent = fa(this.value) + '٪';
    if (toneNodes) toneNodes.g.gain.setTargetAtTime(Math.max(0.002, toolGain() * 0.5), mtCtx.currentTime, 0.02);
  };
  $('toolVol').onchange = saveTools;
  function saveTools() { setPref('acc_tools', JSON.stringify({ bpm: mtBpm(), beats: mtBeats(), vol: +$('toolVol').value, note: +$('toneNote').value, oct: +$('toneOct').value })); }
  (function () {
    try {
      var p = JSON.parse(getPref('acc_tools', '{}'));
      if (p.bpm >= 30 && p.bpm <= 240) $('mtBpm').value = p.bpm;
      if ([1, 2, 3, 4, 6].indexOf(p.beats) >= 0) $('mtBeats').value = p.beats;
      if (p.vol >= 10 && p.vol <= 100) $('toolVol').value = p.vol;
      if (p.note >= 0 && p.note < 12) $('toneNote').value = p.note;
      if (p.oct >= 1 && p.oct <= 6) $('toneOct').value = p.oct;
    } catch (e) {}
    $('toolVolVal').textContent = fa($('toolVol').value) + '٪'; mtDots(); mtInfo(); toneInfo();
  })();
  function stopTools() { mtStop(); toneStop(); }

  // ---------- stage mode (full-screen score) ----------
  var stageOn = false, prevZoom = '100';
  function enterStage() {
    if (!pdfDoc || stageOn) return;
    stageOn = true; prevZoom = $('scoreZoom').value; $('scoreZoom').value = 'page';
    $('cardScore').classList.add('is-stage'); document.body.classList.add('is-stage');
    $('btnStageTxt').textContent = 'خروج'; $('scoreWrap').scrollTo(0, 0); renderPage(); $('btnStage').focus({ preventScroll: true });
  }
  function exitStage() {
    if (!stageOn) return;
    stageOn = false; $('scoreZoom').value = prevZoom;
    $('cardScore').classList.remove('is-stage'); document.body.classList.remove('is-stage');
    $('btnStageTxt').textContent = 'تمام‌صفحه'; renderPage(); $('btnStage').focus({ preventScroll: true });
  }
  $('btnStage').onclick = function () { if (stageOn) exitStage(); else enterStage(); };
  (function () {
    var w = $('scoreWrap'), s = null;
    w.addEventListener('pointerdown', function (e) { s = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    w.addEventListener('pointerup', function (e) {
      if (!s || !stageOn || isOn($('inkOn'))) { s = null; return; }
      var moved = Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y), quick = Date.now() - s.t < 500; s = null;
      if (moved > 10 || !quick) return;
      var r = w.getBoundingClientRect(), rel = (e.clientX - r.left) / r.width;
      if (rel > 0.6) showPage(pageNum + 1); else if (rel < 0.4) showPage(pageNum - 1);
    });
  })();

  // ---------- annotations on the score (stored on this device) ----------
  var ink = {}, pdfKey = '', inkTool = 'pen', curStroke = null, inkSaveT = null;
  function inkCv() { return $('ink'); }
  function loadInk() { ink = {}; try { var o = JSON.parse(getPref('acc_ink_' + pdfKey, '{}')); if (o && typeof o === 'object') ink = o; } catch (e) {} }
  function saveInk() {
    clearTimeout(inkSaveT);
    inkSaveT = setTimeout(function () {
      var s = JSON.stringify(ink);
      if (s.length > 900000) { toast('جای ذخیرۀ یادداشت پر شد'); return; }
      if (s === '{}' || !Object.keys(ink).some(function (k) { return ink[k].length; })) delPref('acc_ink_' + pdfKey); else setPref('acc_ink_' + pdfKey, s);
    }, 400);
  }
  function drawInk() {
    var c = inkCv(), x = c.getContext('2d'), W = c.width, H = c.height;
    x.clearRect(0, 0, W, H); x.lineCap = 'round'; x.lineJoin = 'round';
    ((ink[pageNum] || []).concat(curStroke ? [curStroke] : [])).forEach(function (st) {
      var p = st.p; if (!p.length) return;
      x.strokeStyle = st.c; x.globalAlpha = st.k === 'h' ? 0.35 : 1; x.lineWidth = Math.max(1, st.w * W);
      x.beginPath(); x.moveTo(p[0] * W, p[1] * H);
      if (p.length === 2) x.lineTo(p[0] * W + 0.1, p[1] * H);
      for (var i = 2; i < p.length; i += 2) x.lineTo(p[i] * W, p[i + 1] * H);
      x.stroke();
    });
    x.globalAlpha = 1;
  }
  function inkPt(e) { var r = inkCv().getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 10000) / 10000, Math.round((e.clientY - r.top) / r.height * 10000) / 10000]; }
  function inkErase(pt) {
    var list = ink[pageNum] || [], c = inkCv(), ry = 0.02 * c.width / c.height, rx = 0.02, hit = false;
    ink[pageNum] = list.filter(function (st) {
      for (var i = 0; i < st.p.length; i += 2) if (Math.abs(st.p[i] - pt[0]) < rx && Math.abs(st.p[i + 1] - pt[1]) < ry) { hit = true; return false; }
      return true;
    });
    if (hit) { drawInk(); saveInk(); }
  }
  (function () {
    var c = inkCv(), down = false;
    c.addEventListener('pointerdown', function (e) {
      if (!isOn($('inkOn'))) return;
      e.preventDefault(); down = true; try { c.setPointerCapture(e.pointerId); } catch (x) {}
      var pt = inkPt(e);
      if (inkTool === 'er') { inkErase(pt); return; }
      curStroke = { k: inkTool === 'hl' ? 'h' : 'p', c: $('inkColor').value, w: inkTool === 'hl' ? 0.018 : 0.0028, p: pt.slice() }; drawInk();
    });
    c.addEventListener('pointermove', function (e) {
      if (!down) return;
      var pt = inkPt(e);
      if (inkTool === 'er') { inkErase(pt); return; }
      if (!curStroke) return;
      var p = curStroke.p, dx = pt[0] - p[p.length - 2], dy = pt[1] - p[p.length - 1];
      if (dx * dx + dy * dy < 0.0000025) return;
      p.push(pt[0], pt[1]); drawInk();
    });
    function end() {
      if (!down) return; down = false;
      if (curStroke) { (ink[pageNum] = ink[pageNum] || []).push(curStroke); curStroke = null; drawInk(); saveInk(); }
    }
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  })();
  $('inkOn').onclick = function () {
    var on = !isOn(this); setSwitch(this, on); $('inkTools').hidden = !on; inkCv().classList.toggle('is-on', on);
  };
  var setInkTool = initSeg($('inkTool'), 'pen', function (v) { inkTool = v; });
  $('inkUndo').onclick = function () { var l = ink[pageNum] || []; if (!l.length) { toast('چیزی برای واپس‌گرد نیست'); return; } l.pop(); drawInk(); saveInk(); };
  $('inkClear').onclick = function () {
    if (!(ink[pageNum] || []).length) { toast('این صفحه یادداشتی ندارد'); return; }
    confirmDialog({ title: 'یادداشت‌های این صفحه پاک شود؟', text: 'همۀ نوشته‌ها و علامت‌های همین صفحه پاک می‌شوند.', confirm: 'پاک کن', cancel: 'نگه دار', danger: true }).then(function (yes) { if (!yes) return; ink[pageNum] = []; drawInk(); saveInk(); toast('یادداشت‌های صفحه پاک شد'); });
  };

  // ---------- practice log (this device only) ----------
  var LOGK = 'acc_log', playStart = 0;
  function logLoad() { try { var o = JSON.parse(getPref(LOGK, '{}')); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function logFlush() {
    if (!playStart) return;
    var now = Date.now(), sec = (now - playStart) / 1000; playStart = now;
    if (sec <= 0 || sec > 10800) return;
    var L = logLoad(), k = dayKey(), d = L[k] || (L[k] = { t: 0, p: {} }), name = result ? result.name : '—';
    d.t = Math.round((d.t + sec) * 10) / 10; d.p[name] = Math.round(((d.p[name] || 0) + sec) * 10) / 10;
    Object.keys(L).sort().slice(0, Math.max(0, Object.keys(L).length - 400)).forEach(function (x) { delete L[x]; });
    setPref(LOGK, JSON.stringify(L));
  }
  audio.addEventListener('play', function () { playStart = Date.now(); });
  audio.addEventListener('pause', function () { logFlush(); playStart = 0; });
  audio.addEventListener('ended', function () { logFlush(); playStart = 0; });
  setInterval(function () { if (playStart) { logFlush(); if (!$('view-settings').hidden) renderLog(); } }, 10000);
  window.addEventListener('pagehide', function () { logFlush(); playStart = 0; });
  function fmtDur(sec) {
    sec = Math.round(sec); if (sec <= 0) return '۰'; if (sec < 60) return 'کمتر از ۱ دقیقه';
    var m = Math.round(sec / 60), h = Math.floor(m / 60); m = m % 60;
    return h ? fa(h) + ' ساعت' + (m ? ' و ' + fa(m) + ' دقیقه' : '') : fa(m) + ' دقیقه';
  }
  function renderLog() {
    var L = logLoad(), today = new Date(), days = [], i, d, k;
    for (i = 6; i >= 0; i--) { d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i); k = dayKey(d); days.push({ d: d, k: k, t: (L[k] && L[k].t) || 0 }); }
    var week = days.reduce(function (a, x) { return a + x.t; }, 0), max = Math.max.apply(null, days.map(function (x) { return x.t; }).concat([60]));
    var streak = 0, off = days[6].t >= 60 ? 0 : 1;
    for (i = 0; i < 400; i++) { d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - off - i); k = dayKey(d); if (L[k] && L[k].t >= 60) streak++; else break; }
    function mins(s) { return fa(s > 0 ? Math.max(1, Math.round(s / 60)) : 0); }
    $('logToday').textContent = mins(days[6].t); $('logWeek').textContent = mins(week); $('logStreak').textContent = fa(streak);
    $('logBars').innerHTML = ''; $('logBars').setAttribute('aria-label', 'تمرین هفت روز اخیر: ' + fmtDur(week));
    days.forEach(function (x) {
      var c = document.createElement('div'), b = document.createElement('i'), l = document.createElement('span');
      b.style.height = Math.max(3, Math.round(x.t / max * 64)) + 'px'; if (!x.t) b.style.opacity = '.25';
      l.textContent = x.d.toLocaleDateString('fa-IR', { weekday: 'short' }); c.title = fmtDur(x.t); c.appendChild(b); c.appendChild(l); $('logBars').appendChild(c);
    });
    var agg = {}; Object.keys(L).sort().slice(-30).forEach(function (kk) { var p = L[kk].p || {}; Object.keys(p).forEach(function (n) { agg[n] = (agg[n] || 0) + p[n]; }); });
    var top = Object.keys(agg).sort(function (a, b) { return agg[b] - agg[a]; }).slice(0, 5);
    $('logList').innerHTML = '';
    top.forEach(function (n) { var li = document.createElement('li'), a = document.createElement('span'), t = document.createElement('span'); a.textContent = n; t.textContent = fmtDur(agg[n]); li.appendChild(a); li.appendChild(t); $('logList').appendChild(li); });
    $('logCsv').disabled = $('logClear').disabled = !Object.keys(L).length;
  }
  $('logCsv').onclick = function () {
    var L = logLoad(), rows = ['date,piece,seconds'];
    Object.keys(L).sort().forEach(function (k) { var p = L[k].p || {}; Object.keys(p).forEach(function (n) { rows.push(k + ',"' + n.replace(/"/g, '""') + '",' + Math.round(p[n])); }); });
    save(new Blob(['﻿' + rows.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' }), 'practice-log.csv');
  };
  $('logClear').onclick = function () {
    confirmDialog({ title: 'دفتر تمرین پاک شود؟', text: 'زمان‌های ثبت‌شدۀ این دستگاه پاک می‌شوند و برنمی‌گردند.', confirm: 'پاک کن', cancel: 'نگه دار', danger: true }).then(function (yes) { if (!yes) return; delPref(LOGK); renderLog(); toast('دفتر تمرین پاک شد'); });
  };
  renderLog();

  (function tick() {
    if (result && !audio.paused && loopA != null && loopB != null && cur() >= loopB) {
      onLoopWrap();
      if (isOn($('ciOn'))) { audio.pause(); setCur(loopA); togglePlay(); } else setCur(loopA);
    }
    if (result && !$('view-task').hidden) { $('tCur').textContent = fmt(cur()); draw(); if (pdfDoc) { $('tCur2').textContent = fmt(cur()); autoTurn(); } }
    requestAnimationFrame(tick);
  })();

  document.addEventListener('keydown', function (e) {
    if (!result || dialogOpen() || $('view-task').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target.tagName;
    if ((tag === 'INPUT' && e.target.type !== 'range') || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape' && stageOn) { e.preventDefault(); exitStage(); return; }
    if (pdfDoc) {
      var nx = e.key === 'PageDown' || (stageOn && (e.key === 'ArrowRight' || e.key === 'ArrowDown')), pv = e.key === 'PageUp' || (stageOn && (e.key === 'ArrowLeft' || e.key === 'ArrowUp'));
      if (nx) { e.preventDefault(); showPage(pageNum + 1); return; }
      if (pv) { e.preventDefault(); showPage(pageNum - 1); return; }
    }
    if (e.code === 'Space' && tag !== 'BUTTON') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowLeft' && tag !== 'INPUT') { e.preventDefault(); seek(-5); }
    else if (e.key === 'ArrowRight' && tag !== 'INPUT') { e.preventDefault(); seek(5); }
    else if (e.key === '[') setA();
    else if (e.key === ']') setB();
    else if (e.key === 'm' || e.key === 'M') addMark();
  });
  $('btnAnother').onclick = function () { $('cardInput').scrollIntoView({ behavior: 'smooth', block: 'start' }); drop.focus({ preventScroll: true }); };

  // ---------- downloads ----------
  function save(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    toast('دانلود شروع شد');
  }
  function dlBusy(on, msg) { ['dlMp3', 'dlWav', 'dlSolo'].forEach(function (id) { $(id).disabled = on; }); $('dlMsg').textContent = msg || ''; if (on) clearAlert('dlAlert'); }
  function dlFail(e) { dlBusy(false); showAlert('dlAlert', 'error', 'خطا:', e.message + ' دوباره امتحان کنید.'); }
  function suffix() { var g = +$('guide').value; return g ? '_accompaniment+guide' + g : '_accompaniment'; }
  $('dlWav').onclick = function () {
    var mixed = AccCore.mixGuide(result.acc, result.solo, $('guide').value / 100);
    save(new Blob([AccCore.encodeWav(mixed, SR)], { type: 'audio/wav' }), result.name + suffix() + '.wav');
  };
  $('dlMp3').onclick = function () {
    var mixed = AccCore.mixGuide(result.acc, result.solo, $('guide').value / 100);
    dlBusy(true, 'ساختن MP3…');
    mp3(mixed[0], mixed[1], 256, function (p) { $('dlMsg').textContent = 'ساختن MP3… ' + fa(Math.round(p * 100)) + '٪'; })
      .then(function (b) { dlBusy(false); save(b, result.name + suffix() + '.mp3'); }, dlFail);
  };
  $('dlSolo').onclick = function () {
    dlBusy(true, 'ساختن MP3…');
    mp3(result.solo[0], result.solo[0], 192, function (p) { $('dlMsg').textContent = 'ساختن MP3… ' + fa(Math.round(p * 100)) + '٪'; })
      .then(function (b) { dlBusy(false); save(b, result.name + '_solo.mp3'); }, dlFail);
  };
  window.__app = { showView: showView, version: APP_VERSION, audio: audio };
})();
