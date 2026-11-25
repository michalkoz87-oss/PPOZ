/* Widok „Statystyki”: gotowość do egzaminu, wykres egzaminów próbnych, tematy od najsłabszego,
   kalibracja pewności, aktywność z 12 tygodni i ostatnie sesje. Widok tylko czyta postęp — niczego nie zapisuje. */
(function () {
  'use strict';
  const P = window.PPOZ, h = P.h, ui = P.ui, U = P.util, F = P.fmt;
  const NS = 'http://www.w3.org/2000/svg';
  const GOAL = 26;        /* cel na próbach: próg 21 pkt z zapasem */
  const MAX_POINTS = 30;  /* tyle ostatnich prób mieści wykres */
  const MIN_RATED = 5;    /* od tylu odpowiedzi temat trafia do rankingu trafności */
  const MIN_CALIB = 10;   /* od tylu odpowiedzi w grupie pojawia się wniosek z kalibracji */
  const DOW = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];
  const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const KINDS = { quiz: 'Pytania', powtorka: 'Powtórka', egzamin: 'Egzamin próbny', fiszki: 'Fiszki', czytanie: 'Czytanie', inne: 'Inne' };
  let observer = null;

  /* ---------- pomocnicze ---------- */
  function svg(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c != null) el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
    return el;
  }
  function num(n) { return (n < 0 ? '−' : '') + Math.abs(n); }
  function pts(n) { return num(n) + ' pkt'; }
  function ratio(a, b) { return b > 0 ? a / b : 0; }
  function fullDate(iso) { return F.dm(iso) + '.' + String(iso).slice(0, 4); }
  function dec(v) { return String(Math.round(v * 10) / 10).replace('.', ',').replace('-', '−'); }
  function qWord(n) { return F.plural(n, 'pytanie', 'pytania', 'pytań'); }
  function card(title, aside, sub) {
    const el = h('section.card', h('div.card-head', h('h2', title), aside || null));
    if (sub) el.appendChild(h('p.small.muted', sub));
    return el;
  }
  /* Pasek z kreską celu: wartość i cel w zakresie 0–1. */
  function meter(label, value, target, text) {
    const tick = h('i.st-target', { 'aria-hidden': 'true' });
    tick.style.left = Math.round(target * 100) + '%';
    return h('div.st-meter',
      h('div.row.between.small', h('span', label), h('span.num', (text || F.pct(value)) + ' · cel ' + F.pct(target))),
      h('div.st-meter-track', ui.bar(value, value >= target ? 'ok' : ''), tick));
  }
  /* Pełne próby egzaminu (co najmniej 40 pytań), od najstarszej. */
  function examList() {
    return P.log.sessions('egzamin').filter(function (s) { return (s.n || 0) >= 40 && typeof s.points === 'number'; })
      .sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
  }
  function examWhat(s) { return s.sheet ? 'arkusz ' + s.sheet : (s.label || 'egzamin próbny'); }
  function tone(points) { return points >= GOAL ? 'ok' : points >= 21 ? 'warn' : 'bad'; }
  function practice(opts) {
    if (P.practice && typeof P.practice.start === 'function') P.practice.start(opts);
    else P.router.go('pytania', 'sesja', opts);
  }

  /* ---------- 1. gotowość do egzaminu ---------- */
  function criteria() {
    const out = [];

    const last = examList().slice(-3);
    const plates = h('div.st-plates', { role: 'img', 'aria-label': last.length ? 'Punkty ostatnich prób, od najstarszej: ' + last.map(function (s) { return num(s.points); }).join(', ') : 'Brak prób' });
    for (let i = 0; i < 3; i++) plates.appendChild(last[i] ? h('span.st-plate.' + tone(last[i].points), num(last[i].points)) : h('span.st-plate.none', '–'));
    const low = last.length ? Math.min.apply(null, last.map(function (s) { return s.points; })) : 0;
    out.push({
      title: 'Trzy ostatnie egzaminy próbne po co najmniej ' + GOAL + ' pkt',
      met: last.length === 3 && low >= GOAL,
      detail: !last.length ? 'Nie masz jeszcze żadnej próby na pełnym arkuszu.'
        : last.length < 3 ? 'Masz ' + F.plural(last.length, 'próbę', 'próby', 'prób') + ' z trzech potrzebnych.'
          : low >= GOAL ? 'Najsłabszy z trzech wyników: ' + pts(low) + '.'
            : 'Najsłabszy z trzech wyników: ' + pts(low) + ', do celu brakuje ' + (GOAL - low) + ' pkt.',
      body: plates
    });

    const pool = P.q.pool({});
    const sq = P.srs.summary('q', pool.map(function (q) { return q.id; }));
    const seen = ratio(sq.total - sq.fresh, sq.total), mature = ratio(sq.mature, sq.total);
    const errors = P.q.pool({ state: 'errors', reserved: true }).length;
    out.push({
      title: 'Pula błędów poniżej 30 pytań',
      met: errors < 30 && seen >= 0.8,
      detail: 'W puli: ' + qWord(errors) + '. ' + (seen >= 0.8
        ? 'To pytania z błędną odpowiedzią, które nie wróciły jeszcze do dłuższych odstępów powtórek.'
        : 'Kryterium liczy się dopiero po przerobieniu 80% pytań, bo wcześniej mała pula niczego nie dowodzi.')
    });

    const skipped = P.q.all().length - pool.length;
    out.push({
      title: 'Pytania: co najmniej 80% przerobionych i 60% utrwalonych',
      met: sq.total > 0 && seen >= 0.8 && mature >= 0.6,
      detail: 'Liczone z ' + sq.total + (sq.total === 1 ? ' pytania dostępnego' : ' pytań dostępnych') + ' w nauce' + (skipped > 0 ? ' (bez arkuszy zarezerwowanych na próby generalne i pytań bez klucza).' : '.'),
      body: h('div.st-meters', meter('Przerobione', seen, 0.8), meter('Utrwalone', mature, 0.6))
    });

    const sf = P.srs.summary('f', P.cards.all().map(function (c) { return c.id; }));
    const matF = ratio(sf.mature, sf.total);
    out.push({
      title: 'Fiszki: brak zaległych i co najmniej 70% utrwalonych',
      met: sf.total > 0 && sf.due === 0 && matF >= 0.7,
      detail: sf.due ? 'Zaległe na dziś: ' + F.plural(sf.due, 'fiszka', 'fiszki', 'fiszek') + '.' : 'Nie ma zaległych fiszek.',
      body: h('div.st-meters', meter('Utrwalone', matF, 0.7))
    });

    const idx = P.plan.index();
    let done = 0, total = 0;
    P.plan.calWeeks().forEach(function (cw) {
      if (cw.i > idx) return;
      cw.weeks.forEach(function (w) { if (w) P.plan.tasks(w).forEach(function (t) { total++; if (t.done) done++; }); });
    });
    out.push({
      title: 'Zadania planu do bieżącego tygodnia wykonane w co najmniej 80%',
      met: total > 0 && done / total >= 0.8,
      detail: total ? null : 'Plan zaczyna się ' + F.date(P.plan.start()) + '.',
      body: total ? h('div.st-meters', meter('Wykonane zadania', done / total, 0.8, done + ' z ' + total)) : null
    });
    return out;
  }
  function examLine() {
    const ex = P.settings().exam;
    if (!ex) return h('p.small.muted', 'Data egzaminu nie jest ustawiona. ', h('a', { href: '#ustawienia' }, 'Wpisz ją w ustawieniach'), ', gdy ją poznasz.');
    const d = U.diffDays(U.today(), ex);
    const few = d % 10 >= 2 && d % 10 <= 4 && !(d % 100 >= 12 && d % 100 <= 14);
    return h('p.small.muted', d > 0 ? 'Do egzaminu ' + (d === 1 ? 'został ' : few ? 'zostały ' : 'zostało ') + F.plural(d, 'dzień', 'dni', 'dni') + ' (' + F.date(ex) + ').'
      : d === 0 ? 'Egzamin jest dziś.' : 'Ustawiona data egzaminu już minęła (' + F.date(ex) + ').');
  }
  function readinessCard() {
    const list = criteria(), met = list.filter(function (c) { return c.met; }).length;
    const el = card('Gotowość do egzaminu', ui.chip(met + ' z ' + list.length + ' kryteriów', met === list.length ? 'ok' : ''),
      met === list.length ? 'Wszystkie kryteria są spełnione: materiał jest opanowany z zapasem ponad próg 21 pkt.'
        : 'Pięć kryteriów, które razem oznaczają opanowanie materiału z zapasem ponad próg 21 pkt.');
    el.appendChild(h('ul.st-crits', list.map(function (c) {
      return h('li.st-crit' + (c.met ? '.met' : ''),
        h('span.st-mark', { 'aria-hidden': 'true' }, c.met ? P.icon('ok') : null),
        h('div.stack.tight.grow',
          h('div.row.between', h('b.st-crit-title', c.title), ui.chip(c.met ? 'spełnione' : 'jeszcze nie', c.met ? 'ok' : '')),
          c.detail ? h('p.small.muted', c.detail) : null, c.body || null));
    })));
    el.appendChild(h('hr.divider'));
    el.appendChild(examLine());
    el.appendChild(h('p.tiny.muted', 'Utrwalone to pozycje, które wracają do powtórki nie częściej niż co ' + P.srs.intervals[4] + ' dni.'));
    return el;
  }

  /* ---------- 2. wykres egzaminów próbnych ---------- */
  function examCard() {
    const ex = examList();
    const el = card('Egzaminy próbne', ex.length ? h('span.small.muted', F.plural(ex.length, 'próba', 'próby', 'prób')) : null,
      'Punkty z kolejnych prób na pełnych arkuszach: 40 pytań, +1 za dobrą odpowiedź, −1 za złą. Próg zaliczenia to 21 pkt, cel na próbach to ' + GOAL + ' pkt.');
    if (!ex.length) {
      el.appendChild(ui.empty('Nie masz jeszcze żadnej próby. Pierwsza pokaże punkt wyjścia, a kolejne — czy zbliżasz się do celu ' + GOAL + ' pkt.',
        ui.btn('Przejdź do egzaminu próbnego', function () { P.router.go('egzamin'); }, 'primary')));
      return { el: el, draw: null };
    }
    const lastEx = ex[ex.length - 1], three = ex.slice(-3);
    const best = Math.max.apply(null, ex.map(function (s) { return s.points; }));
    const passed = ex.filter(function (s) { return s.points >= 21; }).length;
    el.appendChild(h('div.grid.tight.st-stats',
      ui.stat(num(lastEx.points), 'ostatni wynik'), ui.stat(num(best), 'najlepszy wynik'),
      ui.stat(dec(U.sum(three, function (s) { return s.points; }) / three.length), three.length === 3 ? 'średnia z 3 ostatnich' : 'średnia z dotychczasowych'),
      ui.stat(passed + ' z ' + ex.length, 'prób z wynikiem od 21 pkt')));

    const wrap = h('div.st-chart'), readout = h('p.small.st-readout');
    const shown = ex.slice(-MAX_POINTS), off = ex.length - shown.length;
    let dots = [], width = 0;
    function describe(i) {
      const s = shown[i], p = s.points;
      const verdict = p >= GOAL ? 'Zaliczona, cel osiągnięty.' : p >= 21 ? 'Zaliczona, do celu brakuje ' + (GOAL - p) + ' pkt.' : 'Poniżej progu o ' + (21 - p) + ' pkt.';
      return 'Próba ' + (off + i + 1) + ' (' + fullDate(s.day) + ', ' + examWhat(s) + '): ' + pts(p) + ' — dobre ' + (s.ok || 0) + ', złe ' + (s.bad || 0) + ', bez odpowiedzi ' + (s.skip || 0) + '. ' + verdict;
    }
    function select(i) {
      P.clear(readout).appendChild(document.createTextNode(describe(i)));
      dots.forEach(function (d, k) { d.setAttribute('r', k === i ? 6.5 : 4.5); d.setAttribute('class', 'st-dot' + (k === i ? ' on' : '') + (k === shown.length - 1 ? ' last' : '')); });
    }
    function draw() {
      const W = Math.max(260, Math.round(wrap.clientWidth) || 640);
      if (W === width) return;
      width = W;
      const H = W < 480 ? 230 : 270, m = { l: 34, r: 62, t: 18, b: 28 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
      const slots = Math.max(shown.length, 8), pad = 14, step = (pw - 2 * pad) / (slots - 1);
      const x = function (i) { return Math.round((m.l + pad + i * step) * 10) / 10; };
      const y = function (v) { return Math.round((m.t + (40 - U.clamp(v, -10, 40)) / 50 * ph) * 10) / 10; };
      const root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': 'Wykres punktów z ' + F.plural(shown.length, 'próby', 'prób', 'prób') + ' egzaminu. Ostatni wynik: ' + pts(lastEx.points) + '. Próg 21 pkt, cel ' + GOAL + ' pkt.' });
      root.appendChild(svg('rect', { class: 'st-zone', x: m.l, y: y(40), width: pw, height: y(21) - y(40) }));
      [-10, 0, 10, 20, 30, 40].forEach(function (v) {
        root.appendChild(svg('line', { class: 'st-gridline' + (v === 0 ? ' zero' : ''), x1: m.l, x2: m.l + pw, y1: y(v), y2: y(v) }));
        root.appendChild(svg('text', { class: 'st-tick', x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, num(v)));
      });
      root.appendChild(svg('line', { class: 'st-goal', x1: m.l, x2: m.l + pw, y1: y(GOAL), y2: y(GOAL) }));
      root.appendChild(svg('line', { class: 'st-pass', x1: m.l, x2: m.l + pw, y1: y(21), y2: y(21) }));
      root.appendChild(svg('text', { class: 'st-tick strong', x: m.l + pw + 8, y: y(GOAL) + 1 }, 'cel ' + GOAL));
      root.appendChild(svg('text', { class: 'st-tick strong', x: m.l + pw + 8, y: y(21) + 7 }, 'próg 21'));
      if (shown.length > 1) root.appendChild(svg('polyline', { class: 'st-line', points: shown.map(function (s, i) { return x(i) + ',' + y(s.points); }).join(' ') }));
      const every = step >= 22 ? 1 : step >= 11 ? 2 : 5;
      dots = shown.map(function (s, i) {
        const n = off + i + 1;
        if (i === 0 || n % every === 0) root.appendChild(svg('text', { class: 'st-tick', x: x(i), y: H - 8, 'text-anchor': 'middle' }, n));
        return root.appendChild(svg('circle', { class: 'st-dot', cx: x(i), cy: y(s.points), r: 4.5 }));
      });
      const li = shown.length - 1, ly = y(lastEx.points);
      root.appendChild(svg('text', { class: 'st-val', x: x(li), y: ly - 13 < m.t ? ly + 22 : ly - 13, 'text-anchor': 'middle' }, num(lastEx.points)));
      shown.forEach(function (s, i) {
        const hit = svg('circle', { class: 'st-hit', cx: x(i), cy: y(s.points), r: U.clamp(step / 2, 10, 18) }, svg('title', null, describe(i)));
        hit.addEventListener('mouseenter', function () { select(i); });
        hit.addEventListener('click', function () { select(i); });
        root.appendChild(hit);
      });
      root.addEventListener('mouseleave', function () { select(li); });
      root.appendChild(svg('text', { class: 'st-tick', x: m.l + pw + 8, y: H - 8 }, 'próba'));
      P.clear(wrap).appendChild(root);
      select(li);
    }
    el.appendChild(wrap);
    el.appendChild(readout);
    el.appendChild(h('details.fold', h('summary', 'Wyniki w tabeli'),
      ui.table(['Nr', 'Data', 'Arkusz', 'Dobre', 'Złe', 'Bez odp.', 'Punkty', 'Wynik'], ex.map(function (s, i) {
        return [i + 1, fullDate(s.day), s.sheet || '–', s.ok || 0, s.bad || 0, s.skip || 0, num(s.points), ui.chip(s.points >= 21 ? 'zaliczony' : 'poniżej progu', s.points >= 21 ? 'ok' : 'bad')];
      }).reverse(), [0, 3, 4, 5, 6])));
    return { el: el, draw: draw, wrap: wrap };
  }

  /* ---------- 3. tematy ---------- */
  function topicRows() {
    const state = P.store.get('srs').q, by = {};
    P.q.pool({}).forEach(function (q) {
      const r = by[q.topic] || (by[q.topic] = { n: 0, seen: 0, mature: 0, ok: 0, bad: 0 }), s = state[q.id];
      r.n++;
      if (!s) return;
      r.ok += s[4] || 0; r.bad += s[5] || 0;
      if (s[0] > 0) { r.seen++; if (s[0] >= 4) r.mature++; }
    });
    const rows = [];
    P.data.topics.forEach(function (t) { const r = by[t.code]; if (r && r.n) { r.t = t; r.ans = r.ok + r.bad; r.acc = r.ans ? r.ok / r.ans : null; rows.push(r); } });
    const rated = rows.filter(function (r) { return r.ans >= MIN_RATED; }).sort(function (a, b) { return a.acc - b.acc || a.seen / a.n - b.seen / b.n; });
    return rated.concat(rows.filter(function (r) { return r.ans < MIN_RATED; }));
  }
  function cell(cls, label, content) { return h('td' + (cls ? '.' + cls : ''), { role: 'cell', dataset: label ? { label: label } : null }, content); }
  function topicsCard() {
    const rows = topicRows();
    const el = card('Tematy', null, 'Od najsłabszej trafności. Tematy z mniej niż ' + MIN_RATED + ' odpowiedziami są niżej, w kolejności planu.');
    if (!rows.length) { el.appendChild(ui.empty('Brak pytań z kluczem odpowiedzi, więc nie ma czego zestawić.')); return el; }
    const head = h('tr', { role: 'row' }, ['Temat', 'Pytań', 'Przerobione', 'Trafność', 'Utrwalone', 'Postęp', ''].map(function (x, i) {
      return h('th' + (i >= 1 && i <= 4 ? '.num' : ''), { role: 'columnheader' }, x || h('span.st-sr', 'Ćwiczenie'));
    }));
    const body = h('tbody', { role: 'rowgroup' }, rows.map(function (r) {
      const name = r.t.short || r.t.name, seen = r.seen / r.n, mature = r.mature / r.n;
      const bar = h('div.st-seg', { role: 'img', 'aria-label': 'Utrwalone ' + F.pct(mature) + ', w nauce ' + F.pct(seen - mature) + ', nowe ' + F.pct(1 - seen) },
        r.mature ? h('i.mature', { style: { flexGrow: String(r.mature) } }) : null,
        r.seen - r.mature ? h('i.learning', { style: { flexGrow: String(r.seen - r.mature) } }) : null,
        r.n - r.seen ? h('i.fresh', { style: { flexGrow: String(r.n - r.seen) } }) : null);
      return h('tr', { role: 'row' },
        cell('st-c-name', '', [h('span.st-topic', { title: r.t.name }, name), ' ', h('span.tiny.muted.num', r.t.code)]),
        cell('num', 'Pytań', r.n),
        cell('num', 'Przerob.', F.pct(seen)),
        cell('num', 'Trafność', [r.acc == null ? '–' : F.pct(r.acc), r.ans ? h('span.tiny.muted.st-sub', r.ok + ' z ' + r.ans) : null]),
        cell('num', 'Utrwal.', F.pct(mature)),
        cell('st-c-bar', '', bar),
        cell('st-c-act', '', h('button.btn.sm', { type: 'button', 'aria-label': 'Ćwicz temat: ' + name,
          onclick: function () { practice({ mode: 'nauka', filter: { topics: [r.t.code] }, n: 20, label: name, returnTo: 'statystyki' }); } }, 'Ćwicz')));
    }));
    el.appendChild(h('div.scroll-x', h('table.table.st-table.st-topics', { role: 'table' }, h('thead', { role: 'rowgroup' }, head), body)));
    el.appendChild(h('div.row.tiny.muted.st-legend', { 'aria-hidden': 'true' },
      h('span', h('i.st-key.mature'), 'utrwalone'), h('span', h('i.st-key.learning'), 'w nauce'), h('span', h('i.st-key.fresh'), 'nowe')));
    const skipped = P.q.all().length - P.q.pool({}).length;
    el.appendChild(h('p.tiny.muted', 'Trafność to udział dobrych odpowiedzi we wszystkich udzielonych w nauce i powtórkach.' +
      (skipped > 0 ? ' Zestawienie pomija ' + qWord(skipped) + ': z arkuszy zarezerwowanych na próby generalne albo bez klucza odpowiedzi.' : '')));
    return el;
  }

  /* ---------- 4. kalibracja ---------- */
  function calibCard() {
    const c = P.store.get('log').calib || {}, groups = [['Gdy zaznaczasz „jestem pewny”', c.sure || [0, 0]], ['Gdy zaznaczasz „zgaduję”', c.unsure || [0, 0]]];
    const el = card('Kalibracja pewności', null, 'W nauce zaznaczasz przed odpowiedzią „jestem pewny” albo „zgaduję”. Tu widać, ile ta ocena jest warta przy punktach ujemnych.');
    groups.forEach(function (g) {
      const ok = g[1][0] || 0, n = g[1][1] || 0, acc = n ? ok / n : 0;
      const tick = h('i.st-target', { 'aria-hidden': 'true' }); tick.style.left = '50%';
      el.appendChild(h('div.st-meter',
        h('div.row.between', h('span', g[0]), h('b.num', n ? F.pct(acc) : '–')),
        h('div.st-meter-track', ui.bar(acc, n ? (acc > 0.5 ? 'ok' : 'warn') : ''), tick),
        h('span.tiny.muted', n ? 'Dobre odpowiedzi: ' + ok + ' z ' + n + ' · średnio ' + (acc * 2 - 1 > 0 ? '+' : '') + dec(acc * 2 - 1) + ' pkt za odpowiedź'
          : 'Brak odpowiedzi z tym oznaczeniem.')));
    });
    function advice(g) { const n = g[1][1] || 0; return n < MIN_CALIB ? '?' : (g[1][0] || 0) / n > 0.5 ? 'tak' : 'nie'; }
    const a = advice(groups[0]), b = advice(groups[1]);
    let text, kind = '';
    if (a === '?' && b === '?') text = 'Za mało danych na wniosek: potrzeba co najmniej ' + MIN_CALIB + ' odpowiedzi w każdej z grup.';
    else if (a === 'nie') { kind = 'warn'; text = 'Nawet przy odpowiedziach oznaczonych jako pewne trafność nie przekracza 50%, więc na egzaminie pomijaj wszystko, czego nie potrafisz uzasadnić przepisem.'; }
    else if (a === 'tak' && b === 'tak') text = 'Na egzaminie odpowiadaj także wtedy, gdy zgadujesz: w obu grupach trafność przekracza 50%, więc odpowiedź średnio dodaje punkty.';
    else if (a === 'tak' && b === 'nie') text = 'Na egzaminie odpowiadaj tylko wtedy, gdy masz pewność, a pytania, przy których zgadujesz, pomijaj: przy trafności do 50% odpowiedź średnio odbiera punkty.';
    else if (a === 'tak') text = 'Na egzaminie odpowiadaj, gdy masz pewność; o zgadywaniu nic jeszcze nie wiadomo, bo w tej grupie jest mniej niż ' + MIN_CALIB + ' odpowiedzi.';
    else if (b === 'tak') text = 'Przy zgadywaniu trafność przekracza 50%, więc na egzaminie takie odpowiedzi się opłacają; w grupie odpowiedzi pewnych jest jeszcze za mało danych.';
    else { kind = 'warn'; text = 'Przy zgadywaniu trafność nie przekracza 50%, więc na egzaminie takie pytania pomijaj; w grupie odpowiedzi pewnych jest jeszcze za mało danych.'; }
    el.appendChild(ui.banner(kind, 'Wniosek', text));
    el.appendChild(h('p.tiny.muted', 'Kreska na pasku to 50%. Przy punktacji +1 / −1 odpowiedź opłaca się dopiero powyżej tej granicy.'));
    return el;
  }

  /* ---------- 5. aktywność ---------- */
  function dayValue(r) { return r ? Math.max(r.m || 0, Math.round(((r.q || 0) + (r.f || 0)) * 0.6)) : 0; }
  function level(v) { return v <= 0 ? 0 : v < 15 ? 1 : v < 30 ? 2 : v < 60 ? 3 : 4; }
  function dayText(iso, r, future) {
    const parts = [];
    if (r && r.m) parts.push(F.mins(r.m));
    if (r && r.q) parts.push(qWord(r.q));
    if (r && r.f) parts.push(F.plural(r.f, 'fiszka', 'fiszki', 'fiszek'));
    return F.dow(iso) + ' ' + fullDate(iso) + (future ? '' : ': ' + (parts.length ? parts.join(', ') : 'bez nauki'));
  }
  function activityCard() {
    const days = P.store.get('log').days || {}, today = U.today(), mon = U.monday(today), first = U.addDays(mon, -77);
    const el = card('Aktywność', null, 'Ostatnie 12 tygodni. Im ciemniejsze pole, tym więcej nauki danego dnia.');
    const grid = h('div.st-heat'), readout = h('p.small.muted.st-readout', dayText(today, days[today]));
    let active = 0, prevMonth = -1;
    DOW.forEach(function (d, i) { grid.appendChild(h('span.st-heat-lab', { 'aria-hidden': 'true', style: { gridColumn: '1', gridRow: String(i + 2) } }, d)); });
    for (let w = 0; w < 12; w++) {
      const month = U.parse(U.addDays(first, w * 7)).getMonth();
      if (month !== prevMonth) grid.appendChild(h('span.st-heat-lab.top', { 'aria-hidden': 'true', style: { gridColumn: String(w + 2), gridRow: '1' } }, MON[month]));
      prevMonth = month;
      for (let d = 0; d < 7; d++) {
        const iso = U.addDays(first, w * 7 + d), future = iso > today, r = days[iso], lv = future ? 0 : level(dayValue(r));
        if (lv) active++;
        grid.appendChild(h('span.st-day.l' + lv + (future ? '.future' : '') + (iso === today ? '.today' : ''),
          { title: dayText(iso, r, future), dataset: { text: dayText(iso, r, future) }, style: { gridColumn: String(w + 2), gridRow: String(d + 2) } }));
      }
    }
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', 'Siatka aktywności z 12 tygodni: ' + F.plural(active, 'dzień', 'dni', 'dni') + ' z nauką.');
    function pick(e) { const t = e.target && e.target.dataset && e.target.dataset.text; if (t) readout.textContent = t; }
    grid.addEventListener('mouseover', pick);
    grid.addEventListener('click', pick);
    grid.addEventListener('mouseleave', function () { readout.textContent = dayText(today, days[today]); });
    el.appendChild(grid);
    el.appendChild(h('div.row.between',
      readout,
      h('div.row.tiny.muted.st-scale', { 'aria-hidden': 'true' }, 'mniej',
        ['bez nauki', 'do 15 min', '15–29 min', '30–59 min', '60 min i więcej'].map(function (t, i) { return h('span.st-day.l' + i, { title: t }); }), 'więcej')));

    const total = U.sum(Object.keys(days), function (k) { return days[k].m || 0; });
    const week = P.log.minutes(mon, U.addDays(mon, 6)), goal = Math.round((P.settings().hours || 0) * 60), streak = P.log.streak();
    el.appendChild(h('hr.divider'));
    el.appendChild(h('div.grid.tight.st-stats',
      ui.stat(String(streak), streak === 1 ? 'dzień nauki z rzędu' : 'dni nauki z rzędu'),
      ui.stat(F.mins(total), 'łączny czas nauki'),
      h('div.stat', h('b', F.mins(week)), h('span', 'w tym tygodniu' + (goal ? ', cel ' + F.mins(goal) : '')), goal ? ui.bar(week / goal, week >= goal ? 'ok' : '') : null)));
    return el;
  }

  /* ---------- 6. ostatnie sesje ---------- */
  function sessionResult(s) {
    if (s.type === 'egzamin' && typeof s.points === 'number') {
      const pass = s.passed != null ? !!s.passed : s.points >= P.exam.passMark(s.n || 40);
      return [h('span.num', pts(s.points)), ' ', ui.chip(pass ? 'zaliczony' : 'poniżej progu', pass ? 'ok' : 'bad')];
    }
    if (s.type === 'fiszki') return s.n ? F.plural(s.n, 'fiszka', 'fiszki', 'fiszek') : '–';
    if (s.n) { const ans = (s.ok || 0) + (s.bad || 0); return h('span.num', (s.ok || 0) + ' z ' + s.n + (ans ? ' (' + F.pct((s.ok || 0) / ans) + ')' : '')); }
    return '–';
  }
  function sessionsCard() {
    const list = P.log.sessions().slice().sort(function (a, b) { return (b.t || 0) - (a.t || 0); }).slice(0, 15);
    const el = card('Ostatnie sesje', list.length ? h('span.small.muted', list.length < 15 ? F.plural(list.length, 'sesja', 'sesje', 'sesji') : '15 najnowszych') : null);
    if (!list.length) {
      el.appendChild(ui.empty('Nie ma jeszcze żadnej sesji. Każda ukończona sesja pytań, fiszek i egzaminu pojawi się tutaj z wynikiem i czasem.',
        ui.btn('Przejdź do planu dnia', function () { P.router.go('dzis'); })));
      return el;
    }
    const head = h('tr', { role: 'row' }, ['Data', 'Rodzaj', 'Zakres', 'Wynik', 'Czas'].map(function (x, i) { return h('th' + (i === 4 ? '.num' : ''), { role: 'columnheader' }, x); }));
    const body = h('tbody', { role: 'rowgroup' }, list.map(function (s) {
      const day = s.day || U.iso(new Date(s.t || Date.now()));
      return h('tr', { role: 'row' },
        cell('num.st-c-date', '', [F.dm(day), h('span.st-year', '.' + day.slice(0, 4))]),
        cell('st-c-kind', '', KINDS[s.type] || 'Inne'),
        cell('st-c-label', '', s.label || (s.sheet ? 'Arkusz ' + s.sheet : '–')),
        cell('st-c-res', '', sessionResult(s)),
        cell('num.st-c-time', '', s.min ? F.mins(s.min) : '–'));
    }));
    el.appendChild(h('div.scroll-x', h('table.table.st-table.st-sessions', { role: 'table' }, h('thead', { role: 'rowgroup' }, head), body)));
    return el;
  }

  /* ---------- widok ---------- */
  function render(root) {
    const chart = examCard();
    root.appendChild(h('div.view-head', h('div.stack.tight', h('h1', 'Statystyki'), h('p', 'Gotowość do egzaminu, wyniki prób, słabe tematy i rytm nauki.'))));
    root.appendChild(readinessCard());
    root.appendChild(chart.el);
    root.appendChild(topicsCard());
    root.appendChild(h('div.grid', calibCard(), activityCard()));
    root.appendChild(sessionsCard());
    if (chart.draw) {
      chart.draw();
      if (window.ResizeObserver) { observer = new ResizeObserver(function () { chart.draw(); }); observer.observe(chart.wrap); }
    }
  }
  function leave() { if (observer) { observer.disconnect(); observer = null; } }

  P.views.statystyki = { title: 'Statystyki', render: render, leave: leave };
})();
