/* Nauka: lista lekcji (#nauka) oraz lekcja (#lekcja-<id>) — co przeczytać, normy, ściąga, pytania z egzaminów, pytania otwarte.
   Postęp: plan.reads[id aktu | numer bazowy normy] = {r, p, t} (P.plan.setRead),
           plan.lessons[id] = {read: znacznik czasu | 0, oral: {klucz pytania: 1 słabo | 2 średnio | 3 dobrze}, t}. */
(function () {
  'use strict';
  var P = window.PPOZ, h = P.h, ui = P.ui, U = P.util, F = P.fmt, D = P.data;
  var LANG = { pol: 'polski', ang: 'angielski', fra: 'francuski', nie: 'niemiecki' };
  var GRADES = [{ value: 1, label: 'Słabo' }, { value: 2, label: 'Średnio' }, { value: 3, label: 'Dobrze' }];
  var FIRST = 15, MORE = 30;
  var live = { active: false, touched: false, lastId: '', spy: null };

  /* ---------- wspólne ---------- */
  function qWord(n) { return F.plural(n, 'pytanie', 'pytania', 'pytań'); }
  function fWord(n) { return F.plural(n, 'fiszka', 'fiszki', 'fiszek'); }
  function noun(n, one, few, many) { return F.plural(n, one, few, many).slice(String(n).length + 1); }
  function dmy(iso) { return F.dm(iso) + '.' + U.parse(iso).getFullYear(); }
  function uniq(arr) { return arr.filter(function (x, i) { return arr.indexOf(x) === i; }); }
  function sortedLessons() { return (D.lessons || []).slice().sort(function (a, b) { return a.week - b.week; }); }
  function calWeekOf(lesson, cws) {
    for (var i = 0; i < cws.length; i++) if (cws[i].weeks.some(function (w) { return w && w.n === lesson.week; })) return cws[i];
    return null;
  }
  function weekNo(lesson, cws) { var cw = calWeekOf(lesson, cws); return cw ? cw.i + 1 : lesson.week; }
  function nav(name, param, payload) {
    return function (e) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return; e.preventDefault(); P.router.go(name, param, payload); };
  }
  function lessonRec(id) {
    var l = P.store.get('plan').lessons[id];
    if (typeof l === 'number') return { read: l > 0 ? l : 0, oral: {} };
    return l && typeof l === 'object' ? l : null;
  }
  function isDone(id) { var l = lessonRec(id); return !!(l && l.read > 0); }
  function lessonDoc(id) {
    var m = P.store.get('plan').lessons, l = m[id];
    if (!l || typeof l !== 'object') l = m[id] = { read: typeof l === 'number' && l > 0 ? l : 0, oral: {}, t: 0 };
    if (!l.oral || typeof l.oral !== 'object') l.oral = {};
    return l;
  }
  function saveLesson(l) { l.t = Date.now(); P.store.save('plan'); }
  function readIds(lesson) { return uniq((lesson.readings || []).map(function (r) { return r.src; }).concat(lesson.norms || [])); }
  function readCount(ids) { return ids.filter(function (id) { return P.plan.readState(id).r; }).length; }
  function topicCounts() {
    var q = {}, f = {};
    P.q.pool({}).forEach(function (x) { q[x.topic] = (q[x.topic] || 0) + 1; });
    P.cards.pool({}).forEach(function (x) { f[x.topic] = (f[x.topic] || 0) + 1; });
    return { q: q, f: f };
  }
  /* Pusta lista tematów w P.q.pool oznacza brak filtra, więc lekcja bez tematów dostaje pustą pulę. */
  function poolQ(topics, reserved) { return topics && topics.length ? P.q.pool({ topics: topics, reserved: !!reserved }) : []; }
  function poolF(topics) { return topics && topics.length ? P.cards.pool({ topics: topics }) : []; }
  function countIn(map, topics) { return U.sum(topics || [], function (t) { return map[t] || 0; }); }
  function topicChips(lesson) { return (lesson.topics || []).map(function (t) { return h('span.chip', { title: P.topicName(t) }, P.topicName(t, true)); }); }
  function doneChip() { return h('span.chip.ok', P.icon('ok'), 'przerobiona'); }

  /* ---------- #nauka: lista lekcji ---------- */
  function lessonItem(l, cws, counts, curTag) {
    var cw = calWeekOf(l, cws), done = isDone(l.id), ids = readIds(l);
    var meta = [qWord(countIn(counts.q, l.topics)), fWord(countIn(counts.f, l.topics))];
    if (ids.length) meta.push('przeczytane ' + readCount(ids) + ' z ' + ids.length);
    return h('a.nauka-item' + (curTag ? '.is-current' : '') + (done ? '.is-done' : ''), { href: '#lekcja-' + l.id, onclick: nav('lekcja', l.id), 'aria-current': curTag ? 'true' : null },
      h('div.nauka-week', h('span.label', 'Tydzień'), h('span.nauka-n.num', cw ? cw.i + 1 : l.week), cw ? h('span.tiny.muted.num', F.range(cw.start, cw.end)) : null),
      h('div.stack.tight',
        h('div.nauka-top', h('h3', l.title), h('span.row', curTag ? ui.chip(curTag, 'accent') : null, done ? doneChip() : null)),
        l.focus ? h('p.small.muted', l.focus) : null,
        h('div.row.nauka-chips', topicChips(l)),
        h('p.small.muted', meta.join(' · '))));
  }

  P.views.nauka = {
    title: 'Nauka',
    render: function (root) {
      var all = sortedLessons(), cws = P.plan.calWeeks(), phase = P.plan.phase(), cur = P.plan.current(), counts = topicCounts();
      var doneN = all.filter(function (l) { return isDone(l.id); }).length, curIds = {};
      if (phase !== 'po' && cur) cur.weeks.forEach(function (w) { if (w && w.lesson) curIds[w.lesson] = 1; });
      var curTag = phase === 'przed' ? 'pierwsza lekcja' : 'bieżący tydzień';
      var curLessons = all.filter(function (l) { return curIds[l.id]; });
      var wrap = h('div.nauka');

      wrap.appendChild(h('header.view-head', h('h1', 'Nauka')));
      wrap.appendChild(h('div.prose', h('p', 'Każda lekcja odpowiada jednemu tygodniowi planu. Zacznij od listy „Co przeczytać” i czytaj z otwartym tekstem aktu, a wartości liczbowe wypisuj do własnej tabeli. Potem porównaj ją ze ściągą, przejrzyj pytania, które padały na egzaminie, i zrób quiz oraz fiszki z tematu. Pytania otwarte ćwicz na głos — przygotowują do części ustnej.')));

      var now = h('div.card');
      now.appendChild(h('div.stack.tight', h('div.row.between', h('span.label', 'Lekcje przerobione'), h('span.num.small', doneN + ' / ' + all.length)), ui.bar(all.length ? doneN / all.length : 0, 'ok')));
      if (phase === 'przed') now.appendChild(h('p.small.muted', 'Plan zaczyna się ' + F.date(P.plan.start()) + '. Lekcje możesz czytać już teraz.'));
      else if (phase === 'po') now.appendChild(h('p.small.muted', 'Plan jest zakończony. Lekcje pozostają dostępne do powtórek.'));
      else if (!curLessons.length) now.appendChild(h('p.small.muted', 'W tym tygodniu nie ma nowej lekcji' + (cur && cur.weeks[0] ? ' (' + cur.weeks[0].title + ')' : '') + '. To dobry moment, żeby wrócić do lekcji jeszcze nieprzerobionych.'));
      curLessons.forEach(function (l) {
        now.appendChild(h('div.row.between', h('div.stack.tight.grow', h('span.label', phase === 'przed' ? 'Pierwsza lekcja' : 'W tym tygodniu'), h('b', l.title)),
          h('a.btn.primary', { href: '#lekcja-' + l.id, onclick: nav('lekcja', l.id) }, 'Otwórz lekcję')));
      });
      wrap.appendChild(now);

      var left = all.slice();
      function group(label, name, ls) {
        if (!ls.length) return;
        left = left.filter(function (l) { return ls.indexOf(l) < 0; });
        var dn = ls.filter(function (l) { return isDone(l.id); }).length;
        wrap.appendChild(h('section.nauka-block', { 'aria-label': (label ? 'Blok ' + label + ': ' : '') + name },
          h('div.card-head', h('h2', label ? h('span.nauka-blk.num', { 'aria-hidden': 'true' }, label) : null, name), h('span.small.muted', 'przerobione ' + dn + ' z ' + ls.length)),
          ls.map(function (l) { return lessonItem(l, cws, counts, curIds[l.id] ? curTag : ''); })));
      }
      (D.plan.blocks || []).forEach(function (b) { group(b.id, b.name, all.filter(function (l) { return l.block === b.id; })); });
      group('', 'Pozostałe lekcje', left.slice());
      if (!all.length) wrap.appendChild(ui.empty('Lekcje nie zostały jeszcze przygotowane.'));
      root.appendChild(wrap);
    }
  };

  /* ---------- #lekcja-<id> ---------- */
  function cleanup() { if (live.spy) { live.spy.disconnect(); live.spy = null; } live.active = false; live.touched = false; }
  function section(id, title, aside) {
    return h('section.card.lekcja-sec', { id: id, 'aria-labelledby': 'lekcja-h-' + id },
      h('div.card-head', h('h2', { id: 'lekcja-h-' + id, tabIndex: -1 }, title), aside || null));
  }
  function check(label, name, checked, onChange) {
    var c = ui.check(label, checked, onChange);
    c.querySelector('input').setAttribute('aria-label', label + ': ' + name);
    return c;
  }
  function readChecks(id, name, after) {
    var st = P.plan.readState(id);
    return h('div.lekcja-checks',
      check('przeczytane', name, st.r, function (on) { P.plan.setRead(id, 'r', on); after(); }),
      check('powtórzone', name, st.p, function (on) { P.plan.setRead(id, 'p', on); after(); }));
  }
  /* Numery tygodni innych lekcji, w których czyta się ten sam akt lub normę (oznaczenie „przeczytane” jest wspólne). */
  function otherWeeks(lesson, cws, test) {
    return uniq(sortedLessons().filter(function (l) { return l.id !== lesson.id && test(l); }).map(function (l) { return weekNo(l, cws); }));
  }
  function sharedHint(weeks, whole, verb) {
    if (!weeks.length) return null;
    return h('span.tiny.muted', 'Pola dotyczą ' + whole + ' — ' + verb + ' też w ' + (weeks.length === 1 ? 'tygodniu ' : 'tygodniach ') + weeks.join(', ') + '.');
  }
  /* „Ustawa o PSP: art. 23–27” → zakres „art. 23–27”; gdy tekst nie zaczyna się od nazwy aktu, zostaje w całości. */
  function scopeOf(text) {
    text = String(text || ''); var i = text.indexOf(': '), head = i > 0 ? text.slice(0, i) : '';
    return head && head.length <= 90 && !/§|art\./.test(head) ? text.slice(i + 2) : '';
  }
  function progressText(ids) { return ids.length ? 'przeczytane ' + readCount(ids) + ' z ' + ids.length : ''; }

  function banners(lesson) {
    var seen = {}, out = [];
    (lesson.readings || []).forEach(function (r) {
      var act = D.actById[r.src];
      if (!act || act.inForce !== false || seen[r.src]) return;
      seen[r.src] = 1;
      var b = ui.banner('warn', act.short + ' — nie obowiązuje' + (act.repealDate ? ' od ' + dmy(act.repealDate) : ''),
        act.note || 'Pytania egzaminacyjne mogą nadal odwoływać się do tego aktu. W dziale „Przepisy i normy” sprawdź, co go zastąpiło.');
      b.insertBefore(h('span.lekcja-warn', P.icon('warn')), b.firstChild);
      out.push(b);
    });
    return out;
  }

  function secReadings(lesson, cws) {
    var readings = lesson.readings || [], ids = uniq(readings.map(function (r) { return r.src; }));
    var count = h('span.small.muted', progressText(ids)), sec = section('czytanie', 'Co przeczytać', count);
    function after() { count.textContent = progressText(ids); }
    var sc = lesson.selfCheck || [];
    if (sc.length) {
      sec.appendChild(h('div.stack.tight', h('h3', 'Pytania kontrolne'), h('p.small.muted', 'Przeczytaj je przed lekturą i szukaj na nie odpowiedzi w tekście.'),
        h('ol.lekcja-self', sc.map(function (x) {
          if (typeof x === 'string') return h('li', x);
          return h('li', (x && (x.q || x.text)) || '', x && x.a ? h('details.fold', h('summary', 'Odpowiedź'), h('p.small', x.a)) : null);
        }))));
    } else if (readings.length) {
      sec.appendChild(h('p.small.muted', 'Zanim zaczniesz czytać, przejrzyj pytania z sekcji „Co pada na egzaminie” i szukaj na nie odpowiedzi w tekście.'));
    }
    if (!readings.length) {
      sec.appendChild(h('p.muted', (lesson.norms || []).length ? 'W tym tygodniu nie ma nowych aktów prawnych. Czytasz normy z listy poniżej.' : 'Ta lekcja nie wprowadza nowych tekstów. Wróć do aktów i norm z poprzednich tygodni.'));
      return sec;
    }
    sec.appendChild(h('ul.lekcja-list', readings.map(function (r) {
      var act = D.actById[r.src], scope = act ? scopeOf(r.text) : '', name = act ? act.short : r.text;
      var status = !act ? ui.chip('brak w rejestrze aktów') : act.inForce !== false ? ui.chip('obowiązuje', 'ok')
        : ui.chip('nie obowiązuje' + (act.repealDate ? ' od ' + dmy(act.repealDate) : ''), 'bad');
      var pdf = act && /^https:\/\//.test(act.url || '') ? h('a.btn.sm.lekcja-pdf', { href: act.url, target: '_blank', rel: 'noopener' }, P.icon('link'), 'Tekst (PDF)') : null;
      var weeks = otherWeeks(lesson, cws, function (l) { return (l.readings || []).some(function (x) { return x.src === r.src; }); });
      return h('li.lekcja-item',
        h('div.lekcja-what',
          h('div.row', h('b', name), status),
          act ? (scope ? h('p.small', h('span.muted', 'Zakres: '), scope) : h('p.small', r.text)) : null,
          h('div.row', pdf, act && act.dz ? h('span.tiny.muted.num', act.dz) : null),
          sharedHint(weeks, 'całego aktu', 'czytasz go')),
        readChecks(r.src, name, after));
    })));
    if (D.meta && D.meta.legalDate) sec.appendChild(h('p.tiny.muted', 'Stan prawny aktów sprawdzono ' + F.date(D.meta.legalDate) + '.'));
    return sec;
  }

  function secNorms(lesson, cws) {
    var bases = lesson.norms || [], count = h('span.small.muted', progressText(bases)), sec = section('normy', 'Normy w aktualnych wydaniach', count);
    function after() { count.textContent = progressText(bases); }
    sec.appendChild(h('ul.lekcja-list', bases.map(function (base) {
      var n = D.normByBase[base], cur = (n && n.current) || [], succ = (n && n.successor) || [], stale = (n && n.staleCited) || [], cited = n && n.qids ? n.qids.length : 0;
      var weeks = otherWeeks(lesson, cws, function (l) { return (l.norms || []).indexOf(base) >= 0; });
      var eds = !n ? h('div.row', ui.ref(base), ui.chip('brak w rejestrze PKN'))
        : cur.length ? h('div.stack.tight', cur.map(function (c) {
          var langs = (c.langs || []).map(function (x) { return LANG[x] || x; });
          return h('div.row', ui.ref(c.num), langs.length ? h('span.tiny.muted', (langs.length === 1 ? 'język: ' : 'języki: ') + langs.join(', ')) : null);
        }))
        : h('div.row', ui.ref(base), ui.chip('wycofana', 'bad'));
      return h('li.lekcja-item',
        h('div.lekcja-what',
          eds,
          n && n.title ? h('p.small', String(n.title).replace(/\s--\s/g, ' – ')) : null,
          succ.length ? h('div.row.small', h('span.muted', cur.length ? 'Następca pod innym numerem:' : 'Zastąpiona przez:'), succ.map(function (s) { return ui.ref(s); })) : null,
          stale.length ? h('div', h('span.chip.warn.lekcja-chipwrap', 'pytania cytują wycofane ' + (stale.length === 1 ? 'wydanie' : 'wydania') + ': ' + stale.join(', '))) : null,
          n && n.note ? h('p.small', n.note) : null,
          cited ? h('span.tiny.muted', 'Cytowana w ' + cited + (cited === 1 ? ' pytaniu egzaminacyjnym.' : ' pytaniach egzaminacyjnych.')) : null,
          sharedHint(weeks, 'całej normy', 'czytasz ją')),
        readChecks(base, base, after));
    })));
    var checked = D.norms && /^\d{4}-\d{2}-\d{2}/.test(D.norms.checked || '') ? D.norms.checked.slice(0, 10) : '';
    sec.appendChild(h('p.small.muted', 'Aplikacja nie zawiera tekstów norm. Dostęp do nich daje czytelnia PKN albo zakład pracy.' + (checked ? ' Wydania sprawdzono w wyszukiwarce PKN ' + F.date(checked) + '.' : '')));
    return sec;
  }

  function topBasis(topics, limit) {
    var m = {};
    poolQ(topics, true).forEach(function (q) { var b = String(q.basis || '').trim(); if (b) m[b] = (m[b] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { basis: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n || a.basis.localeCompare(b.basis, 'pl'); }).slice(0, limit);
  }
  function secSheet(lesson) {
    var sec = section('sciaga', 'Ściąga');
    if (!lesson.authored) {
      sec.appendChild(h('div.prose',
        h('p', 'Ściąga do tej lekcji nie jest jeszcze opracowana. Zrób własną: w trakcie czytania wypisz w tabeli wartości liczbowe — progi, odległości, klasy i czasy. To one stanowią większość pytań testowych.'),
        h('p.muted', 'Dzień później odtwórz tabelę z pamięci na czystej kartce i porównaj ją z tekstem przepisu.')));
      var top = topBasis(lesson.topics || [], 12);
      if (top.length) sec.appendChild(h('div.stack', h('h3', 'Najczęstsze podstawy w pytaniach'),
        h('ol.lekcja-basis', top.map(function (b) { return h('li', ui.ref(b.basis), h('span.small.muted.num', qWord(b.n))); }))));
      return sec;
    }
    if (lesson.intro) sec.appendChild(ui.rich(lesson.intro));
    (lesson.sections || []).forEach(function (s) {
      var t = s.table, rows = t && Array.isArray(t.rows) ? t.rows.filter(Array.isArray) : [];
      sec.appendChild(h('div.stack.lekcja-part', s.h ? h('h3', s.h) : null, s.text ? ui.rich(s.text) : null, rows.length ? ui.table(t.head || [], rows) : null));
    });
    var kv = lesson.keyValues || [];
    if (kv.length) sec.appendChild(h('div.stack.lekcja-part', h('h3', 'Wartości do zapamiętania'),
      h('div.lekcja-kv', ui.table(['Wymaganie', 'Wartość', 'Podstawa'], kv.map(function (k) { return [k.label || '', h('strong', k.value == null ? '' : String(k.value)), k.ref ? ui.ref(k.ref) : '']; })))));
    var traps = lesson.traps || [];
    if (traps.length) sec.appendChild(h('div.stack.lekcja-part', h('h3', 'Pułapki egzaminacyjne'), h('ul.lekcja-traps', traps.map(function (t) { return h('li', typeof t === 'string' ? t : (t && t.text) || ''); }))));
    if (!lesson.intro && !(lesson.sections || []).length && !kv.length && !traps.length) sec.appendChild(h('p.muted', 'Ściąga do tej lekcji nie ma jeszcze treści.'));
    return sec;
  }

  function qDetails(q) {
    var key = P.q.key(q), full = String(q.q || ''), cut = full.length > 185 ? full.slice(0, 170).replace(/\s+\S*$/, '') + '…' : full;
    var over = P.q.isOverridden(q), changed = !!q.stan && q.stan !== 'aktualne', chips = [];
    if (q.sheet) chips.push(ui.chip('arkusz ' + q.sheet)); else chips.push(ui.chip('własne pytanie'));
    if (typeof q.id === 'number') chips.push(ui.chip('pytanie nr ' + q.id));
    if (over) chips.push(ui.chip('własna poprawka klucza', 'accent'));
    else {
      if (q.conf) chips.push(ui.chip('pewność klucza: ' + q.conf, q.conf === 'wysoka' ? 'ok' : q.conf === 'niska' ? 'warn' : ''));
      if (q.verif === 'stary-klucz') chips.push(ui.chip('klucz niezweryfikowany', 'warn'));
      else if (q.verif && q.verif !== 'zgodne') chips.push(ui.chip('weryfikacja klucza: ' + q.verif));
    }
    if (changed) chips.push(ui.chip('stan prawny: ' + q.stan, 'warn'));
    var body = h('div.lekcja-qbody',
      h('ol.lekcja-ans', ['a', 'b', 'c'].map(function (k) {
        if (q[k] == null || q[k] === '') return null;
        return h('li' + (k === key ? '.is-key' : ''), h('span.lekcja-letter.num', k.toUpperCase()), h('span', q[k]), k === key ? h('span.lekcja-keytag', 'poprawna') : null);
      })),
      h('div.row', chips));
    if (changed) {
      var now = q.ansNow, txt = q.stanNote || 'Przepisy, na których opiera się to pytanie, zmieniły się po egzaminie.';
      if (!over && now && now !== '=' && now !== q.ans) txt += /^[abc]$/.test(now) ? ' W dniu egzaminu poprawna była odpowiedź ' + String(q.ans || '').toUpperCase() + ', według obecnych przepisów — ' + now.toUpperCase() + '.'
        : ' Według obecnych przepisów odpowiedź z klucza może nie być już poprawna.';
      body.appendChild(ui.banner('warn', 'Stan prawny: ' + q.stan, txt));
    }
    if (q.basis) body.appendChild(h('div.row', h('span.label', 'Podstawa'), ui.ref(q.basis)));
    if (q.quote) body.appendChild(h('p.quote', q.quote));
    if (q.expl) body.appendChild(ui.rich(q.expl));
    if (!q.basis && !q.expl) body.appendChild(h('p.small.muted', 'Do tego pytania nie ma jeszcze podstawy prawnej ani wyjaśnienia.'));
    if (q.note) body.appendChild(h('p.tiny.muted', 'Uwaga do treści pytania: ' + q.note));
    var mine = P.q.note(q);
    if (mine) body.appendChild(h('p.small', h('span.label', 'Twoja notatka'), ' ', mine));
    return h('details.lekcja-q', h('summary', h('span.lekcja-qcut', cut), h('span.lekcja-qfull', full)), body);
  }
  function secExam(lesson) {
    var topics = lesson.topics || [], pool = poolQ(topics), reserved = poolQ(topics, true).length - pool.length;
    var sec = section('egzamin', 'Co pada na egzaminie');
    if (!pool.length) {
      sec.appendChild(h('p.muted', 'W bazie nie ma jeszcze pytań przypisanych do tematów tej lekcji.' + (reserved > 0 ? ' Pytania z arkuszy zarezerwowanych na próby generalne są tu pomijane.' : '')));
      return sec;
    }
    function own(q) { return P.q.isOverridden(q); }
    var low = pool.filter(function (q) { return q.conf === 'niska' && !own(q); }).length;
    var old = pool.filter(function (q) { return q.verif === 'stary-klucz' && !own(q); }).length;
    var chg = pool.filter(function (q) { return q.stan && q.stan !== 'aktualne'; }).length;
    sec.appendChild(h('div.grid.tight',
      ui.stat(String(pool.length), noun(pool.length, 'pytanie', 'pytania', 'pytań') + ' z tematów tej lekcji w arkuszach egzaminacyjnych'),
      low ? ui.stat(String(low), 'z niską pewnością klucza') : null,
      chg ? ui.stat(String(chg), 'po zmianie przepisów') : null));
    if (old) sec.appendChild(ui.banner('warn', 'Klucz czeka na weryfikację', 'Odpowiedzi do ' + old + (old === 1 ? ' pytania pochodzą' : ' pytań pochodzą') + ' ze starego klucza i nie zostały jeszcze sprawdzone z przepisami. Traktuj je ostrożnie i sprawdzaj w tekście aktu.'));
    else if (low) sec.appendChild(h('p.small.muted', 'Przy pytaniach z niską pewnością klucza sprawdź podstawę prawną samodzielnie.'));
    if (reserved > 0) sec.appendChild(h('p.small.muted', 'Pominięto ' + qWord(reserved) + ' z arkuszy zarezerwowanych na próby generalne.'));

    var list = h('div.lekcja-qlist'), shown = 0, info = h('span.small.muted'), moreBtn = ui.btn('', more, 'sm');
    function more() {
      var to = Math.min(pool.length, shown + (shown ? MORE : FIRST));
      for (; shown < to; shown++) list.appendChild(qDetails(pool[shown]));
      info.textContent = 'Pokazano ' + shown + ' z ' + pool.length + '.';
      if (shown >= pool.length) { if (moreBtn.parentNode) moreBtn.parentNode.removeChild(moreBtn); }
      else moreBtn.textContent = 'Pokaż więcej (jeszcze ' + (pool.length - shown) + ')';
    }
    more();
    sec.appendChild(list);
    sec.appendChild(h('div.row.between', info, moreBtn));
    return sec;
  }

  function oralItems(lesson) {
    var oral = lesson.oral || [];
    if (oral.length) return oral.map(function (o, i) { return typeof o === 'string' ? { key: String(i), q: o, points: [] } : { key: String(i), q: (o && o.q) || '', points: (o && o.points) || [] }; });
    var out = (lesson.readings || []).map(function (r, i) { return { key: 'r' + i, q: 'Omów najważniejsze wymagania: ' + r.text, points: [] }; });
    if (!out.length) (lesson.norms || []).forEach(function (base, i) {
      var n = D.normByBase[base];
      out.push({ key: 'n' + i, q: 'Omów zakres i najważniejsze wymagania normy ' + base + (n && n.title ? ' (' + String(n.title).replace(/\s--\s/g, ' – ') + ')' : ''), points: [] });
    });
    if (!out.length) out.push({ key: 't0', q: 'Omów na głos temat tej lekcji: ' + lesson.title, points: [] });
    return out;
  }
  function secOral(lesson) {
    var items = oralItems(lesson), authored = !!(lesson.oral || []).length, count = h('span.small.muted'), sec = section('ustne', 'Pytania otwarte do części ustnej', count);
    function paint() {
      var rec = lessonRec(lesson.id), o = (rec && rec.oral) || {};
      count.textContent = 'ocenione ' + items.filter(function (it) { return o[it.key] > 0; }).length + ' z ' + items.length;
    }
    sec.appendChild(h('p.small.muted', authored ? 'Odpowiedz na głos, zanim odsłonisz punkty odpowiedzi, a potem oceń, jak Ci poszło.'
      : 'Pytania do tej lekcji nie są jeszcze opracowane. Poniżej ogólne polecenia do czytanych tekstów: odpowiedz na głos, sprawdź się w tekście i oceń, jak Ci poszło.'));
    var rec0 = lessonRec(lesson.id), saved = (rec0 && rec0.oral) || {};
    sec.appendChild(h('ol.lekcja-oral', items.map(function (it, i) {
      var pts = null, btn = null;
      if (it.points.length) {
        pts = h('ul.lekcja-points', { hidden: true }, it.points.map(function (p) { return h('li', p); }));
        btn = ui.btn('Pokaż punkty odpowiedzi', function () {
          var show = pts.hidden; pts.hidden = !show;
          btn.textContent = show ? 'Ukryj punkty odpowiedzi' : 'Pokaż punkty odpowiedzi'; btn.setAttribute('aria-expanded', String(show));
        }, 'sm');
        btn.setAttribute('aria-expanded', 'false');
      }
      var seg = ui.seg(GRADES, saved[it.key] || 0, function (v) { var l = lessonDoc(lesson.id); l.oral[it.key] = v; saveLesson(l); paint(); });
      seg.setAttribute('aria-label', 'Samoocena odpowiedzi na pytanie ' + (i + 1));
      return h('li', h('p.lekcja-oq', h('span.num.muted', (i + 1) + '. '), it.q), btn ? h('div', btn) : null, pts,
        h('div.row', h('span.label', 'Samoocena'), seg));
    })));
    paint();
    return sec;
  }

  function startQuiz(lesson) {
    var opts = { mode: 'nauka', filter: { topics: (lesson.topics || []).slice() }, n: 25, label: lesson.title, returnTo: 'lekcja' };
    if (P.practice && typeof P.practice.start === 'function') P.practice.start(opts);
    else if (P.views.pytania) P.router.go('pytania', 'sesja', opts);
    else ui.toast('Quiz nie jest jeszcze dostępny.');
  }
  function startCards(lesson) {
    var opts = { filter: { topics: (lesson.topics || []).slice() }, label: lesson.title, returnTo: 'lekcja' };
    if (P.cardsUI && typeof P.cardsUI.start === 'function') P.cardsUI.start(opts);
    else if (P.views.fiszki) P.router.go('fiszki', 'sesja', opts);
    else ui.toast('Fiszki nie są jeszcze dostępne.');
  }
  function footer(lesson, paintDone) {
    var topics = lesson.topics || [], nq = poolQ(topics).length, nf = poolF(topics).length;
    var quiz = ui.btn('Quiz z tematu (' + nq + ')', function () { startQuiz(lesson); }, 'primary'), cards = ui.btn('Fiszki z tematu (' + nf + ')', function () { startCards(lesson); });
    quiz.disabled = !nq; cards.disabled = !nf;
    return h('section.card.lekcja-foot', { 'aria-label': 'Ćwiczenia i zakończenie lekcji' },
      h('div.row', quiz, cards),
      !nq || !nf ? h('p.small.muted', !nq && !nf ? 'Do tematów tej lekcji nie ma jeszcze pytań ani fiszek.' : !nq ? 'Do tematów tej lekcji nie ma jeszcze pytań.' : 'Do tematów tej lekcji nie ma jeszcze fiszek.') : null,
      h('hr.divider'),
      ui.check('Lekcja przerobiona', isDone(lesson.id), function (on) { var l = lessonDoc(lesson.id); l.read = on ? Date.now() : 0; saveLesson(l); paintDone(); },
        'Zaznacz, gdy przeczytasz teksty i przejrzysz ściągę. Lekcja pozostaje dostępna do powtórek.'));
  }
  function neighbours(lesson, cws) {
    var all = sortedLessons(), ix = all.map(function (l) { return l.id; }).indexOf(lesson.id), prev = all[ix - 1], next = all[ix + 1];
    function a(l, label, cls) {
      return h('a' + cls, { href: '#lekcja-' + l.id, onclick: nav('lekcja', l.id) }, h('span.label', label + ' · tydzień ' + weekNo(l, cws)), h('span', l.title));
    }
    if (!prev && !next) return null;
    return h('nav.lekcja-pn', { 'aria-label': 'Sąsiednie lekcje' }, prev ? a(prev, 'Poprzednia lekcja', '') : null, next ? a(next, 'Następna lekcja', '.is-next') : null);
  }
  function jumpTo(sec, smooth) {
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sec.scrollIntoView({ behavior: smooth && !calm ? 'smooth' : 'auto', block: 'start' });
    var hd = sec.querySelector('h2'); if (hd) { try { hd.focus({ preventScroll: true }); } catch (e) { /* starsze przeglądarki */ } }
  }
  function defaultLessonId() {
    var cur = P.plan.current(), id = '';
    if (cur) cur.weeks.forEach(function (w) { if (!id && w && w.lesson) id = w.lesson; });
    return id || (sortedLessons()[0] || {}).id || '';
  }

  P.views.lekcja = {
    title: 'Lekcja',
    render: function (root, param, payload) {
      cleanup();
      var id = param || live.lastId || defaultLessonId();
      var lesson = D.lessonById[id] || D.lessonById[String(id).toUpperCase()];
      if (!lesson) {
        P.views.lekcja.title = 'Lekcja';
        root.appendChild(ui.empty('Nie ma lekcji o oznaczeniu „' + id + '”.', h('a.btn', { href: '#nauka', onclick: nav('nauka') }, 'Wszystkie lekcje')));
        return;
      }
      live.lastId = lesson.id; live.active = true;
      P.views.lekcja.title = lesson.title;
      var cws = P.plan.calWeeks(), cw = calWeekOf(lesson, cws), block = D.blockById[lesson.block];
      var wrap = h('div.lekcja'), doneSlot = h('span.row');
      function touch() { live.touched = true; }
      wrap.addEventListener('click', touch); wrap.addEventListener('change', touch);
      function paintDone() { P.clear(doneSlot); if (isDone(lesson.id)) doneSlot.appendChild(doneChip()); }
      paintDone();

      wrap.appendChild(h('header.stack.lekcja-head',
        h('div', h('a.lekcja-back', { href: '#nauka', onclick: nav('nauka') }, 'Wszystkie lekcje')),
        h('div.row', h('span.label', 'Tydzień ' + (cw ? (cw.i + 1) + ' z ' + cws.length + ' · ' + F.range(cw.start, cw.end) : lesson.week)), block ? h('span.label', 'Blok ' + block.id + ' · ' + block.name) : null),
        h('h1', lesson.title),
        lesson.focus ? h('p.muted', lesson.focus) : null,
        h('div.row', topicChips(lesson), doneSlot)));

      var secs = [{ id: 'czytanie', label: 'Czytanie', el: secReadings(lesson, cws) }];
      if ((lesson.norms || []).length) secs.push({ id: 'normy', label: 'Normy', el: secNorms(lesson, cws) });
      secs.push({ id: 'sciaga', label: 'Ściąga', el: secSheet(lesson) }, { id: 'egzamin', label: 'Co pada', el: secExam(lesson) }, { id: 'ustne', label: 'Ustne', el: secOral(lesson) });

      var btns = {}, bar = h('div');
      secs.forEach(function (s) { btns[s.id] = bar.appendChild(h('button', { type: 'button', onclick: function () { jumpTo(s.el, true); } }, s.label)); });
      wrap.appendChild(h('nav.lekcja-jump', { 'aria-label': 'Sekcje lekcji' }, bar));
      banners(lesson).forEach(function (b) { wrap.appendChild(b); });
      secs.forEach(function (s) { wrap.appendChild(s.el); });
      wrap.appendChild(footer(lesson, paintDone));
      var pn = neighbours(lesson, cws); if (pn) wrap.appendChild(pn);
      root.appendChild(wrap);

      if ('IntersectionObserver' in window) {
        var vis = {};
        live.spy = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { vis[en.target.id] = en.isIntersecting; });
          var on = secs.filter(function (s) { return vis[s.id]; })[0];
          secs.forEach(function (s) { if (on && s.id === on.id) btns[s.id].setAttribute('aria-current', 'true'); else btns[s.id].removeAttribute('aria-current'); });
        }, { rootMargin: '-12% 0px -68% 0px' });
        secs.forEach(function (s) { live.spy.observe(s.el); });
      }
      var want = payload && payload.section, target = want && secs.filter(function (s) { return s.id === want; })[0];
      if (target) requestAnimationFrame(function () { if (live.active && wrap.parentNode) jumpTo(target.el, false); });
    },
    leave: function () { cleanup(); },
    /* Synchronizacja w tle nie przerywa czytania: po przewinięciu lub pierwszej czynności widok nie jest budowany od nowa. */
    busy: function () { return live.active && (live.touched || window.scrollY > 150); }
  };
})();
