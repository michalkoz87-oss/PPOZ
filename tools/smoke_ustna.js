// Test modułu „Część ustna” w przeglądarce: lista, kazus, wszystkie karty, rysunki (zrzuty do obejrzenia), klucz ze znacznikami.
// Użycie: python3 -m http.server 8200 --directory app  oraz  node tools/smoke_ustna.js <katalog na zrzuty> [id kazusu ...]
const { chromium } = require('playwright');
const base = 'http://localhost:8200/index.html', shots = process.argv[2], only = process.argv.slice(3);
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, hh, scheme] of [[1280, 900, 'light'], [390, 844, 'dark']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: w > 1000 ? 2 : 1, colorScheme: scheme });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') errs.push('[' + w + '] console: ' + m.text().slice(0, 300)); });
    p.on('pageerror', e => errs.push('[' + w + '] pageerror: ' + String(e.message).slice(0, 300)));
    await p.goto(base + '#ustna');
    await p.waitForFunction(() => window.PPOZ && PPOZ.data && PPOZ.data.cases && document.querySelector('#view').children.length > 0, null, { timeout: 15000 });
    const ovf = async name => {
      await p.waitForTimeout(250);
      const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      console.log(w, name.padEnd(22), 'ovf=' + o); if (o > 1) errs.push('[' + w + '] ' + name + ': strona przewija się w poziomie o ' + o + ' px');
    };
    const tab = async label => { await p.click('.case-top .seg button:has-text("' + label + '")'); await p.waitForTimeout(250); };
    await ovf('lista'); await p.screenshot({ path: shots + '/' + w + '-lista.png', fullPage: true });
    const ids = await p.evaluate(() => PPOZ.data.cases.map(c => c.id));
    for (const id of ids.filter(i => !only.length || only.includes(i))) {
      await p.evaluate(() => { localStorage.clear(); });
      await p.evaluate(h => { location.hash = '#' + h; }, 'ustna-' + id);
      await p.waitForSelector('.case-top'); await ovf(id + ' zadanie');
      await p.screenshot({ path: shots + '/' + w + '-' + id + '-zadanie.png', fullPage: true });
      await tab('Opis'); await ovf(id + ' opis'); await p.screenshot({ path: shots + '/' + w + '-' + id + '-opis.png', fullPage: true });
      await tab('Rysunki'); await ovf(id + ' rysunki');
      const n = await p.evaluate(i => PPOZ.data.caseById[i].drawings.length, id);
      for (let k = 0; k < n; k++) {
        if (n > 1) { await p.click('#view .stack > .seg button >> nth=' + k); await p.waitForTimeout(250); }
        const box = await p.$('.dwg-scroll svg');
        const lost = await p.evaluate(() => Array.from(document.querySelectorAll('.dwg svg text')).filter(t => !t.textContent.trim()).length);
        if (lost) errs.push('[' + w + '] ' + id + ' rys. ' + (k + 1) + ': puste napisy: ' + lost);
        await box.screenshot({ path: shots + '/' + w + '-' + id + '-rys' + (k + 1) + '.png' });
      }
      if (w > 1000) { // pomiar: dwa kliknięcia na rysunku muszą dać odczyt w metrach
        await p.click('.dwg-bar button:has-text("Zmierz")');
        const bb = await (await p.$('.dwg-scroll svg')).boundingBox();
        await p.mouse.click(bb.x + bb.width * 0.3, bb.y + bb.height * 0.5); await p.mouse.click(bb.x + bb.width * 0.6, bb.y + bb.height * 0.5);
        const read = await p.innerText('.dwg-read'); console.log(w, (id + ' pomiar').padEnd(22), read);
        if (!/Pomiar: \d+,\d m/.test(read)) errs.push('[' + w + '] ' + id + ': pomiar nie działa: ' + read);
      }
      await tab('Moje uwagi'); await p.fill('textarea.case-notes', '1. Uwaga próbna.'); await p.waitForTimeout(700);
      await p.click('#view button:has-text("Odsłoń klucz")'); await p.click('.modal button:has-text("Odsłoń klucz")'); await p.waitForSelector('.case-find');
      await ovf(id + ' klucz');
      const segs = await p.$$('.case-find .seg button:first-child'); for (const s of segs.slice(0, 5)) await s.click();
      await p.screenshot({ path: shots + '/' + w + '-' + id + '-klucz.png', fullPage: true });
      const marks = await p.evaluate(() => document.querySelectorAll('.dw-marker').length);
      console.log(w, (id + ' znaczniki').padEnd(22), marks); if (!marks) errs.push('[' + w + '] ' + id + ': brak znaczników na rysunku w kluczu');
      for (let k = 0; k < n; k++) {
        if (n > 1) { await p.click('#view section .stack > .seg button >> nth=' + k); await p.waitForTimeout(250); }
        await (await p.$('.dwg-scroll svg')).screenshot({ path: shots + '/' + w + '-' + id + '-rys' + (k + 1) + '-klucz.png' });
      }
      await p.click('#view button:has-text("Zakończ i zapisz wynik")'); await p.waitForTimeout(400);
      const saved = await p.evaluate(i => { const s = JSON.parse(localStorage.getItem('ppoz:v1:notes')).cases[i]; return !!(s && s.done && s.revealed); }, id);
      if (!saved) errs.push('[' + w + '] ' + id + ': wynik nie zapisał się');
    }
    await ctx.close();
  }
  console.log('ERRORS', errs.length); errs.slice(0, 30).forEach(e => console.log(' ', e));
  await b.close();
})();
