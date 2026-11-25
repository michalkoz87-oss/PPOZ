/* Rysunki techniczne do kazusów części ustnej: rzut kondygnacji i plan zagospodarowania rysowane z opisu geometrii.
   Wymiary w opisie są w metrach (oś x w prawo, oś y w dół). Opis: {id, title, scale, kind, size:[szer, wys], pad, font, items:[…]}.
   Rodzaje elementów (pole t): wall, door, window, room, stair, dim, path, sym, rect, poly, line, zone, text, leader. Szczegóły: docs w content/cases/README.md.
   P.drawing.mount(opis) → {el, setMarkers(lista|null)}; pasek: powiększenie i pomiar odległości (kolejne kliknięcia dodają odcinki). */
(function () {
  'use strict';
  var P = window.PPOZ, h = P.h, NS = 'http://www.w3.org/2000/svg', S = 100, serial = 0;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag), k;
    for (k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function fmt(v, d) { return Number(v).toFixed(d == null ? 2 : d).replace('.', ','); }
  function len(a, b) { return Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])); }
  function pathLen(pts) { var s = 0, i; for (i = 1; i < pts.length; i++) s += len(pts[i - 1], pts[i]); return s; }
  function X(v) { return Math.round(v * S * 10) / 10; }
  function pts(list) { return list.map(function (p) { return X(p[0]) + ',' + X(p[1]); }).join(' '); }

  var SYM = {
    H25: { cls: 'fire', text: 'H', sub: '25', shape: 'box', legend: 'hydrant wewnętrzny 25' },
    H33: { cls: 'fire', text: 'H', sub: '33', shape: 'box', legend: 'hydrant wewnętrzny 33' },
    H52: { cls: 'fire', text: 'H', sub: '52', shape: 'box', legend: 'hydrant wewnętrzny 52' },
    Z52: { cls: 'fire', text: 'Z', sub: '52', shape: 'box', legend: 'zawór 52' },
    G: { cls: 'fire', text: 'G', shape: 'dot', legend: 'gaśnica' },
    HZ: { cls: 'fire', text: 'H', shape: 'ring', legend: 'hydrant zewnętrzny' },
    ROP: { cls: 'fire', text: 'R', shape: 'box', legend: 'ręczny ostrzegacz pożarowy' },
    PWP: { cls: 'fire', text: 'PWP', shape: 'wide', legend: 'przeciwpożarowy wyłącznik prądu' },
    CSP: { cls: 'fire', text: 'CSP', shape: 'wide', legend: 'centrala sygnalizacji pożarowej' },
    EW: { cls: 'evac', text: 'EW', shape: 'wide', legend: 'wyjście ewakuacyjne' },
    KD: { cls: 'ink', text: '', shape: 'cross', legend: 'klapa dymowa / okno oddymiające' },
    TREE: { cls: 'green', text: '', shape: 'tree', legend: 'drzewo (wysokość ponad 3 m)' },
    ZB: { cls: 'fire', text: 'ZB', shape: 'wide', legend: 'przeciwpożarowy zbiornik wodny' }
  };
  var AREA = {
    building: 'budynek projektowany', neighbor: 'budynek istniejący', road: 'jezdnia, droga', fireroad: 'droga pożarowa',
    paved: 'dojście utwardzone', parking: 'miejsca postojowe', green: 'zieleń', tank: 'zbiornik', plot: 'granica działki', shed: 'wiata, plac składowy'
  };

  function render(spec) {
    var W = spec.size[0], H = spec.size[1], pad = spec.pad || [3, 3, 3, 3];
    var F = spec.font || Math.max(0.3, Math.max(W + pad[0] + pad[2], H + pad[1] + pad[3]) / 80), id = 'dw' + (++serial);
    var foot = F * 3.2, vb = [X(-pad[0]), X(-pad[1]), X(W + pad[0] + pad[2]), X(H + pad[1] + pad[3] + foot)];
    var svg = el('svg', { viewBox: vb.join(' '), 'class': 'dw', role: 'img', 'aria-label': (spec.title || 'Rysunek') + (spec.scale ? ', skala ' + spec.scale : '') });
    svg.style.setProperty('--dw-f', X(F) + 'px');
    var defs = el('defs', {}, svg), used = {};
    var hatch = el('pattern', { id: id + 'h', width: X(F * 0.7), height: X(F * 0.7), patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: X(F * 0.7), 'class': 'dw-hatch' }, hatch);
    var arrow = el('marker', { id: id + 'a', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 0L10 5L0 10z', 'class': 'dw-arrow' }, arrow);
    el('rect', { x: vb[0], y: vb[1], width: vb[2], height: vb[3], 'class': 'dw-paper' }, svg);
    var layers = {}; ['area', 'zone', 'wall', 'open', 'line', 'sym', 'text', 'dim', 'mark', 'tool'].forEach(function (n) { layers[n] = el('g', { 'class': 'dw-l-' + n }, svg); });

    function text(layer, x, y, str, cls, o) {
      o = o || {};
      var lines = String(str).split('\n'), size = (o.size || 1) * F, t = el('text', { x: X(x), y: X(y), 'class': 'dw-t ' + (cls || ''), 'text-anchor': o.anchor || 'middle', 'font-size': X(size) }, layer);
      if (o.rot) t.setAttribute('transform', 'rotate(' + o.rot + ' ' + X(x) + ' ' + X(y) + ')');
      var y0 = y - (lines.length - 1) * size * 0.6;
      lines.forEach(function (ln, i) { var s = el('tspan', { x: X(x), y: X(y0 + i * size * 1.2) }, t); s.textContent = ln; });
      return t;
    }
    function gap(at, w, dir, t) { /* otwór w ścianie: prostokąt w kolorze papieru */
      var hw = w / 2, ht = (t || 0.25) / 2 + 0.02;
      return dir === 'v' ? [at[0] - ht, at[1] - hw, 2 * ht, w] : [at[0] - hw, at[1] - ht, w, 2 * ht];
    }
    function rectEl(layer, r, cls) { return el('rect', { x: X(r[0]), y: X(r[1]), width: X(r[2]), height: X(r[3]), 'class': cls }, layer); }
    function dash() { return Array.prototype.map.call(arguments, function (v) { return X(v * F); }).join(' '); }
    var DASH = { plot: dash(1.3, 0.4, 0.2, 0.4), parking: dash(0.5, 0.35), shed: dash(0.7, 0.4), fireroad: dash(0.9, 0.45) };

    var draw = {
      wall: function (it) {
        var k = it.k || 'int', w = it.w || (k === 'ext' ? 0.4 : 0.2);
        used['wall-' + (k === 'fire' ? 'fire' : 'std')] = 1;
        el(it.close ? 'polygon' : 'polyline', { points: pts(it.pts), 'class': 'dw-wall dw-wall-' + k, 'stroke-width': X(w) }, layers.wall);
        if (it.label) { var a = it.pts[0], b = it.pts[1]; text(layers.text, (a[0] + b[0]) / 2 + (it.lo ? it.lo[0] : 0), (a[1] + b[1]) / 2 + (it.lo ? it.lo[1] : -F * 0.9), it.label, 'dw-t-fire', { size: 0.85 }); }
      },
      door: function (it) {
        var w = it.w || 0.9, dir = it.dir || 'h', at = it.at, n = it.leafs === 2 ? 2 : 1, lw = w / n;
        rectEl(layers.open, gap(at, w, dir, it.th), 'dw-gap');
        var sign = (it.open === 'n' || it.open === 'w') ? -1 : 1, i, hinge, other, tip, d, cross;
        for (i = 0; i < n; i++) {
          var first = n === 2 ? i === 0 : it.hinge !== 'b';
          if (dir === 'h') { hinge = [at[0] + (first ? -w / 2 : w / 2), at[1]]; other = [hinge[0] + (first ? lw : -lw), at[1]]; tip = [hinge[0], at[1] + sign * lw]; }
          else { hinge = [at[0], at[1] + (first ? -w / 2 : w / 2)]; other = [at[0], hinge[1] + (first ? lw : -lw)]; tip = [at[0] + sign * lw, hinge[1]]; }
          cross = (tip[0] - hinge[0]) * (other[1] - hinge[1]) - (tip[1] - hinge[1]) * (other[0] - hinge[0]);
          el('line', { x1: X(hinge[0]), y1: X(hinge[1]), x2: X(tip[0]), y2: X(tip[1]), 'class': 'dw-leaf' + (it.cls ? ' dw-fire' : '') }, layers.open);
          d = 'M' + X(tip[0]) + ' ' + X(tip[1]) + 'A' + X(lw) + ' ' + X(lw) + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + X(other[0]) + ' ' + X(other[1]);
          el('path', { d: d, 'class': 'dw-swing' }, layers.open);
        }
        var lab = [it.label, it.cls].filter(Boolean).join(' ');
        if (lab) {
          if (it.cls) used['door-fire'] = 1;
          var off = it.lo || (dir === 'h' ? [0, -sign * F * 0.9] : [-sign * F * 0.6, 0]);
          text(layers.text, at[0] + off[0], at[1] + off[1] + F * 0.3, lab, it.cls ? 'dw-t-fire' : 'dw-t-2', { size: 0.8, rot: dir === 'v' && !it.lo ? -90 : 0 });
        }
      },
      window: function (it) {
        var w = it.w || 1.5, dir = it.dir || 'h', at = it.at, r = gap(at, w, dir, it.th || 0.4);
        rectEl(layers.open, r, 'dw-gap dw-win');
        if (dir === 'h') el('line', { x1: X(r[0]), y1: X(at[1]), x2: X(r[0] + r[2]), y2: X(at[1]), 'class': 'dw-thin' }, layers.open);
        else el('line', { x1: X(at[0]), y1: X(r[1]), x2: X(at[0]), y2: X(r[1] + r[3]), 'class': 'dw-thin' }, layers.open);
      },
      room: function (it) {
        var r = it.rect, cx = r[0] + r[2] / 2 + (it.lo ? it.lo[0] : 0), cy = r[1] + r[3] / 2 + (it.lo ? it.lo[1] : 0), lines = [];
        if (it.fill) rectEl(layers.zone, r, 'dw-fill dw-fill-' + it.fill);
        var head = [it.no, it.name].filter(Boolean).join('  ');
        if (head) lines.push(head);
        var sub = [it.area != null ? fmt(it.area, 1) + ' m²' : null, it.note].filter(Boolean).join(' · ');
        var narrow = r[2] < r[3] * 0.45 && !it.flat, t;
        if (it.stack && sub) { lines.push(sub); sub = ''; }
        if (lines.length) t = text(layers.text, cx, cy - (sub ? F * 0.25 : -F * 0.3), lines.join('\n'), 'dw-t-room', { rot: narrow ? -90 : 0, size: it.size || 1 });
        if (sub) text(layers.text, narrow ? cx + F * 1.25 : cx, narrow ? cy : cy + F * 1.05, sub, 'dw-t-2', { size: 0.82 * (it.size || 1), rot: narrow ? -90 : 0 });
        return t;
      },
      stair: function (it) {
        var r = it.rect, n = it.n || 10, ax = it.axis || (r[2] >= r[3] ? 'x' : 'y'), i, v;
        rectEl(layers.line, r, 'dw-stair');
        for (i = 1; i < n; i++) {
          if (ax === 'x') { v = r[0] + r[2] * i / n; el('line', { x1: X(v), y1: X(r[1]), x2: X(v), y2: X(r[1] + r[3]), 'class': 'dw-thin' }, layers.line); }
          else { v = r[1] + r[3] * i / n; el('line', { x1: X(r[0]), y1: X(v), x2: X(r[0] + r[2]), y2: X(v), 'class': 'dw-thin' }, layers.line); }
        }
        if (ax === 'x') el('line', { x1: X(r[0]), y1: X(r[1] + r[3] / 2), x2: X(r[0] + r[2]), y2: X(r[1] + r[3] / 2), 'class': 'dw-stair' }, layers.line);
        else el('line', { x1: X(r[0] + r[2] / 2), y1: X(r[1]), x2: X(r[0] + r[2] / 2), y2: X(r[1] + r[3]), 'class': 'dw-stair' }, layers.line);
        if (it.label) text(layers.text, r[0] + r[2] / 2, r[1] + r[3] + F * 1.1, it.label, 'dw-t-room', { size: 0.9 });
      },
      dim: function (it) {
        var a = it.a, b = it.b, L = len(a, b), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]], off = it.off || 0;
        var a2 = [a[0] + n[0] * off, a[1] + n[1] * off], b2 = [b[0] + n[0] * off, b[1] + n[1] * off], tk = F * 0.35, g = layers.dim, sg = off < 0 ? -1 : 1;
        if (off) [[a, a2], [b, b2]].forEach(function (p) {
          el('line', { x1: X(p[0][0] + n[0] * sg * F * 0.3), y1: X(p[0][1] + n[1] * sg * F * 0.3), x2: X(p[1][0] + n[0] * sg * tk), y2: X(p[1][1] + n[1] * sg * tk), 'class': 'dw-dim' }, g);
        });
        el('line', { x1: X(a2[0]), y1: X(a2[1]), x2: X(b2[0]), y2: X(b2[1]), 'class': 'dw-dim' }, g);
        [a2, b2].forEach(function (p) {
          el('line', { x1: X(p[0] - (u[0] + n[0]) * tk * 0.7), y1: X(p[1] - (u[1] + n[1]) * tk * 0.7), x2: X(p[0] + (u[0] + n[0]) * tk * 0.7), y2: X(p[1] + (u[1] + n[1]) * tk * 0.7), 'class': 'dw-tick' }, g);
        });
        var ang = Math.atan2(u[1], u[0]) * 180 / Math.PI, up = n; if (ang > 89.99) ang -= 180; else if (ang <= -90.01) ang += 180;
        if (Math.abs(ang) < 0.01) up = [0, -1]; else if (Math.abs(Math.abs(ang) - 90) < 0.01) up = [-1, 0]; else up = n[1] < 0 ? n : [-n[0], -n[1]];
        var mx = (a2[0] + b2[0]) / 2 + up[0] * F * 0.45 + (it.tlo ? it.tlo[0] : 0), my = (a2[1] + b2[1]) / 2 + up[1] * F * 0.45 + (it.tlo ? it.tlo[1] : 0);
        text(g, mx, my, it.text || fmt(L), 'dw-t-dim', { rot: Math.round(ang), size: 0.9 });
      },
      path: function (it) {
        used['path-' + (it.k || 'evac')] = 1;
        el('polyline', { points: pts(it.pts), 'class': 'dw-path dw-path-' + (it.k || 'evac'), 'stroke-dasharray': dash(0.7, 0.45), 'marker-end': 'url(#' + id + 'a)' }, layers.line);
        var label = it.label || (it.auto ? fmt(pathLen(it.pts), 1) + ' m' : ''), best = 0, bi = 1, i, d;
        if (!label) return;
        for (i = 1; i < it.pts.length; i++) { d = len(it.pts[i - 1], it.pts[i]); if (d > best) { best = d; bi = i; } }
        var a = it.pts[bi - 1], b = it.pts[bi], vert = Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]), lo = it.lo || (vert ? [-F * 0.6, 0] : [0, -F * 0.5]);
        text(layers.text, (a[0] + b[0]) / 2 + lo[0], (a[1] + b[1]) / 2 + lo[1], label, 'dw-t-' + (it.k || 'evac'), { size: 0.9, rot: vert && !it.lo ? -90 : 0 });
      },
      sym: function (it) {
        var s = SYM[it.k] || { cls: 'ink', text: it.k, shape: 'box', legend: it.k }, x = it.at[0], y = it.at[1], r = F * 0.75, g = el('g', { 'class': 'dw-sym dw-sym-' + s.cls }, layers.sym);
        used['sym-' + it.k] = 1;
        if (s.shape === 'dot') el('circle', { cx: X(x), cy: X(y), r: X(r * 0.85), 'class': 'dw-sym-fill' }, g);
        else if (s.shape === 'ring') { el('circle', { cx: X(x), cy: X(y), r: X(r * 1.25), 'class': 'dw-sym-box' }, g); el('circle', { cx: X(x), cy: X(y), r: X(r * 0.85), 'class': 'dw-sym-fill' }, g); }
        else if (s.shape === 'tree') { el('circle', { cx: X(x), cy: X(y), r: X(it.r || 1.5), 'class': 'dw-sym-tree' }, g); el('circle', { cx: X(x), cy: X(y), r: X(0.15), 'class': 'dw-sym-fill' }, g); }
        else if (s.shape === 'cross') { rectEl(g, [x - r, y - r, 2 * r, 2 * r], 'dw-sym-box'); el('path', { d: 'M' + X(x - r) + ' ' + X(y - r) + 'L' + X(x + r) + ' ' + X(y + r) + 'M' + X(x + r) + ' ' + X(y - r) + 'L' + X(x - r) + ' ' + X(y + r), 'class': 'dw-thin' }, g); }
        else rectEl(g, s.shape === 'wide' ? [x - r * 1.7, y - r * 0.8, r * 3.4, r * 1.6] : [x - r, y - r, 2 * r, 2 * r], s.shape === 'box' && s.sub ? 'dw-sym-fill' : 'dw-sym-box');
        if (s.text) text(g, x, y + F * 0.3, s.text, 'dw-t-sym' + (s.shape === 'dot' || s.shape === 'ring' || (s.shape === 'box' && s.sub) ? ' inv' : ''), { size: s.shape === 'wide' ? 0.75 : 0.85 });
        var lab = (it.label || '').trim() || (it.label ? '' : (s.sub ? s.text + s.sub : ''));
        if (lab) { var lo = it.lo || [0, r + F * 0.9]; text(layers.text, x + lo[0], y + lo[1], lab, 'dw-t-' + (s.cls === 'ink' ? '2' : s.cls), { size: 0.8 }); }
      },
      rect: function (it) { draw.poly({ k: it.k, label: it.label, lo: it.lo, size: it.size, pts: [[it.rect[0], it.rect[1]], [it.rect[0] + it.rect[2], it.rect[1]], [it.rect[0] + it.rect[2], it.rect[1] + it.rect[3]], [it.rect[0], it.rect[1] + it.rect[3]]] }); },
      poly: function (it) {
        var k = it.k || 'building', p = el('polygon', { points: pts(it.pts), 'class': 'dw-area dw-k-' + k }, layers.area), cx = 0, cy = 0;
        if (k === 'building' || k === 'neighbor') p.setAttribute('fill', 'url(#' + id + 'h)');
        if (DASH[k]) p.setAttribute('stroke-dasharray', DASH[k]);
        if (AREA[k]) used['area-' + k] = 1;
        if (!it.label) return;
        it.pts.forEach(function (q) { cx += q[0]; cy += q[1]; }); cx /= it.pts.length; cy /= it.pts.length;
        text(layers.text, cx + (it.lo ? it.lo[0] : 0), cy + (it.lo ? it.lo[1] : 0) + F * 0.3, it.label, k === 'building' ? 'dw-t-room' : 'dw-t-2', { size: it.size || 0.95 });
      },
      line: function (it) { el('line', { x1: X(it.a[0]), y1: X(it.a[1]), x2: X(it.b[0]), y2: X(it.b[1]), 'class': 'dw-line dw-line-' + (it.k || 'thin') }, layers.line); },
      zone: function (it) {
        var r = it.rect; used['zone'] = 1;
        rectEl(layers.zone, r, 'dw-zone').setAttribute('stroke-dasharray', dash(0.8, 0.5));
        if (it.label) text(layers.text, r[0] + r[2] / 2 + (it.lo ? it.lo[0] : 0), r[1] + F * 1.2 + (it.lo ? it.lo[1] : 0), it.label, 'dw-t-zone', { size: 0.9 });
      },
      text: function (it) { text(layers.text, it.at[0], it.at[1], it.text, 'dw-t-' + (it.k || '2'), { size: it.size || 0.9, anchor: it.anchor, rot: it.rot }); },
      leader: function (it) {
        el('line', { x1: X(it.a[0]), y1: X(it.a[1]), x2: X(it.b[0]), y2: X(it.b[1]), 'class': 'dw-dim', 'marker-end': 'url(#' + id + 'a)' }, layers.dim);
        text(layers.text, it.a[0] + (it.lo ? it.lo[0] : 0), it.a[1] + (it.lo ? it.lo[1] : -F * 0.4), it.text, 'dw-t-' + (it.k || '2'), { size: 0.85, anchor: it.anchor });
      }
    };
    (spec.items || []).forEach(function (it) { if (draw[it.t]) draw[it.t](it); });

    /* strzałka północy, podziałka, tabliczka */
    if (spec.north) {
      var nx = spec.north[0], ny = spec.north[1], g = el('g', { 'class': 'dw-north' }, layers.dim);
      el('path', { d: 'M' + X(nx) + ' ' + X(ny - F * 2) + 'L' + X(nx + F * 0.8) + ' ' + X(ny + F) + 'L' + X(nx) + ' ' + X(ny + F * 0.3) + 'L' + X(nx - F * 0.8) + ' ' + X(ny + F) + 'z', 'class': 'dw-arrow' }, g);
      text(g, nx, ny - F * 2.4, 'N', 'dw-t-room', { size: 1 });
    }
    var bar = spec.bar || (W > 60 ? 20 : W > 25 ? 10 : 5), by = H + pad[3] + foot * 0.25, bx = -pad[0] + F, i;
    for (i = 0; i < 2; i++) rectEl(layers.dim, [bx + i * bar / 2, by, bar / 2, F * 0.3], i ? 'dw-bar-b' : 'dw-bar-a');
    [0, bar / 2, bar].forEach(function (v) { text(layers.dim, bx + v, by + F * 1.4, String(v).replace('.', ',') + (v === bar ? ' m' : ''), 'dw-t-2', { size: 0.8 }); });
    text(layers.dim, W + pad[2] - F, by + F * 0.9, [spec.title, spec.scale ? 'skala ' + spec.scale : ''].filter(Boolean).join(' · '), 'dw-t-room', { anchor: 'end', size: 1.05 });

    svg._dw = { F: F, layers: layers, used: used, id: id };
    return svg;
  }

  function legend(svg) {
    var used = svg._dw.used, out = [];
    function add(key, cls, label) { if (used[key]) out.push(h('li', h('span.dwg-key.' + cls), h('span', label))); }
    add('wall-std', 'k-wall', 'ściana'); add('wall-fire', 'k-firewall', 'ściana oddzielenia przeciwpożarowego'); add('door-fire', 'k-firedoor', 'drzwi o podanej klasie odporności ogniowej');
    add('path-evac', 'k-evac', 'droga ewakuacyjna i jej długość według projektanta'); add('path-hose', 'k-hose', 'zasięg hydrantu według projektanta'); add('zone', 'k-zone', 'strefa pożarowa');
    Object.keys(SYM).forEach(function (k) { add('sym-' + k, 'k-sym.k-' + SYM[k].cls, (SYM[k].text ? SYM[k].text + (SYM[k].sub || '') + ' – ' : '') + SYM[k].legend); });
    Object.keys(AREA).forEach(function (k) { add('area-' + k, 'k-area.k-' + k, AREA[k]); });
    return out.length ? h('ul.dwg-legend', out) : null;
  }

  function mount(spec) {
    var svg = render(spec), F = svg._dw.F, L = svg._dw.layers, zoom = 1, measuring = false, mpts = [];
    var scroll = h('div.dwg-scroll', svg), read = h('span.dwg-read.num', ''), zlabel = h('span.small.muted.num', '100%');
    function setZoom(z) { zoom = Math.max(1, Math.min(6, z)); svg.style.width = (zoom * 100) + '%'; zlabel.textContent = Math.round(zoom * 100) + '%'; }
    function clearTool() { while (L.tool.firstChild) L.tool.removeChild(L.tool.firstChild); }
    function drawTool() {
      clearTool();
      if (mpts.length > 1) el('polyline', { points: pts(mpts), 'class': 'dw-measure' }, L.tool);
      mpts.forEach(function (p) { el('circle', { cx: X(p[0]), cy: X(p[1]), r: X(F * 0.22), 'class': 'dw-measure-pt' }, L.tool); });
      read.textContent = measuring ? (mpts.length > 1 ? 'Pomiar: ' + fmt(pathLen(mpts), 1) + ' m' : 'Klikaj kolejne punkty na rysunku') : '';
    }
    var mBtn = h('button.btn.sm', { type: 'button', 'aria-pressed': 'false', onclick: function () {
      measuring = !measuring; mpts = []; mBtn.setAttribute('aria-pressed', String(measuring)); mBtn.textContent = measuring ? 'Zakończ pomiar' : 'Zmierz odległość';
      scroll.classList.toggle('measuring', measuring); drawTool();
    } }, 'Zmierz odległość');
    svg.addEventListener('click', function (e) {
      if (!measuring) return;
      var m = svg.getScreenCTM(); if (!m) return;
      var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; p = p.matrixTransform(m.inverse());
      mpts.push([p.x / S, p.y / S]); drawTool();
    });
    var bar = h('div.dwg-bar',
      h('div.row', h('button.btn.sm', { type: 'button', 'aria-label': 'Pomniejsz', onclick: function () { setZoom(zoom / 1.5); } }, '−'), zlabel,
        h('button.btn.sm', { type: 'button', 'aria-label': 'Powiększ', onclick: function () { setZoom(zoom * 1.5); } }, '+'),
        h('button.btn.sm.ghost', { type: 'button', onclick: function () { setZoom(1); } }, 'Cały rysunek')),
      h('div.row', mBtn, h('button.btn.sm.ghost', { type: 'button', onclick: function () { mpts = []; drawTool(); } }, 'Wyczyść'), read));
    var box = h('div.dwg', bar, scroll, legend(svg));
    return {
      el: box, svg: svg,
      /* lista znaczników: [{n, at:[x,y], kind}] albo null, żeby je ukryć */
      setMarkers: function (list) {
        while (L.mark.firstChild) L.mark.removeChild(L.mark.firstChild);
        (list || []).forEach(function (m) {
          var g = el('g', { 'class': 'dw-marker dw-marker-' + (m.kind === 'poprawne' ? 'ok' : 'bad') }, L.mark), t;
          el('circle', { cx: X(m.at[0]), cy: X(m.at[1]), r: X(F * 1.05) }, g);
          t = el('text', { x: X(m.at[0]), y: X(m.at[1] + F * 0.38), 'text-anchor': 'middle', 'font-size': X(F * 1.05) }, g); t.textContent = String(m.n);
        });
      }
    };
  }

  P.drawing = { render: render, mount: mount, symbols: SYM, areas: AREA, pathLen: pathLen };
})();
