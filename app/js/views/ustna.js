/* Widok „Część ustna”: praca z dokumentacją do oceny (kazusy z opisem, rysunkami, pytaniami komisji i kluczem) oraz losowe pytania otwarte z lekcji.
   Trasy: #ustna (lista), #ustna-<id kazusu>, #ustna-pytania.
   Postęp: notes.cases[id] = {t, notes, revealed, found:{id usterki: 1 wskazana | -1 pominięta}, qs:{id pytania: 0|1|2}, done}. */
(function () {
  'use strict';
  var P = window.PPOZ, h = P.h, ui = P.ui, U = P.util;
  var PREP = 20 * 60, timer = null;
  var KIND = { 'błąd': ['Niezgodność', 'bad'], 'brak': ['Brak w dokumentacji', 'warn'], 'niespójność': ['Niespójność', 'warn'], 'poprawne': ['Zgodne – pułapka', 'ok'] };
  var QKIND = { ocena: 'ocena zgodności', zamienne: 'rozwiązania zamienne', ekspertyza: 'ekspertyza', procedura: 'tryb postępowania' };

  function all() { return P.data.cases || []; }
  function state(id) {
    var n = P.store.get('notes'); if (!n.cases) n.cases = {};
    if (!n.cases[id]) n.cases[id] = { t: 0, notes: '', revealed: 0, found: {}, qs: {}, done: 0 };
    var s = n.cases[id]; if (!s.found) s.found = {}; if (!s.qs) s.qs = {};
    return s;
  }
  function save(id) { state(id).t = Date.now(); P.store.save('notes'); }
  function peek(id) { var n = P.store.get('notes'); return (n.cases && n.cases[id]) || null; }
  function isIssue(f) { return f.kind !== 'poprawne'; }
  function score(c, s) {
    var issues = c.findings.filter(isIssue), traps = c.findings.filter(function (f) { return !isIssue(f); });
    var w = function (f) { return f.weight || 1; };
    return {
      issues: issues.length, found: issues.filter(function (f) { return s.found[f.id] === 1; }).length,
      weight: U.sum(issues, w), got: U.sum(issues.filter(function (f) { return s.found[f.id] === 1; }), w),
      traps: traps.length, trapsOk: traps.filter(function (f) { return s.found[f.id] === 1; }).length,
      marked: c.findings.filter(function (f) { return s.found[f.id]; }).length
    };
  }
  function clock(sec) { var m = Math.floor(Math.abs(sec) / 60), s = Math.abs(sec) % 60; return (sec < 0 ? '+' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function refs(basis) { return String(basis || '').split(/\s*;\s*/).filter(Boolean).map(function (b) { return ui.ref(b); }); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  /* ---------- lista ---------- */
  function hub(root) {
    var cases = all();
    root.appendChild(h('header.view-head', h('div.stack.tight', h('h1', 'Część ustna'),
      h('p', 'Komisja ocenia odpowiedzi na pytania oraz samodzielną pracę z dokumentacją: ocenę zgodności projektu z wymaganiami, rozwiązania zamienne i ekspertyzy. Na przygotowanie jest 20 minut i wolno korzystać z tekstów przepisów oraz norm.')),
      h('div.row', ui.ref('§ 16–17 rozp. MSWiA z 2.12.2015'))));

    var list = h('div.grid');
    cases.forEach(function (c) {
      var s = peek(c.id), sc = s ? score(c, s) : null, chip;
      if (s && s.done) chip = ui.chip('oceniony: ' + sc.found + ' z ' + sc.issues, sc.found / Math.max(1, sc.issues) >= 0.7 ? 'ok' : 'warn');
      else if (s && (s.notes || s.revealed)) chip = ui.chip('w toku', 'accent'); else chip = ui.chip('nowy');
      list.appendChild(h('article.card.case-card',
        h('div.card-head', h('h3', c.title), chip),
        h('p.small.muted', c.lead || ''),
        h('div.row', (c.tags || []).map(function (t) { return ui.chip(t); })),
        h('div.case-meta', h('span', P.fmt.plural(c.drawings.length, 'rysunek', 'rysunki', 'rysunków')),
          h('span', P.fmt.plural(c.questions.length, 'pytanie', 'pytania', 'pytań') + ' komisji'),
          h('span', 'poziom ' + (c.level || 2) + ' z 3')),
        h('div.row', h('a.btn.primary', { href: '#ustna-' + c.id }, s && (s.notes || s.revealed) ? 'Wróć do dokumentacji' : 'Otwórz dokumentację'))));
    });
    root.appendChild(h('section.stack', h('h2', 'Dokumentacja do oceny'),
      cases.length ? list : ui.empty('Przykłady dokumentacji są w przygotowaniu.')));

    root.appendChild(h('section.card', h('h2', 'Kolejność oceny dokumentacji'),
      h('p.muted', 'Stała kolejność chroni przed pominięciem działu. Każdą uwagę podawaj z podstawą prawną i wartością wymaganą.'),
      h('ol.case-steps',
        h('li', h('b', 'Kwalifikacja. '), 'Grupa wysokości, kategoria ZL albo PM z gęstością obciążenia ogniowego, liczba osób, podział na strefy pożarowe i ich powierzchnia.'),
        h('li', h('b', 'Odporność pożarowa. '), 'Wymagana klasa budynku, klasy odporności ogniowej elementów, oddzielenia przeciwpożarowe i zamknięcia otworów.'),
        h('li', h('b', 'Ewakuacja. '), 'Przejścia i dojścia, liczba i szerokość wyjść, szerokość korytarzy i biegów, klatki schodowe i ich zabezpieczenie przed dymem, kierunek otwierania drzwi.'),
        h('li', h('b', 'Urządzenia i instalacje. '), 'Hydranty wewnętrzne i ich zasięg, sygnalizacja pożarowa, DSO, urządzenia gaśnicze, oświetlenie awaryjne, wyłącznik prądu, gaśnice.'),
        h('li', h('b', 'Teren. '), 'Odległości od sąsiednich budynków i granic, droga pożarowa, woda do zewnętrznego gaszenia, hydranty zewnętrzne.'),
        h('li', h('b', 'Wniosek. '), 'Czy projekt wymaga uzgodnienia, czy można go uzgodnić, co trzeba poprawić, a co wymaga odstępstwa albo zgody na rozwiązania zamienne.'))));

    var oral = oralPool();
    root.appendChild(h('section.card', h('div.card-head', h('h2', 'Pytania komisji'), h('span.small.muted', oral.length ? oral.length + ' w bazie' : '')),
      oral.length ? h('p.muted', 'Pytania otwarte ze wszystkich lekcji. Odpowiadaj na głos, potem porównaj z punktami wzorcowej odpowiedzi.')
        : h('p.muted', 'Pytania otwarte pojawią się wraz ze ściągami do kolejnych lekcji.'),
      oral.length ? h('div.row', h('a.btn', { href: '#ustna-pytania' }, 'Losuj 5 pytań')) : null));
  }

  /* ---------- pytania otwarte z lekcji ---------- */
  function oralPool() {
    var out = [];
    (P.data.lessons || []).forEach(function (l) {
      (l.oral || []).forEach(function (o) { if (o && typeof o === 'object' && o.q) out.push({ q: o.q, points: o.points || [], lesson: l }); });
    });
    return out;
  }
  function drill(root) {
    var pool = U.shuffle(oralPool()).slice(0, 5);
    root.appendChild(h('header.view-head', h('div.stack.tight', h('a.small', { href: '#ustna' }, '← Część ustna'), h('h1', 'Pytania komisji'),
      h('p', 'Odpowiedz na głos, jak przed komisją. Dopiero potem odsłoń punkty wzorcowej odpowiedzi.'))));
    if (!pool.length) { root.appendChild(ui.empty('Brak pytań otwartych w bazie.')); return; }
    pool.forEach(function (o, i) {
      var body = h('div.stack'), btn = ui.btn('Pokaż punkty odpowiedzi', function () {
        btn.remove();
        body.appendChild(h('ul.case-points', o.points.map(function (p) { return h('li', typeof p === 'string' ? p : [p.t || '', p.basis ? ui.ref(p.basis) : null]); })));
      }, 'sm');
      body.appendChild(h('div.row', btn));
      root.appendChild(h('article.card', h('div.case-q', h('span.n', String(i + 1)),
        h('div', h('b', o.q), h('span.small.muted', 'Lekcja: ' + o.lesson.title), body))));
    });
    root.appendChild(h('div.row', ui.btn('Losuj kolejne', function () { P.router.refresh(); }, 'primary')));
  }

  /* ---------- kazus ---------- */
  function caseView(root, c) {
    var s = state(c.id), tab = s.revealed ? 'klucz' : 'zadanie', body = h('div.stack'), left = PREP, running = false, drawings = {};
    var clockEl = h('span.case-clock', { 'aria-live': 'off' }, clock(left)), startBtn;
    function tick() { left--; clockEl.textContent = clock(left); if (left === 0) { clockEl.classList.add('over'); ui.toast('Minęło 20 minut przygotowania'); } }
    function toggleTimer() {
      running = !running; stopTimer();
      if (running) timer = setInterval(tick, 1000);
      startBtn.textContent = running ? 'Pauza' : 'Wznów';
    }
    startBtn = ui.btn('Start 20 min', toggleTimer, 'sm primary');
    var resetBtn = ui.btn('Od nowa', function () { stopTimer(); running = false; left = PREP; clockEl.textContent = clock(left); clockEl.classList.remove('over'); startBtn.textContent = 'Start 20 min'; }, 'sm ghost');

    var tabs = [{ value: 'zadanie', label: 'Zadanie' }, { value: 'opis', label: 'Opis' }, { value: 'rysunki', label: 'Rysunki' }, { value: 'uwagi', label: 'Moje uwagi' }, { value: 'klucz', label: 'Klucz' }];
    var seg = h('div');
    function setTab(t) { tab = t; P.clear(seg); seg.appendChild(ui.seg(tabs, tab, setTab)); paint(); window.scrollTo(0, 0); }

    root.appendChild(h('header.view-head', h('div.stack.tight', h('a.small', { href: '#ustna' }, '← Część ustna'), h('h1', c.title),
      h('div.row', (c.tags || []).map(function (t) { return ui.chip(t); })))));
    root.appendChild(h('div.case-top', seg, h('div.case-timer', clockEl, startBtn, resetBtn)));
    root.appendChild(body);

    function markers(dId) {
      var out = [];
      c.findings.forEach(function (f, i) { if (f.marker && f.marker.d === dId) out.push({ n: i + 1, at: f.marker.at, kind: f.kind }); });
      return out;
    }
    function paintDrawings(showMarks) {
      var cur = c.drawings[0].id, holder = h('div'), wrap = h('div.stack');
      function show(id) {
        cur = id; P.clear(holder);
        var spec = c.drawings.filter(function (d) { return d.id === id; })[0], m = P.drawing.mount(spec);
        drawings[id] = m; if (showMarks) m.setMarkers(markers(id));
        holder.appendChild(m.el);
        if (spec.note) holder.appendChild(h('p.small.muted', { style: { marginTop: '8px' } }, spec.note));
      }
      if (c.drawings.length > 1) wrap.appendChild(ui.seg(c.drawings.map(function (d, i) { return { value: d.id, label: 'Rys. ' + (i + 1) + '. ' + d.title }; }), cur, show));
      wrap.appendChild(holder); show(cur);
      return wrap;
    }

    function paint() {
      P.clear(body);
      if (tab === 'zadanie') {
        body.appendChild(h('section.card', h('h2', 'Zadanie komisji'), ui.rich(c.problem),
          h('div.case-stamp', 'Dokumentacja jest fikcyjna i została przygotowana do ćwiczeń. Zawiera celowe błędy i braki, a także rozwiązania poprawne, które tylko wyglądają podejrzanie.')));
        if (c.legal) body.appendChild(ui.banner('warn', 'Stan prawny', c.legal));
        body.appendChild(h('section.card', h('h2', 'Pytania, na które trzeba odpowiedzieć'),
          h('div.stack', c.questions.map(function (q, i) {
            return h('div.case-q', h('span.n', String(i + 1)), h('div', h('span', q.q), q.kind && QKIND[q.kind] ? h('span.small.muted', QKIND[q.kind]) : null));
          }))));
        body.appendChild(h('section.card', h('h2', 'Jak ćwiczyć'),
          h('ol.case-steps',
            h('li', 'Włącz zegar i przez 20 minut pracuj tylko z opisem, rysunkami i tekstami przepisów.'),
            h('li', 'Zapisz własne uwagi w karcie „Moje uwagi”: co jest niezgodne, z jakim przepisem i jaka wartość jest wymagana.'),
            h('li', 'Odpowiedz na pytania na głos, jak przed komisją.'),
            h('li', 'Dopiero potem odsłoń klucz i zaznacz, które usterki udało się wskazać.')),
          h('div.row', ui.btn('Przejdź do opisu', function () { setTab('opis'); }, 'primary'))));
      } else if (tab === 'opis') {
        var d = c.doc, art = h('article.card.case-doc', h('div.stack.tight', h('span.small.muted', 'Wyciąg z dokumentacji projektowej'), h('h2', d.title)));
        if (d.meta && d.meta.length) art.appendChild(ui.table(null, d.meta));
        (d.sections || []).forEach(function (sec) {
          art.appendChild(h('div.doc-sec', h('h3', sec.no ? h('span.num', sec.no) : null, h('span', sec.h)), sec.text ? ui.rich(sec.text) : null,
            sec.table ? ui.table(sec.table.head, sec.table.rows) : null));
        });
        body.appendChild(art);
        body.appendChild(h('div.row', ui.btn('Rysunki', function () { setTab('rysunki'); }, 'primary')));
      } else if (tab === 'rysunki') {
        var showMarks = !!s.revealed;
        body.appendChild(h('p.small.muted', 'Powiększ rysunek przyciskiem „+” i przesuwaj go palcem. „Zmierz odległość” sumuje kolejne odcinki, więc da się zmierzyć drogę z załamaniami.'));
        body.appendChild(paintDrawings(showMarks));
        if (s.revealed) body.appendChild(h('p.small.muted', 'Numery w kółkach odpowiadają pozycjom klucza. Czerwone oznaczają usterki, zielone rozwiązania poprawne.'));
        else body.appendChild(h('div.row', ui.btn('Zapisz uwagi', function () { setTab('uwagi'); }, 'primary')));
      } else if (tab === 'uwagi') {
        var ta = h('textarea.input.case-notes', { placeholder: 'Np. 1. Klasa odporności pożarowej – przyjęto …, wymagana … (§ …).', 'aria-label': 'Moje uwagi do dokumentacji' });
        ta.value = s.notes || '';
        ta.addEventListener('input', U.debounce(function () { s.notes = ta.value; save(c.id); }, 600));
        body.appendChild(h('section.card', h('h2', 'Moje uwagi do dokumentacji'),
          h('p.muted', 'Zapisz uwagi przed odsłonięciem klucza. Samodzielne przypomnienie przepisu uczy więcej niż czytanie gotowej odpowiedzi.'), ta,
          h('div.row', ui.btn(s.revealed ? 'Przejdź do klucza' : 'Odsłoń klucz', function () { s.notes = ta.value; reveal(); }, 'primary'))));
      } else paintKey();
    }

    function reveal() {
      if (s.revealed) { setTab('klucz'); return; }
      ui.confirm('Odsłonić klucz?', 'Klucz pokaże wszystkie usterki i wzorcowe odpowiedzi. Najpierw warto zapisać własne uwagi.', 'Odsłoń klucz').then(function (ok) {
        if (!ok) return;
        s.revealed = Date.now(); save(c.id); stopTimer(); running = false; setTab('klucz');
      });
    }

    function paintKey() {
      if (!s.revealed) {
        body.appendChild(h('section.card', h('h2', 'Klucz jest zasłonięty'),
          h('p.muted', 'Klucz zawiera ' + c.findings.filter(isIssue).length + ' usterek i braków oraz wzorcowe odpowiedzi na pytania komisji. Odsłoń go po zapisaniu własnych uwag.'),
          h('div.row', ui.btn('Zapisz uwagi', function () { setTab('uwagi'); }), ui.btn('Odsłoń klucz', reveal, 'primary'))));
        return;
      }
      var sum = h('div.row');
      function paintSum() {
        var sc = score(c, s); P.clear(sum);
        sum.appendChild(ui.stat(sc.found + ' z ' + sc.issues, 'wskazane usterki'));
        sum.appendChild(ui.stat(P.fmt.pct(sc.weight ? sc.got / sc.weight : 0), 'z uwzględnieniem wagi'));
        if (sc.traps) sum.appendChild(ui.stat(sc.trapsOk + ' z ' + sc.traps, 'pułapki ominięte'));
      }
      paintSum();
      body.appendChild(h('section.card', h('div.card-head', h('h2', 'Wynik'), s.done ? ui.chip('zapisany', 'ok') : null), sum,
        h('p.small.muted', 'Zaznacz przy każdej pozycji, czy była w Twoich uwagach. Pozycje o większej wadze to usterki, które przesądzają o braku możliwości uzgodnienia.')));
      if (s.notes) body.appendChild(h('details.card', h('summary', h('b', 'Moje uwagi sprzed odsłonięcia klucza')), ui.rich(s.notes)));

      var list = h('div');
      c.findings.forEach(function (f, i) {
        var k = KIND[f.kind] || KIND['błąd'], issue = isIssue(f);
        var opts = issue ? [{ value: 1, label: 'Wskazałem' }, { value: -1, label: 'Pominąłem' }] : [{ value: 1, label: 'Nie kwestionowałem' }, { value: -1, label: 'Zakwestionowałem' }];
        var dl = h('dl');
        function row(dt, dd) { if (dd) { dl.appendChild(h('dt', dt)); dl.appendChild(h('dd', dd)); } }
        row('Miejsce', f.where); row('W dokumentacji', f.is); row(issue ? 'Wymaganie' : 'Dlaczego zgodne', f.should);
        row('Podstawa', f.basis ? h('span.row', refs(f.basis)) : null);
        row('Cytat', f.quote ? h('span.quote', '„' + f.quote + '”') : null);
        row(issue ? 'Jak poprawić' : 'Uwaga', f.fix);
        list.appendChild(h('div.case-find', h('div.case-q', h('span.n.' + (issue ? 'bad' : 'ok'), String(i + 1)),
          h('div', h('div.row.between', h('h4', f.title), h('span.row', ui.chip(k[0], k[1]), issue && (f.weight || 1) >= 3 ? ui.chip('waga 3') : null, f.act === 'wt_2002' ? ui.chip('wg WT z 2002 r.') : null)), dl,
            h('div.row', ui.seg(opts, s.found[f.id] || 0, function (v) { s.found[f.id] = v; save(c.id); paintSum(); }),
              f.marker ? h('span.small.muted', 'na rysunku: nr ' + (i + 1)) : null)))));
      });
      body.appendChild(h('section.card', h('h2', 'Usterki, braki i pułapki'), list));
      body.appendChild(h('section.stack', h('h2', 'Rysunki z oznaczeniami'), paintDrawings(true)));

      body.appendChild(h('section.card', h('h2', 'Wzorcowe odpowiedzi na pytania komisji'),
        h('div.stack', c.questions.map(function (q, i) {
          return h('div.case-find', h('div.case-q', h('span.n', String(i + 1)), h('div', h('b', q.q),
            h('ul.case-points', (q.points || []).map(function (p) { return h('li', p.t, p.basis ? refs(p.basis) : null); })),
            h('div.row', h('span.small.muted', 'Moja odpowiedź:'), ui.seg([{ value: 2, label: 'pełna' }, { value: 1, label: 'częściowa' }, { value: 0, label: 'brak' }],
              s.qs[q.id] == null ? -1 : s.qs[q.id], function (v) { s.qs[q.id] = v; save(c.id); })))));
        }))));
      if (c.summary) body.appendChild(h('section.card', h('h2', 'Wniosek końcowy'), ui.rich(c.summary)));
      body.appendChild(h('div.row', ui.btn(s.done ? 'Zapisz ponownie' : 'Zakończ i zapisz wynik', function () {
        var sc = score(c, s), qp = U.sum(c.questions, function (q) { return s.qs[q.id] || 0; });
        s.done = Date.now(); save(c.id);
        P.log.session({ type: 'ustna', case: c.id, found: sc.found, total: sc.issues, traps: sc.trapsOk, q: qp, qmax: c.questions.length * 2, min: Math.max(5, Math.round((PREP - left) / 60)) });
        ui.toast('Zapisano wynik'); P.router.refresh();
      }, 'primary'), ui.btn('Zacznij od nowa', function () {
        ui.confirm('Zacząć ten kazus od nowa?', 'Uwagi i zaznaczenia zostaną usunięte.', 'Zacznij od nowa', true).then(function (ok) {
          if (!ok) return;
          var n = P.store.get('notes'); n.cases[c.id] = { t: Date.now(), notes: '', revealed: 0, found: {}, qs: {}, done: 0 }; P.store.save('notes'); P.router.refresh();
        });
      }, 'ghost')));
    }
    setTab(tab);
  }

  P.views.ustna = {
    title: 'Część ustna',
    render: function (root, param) {
      stopTimer();
      if (param === 'pytania') return drill(root);
      var c = param && (P.data.caseById || {})[param];
      if (param && !c) root.appendChild(ui.banner('warn', 'Nie ma takiej dokumentacji', 'Wybierz przykład z listy.'));
      if (c) caseView(root, c); else hub(root);
    },
    leave: stopTimer
  };
})();
