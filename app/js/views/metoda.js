/* Widok „Jak się uczyć”: metoda nauki w ośmiu krótkich punktach. Treść stała; liczby pochodzą z danych aplikacji. */
(function () {
  'use strict';
  var P = window.PPOZ, h = P.h, ui = P.ui, U = P.util, F = P.fmt;

  function section(n, title, parts) {
    return h('section.metoda-sec', { 'aria-labelledby': 'metoda-h' + n },
      h('span.metoda-n', { 'aria-hidden': 'true' }, String(n)),
      h('div.metoda-body', h('h2', { id: 'metoda-h' + n }, title), parts));
  }
  function p(text) { return h('p', text); }
  function num(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace('.', ','); }

  function render(root) {
    var D = P.data, plan = D.plan, ex = D.meta.exam || {}, nq = ex.questions || 40, pass = P.exam.passMark(nq);
    var reserved = plan.reservedSheets || [], sheets = ex.sheets || 14, firstRes = reserved.length ? Math.min.apply(null, reserved) : sheets + 1;

    /* 1. rytm tygodnia */
    var total = U.sum(plan.rhythm, function (r) { return r.min; });
    var rhythm = ui.table(['Dzień', 'Zadanie', 'Czas'], plan.rhythm.map(function (r) { return [r.day, r.title, F.mins(r.min)]; }), [2]);

    /* 2. odstępy powtórek */
    var steps = h('div.metoda-steps', { role: 'img', 'aria-label': 'Odstępy powtórek w dniach: ' + P.srs.intervals.slice(1).join(', ') });
    P.srs.intervals.slice(1).forEach(function (d, i) {
      if (i) steps.appendChild(h('span.metoda-arrow', { 'aria-hidden': 'true' }, '→'));
      steps.appendChild(h('span.metoda-step.num', { 'aria-hidden': 'true' }, String(d)));
    });
    steps.appendChild(h('span.small.muted', { 'aria-hidden': 'true' }, 'dni'));

    /* 3. punkty ujemne: średni zysk z odpowiedzi = p − (1 − p) */
    var odds = ui.table(['Szansa trafienia', 'Średnio za odpowiedź'], [[1 / 3, 'strzał w ciemno'], [0.5, 'jeden wariant odrzucony'], [0.75, 'prawie pewność']].map(function (r) {
      return [F.pct(r[0]) + ' (' + r[1] + ')', num(2 * r[0] - 1) + ' pkt'];
    }), [1]);

    /* 7. gotowość: stan użytkownika na tle progów */
    var exams = P.log.sessions('egzamin').filter(function (s) { return typeof s.points === 'number'; }), last3 = exams.slice(-3);
    var errors = P.q.pool({ state: 'errors', reserved: true }).length;
    var sum = P.srs.summary('q', P.q.pool({ reserved: true }).map(function (q) { return q.id; })), seen = sum.total ? (sum.total - sum.fresh) / sum.total : 0;
    function state(ok, text) { return h('span.row', h('span.num', text), ui.chip(ok ? 'spełnione' : 'jeszcze nie', ok ? 'ok' : '')); }
    var ready = ui.table(['Kryterium', 'Twój stan'], [
      ['Trzy kolejne egzaminy próbne z wynikiem co najmniej 26 pkt',
        state(last3.length === 3 && last3.every(function (s) { return s.points >= 26; }), last3.length ? last3.map(function (s) { return (s.points < 0 ? '−' : '') + Math.abs(s.points); }).join(', ') + ' pkt' : 'brak prób')],
      ['Mniej niż 30 pytań w puli błędów', state(seen > 0 && errors < 30, String(errors))],
      ['Co najmniej 80% pytań przerobionych', state(seen >= 0.8, F.pct(seen))]
    ]);

    /* 8. pewność klucza */
    var conf = (D.meta.key && D.meta.key.conf) || {}, noKey = D.questions.filter(function (q) { return !q.key; }).length;
    var confLine = ['wysoka', 'średnia', 'niska'].filter(function (k) { return conf[k]; }).map(function (k) { return k + ' – ' + conf[k]; }).join(', ');

    root.appendChild(h('header.view-head', h('div.stack.tight', h('h1', 'Jak się uczyć'),
      h('p', 'Egzamin sprawdza pamięć do liczb i przepisów oraz rozsądek przy punktach ujemnych. Plan ćwiczy jedno i drugie.'))));

    root.appendChild(h('article.card.metoda',
      section(1, 'Rytm tygodnia', [
        p('Każdy tydzień nauki to te same kroki: czytanie aktywne, własna tabela wartości, czysta kartka, quiz z wyjaśnieniami, fiszki z pulą błędów i pytania na głos. Samo czytanie daje złudzenie wiedzy. Pamięć buduje wysiłek przypominania.'),
        rhythm,
        h('p.small.muted', 'Razem ' + F.mins(total) + ' w tygodniu, do tego codzienne powtórki.')
      ]),
      section(2, 'Codzienne powtórki', [
        p('5–10 minut dziennie, najlepiej na telefonie. Każda dobra odpowiedź odsuwa pytanie lub fiszkę o kolejny, dłuższy odstęp:'),
        steps,
        p('Błąd cofa pozycję do jutra. Czas idzie więc na to, czego jeszcze nie umiesz, a nie na to, co już wiesz.')
      ]),
      section(3, 'Punkty ujemne', [
        p('Wynik to liczba odpowiedzi poprawnych minus liczba błędnych; brak odpowiedzi nic nie kosztuje. Zalicza ' + pass + ' pkt z ' + nq + '. Odpowiadaj, gdy szansa trafienia przekracza 50%.'),
        odds,
        p('Po to są przyciski „jestem pewny” i „zgaduję” oraz statystyka kalibracji: pokazuje, jak często trafiasz, kiedy zgadujesz, i czy Twoja pewność jest uzasadniona.')
      ]),
      section(4, 'Tygodnie powtórkowe i przeplatanie', [
        p('Co kilka tygodni plan wstrzymuje nowy materiał: quiz mieszany, czysta kartka z najważniejszych tabel i dwa arkusze egzaminacyjne. Mieszanie tematów jest trudniejsze niż nauka blokami, ale tak wygląda egzamin. Najpierw trzeba rozpoznać, z którego przepisu pochodzi pytanie.')
      ]),
      section(5, 'Egzaminy próbne', [
        p('Arkusze 1–' + sheets + ' to rzeczywiste egzaminy z lat 2015–2026. Arkusze 1–' + (firstRes - 1) + ' rozwiązujesz w trakcie planu, zawsze z zegarem i punktami ujemnymi. ' +
          (reserved.length ? 'Arkusze ' + reserved.join(' i ') + ' domyślnie nie pojawiają się w quizach: to próby generalne na pytaniach niewidzianych wcześniej. ' : '') +
          'Po każdej próbie przejrzyj błędy i odpowiedzi zgadywane.')
      ]),
      section(6, 'Część ustna', [
        p('Komisja zadaje pytania i daje do oceny dokumentację. Na przygotowanie masz 20 minut i wolno korzystać z tekstów przepisów oraz norm. Liczy się szybkie odnajdywanie przepisu i jasna wypowiedź. Ćwicz odpowiedzi na głos, z zegarem, zaczynając od podstawy prawnej.')
      ]),
      section(7, 'Kryteria gotowości', [
        p('Próg to ' + pass + ' pkt, ale celuj wyżej: zapas pokrywa stres i pytania spoza arkuszy.'),
        ready
      ]),
      section(8, 'Zastrzeżenie', [
        p('Klucz odpowiedzi nie pochodzi od KG PSP. Każda odpowiedź ma oznaczoną pewność' + (confLine ? ' (liczba pytań: ' + confLine + ')' : '') + '.' +
          (noKey ? ' ' + F.plural(noKey, 'pytanie nie ma', 'pytania nie mają', 'pytań nie ma') + ' jeszcze klucza i nie trafia do quizów.' : '') +
          ' Stan prawny: ' + F.date(D.meta.legalDate) + '. W razie wątpliwości sprawdzaj w źródłach i zapisuj własną poprawkę klucza.'),
        h('div.row', ui.btn('Przepisy i normy', function () { P.planUI.openView('zrodla'); }, 'sm'), ui.btn('Plan nauki', function () { P.planUI.openView('plan'); }, 'sm ghost'))
      ])));
  }

  P.views.metoda = { title: 'Jak się uczyć', render: render };
})();
