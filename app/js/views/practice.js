/* Pytania (nauka, powtórka, przeglądanie) i egzamin próbny. Widoki: pytania, egzamin. API: P.practice.start(opts).
   Sesja i egzamin żyją w pamięci modułu (zmienna S): po przypadkowym wyjściu z widoku można do nich wrócić. */
(function () {
  'use strict';
  var P = window.PPOZ, h = P.h, ui = P.ui, U = P.util, F = P.fmt, Q = P.q;
  var LET = ['a', 'b', 'c'];
  var STATES = [
    { value: 'all', label: 'wszystkie' }, { value: 'new', label: 'nowe' }, { value: 'due', label: 'do powtórki' }, { value: 'errors', label: 'błędy' },
    { value: 'flagged', label: 'oznaczone' }, { value: 'lowconf', label: 'niepewny klucz' }, { value: 'changed', label: 'zmieniony stan prawny' }
  ];
  var STAN = { zmienione: 'Przepis zmieniony od czasu egzaminu', uchylone: 'Przepis uchylony', nieustalone: 'Stan prawny nieustalony' };
  var VERIF = { 'źródła': 'sprawdzony w tekście przepisu', zgodne: 'dwa zgodne opracowania', sporne: 'opracowania wskazują różne odpowiedzi',
    jednokrotne: 'jedno opracowanie, bez porównania', 'stary-klucz': 'klucz z poprzedniej wersji, jeszcze niezweryfikowany', brak: 'brak klucza' };

  var S = null;            /* bieżąca sesja lub egzamin */
  var R = null;            /* korzeń widoku */
  var onScreen = false;    /* sesja, egzamin lub ich wynik są na ekranie */
  var keyFn = null, tick = null;
  var form = { topics: {}, state: 'all', n: 20 };
  var browse = { text: '', topic: '', sheet: '', limit: 50, all: false };

  /* ---------- narzędzia ---------- */
  function plQ(n) { return F.plural(n, 'pytanie', 'pytania', 'pytań'); }
  function up(l) { return l ? String(l).toUpperCase() : '–'; }
  function examCfg() { var e = (P.data.meta && P.data.meta.exam) || {}; return { n: e.questions || 40, min: e.minutes || 40, pass: e.pass_ || 21, sheets: e.sheets || 14 }; }
  function sheetYear(n) { return n === 1 ? 2015 : n === 14 ? 2026 : 0; }
  function sheetName(n) { var y = sheetYear(n); return 'Arkusz ' + n + (y ? ' (egzamin z ' + y + ' r.)' : ''); }
  function sheetReserved(n) { return !!P.settings().reserve && (P.data.plan.reservedSheets || []).indexOf(n) >= 0 && !((P.store.get('plan').sheets[n] || 0) > 0); }
  function clock(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return U.pad(Math.floor(s / 60)) + ':' + U.pad(s % 60); }
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l'); }
  function goBack(to, fallback) { var s = String(to || fallback), i = s.indexOf('-'); if (i < 0) P.router.go(s); else P.router.go(s.slice(0, i), s.slice(i + 1)); }
  function head(title, sub, right) { return h('div.view-head', h('div.stack.tight', h('h1', title), sub ? h('p', sub) : null), right || null); }
  function byIds(ids) {
    var m = {}, seen = {}, out = [];
    Q.pool({ ids: ids }).forEach(function (q) { m[q.id] = q; });
    ids.forEach(function (id) { if (m[id] && !seen[id]) { seen[id] = 1; out.push(m[id]); } });
    return out;
  }
  function setKeys(fn) { stopKeys(); keyFn = fn; document.addEventListener('keydown', fn); }
  function stopKeys() { if (keyFn) document.removeEventListener('keydown', keyFn); keyFn = null; }
  function stopTimer() { if (tick) clearInterval(tick); tick = null; }
  function leave() { stopKeys(); stopTimer(); onScreen = false; }
  function busy() { return onScreen && !!S; }
  function ignoreKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal-back')) return true;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return true;
    return tag === 'INPUT' && !/^(checkbox|radio|button)$/.test(t.type);
  }
  function keyLetter(e) { var k = String(e.key).toLowerCase(), i = LET.indexOf(k); if (i < 0) i = ['1', '2', '3'].indexOf(k); return i < 0 ? '' : LET[i]; }
  function labelled(el, text) { el.setAttribute('aria-label', text); return el; }
  function navRefresh() { if (P.router.updateNav) P.router.updateNav(); }

  /* ---------- wspólne elementy pytania ---------- */
  function qTitle(q) { return typeof q.id === 'number' ? 'Pytanie nr ' + q.id : 'Pytanie własne'; }
  function overNote(q) { var o = P.store.get('notes').over[q.id]; return (o && o.key && o.note) || ''; }
  function confChip(q) {
    if (Q.isOverridden(q)) return ui.chip(Q.key(q) === q.key ? 'klucz potwierdzony' : 'klucz poprawiony', 'accent');
    if (q.conf === 'własne') return ui.chip('klucz własny', 'accent');
    if (!q.key) return ui.chip('brak klucza', 'warn');
    if (q.conf === 'wysoka') return ui.chip('klucz: pewność wysoka', 'ok');
    if (q.conf === 'niska') return ui.chip('klucz: pewność niska', 'warn');
    return ui.chip('klucz: pewność średnia');
  }
  function metaChips(q) { return [ui.chip(P.topicName(q.topic, true)), ui.chip(q.sheet ? 'arkusz ' + q.sheet : 'pytanie własne'), confChip(q)]; }

  /* Odpowiedzi po sprawdzeniu: klucz na zielono, błędny wybór na czerwono, zawsze z podpisem słownym. */
  function staticOptions(q, choice) {
    var key = Q.key(q);
    return h('div.stack.pr-opts', LET.map(function (l) {
      var isKey = !!key && l === key, mine = l === choice;
      return h('div.opt.pr-static' + (isKey ? '.correct' : mine ? '.wrong' : ''), h('span.letter', up(l)),
        h('span.grow.stack.tight', h('span', q[l]),
          isKey || mine ? h('span.pr-tag', isKey && mine ? 'Twoja odpowiedź, zgodna z kluczem' : isKey ? 'Poprawna według klucza' : 'Twoja odpowiedź') : null));
    }));
  }

  function normsBlock(q) {
    var list = q.norms || [];
    if (!list.length) return null;
    return h('div.stack.tight', h('span.label', 'Normy'), list.map(function (base) {
      var n = P.data.normByBase[base], cur = n && n.current && n.current[0], info;
      if (!n) info = h('span.small.muted', 'brak w rejestrze norm');
      else if (cur) info = h('span.small', 'aktualne wydanie: ' + cur.num);
      else if (n.successor && n.successor.length) info = h('span.small', 'wycofana, zastąpiona przez ' + n.successor.join(', '));
      else info = h('span.small.muted', 'brak aktualnego wydania w rejestrze PKN');
      return h('div.row', ui.ref(base), info, n && n.staleCited && n.staleCited.length ? ui.chip('pytania cytują wycofane wydanie', 'warn') : null);
    }));
  }

  /* Podstawa, wyjaśnienie, stan prawny, normy i uczciwa informacja o pewności klucza. */
  function explain(q) {
    var box = h('div.stack.pr-expl'), key = Q.key(q);
    if (q.basis) box.appendChild(h('div.stack.tight', h('span.label', 'Podstawa'), h('div', ui.ref(q.basis))));
    if (q.expl) box.appendChild(ui.rich(q.expl));
    if (q.quote) box.appendChild(h('div.quote', q.quote));
    if (!q.basis && !q.expl && !q.quote && q.conf !== 'własne') box.appendChild(h('p.small.muted', 'To pytanie nie ma jeszcze opracowanej podstawy prawnej ani wyjaśnienia.'));
    var changed = !!q.stan && q.stan !== 'aktualne', diff = !!q.ans && !!q.key && q.ans !== q.key, none = q.ansNow === 'brak';
    if (changed || diff || none) {
      var lines = [];
      if (q.stanNote) lines.push(q.stanNote);
      if (diff) lines.push('Odpowiedź zamierzona przez komisję: ' + up(q.ans) + '; według dzisiejszego stanu prawnego: ' + up(q.key) + '. Aplikacja ocenia według stanu dzisiejszego.');
      else if (none) lines.push('Odpowiedź zamierzona przez komisję: ' + up(q.ans) + '; według dzisiejszego stanu prawnego żadna odpowiedź nie jest poprawna. Aplikacja ocenia według odpowiedzi komisji.');
      if (P.data.meta && P.data.meta.legalDate) lines.push('Stan prawny sprawdzony ' + F.date(P.data.meta.legalDate) + '.');
      box.appendChild(ui.banner('warn', STAN[q.stan] || 'Odpowiedź zależy od stanu prawnego', lines.join(' ')));
    }
    var norms = normsBlock(q);
    if (norms) box.appendChild(norms);
    if (Q.isOverridden(q)) {
      var note = overNote(q);
      box.appendChild(ui.banner('', key === q.key ? 'Klucz potwierdzony przez Ciebie: ' + up(key) : 'Klucz poprawiony przez Ciebie: ' + up(key),
        (q.key ? 'Klucz aplikacji: ' + up(q.key) + '.' : 'Aplikacja nie ma klucza do tego pytania.') + (note ? ' Uzasadnienie: ' + note : '')));
    } else if (!q.key) {
      box.appendChild(ui.banner('warn', 'Brak klucza', 'Odpowiedź do tego pytania nie jest jeszcze opracowana. Pytanie nie trafia do sesji ani egzaminów, dopóki nie wskażesz klucza.'));
    } else if (q.conf === 'niska' || q.verif === 'sporne' || q.verif === 'stary-klucz') {
      box.appendChild(ui.banner('warn', 'Klucz niepewny', 'Sprawdź w źródle; możesz go poprawić. Pewność: ' + (q.conf || 'nieokreślona') + (VERIF[q.verif] ? '; weryfikacja: ' + VERIF[q.verif] : '') + '.'));
    }
    if (q.note) box.appendChild(h('p.small.muted', 'Uwaga redakcyjna: ' + q.note));
    return box;
  }

  function noteField(q) {
    var ta = h('textarea.input.pr-note', { rows: 2, placeholder: 'Na przykład: gdzie to jest w przepisie, z czym się myli' }), saved = Q.note(q);
    ta.value = saved;
    function save() { var v = ta.value.trim(); if (v !== saved) { Q.setNote(q, v); saved = v; } }
    ta.addEventListener('blur', save);
    ta.addEventListener('input', U.debounce(save, 900));
    return ui.field('Notatka', ta);
  }

  function flagBtn(q) {
    var lab = h('span', Q.flagged(q) ? 'Oznaczone' : 'Oznacz');
    var b = h('button.btn.sm.pr-flag', { type: 'button', 'aria-pressed': String(Q.flagged(q)), title: 'Oznaczone pytania znajdziesz w filtrze stanu „oznaczone”', onclick: function () {
      var on = Q.toggleFlag(q); b.setAttribute('aria-pressed', String(on)); lab.textContent = on ? 'Oznaczone' : 'Oznacz';
    } }, P.icon('flag'), lab);
    return b;
  }

  /* Okno poprawki klucza. done(zmieniono) wywoływane po zamknięciu. */
  function openKeyFix(q, done) {
    var over = Q.isOverridden(q), pick = Q.key(q) || '', changed = false;
    var note = h('input.input', { type: 'text', maxLength: 300, value: over ? overNote(q) : '' });
    var err = h('p.small.pr-err', { role: 'alert' });
    var body = h('div.stack',
      h('p.small.muted', (q.key ? 'Klucz aplikacji: ' + up(q.key) + (q.conf && q.conf !== 'własne' ? ' (pewność ' + q.conf + ').' : '.') : 'Aplikacja nie ma klucza do tego pytania.') +
        ' Twoja poprawka ma pierwszeństwo przed kluczem aplikacji. Jeśli wskażesz tę samą odpowiedź, pytanie przestanie być oznaczane jako niepewne.'),
      h('div.stack.tight', h('span.pr-flabel', 'Poprawna odpowiedź'), labelled(ui.seg(LET.map(function (l) { return { value: l, label: up(l) }; }), pick, function (v) { pick = v; }), 'Poprawna odpowiedź')),
      ui.field('Uzasadnienie lub źródło (opcjonalnie)', note), err);
    var actions = [{ label: 'Anuluj' }];
    if (over) actions.push({ label: 'Przywróć klucz aplikacji', onClick: function () { Q.setKey(q, '', ''); changed = true; ui.toast('Przywrócono klucz aplikacji'); } });
    actions.push({ label: 'Zapisz poprawkę', cls: 'primary', onClick: function () {
      if (!pick) { err.textContent = 'Wybierz odpowiedź A, B lub C.'; return false; }
      Q.setKey(q, pick, note.value.trim()); changed = true; ui.toast('Zapisano poprawkę klucza');
    } });
    ui.modal({ title: 'Popraw klucz: ' + qTitle(q).toLowerCase(), body: body, actions: actions, onClose: function () { setTimeout(function () { if (done) done(changed); }, 0); } });
  }
  function keyFixBtn(q, done) { return ui.btn('Popraw klucz', function () { openKeyFix(q, done); }, 'sm'); }

  /* Szczegóły pytania w oknie. ctx: {choice, onChange()} */
  function openDetails(q, ctx) {
    ctx = ctx || {};
    var close;
    var body = h('div.stack', h('div.row', metaChips(q)), h('p.q-text', q.q), staticOptions(q, ctx.choice || null), explain(q), noteField(q),
      h('div.row', ui.btn('Popraw klucz', function () {
        close();
        openKeyFix(q, function (changed) { if (changed && ctx.onChange) ctx.onChange(); openDetails(q, ctx); });
      }, 'sm'), flagBtn(q)));
    close = ui.modal({ title: qTitle(q), body: body, actions: [{ label: 'Zamknij' }], onClose: function () { if (ctx.onClose) ctx.onClose(); } });
  }

  /* Po zmianie klucza: przelicz ocenę już udzielonej odpowiedzi (termin powtórki) i zapisany wynik sesji. */
  function regrade(d) {
    if (!d || !d.choice || d.ok == null) return;
    var ok = d.choice === Q.key(d.q);
    if (ok !== d.ok) { P.srs.grade('q', d.q.id, ok ? (d.sure === false ? 'hard' : 'good') : 'again'); d.ok = ok; }
  }
  function relog() {
    if (!S || !S.logId) return;
    var e = P.store.get('log').sessions.filter(function (x) { return x.id === S.logId; })[0];
    if (!e) return;
    var r = P.exam.score(S.kind === 'egzamin' ? S.items : sessionItems());
    e.ok = r.ok; e.bad = r.bad; e.skip = r.skip; e.points = r.points;
    if (S.kind === 'egzamin') e.passed = r.passed;
    P.store.save('log');
  }

  function scaleAxis(points, n, pass) {
    function pos(v) { return ((v + n) / (2 * n) * 100) + '%'; }
    function lab(v, text) { var s = h('span', text); s.style.left = pos(v); return s; }
    return h('div.pr-scale', ui.scale(points, n, pass), h('div.pr-axis', { 'aria-hidden': 'true' }, lab(-n, '−' + n), lab(0, '0'), lab(pass, 'próg ' + pass), lab(n, '+' + n)));
  }
  function topicTable(items) {
    var by = U.groupBy(items, function (x) { return x.q.topic || 'Z9'; });
    var codes = P.data.topics.map(function (t) { return t.code; }).filter(function (c) { return by[c]; });
    Object.keys(by).forEach(function (c) { if (codes.indexOf(c) < 0) codes.push(c); });
    return ui.table(['Temat', 'Pytania', 'Dobre', 'Złe', 'Bez odp.', 'Punkty', 'Trafność'], codes.map(function (c) {
      var r = P.exam.score(by[c]);
      return [P.topicName(c, true), r.n, r.ok, r.bad, r.skip, F.signed(r.points), r.ok + r.bad ? F.pct(r.accuracy) : '–'];
    }), [1, 2, 3, 4, 5, 6]);
  }
  function resultRow(q, chips, onClick) {
    return h('button.pr-res', { type: 'button', onclick: onClick },
      h('span.row.tiny.muted', h('span.num', typeof q.id === 'number' ? 'nr ' + q.id : 'własne'), h('span', P.topicName(q.topic, true)), q.sheet ? h('span', 'arkusz ' + q.sheet) : null, chips || null),
      h('span.pr-res-q', q.q));
  }

  /* Baner o niedokończonej sesji lub egzaminie (na ekranach startowych). */
  function unfinished(redraw) {
    if (!S || S.phase === 'done') return null;
    if (S.kind === 'egzamin') {
      var left = S.endAt - Date.now(), over = left <= 0;
      return h('div.banner.warn.pr-unf', h('div.stack.tight.grow', h('b', 'Egzamin w toku: ' + S.label),
        h('span', over ? 'Czas minął. Otwórz egzamin, aby zobaczyć wynik.' : 'Pozostało ' + clock(left) + '. Czas biegnie także poza ekranem egzaminu.')),
        h('div.row', ui.btn(over ? 'Zobacz wynik' : 'Wróć do egzaminu', function () { P.router.go('egzamin', 'sesja'); }, 'sm primary'),
          over ? null : ui.btn('Porzuć', function () {
            ui.confirm('Porzucić egzamin?', 'Odpowiedzi z tego podejścia nie zostaną zapisane.', 'Porzuć egzamin', true).then(function (yes) { if (yes) { S = null; redraw(); } });
          }, 'sm')));
    }
    return h('div.banner.pr-unf', h('div.stack.tight.grow', h('b', 'Niedokończona sesja: ' + S.label),
      h('span', 'Pytanie ' + Math.min(S.pos + 1, S.queue.length) + ' z ' + S.queue.length + '. Udzielone odpowiedzi są zapisane.')),
      h('div.row', ui.btn('Wróć do sesji', function () { P.router.go('pytania', 'sesja'); }, 'sm primary'),
        ui.btn('Zakończ sesję', function () { if (S.order.length) { R = R || document.getElementById('view'); finishSession(false); } else { S = null; redraw(); } }, 'sm')));
  }

  /* ================= #pytania — ekran startowy ================= */
  function topicSelect(value, onChange, allLabel) {
    var s = h('select.input');
    if (allLabel) s.appendChild(h('option', { value: '' }, allLabel));
    P.data.plan.blocks.forEach(function (b) {
      var ts = P.data.topics.filter(function (t) { return t.block === b.id; });
      if (!ts.length) return;
      var g = h('optgroup', { label: 'Blok ' + b.id + ': ' + b.name });
      ts.forEach(function (t) { g.appendChild(h('option', { value: t.code, selected: t.code === value }, t.short)); });
      s.appendChild(g);
    });
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }

  function tile(title, n, desc, onClick, disabled) {
    return h('button.pr-tile', { type: 'button', disabled: !!disabled, onclick: onClick, 'aria-label': title + (n == null ? '' : ' (' + n + ')') },
      n == null ? null : h('b.num', n), h('span.pr-tile-t', title), h('span.small.muted', desc));
  }

  function startScreen() {
    onScreen = false; P.clear(R);
    var all = Q.all(), pool = Q.pool({}), sum = P.srs.summary('q', pool.map(function (q) { return q.id; }));
    var reserved = all.filter(function (q) { return Q.isReserved(q); }).length;
    var noKey = all.filter(function (q) { return !Q.key(q) && !Q.isReserved(q); }).length;
    var set = P.settings(), today = P.today();
    R.appendChild(head('Pytania', 'Pytania z arkuszy egzaminacyjnych 2015–2026 z informacją zwrotną po każdej odpowiedzi.'));
    var ub = unfinished(startScreen);
    if (ub) R.appendChild(ub);

    /* 1. Pula */
    var parts = [];
    if (reserved) parts.push(plQ(reserved) + ' z arkuszy ' + (P.data.plan.reservedSheets || []).join(' i ') + ' czeka na próby generalne');
    if (noKey) parts.push(plQ(noKey) + ' nie ma jeszcze klucza odpowiedzi');
    var tot = Math.max(1, sum.total);
    function seg(cls, v) { var i = h('i.' + cls); i.style.width = (v / tot * 100) + '%'; return i; }
    R.appendChild(h('section.card', h('div.card-head', h('h2', 'Stan puli'), h('span.small.muted', 'W puli: ' + plQ(sum.total))),
      h('div.pr-stats', ui.stat(sum.fresh, 'Nowe'), ui.stat(sum.learning, 'W nauce'), ui.stat(sum.mature, 'Utrwalone'), ui.stat(sum.due, 'Do powtórki dziś'), ui.stat(sum.errors, 'Błędy')),
      h('div.pr-stackbar', { role: 'img', 'aria-label': 'Utrwalone: ' + sum.mature + ', w nauce: ' + sum.learning + ', nowe: ' + sum.fresh }, seg('m', sum.mature), seg('l', sum.learning)),
      h('div.row.tiny.muted', h('span.pr-key.m', 'utrwalone'), h('span.pr-key.l', 'w nauce'), h('span.pr-key', 'nowe')),
      parts.length ? h('p.small.muted', 'Poza pulą: ' + parts.join('; ') + '.') : null));

    /* 2. Szybki start */
    var due = Q.pool({ state: 'due' }), errs = Q.pool({ state: 'errors' }), fresh = today.newQ;
    var weekNames = today.topics.map(function (c) { return P.topicName(c, true); });
    R.appendChild(h('section.card', h('h2', 'Szybki start'), h('div.pr-tiles',
      tile('Powtórki na dziś', due.length, due.length ? 'Najstarsze terminy najpierw, najwyżej ' + set.cap + ' w jednej sesji.' : 'Żadne pytanie nie ma dziś terminu powtórki.', function () {
        var ids = due.slice().sort(function (a, b) { return P.srs.get('q', a.id)[1] - P.srs.get('q', b.id)[1]; }).slice(0, set.cap).map(function (q) { return q.id; });
        P.practice.start({ mode: 'powtorka', ids: ids, label: 'Powtórki na dziś' });
      }, !due.length),
      tile('Moje błędy', errs.length, errs.length ? 'Pytania, w których ostatnia odpowiedź była błędna.' : 'Nie ma pytań z ostatnią odpowiedzią błędną.', function () {
        P.practice.start({ mode: 'nauka', ids: U.shuffle(errs).slice(0, set.cap).map(function (q) { return q.id; }), label: 'Moje błędy' });
      }, !errs.length),
      tile('Nowe z tematu tygodnia', fresh.length, weekNames.length ? (weekNames.length > 3 ? F.plural(weekNames.length, 'temat', 'tematy', 'tematów') + ' bieżącego tygodnia' : weekNames.join(', ')) + '. Najwyżej ' + set.newQ + ' w jednej sesji.' : 'Bieżący tydzień planu nie ma przypisanych tematów.', function () {
        P.practice.start({ mode: 'nauka', ids: U.shuffle(fresh).slice(0, set.newQ).map(function (q) { return q.id; }), label: 'Nowe pytania: ' + (weekNames.length > 2 ? 'temat tygodnia' : weekNames.join(', ')) });
      }, !fresh.length))));

    R.appendChild(ownCard(pool));
    R.appendChild(browseCard());
  }

  /* 3. Własna sesja */
  function ownCard(pool) {
    var counts = {}, boxes = {}, toggles = [];
    pool.forEach(function (q) { counts[q.topic] = (counts[q.topic] || 0) + 1; });
    Object.keys(form.topics).forEach(function (c) { if (!counts[c]) delete form.topics[c]; });
    var info = h('span.small.muted', { 'aria-live': 'polite' }), startBtn = ui.btn('Rozpocznij', start, 'primary');
    function selected() { return Object.keys(form.topics).filter(function (c) { return form.topics[c]; }); }
    function update() {
      var n = Q.pool({ topics: selected(), state: form.state }).length;
      P.clear(info); info.appendChild(document.createTextNode('Pytania spełniające warunki: ')); info.appendChild(h('b.num', n));
      startBtn.disabled = !n;
      toggles.forEach(function (t) { t(); });
    }
    function start() {
      var t = selected(), st = STATES.filter(function (s) { return s.value === form.state; })[0];
      var names = !t.length ? 'wszystkie tematy' : t.length <= 2 ? t.map(function (c) { return P.topicName(c, true); }).join(', ') : F.plural(t.length, 'temat', 'tematy', 'tematów');
      P.practice.start({ mode: form.state === 'due' ? 'powtorka' : 'nauka', filter: { topics: t, state: form.state }, n: form.n, label: 'Własna sesja: ' + names + (form.state !== 'all' ? ' · ' + st.label : '') });
    }
    var blocks = P.data.plan.blocks.map(function (b) {
      var ts = P.data.topics.filter(function (t) { return t.block === b.id; });
      if (!ts.length) return null;
      var avail = ts.filter(function (t) { return counts[t.code]; }), id = 'pr-b-' + b.id;
      function allOn() { return avail.length > 0 && avail.every(function (t) { return form.topics[t.code]; }); }
      var tg = ui.btn('Zaznacz blok', function () {
        var on = !allOn();
        avail.forEach(function (t) { form.topics[t.code] = on; boxes[t.code].checked = on; });
        update();
      }, 'ghost sm');
      tg.disabled = !avail.length;
      toggles.push(function () { tg.textContent = allOn() ? 'Odznacz blok' : 'Zaznacz blok'; });
      return h('div.pr-block', { role: 'group', 'aria-labelledby': id },
        h('div.pr-block-head', h('span', { id: id }, h('span.label', 'Blok ' + b.id), ' ', h('b', b.name)), tg),
        h('div.pr-topics', ts.map(function (t) {
          var n = counts[t.code] || 0;
          var inp = boxes[t.code] = h('input', { type: 'checkbox', checked: !!form.topics[t.code], disabled: !n, onchange: function () { form.topics[t.code] = inp.checked; update(); } });
          return h('label.pr-topic' + (n ? '' : '.off'), { title: t.name }, inp, h('span', t.short), h('span.num.tiny', n));
        })));
    });
    var card = h('section.card', h('div.card-head', h('h2', 'Własna sesja'), h('span.small.muted', 'Bez zaznaczenia sesja obejmuje wszystkie tematy.')),
      blocks,
      h('div.pr-form', ui.field('Stan pytań', ui.select(STATES, form.state, function (v) { form.state = v; update(); })),
        h('div.field', h('span', 'Liczba pytań'), labelled(ui.seg([10, 20, 30, 40].map(function (n) { return { value: n, label: String(n) }; }), form.n, function (v) { form.n = v; }), 'Liczba pytań'))),
      h('div.row.between', info, startBtn));
    update();
    return card;
  }

  /* 4. Przeglądanie i 5. własne pytanie */
  function browseCard() {
    var list = h('div.pr-list'), info = h('p.small.muted', { 'aria-live': 'polite' }), hay = {};
    function text(q) { return hay[q.id] || (hay[q.id] = fold([q.q, q.a, q.b, q.c, q.basis, 'nr ' + q.id].join(' '))); }
    function run() {
      P.clear(list);
      if (!(browse.text.trim() || browse.topic || browse.sheet !== '' || browse.all)) {
        info.textContent = 'Wpisz szukane słowa albo wybierz temat lub arkusz.';
        list.appendChild(h('div', ui.btn('Pokaż wszystkie pytania', function () { browse.all = true; run(); }, 'sm')));
        return;
      }
      var terms = fold(browse.text).split(/\s+/).filter(Boolean), hidden = 0;
      var res = Q.all().filter(function (q) {
        if (browse.topic && q.topic !== browse.topic) return false;
        if (browse.sheet !== '' && String(q.sheet) !== browse.sheet) return false;
        var t = text(q);
        if (!terms.every(function (x) { return t.indexOf(x) >= 0; })) return false;
        if (Q.isReserved(q)) { hidden++; return false; }
        return true;
      });
      info.textContent = 'Znaleziono: ' + plQ(res.length) + '.' + (hidden ? ' Ukryto ' + plQ(hidden) + ' z arkuszy zarezerwowanych na próby generalne; odsłoni je rozwiązanie arkusza jako egzaminu.' : '');
      res.slice(0, browse.limit).forEach(function (q) {
        var chips = [!Q.key(q) ? ui.chip('brak klucza', 'warn') : null, Q.isError(q) ? ui.chip('błąd', 'bad') : null, Q.flagged(q) ? ui.chip('oznaczone', 'accent') : null,
          q.stan && q.stan !== 'aktualne' ? ui.chip('zmieniony stan prawny', 'warn') : null];
        list.appendChild(resultRow(q, chips, function () { openDetails(q, { onChange: run, onClose: null }); }));
      });
      if (res.length > browse.limit) list.appendChild(h('div.pr-more', ui.btn('Pokaż więcej', function () { browse.limit += 50; run(); }, 'sm'),
        h('span.small.muted', 'Wyświetlono ' + browse.limit + ' z ' + res.length + '.')));
    }
    var reset = function () { browse.limit = 50; run(); };
    var search = h('input.input', { type: 'search', placeholder: 'np. droga pożarowa, § 271, hydrant', value: browse.text, autocomplete: 'off',
      oninput: U.debounce(function () { browse.text = search.value; reset(); }, 180) });
    var sheets = [{ value: '', label: 'Wszystkie arkusze' }];
    for (var n = 1; n <= examCfg().sheets; n++) sheets.push({ value: String(n), label: 'Arkusz ' + n + (sheetYear(n) ? ' (' + sheetYear(n) + ')' : '') + (sheetReserved(n) ? ' – zarezerwowany' : '') });
    if ((P.store.get('notes').customQ || []).length) sheets.push({ value: '0', label: 'Własne pytania' });
    var card = h('section.card', h('div.card-head', h('h2', 'Przeglądaj pytania'), ui.btn('Dodaj własne pytanie', function () { openAdd(); }, 'sm')),
      h('div.pr-filters', ui.field('Szukaj w treści, odpowiedziach i podstawie', search),
        ui.field('Temat', topicSelect(browse.topic, function (v) { browse.topic = v; reset(); }, 'Wszystkie tematy')),
        ui.field('Arkusz', ui.select(sheets, browse.sheet, function (v) { browse.sheet = v; reset(); }))),
      info, list);
    run();
    return card;
  }

  function openAdd() {
    var f = { q: h('textarea.input.pr-note', { rows: 3 }), a: h('input.input', { type: 'text' }), b: h('input.input', { type: 'text' }), c: h('input.input', { type: 'text' }) };
    var key = '', topic = P.today().topics[0] || 'Z9', err = h('p.small.pr-err', { role: 'alert' });
    var body = h('div.stack', ui.field('Treść pytania', f.q), ui.field('Odpowiedź A', f.a), ui.field('Odpowiedź B', f.b), ui.field('Odpowiedź C', f.c),
      h('div.stack.tight', h('span.pr-flabel', 'Poprawna odpowiedź'), labelled(ui.seg(LET.map(function (l) { return { value: l, label: up(l) }; }), key, function (v) { key = v; }), 'Poprawna odpowiedź')),
      ui.field('Temat', topicSelect(topic, function (v) { topic = v; }, '')), err);
    ui.modal({ title: 'Dodaj własne pytanie', body: body, actions: [{ label: 'Anuluj' }, { label: 'Dodaj pytanie', cls: 'primary', onClick: function () {
      var v = { q: f.q.value.trim(), a: f.a.value.trim(), b: f.b.value.trim(), c: f.c.value.trim() };
      if (!v.q || !v.a || !v.b || !v.c) { err.textContent = 'Uzupełnij treść pytania i wszystkie trzy odpowiedzi.'; return false; }
      if (!key) { err.textContent = 'Wskaż poprawną odpowiedź.'; return false; }
      var notes = P.store.get('notes');
      (notes.customQ = notes.customQ || []).push({ id: 'c' + U.uid(), q: v.q, a: v.a, b: v.b, c: v.c, key: key, ans: key, ansNow: '=', topic: topic, conf: 'własne', stan: 'aktualne', sheet: 0, norms: [], basis: '', expl: '', t: Date.now() });
      P.store.save('notes'); ui.toast('Dodano pytanie');
      if (!onScreen && P.router.current().name === 'pytania') startScreen();
    } }] });
  }

  /* ================= sesja: nauka i powtórka ================= */
  function sessionList(o) {
    var list, n;
    if (o.ids && o.ids.length) { list = byIds(o.ids); n = o.n || list.length; }
    else {
      var f = {}, src = o.filter || {};
      Object.keys(src).forEach(function (k) { f[k] = src[k]; });
      if (o.sheet && !f.sheet) f.sheet = +o.sheet;
      if (o.mode === 'powtorka' && !f.state && !f.sheet) f.state = 'due';
      list = Q.pool(f);
      if (f.sheet) list.sort(function (a, b) { return a.id - b.id; });
      else if (f.state === 'due') list = U.shuffle(list).sort(function (a, b) { return P.srs.get('q', a.id)[1] - P.srs.get('q', b.id)[1]; });
      else list = U.shuffle(list);
      n = o.n || (f.sheet ? list.length : o.mode === 'powtorka' ? P.settings().cap : 20);
    }
    return list.slice(0, n);
  }
  function sessionItems() { return S.order.map(function (id) { return S.done[id]; }); }
  function clockTick() { var now = Date.now(); S.activeMs += Math.min(now - S.lastTick, 300000); S.lastTick = now; }

  function emptyStart(o, exam) {
    S = null; onScreen = false; P.clear(R);
    R.appendChild(head(exam ? 'Egzamin próbny' : 'Pytania'));
    R.appendChild(ui.empty('Brak pytań spełniających warunki' + (exam ? ' tego egzaminu.' : ' tej sesji.'), ui.btn('Wróć', function () { goBack(o.returnTo, exam ? 'egzamin' : 'pytania'); }, 'primary')));
  }

  function startSession(o) {
    var list = sessionList(o);
    if (!list.length) { emptyStart(o, false); return; }
    var mode = o.mode === 'powtorka' ? 'powtorka' : 'nauka';
    S = { kind: 'sesja', opts: o, mode: mode, label: o.label || (mode === 'powtorka' ? 'Powtórka' : 'Sesja pytań'), queue: list.map(function (q) { return { q: q, retry: false }; }),
      pos: 0, done: {}, order: [], phase: 'ask', choice: null, cur: null, activeMs: 0, lastTick: Date.now(), complete: false, logId: null };
    sessionView(true);
  }

  function sessionView(top) {
    var it = S.queue[S.pos], q = it.q, shown = S.phase === 'shown', total = S.queue.length, focusEl;
    onScreen = true; P.clear(R);
    R.appendChild(h('div.row.between.pr-head',
      h('div.stack.tight.grow', h('span.label', S.mode === 'powtorka' ? 'Powtórka' : 'Tryb nauki'), h('h1.pr-title', S.label)),
      ui.btn('Zakończ sesję', endEarly, 'sm')));
    R.appendChild(ui.bar((S.pos + (shown ? 1 : 0)) / total));
    var card = h('section.card.pr-q', { tabIndex: -1, 'aria-label': 'Pytanie ' + (S.pos + 1) + ' z ' + total });
    card.appendChild(h('div.row', h('span.num.small.pr-count', 'Pytanie ' + (S.pos + 1) + ' z ' + total), metaChips(q),
      it.retry ? ui.chip('ponowna próba', 'accent') : null, Q.flagged(q) ? ui.chip('oznaczone', 'accent') : null));
    card.appendChild(h('p.q-text', q.q));
    if (!shown) {
      var btns = {}, bSure = ui.btn('Sprawdź: jestem pewny', function () { check(true); }, 'primary'), bGuess = ui.btn('Sprawdź: zgaduję', function () { check(false); });
      bSure.disabled = bGuess.disabled = !S.choice;
      S.pick = function (l) {
        S.choice = l;
        LET.forEach(function (x) { btns[x].setAttribute('aria-pressed', String(x === l)); });
        bSure.disabled = bGuess.disabled = false;
      };
      card.appendChild(h('div.stack.pr-opts', LET.map(function (l) {
        return btns[l] = h('button.opt', { type: 'button', 'aria-pressed': String(S.choice === l), dataset: { l: l }, onclick: function () { S.pick(l); } }, h('span.letter', up(l)), h('span.grow', q[l]));
      })));
      card.appendChild(h('div.pr-actions', bSure, bGuess, ui.btn('Pomiń', skip, 'ghost')));
      focusEl = card;
    } else {
      var c = S.cur, key = Q.key(q), ok = c.choice === key, when = P.srs.nextText(P.srs.get('q', q.id)), msg;
      if (it.retry) msg = (ok ? 'Ponowna próba udana.' : 'Poprawna odpowiedź: ' + up(key) + '.') + ' Ponowna próba nie zmienia terminu powtórki (' + when + ').';
      else if (ok) msg = (c.sure ? 'Odpowiedź pewna i trafna: na egzaminie +1 pkt.' : 'Zgadywanie trafione: na egzaminie +1 pkt. Pytanie wróci wcześniej niż po odpowiedzi pewnej.') + ' Następna powtórka: ' + when + '.';
      else msg = 'Poprawna odpowiedź: ' + up(key) + '. ' + (c.sure ? 'Odpowiedź była oznaczona jako pewna: na egzaminie −1 pkt.' : 'Zgadywanie nietrafione: na egzaminie −1 pkt, a brak odpowiedzi dałby 0.') + ' Następna powtórka: ' + when + '.';
      var verdict = ui.banner(ok ? 'ok' : 'bad', ok ? 'Dobrze' : 'Źle', msg);
      verdict.setAttribute('role', 'status');
      var nextBtn = ui.btn('Dalej', next, 'primary');
      card.appendChild(staticOptions(q, c.choice));
      card.appendChild(verdict);
      card.appendChild(explain(q));
      card.appendChild(noteField(q));
      card.appendChild(h('div.row.between', h('div.row', keyFixBtn(q, function (changed) { if (changed) sessionKeyChanged(q); }), flagBtn(q)), nextBtn));
      focusEl = nextBtn;
    }
    R.appendChild(card);
    R.appendChild(h('p.tiny.muted.pr-keys', 'Klawiatura: A, B, C lub 1, 2, 3 – wybór odpowiedzi; Enter – sprawdź jako pewny; N lub strzałka w prawo – dalej.'));
    setKeys(sessionKeys);
    if (top) window.scrollTo(0, 0);
    try { focusEl.focus({ preventScroll: true }); } catch (e) { /* starsze przeglądarki */ }
  }

  function sessionKeys(e) {
    if (!S || S.kind !== 'sesja' || ignoreKey(e)) return;
    var t = e.target, isBtn = t && (t.tagName === 'BUTTON' || t.tagName === 'A'), isOpt = isBtn && t.classList.contains('opt');
    if (S.phase === 'ask') {
      var l = keyLetter(e);
      if (l) { e.preventDefault(); S.pick(l); return; }
      if (e.key === 'Enter') {
        if (isBtn && !isOpt) return;                       /* zwykły przycisk obsłuży kliknięcie */
        if (isOpt && t.dataset.l !== S.choice) return;     /* Enter na innej odpowiedzi najpierw ją wybiera */
        if (S.choice) { e.preventDefault(); check(!e.shiftKey); }
      }
    } else if (S.phase === 'shown') {
      if (String(e.key).toLowerCase() === 'n' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
    }
  }

  function check(sure) {
    if (!S || S.phase !== 'ask' || !S.choice) return;
    var it = S.queue[S.pos], q = it.q, ok = S.choice === Q.key(q);
    clockTick();
    if (!it.retry) {
      Q.answer(q, S.choice, sure);
      S.done[q.id] = { q: q, choice: S.choice, sure: sure, ok: ok, retry: null };
      S.order.push(q.id);
      if (!ok) S.queue.push({ q: q, retry: true });
    } else if (S.done[q.id]) S.done[q.id].retry = S.choice;   /* ponowna próba nie zmienia terminu powtórki */
    S.cur = { choice: S.choice, sure: sure };
    S.phase = 'shown';
    sessionView(false);
  }
  function skip() {
    if (!S || S.phase !== 'ask') return;
    var it = S.queue[S.pos];
    clockTick();
    if (!it.retry) { S.done[it.q.id] = { q: it.q, choice: null, sure: null, ok: null, retry: null }; S.order.push(it.q.id); }
    advance();
  }
  function next() { if (S && S.phase === 'shown') { clockTick(); advance(); } }
  function advance() {
    S.pos++; S.choice = null; S.cur = null; S.phase = 'ask';
    if (S.pos >= S.queue.length) finishSession(true); else sessionView(true);
  }
  function sessionKeyChanged(q) {
    var d = S.done[q.id], it = S.queue[S.pos];
    regrade(d);
    if (d && d.choice && !it.retry) {
      var idx = -1;
      S.queue.forEach(function (x, i) { if (i > S.pos && x.retry && x.q.id === q.id) idx = i; });
      if (d.ok && idx >= 0) S.queue.splice(idx, 1);
      else if (!d.ok && idx < 0) S.queue.push({ q: q, retry: true });
    }
    sessionView(false);
  }
  function endEarly() {
    var left = S.queue.length - S.pos - (S.phase === 'shown' ? 1 : 0);
    if (!S.order.length) { var o = S.opts; S = null; goBack(o.returnTo, 'pytania'); return; }
    if (left <= 0) { finishSession(true); return; }
    ui.confirm('Zakończyć sesję?', 'Pozostałe pytania w kolejce: ' + left + '. Udzielone odpowiedzi są już zapisane.', 'Zakończ sesję').then(function (yes) { if (yes && S && S.kind === 'sesja' && S.phase !== 'done') finishSession(false); });
  }

  function finishSession(complete) {
    if (!S || S.kind !== 'sesja' || S.phase === 'done') return;
    clockTick(); stopKeys();
    S.phase = 'done'; S.complete = !!complete;
    var items = sessionItems(), r = P.exam.score(items), topics = [];
    items.forEach(function (d) { if (topics.indexOf(d.q.topic) < 0) topics.push(d.q.topic); });
    var e = P.log.session({ type: S.mode === 'powtorka' ? 'powtorka' : 'quiz', label: S.label, n: r.n, ok: r.ok, bad: r.bad, skip: r.skip, points: r.points, min: Math.max(1, Math.round(S.activeMs / 60000)), topics: topics });
    S.logId = e.id;
    if (complete && S.opts.taskId) P.plan.setTask(S.opts.taskId, true);
    navRefresh();
    if (P.router.current().name === 'pytania' && P.router.current().param === 'sesja') sessionEnd(); else P.router.go('pytania', 'sesja');
  }

  function sessionEnd() {
    onScreen = true; stopKeys(); P.clear(R);
    var items = sessionItems(), r = P.exam.score(items), o = S.opts;
    var wrong = items.filter(function (d) { return d.choice && d.choice !== Q.key(d.q); });
    var retried = items.filter(function (d) { return d.retry; }), retryOk = retried.filter(function (d) { return d.retry === Q.key(d.q); }).length;
    R.appendChild(h('div.view-head', h('div.stack.tight', h('span.label', 'Koniec sesji'), h('h1.pr-title', S.label))));
    var card = h('section.card', h('div.pr-stats', ui.stat(r.ok, 'Poprawne'), ui.stat(r.bad, 'Błędne'), ui.stat(r.skip, 'Pominięte'), ui.stat(r.ok + r.bad ? F.pct(r.accuracy) : '–', 'Trafność')));
    if (!S.complete) card.appendChild(h('p.small.muted', 'Sesja zakończona przed końcem kolejki. Wynik obejmuje ' + plQ(r.n) + '.'));
    if (retried.length) card.appendChild(h('p.small.muted', 'Ponowne próby błędnych pytań: ' + retryOk + ' z ' + retried.length + ' poprawnie. Te pytania i tak wrócą jutro.'));
    if (r.n >= 10) {
      card.appendChild(h('hr.divider'));
      card.appendChild(h('div.row.between', h('span', 'W punktacji egzaminu (+1, −1, 0): ', h('b.num', F.signed(r.points) + ' pkt')), h('span.small.muted', 'próg dla ' + plQ(r.n) + ': ' + r.passMark + ' pkt')));
      card.appendChild(scaleAxis(r.points, r.n, r.passMark));
    }
    R.appendChild(card);
    if (items.length) R.appendChild(h('section.card', h('h2', 'Wynik według tematów'), topicTable(items)));
    if (wrong.length) R.appendChild(h('section.card', h('div.card-head', h('h2', 'Błędne odpowiedzi'), h('span.small.muted', 'Wybierz pytanie, aby zobaczyć wyjaśnienie.')),
      h('div.pr-list', wrong.map(function (d) {
        return resultRow(d.q, [ui.chip('Twoja odpowiedź: ' + up(d.choice), 'bad'), ui.chip('klucz: ' + up(Q.key(d.q)), 'ok')], function () {
          openDetails(d.q, { choice: d.choice, onChange: function () { regrade(d); relog(); sessionEnd(); } });
        });
      }))));
    R.appendChild(h('div.row.end', wrong.length ? ui.btn('Powtórz błędne', function () {
      P.practice.start({ mode: 'nauka', ids: wrong.map(function (d) { return d.q.id; }), label: 'Błędne z sesji', returnTo: o.returnTo });
    }) : null, ui.btn('Zakończ', function () { S = null; goBack(o.returnTo, 'pytania'); }, 'primary')));
  }

  /* ================= #egzamin ================= */
  function drawRandom(n) {
    var pool = Q.pool({}), N = pool.length;
    if (N <= n) return U.shuffle(pool);
    var by = U.groupBy(pool, function (q) { return q.topic || 'Z9'; });
    var quota = Object.keys(by).map(function (c) { var x = by[c].length * n / N; return { c: c, k: Math.floor(x), rem: x - Math.floor(x) }; });
    var left = n - U.sum(quota, function (x) { return x.k; });
    quota.slice().sort(function (a, b) { return b.rem - a.rem; }).forEach(function (x, i) { if (i < left) x.k++; });
    var out = [], dups = {}, have = {};
    quota.forEach(function (x) {
      var taken = 0;
      U.shuffle(by[x.c]).forEach(function (q) {
        if (taken >= x.k || (q.dup != null && dups[q.dup])) return;
        if (q.dup != null) dups[q.dup] = 1;
        out.push(q); have[q.id] = 1; taken++;
      });
    });
    U.shuffle(pool).forEach(function (q) { if (out.length < n && !have[q.id]) { out.push(q); have[q.id] = 1; } });
    return U.shuffle(out);
  }
  function examList(o) {
    var cfg = examCfg();
    if (o.sheet) return Q.pool({ sheet: +o.sheet }).sort(function (a, b) { return a.id - b.id; });
    if (o.ids && o.ids.length) return byIds(o.ids).slice(0, o.n || o.ids.length);
    if (o.filter) return U.shuffle(Q.pool(o.filter)).slice(0, o.n || cfg.n);
    return drawRandom(o.n || cfg.n);
  }

  function examStart() {
    onScreen = false; P.clear(R);
    var cfg = examCfg(), ses = P.log.sessions('egzamin'), errs = Q.pool({ state: 'errors' }).length, poolN = Q.pool({}).length;
    R.appendChild(head('Egzamin próbny', 'Część pisemna w warunkach egzaminu: limit czasu, punkty ujemne i żadnych podpowiedzi przed końcem.'));
    var ub = unfinished(examStart);
    if (ub) R.appendChild(ub);
    R.appendChild(h('section.card', h('h2', 'Zasady'), h('ol.pr-rules',
      h('li', cfg.n + ' pytań, w każdym trzy odpowiedzi i jedna poprawna.'),
      h('li', 'Czas: ' + cfg.min + ' minut. Po jego upływie egzamin kończy się sam.'),
      h('li', 'Punktacja: +1 za dobrą odpowiedź, −1 za złą, 0 za brak odpowiedzi.'),
      h('li', 'Zalicza ' + cfg.pass + ' pkt. Część ustna jest osobnym etapem i ten test jej nie obejmuje.')),
      h('p.small.muted', 'Odpowiedzi podawane bez pewności oznaczaj jako niepewne. Po egzaminie zobaczysz, czy takie odpowiedzi dodają punkty, czy je odbierają.')));

    var firstOpen = 0, rows = [];
    for (var i = 1; i <= cfg.sheets; i++) (function (n) {
      var keyed = Q.pool({ sheet: n }).length, total = P.data.questions.filter(function (q) { return q.sheet === n; }).length;
      var mine = ses.filter(function (s) { return s.sheet === n; }), best = null, res = sheetReserved(n), y = sheetYear(n);
      mine.forEach(function (s) { if (!best || (s.points || 0) > (best.points || 0)) best = s; });
      if (!firstOpen && keyed && !mine.length && !res) firstOpen = n;
      var b = ui.btn('Rozpocznij', function () {
        function go() { P.router.go('egzamin', 'sesja', { mode: 'egzamin', sheet: n }); }
        if (!res) { go(); return; }
        ui.confirm('Arkusz zarezerwowany', 'Arkusz ' + n + ' jest odłożony na próbę generalną w ostatnim tygodniu planu, żeby sprawdzić się na pytaniach niewidzianych wcześniej. Po rozwiązaniu jego pytania trafią do zwykłej puli. Rozpocząć mimo to?', 'Rozpocznij').then(function (yes) { if (yes) go(); });
      }, 'sm');
      b.disabled = !keyed; b.setAttribute('aria-label', 'Rozpocznij arkusz ' + n);
      var notes = [];
      if (best) notes.push(ui.chip('najlepszy wynik: ' + F.signed(best.points || 0) + ' pkt', best.passed ? 'ok' : 'bad'), h('span', 'podejścia: ' + mine.length));
      else if (keyed) notes.push(h('span', 'jeszcze nierozwiązany'));
      if (!keyed) notes.push(h('span', 'Klucz odpowiedzi do tego arkusza nie jest jeszcze opracowany.'));
      else if (keyed < total) notes.push(h('span', 'Klucz ma ' + keyed + ' z ' + total + ' pytań; pozostałe są pominięte, a próg i czas przeliczone.'));
      rows.push({ n: n, btn: b, el: h('div.pr-sheet',
        h('div.stack.tight', h('div.row', h('b', 'Arkusz ' + n), y ? h('span.small.muted', 'egzamin z ' + y + ' r.') : null, res ? ui.chip('zarezerwowany', 'warn') : null, !keyed ? ui.chip('brak klucza', 'warn') : null),
          h('div.row.small.muted', notes)), b) });
    })(i);
    rows.forEach(function (r) { if (r.n === firstOpen) r.btn.classList.add('primary'); });
    var solved = rows.filter(function (r) { return ses.some(function (s) { return s.sheet === r.n; }); }).length;
    R.appendChild(h('section.card', h('div.card-head', h('h2', 'Arkusze egzaminacyjne 2015–2026'), h('span.small.muted', 'Rozwiązane: ' + solved + ' z ' + cfg.sheets)),
      h('div.pr-sheets', rows.map(function (r) { return r.el; }))));

    R.appendChild(h('section.card', h('h2', 'Inne zestawy'), h('div.pr-tiles',
      tile('Egzamin losowy', null, Math.min(cfg.n, poolN) + ' pytań z puli bez arkuszy zarezerwowanych, w proporcji do liczby pytań w tematach.', function () {
        P.router.go('egzamin', 'sesja', { mode: 'egzamin', label: 'Egzamin losowy' });
      }, !poolN),
      errs >= 20 ? tile('Egzamin z moich błędów', null, Math.min(cfg.n, errs) + ' pytań spośród ' + errs + ' z ostatnią odpowiedzią błędną.', function () {
        P.router.go('egzamin', 'sesja', { mode: 'egzamin', filter: { state: 'errors' }, n: cfg.n, label: 'Egzamin z moich błędów' });
      }) : null)));
  }

  function startExam(o) {
    var list = examList(o), cfg = examCfg();
    if (!list.length) { emptyStart(o, true); return; }
    var sheet = o.sheet ? +o.sheet : null, limit = Math.max(1, Math.round(list.length * cfg.min / cfg.n)) * 60000, now = Date.now();
    S = { kind: 'egzamin', opts: o, sheet: sheet, label: o.label || (sheet ? sheetName(sheet) : 'Egzamin losowy'), items: list.map(function (q) { return { q: q, choice: null, unsure: false, sure: null, ok: null }; }),
      pos: 0, phase: 'run', limit: limit, startTs: now, endAt: now + limit, warned: {}, timerEl: null, open: {}, filter: 'all', logId: null, auto: false, usedMs: 0 };
    examView(true);
  }

  function cellState(x, i) {
    var cls = (x.choice ? '.ans' : '') + (x.unsure ? '.uns' : '') + (i === S.pos ? '.cur' : '');
    var label = 'Pytanie ' + (i + 1) + (x.choice ? ', z odpowiedzią' : ', bez odpowiedzi') + (x.unsure ? ', oznaczone jako niepewne' : '') + (i === S.pos ? ', bieżące' : '');
    return { cls: cls, label: label };
  }

  function examView(top) {
    var it = S.items[S.pos], q = it.q, n = S.items.length, last = S.pos === n - 1, btns = {}, cells, count = h('span.small.muted');
    onScreen = true; P.clear(R);
    S.timerEl = h('div.pr-timer.num', { role: 'timer', 'aria-label': 'Pozostały czas' });
    R.appendChild(h('div.pr-bar', h('div.stack.tight.grow', h('span.label', 'Egzamin próbny'), h('b.pr-bar-t', S.label)), S.timerEl, ui.btn('Zakończ egzamin', askFinish, 'sm')));
    function refresh() {
      LET.forEach(function (l) { btns[l].setAttribute('aria-pressed', String(it.choice === l)); });
      none.setAttribute('aria-pressed', String(!it.choice));
      var st = cellState(it, S.pos);
      cells[S.pos].className = 'pr-n' + st.cls.replace(/\./g, ' '); cells[S.pos].setAttribute('aria-label', st.label);
      var a = S.items.filter(function (x) { return x.choice; }).length, u = S.items.filter(function (x) { return x.unsure; }).length;
      count.textContent = 'Z odpowiedzią: ' + a + ' z ' + n + (u ? ' · niepewne: ' + u : '');
    }
    S.pick = function (l) { it.choice = l; refresh(); };
    var none = h('button.opt.pr-none', { type: 'button', 'aria-pressed': 'true', onclick: function () { S.pick(null); } }, h('span.letter', '–'), h('span.grow', 'Bez odpowiedzi — 0 pkt'));
    var card = h('section.card.pr-q', { tabIndex: -1, 'aria-label': 'Pytanie ' + (S.pos + 1) + ' z ' + n },
      h('div.row.between', h('span.num.small.pr-count', 'Pytanie ' + (S.pos + 1) + ' z ' + n),
        ui.check('Niepewne', it.unsure, function (v) { it.unsure = v; refresh(); })),
      h('p.q-text', q.q),
      h('div.stack.pr-opts', LET.map(function (l) {
        return btns[l] = h('button.opt', { type: 'button', 'aria-pressed': 'false', onclick: function () { S.pick(l); } }, h('span.letter', up(l)), h('span.grow', q[l]));
      }), none),
      h('div.row.between', ui.btn('Poprzednie', function () { move(-1); }, S.pos ? '' : 'pr-hidden'),
        last ? ui.btn('Zakończ egzamin', askFinish, 'primary') : ui.btn('Następne', function () { move(1); }, 'primary')));
    R.appendChild(card);
    cells = S.items.map(function (x, i) {
      var st = cellState(x, i);
      return h('button.pr-n' + st.cls, { type: 'button', 'aria-label': st.label, onclick: function () { S.pos = i; examView(true); } }, String(i + 1));
    });
    R.appendChild(h('section.card', h('div.card-head', h('h2', 'Pytania'), count), h('div.pr-grid', cells),
      h('div.row.tiny.muted.pr-legend', h('span', h('i.pr-n.ans'), 'z odpowiedzią'), h('span', h('i.pr-n'), 'bez odpowiedzi'), h('span', h('i.pr-n.uns'), 'niepewne'), h('span', h('i.pr-n.cur'), 'bieżące'))));
    R.appendChild(h('p.tiny.muted.pr-keys', 'Klawiatura: A, B, C lub 1, 2, 3 – odpowiedź; 0 – bez odpowiedzi; strzałki w lewo i w prawo – poprzednie i następne pytanie.'));
    refresh();
    setKeys(examKeys); startTimer();
    if (top) window.scrollTo(0, 0);
    try { card.focus({ preventScroll: true }); } catch (e) { /* starsze przeglądarki */ }
  }
  function move(d) { var p = S.pos + d; if (p < 0 || p >= S.items.length) return; S.pos = p; examView(true); }
  function examKeys(e) {
    if (!S || S.kind !== 'egzamin' || S.phase !== 'run' || ignoreKey(e)) return;
    var l = keyLetter(e), k = String(e.key).toLowerCase();
    if (l) { e.preventDefault(); S.pick(l); }
    else if (k === '0') { e.preventDefault(); S.pick(null); }
    else if (k === 'arrowright' || k === 'n') { e.preventDefault(); move(1); }
    else if (k === 'arrowleft') { e.preventDefault(); move(-1); }
  }
  function startTimer() {
    stopTimer();
    function upd() {
      if (!S || S.kind !== 'egzamin' || S.phase !== 'run') { stopTimer(); return; }
      var left = S.endAt - Date.now(), s = Math.ceil(left / 1000), el = S.timerEl;
      if (left <= 0) { finishExam(true); return; }
      el.textContent = clock(left);
      el.classList.toggle('low', s <= 300 && s > 60); el.classList.toggle('last', s <= 60);
      if (s <= 300 && s > 60 && !S.warned.five && S.limit > 300000) { S.warned.five = 1; ui.toast('Zostało 5 minut.'); }
      if (s <= 60 && !S.warned.one && S.limit > 60000) { S.warned.one = 1; S.warned.five = 1; ui.toast('Została 1 minuta.'); }
    }
    upd();
    if (S && S.phase === 'run') tick = setInterval(upd, 500);
  }
  function askFinish() {
    var blank = S.items.filter(function (x) { return !x.choice; }).length, uns = S.items.filter(function (x) { return x.unsure; }).length;
    var text = (blank ? 'Bez odpowiedzi: ' + plQ(blank) + ' (po 0 pkt). ' : 'Wszystkie pytania mają odpowiedź. ') + (uns ? 'Oznaczone jako niepewne: ' + uns + '. ' : '') + 'Po zakończeniu nie można zmienić odpowiedzi.';
    ui.confirm('Zakończyć egzamin?', text, 'Zakończ egzamin').then(function (yes) { if (yes) finishExam(false); });
  }

  function finishExam(auto) {
    if (!S || S.kind !== 'egzamin' || S.phase !== 'run') return;
    stopTimer(); stopKeys();
    if (auto && document.querySelector('.modal-back')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    S.phase = 'done'; S.auto = !!auto; S.usedMs = Math.min(S.limit, Date.now() - S.startTs);
    S.items.forEach(function (x) { if (x.choice) { x.sure = !x.unsure; x.ok = Q.answer(x.q, x.choice, !x.unsure).ok; } });
    var r = P.exam.score(S.items);
    var e = P.log.session({ type: 'egzamin', sheet: S.sheet, label: S.label, n: r.n, ok: r.ok, bad: r.bad, skip: r.skip, points: r.points, passed: r.passed, min: Math.max(1, Math.round(S.usedMs / 60000)) });
    S.logId = e.id;
    if (S.sheet) { P.store.get('plan').sheets[S.sheet] = Date.now(); P.store.save('plan'); }
    if (S.opts.taskId) P.plan.setTask(S.opts.taskId, true);
    navRefresh();
    examResult(true);
  }

  function riskCard(r) {
    var ans = S.items.filter(function (x) { return x.choice; });
    var rs = P.exam.score(ans.filter(function (x) { return !x.unsure; })), ru = P.exam.score(ans.filter(function (x) { return x.unsure; }));
    var blank = S.items.filter(function (x) { return x.unsure && !x.choice; }).length, calib = P.store.get('log').calib || {};
    var card = h('section.card', h('h2', 'Analiza ryzyka'),
      ui.table(['Odpowiedzi', 'Liczba', 'Dobre', 'Złe', 'Trafność', 'Punkty'], [
        ['Pewne', rs.n, rs.ok, rs.bad, rs.n ? F.pct(rs.accuracy) : '–', F.signed(rs.points)],
        ['Oznaczone jako niepewne', ru.n, ru.ok, ru.bad, ru.n ? F.pct(ru.accuracy) : '–', F.signed(ru.points)]], [1, 2, 3, 4, 5]));
    if (!ru.n) {
      card.appendChild(h('p', 'Żadna odpowiedź nie była oznaczona jako niepewna, więc nie da się ocenić, czy zgadywanie się opłaca.' + (blank ? ' Pytania oznaczone jako niepewne zostały bez odpowiedzi (' + blank + ').' : '')));
      card.appendChild(ui.banner('', '', 'Przy punktacji +1/−1 odpowiedź opłaca się, gdy szansa trafienia przekracza 50%; na kolejnym egzaminie oznaczaj odpowiedzi podawane bez pewności, aby sprawdzić swoją trafność.'));
    } else {
      var without = r.points - ru.points, flip = (without >= r.passMark) !== r.passed, small = ru.n < 5 ? ', choć ' + F.plural(ru.n, 'odpowiedź', 'odpowiedzi', 'odpowiedzi') + ' to słaba podstawa do wniosków' : '';
      card.appendChild(h('p', 'Odpowiedzi oznaczone jako niepewne dały łącznie ' + F.signed(ru.points) + ' pkt. Gdyby te pytania pominąć, wynik wyniósłby ' + F.signed(without) + ' pkt zamiast ' + F.signed(r.points) + ' pkt' +
        (flip ? ', czyli egzamin byłby ' + (r.passed ? 'niezaliczony' : 'zaliczony') : '') + '.' + (blank ? ' Oznaczone jako niepewne i zostawione bez odpowiedzi: ' + blank + '.' : '')));
      var lead = 'Przy punktacji +1/−1 odpowiedź opłaca się, gdy szansa trafienia przekracza 50%; trafność Twoich niepewnych odpowiedzi wyniosła ' + F.pct(ru.accuracy);
      card.appendChild(ui.banner(ru.accuracy > 0.5 ? 'ok' : ru.accuracy < 0.5 ? 'warn' : '', '', lead + (ru.accuracy > 0.5 ? ', więc przy takim poziomie niepewności warto odpowiadać' : ru.accuracy < 0.5 ? ', więc takie pytania lepiej zostawiać bez odpowiedzi' : ', więc odpowiadanie niczego nie zmieniło') + small + '.'));
    }
    var cs = calib.sure || [0, 0], cu = calib.unsure || [0, 0];
    if (cs[1] + cu[1] > 0) card.appendChild(h('p.small.muted', 'We wszystkich dotychczasowych sesjach: odpowiedzi pewne ' + (cs[1] ? F.pct(cs[0] / cs[1]) + ' trafnych (z ' + cs[1] + ')' : 'bez danych') + ', niepewne ' + (cu[1] ? F.pct(cu[0] / cu[1]) + ' trafnych (z ' + cu[1] + ')' : 'bez danych') + '.'));
    return card;
  }

  function examResult(top) {
    onScreen = true; stopKeys(); stopTimer(); P.clear(R);
    var r = P.exam.score(S.items), n = r.n, o = S.opts, gap = r.points - r.passMark;
    R.appendChild(h('div.view-head', h('div.stack.tight', h('span.label', 'Wynik egzaminu'), h('h1.pr-title', S.label))));
    if (S.auto) R.appendChild(ui.banner('warn', 'Czas minął', 'Egzamin zakończył się automatycznie. Pytania bez odpowiedzi liczą się za 0 pkt.'));
    R.appendChild(h('section.card',
      h('div.pr-score', h('b.num', F.signed(r.points) + ' pkt'), h('span.chip.pr-verdict.' + (r.passed ? 'ok' : 'bad'), r.passed ? 'Zaliczony' : 'Niezaliczony'),
        h('span.muted', 'Próg: ' + r.passMark + ' pkt z ' + n + ' możliwych. ' + (gap >= 0 ? 'Zapas nad progiem: ' + gap + ' pkt.' : 'Do progu zabrakło ' + (-gap) + ' pkt.'))),
      scaleAxis(r.points, n, r.passMark),
      h('div.pr-stats', ui.stat(r.ok, 'Poprawne'), ui.stat(r.bad, 'Błędne'), ui.stat(r.skip, 'Bez odpowiedzi'), ui.stat(r.ok + r.bad ? F.pct(r.accuracy) : '–', 'Trafność'), ui.stat(clock(S.usedMs), 'Czas z ' + clock(S.limit)))));
    R.appendChild(riskCard(r));
    R.appendChild(h('section.card', h('h2', 'Wynik według tematów'), topicTable(S.items)));

    /* Przegląd pytań */
    var list = h('div.pr-list');
    function status(x) { return !x.choice ? 'skip' : x.choice === Q.key(x.q) ? 'ok' : 'bad'; }
    function draw() {
      P.clear(list);
      var shown = 0;
      S.items.forEach(function (x, i) {
        var st = status(x);
        if (S.filter === 'bad' && st !== 'bad') return;
        if (S.filter === 'skip' && st !== 'skip') return;
        if (S.filter === 'uns' && !x.unsure) return;
        shown++;
        var body = h('div.stack.pr-rev-body'), built = false;
        function build() {
          if (built) return; built = true;
          body.appendChild(h('div.row', metaChips(x.q)));
          body.appendChild(staticOptions(x.q, x.choice));
          if (!x.choice) body.appendChild(h('p.small.muted', 'Bez odpowiedzi: 0 pkt.'));
          body.appendChild(explain(x.q));
          body.appendChild(noteField(x.q));
          body.appendChild(h('div.row', keyFixBtn(x.q, function (changed) { if (changed) { regrade(x); relog(); examResult(false); } }), flagBtn(x.q)));
        }
        var det = h('details.pr-rev', { open: !!S.open[i] },
          h('summary', h('span.num', (i + 1) + '.'), h('span.pr-res-q', x.q.q),
            h('span.pr-rev-chips', x.unsure ? ui.chip('niepewne', 'warn') : null, ui.chip(st === 'ok' ? 'dobrze' : st === 'bad' ? 'źle' : 'bez odpowiedzi', st === 'ok' ? 'ok' : st === 'bad' ? 'bad' : ''))),
          body);
        if (S.open[i]) build();
        det.addEventListener('toggle', function () { S.open[i] = det.open; if (det.open) build(); });
        list.appendChild(det);
      });
      if (!shown) list.appendChild(h('p.small.muted', 'Brak pytań w tym widoku.'));
    }
    R.appendChild(h('section.card', h('div.card-head', h('h2', 'Przegląd pytań'),
      labelled(ui.seg([{ value: 'all', label: 'Wszystkie' }, { value: 'bad', label: 'Błędne' }, { value: 'skip', label: 'Bez odpowiedzi' }, { value: 'uns', label: 'Niepewne' }], S.filter, function (v) { S.filter = v; draw(); }), 'Które pytania pokazać')), list));
    draw();
    var weak = S.items.filter(function (x) { return status(x) !== 'ok'; }).map(function (x) { return x.q.id; });
    R.appendChild(h('div.row.end', weak.length ? ui.btn('Przećwicz błędne i pominięte', function () {
      P.practice.start({ mode: 'nauka', ids: weak, label: 'Po egzaminie: ' + S.label, returnTo: o.returnTo || 'egzamin' });
    }) : null, ui.btn('Zakończ', function () { S = null; goBack(o.returnTo, 'egzamin'); }, 'primary')));
    if (top) window.scrollTo(0, 0);
  }

  /* ================= rejestracja ================= */
  P.practice = { start: function (opts) { P.router.go('pytania', 'sesja', opts || { mode: 'nauka' }); } };

  P.views.pytania = {
    title: 'Pytania',
    render: function (root, param, payload) {
      R = root;
      if (param === 'sesja') {
        if (payload) {
          if (payload.mode === 'egzamin') { P.router.go('egzamin', 'sesja', payload); return; }
          startSession(payload); return;
        }
        if (S && S.kind === 'sesja') {
          if (S.phase === 'done') sessionEnd(); else { S.lastTick = Date.now(); sessionView(true); }
          return;
        }
      }
      startScreen();
    },
    leave: leave, busy: busy
  };
  P.views.egzamin = {
    title: 'Egzamin próbny',
    render: function (root, param, payload) {
      R = root;
      if (param === 'sesja') {
        if (payload) { startExam(payload); return; }
        if (S && S.kind === 'egzamin') {
          if (S.phase === 'done') examResult(true); else if (S.endAt <= Date.now()) finishExam(true); else examView(true);
          return;
        }
      }
      examStart();
    },
    leave: leave, busy: busy
  };
})();
