// Rysuje rysunki kazusu do plików PNG bez budowania aplikacji i bez serwera (do oglądania przy pisaniu i sprawdzaniu kazusów).
// Użycie: node tools/render_case.js <content/cases/K02.json> <katalog wyjściowy>
// Powstają: <id>-<rysunek>.png (czysty), <id>-<rysunek>-klucz.png (ze znacznikami usterek) oraz wypis długości dróg i wymiarów do kontroli.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [file, out] = process.argv.slice(2);
const root = path.join(__dirname, '..', 'app');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
(async () => {
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5 })).newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' + read('css/app.css') + read('css/v-ustna.css') + 'body{background:#fff;padding:0;margin:0}#box{width:1500px}</style></head><body><div id="box"></div></body></html>');
  await p.addScriptTag({ content: read('js/core.js') });
  await p.addScriptTag({ content: read('js/drawing.js') });
  for (const d of c.drawings) {
    for (const key of [false, true]) {
      const info = await p.evaluate(([d, marks]) => {
        const box = document.getElementById('box'); box.innerHTML = '';
        const m = PPOZ.drawing.mount(d); if (marks) m.setMarkers(marks);
        box.appendChild(m.svg);
        const bad = Array.from(m.svg.querySelectorAll('*')).filter(e => Array.from(e.attributes).some(a => /NaN|undefined/.test(a.value))).length;
        return { bad, texts: m.svg.querySelectorAll('text').length };
      }, [d, key ? c.findings.map((f, i) => f.marker && f.marker.d === d.id ? { n: i + 1, at: f.marker.at, kind: f.kind } : null).filter(Boolean) : null]);
      if (info.bad) errs.push(d.id + ': elementy z błędnymi współrzędnymi: ' + info.bad);
      await (await p.$('#box svg')).screenshot({ path: path.join(out, c.id + '-' + d.id + (key ? '-klucz' : '') + '.png') });
    }
    const len = pts => pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);
    for (const it of d.items) {
      if (it.t === 'path') console.log(d.id, 'droga', JSON.stringify(it.label || ''), 'długość z geometrii:', len(it.pts).toFixed(2), 'm');
      if (it.t === 'dim' && it.text) {
        const g = len([it.a, it.b]), s = parseFloat(String(it.text).replace(',', '.'));
        if (isFinite(s) && Math.abs(s - g) > 0.051) console.log(d.id, 'UWAGA wymiar', JSON.stringify(it.text), 'różni się od geometrii:', g.toFixed(2), 'm');
      }
    }
  }
  console.log(errs.length ? 'BŁĘDY:\n  ' + errs.join('\n  ') : 'rysunki zapisane w ' + out);
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
