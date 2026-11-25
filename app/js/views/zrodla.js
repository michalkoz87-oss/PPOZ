/* Widok „Przepisy i normy”: rejestr aktów prawnych (statusy z API Sejmu) i norm (stan z wyszukiwarki PKN)
   z oznaczaniem lektury. Adres #zrodla otwiera przepisy, #zrodla-normy — normy. */
(function () {
  'use strict';
  var P = window.PPOZ, h = P.h, ui = P.ui, F = P.fmt;
  var PKN_URL = 'https://wiedza.pkn.pl/web/guest/wyszukiwarka-norm';
  var LANGS = { pol: 'polska', ang: 'angielska', fra: 'francuska', nie: 'niemiecka' };
  /* Stan trzymany między wyświetleniami: filtry norm, fokus po zmianie zakładki, powrót z sesji pytań. */
  var st = { q: '', onlyQ: true, onlyStale: false, focusTab: false, resume: '' };
  var searchEl = null, hay = {};

  /* ---------- pomocnicze ---------- */
  function https(u) { return typeof u === 'string' && /^https:\/\/\S+$/.test(u) ? u : ''; }
  function dzu(s) { return String(s || '').replace(/DU\/(\d{4})\/(\d+)/g, 'Dz.U. $1 poz. $2'); }
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l'); }
  function cleanTitle(s) { return String(s || '').replace(/\s+--\s+/g, ' – '); }
  function qWord(n) { return F.plural(n, 'pytanie', 'pytania', 'pytań'); }
  function ext(label, url, about) {
    return h('a.btn.sm.zr-ext', { href: url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': label + ': ' + about + ' (otwiera się w nowej karcie)' }, P.icon('link'), label);
  }
  function tally(ids) {
    var r = 0, p = 0;
    ids.forEach(function (id) { var s = P.plan.readState(id); if (s.r) r++; if (s.p) p++; });
    return { r: r, p: p };
  }
  /* Tygodnie kalendarzowe planu (dla wybranego wariantu), w których czyta się dany akt lub normę. */
  function planIndex() {
    var cal = {}, acts = {}, norms = {}, order = {}, k = 0;
    function add(m, key, c) { if (!key) return; var a = m[key] || (m[key] = []); if (a.indexOf(c) < 0) a.push(c); }
    P.plan.calWeeks().forEach(function (cw) { cw.weeks.forEach(function (w) { if (w) cal[w.n] = cw.i + 1; }); });
    ((P.data.plan && P.data.plan.weeks) || []).forEach(function (w) {
      var c = cal[w.n]; if (!c) return;
      (w.readings || []).forEach(function (r) { add(acts, r.src, c); if (r.src && !(r.src in order)) order[r.src] = k++; });
      (w.norms || []).forEach(function (b) { add(norms, b, c); });
    });
    [acts, norms].forEach(function (m) { Object.keys(m).forEach(function (key) { m[key].sort(function (a, b) { return a - b; }); }); });
    return { acts: acts, norms: norms, order: order };
  }
  function weekLink(weeks) {
    if (!weeks || !weeks.length) return null;
    return h('a.chip.accent.zr-chip.zr-week', { href: '#plan', onclick: function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault(); P.router.go('plan');
    } }, 'Plan: ' + (weeks.length === 1 ? 'tydzień ' : 'tygodnie ') + weeks.join(', '));
  }
  function readChecks(id, name, onChange) {
    var s = P.plan.readState(id);
    function one(label, kind, on) {
      var c = ui.check(label, on, function (v) { P.plan.setRead(id, kind, v); if (onChange) onChange(); });
      c.querySelector('input').setAttribute('aria-label', label + ': ' + name);
      return c;
    }
    return h('div.zr-checks', one('Przeczytane', 'r', s.r), one('Powtórzone', 'p', s.p));
  }

  /* ---------- przepisy ---------- */
  function actItem(a, weeks, byEli, onRead) {
    var pdf = https(a.url), page = https(a.page), fine = [];
    var status = a.inForce ? ui.chip('obowiązuje', 'ok') : h('span.chip.bad.zr-chip', 'nie obowiązuje' + (a.repealDate ? ' od ' + F.date(a.repealDate) : ''));
    if (a.composition) fine.push('Skład tekstu: ' + dzu(a.composition) + '.');
    if (pdf && /\+\s*zmiany/.test(a.composition || '')) fine.push('Plik PDF zawiera tekst bazowy bez wymienionych zmian; zmiany są ogłoszone osobno.');
    if (a.status) fine.push('Status w bazie ELI: ' + a.status + '.');
    if (!a.inForce && a.repealedBy && a.repealedBy.length) fine.push('Utrata mocy na podstawie: ' + a.repealedBy.map(function (e) {
      var by = byEli[e]; return (by ? by.short + ' (' + dzu(e) + ')' : dzu(e));
    }).join('; ') + '.');
    return h('article.zr-item',
      h('div.zr-main',
        h('h3.zr-name', a.short || a.title || a.id),
        a.title && a.title !== a.short ? h('p.zr-full', a.title) : null,
        h('div.row', a.dz ? ui.ref(a.dz) : null, status, weekLink(weeks)),
        a.note ? h('p.zr-note', a.note) : null,
        fine.length ? h('div.zr-fine.tiny.muted', fine.map(function (t) { return h('p', t); })) : null,
        pdf || page ? h('div.row', pdf ? ext('Tekst (PDF)', pdf, a.short) : null, page ? ext('Strona aktu', page, a.short) : null) : null),
      h('div.zr-side', readChecks(a.id, a.short, onRead)));
  }
  function actGroup(name, caption, acts, idx, byEli) {
    var ids = acts.map(function (a) { return a.id; }), sum = h('p.small.muted.zr-sum'), list = h('div.card.zr-list');
    function upd() { var t = tally(ids); sum.textContent = F.plural(ids.length, 'akt', 'akty', 'aktów') + ', przeczytane ' + t.r + ', powtórzone ' + t.p; }
    upd();
    acts.forEach(function (a) { list.appendChild(actItem(a, idx.acts[a.id], byEli, upd)); });
    return h('section.stack', h('div.zr-ghead', h('div.stack.tight', h('h2', name), h('p.small.muted', caption)), sum), list);
  }
  function renderActs(box) {
    var legal = P.data.legal || [], meta = P.data.meta || {}, idx = planIndex(), byEli = {};
    legal.forEach(function (a) { if (a.eli) byEli[a.eli] = a; });
    function sorted(list) {
      return list.slice().sort(function (a, b) {
        var oa = a.id in idx.order ? idx.order[a.id] : 1e6, ob = b.id in idx.order ? idx.order[b.id] : 1e6;
        if (oa !== ob) return oa - ob;
        if (a.repealDate !== b.repealDate) return String(b.repealDate || '').localeCompare(String(a.repealDate || ''));
        return String(a.short).localeCompare(String(b.short), 'pl');
      });
    }
    box.appendChild(ui.banner('', meta.legalDate ? 'Stan prawny na ' + F.date(meta.legalDate) : 'Stan prawny: data nieznana',
      'Źródło: API Sejmu (ELI). Po tej dacie przepisy mogły się zmienić — przed egzaminem sprawdź status na stronie aktu.'));
    var wt = P.data.actById && P.data.actById.wt_2002;
    if (wt && wt.note) box.appendChild(ui.banner('warn', 'Warunki techniczne z 2002 r. (WT)' + (!wt.inForce && wt.repealDate ? ' nie obowiązują od ' + F.date(wt.repealDate) : ''), wt.note));
    if (!legal.length) { box.appendChild(ui.empty('Rejestr aktów jest pusty.')); return; }
    var on = sorted(legal.filter(function (a) { return a.inForce; })), off = sorted(legal.filter(function (a) { return !a.inForce; }));
    if (on.length) box.appendChild(actGroup('Obowiązujące', 'Kolejność według planu czytania; akty spoza planu są na końcu.', on, idx, byEli));
    if (off.length) box.appendChild(actGroup('Uchylone lub wygasłe (cytowane w starszych pytaniach)', 'Starsze arkusze powołują się na te akty. Ich treść może różnić się od przepisów, które je zastąpiły.', off, idx, byEli));
  }

  /* ---------- normy ---------- */
  function startQuestions(n, ids) {
    var opts = { mode: 'nauka', ids: ids, label: n.base, returnTo: 'zrodla' };
    if (P.practice && typeof P.practice.start === 'function') { st.resume = n.base; P.practice.start(opts); }
    else if (P.views.pytania) { st.resume = n.base; P.router.go('pytania', 'sesja', opts); }
    else ui.toast('Moduł pytań nie jest jeszcze dostępny.');
  }
  function edition(text, extra, stale) { return h('span.zr-ed' + (stale ? '.zr-stale' : ''), h('b', text), extra ? ' ' + extra : null); }
  function normItem(n, weeks, onRead) {
    var cur = n.current || [], old = n.withdrawn || [], succ = n.successor || [], adds = n.additions || [], qids = n.qids || [], cited = n.cited || {}, stale = n.staleCited || [];
    var missing = !cur.length && !old.length;
    var addNow = adds.filter(function (a) { return a.status === 'aktualna'; }), addOld = adds.filter(function (a) { return a.status !== 'aktualna'; });
    var facts = h('dl.zr-facts'), side = h('div.zr-side'), btn = null;
    function fact(label, nodes) { facts.appendChild(h('dt.label', label)); facts.appendChild(h('dd', nodes)); }

    /* aktualne wydanie */
    if (cur.length) fact('Aktualne wydanie', cur.map(function (e) {
      var l = (e.langs || []).map(function (x) { return LANGS[x] || x; });
      return [ui.ref(e.num), l.length ? h('span.small.muted', (l.length === 1 ? 'wersja ' : 'wersje: ') + l.join(', ')) : null];
    }));
    else if (missing) fact('Aktualne wydanie', [ui.chip('brak w wyszukiwarce PKN', 'bad'), h('span.small.muted', 'Numeru w tej postaci nie ma w wyszukiwarce; pytanie mogło podać go niedokładnie.')]);
    else fact('Aktualne wydanie', [h('span.chip.bad.zr-chip', 'wycofana bez wydania aktualnego')]);
    if (succ.length) fact('Następca', succ.map(function (s) { return ui.ref(s); }));

    /* wydania cytowane w pytaniach */
    if (qids.length) {
      var eds = Object.keys(cited).sort(function (a, b) { return cited[b] - cited[a]; }), named = eds.filter(function (e) { return e !== '—'; });
      var verdict = stale.length ? h('span.chip.warn.zr-chip', (missing ? 'wydania nie potwierdzono w PKN: ' : 'pytania cytują wycofane: ') + stale.join(', '))
        : !named.length ? h('span.chip.zr-chip', 'pytania nie wskazują wydania') : h('span.chip.ok.zr-chip', 'zgodne z aktualnym wydaniem');
      var avail = [], res = 0, nokey = 0;
      qids.forEach(function (id) { var q = P.q.byId(id); if (!q) nokey++; else if (P.q.isReserved(q)) res++; else if (!P.q.key(q)) nokey++; else avail.push(id); });
      var skipped = [];
      if (res) skipped.push(qWord(res) + ' z arkuszy odłożonych na próby generalne');
      if (nokey) skipped.push(qWord(nokey) + ' bez klucza odpowiedzi');
      fact('W pytaniach', [h('span.small', qWord(qids.length) + (eds.length ? ', wydania:' : ''))].concat(
        eds.map(function (e) { return edition(e === '—' ? 'bez wydania' : e, cited[e] + '×', stale.indexOf(e) >= 0); }), [verdict],
        skipped.length ? [h('span.tiny.muted.zr-wide', 'Przycisk „Pytania” pomija: ' + skipped.join(' oraz ') + '.')] : []));
      if (avail.length) { btn = ui.btn('Pytania (' + avail.length + ')', function () { startQuestions(n, avail); }, 'sm'); btn.setAttribute('aria-label', 'Pytania (' + avail.length + '): ' + n.base); side.appendChild(btn); }
    } else fact('W pytaniach', [h('span.small.muted', 'Nie występuje w pytaniach.')]);

    if (addNow.length) fact('Zmiany i poprawki', addNow.map(function (a) { return edition(a.num, 'aktualna'); }));
    side.appendChild(readChecks(n.base, n.base, onRead));

    var el = h('article.zr-item',
      h('div.zr-main',
        h('div.row', h('h3.zr-base', n.base), n.topic ? ui.chip(P.topicName(n.topic, true)) : null, weekLink(weeks)),
        n.title ? h('p.zr-ntitle', cleanTitle(n.title)) : h('p.small.muted', 'Brak tytułu w rejestrze.'),
        facts,
        n.note ? h('p.zr-note', n.note) : null,
        old.length || addOld.length ? h('details.zr-fold',
          h('summary', 'Wydania i zmiany wycofane (' + (old.length + addOld.length) + ')'),
          h('div.stack.tight.tiny.muted',
            old.length ? h('p', 'Wydania wycofane: ', h('span.num', old.join(', ')), '.') : null,
            addOld.length ? h('p', 'Zmiany i poprawki wycofane: ', h('span.num', addOld.map(function (a) { return a.num; }).join(', ')), '.') : null)) : null),
      side);
    return { el: el, btn: btn };
  }
  function matches(n, tokens) {
    if (!tokens.length) return true;
    var s = hay[n.base] || (hay[n.base] = fold([n.base, n.title, (n.current || []).map(function (e) { return e.num; }).join(' '), (n.successor || []).join(' '), (n.withdrawn || []).join(' ')].join(' ')));
    return tokens.every(function (t) { return s.indexOf(t) >= 0; });
  }
  function renderNorms(box) {
    var reg = P.data.norms || {}, all = (reg.norms || []).slice().sort(function (a, b) {
      return (b.qids || []).length - (a.qids || []).length || String(a.base).localeCompare(String(b.base), 'pl', { numeric: true });
    });
    var idx = planIndex(), listBox = h('div.stack'), count = h('p.small.muted.zr-sum', { role: 'status' }), shown = [];
    function summary() {
      var t = tally(shown.map(function (n) { return n.base; }));
      count.textContent = F.plural(shown.length, 'norma', 'normy', 'norm') + ' z ' + all.length + ' w rejestrze, przeczytane ' + t.r + ', powtórzone ' + t.p;
    }
    function draw() {
      var tokens = fold(st.q).split(/\s+/).filter(Boolean), byQuery = all.filter(function (n) { return matches(n, tokens); }), focusBtn = null, target = null;
      var resume = st.resume; st.resume = '';
      shown = byQuery.filter(function (n) { return (!st.onlyQ || (n.qids || []).length > 0) && (!st.onlyStale || (n.staleCited || []).length > 0); });
      P.clear(listBox); summary();
      if (!shown.length) {
        var wider = byQuery.length && (st.onlyQ || st.onlyStale);
        listBox.appendChild(ui.empty(wider ? 'Żadna norma nie spełnia zaznaczonych warunków. Bez tych ograniczeń do wyszukiwania pasuje: ' + F.plural(byQuery.length, 'norma', 'normy', 'norm') + '.' : 'Żadna norma nie pasuje do wyszukiwania.',
          wider ? ui.btn('Pokaż wszystkie pasujące', function () { st.onlyQ = false; st.onlyStale = false; cQ.checked = false; cS.checked = false; draw(); })
            : ui.btn('Wyczyść wyszukiwanie', function () { st.q = ''; searchEl.value = ''; draw(); searchEl.focus(); })));
        return;
      }
      var card = h('div.card.zr-list');
      shown.forEach(function (n) {
        var it = normItem(n, idx.norms[n.base], summary);
        if (resume && resume === n.base) { target = it.el; focusBtn = it.btn; }
        card.appendChild(it.el);
      });
      listBox.appendChild(card);
      if (target) { target.scrollIntoView({ block: 'center' }); if (focusBtn) focusBtn.focus({ preventScroll: true }); }
    }
    var later = P.util.debounce(draw, 140);
    searchEl = h('input.input', { type: 'search', value: st.q, autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', placeholder: 'np. 12845 albo tryskaczowe',
      oninput: function () { st.q = searchEl.value; later(); } });
    var checkQ = ui.check('Tylko występujące w pytaniach', st.onlyQ, function (v) { st.onlyQ = v; draw(); });
    var checkS = ui.check('Tylko z wycofanym wydaniem w pytaniach', st.onlyStale, function (v) { st.onlyStale = v; draw(); });
    var cQ = checkQ.querySelector('input'), cS = checkS.querySelector('input');

    box.appendChild(h('div.banner', h('div.stack.tight',
      h('b', 'Źródło: wyszukiwarka norm PKN' + (reg.checked ? ', sprawdzono ' + F.date(reg.checked) : '')),
      h('span', 'Aplikacja opiera się na aktualnych wydaniach norm. Starsze pytania cytują wydania wycofane, więc podane w nich wartości mogły się zmienić. Tekstów norm aplikacja nie zawiera; można je czytać w czytelniach PKN.'),
      h('span', h('a', { href: PKN_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Otwórz wyszukiwarkę norm PKN'), ' (nowa karta).'))));
    box.appendChild(h('div.card.zr-filters',
      ui.field('Szukaj normy', searchEl, 'Numer lub fragment tytułu.'),
      h('div.zr-toggles', checkQ, checkS)));
    box.appendChild(h('section.stack',
      h('div.zr-ghead', h('div.stack.tight', h('h2', 'Rejestr norm'), h('p.small.muted', 'Kolejność: od norm najczęściej występujących w pytaniach.')), count),
      listBox));
    draw();
  }

  /* ---------- widok ---------- */
  function render(root, param) {
    var tab = param === 'normy' || st.resume ? 'normy' : 'przepisy';
    searchEl = null;
    var seg = ui.seg([{ value: 'przepisy', label: 'Przepisy' }, { value: 'normy', label: 'Normy' }], tab, function (v) {
      st.focusTab = true; st.resume = ''; P.router.go('zrodla', v === 'normy' ? 'normy' : '');
    });
    seg.setAttribute('aria-label', 'Rodzaj źródeł');
    root.appendChild(h('div.view-head',
      h('div.stack.tight', h('h1', 'Przepisy i normy'), h('p', 'Rejestr aktów i norm, na których opierają się pytania. Zaznaczaj, co zostało przeczytane i powtórzone.')), seg));
    var box = h('div.stack.zr-body');
    root.appendChild(box);
    if (tab === 'normy') renderNorms(box); else renderActs(box);
    if (st.focusTab) { st.focusTab = false; var b = seg.querySelector('button[aria-pressed="true"]'); if (b) b.focus({ preventScroll: true }); }
  }

  P.views.zrodla = {
    title: 'Przepisy i normy',
    render: render,
    leave: function () { searchEl = null; },
    /* W trakcie pisania w wyszukiwarce widok nie jest przerysowywany po synchronizacji postępu. */
    busy: function () { return !!searchEl && document.activeElement === searchEl; }
  };
})();
