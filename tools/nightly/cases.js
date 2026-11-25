export const meta = {
  name: 'kazusy-czesc-ustna',
  description: 'Kazusy części ustnej: dokumentacja z błędami i rysunkami, niezależne rozwiązanie bez klucza, kontrola klucza w przepisach',
  phases: [
    { title: 'Autor', detail: 'opis, rysunki, pytania i klucz na podstawie tekstu przepisów' },
    { title: 'Zdający', detail: 'niezależna ocena dokumentacji bez dostępu do klucza' },
    { title: 'Kontrola', detail: 'klucz i uwagi zdającego sprawdzone w źródłach, rysunki obejrzane' },
  ],
}
const ROOT = args.root, W = ROOT + '/.work', DATE = args.date
const SRC = args.sources.map(s => `- ${W}/corpus/${s.file} — ${s.read}`).join('\n')
const DONE = { type: 'object', properties: { ok: { type: 'boolean' }, file: { type: 'string' }, findings: { type: 'number' }, traps: { type: 'number' }, note: { type: 'string' } }, required: ['ok', 'file'] }
const SOLVED = { type: 'object', properties: { ok: { type: 'boolean' },
  findings: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, where: { type: 'string' }, is: { type: 'string' }, should: { type: 'string' },
    basis: { type: 'string' }, quote: { type: 'string' }, sure: { type: 'string', enum: ['pewne', 'prawdopodobne', 'wątpliwe'] } }, required: ['title', 'where', 'is', 'should', 'basis', 'sure'] } },
  unclear: { type: 'array', items: { type: 'string' } }, verdict: { type: 'string' } }, required: ['ok', 'findings', 'verdict'] }
const CHECKED = { type: 'object', properties: { ok: { type: 'boolean' }, keyConfirmed: { type: 'number' }, keyFixed: { type: 'number' }, keyRemoved: { type: 'number' },
  addedFromSolver: { type: 'number' }, unintendedFixed: { type: 'number' }, solverMatched: { type: 'number' }, drawingFixes: { type: 'number' }, note: { type: 'string' } }, required: ['ok', 'keyConfirmed', 'note'] }

const CONTEXT = `KONTEKST. Aplikacja do nauki do egzaminu na rzeczoznawcę do spraw zabezpieczeń przeciwpożarowych. Część ustna (§ 16 ust. 1 pkt 2 rozp. MSWiA z 2.12.2015) sprawdza samodzielną pracę z dokumentacją: ocenę zgodności rozwiązań projektowych z wymaganiami ochrony przeciwpożarowej, określanie rozwiązań zamiennych, sporządzanie ekspertyz. Zdający ma 20 minut i wolno mu korzystać z tekstów przepisów. Użytkownik ćwiczy na tych kazusach przed egzaminem zawodowym: błąd w kluczu to realna szkoda.
ŹRÓDŁA (tylko do odczytu; katalog ${W}/corpus; stan prawny opisuje INDEX.md):
${SRC}
Pliki oznaczone „CAŁY” przeczytaj w całości narzędziem Read, zanim cokolwiek ustalisz; w pozostałych szukaj (grep -n -i) i czytaj właściwy zakres wraz z sąsiednimi ustępami i wyjątkami. Jeśli istnieje ${W}/corpus/akty/wt_nowe.txt (nowe warunki techniczne ogłoszone w Dzienniku Ustaw), opieraj się na nim zamiast na wt_2002.txt i pisz "act": "wt_nowe". Teksty norm z ${W}/corpus/normy są licencjonowane: najwyżej jedno zdanie cytatu, wartości własnymi słowami z numerem punktu.`

const author = c => `Opracuj kazus ${c.id} do części ustnej: fikcyjny wyciąg z dokumentacji z celowymi błędami, rysunki, pytania komisji i klucz.
${CONTEXT}
TEMAT: ${c.title}. ${c.brief}
RODZAJ ZADANIA: ${c.task}
FORMAT I WZORZEC. Przeczytaj ${ROOT}/content/cases/README.md (format pliku i rysunków, zasady) oraz wzorzec ${ROOT}/content/cases/K01.json (poziom szczegółowości opisu, styl klucza, sposób rysowania). Nie kopiuj z niego treści ani układu budynku.
KOLEJNOŚĆ PRACY:
1. Przeczytaj źródła. Wypisz sobie wymagania, które dotyczą tego obiektu (kwalifikacja, odporność pożarowa, strefy, ewakuacja, urządzenia, gaśnice, droga pożarowa, woda, odległości, uzgodnienie), każde z jednostką redakcyjną i wartością.
2. Zaprojektuj obiekt zgodny z przepisami, z wymiarami w metrach. Dopiero potem wprowadź 10–14 zamierzonych usterek o różnej wadze oraz 2–3 rozwiązania poprawne, które wyglądają podejrzanie. Co najmniej 4 usterki mają być widoczne tylko na rysunkach (odległość, szerokość, kierunek otwierania drzwi, brak urządzenia, usytuowanie), co najmniej 3 tylko w opisie, 1–2 jako rozbieżność opisu z rysunkiem.
3. Wszystko, czego klucz nie wymienia, ma być zgodne z przepisami: przejdź listę wymagań z kroku 1 i sprawdź każde na własnym projekcie. Niezamierzona niezgodność to błąd kazusu.
4. Napisz plik ${ROOT}/content/cases/${c.id}.json. Opis ma brzmieć jak prawdziwy opis warunków ochrony przeciwpożarowej w projekcie (układ danych jak w § 4 rozp. MSWiA z 5.08.2023), łącznie z błędnymi uzasadnieniami projektanta. Co najmniej dwa rysunki: plan zagospodarowania terenu i rzut (przy obiekcie wielokondygnacyjnym rzut kondygnacji najważniejszej dla oceny).
5. Pytania komisji (6–8): idą przez kolejne działy oceny, a co najmniej dwa dotyczą trybu postępowania, rozwiązań zamiennych albo ekspertyzy (art. 6a–6d ustawy o ochronie przeciwpożarowej, art. 9 Prawa budowlanego, rozporządzenie o uzgadnianiu). Każdy punkt wzorcowej odpowiedzi z podstawą.
6. Sprawdź i obejrzyj:
python3 ${ROOT}/tools/validate_case.py ${ROOT}/content/cases/${c.id}.json
node ${ROOT}/tools/render_case.js ${ROOT}/content/cases/${c.id}.json ${W}/cases/${c.id}
Obejrzyj każdy PNG narzędziem Read: czy rysunek wygląda jak rysunek techniczny, czy napisy są czytelne i nie nachodzą na siebie ani na linie, czy drzwi otwierają się we właściwą stronę, czy wymiary i długości dróg z wypisu zgadzają się z opisem i kluczem. Poprawiaj i rysuj ponownie, aż będzie dobrze.
7. Zapisz wersję bez klucza dla niezależnego zdającego: python3 ${ROOT}/tools/nightly/case_strip.py ${ROOT}/content/cases/${c.id}.json ${W}/cases/${c.id}/task.json
ZASADA NADRZĘDNA: każda liczba, próg i podstawa prawna w kluczu pochodzi z tekstu aktu przeczytanego w tej sesji; "quote" to dosłowny fragment jednej linii pliku źródłowego. Niczego nie podawaj z pamięci. Jeśli wymaganie zależy od normy, której tekstu nie ma, nie rób z niego usterki.
Styl: polski, rzeczowy, zdaniami; bez emoji i wykrzykników; dane inwestora fikcyjne, bez nazwisk. W liczbach używaj przecinka dziesiętnego.
Zwróć: ok, file, findings (liczba usterek i braków), traps (liczba pozycji „poprawne”), note (na co kontroler powinien zwrócić uwagę).`

const solver = c => `Jesteś kandydatem na rzeczoznawcę do spraw zabezpieczeń przeciwpożarowych w części ustnej egzaminu. Komisja przekazała dokumentację: ${W}/cases/${c.id}/task.json (zadanie, opis, rysunki jako geometria w metrach, pytania) oraz rysunki ${W}/cases/${c.id}/${c.id}-*.png (oglądaj tylko pliki bez „-klucz” w nazwie). Opis formatu rysunków: ${ROOT}/content/cases/README.md.
NIE otwieraj pliku ${ROOT}/content/cases/${c.id}.json ani plików „-klucz”: zawierają klucz, a Twoja ocena ma być niezależna.
${CONTEXT}
ZADANIE: oceń zgodność dokumentacji z wymaganiami ochrony przeciwpożarowej tak rzetelnie, jak przy prawdziwym uzgodnieniu. Przejdź po kolei: kwalifikacja (grupa wysokości, ZL albo PM, liczba osób, strefy), odporność pożarowa i oddzielenia, ewakuacja (przejścia, dojścia, wyjścia, szerokości, klatki schodowe, kierunek otwierania drzwi), urządzenia przeciwpożarowe i instalacje, gaśnice, droga pożarowa, woda do zewnętrznego gaszenia, usytuowanie, kompletność danych, obowiązek uzgodnienia. Odległości i długości licz z geometrii rysunków (współrzędne w metrach), nie tylko z napisów.
Dla każdej niezgodności lub braku podaj: title, where (punkt opisu albo rysunek i miejsce), is (co jest w dokumentacji, z wartością), should (wymaganie z wartością), basis (jednostka redakcyjna), quote (dosłowny fragment przepisu z pliku źródłowego), sure (pewne / prawdopodobne / wątpliwe). Zgłaszaj tylko to, co wynika z przeczytanego tekstu przepisu; nie zgłaszaj rozwiązań zgodnych. W "unclear" wypisz miejsca, w których dokumentacja jest niejednoznaczna albo nie pozwala ocenić wymagania. W "verdict" napisz w 2–4 zdaniach, czy projekt można uzgodnić i co o tym przesądza.
Zwróć: ok, findings, unclear, verdict.`

const checker = (c, a, s) => `Sprawdź kazus ${c.id} do części ustnej przed publikacją: plik ${ROOT}/content/cases/${c.id}.json (dokumentacja z kluczem). Format i zasady: ${ROOT}/content/cases/README.md. Wzorzec jakości: ${ROOT}/content/cases/K01.json.
${CONTEXT}
UWAGI AUTORA: ${a && a.note ? a.note : 'brak'}
NIEZALEŻNY ZDAJĄCY ocenił dokumentację bez dostępu do klucza. Jego ustalenia (JSON):
${JSON.stringify(s && s.findings ? { findings: s.findings, unclear: s.unclear || [], verdict: s.verdict } : { findings: [], note: 'zdający nie zwrócił wyniku — sprawdź kazus samodzielnie ze szczególną starannością' })}
ZRÓB PO KOLEI:
1. Każdą pozycję klucza (findings) sprawdź w źródle: odszukaj przepis (grep + Read z sąsiednimi ustępami i wyjątkami), porównaj wartość, próg („powyżej” a „co najmniej”), warunki stosowania i jednostkę redakcyjną; sprawdź, czy "quote" występuje dosłownie w pliku. Sprawdź też, czy stan opisany w "is" naprawdę wynika z opisu albo z geometrii rysunku (policz odległości ze współrzędnych). Błędne pozycje popraw; pozycje, których nie da się obronić, usuń.
2. Pozycje „poprawne”: potwierdź w przepisie, że rozwiązanie jest zgodne.
3. Ustalenia zdającego, których nie ma w kluczu: każde rozstrzygnij w źródle. Jeśli zdający ma rację, to jest niezamierzona niezgodność: popraw dokumentację (opis albo rysunek), żeby była zgodna, albo — gdy usterka jest wartościowa dydaktycznie — dopisz ją do klucza. Jeśli zdający się myli, nic nie zmieniaj.
4. Pozycje klucza, których zdający nie zauważył: sprawdź, czy da się je wykryć z materiałów. Jeśli nie, uzupełnij opis albo rysunek tak, żeby były wykrywalne, bez podpowiadania.
5. Miejsca z "unclear": doprecyzuj dokumentację, jeśli niejasność nie jest zamierzona.
6. Punkty wzorcowych odpowiedzi na pytania komisji: każdą podstawę i wartość sprawdź w źródle tak samo jak klucz.
7. Rysunki: uruchom node ${ROOT}/tools/render_case.js ${ROOT}/content/cases/${c.id}.json ${W}/cases/${c.id} i obejrzyj wszystkie PNG narzędziem Read. Popraw nachodzące napisy, nieczytelne miejsca, źle skierowane drzwi, wymiary niezgodne z geometrią (chyba że to zamierzona usterka opisana w kluczu), znaczniki postawione na napisach.
8. Dopisz w pliku pole "review": {"date": "${DATE}", "solverFound": liczba pozycji klucza wskazanych przez zdającego, "issues": liczba usterek i braków po kontroli, "note": "jedno zdanie o tym, co poprawiono"}.
9. Na koniec: python3 ${ROOT}/tools/validate_case.py ${ROOT}/content/cases/${c.id}.json oraz ponownie render_case.js; oba mają przejść bez błędów.
Nie dopisuj treści z pamięci. Zachowaj format pliku i styl (polski, rzeczowy, bez emoji).
Zwróć: ok, keyConfirmed, keyFixed, keyRemoved, addedFromSolver, unintendedFixed, solverMatched, drawingFixes, note (co poprawiono i co pozostaje niepewne).`

const results = await pipeline(
  args.cases,
  c => c.recheck ? { ok: true, file: ROOT + '/content/cases/' + c.id + '.json', note: 'Kazus napisany wcześniej bez niezależnej kontroli; sprawdź go tak samo jak pozostałe.' }
    : agent(author(c), { label: 'autor:' + c.id, phase: 'Autor', schema: DONE }),
  (a, c) => a && a.ok ? agent(solver(c), { label: 'zdający:' + c.id, phase: 'Zdający', schema: SOLVED }).then(s => ({ a, s })) : { a, s: null },
  (r, c) => r.a && r.a.ok ? agent(checker(c, r.a, r.s), { label: 'kontrola:' + c.id, phase: 'Kontrola', schema: CHECKED }).then(k => ({ id: c.id, author: r.a, solver: r.s ? { findings: (r.s.findings || []).length, verdict: r.s.verdict } : null, check: k })) : { id: c.id, author: r.a, solver: null, check: null }
)
const done = results.filter(r => r && r.check && r.check.ok).map(r => r.id)
log('Kazusy po kontroli: ' + (done.join(', ') || 'brak'))
return { done, results }
