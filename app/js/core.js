/* Rdzeń: przestrzeń nazw, narzędzia, budowanie DOM, elementy interfejsu. Bez zależności. */
(function () {
  'use strict';
  var P = window.PPOZ = window.PPOZ || {};
  P.views = {};

  /* ---------- narzędzia ---------- */
  var DAY = 86400000;
  var U = P.util = {
    pad: function (n) { return n < 10 ? '0' + n : '' + n; },
    /* Dzień jako 'RRRR-MM-DD' w czasie lokalnym. */
    iso: function (d) { d = d || new Date(); return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); },
    today: function () { return U.iso(new Date()); },
    parse: function (iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); },
    addDays: function (iso, n) { var d = U.parse(iso); d.setDate(d.getDate() + n); return U.iso(d); },
    /* Liczba dni od a do b (b - a). */
    diffDays: function (a, b) { return Math.round((U.parse(b) - U.parse(a)) / DAY); },
    /* Numer dnia (liczba całkowita) — używany w terminach powtórek. */
    dayNum: function (iso) { var d = U.parse(iso || U.today()); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); },
    dayFromNum: function (n) { var d = new Date(n * DAY); return d.getUTCFullYear() + '-' + U.pad(d.getUTCMonth() + 1) + '-' + U.pad(d.getUTCDate()); },
    monday: function (iso) { var d = U.parse(iso); var w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return U.iso(d); },
    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
    shuffle: function (arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    sum: function (arr, f) { var s = 0; for (var i = 0; i < arr.length; i++) s += f ? f(arr[i]) : arr[i]; return s; },
    groupBy: function (arr, f) { var m = {}; arr.forEach(function (x) { var k = f(x); (m[k] = m[k] || []).push(x); }); return m; },
    clone: function (o) { return JSON.parse(JSON.stringify(o)); },
    debounce: function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  };
  var MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  var DOW = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  P.fmt = {
    date: function (iso) { var d = U.parse(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); },
    dm: function (iso) { var d = U.parse(iso); return U.pad(d.getDate()) + '.' + U.pad(d.getMonth() + 1); },
    range: function (a, b) { return P.fmt.dm(a) + '–' + P.fmt.dm(b) + '.' + U.parse(b).getFullYear(); },
    dow: function (iso) { return DOW[U.parse(iso).getDay()]; },
    pct: function (v) { return isFinite(v) ? Math.round(v * 100) + '%' : '–'; },
    mins: function (m) { m = Math.round(m); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + m % 60 + ' min' : ''); },
    /* Odmiana: plural(5, 'pytanie', 'pytania', 'pytań') */
    plural: function (n, one, few, many) { var a = Math.abs(n) % 100, b = a % 10; return n + ' ' + (n === 1 ? one : (b >= 2 && b <= 4 && !(a >= 12 && a <= 14) ? few : many)); },
    signed: function (n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }
  };

  /* ---------- DOM ---------- */
  /* h('div.card', {onclick: fn, title: 'x'}, 'tekst', węzeł, [tablica]) — treść zawsze jako tekst (bez innerHTML). */
  function h(tag, attrs) {
    var parts = String(tag).split('.'), el = document.createElement(parts[0] || 'div'), i = 2;
    if (parts.length > 1) el.className = parts.slice(1).join(' ');
    if (attrs && typeof attrs === 'object' && !attrs.nodeType && !Array.isArray(attrs)) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    } else i = 1;
    for (; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false || c === true) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  P.h = h;
  P.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  var ICONS = {
    dzis: 'M4 11.5 12 4l8 7.5V20h-5v-5H9v5H4z', plan: 'M5 5h14v15H5zM5 9h14M9 3v4M15 3v4', nauka: 'M4 5h7a3 3 0 0 1 1 2 3 3 0 0 1 1-2h7v14h-7a2 2 0 0 0-1 1 2 2 0 0 0-1-1H4zM12 7v13',
    pytania: 'M5 4h14v12H9l-4 4zM9 8h6M9 12h4', fiszki: 'M7 7h12v12H7zM4 16V4h12', egzamin: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    zrodla: 'M6 3h9l3 3v15H6zM14 3v4h4M9 11h6M9 15h6', statystyki: 'M4 20V10M10 20V4M16 20v-8M21 20H3', ustawienia: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
    metoda: 'M12 3a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11zM9 21h6', ustna: 'M4 20V7l8-4 8 4v13M2 20h20M9 20v-5h6v5M8 10h2M14 10h2', wiecej: 'M5 12h.01M12 12h.01M19 12h.01', ok: 'M5 12.5 10 17 19 7', x: 'M6 6l12 12M18 6 6 18',
    flag: 'M6 21V4h11l-2 4 2 4H6', link: 'M10 14 20 4M14 4h6v6M18 14v6H4V6h6', sync: 'M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5', warn: 'M12 4 2 20h20zM12 10v5M12 17.5v.01'
  };
  P.icon = function (name) {
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '20'); s.setAttribute('height', '20'); s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', ICONS[name] || ICONS.wiecej); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.8'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p); return s;
  };

  /* ---------- elementy interfejsu ---------- */
  var ui = P.ui = {};
  ui.chip = function (text, kind) { return h('span.chip' + (kind ? '.' + kind : ''), text); };
  ui.ref = function (text) { return h('span.ref', text); };
  ui.bar = function (value, kind) { var i = h('i'); i.style.width = Math.round(U.clamp(value || 0, 0, 1) * 100) + '%'; return h('div.bar' + (kind ? '.' + kind : ''), { role: 'progressbar', 'aria-valuenow': Math.round((value || 0) * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 }, i); };
  ui.stat = function (value, label) { return h('div.stat', h('b', value), h('span', label)); };
  ui.banner = function (kind, title, text) { return h('div.banner' + (kind ? '.' + kind : ''), h('div.stack.tight', title ? h('b', title) : null, text ? h('span', text) : null)); };
  ui.empty = function (text, action) { return h('div.empty', h('p', text), action ? h('div', { style: { marginTop: '12px' } }, action) : null); };
  ui.btn = function (label, onClick, cls) { return h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { type: 'button', onclick: onClick }, label); };
  ui.field = function (label, control, hint) { return h('label.field', h('span', label), control, hint ? h('span.tiny.muted', { style: { fontWeight: 400 } }, hint) : null); };
  ui.check = function (label, checked, onChange, sub) {
    var inp = h('input', { type: 'checkbox', checked: !!checked, onchange: function () { onChange(inp.checked); } });
    return h('label.check', inp, h('span.stack.tight', h('span', label), sub ? h('span.small.muted', sub) : null));
  };
  /* Przełącznik segmentowy: options = [{value, label}] */
  ui.seg = function (options, value, onChange) {
    var el = h('div.seg', { role: 'group' });
    options.forEach(function (o) {
      el.appendChild(h('button', { type: 'button', 'aria-pressed': String(o.value === value), onclick: function () {
        Array.prototype.forEach.call(el.children, function (b) { b.setAttribute('aria-pressed', 'false'); });
        this.setAttribute('aria-pressed', 'true'); onChange(o.value);
      } }, o.label));
    });
    return el;
  };
  ui.select = function (options, value, onChange, attrs) {
    var s = h('select.input', attrs || {});
    options.forEach(function (o) { s.appendChild(h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)); });
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  };
  /* Skala punktów egzaminu: zakres −max..+max, próg zaliczenia `pass`. */
  ui.scale = function (points, max, pass) {
    max = max || 40; pass = pass == null ? 21 : pass;
    var pos = function (v) { return ((U.clamp(v, -max, max) + max) / (2 * max) * 100) + '%'; };
    var track = h('div.track'), pl = h('div.pass'), mark = h('div.mark');
    track.style.background = 'linear-gradient(90deg, var(--bad-soft) 0 ' + pos(pass) + ', var(--ok-soft) ' + pos(pass) + ' 100%)';
    pl.style.left = pos(pass); mark.style.left = pos(points);
    return h('div.scale', { role: 'img', 'aria-label': 'Wynik ' + points + ' pkt, próg ' + pass + ' pkt' }, track, pl, mark);
  };
  ui.toast = function (msg) {
    var box = document.querySelector('.toasts') || document.body.appendChild(h('div.toasts', { 'aria-live': 'polite' }));
    var t = box.appendChild(h('div.toast', msg));
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  };
  /* Okno dialogowe. opts: {title, body: węzeł|tekst, actions: [{label, cls, onClick(close) }], onClose}. Zwraca funkcję zamykającą. */
  ui.modal = function (opts) {
    var prev = document.activeElement;
    var back = h('div.modal-back', { onclick: function (e) { if (e.target === back) close(); } });
    function close() { if (back.parentNode) back.parentNode.removeChild(back); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); if (prev && prev.focus) prev.focus(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    var actions = (opts.actions || [{ label: 'Zamknij' }]).map(function (a) {
      return ui.btn(a.label, function () { if (a.onClick) { if (a.onClick(close) === false) return; } close(); }, a.cls || '');
    });
    var box = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '' },
      opts.title ? h('h2', opts.title) : null, typeof opts.body === 'string' ? h('p', opts.body) : opts.body, h('div.row.end', actions));
    back.appendChild(box); document.body.appendChild(back); document.addEventListener('keydown', onKey);
    var f = box.querySelector('input, select, textarea, button'); if (f) f.focus();
    return close;
  };
  /* Zamiast window.confirm (niedostępne w artefaktach). Zwraca Promise<boolean>. */
  ui.confirm = function (title, text, yes, danger) {
    return new Promise(function (resolve) {
      var done = false;
      ui.modal({ title: title, body: text || '', onClose: function () { if (!done) resolve(false); },
        actions: [{ label: 'Anuluj' }, { label: yes || 'Potwierdź', cls: danger ? 'bad' : 'primary', onClick: function () { done = true; resolve(true); } }] });
    });
  };
  /* Prosty tekst z akapitami i listami: linie zaczynające się od "- " tworzą listę. Zwraca fragment węzłów. */
  ui.rich = function (text) {
    var wrap = h('div.prose'), list = null;
    String(text || '').split(/\n+/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      if (/^[-•]\s+/.test(line)) { if (!list) { list = h('ul'); wrap.appendChild(list); } list.appendChild(h('li', line.replace(/^[-•]\s+/, ''))); }
      else { list = null; wrap.appendChild(h('p', line)); }
    });
    return wrap;
  };
  ui.table = function (head, rows, numCols) {
    numCols = numCols || [];
    var t = h('table.table');
    if (head && head.length) t.appendChild(h('thead', h('tr', head.map(function (x, i) { return h('th' + (numCols.indexOf(i) >= 0 ? '.num' : ''), x); }))));
    t.appendChild(h('tbody', rows.map(function (r) { return h('tr', r.map(function (c, i) { return h('td' + (numCols.indexOf(i) >= 0 ? '.num' : ''), c); })); })));
    return h('div.scroll-x', t);
  };
  /* Zapis pliku: w artefakcie przez uprawnienie `downloads`, poza nim zwykłe pobranie; w ostateczności okno z tekstem do skopiowania. */
  ui.saveFile = function (filename, text, mime) {
    function fallback() {
      var ta = h('textarea.input', { rows: 10, readOnly: true }); ta.value = text;
      ui.modal({ title: 'Skopiuj zawartość pliku ' + filename, body: h('div.stack', h('p.small.muted', 'Zapis pliku nie jest tu dostępny. Skopiuj tekst i zapisz go samodzielnie.'), ta),
        actions: [{ label: 'Kopiuj', cls: 'primary', onClick: function () { ta.select(); try { navigator.clipboard.writeText(text).then(function () { ui.toast('Skopiowano'); }, function () {}); } catch (e) { /* zaznaczone do ręcznego skopiowania */ } return false; } }, { label: 'Zamknij' }] });
    }
    var use = window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null);
    return use.then(function (dl) {
      if (dl) return dl.save({ filename: filename, data: new Blob([text], { type: mime || 'text/plain' }) }).then(function () { ui.toast('Zapisano ' + filename); }, fallback);
      if (window.claude) return fallback();
      var a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' })), download: filename });
      document.body.appendChild(a); a.click(); a.remove(); ui.toast('Pobrano ' + filename);
    }, fallback);
  };
})();
