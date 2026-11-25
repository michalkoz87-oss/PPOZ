/* Widok „Ustawienia”: plan, powtórki, wygląd, postęp i kopia zapasowa, informacje o danych.
   Każda zmiana ustawienia zapisuje się od razu (P.setSetting) i jest potwierdzana komunikatem „Zapisano”. */
(function () {
  'use strict';
  const P = window.PPOZ, h = P.h, ui = P.ui, U = P.util, F = P.fmt;
  const DOCS = ['settings', 'plan', 'srs', 'log', 'notes'];
  const DOC_NAMES = { settings: 'ustawienia', plan: 'plan', srs: 'powtórki', log: 'dziennik', notes: 'notatki' };
  /* Oczekiwana postać kopii zapasowej: 'o' = obiekt, 'a' = tablica. Chroni przed wczytaniem pliku, który unieruchomiłby aplikację. */
  const SHAPE = {
    settings: {}, plan: { tasks: 'o', reads: 'o', lessons: 'o', sheets: 'o' }, srs: { q: 'o', f: 'o' },
    log: { days: 'o', sessions: 'a', calib: 'o' }, notes: { over: 'o', flags: 'o', qnotes: 'o', customQ: 'a', customF: 'a', doubts: 'a' }
  };
  /* Kategorie dawnego quizu → tematy tej aplikacji (dla własnych pytań). Brak dopasowania = „Inne”. */
  const LEGACY_TOPIC = {
    'warunki techniczne': 'W1', 'klasyfikacja': 'W1', 'strefy': 'W2', 'ewakuacja': 'W3', 'ssp i dso': 'U1', 'woda i drogi pożarowe': 'H1', 'woda': 'H1',
    'zagrożenie wybuchem': 'X1', 'wybuch': 'X1', 'wentylacja pożarowa': 'U6', 'wentylacja': 'U6', 'uzgadnianie i procedury': 'P2', 'procedury': 'P2',
    'oświetlenie i znaki': 'U3', 'oświetlenie': 'U3', 'instalacje elektryczne': 'U7', 'sug i gaszenie': 'U4', 'instalacje gaśnicze': 'R2', 'obliczenia': 'O1'
  };
  const SYNC_ERRORS = {
    timeout: 'serwer nie odpowiedział na czas', unavailable: 'brak połączenia z kontem', resource_exhausted: 'przekroczony limit zapisu, kolejna próba nastąpi samoczynnie',
    revoked: 'aplikacja nie ma już zgody na zapis na koncie', not_granted: 'aplikacja nie ma zgody na zapis na koncie', invalid_argument: 'zapis został odrzucony'
  };
  const VERIF = { 'zgodne': 'Zweryfikowane, wynik zgodny', 'stary-klucz': 'Wcześniejszy klucz, bez ponownej weryfikacji', 'brak': 'Brak klucza (pytanie pominięte w nauce)' };
  let unsubscribe = null, lastToast = 0;

  /* ---------- pomocnicze ---------- */
  function saved() { const now = Date.now(); if (now - lastToast > 1500) { ui.toast('Zapisano'); lastToast = now; } }
  function set(key, value) { if (P.settings()[key] === value) return false; P.setSetting(key, value); saved(); return true; }
  function section(title, sub) { const el = h('section.card', h('h2', title)); if (sub) el.appendChild(h('p.small.muted', sub)); return el; }
  function group(label, control, hint) {
    const id = 'us-' + U.uid();
    control.setAttribute('aria-labelledby', id);
    return h('div.field', h('span', { id: id }, label), control, hint ? h('span.us-hint', hint) : null);
  }
  function weeksWord(n) { return F.plural(n, 'tydzień', 'tygodnie', 'tygodni'); }
  function daysWord(n) { return F.plural(n, 'dzień', 'dni', 'dni'); }
  function plausible(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '2020-01-01' && v <= '2100-12-31'; }
  function when(ms) {
    const d = new Date(ms), iso = U.iso(d), today = U.today();
    return (iso === today ? 'dziś' : iso === U.addDays(today, -1) ? 'wczoraj' : F.date(iso)) + ' o ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
  }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function errorDialog(title, message) { ui.modal({ title: title, body: String(message || 'Nieznany błąd.') }); }
  function numberField(key, label, hint, min, max, step) {
    const inp = h('input.input', { type: 'number', min: String(min), max: String(max), step: String(step), inputmode: step < 1 ? 'decimal' : 'numeric', value: String(P.settings()[key]) });
    inp.addEventListener('change', function () {
      let v = parseFloat(String(inp.value).replace(',', '.'));
      if (!isFinite(v)) { inp.value = P.settings()[key]; return; }
      v = U.clamp(Math.round(v / step) * step, min, max);
      inp.value = v;
      set(key, v);
    });
    return ui.field(label, inp, hint);
  }

  /* ---------- plan ---------- */
  function planCard() {
    const el = section('Plan'), box = h('div', { 'aria-live': 'polite' }), note = h('p.small.muted', { 'aria-live': 'polite' }), segBox = h('div');
    const start = h('input.input', { type: 'date', value: P.plan.start() });
    const exam = h('input.input', { type: 'date', value: P.settings().exam || '' });
    const suggest = ui.btn('Dobierz wariant planu', function () {
      const ex = P.settings().exam;
      if (!ex) return;
      const st = P.plan.start(), weeks = Math.floor(U.diffDays(st, ex) / 7), preset = P.plan.suggestPreset(st, ex), changed = set('preset', preset);
      mountSeg(); refresh();
      note.textContent = 'Od startu do egzaminu: ' + (weeks < 1 ? 'mniej niż tydzień' : weeksWord(weeks)) + '. ' + (weeks < 13
        ? 'Najkrótszy wariant ma 13 tygodni, więc plan nie zmieści się w całości. Przesuń start albo przerób tyle, ile zdążysz.'
        : (changed ? 'Wybrano' : 'Zostaje') + ' wariant ' + weeksWord(+preset) + '.');
    });
    function mountSeg() {
      const keys = Object.keys(P.data.plan.presets).sort(function (a, b) { return b - a; });
      const seg = ui.seg(keys.map(function (k) { return { value: k, label: weeksWord(+k) }; }), String(P.settings().preset), function (v) { set('preset', v); note.textContent = ''; refresh(); });
      P.clear(segBox).appendChild(group('Wariant planu', seg, 'Krótsze warianty łączą część tygodni w pary: zakres materiału zostaje ten sam, rośnie tygodniowy nakład pracy.'));
    }
    function refresh(first) {
      const st = P.plan.start(), end = P.plan.end(), ex = P.settings().exam;
      const base = 'Plan trwa ' + weeksWord(P.plan.calWeeks().length) + ': od ' + F.date(st) + ' do ' + F.date(end) + '.';
      let extra, warn = false;
      if (!ex) extra = 'Data egzaminu nie jest ustawiona.';
      else if (ex < st) { warn = true; extra = 'Data egzaminu (' + F.date(ex) + ') jest wcześniejsza niż start planu.'; }
      else {
        const gap = U.diffDays(end, ex);
        if (gap < 0) { warn = true; extra = 'Plan kończy się ' + daysWord(-gap) + ' po egzaminie (' + F.date(ex) + '). Wybierz krótszy wariant albo wcześniejszy start.'; }
        else extra = gap === 0 ? 'Plan kończy się w dniu egzaminu (' + F.date(ex) + ').' : 'Zapas między końcem planu a egzaminem (' + F.date(ex) + '): ' + daysWord(gap) + '.';
      }
      P.clear(box).appendChild(warn ? ui.banner('warn', base, extra) : h('p.small.muted', base + ' ' + extra));
      suggest.disabled = !ex;
      if (!first) P.router.updateNav(); /* wiersz „Tydzień n z m” w nawigacji zależy od startu i wariantu */
    }
    start.addEventListener('change', function () {
      const v = start.value;
      if (v && !plausible(v)) return;
      const m = v ? U.monday(v) : null;
      set('start', m);
      note.textContent = m && m !== v ? 'Plan zaczyna się w poniedziałek, więc start ustawiono na ' + F.date(m) + '.' : (!v ? 'Przywrócono domyślny start planu.' : '');
      refresh();
    });
    start.addEventListener('blur', function () { start.value = P.plan.start(); });
    exam.addEventListener('change', function () {
      const v = exam.value;
      if (v && !plausible(v)) return;
      set('exam', v || null);
      note.textContent = '';
      refresh();
    });
    const hours = P.data.plan.hoursPerWeek || [];
    el.appendChild(h('div.grid.us-grid',
      ui.field('Data startu', start, 'Plan liczy tygodnie od poniedziałku.'),
      ui.field('Data egzaminu', exam, 'Termin wyznacza KG PSP. Wpisz go, gdy będzie znany.')));
    el.appendChild(h('div.row', suggest, h('span.small.muted', 'Dobiera 26, 20 albo 13 tygodni do czasu między startem a egzaminem.')));
    el.appendChild(note);
    el.appendChild(segBox);
    el.appendChild(box);
    el.appendChild(h('div.grid.us-grid', numberField('hours', 'Cel godzin tygodniowo', hours.length === 2 ? 'Plan zakłada ' + hours[0] + '–' + hours[1] + ' godzin tygodniowo.' : 'Służy do oceny czasu nauki w tygodniu.', 1, 30, 0.5)));
    mountSeg(); refresh(true);
    return el;
  }

  /* ---------- powtórki ---------- */
  function reviewCard() {
    const el = section('Powtórki', 'Ile nowego materiału i ile powtórek trafia do planu dnia.');
    const sheets = (P.data.plan.reservedSheets || []).slice().sort(function (a, b) { return a - b; });
    const range = sheets.length === 2 && sheets[1] - sheets[0] === 1 ? sheets[0] + '–' + sheets[1] : sheets.join(', ');
    el.appendChild(h('div.grid.us-grid',
      numberField('newQ', 'Nowe pytania dziennie', 'Z tematów bieżącego tygodnia.', 0, 100, 1),
      numberField('newF', 'Nowe fiszki dziennie', 'Z tematów bieżącego tygodnia.', 0, 100, 1),
      numberField('cap', 'Limit powtórek dziennie', 'Osobno dla pytań i dla fiszek. Nadwyżka przechodzi na kolejny dzień.', 5, 500, 1)));
    el.appendChild(ui.check('Zarezerwuj arkusze ' + range + ' na próby generalne', P.settings().reserve, function (on) { set('reserve', !!on); },
      'Pytania z tych arkuszy nie pojawiają się w nauce ani w powtórkach, dopóki nie rozwiążesz arkusza jako egzaminu próbnego.'));
    return el;
  }

  /* ---------- wygląd ---------- */
  function lookCard() {
    const el = section('Wygląd');
    const seg = ui.seg([{ value: 'auto', label: 'Automatyczny' }, { value: 'light', label: 'Jasny' }, { value: 'dark', label: 'Ciemny' }], P.settings().theme || 'auto',
      function (v) { set('theme', v); if (typeof P.applyTheme === 'function') P.applyTheme(); });
    el.appendChild(group('Motyw', seg, 'Automatyczny przyjmuje motyw ustawiony w urządzeniu.'));
    return el;
  }

  /* ---------- postęp i kopia zapasowa ---------- */
  function statusBlock(box) {
    const s = P.store.status(), cloud = s.mode === 'cloud';
    const lines = [];
    if (cloud) lines.push('Ostatnia synchronizacja: ' + (s.lastSync ? when(s.lastSync) : 'jeszcze jej nie było') + '.');
    if (cloud && s.pending) lines.push('Zmiany czekające na wysłanie: ' + s.pending + '.');
    if (s.error) lines.push('Ostatni błąd synchronizacji: ' + (SYNC_ERRORS[s.error] || s.error) + '.');
    const btn = ui.btn('Synchronizuj teraz', function () {
      btn.disabled = true; btn.textContent = 'Synchronizowanie…';
      Promise.resolve().then(function () { return P.store.syncNow(); }).then(function () { ui.toast('Zsynchronizowano'); }, function (e) {
        errorDialog('Nie udało się zsynchronizować', 'Powód: ' + (SYNC_ERRORS[e && e.code] || (e && (e.message || e.code)) || 'nieznany') + '. Postęp jest bezpieczny w tej przeglądarce; spróbuj ponownie za chwilę.');
      }).then(function () { statusBlock(box); });
    }, 'sm');
    btn.disabled = !cloud;
    const banner = cloud
      ? ui.banner('ok', 'Postęp zapisuje się na koncie Claude', 'Jest wspólny dla telefonu i komputera, jeśli na obu otwierasz aplikację na tym samym koncie.')
      : s.local ? ui.banner('', 'Postęp zapisuje się tylko w tej przeglądarce', 'Nie przenosi się między telefonem a komputerem i zniknie po wyczyszczeniu danych przeglądarki. Kopia zapasowa pozwala go przenieść i zabezpieczyć.')
        : ui.banner('bad', 'Ta przeglądarka nie zapisuje postępu', 'Po zamknięciu karty postęp przepadnie (tak bywa w trybie prywatnym). Przed wyjściem zapisz kopię zapasową.');
    P.clear(box).appendChild(banner);
    box.appendChild(h('div.row.between',
      h('div.stack.tight.small.muted.grow', lines.length ? lines.map(function (t) { return h('span', t); }) : h('span', 'Synchronizacja działa, gdy aplikacja jest otwarta na koncie Claude.')), btn));
  }

  /* Kopia zapasowa: sprawdzenie postaci, opis zawartości, wybór scalenia lub zastąpienia. */
  function parseJson(text) {
    if (!String(text || '').trim()) throw new Error('Plik jest pusty.');
    try { return JSON.parse(text); } catch (e) { throw new Error('To nie jest poprawny plik JSON. Wybierz plik zapisany przez aplikację, bez ręcznych zmian.'); }
  }
  function checkBackup(obj) {
    if (!isObj(obj)) throw new Error('Plik nie zawiera kopii zapasowej.');
    if (obj.app !== 'ppoz-nauka') {
      if (obj.overrides || obj.custom) throw new Error('To wygląda na eksport ze starego quizu, a nie na kopię zapasową tej aplikacji. Użyj przycisku „Importuj poprawki ze starego quizu”.');
      throw new Error('To nie jest kopia zapasowa tej aplikacji.');
    }
    if (!DOCS.some(function (n) { return obj[n] != null; })) throw new Error('Kopia jest pusta: nie zawiera żadnej części postępu.');
    DOCS.forEach(function (n) {
      const doc = obj[n];
      if (doc == null) return;
      const broken = new Error('Kopia jest uszkodzona: część „' + DOC_NAMES[n] + '” ma niepoprawną postać. Niczego nie wczytano.');
      if (!isObj(doc)) throw broken;
      Object.keys(SHAPE[n]).forEach(function (k) {
        if (doc[k] === undefined) return;
        if (SHAPE[n][k] === 'a' ? !Array.isArray(doc[k]) : !isObj(doc[k])) throw broken;
      });
      if (n === 'settings') {
        ['start', 'exam'].forEach(function (k) { if (doc[k] != null && !plausible(doc[k])) throw broken; });
        ['hours', 'newQ', 'newF', 'cap'].forEach(function (k) { if (doc[k] !== undefined && !(typeof doc[k] === 'number' && isFinite(doc[k]) && doc[k] >= 0)) throw broken; });
      }
      if (n === 'log' && doc.calib && !(Array.isArray(doc.calib.sure) && Array.isArray(doc.calib.unsure))) throw broken;
      if (n === 'log' && doc.sessions && doc.sessions.some(function (s) { return !isObj(s); })) throw broken;
    });
  }
  function backupFacts(obj) {
    function started(m) { return Object.keys(m || {}).filter(function (k) { return Array.isArray(m[k]) && m[k][0] > 0; }).length; }
    const srs = obj.srs || {}, log = obj.log || {}, plan = obj.plan || {}, notes = obj.notes || {}, out = [];
    const tasks = Object.keys(plan.tasks || {}).filter(function (k) { return plan.tasks[k] > 0; }).length;
    const over = Object.keys(notes.over || {}).filter(function (k) { return notes.over[k] && notes.over[k].key; }).length;
    out.push('Powtórki: ' + F.plural(started(srs.q), 'pytanie', 'pytania', 'pytań') + ' i ' + F.plural(started(srs.f), 'fiszka', 'fiszki', 'fiszek') + ' z historią odpowiedzi.');
    out.push('Dziennik: ' + F.plural((log.sessions || []).length, 'sesja', 'sesje', 'sesji') + ', ' + daysWord(Object.keys(log.days || {}).length) + ' nauki.');
    out.push('Plan: ' + F.plural(tasks, 'wykonane zadanie', 'wykonane zadania', 'wykonanych zadań') + '.');
    out.push('Notatki: ' + F.plural(over, 'poprawka klucza', 'poprawki klucza', 'poprawek klucza') + ', ' + F.plural((notes.customQ || []).length, 'własne pytanie', 'własne pytania', 'własnych pytań') + '.');
    return out;
  }
  function backupDialog(obj) {
    const t = Date.parse(obj.exported || '');
    function run(merge, close) {
      try { P.store.importAll(obj, merge); }
      catch (e) { close(); errorDialog('Nie udało się wczytać kopii', e && e.message); return false; }
      if (typeof P.applyTheme === 'function') P.applyTheme();
      ui.toast(merge ? 'Kopia scalona z postępem' : 'Postęp zastąpiony kopią');
    }
    ui.modal({
      title: 'Wczytać kopię zapasową?',
      body: h('div.stack',
        h('p', isFinite(t) ? 'Kopia zapisana ' + when(t) + '.' : 'Kopia bez daty zapisu.'),
        h('ul.small', backupFacts(obj).map(function (x) { return h('li', x); })),
        obj.version !== 1 ? ui.banner('warn', 'Inna wersja kopii', 'Kopia pochodzi z innej wersji aplikacji. Część danych może zostać pominięta.') : null,
        h('p.small.muted', 'Scalenie łączy kopię z obecnym postępem; gdy ta sama pozycja jest w obu miejscach, wygrywa nowszy wpis. Zastąpienie usuwa obecny postęp i wstawia zawartość kopii.')),
      actions: [{ label: 'Anuluj' },
        { label: 'Zastąp obecny postęp', cls: 'bad', onClick: function (close) { return run(false, close); } },
        { label: 'Scal z obecnym postępem', cls: 'primary', onClick: function (close) { return run(true, close); } }]
    });
  }
  function openBackup(text) { const obj = parseJson(text); checkBackup(obj); backupDialog(obj); }

  /* Import ze starego quizu: {overrides: {staryNr: 'a'|'b'|'c'}, custom: [{question, a, b, c, odp, kategoria}]}. */
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function legacyTopic(cat) {
    const c = norm(cat).toLowerCase();
    if (!c) return 'Z9';
    const hit = P.data.topics.filter(function (t) { return t.code.toLowerCase() === c || String(t.short || '').toLowerCase() === c || String(t.name || '').toLowerCase() === c; })[0];
    return hit ? hit.code : (LEGACY_TOPIC[c] || 'Z9');
  }
  function legacyPlan(obj) {
    if (!isObj(obj)) throw new Error('Plik nie zawiera danych ze starego quizu.');
    if (obj.app === 'ppoz-nauka') throw new Error('To jest kopia zapasowa tej aplikacji, a nie eksport ze starego quizu. Użyj przycisku „Wczytaj kopię”.');
    const over = isObj(obj.overrides) ? obj.overrides : null, custom = Array.isArray(obj.custom) ? obj.custom : null;
    if (!over && !custom) throw new Error('W pliku nie ma poprawek klucza („overrides”) ani własnych pytań („custom”). To nie jest eksport ze starego quizu.');
    const byLegacy = {}, texts = {};
    P.data.questions.forEach(function (q) { if (q.legacyId != null) byLegacy[q.legacyId] = q; });
    P.q.all().forEach(function (q) { texts[norm(q.q).toLowerCase()] = 1; });
    const plan = { changes: [], same: 0, unknown: [], invalid: [], add: [], dup: 0, broken: 0 };
    Object.keys(over || {}).forEach(function (k) {
      const letter = norm(over[k]).toLowerCase(), q = byLegacy[norm(k)];
      if (!/^[abc]$/.test(letter)) { plan.invalid.push(k); return; }
      if (!q) { plan.unknown.push(k); return; }
      const cur = P.q.key(q);
      if (cur === letter) plan.same++; else plan.changes.push({ q: q, from: cur, to: letter });
    });
    (custom || []).forEach(function (c) {
      if (!isObj(c)) { plan.broken++; return; }
      const text = norm(c.question), key = norm(c.odp).toLowerCase(), a = norm(c.a), b = norm(c.b), cc = norm(c.c);
      if (!text || !a || !b || !cc || !/^[abc]$/.test(key)) { plan.broken++; return; }
      if (texts[text.toLowerCase()]) { plan.dup++; return; }
      texts[text.toLowerCase()] = 1;
      /* Rekord w postaci zwykłego pytania, żeby działał w pulach, powtórkach i zestawieniach tak samo jak pytania z arkuszy. */
      plan.add.push({ id: 'w' + U.uid(), t: Date.now(), custom: true, src: 'stary-quiz', sheet: 0, q: text, a: a, b: b, c: cc, dup: null, note: 'Własne pytanie przeniesione ze starego quizu.',
        legacyId: null, ans: key, ansNow: '=', key: key, conf: 'niska', stan: 'aktualne', stanNote: '', topic: legacyTopic(c.kategoria), basis: '', quote: '', expl: '', norms: [], verif: 'własne' });
    });
    return plan;
  }
  function applyLegacy(plan) {
    plan.changes.forEach(function (c) { P.q.setKey(c.q, c.to, 'import ze starego quizu'); });
    if (plan.add.length) {
      const notes = P.store.get('notes');
      notes.customQ = (notes.customQ || []).concat(plan.add);
      P.store.save('notes');
    }
  }
  function legacyDialog(plan, done) {
    const todo = plan.changes.length + plan.add.length, lines = [];
    function list(arr) { return arr.slice(0, 12).join(', ') + (arr.length > 12 ? ' i ' + (arr.length - 12) + ' dalszych' : ''); }
    lines.push('Poprawki, które zmienią klucz: ' + plan.changes.length + '.');
    if (plan.same) lines.push('Poprawki zgodne z obecnym kluczem aplikacji (bez zmian): ' + plan.same + '.');
    if (plan.unknown.length) lines.push('Numery, których nie ma w tej bazie pytań (pominięte): ' + list(plan.unknown) + '.');
    if (plan.invalid.length) lines.push('Poprawki z odpowiedzią inną niż a, b lub c (pominięte): ' + list(plan.invalid) + '.');
    lines.push('Własne pytania do dodania: ' + plan.add.length + '.');
    if (plan.dup) lines.push('Własne pytania, które już są w aplikacji (pominięte): ' + plan.dup + '.');
    if (plan.broken) lines.push('Własne pytania niepełne, bez treści, trzech odpowiedzi albo klucza (pominięte): ' + plan.broken + '.');
    const table = plan.changes.length ? h('div.us-scroll', ui.table(['Pytanie', 'Treść', 'Teraz', 'Po imporcie'], plan.changes.map(function (c) {
      const text = norm(c.q.q);
      return [h('span.num', 'nr ' + c.q.id), h('span.small', text.length > 90 ? text.slice(0, 88) + '…' : text), h('span.num', c.from || 'brak'), h('b.num', c.to)];
    }))) : null;
    ui.modal({
      title: todo ? 'Importować dane ze starego quizu?' : 'Nie ma nic do zaimportowania',
      body: h('div.stack', h('ul.small', lines.map(function (x) { return h('li', x); })), table,
        todo ? h('p.small.muted', 'Poprawki zapiszą się jako Twoje zmiany klucza i będą miały pierwszeństwo przed kluczem aplikacji. Własne pytania dostaną niską pewność klucza, bo nikt ich nie weryfikował.') : null),
      actions: todo ? [{ label: 'Anuluj' }, { label: 'Importuj', cls: 'primary', onClick: function () {
        applyLegacy(plan);
        ui.toast('Zaimportowano: ' + F.plural(plan.changes.length, 'poprawka', 'poprawki', 'poprawek') + ', ' + F.plural(plan.add.length, 'pytanie', 'pytania', 'pytań'));
        done();
      } }] : [{ label: 'Zamknij' }]
    });
  }

  /* Wspólne wejścia: ukryte pole pliku przy przycisku oraz okno do wklejenia tekstu (gdy plik był zapisany przez skopiowanie). */
  function fileButton(label, cls, failTitle, onText) {
    const inp = h('input', { type: 'file', accept: '.json,application/json', hidden: true, tabIndex: -1, 'aria-hidden': 'true' });
    inp.addEventListener('change', function () {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = function () { inp.value = ''; try { onText(String(r.result || '')); } catch (e) { errorDialog(failTitle, e && e.message); } };
      r.onerror = function () { inp.value = ''; errorDialog(failTitle, 'Nie udało się odczytać pliku.'); };
      r.readAsText(f);
    });
    return [ui.btn(label, function () { inp.click(); }, cls), inp];
  }
  function pasteDialog(title, hint, onText) {
    const ta = h('textarea.input', { rows: 8, 'aria-label': 'Zawartość pliku', spellcheck: false }), err = h('p.small.us-error', { role: 'alert' });
    ui.modal({ title: title, body: h('div.stack', h('p.small.muted', hint), ta, err),
      actions: [{ label: 'Anuluj' }, { label: 'Dalej', cls: 'primary', onClick: function (close) {
        let next;
        try { next = onText(ta.value); } catch (e) { err.textContent = (e && e.message) || 'Nie udało się odczytać tekstu.'; return false; }
        close(); next();
        return false;
      } }] });
  }

  function backupCard(refreshAbout) {
    const el = section('Postęp i kopia zapasowa'), status = h('div.stack');
    statusBlock(status);
    unsubscribe = P.store.onChange(function (what) { if (what !== 'data' && status.isConnected) statusBlock(status); });
    el.appendChild(status);

    el.appendChild(h('hr.divider'));
    el.appendChild(h('div.stack.tight', h('h3', 'Kopia zapasowa'), h('p.small.muted', 'Jeden plik z całym postępem: powtórkami, planem, dziennikiem, notatkami i ustawieniami. Służy też do przeniesienia postępu na inne urządzenie.')));
    el.appendChild(h('div.row',
      ui.btn('Zapisz kopię zapasową', function () { ui.saveFile('ppoz-postep-' + U.today() + '.json', JSON.stringify(P.store.exportAll()), 'application/json'); }, 'primary'),
      fileButton('Wczytaj kopię', '', 'Nie udało się wczytać kopii', openBackup),
      ui.btn('Wklej tekst kopii', function () {
        pasteDialog('Wklej tekst kopii zapasowej', 'Jeśli kopia była zapisana przez skopiowanie tekstu, wklej go tutaj w całości.', function (text) { const obj = parseJson(text); checkBackup(obj); return function () { backupDialog(obj); }; });
      }, 'ghost')));

    el.appendChild(h('hr.divider'));
    el.appendChild(h('div.stack.tight', h('h3', 'Stary quiz'), h('p.small.muted', 'Jeśli w dawnym „Quizie egzaminacyjnym” są Twoje poprawki klucza albo własne pytania, wyeksportuj je tam do pliku i wczytaj tutaj. Przed zapisem zobaczysz, co się zmieni.')));
    el.appendChild(h('div.row', fileButton('Importuj poprawki ze starego quizu', '', 'Nie udało się zaimportować', function (text) { legacyDialog(legacyPlan(parseJson(text)), refreshAbout); })));

    el.appendChild(h('hr.divider'));
    el.appendChild(h('div.stack.tight', h('h3', 'Usuwanie postępu'), h('p.small.muted', 'Usuwa powtórki, odhaczone zadania, dziennik i notatki. Ustawienia zostają.')));
    el.appendChild(h('div.row', ui.btn('Usuń cały postęp', function () {
      const cloud = P.store.status().mode === 'cloud';
      ui.confirm('Usunąć cały postęp?',
        'Znikną wyniki powtórek pytań i fiszek, odhaczone zadania planu, dziennik nauki z sesjami oraz Twoje poprawki klucza, notatki i własne pytania. Ustawienia zostaną. Tej operacji nie da się cofnąć, więc jeśli postęp może się jeszcze przydać, najpierw zapisz kopię zapasową.' +
        (cloud ? ' Jeśli korzystasz z aplikacji także na innym urządzeniu, usuń postęp również tam — inaczej wróci przy synchronizacji.' : ''),
        'Usuń cały postęp', true).then(function (yes) { if (yes) { P.store.resetAll(); ui.toast('Postęp został usunięty'); } });
    }, 'bad')));
    return el;
  }

  /* ---------- o danych ---------- */
  function shares(map, order, labels) {
    const keys = Object.keys(map || {}).sort(function (a, b) { const i = order.indexOf(a), j = order.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || map[b] - map[a]; });
    const total = U.sum(keys, function (k) { return map[k] || 0; });
    if (!total) return h('p.small.muted', 'Brak danych.');
    return h('ul.us-shares', keys.map(function (k) {
      const n = map[k] || 0;
      return h('li', h('span.us-share-name', (labels && labels[k]) || k.charAt(0).toUpperCase() + k.slice(1)), h('span.num.us-share-n', n + ' · ' + F.pct(n / total)), ui.bar(n / total));
    }));
  }
  function aboutCard() {
    const m = P.data.meta || {}, counts = m.counts || {}, key = m.key || {}, exam = m.exam || {}, notes = P.store.get('notes');
    const el = section('O danych');
    const over = Object.keys(notes.over || {}).filter(function (k) { return notes.over[k] && notes.over[k].key; }).length, own = (notes.customQ || []).length;
    el.appendChild(h('div.grid.tight',
      ui.stat(String(counts.questions != null ? counts.questions : P.data.questions.length), 'pytań z arkuszy KG PSP'),
      ui.stat(String(counts.flashcards != null ? counts.flashcards : P.data.flashcards.length), 'fiszek'),
      ui.stat(String(counts.lessons != null ? counts.lessons : P.data.lessons.length), 'lekcji')));
    el.appendChild(h('div.row',
      m.legalDate ? ui.ref('Stan prawny na dzień ' + F.date(m.legalDate)) : null,
      m.built ? ui.ref('Dane zbudowano ' + F.date(m.built)) : null,
      exam.questions ? ui.ref('Egzamin: ' + exam.questions + ' pytań, ' + exam.minutes + ' min, próg ' + exam.pass_ + ' pkt') : null));

    const verif = key.verif || {}, total = U.sum(Object.keys(verif), function (k) { return verif[k] || 0; });
    const old = verif['stary-klucz'] || 0, none = verif.brak || 0;
    if (total && (old || none)) {
      el.appendChild(ui.banner('warn', 'Klucz odpowiedzi nie jest w pełni zweryfikowany',
        [old ? old + ' z ' + total + ' odpowiedzi pochodzi z wcześniejszego klucza i nie przeszło ponownej weryfikacji.' : '', none ? 'Bez klucza: ' + F.plural(none, 'pytanie', 'pytania', 'pytań') + '.' : '',
          'Przy każdym pytaniu aplikacja pokazuje pewność klucza.'].filter(Boolean).join(' ')));
    }
    el.appendChild(h('div.grid.us-grid',
      h('div.stack.tight', h('h3', 'Pewność klucza odpowiedzi'), shares(key.conf, ['wysoka', 'średnia', 'niska'])),
      h('div.stack.tight', h('h3', 'Sposób weryfikacji klucza'), shares(key.verif, ['zgodne'], VERIF))));
    if (over || own) el.appendChild(h('p.small.muted', 'Twoje zmiany: ' + F.plural(over, 'poprawka klucza', 'poprawki klucza', 'poprawek klucza') + ', ' + F.plural(own, 'własne pytanie', 'własne pytania', 'własnych pytań') + '.'));
    el.appendChild(ui.banner('', 'Zastrzeżenie', 'Pytania pochodzą z publikacji KG PSP. Klucz odpowiedzi i wyjaśnienia opracowano niezależnie i mogą zawierać błędy. Rozstrzygają aktualne teksty przepisów i norm.'));
    return el;
  }

  /* ---------- widok ---------- */
  function render(root) {
    let about = aboutCard();
    function refreshAbout() { const next = aboutCard(); if (about.parentNode) about.parentNode.replaceChild(next, about); about = next; }
    root.appendChild(h('div.view-head', h('div.stack.tight', h('h1', 'Ustawienia'), h('p', 'Zmiany zapisują się od razu.'))));
    root.appendChild(planCard());
    root.appendChild(reviewCard());
    root.appendChild(lookCard());
    root.appendChild(backupCard(refreshAbout));
    root.appendChild(about);
  }
  function leave() { if (unsubscribe) { unsubscribe(); unsubscribe = null; } }

  P.views.ustawienia = { title: 'Ustawienia', render: render, leave: leave };
})();
