/* Fiszki: ekran startowy (#fiszki) i sesja (#fiszki-sesja). Dla innych modułów: P.cardsUI.start(opts).
   Zasada sesji: termin powtórki zmienia pierwsza ocena fiszki danego dnia. Fiszka oceniona „Nie umiem” wraca w tej samej sesji,
   aż zostanie zaliczona; kolejne odpowiedzi tego samego dnia mogą już tylko cofnąć fiszkę, nie wydłużają odstępu. */
(function () {
  'use strict';
  const P = window.PPOZ, h = P.h, ui = P.ui, U = P.util, F = P.fmt;

  const GRADES = [
    { id: 'again', label: 'Nie umiem', cls: 'bad' },
    { id: 'hard', label: 'Trudne', cls: 'warn' },
    { id: 'good', label: 'Umiem', cls: 'ok' },
    { id: 'easy', label: 'Łatwe', cls: 'fz-easy' }
  ];
  const STEP_CAP = 120000;                      /* do czasu sesji liczą się najwyżej 2 minuty jednego kroku */
  const B = { q: '', topic: '', limit: 10 };    /* stan listy „Przeglądaj” */
  let S = null;                                 /* bieżąca sesja (także ekran podsumowania) */

  /* ---------- pomocnicze ---------- */
  const st = id => P.srs.get('f', id);
  const isNew = s => !s || !s[0];
  const cardsWord = n => F.plural(n, 'fiszka', 'fiszki', 'fiszek');
  const limits = () => { const s = P.settings(); return { cap: Math.max(1, +s.cap || 60), fresh: Math.max(1, +s.newF || 15) }; };
  const customList = () => P.store.get('notes').customF || [];
  const isCustom = c => customList().some(x => x.id === c.id);
  const gradedToday = s => !!s && s[0] > 0 && U.iso(new Date(s[2])) === U.today();
  const fold = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  const byDue = (a, b) => st(a.id)[1] - st(b.id)[1];

  /* Liczba dni do następnej powtórki po danej ocenie — te same reguły co P.srs.grade. */
  function nextDays(s, grade) {
    const INT = P.srs.intervals, box = s ? s[0] : 0;
    if (grade === 'again') return 1;
    if (grade === 'hard') return Math.max(1, Math.round(INT[Math.max(1, box)] * 0.5));
    return INT[box === 0 ? (grade === 'easy' ? 3 : 1) : Math.min(7, box + (grade === 'easy' ? 2 : 1))];
  }
  const daysText = d => d <= 1 ? 'jutro' : 'za ' + d + ' dni';

  function confChip(c) {
    if (c.conf === 'niska') return ui.chip('do sprawdzenia w źródle', 'warn');
    if (c.conf === 'własne') return ui.chip('własna fiszka');
    if (c.conf === 'wysoka') return ui.chip('pewność treści: wysoka', 'ok');
    return c.conf ? ui.chip('pewność treści: ' + c.conf) : null;
  }

  /* Usunięte własne fiszki: scalanie postępu między urządzeniami łączy listy, więc usunięta fiszka wróciłaby z drugiego urządzenia.
     Dlatego usunięcie zostawia ujemny znacznik czasu pod identyfikatorem fiszki w notes.flags (dla pytań oznacza on „bez flagi”). */
  function purgeDeleted() {
    const notes = P.store.get('notes');
    if (!notes || !notes.customF || !notes.flags) return;
    let changed = false;
    for (let i = notes.customF.length - 1; i >= 0; i--) {
      const c = notes.customF[i];
      if (c && notes.flags[c.id] < 0) { notes.customF.splice(i, 1); changed = true; }
    }
    if (changed) P.store.save('notes');
  }
  purgeDeleted();
  P.store.onChange(function (what) { if (what === 'data') purgeDeleted(); });

  function start(opts) { P.router.go('fiszki', 'sesja', opts || {}); }
  P.cardsUI = { start: start };

  /* ---------- A. ekran startowy ---------- */
  function renderStart(root) {
    P.clear(root);
    const all = P.cards.all(), lim = limits(), again = () => renderStart(root);
    const add = ui.btn('Dodaj własną fiszkę', () => cardDialog(null, again));
    root.appendChild(h('div.view-head',
      h('div.stack.tight', h('h1', 'Fiszki'), h('p', 'Odpowiadasz z pamięci i oceniasz się. Termin kolejnej powtórki zależy od oceny.')), add));
    if (!all.length) { root.appendChild(ui.empty('Nie ma jeszcze żadnych fiszek. Możesz dodać własne.')); return; }

    const sum = P.srs.summary('f', all.map(c => c.id)), today = P.today(), INT = P.srs.intervals;
    root.appendChild(h('div.card',
      h('span.label', 'Stan nauki'),
      h('div.grid.tight', ui.stat(sum.fresh, 'nowe'), ui.stat(sum.learning, 'w nauce'), ui.stat(sum.mature, 'utrwalone'), ui.stat(sum.due, 'do powtórki dziś')),
      h('p.tiny.muted', 'W nauce: odstęp do ' + INT[3] + ' dni. Utrwalone: odstęp ' + INT[4] + ' dni lub dłuższy. Razem ' + cardsWord(sum.total) + '.')));

    const low = all.filter(c => c.conf === 'niska').length;
    if (low) root.appendChild(ui.banner('warn', 'Treść do sprawdzenia w źródle',
      F.plural(low, 'fiszka nie została jeszcze porównana', 'fiszki nie zostały jeszcze porównane', 'fiszek nie zostało jeszcze porównanych') +
      ' z aktualnym brzmieniem przepisów i norm. Przy odpowiedzi zobaczysz znacznik „do sprawdzenia w źródle”.'));

    /* szybki start */
    const due = P.cards.pool({ state: 'due' }).sort(byDue), fresh = today.newF || [], hard = P.cards.pool({ state: 'hard' });
    const dueN = Math.min(due.length, lim.cap), freshN = Math.min(fresh.length, lim.fresh), hardN = Math.min(hard.length, lim.cap);
    const weekTopics = (today.topics || []).map(t => P.topicName(t, true)).join(', ');
    const topicLine = weekTopics ? 'Temat tygodnia: ' + weekTopics + '. ' : '';
    root.appendChild(h('div.card', h('h2', 'Szybki start'), h('div.fz-quick',
      startBtn('Do powtórki dziś', dueN, !dueN ? 'Na dziś nie ma fiszek do powtórki.' :
        due.length > lim.cap ? 'Czeka ' + due.length + ', sesja obejmie ' + lim.cap + ' (limit z ustawień).' : 'Fiszki, których termin powtórki już nadszedł.',
        dueN > 0, () => start({ ids: U.shuffle(due.slice(0, lim.cap)).map(c => c.id), label: 'Do powtórki dziś' })),
      startBtn('Nowe z tematu tygodnia', freshN, topicLine + (!freshN ? 'Brak nowych fiszek z tego tematu.' :
        fresh.length > lim.fresh ? 'Sesja obejmie ' + lim.fresh + ' z ' + fresh.length + '.' : ''),
        !dueN && freshN > 0, () => start({ ids: fresh.slice(0, lim.fresh).map(c => c.id), label: 'Nowe z tematu tygodnia' })),
      startBtn('Trudne', hardN, hardN ? 'Fiszki, przy których ostatnio padła ocena „Nie umiem”.' : 'Żadna fiszka nie ma teraz oceny „Nie umiem”.',
        false, () => start({ ids: U.shuffle(hard).slice(0, lim.cap).map(c => c.id), label: 'Trudne fiszki' }))),
      !dueN && !freshN && !hardN ? h('p.small.muted', 'Na razie nic nie czeka w kolejce. Wybierz temat z listy poniżej i naciśnij „Ucz się”.') : null));

    root.appendChild(topicsCard(all, lim, today.topics || []));
    root.appendChild(browseCard(all, again));
  }

  function startBtn(label, count, sub, primary, onClick) {
    return h('button.btn.fz-start' + (primary ? '.primary' : ''), { type: 'button', disabled: !count, onclick: onClick },
      h('span', label + ' ', h('span.num', '(' + count + ')')), sub ? h('small', sub) : null);
  }

  /* Tematy, które mają fiszki: nowe / do powtórki / razem. */
  function topicsCard(all, lim, week) {
    const day = U.dayNum(), groups = {}, order = [];
    all.forEach(function (c) {
      const g = groups[c.topic] || (groups[c.topic] = { code: c.topic, total: 0, fresh: 0, due: 0 }), s = st(c.id);
      g.total++; if (isNew(s)) g.fresh++; else if (P.srs.isDue(s, day)) g.due++;
    });
    P.data.topics.forEach(t => { if (groups[t.code]) order.push(groups[t.code]); });
    Object.keys(groups).forEach(k => { if (order.indexOf(groups[k]) < 0) order.push(groups[k]); });
    return h('div.card', h('h2', 'Tematy'),
      h('p.small.muted', 'Sesja tematu obejmuje fiszki do powtórki oraz nowe (najwyżej ' + lim.fresh + ' naraz). Gdy nie ma ani jednych, ani drugich, powtarzasz cały temat.'),
      h('div', order.map(function (g) {
        const name = P.topicName(g.code, true);
        return h('div.fz-topic',
          h('span.num.fz-code', g.code),
          h('div.stack.tight.grow', h('div.row', h('b', name), week.indexOf(g.code) >= 0 ? ui.chip('temat tygodnia', 'accent') : null), h('span.small.muted', 'Nowe: ' + g.fresh + ' · do powtórki: ' + g.due + ' · razem: ' + g.total)),
          h('button.btn.sm', { type: 'button', 'aria-label': 'Ucz się: ' + name, onclick: () => topicSession(g.code, lim) }, 'Ucz się'));
      })));
  }
  function topicSession(code, lim) {
    const due = P.cards.pool({ topics: [code], state: 'due' }).sort(byDue).slice(0, lim.cap);
    let list = U.shuffle(due).concat(P.cards.pool({ topics: [code], state: 'new' }).slice(0, lim.fresh));
    if (!list.length) list = U.shuffle(P.cards.pool({ topics: [code] }));
    start({ ids: list.map(c => c.id), label: P.topicName(code, true) });
  }

  /* Przeglądanie: wyszukiwarka i lista z terminem następnej powtórki; własne fiszki można poprawiać i usuwać. */
  function browseCard(all, again) {
    const custom = customList(), list = h('div'), info = h('p.small.muted', { 'aria-live': 'polite' });
    const codes = P.data.topics.filter(t => all.some(c => c.topic === t.code));
    if (B.topic && B.topic !== '@' && !codes.some(t => t.code === B.topic)) B.topic = '';
    if (B.topic === '@' && !custom.length) B.topic = '';
    const input = h('input.input', { type: 'search', value: B.q, autocomplete: 'off' });
    input.addEventListener('input', U.debounce(function () { B.q = input.value; B.limit = 10; fill(); }, 150));
    const options = [{ value: '', label: 'Wszystkie tematy' }].concat(codes.map(t => ({ value: t.code, label: t.code + ' · ' + t.short })));
    if (custom.length) options.push({ value: '@', label: 'Własne fiszki' });
    const select = ui.select(options, B.topic, function (v) { B.topic = v; B.limit = 10; fill(); });

    function fill() {
      const words = fold(B.q).split(/\s+/).filter(Boolean);
      const found = all.filter(function (c) {
        if (B.topic === '@' ? !isCustom(c) : (B.topic && c.topic !== B.topic)) return false;
        if (!words.length) return true;
        const text = fold(c.front + ' ' + c.back + ' ' + (c.ref || '') + ' ' + P.topicName(c.topic));
        return words.every(w => text.indexOf(w) >= 0);
      });
      P.clear(list);
      info.textContent = found.length ? cardsWord(found.length) : '';
      if (!found.length) { list.appendChild(ui.empty('Żadna fiszka nie pasuje do wyszukiwania.')); return; }
      found.slice(0, B.limit).forEach(c => list.appendChild(browseItem(c, again)));
      if (found.length > B.limit) list.appendChild(h('div.fz-more', ui.btn('Pokaż więcej (' + (found.length - B.limit) + ')', function () { B.limit += 30; fill(); }, 'sm')));
    }
    fill();
    return h('div.card', h('h2', 'Przeglądaj'),
      h('div.fz-filters', ui.field('Szukaj w fiszkach', input), ui.field('Temat', select)), info, list);
  }
  function browseItem(c, again) {
    const s = st(c.id), own = isCustom(c);
    return h('div.fz-item',
      h('div.stack.tight.grow',
        h('b.fz-pre', c.front), h('span.fz-pre', c.back),
        h('div.row.fz-tags', c.ref ? ui.ref(c.ref) : null, ui.chip(P.topicName(c.topic, true)), confChip(c),
          h('span.tiny.muted', isNew(s) ? 'Nowa' : 'Następna powtórka: ' + P.srs.nextText(s)))),
      own ? h('div.row',
        h('button.btn.sm.ghost', { type: 'button', 'aria-label': 'Edytuj fiszkę: ' + c.front, onclick: () => cardDialog(c, again) }, 'Edytuj'),
        h('button.btn.sm.ghost', { type: 'button', 'aria-label': 'Usuń fiszkę: ' + c.front, onclick: () => removeCard(c, again) }, 'Usuń')) : null);
  }

  /* Okno dodawania (card = null) lub poprawiania własnej fiszki. */
  function cardDialog(card, done) {
    const topics = P.data.topics, week = P.today().topics || [];
    let topic = card ? card.topic : (week[0] || (topics[0] && topics[0].code) || '');
    const front = h('textarea.input', { rows: 2, maxLength: 240 }), back = h('textarea.input', { rows: 4, maxLength: 800 });
    const ref = h('input.input', { type: 'text', maxLength: 200, autocomplete: 'off' });
    if (card) { front.value = card.front; back.value = card.back; ref.value = card.ref || ''; }
    const select = ui.select(topics.map(t => ({ value: t.code, label: t.code + ' · ' + t.short })), topic, function (v) { topic = v; });
    const err = h('p.small.fz-err', { role: 'alert' });
    ui.modal({
      title: card ? 'Edycja fiszki' : 'Własna fiszka',
      body: h('div.stack',
        ui.field('Przód (pytanie lub hasło)', front), ui.field('Tył (odpowiedź)', back), ui.field('Temat', select),
        ui.field('Podstawa', ref, 'Opcjonalnie: przepis lub norma, z której pochodzi odpowiedź.'), err),
      actions: [{ label: 'Anuluj' }, { label: card ? 'Zapisz' : 'Dodaj fiszkę', cls: 'primary', onClick: function () {
        const f = front.value.trim(), b = back.value.trim(), r = ref.value.trim();
        if (!f || !b) { err.textContent = 'Uzupełnij przód i tył fiszki.'; (f ? back : front).focus(); return false; }
        if (card) { card.front = f; card.back = b; card.topic = topic; card.ref = r; card.t = Date.now(); }
        else P.store.get('notes').customF.push({ id: 'cf' + U.uid(), front: f, back: b, topic: topic, ref: r, conf: 'własne', t: Date.now() });
        P.store.save('notes');
        ui.toast(card ? 'Zapisano zmiany.' : 'Dodano fiszkę.');
        done();
      } }]
    });
  }
  function removeCard(card, done) {
    ui.confirm('Usunąć fiszkę?', '„' + card.front + '” zostanie trwale usunięta.', 'Usuń', true).then(function (yes) {
      if (!yes) return;
      const notes = P.store.get('notes'), i = notes.customF.findIndex(x => x.id === card.id);
      if (i >= 0) notes.customF.splice(i, 1);
      notes.flags[card.id] = -Date.now();
      P.store.save('notes');
      ui.toast('Usunięto fiszkę.');
      done();
    });
  }

  /* ---------- B. sesja ---------- */
  function resolve(opts) {
    const all = P.cards.all(), n = +opts.n > 0 ? Math.floor(+opts.n) : 0;
    let list;
    if (Array.isArray(opts.ids)) {
      const by = {}, seen = {};
      all.forEach(c => { by[c.id] = c; });
      list = opts.ids.map(id => by[id]).filter(c => c && !seen[c.id] && (seen[c.id] = true));
    } else {
      const f = opts.filter || {}, state = f.state && f.state !== 'all' ? f.state : undefined;
      list = P.cards.pool({ topics: f.topics, state: state });
      if (state === 'due') { list.sort(byDue); if (n) list = list.slice(0, n); }
      if (state !== 'new') list = U.shuffle(list);
    }
    return n ? list.slice(0, n) : list;
  }
  function defaultLabel(opts) {
    const state = opts.filter && opts.filter.state;
    return state === 'due' ? 'Do powtórki dziś' : state === 'new' ? 'Nowe fiszki' : state === 'hard' ? 'Trudne fiszki' : 'Fiszki';
  }
  const goBack = opts => P.router.go((opts && opts.returnTo) || 'fiszki');

  function startSession(root, opts) {
    const cards = resolve(opts), label = opts.label || defaultLabel(opts);
    if (!cards.length) {
      root.appendChild(h('div.view-head', h('h1', label)));
      root.appendChild(ui.empty('Żadna fiszka nie spełnia warunków tej sesji.', ui.btn('Wróć', () => goBack(opts), 'primary')));
      return;
    }
    const byId = {};
    cards.forEach(c => { byId[c.id] = c; });
    S = { root: root, opts: opts, label: label, queue: cards.slice(), byId: byId, total: cards.length, passed: 0,
      first: {}, order: [], revealed: false, done: false, complete: false, activeMs: 0, stepAt: Date.now(), min: 0 };
    document.addEventListener('keydown', onKey);
    draw();
  }
  function tick() { const now = Date.now(); S.activeMs += Math.min(now - S.stepAt, STEP_CAP); S.stepAt = now; }

  function draw() {
    const root = P.clear(S.root), card = S.queue[0], s = st(card.id), drill = gradedToday(s);
    const returning = S.queue.filter(c => S.first[c.id] !== undefined).length;
    root.appendChild(h('div.view-head',
      h('div.stack.tight', h('span.label', 'Sesja fiszek'), h('h1', S.label)), ui.btn('Zakończ sesję', endEarly, 'sm')));
    const bar = ui.bar(S.passed / S.total);
    bar.setAttribute('aria-label', 'Postęp sesji');
    root.appendChild(h('div.stack.tight',
      h('div.row.between.small', h('span', 'Zaliczono ', h('b.num', S.passed + ' z ' + S.total)),
        returning ? h('span.muted', 'Wraca w tej sesji: ', h('span.num', returning)) : null), bar));

    const tag = h('span.label', P.topicName(card.topic, true) + (isNew(s) ? ' · nowa' : S.first[card.id] !== undefined ? ' · ponownie' : ''));
    let flash, actions;
    if (!S.revealed) {
      flash = h('button.card.flash.fz-flash', { type: 'button', onclick: reveal },
        tag, h('span.front', card.front), h('span.small.muted', 'Przypomnij sobie odpowiedź, potem ją odsłoń.'));
      actions = h('div.fz-actions', ui.btn('Pokaż odpowiedź', reveal, 'primary block'));
    } else {
      const marks = [card.ref ? ui.ref(card.ref) : null, confChip(card)].filter(Boolean);
      flash = h('div.card.flash.fz-flash.fz-open', { tabIndex: -1 },
        tag, h('p.front', card.front), h('hr.fz-rule'), h('p.back', card.back), marks.length ? h('div.row.fz-center', marks) : null);
      const buttons = drill
        ? [gradeBtn(GRADES[0], 1, 'w tej sesji i jutro'), gradeBtn(GRADES[2], 3, 'termin bez zmian: ' + P.srs.nextText(s))]
        : GRADES.map((g, i) => gradeBtn(g, i + 1, g.id === 'again' ? 'w tej sesji i jutro' : daysText(nextDays(s, g.id))));
      actions = h('div.fz-actions',
        h('div.fz-grades' + (drill ? '.fz-two' : ''), { role: 'group', 'aria-label': 'Ocena i termin następnej powtórki' }, buttons),
        drill ? h('p.tiny.muted', 'Ta fiszka była już dziś oceniona, więc kolejna odpowiedź nie wydłuża odstępu do następnej powtórki.') : null);
    }
    root.appendChild(flash);
    root.appendChild(actions);
    root.appendChild(h('p.tiny.muted.fz-keys', 'Klawiatura: spacja odsłania odpowiedź, klawisze 1–4 wystawiają ocenę.'));
    flash.focus({ preventScroll: true });
  }
  function gradeBtn(g, key, sub) {
    return h('button.btn.fz-grade.' + g.cls, { type: 'button', onclick: () => grade(g.id) },
      h('span', g.label), h('small', sub), h('kbd', { 'aria-hidden': 'true' }, key));
  }

  function reveal() {
    if (!S || S.done || S.revealed) return;
    tick(); S.revealed = true; draw();
  }
  function grade(g) {
    if (!S || S.done || !S.revealed) return;
    const card = S.queue[0], s = st(card.id);
    tick();
    if (gradedToday(s)) {
      /* Kolejna odpowiedź tego samego dnia: zaliczenie nie zmienia terminu, błąd cofa fiszkę (o ile nie jest już cofnięta). */
      if (g !== 'again') g = 'good';
      else if (!(s[0] === 1 && s[1] === U.dayNum() + 1)) P.cards.grade(card, 'again');
    } else P.cards.grade(card, g);
    if (S.first[card.id] === undefined) { S.first[card.id] = g; S.order.push(card.id); }
    S.queue.shift();
    if (g === 'again') S.queue.splice(Math.min(S.queue.length, 3), 0, card);
    else S.passed++;
    S.revealed = false;
    if (S.queue.length) draw(); else finish(true);
  }
  function endEarly() {
    if (!S || S.done) return;
    if (!S.order.length) { goBack(S.opts); return; }
    finish(false);
  }

  function tally() {
    let bad = 0, hard = 0;
    const topics = [];
    S.order.forEach(function (id) {
      const g = S.first[id], t = S.byId[id].topic;
      if (g === 'again') bad++; else if (g === 'hard') hard++;
      if (t && topics.indexOf(t) < 0) topics.push(t);
    });
    return { n: S.order.length, bad: bad, hard: hard, good: S.order.length - bad - hard, topics: topics };
  }
  function logSession(res) {
    S.min = Math.max(1, Math.round(S.activeMs / 60000));
    P.log.session({ type: 'fiszki', label: S.label, n: res.n, ok: res.n - res.bad, bad: res.bad, min: S.min, topics: res.topics });
  }
  function finish(complete) {
    tick(); S.done = true; S.complete = complete;
    document.removeEventListener('keydown', onKey);
    const res = tally();
    if (res.n) logSession(res);
    if (complete && S.opts.taskId) P.plan.setTask(S.opts.taskId, true);
    if (P.router && P.router.updateNav) P.router.updateNav();
    drawSummary(res);
  }

  function drawSummary(res) {
    const root = P.clear(S.root), opts = S.opts, day = U.dayNum();
    const weak = S.order.filter(id => S.first[id] === 'again' || S.first[id] === 'hard');
    const tomorrow = S.order.filter(id => { const s = st(id); return !!s && s[1] - day === 1; }).length;
    root.appendChild(h('div.view-head', h('div.stack.tight', h('span.label', S.label), h('h1', S.complete ? 'Sesja zakończona' : 'Sesja przerwana'))));
    const notes = [];
    if (!S.complete) notes.push('Oceniono ' + F.plural(res.n, 'fiszkę', 'fiszki', 'fiszek') + ' z ' + S.total + '. Pozostałe zachowują dotychczasowe terminy.');
    if (tomorrow) notes.push(F.plural(tomorrow, 'fiszka wróci', 'fiszki wrócą', 'fiszek wróci') + ' do powtórki jutro.');
    if (opts.taskId) notes.push(S.complete ? 'Zadanie w planie zostało oznaczone jako wykonane.' : 'Zadanie w planie pozostaje otwarte, bo sesja nie została dokończona.');
    const finishBtn = ui.btn('Zakończ', () => goBack(opts), 'primary');
    root.appendChild(h('div.card',
      h('div.grid.tight', ui.stat(res.good, 'umiem'), ui.stat(res.hard, 'trudne'), ui.stat(res.bad, 'nie umiem'), ui.stat(F.mins(S.min), 'czas')),
      notes.length ? h('p.small.muted', notes.join(' ')) : null,
      weak.length ? h('details.fold', h('summary', 'Fiszki do utrwalenia (' + weak.length + ')'), h('div', weak.map(function (id) {
        const c = S.byId[id], again = S.first[id] === 'again';
        return h('div.fz-item', h('div.stack.tight.grow', h('b.fz-pre', c.front), h('span.fz-pre', c.back)), ui.chip(again ? 'nie umiem' : 'trudne', again ? 'bad' : 'warn'));
      }))) : null,
      h('div.row',
        weak.length ? ui.btn('Jeszcze raz trudne (' + weak.length + ')', function () {
          start({ ids: weak, label: /\(trudne\)$/.test(S.label) ? S.label : S.label + ' (trudne)', returnTo: opts.returnTo });
        }) : null, finishBtn)));
    finishBtn.focus({ preventScroll: true });
  }

  /* Spacja odsłania odpowiedź, 1–4 wystawiają ocenę. */
  function onKey(e) {
    if (!S || S.done || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.querySelector('.modal-back')) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    const control = !!(t && t.closest && t.closest('button, a, summary')) && !(t.classList && t.classList.contains('fz-flash'));
    if (e.key === ' ' || e.code === 'Space') {
      if (control) return;                 /* spacja na przycisku działa po swojemu */
      e.preventDefault();
      if (!S.revealed) reveal();
    } else if (S.revealed && /^[1-4]$/.test(e.key)) {
      e.preventDefault();
      grade(GRADES[+e.key - 1].id);      /* przy dwóch przyciskach klawisze 2–4 znaczą „Umiem” */
    }
  }

  P.views.fiszki = {
    title: 'Fiszki',
    render: function (root, param, payload) {
      if (param === 'sesja' && payload) { startSession(root, payload); return; }
      /* Sesja nie przetrwa odświeżenia strony: bez danych sesji pokazujemy ekran startowy i porządkujemy adres. */
      if (param === 'sesja') { try { history.replaceState(null, '', '#fiszki'); } catch (e) { /* adres zostaje bez zmian */ } }
      renderStart(root);
    },
    /* Przerwana sesja zapisuje w dzienniku to, co zostało ocenione; zadanie planu pozostaje otwarte. */
    leave: function () {
      document.removeEventListener('keydown', onKey);
      if (S && !S.done) { tick(); const res = tally(); if (res.n) logSession(res); }
      S = null;
    },
    busy: function () { return !!S; }
  };
})();
