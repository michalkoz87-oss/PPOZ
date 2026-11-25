/* Pamięć postępu. Zawsze zapisuje lokalnie (localStorage); w artefakcie Claude dodatkowo synchronizuje
   z prywatnym magazynem użytkownika (db: data/users/<id>/<dokument>), dzięki czemu postęp jest wspólny dla telefonu i komputera.
   Dokumenty: settings, plan, srs, log, notes. Scalanie między urządzeniami jest pozycyjne (nowszy wpis wygrywa). */
(function () {
  'use strict';
  var P = window.PPOZ, U = P.util;
  var LS = 'ppoz:v1:', DOCS = ['settings', 'plan', 'srs', 'log', 'notes'];
  var DEFAULTS = {
    settings: function () { return { u: 0, start: null, exam: null, preset: '26', hours: 4, newQ: 15, newF: 15, cap: 60, reserve: true, theme: 'auto', intro: false }; },
    plan: function () { return { tasks: {}, reads: {}, lessons: {}, sheets: {} }; },
    srs: function () { return { q: {}, f: {} }; },
    log: function () { return { days: {}, sessions: [], calib: { sure: [0, 0], unsure: [0, 0] } }; },
    notes: function () { return { over: {}, flags: {}, qnotes: {}, customQ: [], customF: [], doubts: [] }; }
  };
  var mem = {}, listeners = [], cloud = null, state = { mode: 'local', pending: 0, lastSync: 0, error: '' };
  var timers = {}, inflight = {}, dirty = {};

  function lsGet(k) { try { var v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function fill(doc, name) { var d = DEFAULTS[name](); Object.keys(d).forEach(function (k) { if (doc[k] === undefined) doc[k] = d[k]; }); return doc; }
  function emit(what) { listeners.slice().forEach(function (fn) { try { fn(what); } catch (e) { console.error(e); } }); }

  /* --- scalanie --- */
  function absTs(v) { return Math.abs(typeof v === 'number' ? v : (v && (v.t || v[2])) || 0); }
  function mergeMap(a, b) { /* wartości: znacznik czasu (ujemny = cofnięte), tablica [.., .., ts] albo obiekt {t} */
    var out = {}; a = a || {}; b = b || {};
    Object.keys(a).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b).forEach(function (k) { if (!(k in out) || absTs(b[k]) > absTs(out[k])) out[k] = b[k]; });
    return out;
  }
  function mergeList(a, b, cap) { /* elementy z polem id; nowsze (t) wygrywają */
    var m = {}; (a || []).concat(b || []).forEach(function (x) { if (x && x.id && (!m[x.id] || (x.t || 0) > (m[x.id].t || 0))) m[x.id] = x; });
    var out = Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return (x.t || 0) - (y.t || 0); });
    return cap && out.length > cap ? out.slice(out.length - cap) : out;
  }
  var MERGE = {
    settings: function (a, b) { return (b.u || 0) > (a.u || 0) ? b : a; },
    plan: function (a, b) { return { u: Math.max(a.u || 0, b.u || 0), tasks: mergeMap(a.tasks, b.tasks), reads: mergeMap(a.reads, b.reads), lessons: mergeMap(a.lessons, b.lessons), sheets: mergeMap(a.sheets, b.sheets) }; },
    srs: function (a, b) { return { u: Math.max(a.u || 0, b.u || 0), q: mergeMap(a.q, b.q), f: mergeMap(a.f, b.f) }; },
    log: function (a, b) {
      var days = {}, ad = a.days || {}, bd = b.days || {};
      Object.keys(ad).concat(Object.keys(bd)).forEach(function (k) {
        var x = ad[k] || {}, y = bd[k] || {}, o = {};
        ['m', 'q', 'f', 'ok'].forEach(function (f) { o[f] = Math.max(x[f] || 0, y[f] || 0); }); days[k] = o;
      });
      var ca = a.calib || {}, cb = b.calib || {};
      function best(x, y) { x = x || [0, 0]; y = y || [0, 0]; return y[1] > x[1] ? y : x; }
      return { u: Math.max(a.u || 0, b.u || 0), days: days, sessions: mergeList(a.sessions, b.sessions, 400), calib: { sure: best(ca.sure, cb.sure), unsure: best(ca.unsure, cb.unsure) } };
    },
    notes: function (a, b) { return { u: Math.max(a.u || 0, b.u || 0), over: mergeMap(a.over, b.over), flags: mergeMap(a.flags, b.flags), qnotes: mergeMap(a.qnotes, b.qnotes), customQ: mergeList(a.customQ, b.customQ), customF: mergeList(a.customF, b.customF), doubts: mergeList(a.doubts, b.doubts) }; }
  };

  /* --- chmura (artefakt Claude) --- */
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej({ code: 'timeout' }); }, ms); })]); }
  function connect() {
    if (!(window.claude && typeof window.claude.use === 'function')) return Promise.resolve(false);
    return Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) return false;
      return user.id().then(function (uid) {
        if (!uid) return false;
        cloud = { ref: function (name) { return db.doc('data/users/' + uid + '/' + name); } };
        return pull().then(function () { state.mode = 'cloud'; emit('sync'); return true; });
      });
    }).catch(function (e) { state.error = (e && e.code) || 'unavailable'; cloud = null; emit('sync'); return false; });
  }
  function pull() {
    if (!cloud) return Promise.resolve();
    return Promise.all(DOCS.map(function (name) {
      return withTimeout(cloud.ref(name).get(), 12000).then(function (snap) {
        if (!snap.exists) { if ((mem[name].u || 0) > 0) queue(name, 0); return; }
        var remote = fill(U.clone(snap.data()), name), merged = MERGE[name](mem[name], remote);
        var changedLocal = JSON.stringify(merged) !== JSON.stringify(mem[name]);
        var changedRemote = JSON.stringify(merged) !== JSON.stringify(remote);
        mem[name] = fill(merged, name); if (changedLocal) lsSet(name, mem[name]);
        if (changedRemote) queue(name, 0);
        return changedLocal;
      });
    })).then(function (ch) { state.lastSync = Date.now(); state.error = ''; if (ch.some(Boolean)) emit('data'); else emit('sync'); });
  }
  function queue(name, ms) {
    if (!cloud) return;
    dirty[name] = true; state.pending = Object.keys(dirty).length; clearTimeout(timers[name]);
    timers[name] = setTimeout(function () { push(name); }, ms == null ? 2500 : ms);
  }
  function push(name) {
    if (!cloud || !dirty[name]) return Promise.resolve();
    if (inflight[name]) return inflight[name].then(function () { return push(name); });
    delete dirty[name];
    var body = U.clone(mem[name]);
    inflight[name] = cloud.ref(name).set(body).then(function () { state.lastSync = Date.now(); state.error = ''; }, function (e) {
      var code = (e && e.code) || 'unavailable';
      if (code === 'unavailable' || code === 'resource_exhausted') { dirty[name] = true; timers[name] = setTimeout(function () { push(name); }, 15000); }
      else { state.error = code; if (code === 'invalid_argument' || code === 'revoked' || code === 'not_granted') { cloud = null; state.mode = 'local'; } }
    }).then(function () { delete inflight[name]; state.pending = Object.keys(dirty).length; emit('sync'); });
    return inflight[name];
  }
  function flush() { Object.keys(dirty).forEach(function (n) { clearTimeout(timers[n]); push(n); }); }

  /* --- interfejs --- */
  var store = P.store = {
    /* Zwraca żywy obiekt dokumentu. Po zmianie wywołaj save(nazwa). */
    get: function (name) { return mem[name]; },
    save: function (name) { mem[name].u = Date.now(); lsSet(name, mem[name]); queue(name); emit('save'); },
    onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    status: function () { return { mode: state.mode, pending: state.pending, lastSync: state.lastSync, error: state.error, local: lsSet('_probe', 1) }; },
    syncNow: function () { flush(); return pull(); },
    exportAll: function () { var o = { app: 'ppoz-nauka', version: 1, exported: new Date().toISOString() }; DOCS.forEach(function (n) { o[n] = U.clone(mem[n]); }); return o; },
    /* Import kopii zapasowej; merge=true scala z obecnym postępem, false zastępuje. */
    importAll: function (obj, merge) {
      if (!obj || obj.app !== 'ppoz-nauka') throw new Error('To nie jest kopia zapasowa tej aplikacji.');
      DOCS.forEach(function (n) {
        if (!obj[n]) return;
        var inc = fill(U.clone(obj[n]), n);
        mem[n] = fill(merge ? MERGE[n](mem[n], inc) : inc, n); mem[n].u = Date.now(); lsSet(n, mem[n]); queue(n, 0);
      });
      emit('data');
    },
    resetAll: function () { DOCS.forEach(function (n) { var keep = n === 'settings' ? mem[n] : null; mem[n] = DEFAULTS[n](); if (keep) { mem[n] = keep; } mem[n].u = Date.now(); lsSet(n, mem[n]); queue(n, 0); }); emit('data'); }
  };
  DOCS.forEach(function (n) { mem[n] = fill(lsGet(n) || {}, n); });
  store.ready = connect();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); else if (cloud) pull().catch(function () {}); });
  window.addEventListener('pagehide', flush);
})();
