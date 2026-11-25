/* Widok „Plan” (pełny harmonogram) oraz wspólna lista zadań P.planUI.taskList używana także na pulpicie „Dziś”. */
(function () {
  'use strict';
  var P = window.PPOZ, h = P.h, ui = P.ui, U = P.util, F = P.fmt;

  var DAY_FULL = { 'pon.': 'poniedziałek', 'wt.': 'wtorek', 'śr.': 'środa', 'czw.': 'czwartek', 'pt.': 'piątek', 'sob.': 'sobota', 'niedz.': 'niedziela' };
  var TYPE = { nauka: ['nauka', ''], powtorka: ['powtórka', 'accent'], lzejszy: ['tydzień lżejszy', 'ok'], egzaminy: ['egzaminy próbne', 'warn'] };
  var PRESETS = {
    '26': 'Pełny plan: jeden temat w tygodniu, tydzień lżejszy i trzy tygodnie powtórkowe',
    '20': 'Plan skrócony: bez tygodnia lżejszego, a pięć tygodni łączy po dwa tematy',
    '13': 'Plan intensywny: prawie każdy tydzień łączy dwa tematy'
  };

  function weeksWord(n) { return F.plural(n, 'tydzień', 'tygodnie', 'tygodni'); }
  function dmy(iso) { return F.dm(iso) + '.' + U.parse(iso).getFullYear(); }

  /* ---------- przejścia do innych modułów (z zabezpieczeniem, gdy modułu jeszcze nie ma) ---------- */
  function startQuestions(opts) {
    if (P.practice && typeof P.practice.start === 'function') P.practice.start(opts);
    else ui.toast('Sesje pytań nie są jeszcze dostępne.');
  }
  function startCards(opts) {
    if (P.cardsUI && typeof P.cardsUI.start === 'function') P.cardsUI.start(opts);
    else ui.toast('Sesje fiszek nie są jeszcze dostępne.');
  }
  function openView(name, param, payload) {
    if (!P.views[name]) { ui.toast('Ta część aplikacji nie jest jeszcze dostępna.'); return; }
    P.router.go(name, param || '', payload || null);
  }
  function openLesson(id, section) { openView('lekcja', id, section ? { section: section } : null); }

  /* ---------- lista zadań ---------- */
  function isExtra(t) { return /:x\d+$/.test(t.id); }
  function weekOf(t) { return P.data.weekByN[t.week] || {}; }
  /* Najbliższa wcześniejsza lekcja — dla zadań ustnych w tygodniach bez własnej lekcji. */
  function lessonBefore(n) { for (var i = n; i >= 1; i--) { var w = P.data.weekByN[i]; if (w && w.lesson) return w.lesson; } return null; }
  function quizSize(t) { var m = /\((\d+)\s+pyta/.exec(t.title); return m ? +m[1] : 25; }

  function taskAction(t, returnTo) {
    var lesson = t.lesson || weekOf(t).lesson || null, title = weekOf(t).title || '';
    function btn(label, fn) { return ui.btn(label, fn, 'sm'); }
    switch (t.kind) {
      case 'czytanie':
        return lesson ? btn('Otwórz lekcję', function () { openLesson(lesson); }) : btn('Przepisy i normy', function () { openView('zrodla'); });
      case 'notatka':
        return lesson ? btn('Pokaż ściągę', function () { openLesson(lesson, 'sciaga'); }) : null;
      case 'quiz':
        return btn('Rozpocznij quiz', function () {
          startQuestions({ mode: 'nauka', filter: { topics: t.topics || [] }, n: quizSize(t), label: isExtra(t) ? t.title : 'Quiz: ' + title, taskId: t.id, returnTo: returnTo });
        });
      case 'fiszki':
        return btn('Ucz się', function () {
          startCards({ filter: { topics: t.topics || [] }, label: isExtra(t) ? t.title : 'Fiszki: ' + title, taskId: t.id, returnTo: returnTo });
        });
      case 'ustny':
        lesson = lesson || lessonBefore(t.week);
        return lesson ? btn('Pytania otwarte', function () { openLesson(lesson, 'ustne'); }) : null;
      case 'egzamin':
        return t.sheet ? btn('Rozpocznij egzamin', function () { startQuestions({ mode: 'egzamin', sheet: t.sheet, taskId: t.id, returnTo: returnTo }); }) : null;
      default:
        return null;
    }
  }

  /* tasks: wynik P.plan.tasks(week). opts: { onChange(task, done), returnTo: nazwa widoku (domyślnie 'dzis'), highlightDay: skrót dnia do wyróżnienia } */
  function taskList(tasks, opts) {
    opts = opts || {};
    var ul = h('ul.plan-tasks');
    tasks.forEach(function (t) {
      var li = h('li.plan-task' + (t.done ? '.done' : ''));
      var cb = h('input', { type: 'checkbox', checked: !!t.done, onchange: function () {
        t.done = cb.checked; P.plan.setTask(t.id, t.done); li.classList.toggle('done', t.done);
        if (opts.onChange) opts.onChange(t, t.done);
      } });
      li.appendChild(h('label.plan-task-main', cb, h('span.plan-task-title', t.title)));
      var today = !!t.day && t.day === opts.highlightDay;
      li.appendChild(h('div.plan-task-info',
        h('div.row',
          t.day ? h('span.chip' + (today ? '.accent' : ''), { title: DAY_FULL[t.day] || null }, today ? t.day + ' · dziś' : t.day) : null,
          h('span.num.small.muted', F.mins(t.min))),
        t.desc ? h('p.small.muted', t.desc) : null));
      var act = taskAction(t, opts.returnTo || 'dzis');
      if (act) li.appendChild(h('div.plan-task-act', act));
      ul.appendChild(li);
    });
    return ul;
  }

  P.planUI = { taskList: taskList, startQuestions: startQuestions, startCards: startCards, openLesson: openLesson, openView: openView };

  /* ---------- widok planu ---------- */
  var openState = {}, openKey = '';

  function allTasks(cw) { var t = []; cw.weeks.forEach(function (w) { t = t.concat(P.plan.tasks(w)); }); return t; }

  /* Średni czas tygodnia w wybranym wariancie: zadania planu i codzienne powtórki. */
  function presetHours(key) {
    var weeks = P.data.plan.presets[key] || [], total = 0;
    weeks.forEach(function (ns) { ns.forEach(function (n) { total += U.sum(P.plan.tasks(P.data.weekByN[n]), function (t) { return t.min; }); }); });
    var avg = (weeks.length ? total / weeks.length : 0) + ((P.data.plan.daily && P.data.plan.daily.min) || 0) * 7;
    return String(Math.round(avg / 30) / 2).replace('.', ',');
  }

  /* Blok wyświetlany nad tygodniem. Tygodnie powtórkowe wplecione między bloki tematyczne zostają pod nagłówkiem poprzedniego bloku. */
  function displayBlocks(weeks) {
    var raw = weeks.map(function (cw) {
      var b = cw.weeks.filter(function (w) { return w.block !== 'F'; })[0];
      return b ? b.block : 'F';
    }), last = -1, out = [];
    raw.forEach(function (b, i) { if (b !== 'F') last = i; });
    raw.forEach(function (b, i) { out.push(b === 'F' && i > 0 && i < last ? out[i - 1] : b); });
    return out;
  }

  /* Akt czytany w kilku tygodniach ma osobne oznaczenie dla każdego fragmentu; akt czytany raz — jedno wspólne z resztą aplikacji. */
  var readWeeks = null;
  function weeksReading(src) {
    if (!readWeeks) {
      readWeeks = {};
      P.data.plan.weeks.forEach(function (w) { (w.readings || []).forEach(function (r) { var a = readWeeks[r.src] = readWeeks[r.src] || []; if (a.indexOf(w.n) < 0) a.push(w.n); }); });
    }
    return readWeeks[src] || [];
  }
  function readKey(src, n) { return weeksReading(src).length > 1 ? src + '@' + n : src; }
  function setReading(src, n, on) {
    P.plan.setRead(readKey(src, n), 'r', on);
    var ws = weeksReading(src);
    if (ws.length > 1) {
      var all = ws.every(function (k) { return P.plan.readState(src + '@' + k).r; });
      if (P.plan.readState(src).r !== all) P.plan.setRead(src, 'r', all);
    }
  }

  function readsList(w) {
    var ul = h('ul.plan-reads'), stale = false;
    w.readings.forEach(function (r) {
      var act = P.data.actById[r.src], chip = null;
      if (act && act.inForce) chip = ui.chip('obowiązuje', 'ok');
      else if (act) { stale = true; chip = ui.chip(act.repealDate ? 'nie obowiązuje od ' + dmy(act.repealDate) : 'nie obowiązuje', 'warn'); }
      ul.appendChild(h('li.plan-read',
        ui.check(r.text, P.plan.readState(readKey(r.src, w.n)).r, function (on) { setReading(r.src, w.n, on); }, act ? act.short : null), chip));
    });
    var wrap = h('div.stack', ul);
    if (stale) wrap.appendChild(h('p.small.muted', 'Akty oznaczone jako nieobowiązujące czytaj w ostatnim brzmieniu: pytania egzaminacyjne nadal się do nich odwołują. ',
      h('a', { href: '#zrodla', onclick: function (e) { e.preventDefault(); openView('zrodla'); } }, 'Stan prawny i teksty aktów')));
    return wrap;
  }

  function normsList(w) {
    return h('ul.plan-norms', w.norms.map(function (base) {
      var n = P.data.normByBase[base];
      if (!n) return h('li.plan-norm', h('span.row', ui.ref(base)));
      var cur = n.current || [], onlyEn = cur.length && cur.every(function (c) { return (c.langs || []).indexOf('pol') < 0; });
      var li = h('li.plan-norm',
        h('span.row', ui.ref(cur.length ? cur.map(function (c) { return c.num; }).join(', ') : base),
          !cur.length ? ui.chip('brak aktualnego wydania', 'warn') : null, onlyEn ? ui.chip('tylko po angielsku') : null),
        n.title ? h('span.small', n.title.replace(/\s--\s/g, ' – ')) : null);
      if (!cur.length && n.successor && n.successor.length) li.appendChild(h('span.small.muted', 'Zastąpiona przez: ' + n.successor.join(', ') + '.'));
      if (n.staleCited && n.staleCited.length) li.appendChild(h('span.tiny.muted', 'Pytania egzaminacyjne cytują też starsze wydania: ' + n.staleCited.join(', ') + '.'));
      return li;
    }));
  }

  function weekBody(cw, onTask) {
    var multi = cw.weeks.length > 1, sub = multi ? 'h4.label' : 'h3.label';
    return h('div.plan-week-body', cw.weeks.map(function (w) {
      var sec = h('div.plan-part');
      if (multi) sec.appendChild(h('h3', w.title));
      if (w.focus) sec.appendChild(h('p.muted', w.focus));
      if (w.readings && w.readings.length) { sec.appendChild(h(sub, 'Co przeczytać (zaznacz przeczytane)')); sec.appendChild(readsList(w)); }
      if (w.norms && w.norms.length) { sec.appendChild(h(sub, 'Normy: aktualne wydania')); sec.appendChild(normsList(w)); }
      sec.appendChild(h(sub, 'Zadania'));
      sec.appendChild(taskList(P.plan.tasks(w), { onChange: onTask, returnTo: 'plan' }));
      if (w.lesson) sec.appendChild(h('div.row', h('a.btn.sm', { href: '#lekcja-' + w.lesson, onclick: function (e) { e.preventDefault(); openLesson(w.lesson); } }, 'Otwórz lekcję')));
      return sec;
    }));
  }

  function weekItem(cw, idx, phase, onTask) {
    var current = phase === 'w-trakcie' && cw.i === idx, past = phase === 'po' || (phase === 'w-trakcie' && cw.i < idx);
    var det = h('details.plan-week' + (current ? '.current' : ''));
    var prog = h('span.plan-week-prog'), chips = h('span.plan-week-chips'), body = null;
    var types = []; cw.weeks.forEach(function (w) { if (types.indexOf(w.type) < 0) types.push(w.type); });
    function draw() {
      var tasks = allTasks(cw), done = tasks.filter(function (t) { return t.done; }).length, full = tasks.length > 0 && done === tasks.length;
      P.clear(prog); prog.appendChild(ui.bar(tasks.length ? done / tasks.length : 0, full ? 'ok' : ''));
      prog.appendChild(h('span.num.tiny', { 'aria-label': 'Zadania: ' + done + ' z ' + tasks.length }, done + '/' + tasks.length));
      P.clear(chips);
      types.forEach(function (t) { var d = TYPE[t] || [t, '']; chips.appendChild(ui.chip(d[0], d[1])); });
      if (current) chips.appendChild(ui.chip('bieżący tydzień', 'accent'));
      if (full) chips.appendChild(ui.chip('ukończony', 'ok'));
      else if (past) chips.appendChild(ui.chip('zaległe zadania: ' + (tasks.length - done), 'warn'));
    }
    function ensure() { if (!body) { body = weekBody(cw, function () { draw(); onTask(); }); det.appendChild(body); } }
    /* Treść tygodnia powstaje przy pierwszym rozwinięciu (kliknięcie lub klawisz na nagłówku), jeszcze przed otwarciem. */
    det.appendChild(h('summary', { onclick: ensure },
      h('span.plan-week-id.num', 'Tydz. ' + (cw.i + 1) + ' · ' + F.range(cw.start, cw.end)),
      h('span.plan-week-title', cw.weeks.map(function (w) { return h('span.plan-week-name', w.title); }), chips),
      prog));
    det.addEventListener('toggle', function () { openState[cw.i] = det.open; if (det.open) ensure(); });
    draw();
    if (cw.i in openState ? openState[cw.i] : current) { det.open = true; ensure(); }
    return det;
  }

  function render(root) {
    var rangeLine = h('p'), jump = ui.btn('Pokaż bieżący tydzień', showCurrent, 'sm'), list = h('div.plan-list');
    var presetNote = h('p.small.muted', { 'aria-live': 'polite' }), examSlot = h('div.stack', { 'aria-live': 'polite' }), currentEl = null;
    var startInput = h('input.input', { type: 'date', onchange: function () {
      if (!startInput.value) { startInput.value = P.plan.start(); return; }
      var mon = U.monday(startInput.value);
      if (mon !== startInput.value) ui.toast('Plan zaczyna się w poniedziałek ' + dmy(mon) + '.');
      P.setSetting('start', mon); refresh();
    } });
    var examInput = h('input.input', { type: 'date', onchange: function () { P.setSetting('exam', examInput.value || null); refresh(); } });

    function shift(days) { P.setSetting('start', U.addDays(P.plan.start(), days)); refresh(); }
    function setPreset(v) { P.setSetting('preset', v); refresh(); }
    function showCurrent() {
      if (!currentEl) return;
      currentEl.open = true; currentEl.scrollIntoView({ block: 'start' });
      var s = currentEl.querySelector('summary'); if (s) s.focus();
    }

    function drawHead() {
      var weeks = P.plan.calWeeks(), total = 0, done = 0;
      weeks.forEach(function (cw) { allTasks(cw).forEach(function (t) { total++; if (t.done) done++; }); });
      P.clear(rangeLine);
      rangeLine.appendChild(h('span.num', dmy(P.plan.start()) + ' – ' + dmy(P.plan.end())));
      rangeLine.appendChild(document.createTextNode(' · ' + weeksWord(weeks.length) + ' · wykonane zadania: ' + done + ' z ' + total));
    }

    function drawExam() {
      P.clear(examSlot);
      var s = P.settings(), exam = s.exam, start = P.plan.start(), end = P.plan.end();
      if (!exam) return;
      if (end <= exam) {
        var spare = U.diffDays(end, exam);
        examSlot.appendChild(h('p.small.muted', spare === 0 ? 'Plan kończy się w dniu egzaminu.' : 'Plan kończy się ' + F.plural(spare, 'dzień', 'dni', 'dni') + ' przed egzaminem.'));
        return;
      }
      function fits(from, key) { return U.addDays(from, 7 * P.data.plan.presets[key].length - 1) <= exam; }
      var sug = P.plan.suggestPreset(start, exam), mon = U.monday(U.today()), sugNow = P.plan.suggestPreset(mon, exam);
      var text = 'Plan kończy się ' + F.date(end) + ', a egzamin jest ' + F.date(exam) + '. ', action = null;
      if (fits(start, sug) && sug !== s.preset) {
        text += 'Wariant ' + sug + ' tygodni zmieści się przed egzaminem.';
        action = ui.btn('Zmień na ' + weeksWord(+sug), function () { setPreset(sug); }, 'sm');
      } else if (start > mon && fits(mon, sugNow)) {
        text += 'Wariant ' + sugNow + ' tygodni zmieści się, jeśli zaczniesz w tym tygodniu.';
        action = ui.btn('Zacznij w tym tygodniu, ' + weeksWord(+sugNow), function () { var st = P.settings(); st.start = mon; st.preset = sugNow; P.store.save('settings'); refresh(); }, 'sm');
      } else {
        text += 'Do egzaminu jest za mało czasu na cały plan. Wybierz wariant 13 tygodni, a w ostatnich tygodniach postaw na egzaminy próbne i pulę błędów.';
        if (s.preset !== '13') action = ui.btn('Zmień na 13 tygodni', function () { setPreset('13'); }, 'sm');
      }
      var b = ui.banner('warn', 'Plan kończy się po egzaminie', text);
      if (action) b.firstChild.appendChild(h('div.row', action));
      examSlot.appendChild(b);
    }

    function drawList() {
      var s = P.settings(), weeks = P.plan.calWeeks(), idx = P.plan.index(), phase = P.plan.phase(), key = s.preset + '|' + P.plan.start();
      if (key !== openKey) { openState = {}; openKey = key; }
      var blocks = displayBlocks(weeks), prev = null;
      P.clear(list); currentEl = null;
      weeks.forEach(function (cw, i) {
        if (blocks[i] !== prev) {
          prev = blocks[i];
          var b = P.data.blockById[prev];
          list.appendChild(h('h2.plan-block', h('b', { 'aria-hidden': 'true' }, prev), h('span', b ? b.name : 'Blok ' + prev)));
        }
        var el = weekItem(cw, idx, phase, drawHead);
        if (phase === 'w-trakcie' && cw.i === idx) currentEl = el;
        list.appendChild(el);
      });
      jump.style.display = currentEl ? '' : 'none';
    }

    function refresh() {
      var s = P.settings(), key = PRESETS[s.preset] ? s.preset : '26';
      startInput.value = P.plan.start(); examInput.value = s.exam || '';
      presetNote.textContent = PRESETS[key] + '; średnio około ' + presetHours(key) + ' h nauki tygodniowo.';
      drawHead(); drawExam(); drawList();
      P.router.updateNav();
    }

    var cur = P.settings().preset, seg = ui.seg(['26', '20', '13'].map(function (k) { return { value: k, label: weeksWord(+k) }; }), PRESETS[cur] ? cur : '26', setPreset);
    seg.setAttribute('aria-label', 'Wariant planu');

    root.appendChild(h('header.view-head', h('div.stack.tight', h('h1', 'Plan nauki'), rangeLine), jump));
    root.appendChild(h('section.card', { 'aria-label': 'Ustawienia planu' },
      h('div.plan-set',
        h('div.field.plan-set-wide', h('span', 'Wariant planu'), h('div', seg), presetNote),
        h('div.stack',
          ui.field('Początek planu', startInput, 'Plan zawsze zaczyna się w poniedziałek.'),
          h('div.row', ui.btn('Przesuń o tydzień wcześniej', function () { shift(-7); }, 'sm'), ui.btn('Przesuń o tydzień później', function () { shift(7); }, 'sm'))),
        h('div.stack', ui.field('Data egzaminu', examInput, 'Opcjonalnie. Terminy ogłasza KG PSP.'))),
      examSlot,
      h('div.row', ui.btn('Zapisz plan w kalendarzu (.ics)', function () { ui.saveFile('plan-nauki-rzeczoznawca.ics', P.plan.ics(), 'text/calendar'); }),
        h('span.small.muted.grow', 'Jedno wydarzenie w poniedziałek każdego tygodnia, z listą zadań.'))));
    root.appendChild(list);
    refresh();
  }

  P.views.plan = { title: 'Plan nauki', render: render };
})();
