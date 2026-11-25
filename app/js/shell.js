/* Powłoka: nawigacja, trasy (#nazwa lub #nazwa-parametr), uruchomienie aplikacji. Ładowana jako ostatnia. */
(function () {
  'use strict';
  var P = window.PPOZ, h = P.h, ui = P.ui;
  var NAV = [
    { id: 'dzis', label: 'Dziś' }, { id: 'plan', label: 'Plan' }, { id: 'nauka', label: 'Nauka' }, { id: 'pytania', label: 'Pytania' },
    { id: 'fiszki', label: 'Fiszki' }, { id: 'egzamin', label: 'Egzamin próbny' }, { sep: true },
    { id: 'zrodla', label: 'Przepisy i normy' }, { id: 'statystyki', label: 'Statystyki' }, { id: 'metoda', label: 'Jak się uczyć' }, { id: 'ustawienia', label: 'Ustawienia' }
  ];
  var TABS = ['dzis', 'plan', 'nauka', 'pytania'];
  var ALIAS = { lekcja: 'nauka' };
  var cur = { name: '', param: '', view: null }, root, rail, tabbar, payload = null;

  function parse() { var s = decodeURIComponent((location.hash || '').replace(/^#/, '')), i = s.indexOf('-'); return i < 0 ? { name: s || 'dzis', param: '' } : { name: s.slice(0, i), param: s.slice(i + 1) }; }
  function navName(name) { return ALIAS[name] || name; }
  function badge(id) { if (id !== 'dzis' || !P.data.questions) return 0; var t = P.today(); return t.capQ + t.capF; }

  function buildNav() {
    P.clear(rail); P.clear(tabbar);
    rail.appendChild(h('div.brand', h('b', 'Egzamin rzeczoznawcy ppoż.'), h('span', weekLine())));
    NAV.forEach(function (n) {
      if (n.sep) { rail.appendChild(h('div.nav-sep')); return; }
      var b = badge(n.id);
      rail.appendChild(h('a.nav-item', { href: '#' + n.id, 'aria-current': navName(cur.name) === n.id ? 'page' : null }, P.icon(n.id), h('span', n.label), b ? h('span.count', b) : null));
    });
    rail.appendChild(h('div.rail-foot', syncLine()));
    TABS.forEach(function (id) {
      var n = NAV.filter(function (x) { return x.id === id; })[0], b = badge(id);
      tabbar.appendChild(h('a.nav-item', { href: '#' + id, 'aria-current': navName(cur.name) === id ? 'page' : null }, P.icon(id), h('span', n.label), b ? h('span.count', b) : null));
    });
    var more = TABS.indexOf(navName(cur.name)) < 0;
    tabbar.appendChild(h('button.nav-item', { type: 'button', 'aria-current': more ? 'page' : null, onclick: moreMenu }, P.icon('wiecej'), h('span', 'Więcej')));
  }
  function weekLine() {
    var ph = P.plan.phase(), w = P.plan.calWeeks();
    if (ph === 'przed') return 'Start planu: ' + P.fmt.date(P.plan.start());
    if (ph === 'po') return 'Plan zakończony';
    return 'Tydzień ' + (P.plan.index() + 1) + ' z ' + w.length;
  }
  function syncLine() {
    var s = P.store.status();
    if (s.mode === 'cloud') return s.pending ? 'Zapisywanie postępu…' : 'Postęp zapisany na koncie Claude';
    return s.local ? 'Postęp zapisany tylko w tej przeglądarce' : 'Uwaga: ta przeglądarka nie zapisuje postępu';
  }
  function moreMenu() {
    var close = ui.modal({ title: 'Więcej', body: h('div.stack.tight', NAV.filter(function (n) { return !n.sep && TABS.indexOf(n.id) < 0; }).map(function (n) {
      return h('a.nav-item', { href: '#' + n.id, onclick: function () { close(); } }, P.icon(n.id), h('span', n.label));
    })), actions: [{ label: 'Zamknij' }] });
  }

  function show() {
    var r = parse(), view = P.views[r.name];
    if (!view) { r = { name: 'dzis', param: '' }; view = P.views.dzis; }
    if (cur.view && cur.view.leave) { try { cur.view.leave(); } catch (e) { console.error(e); } }
    cur = { name: r.name, param: r.param, view: view };
    P.clear(root); window.scrollTo(0, 0);
    var data = payload; payload = null;
    try { if (view) view.render(root, r.param, data); else root.appendChild(ui.empty('Ten widok jest w przygotowaniu.')); }
    catch (e) { console.error(e); P.clear(root); root.appendChild(ui.banner('bad', 'Nie udało się wyświetlić widoku', String(e && e.message || e))); }
    document.title = (view && view.title ? view.title + ' · ' : '') + 'Egzamin rzeczoznawcy ppoż.';
    buildNav();
  }

  P.router = {
    /* go('pytania', 'sesja', {…}) — trzeci argument trafia do render(root, param, payload) i nie jest zapisywany w adresie. */
    go: function (name, param, data) { payload = data || null; var hash = '#' + name + (param ? '-' + param : ''); if (location.hash === hash) show(); else location.hash = hash; },
    current: function () { return { name: cur.name, param: cur.param }; },
    refresh: function () { if (cur.view && cur.view.busy && cur.view.busy()) { buildNav(); return; } show(); },
    updateNav: function () { buildNav(); }
  };
  P.applyTheme = function () { var t = P.settings().theme, el = document.documentElement; if (t === 'light' || t === 'dark') el.setAttribute('data-theme', t); else if (!window.claude) el.removeAttribute('data-theme'); };

  function boot() {
    root = document.getElementById('view'); rail = document.getElementById('rail'); tabbar = document.getElementById('tabbar');
    root.appendChild(h('p.muted', 'Wczytywanie danych…'));
    P.data.ready.then(function () {
      P.applyTheme(); show();
      window.addEventListener('hashchange', show);
      P.store.onChange(function (what) { if (what === 'data') P.router.refresh(); else if (what === 'sync') buildNav(); });
    }, function (e) { P.clear(root); root.appendChild(ui.banner('bad', 'Nie udało się wczytać danych aplikacji', String(e && e.message || e))); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
