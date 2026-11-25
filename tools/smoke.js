const { chromium } = require('playwright');
const fs = require('fs');
const base = 'http://localhost:8200/index.html', shots = process.argv[2];
const ROUTES = ['dzis', 'plan', 'metoda', 'nauka', 'lekcja-T03', 'pytania', 'egzamin', 'fiszki', 'zrodla', 'zrodla-normy', 'statystyki', 'ustawienia'];
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, hh, scheme] of [[1280, 800, 'light'], [390, 844, 'dark']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 1, colorScheme: scheme });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push('[' + w + '] console: ' + m.text().slice(0, 300)); });
    p.on('pageerror', e => errs.push('[' + w + '] pageerror: ' + String(e.message).slice(0, 300)));
    await p.goto(base + '#dzis');
    await p.waitForFunction(() => window.PPOZ && PPOZ.data && PPOZ.data.questions && document.querySelector('#view').children.length > 0, null, { timeout: 15000 });
    const step = async (name, fn) => {
      try {
        if (fn) await fn();
        await p.waitForTimeout(400);
        const info = await p.evaluate(() => ({ ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth, len: document.getElementById('view').innerText.length, bad: (document.querySelector('#view .banner.bad') || {}).innerText || '' }));
        console.log(w, name.padEnd(16), 'ovf=' + info.ovf, 'len=' + info.len, info.bad ? 'BAD:' + info.bad.slice(0, 160) : '');
        await p.screenshot({ path: shots + '/' + w + '-' + name + '.png' });
      } catch (e) { errs.push('[' + w + '] step ' + name + ': ' + String(e.message).slice(0, 200)); }
    };
    for (const r of ROUTES) await step(r, () => p.evaluate(h => { location.hash = '#' + h; }, r));
    await step('sesja-pytanie', () => p.evaluate(() => PPOZ.practice.start({ mode: 'nauka', filter: {}, n: 4, label: 'Test' })));
    await step('sesja-odpowiedz', async () => {
      await p.click('#view .opt');
      const btns = await p.$$('#view button');
      for (const x of btns) { const t = (await x.innerText()).toLowerCase(); if (t.includes('sprawdź') && t.includes('pewny')) { await x.click(); break; } }
    });
    await step('egzamin-przebieg', () => p.evaluate(() => PPOZ.practice.start({ mode: 'egzamin', sheet: 1 })));
    await step('fiszki-sesja', async () => {
      await p.evaluate(() => PPOZ.cardsUI.start({ filter: {}, n: 4 }));
      await p.waitForTimeout(300);
      const f = await p.$('#view .flash'); if (f) await f.click();
    });
    await ctx.close();
  }
  console.log('ERRORS', errs.length); errs.slice(0, 25).forEach(e => console.log(' ', e));
  const files = fs.readdirSync(shots).filter(f => f.endsWith('.png') && !f.startsWith('sheet'));
  for (const [w, cols, tw] of [[1280, 4, 400], [390, 8, 200]]) {
    const list = files.filter(f => f.startsWith(w + '-'));
    const cells = list.map(f => '<div><div style="background:#000;color:#fff;padding:1px 4px">' + f + '</div><img src="data:image/png;base64,' + fs.readFileSync(shots + '/' + f).toString('base64') + '" style="width:' + tw + 'px;display:block"></div>').join('');
    const html = '<body style="margin:0;background:#888;font:11px sans-serif"><div style="display:grid;grid-template-columns:repeat(' + cols + ',' + tw + 'px);gap:4px">' + cells + '</div></body>';
    const pg = await (await b.newContext({ viewport: { width: cols * (tw + 4), height: 600 }, deviceScaleFactor: 1 })).newPage();
    await pg.setContent(html); await pg.waitForTimeout(800); await pg.screenshot({ path: shots + '/sheet-' + w + '.png', fullPage: true });
  }
  await b.close();
})();
