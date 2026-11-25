/* Dziedzina: wczytanie danych, harmonogram, powtórki rozłożone w czasie (SRS), pule pytań i fiszek, punktacja egzaminu, dziennik nauki. */
(function () {
  'use strict';
  var P = window.PPOZ, U = P.util;
  var FILES = ['meta', 'topics', 'plan', 'questions', 'flashcards', 'lessons', 'norms', 'legal'];
  var D = P.data = {};

  function loadAll() {
    if (window.__PPOZ_DATA__) return Promise.resolve(window.__PPOZ_DATA__);
    return Promise.all(FILES.map(function (f) {
      return fetch('data/' + f + '.json').then(function (r) { if (!r.ok) throw new Error('Nie udało się wczytać danych: ' + f); return r.json(); });
    })).then(function (a) { var o = {}; FILES.forEach(function (f, i) { o[f] = a[i]; }); return o; });
  }
  function byKey(arr, k) { var m = {}; arr.forEach(function (x) { m[x[k]] = x; }); return m; }
  D.ready = loadAll().then(function (o) {
    FILES.forEach(function (f) { D[f] = o[f]; });
    D.qById = byKey(D.questions, 'id'); D.topicByCode = byKey(D.topics, 'code'); D.lessonById = byKey(D.lessons, 'id');
    D.cardById = byKey(D.flashcards, 'id'); D.normByBase = byKey(D.norms.norms, 'base'); D.actById = byKey(D.legal, 'id');
    D.weekByN = byKey(D.plan.weeks, 'n'); D.blockById = byKey(D.plan.blocks, 'id');
    return D;
  });

  P.settings = function () { return P.store.get('settings'); };
  P.setSetting = function (k, v) { P.settings()[k] = v; P.store.save('settings'); };
  P.topicName = function (code, short) { var t = D.topicByCode[code]; return t ? (short ? t.short : t.name) : code; };

  /* ---------- harmonogram ---------- */
  var plan = P.plan = {};
  plan.start = function () { return U.monday(P.settings().start || D.plan.defaultStart); };
  /* Tygodnie kalendarzowe dla wybranego wariantu (26, 20 lub 13 tygodni): [{i, start, end, weeks:[tydzień bazowy,…]}] */
  plan.calWeeks = function () {
    var preset = D.plan.presets[P.settings().preset] || D.plan.presets['26'], start = plan.start();
    return preset.map(function (ns, i) { var a = U.addDays(start, 7 * i); return { i: i, start: a, end: U.addDays(a, 6), weeks: ns.map(function (n) { return D.weekByN[n]; }) }; });
  };
  /* Indeks bieżącego tygodnia kalendarzowego; <0 przed startem, >= liczba tygodni po zakończeniu. */
  plan.index = function () { return Math.floor(U.diffDays(plan.start(), U.today()) / 7); };
  plan.current = function () { var w = plan.calWeeks(); return w[U.clamp(plan.index(), 0, w.length - 1)]; };
  plan.phase = function () { var i = plan.index(), n = plan.calWeeks().length; return i < 0 ? 'przed' : i >= n ? 'po' : 'w-trakcie'; };
  plan.end = function () { var w = plan.calWeeks(); return w[w.length - 1].end; };
  /* Zadania tygodnia bazowego: rytm tygodnia (dla typu „nauka”) + zadania dodatkowe. */
  plan.tasks = function (week) {
    var out = [], st = P.store.get('plan').tasks, lesson = week.lesson && D.lessonById[week.lesson];
    if (week.type === 'nauka') D.plan.rhythm.forEach(function (r) {
      out.push({ id: 'w' + week.n + ':' + r.id, kind: r.kind, title: r.title, desc: r.desc, min: r.min, day: r.day, week: week.n, lesson: lesson ? lesson.id : null, topics: week.topics });
    });
    (week.extra || []).forEach(function (x, i) {
      out.push({ id: 'w' + week.n + ':x' + i, kind: x.kind, title: x.text, desc: '', min: x.min || 30, day: '', week: week.n, sheet: x.sheet || null, topics: week.topics });
    });
    out.forEach(function (t) { t.done = (st[t.id] || 0) > 0; });
    return out;
  };
  plan.setTask = function (id, done) { P.store.get('plan').tasks[id] = done ? Date.now() : -Date.now(); P.store.save('plan'); };
  plan.progress = function (week) { var t = plan.tasks(week); return t.length ? t.filter(function (x) { return x.done; }).length / t.length : 0; };
  plan.calProgress = function (cw) { var t = []; cw.weeks.forEach(function (w) { t = t.concat(plan.tasks(w)); }); return t.length ? t.filter(function (x) { return x.done; }).length / t.length : 0; };
  /* Wariant planu mieszczący się między datą startu a egzaminem. */
  plan.suggestPreset = function (startIso, examIso) { var w = Math.floor(U.diffDays(U.monday(startIso), examIso) / 7); return w >= 26 ? '26' : w >= 20 ? '20' : '13'; };
  /* Oznaczenie „przeczytane / powtórzone” dla aktu lub normy: kind = 'r' | 'p' */
  plan.readState = function (id) { var r = P.store.get('plan').reads[id]; return { r: !!(r && r.r > 0), p: !!(r && r.p > 0) }; };
  plan.setRead = function (id, kind, on) { var m = P.store.get('plan').reads, r = m[id] || { r: 0, p: 0, t: 0 }; r[kind] = on ? Date.now() : 0; r.t = Date.now(); m[id] = r; P.store.save('plan'); };
  /* Kalendarz .ics: jedno wydarzenie całodniowe (poniedziałek) na tydzień planu. */
  plan.ics = function () {
    function d(iso) { return iso.replace(/-/g, ''); }
    function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
    var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PPOZ//Plan nauki//PL', 'CALSCALE:GREGORIAN'];
    plan.calWeeks().forEach(function (cw) {
      var title = cw.weeks.map(function (w) { return w.title; }).join(' + ');
      var desc = cw.weeks.map(function (w) { return w.focus + '\n' + plan.tasks(w).map(function (t) { return '• ' + t.title; }).join('\n'); }).join('\n\n');
      out.push('BEGIN:VEVENT', 'UID:ppoz-tydzien-' + (cw.i + 1) + '@nauka', 'DTSTAMP:' + d(U.today()) + 'T000000Z', 'DTSTART;VALUE=DATE:' + d(cw.start),
        'DTEND;VALUE=DATE:' + d(U.addDays(cw.start, 1)), 'SUMMARY:' + esc('Rzeczoznawca ppoż. – tydz. ' + (cw.i + 1) + ': ' + title), 'DESCRIPTION:' + esc(desc), 'END:VEVENT');
    });
    out.push('END:VCALENDAR');
    return out.join('\r\n');
  };

  /* ---------- powtórki rozłożone w czasie ---------- */
  /* Stan pozycji: [pudełko 0–7, termin (numer dnia), znacznik czasu, liczba odpowiedzi, dobre, złe]. Pudełko 0 = nowe. */
  var INT = [0, 1, 3, 7, 16, 35, 75, 150];
  var srs = P.srs = { intervals: INT };
  srs.get = function (kind, id) { return P.store.get('srs')[kind][id] || null; };
  /* grade: 'again' (źle), 'hard' (dobrze, ale niepewnie), 'good', 'easy' */
  srs.grade = function (kind, id, grade) {
    var m = P.store.get('srs')[kind], s = m[id] || [0, 0, 0, 0, 0, 0], box = s[0], today = U.dayNum(), nb, due;
    if (grade === 'again') { nb = 1; due = today + 1; }
    else if (grade === 'hard') { nb = Math.max(1, box); due = today + Math.max(1, Math.round(INT[nb] * 0.5)); }
    else { nb = box === 0 ? (grade === 'easy' ? 3 : 1) : Math.min(7, box + (grade === 'easy' ? 2 : 1)); due = today + INT[nb]; }
    m[id] = [nb, due, Date.now(), s[3] + 1, s[4] + (grade === 'again' ? 0 : 1), s[5] + (grade === 'again' ? 1 : 0)];
    P.store.save('srs');
    return m[id];
  };
  srs.isDue = function (s, day) { return !!s && s[0] > 0 && s[1] <= (day || U.dayNum()); };
  srs.nextText = function (s) { if (!s || !s[0]) return 'nowe'; var d = s[1] - U.dayNum(); return d <= 0 ? 'dziś' : d === 1 ? 'jutro' : 'za ' + d + ' dni'; };
  /* Podsumowanie dla listy identyfikatorów: nowe / w nauce (pudełka 1–3) / utrwalone (4–7) / do powtórki dziś / błędy */
  srs.summary = function (kind, ids) {
    var m = P.store.get('srs')[kind], day = U.dayNum(), o = { total: ids.length, fresh: 0, learning: 0, mature: 0, due: 0, errors: 0 };
    ids.forEach(function (id) { var s = m[id]; if (!s || !s[0]) { o.fresh++; return; } if (s[0] >= 4) o.mature++; else o.learning++; if (s[1] <= day) o.due++; if (s[0] === 1 && s[5] > 0) o.errors++; });
    return o;
  };

  /* ---------- pytania ---------- */
  var Q = P.q = {};
  Q.all = function () { return D.questions.concat(P.store.get('notes').customQ || []); };
  Q.byId = function (id) { return D.qById[id] || (P.store.get('notes').customQ || []).filter(function (q) { return q.id === id; })[0] || null; };
  /* Klucz obowiązujący w aplikacji: poprawka użytkownika ma pierwszeństwo. */
  Q.key = function (q) { var o = P.store.get('notes').over[q.id]; return (o && o.key) || q.key; };
  Q.isOverridden = function (q) { var o = P.store.get('notes').over[q.id]; return !!(o && o.key); };
  Q.setKey = function (q, key, note) { var m = P.store.get('notes').over; if (key) m[q.id] = { key: key, note: note || '', t: Date.now() }; else m[q.id] = { key: '', note: '', t: Date.now() }; P.store.save('notes'); };
  Q.flagged = function (q) { return (P.store.get('notes').flags[q.id] || 0) > 0; };
  Q.toggleFlag = function (q) { var m = P.store.get('notes').flags; m[q.id] = Q.flagged(q) ? -Date.now() : Date.now(); P.store.save('notes'); return Q.flagged(q); };
  Q.note = function (q) { var n = P.store.get('notes').qnotes[q.id]; return (n && n.text) || ''; };
  Q.setNote = function (q, text) { P.store.get('notes').qnotes[q.id] = { text: text, t: Date.now() }; P.store.save('notes'); };
  /* Arkusze 13–14 są zarezerwowane na próby generalne, dopóki nie zostaną rozwiązane jako egzamin. */
  Q.isReserved = function (q) { return !!P.settings().reserve && D.plan.reservedSheets.indexOf(q.sheet) >= 0 && !((P.store.get('plan').sheets[q.sheet] || 0) > 0); };
  Q.isError = function (q) { var s = srs.get('q', q.id); return !!s && s[0] === 1 && s[5] > 0; };
  /* Pula pytań. f: {topics:[kody], sheet:n, state:'all'|'new'|'seen'|'due'|'errors'|'flagged'|'lowconf'|'changed', ids:[...], reserved:true (dołącz zarezerwowane)} */
  Q.pool = function (f) {
    f = f || {}; var day = U.dayNum(), set = f.ids ? {} : null;
    if (set) f.ids.forEach(function (i) { set[i] = 1; });
    return Q.all().filter(function (q) {
      if (!Q.key(q)) return false;
      if (set) return !!set[q.id];
      if (f.sheet) return q.sheet === f.sheet;
      if (!f.reserved && Q.isReserved(q)) return false;
      if (f.topics && f.topics.length && f.topics.indexOf(q.topic) < 0) return false;
      var s = srs.get('q', q.id);
      switch (f.state) {
        case 'new': return !s || !s[0];
        case 'seen': return !!s && s[0] > 0;
        case 'due': return srs.isDue(s, day);
        case 'errors': return Q.isError(q);
        case 'flagged': return Q.flagged(q);
        case 'lowconf': return q.conf === 'niska' && !Q.isOverridden(q);
        case 'changed': return q.stan && q.stan !== 'aktualne';
        default: return true;
      }
    });
  };
  /* Zapis odpowiedzi w trybie nauki lub powtórki. sure: true/false (pewność zaznaczona przed odpowiedzią) albo null. */
  Q.answer = function (q, choice, sure) {
    var key = Q.key(q), ok = choice === key, log = P.store.get('log');
    srs.grade('q', q.id, !ok ? 'again' : (sure === false ? 'hard' : 'good'));
    if (sure === true || sure === false) { var c = log.calib[sure ? 'sure' : 'unsure']; c[1]++; if (ok) c[0]++; }
    P.log.day({ q: 1, ok: ok ? 1 : 0 });
    return { ok: ok, key: key };
  };

  /* ---------- fiszki ---------- */
  var C = P.cards = {};
  C.all = function () { return D.flashcards.concat(P.store.get('notes').customF || []); };
  C.pool = function (f) {
    f = f || {}; var day = U.dayNum();
    return C.all().filter(function (c) {
      if (f.topics && f.topics.length && f.topics.indexOf(c.topic) < 0) return false;
      var s = srs.get('f', c.id);
      switch (f.state) {
        case 'new': return !s || !s[0];
        case 'due': return srs.isDue(s, day);
        case 'hard': return !!s && s[0] === 1 && s[5] > 0;
        default: return true;
      }
    });
  };
  C.grade = function (card, grade) { P.log.day({ f: 1 }); return srs.grade('f', card.id, grade); };

  /* ---------- egzamin: +1 / −1 / 0, próg 21 pkt z 40 ---------- */
  P.exam = {
    passMark: function (n) { return n === 40 ? 21 : Math.ceil(n * 21 / 40); },
    /* items: [{q, choice: 'a'|'b'|'c'|null}] */
    score: function (items) {
      var ok = 0, bad = 0, skip = 0;
      items.forEach(function (it) { if (!it.choice) skip++; else if (it.choice === Q.key(it.q)) ok++; else bad++; });
      var n = items.length, pts = ok - bad, pass = P.exam.passMark(n);
      return { n: n, ok: ok, bad: bad, skip: skip, points: pts, passMark: pass, passed: pts >= pass, accuracy: ok + bad ? ok / (ok + bad) : 0 };
    }
  };

  /* ---------- dziennik ---------- */
  var L = P.log = {};
  /* Dolicza do dzisiejszego dnia: {m: minuty, q: pytania, f: fiszki, ok: poprawne} */
  L.day = function (add) { var days = P.store.get('log').days, k = U.today(), d = days[k] || (days[k] = { m: 0, q: 0, f: 0, ok: 0 }); Object.keys(add).forEach(function (f) { d[f] = (d[f] || 0) + add[f]; }); P.store.save('log'); };
  /* Sesja: {type:'quiz'|'powtorka'|'egzamin'|'fiszki'|'czytanie'|'inne', label, n, ok, bad, skip, points, passed, min, topics, sheet} */
  L.session = function (s) { var log = P.store.get('log'); s.id = U.uid(); s.t = Date.now(); s.day = U.today(); log.sessions.push(s); if (log.sessions.length > 400) log.sessions.splice(0, log.sessions.length - 400); if (s.min) L.day({ m: s.min }); else P.store.save('log'); return s; };
  L.sessions = function (type) { return P.store.get('log').sessions.filter(function (s) { return !type || s.type === type; }); };
  L.minutes = function (fromIso, toIso) { var days = P.store.get('log').days, m = 0; Object.keys(days).forEach(function (k) { if (k >= fromIso && k <= toIso) m += days[k].m || 0; }); return m; };
  /* Liczba kolejnych dni z aktywnością, kończąca się dziś lub wczoraj. */
  L.streak = function () { var days = P.store.get('log').days, d = U.today(), n = 0; function act(k) { var x = days[k]; return !!x && ((x.q || 0) + (x.f || 0) + (x.m || 0) > 0); } if (!act(d)) d = U.addDays(d, -1); while (act(d)) { n++; d = U.addDays(d, -1); } return n; };

  /* ---------- plan dnia: co dziś powtórzyć i czego nowego się uczyć ---------- */
  P.today = function () {
    var s = P.settings(), cw = plan.current(), topics = [];
    cw.weeks.forEach(function (w) { (w.topics || []).forEach(function (t) { if (topics.indexOf(t) < 0) topics.push(t); }); });
    var dueQ = Q.pool({ state: 'due' }), dueF = C.pool({ state: 'due' });
    var newQ = topics.length ? Q.pool({ topics: topics, state: 'new' }) : [], newF = topics.length ? C.pool({ topics: topics, state: 'new' }) : [];
    return { week: cw, topics: topics, dueQ: dueQ, dueF: dueF, newQ: newQ, newF: newF, capQ: Math.min(dueQ.length, s.cap), capF: Math.min(dueF.length, s.cap) };
  };
})();
