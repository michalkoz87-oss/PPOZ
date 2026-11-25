/* Widok „Dziś”: pulpit dnia — powtórki, zadania bieżącego tygodnia, nowy materiał, liczby postępu. */
(function () {
  'use strict';
  var P = window.PPOZ, h = P.h, ui = P.ui, U = P.util, F = P.fmt;
  var DAY_ABBR = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];

  /* Sam odmieniony rzeczownik, bez liczby: word(5, 'pytanie', 'pytania', 'pytań') → 'pytań' */
  function word(n, one, few, many) { return F.plural(n, one, few, many).replace(/^\S+\s/, ''); }
  function days(n) { return F.plural(n, 'dzień', 'dni', 'dni'); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function points(n) { return (n < 0 ? '−' : '') + Math.abs(n) + ' pkt'; }

  function render(root) {
    var s = P.settings(), today = U.today(), t = P.today(), phase = P.plan.phase(), weeks = P.plan.calWeeks(), idx = P.plan.index(), X = P.planUI;

    function redraw() { P.clear(root); render(root); P.router.updateNav(); }
    function titles(cw) { return cw.weeks.map(function (w) { return w.title; }).join(' + '); }

    /* ---------- nagłówek ---------- */
    function head() {
      var line = null, count = null;
      if (phase === 'w-trakcie') line = h('p', h('b', 'Tydzień ' + (idx + 1) + ' z ' + weeks.length + ': '), titles(t.week));
      if (s.exam) {
        var left = U.diffDays(today, s.exam);
        count = h('div.dzis-exam', h('span.label', left > 0 ? 'Do egzaminu' : 'Egzamin'),
          h('b.num', left > 0 ? days(left) : left === 0 ? 'dziś' : 'po terminie'),
          h('span.tiny.muted', F.date(s.exam)));
      }
      return h('header.view-head', h('div.stack.tight', h('h1', cap(F.dow(today)) + ', ' + F.date(today)), line), count);
    }

    function phaseNote() {
      if (phase === 'przed') {
        var start = P.plan.start();
        return h('div.banner.dzis-note',
          h('div.stack.tight.grow', h('b', 'Plan zaczyna się w poniedziałek ' + F.date(start)),
            h('span', 'Do startu: ' + days(U.diffDays(today, start)) + '. Możesz też zacząć od razu, wtedy pierwszy tydzień planu przypadnie na bieżący tydzień.')),
          ui.btn('Zacznij w tym tygodniu', function () { P.setSetting('start', U.monday(U.today())); redraw(); }, 'primary sm'));
      }
      if (phase === 'po') {
        return h('div.banner.ok.dzis-note', h('div.stack.tight.grow', h('b', 'Plan zakończony ' + F.date(P.plan.end())),
          h('span', 'Codzienne powtórki, pula błędów i egzaminy próbne działają dalej.')));
      }
      return null;
    }

    /* ---------- pierwsze uruchomienie ---------- */
    function introCard() {
      var m = P.data.meta, ex = m.exam || {}, n = ex.questions || 40;
      var inp = h('input.input', { type: 'date', value: s.exam || '' });
      function item(lead, text) { return h('li', h('b', lead + '. '), text); }
      return h('section.card.dzis-intro', { 'aria-labelledby': 'dzis-intro-h' },
        h('h2', { id: 'dzis-intro-h' }, 'Jak to działa'),
        h('ol.dzis-steps',
          item('Plan tygodnia', 'Każdy tydzień ma jeden temat i kilka krótkich zadań: czytanie, własna tabela, quiz, fiszki i pytania na głos.'),
          item('Codzienne powtórki', '5–10 minut dziennie. Pytania i fiszki wracają w rosnących odstępach, zanim zdążysz je zapomnieć.'),
          item('Pytania z wyjaśnieniami', F.plural(m.counts.questions, 'pytanie', 'pytania', 'pytań') + ' z rzeczywistych egzaminów, z podstawą prawną i oznaczoną pewnością klucza odpowiedzi.'),
          item('Egzaminy z punktami ujemnymi', F.plural(n, 'pytanie', 'pytania', 'pytań') + ' w ' + (ex.minutes || 40) + ' minut: +1 za dobrą odpowiedź, −1 za złą, 0 za brak. Zalicza ' + P.exam.passMark(n) + ' pkt.')),
        h('div.dzis-intro-foot',
          ui.field('Data egzaminu', inp, 'Opcjonalnie. Możesz ją podać lub zmienić później w planie.'),
          h('div.row',
            ui.btn('Zaczynam', function () { var st = P.settings(); if (inp.value) st.exam = inp.value; st.intro = true; P.store.save('settings'); redraw(); }, 'primary'),
            ui.btn('Jak się uczyć', function () { X.openView('metoda'); }, 'ghost'))));
    }

    /* ---------- stan prawny (informacja jednorazowa) ---------- */
    function legalNote() {
      var m = P.data.meta, wt = P.data.actById.wt_2002, text;
      if (wt && !wt.inForce) {
        var d = wt.repealDate ? F.dm(wt.repealDate) + '.' + U.parse(wt.repealDate).getFullYear() : '21.09.2026';
        text = 'Warunki techniczne budynków z 2002 r. utraciły moc ' + d + '; nowych jeszcze nie ogłoszono. Aplikacja uczy ostatniego brzmienia i aktualnych wydań norm.';
      } else text = 'Pytania i lekcje opisują przepisy oraz wydania norm według tego stanu. Zmiany sprawdzaj w źródłach.';
      var box = h('div.banner.warn.dzis-note', { role: 'note' }, P.icon('warn'),
        h('div.stack.tight.grow', h('b', 'Stan prawny na ' + F.date(m.legalDate)), h('span', text)),
        h('div.row',
          ui.btn('Przepisy i normy', function () { X.openView('zrodla'); }, 'sm'),
          ui.btn('Zamknij', function () {
            P.setSetting('legalSeen', m.legalDate);
            var next = box.nextElementSibling; box.remove();
            var f = next && next.querySelector('button, a[href], input'); if (f) f.focus();
          }, 'sm ghost')));
      return box;
    }

    /* ---------- kafel z liczbą i przyciskiem ---------- */
    function tile(value, label, note, btnLabel, onClick, primary) {
      return h('div.dzis-tile', ui.stat(String(value), label), note ? h('p.small.muted', note) : null,
        btnLabel ? ui.btn(btnLabel, onClick, primary ? 'primary' : '') : null);
    }

    function startNewQ() { X.startQuestions({ mode: 'nauka', filter: { topics: t.topics, state: 'new' }, n: s.newQ, label: 'Nowe pytania z tematu tygodnia', returnTo: 'dzis' }); }
    function startNewF() { X.startCards({ filter: { topics: t.topics, state: 'new' }, n: s.newF, label: 'Nowe fiszki z tematu tygodnia', returnTo: 'dzis' }); }

    /* ---------- (1) powtórki ---------- */
    function nextDue() {
      var srs = P.store.get('srs'), now = U.dayNum(), best = 0, any = false;
      ['q', 'f'].forEach(function (k) { Object.keys(srs[k]).forEach(function (id) { var x = srs[k][id]; if (!x || !x[0]) return; any = true; if (x[1] > now && (!best || x[1] < best)) best = x[1]; }); });
      return { any: any, inDays: best ? best - now : 0 };
    }
    function reviewsCard() {
      var card = h('section.card', { 'aria-labelledby': 'dzis-rev-h' }), total = t.capQ + t.capF;
      var est = Math.max(1, Math.round((t.capQ * 30 + t.capF * 12) / 60));
      card.appendChild(h('div.card-head', h('h2', { id: 'dzis-rev-h' }, 'Powtórki na dziś'), total ? h('span.small.muted', 'około ' + F.mins(est)) : null));
      if (!total) {
        var nd = nextDue(), msg;
        if (!nd.any) msg = 'Powtórki pojawią się po pierwszej sesji pytań lub fiszek. Każda odpowiedź wraca potem w rosnących odstępach.';
        else msg = 'Na dziś wszystko powtórzone.' + (nd.inDays ? ' Następne powtórki: ' + (nd.inDays === 1 ? 'jutro' : 'za ' + days(nd.inDays)) + '.' : '');
        card.appendChild(h('p.muted', msg));
        if (t.newQ.length || t.newF.length) {
          card.appendChild(h('div.row', h('span.small.grow', 'Wolny czas przeznacz na nowy materiał z tematu tygodnia.'),
            t.newQ.length ? ui.btn('Ucz się nowych pytań', startNewQ, 'primary') : ui.btn('Ucz się nowych fiszek', startNewF, 'primary')));
        }
        return card;
      }
      var ids = t.dueQ.slice().sort(function (a, b) { return P.srs.get('q', a.id)[1] - P.srs.get('q', b.id)[1]; }).slice(0, t.capQ).map(function (q) { return q.id; });
      card.appendChild(h('div.dzis-duo',
        tile(t.capQ, word(t.capQ, 'pytanie do powtórki', 'pytania do powtórki', 'pytań do powtórki'),
          t.dueQ.length > t.capQ ? 'Zaległych jest ' + t.dueQ.length + '; dzienny limit to ' + s.cap + '.' : null,
          t.capQ ? 'Powtórz pytania' : null, function () { X.startQuestions({ mode: 'powtorka', ids: ids, label: 'Powtórki na dziś', returnTo: 'dzis' }); }, true),
        tile(t.capF, word(t.capF, 'fiszka do powtórki', 'fiszki do powtórki', 'fiszek do powtórki'),
          t.dueF.length > t.capF ? 'Zaległych jest ' + t.dueF.length + '; dzienny limit to ' + s.cap + '.' : null,
          t.capF ? 'Powtórz fiszki' : null, function () { X.startCards({ filter: { state: 'due' }, n: t.capF, label: 'Powtórki na dziś', returnTo: 'dzis' }); }, !t.capQ)));
      return card;
    }

    /* ---------- (2) bieżący tydzień ---------- */
    function weekCard() {
      var cw = t.week, multi = cw.weeks.length > 1, prog = h('div.dzis-prog');
      var label = phase === 'przed' ? 'Pierwszy tydzień planu' : phase === 'po' ? 'Ostatni tydzień planu' : 'Bieżący tydzień';
      function drawProg() {
        var all = []; cw.weeks.forEach(function (w) { all = all.concat(P.plan.tasks(w)); });
        var done = all.filter(function (x) { return x.done; }), left = U.sum(all, function (x) { return x.done ? 0 : x.min; });
        P.clear(prog);
        prog.appendChild(ui.bar(P.plan.calProgress(cw), all.length && done.length === all.length ? 'ok' : ''));
        prog.appendChild(h('span.small.muted', 'Zadania: ' + done.length + ' z ' + all.length + (left ? ' · zostało ' + F.mins(left) : ' · tydzień ukończony')));
      }
      var card = h('section.card', { 'aria-labelledby': 'dzis-week-h' },
        h('div.card-head', h('span.label', label), h('span.num.small.muted', 'Tydz. ' + (cw.i + 1) + ' · ' + F.range(cw.start, cw.end))),
        h('h2', { id: 'dzis-week-h' }, multi ? 'Tematy tygodnia' : cw.weeks[0].title),
        !multi && cw.weeks[0].focus ? h('p.muted', cw.weeks[0].focus) : null, prog);
      var mark = phase === 'w-trakcie' ? DAY_ABBR[U.parse(today).getDay()] : '';
      cw.weeks.forEach(function (w) {
        if (multi) { card.appendChild(h('h3', w.title)); if (w.focus) card.appendChild(h('p.muted', w.focus)); }
        card.appendChild(X.taskList(P.plan.tasks(w), { onChange: drawProg, returnTo: 'dzis', highlightDay: mark }));
      });
      card.appendChild(h('div.row', ui.btn('Cały plan', function () { X.openView('plan'); }, 'sm ghost')));
      drawProg();
      return card;
    }

    /* ---------- (3) nowy materiał ---------- */
    function newCard() {
      var nq = Math.min(t.newQ.length, s.newQ), nf = Math.min(t.newF.length, s.newF);
      var card = h('section.card', { 'aria-labelledby': 'dzis-new-h' },
        h('div.card-head', h('h2', { id: 'dzis-new-h' }, 'Nowy materiał z tematu tygodnia'),
          t.topics.length && t.topics.length <= 4 ? h('span.row', t.topics.map(function (c) { return ui.chip(P.topicName(c, true)); })) : null));
      if (!t.topics.length) {
        card.appendChild(h('p.muted', 'W tym tygodniu nie ma nowego tematu. Czas przeznacz na egzaminy próbne, pulę błędów i powtórki.'));
        return card;
      }
      var allQ = P.q.pool({ topics: t.topics }).length, allF = P.cards.pool({ topics: t.topics }).length;
      if (!allQ && !allF) { card.appendChild(h('p.muted', 'Do tematu tygodnia nie przypisano jeszcze pytań ani fiszek. Zacznij od lekcji i lektury przepisów.')); return card; }
      if (!nq && !nf) { card.appendChild(h('p.muted', 'Wszystkie pytania i fiszki z tematu tygodnia masz już w powtórkach.')); return card; }
      card.appendChild(h('div.dzis-duo',
        tile(nq, word(nq, 'nowe pytanie', 'nowe pytania', 'nowych pytań'),
          allQ ? 'Nowych w temacie: ' + t.newQ.length + ' z ' + allQ + '. Dzienny limit: ' + s.newQ + '.' : 'W tym temacie nie ma pytań.',
          nq ? 'Ucz się nowych pytań' : null, startNewQ, false),
        tile(nf, word(nf, 'nowa fiszka', 'nowe fiszki', 'nowych fiszek'),
          allF ? 'Nowych w temacie: ' + t.newF.length + ' z ' + allF + '. Dzienny limit: ' + s.newF + '.' : 'W tym temacie nie ma fiszek.',
          nf ? 'Ucz się nowych fiszek' : null, startNewF, false)));
      return card;
    }

    /* ---------- (4) liczby ---------- */
    function statsCard() {
      var mon = U.monday(today), mins = P.log.minutes(mon, U.addDays(mon, 6)), goal = (s.hours || 4) * 60;
      var sum = P.srs.summary('q', P.q.pool({ reserved: true }).map(function (q) { return q.id; })), seen = sum.total - sum.fresh;
      var exams = P.log.sessions('egzamin'), last = exams[exams.length - 1], streak = P.log.streak();
      var time = ui.stat(F.mins(mins), 'z ' + F.mins(goal) + ' w tym tygodniu');
      time.appendChild(ui.bar(goal ? mins / goal : 0, mins >= goal ? 'ok' : ''));
      return h('section.card', { 'aria-labelledby': 'dzis-stat-h' },
        h('div.card-head', h('h2', { id: 'dzis-stat-h' }, 'Postęp'), ui.btn('Statystyki', function () { X.openView('statystyki'); }, 'sm ghost')),
        h('div.dzis-stats',
          ui.stat(String(streak), word(streak, 'dzień nauki z rzędu', 'dni nauki z rzędu', 'dni nauki z rzędu')),
          time,
          ui.stat(sum.total ? F.pct(seen / sum.total) : '–', 'pytań przerobionych (' + seen + ' z ' + sum.total + ')'),
          last && typeof last.points === 'number'
            ? ui.stat(points(last.points), 'ostatni egzamin próbny: ' + (last.passed ? 'zaliczony' : 'poniżej progu ' + P.exam.passMark(last.n || 40) + ' pkt'))
            : ui.stat('–', 'nie było jeszcze egzaminu próbnego')));
    }

    root.appendChild(head());
    var note = phaseNote(); if (note) root.appendChild(note);
    if (s.intro === false) root.appendChild(introCard());
    if (s.legalSeen !== P.data.meta.legalDate) root.appendChild(legalNote());
    root.appendChild(reviewsCard());
    root.appendChild(weekCard());
    root.appendChild(newCard());
    root.appendChild(statsCard());
  }

  P.views.dzis = { title: 'Dziś', render: render };
})();
