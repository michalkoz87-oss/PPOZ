export const meta = {
  name: 'kazusy-czesc-ustna',
  description: 'Kazusy części ustnej: dokumentacja z błędami i rysunkami, dwóch niezależnych zdających bez klucza, kontrola w przepisach i próba obalenia klucza',
  phases: [
    { title: 'Autor', detail: 'opis, rysunki, pytania i klucz na podstawie tekstu przepisów' },
    { title: 'Zdający', detail: 'dwie niezależne oceny bez klucza: jedna od przepisów, druga od rysunków' },
    { title: 'Kontrola przepisów', detail: 'klucz, pozycje poprawne, odpowiedzi wzorcowe i uwagi zdających sprawdzone w źródłach' },
    { title: 'Próba obalenia', detail: 'sceptyk szuka wyjątków i błędnych liczb, ogląda rysunki i zamyka kontrolę polem review' },
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
  addedFromSolver: { type: 'number' }, unintendedFixed: { type: 'number' }, foundA: { type: 'number' }, foundB: { type: 'number' }, foundAny: { type: 'number' },
  drawingFixes: { type: 'number' }, note: { type: 'string' } }, required: ['ok', 'keyConfirmed', 'note'] }
const SKEPTIC = { type: 'object', properties: { ok: { type: 'boolean' }, attacked: { type: 'number' }, refuted: { type: 'number' }, fixed: { type: 'number' }, removed: { type: 'number' },
  trapsWrong: { type: 'number' }, unintendedFixed: { type: 'number' }, answersFixed: { type: 'number' }, drawingFixes: { type: 'number' },
  solverFound: { type: 'number' }, issues: { type: 'number' }, note: { type: 'string' } }, required: ['ok', 'attacked', 'refuted', 'note'] }

const CONTEXT = `KONTEKST. Aplikacja do nauki do egzaminu na rzeczoznawcę do spraw zabezpieczeń przeciwpożarowych. Część ustna (§ 16 ust. 1 pkt 2 rozp. MSWiA z 2.12.2015) sprawdza samodzielną pracę z dokumentacją: ocenę zgodności rozwiązań projektowych z wymaganiami ochrony przeciwpożarowej, określanie rozwiązań zamiennych, sporządzanie ekspertyz. Zdający ma 20 minut i wolno mu korzystać z tekstów przepisów. Użytkownik ćwiczy na tych kazusach przed egzaminem zawodowym: błąd w kluczu to realna szkoda.
ŹRÓDŁA (tylko do odczytu; katalog ${W}/corpus; stan prawny opisuje INDEX.md):
${SRC}
Pliki oznaczone „CAŁY” przeczytaj w całości narzędziem Read, zanim cokolwiek ustalisz; w pozostałych szukaj (grep -n -i) i czytaj właściwy zakres wraz z sąsiednimi ustępami i wyjątkami. Jeśli istnieje ${W}/corpus/akty/wt_nowe.txt (nowe warunki techniczne ogłoszone w Dzienniku Ustaw), opieraj się na nim zamiast na wt_2002.txt i pisz "act": "wt_nowe". Teksty norm z ${W}/corpus/normy są licencjonowane: najwyżej jedno zdanie cytatu, wartości własnymi słowami z numerem punktu.`

const LESSONS = `TYPOWE BŁĘDY Z WCZEŚNIEJSZYCH KAZUSÓW (każdy przeszedł przez autora, a część także przez zdającego):
- Pominięte wyjątki i zwolnienia. Przykład: § 12 ust. 7 rozp. z 2009 r. wyłącza § 12 ust. 2 (w tym zakaz drzew wyższych niż 3 m) dla budynku do 3 kondygnacji i 12 m z utwardzonym dojściem; drzewa wpisane jako usterka były zgodne. Przy każdym wymaganiu czytaj cały paragraf i paragrafy „nie stosuje się”, „dopuszcza się”, „z wyjątkiem”.
- Przepis dodany zmianą, którego nie ma w tekście jednolitym (np. § 12 ust. 11 WT — 30 m od budynku produkcyjnego lub magazynowego ponad 1000 m² — dodany rozporządzeniem Dz.U. 2023 poz. 2442, w mocy od 1.08.2024): sprawdź koniec pliku i INDEX.md, zanim powołasz albo pominiesz przepis.
- Odległości między budynkami zależą od klasy odporności ogniowej ścian i udziału otworów (§ 271 ust. 1, 5, 8 i 12, § 232 ust. 2), a nie tylko od tabeli: sprawdź klasę E ściany z tabeli § 216 ust. 1.
- Brzmienie obowiązku w odpowiedziach wzorcowych: art. 6e ustawy — komendant „unieważnia” uzgodnienie (obowiązek), nie „może unieważnić”. Cytuj czasownik z przepisu.
- Długości i zasięgi liczone w linii prostej zamiast po rzeczywistej drodze (między regałami, przez drzwi); liczby w opisie różne od geometrii (29 m w opisie, 29,8 m z rysunku).
- Brak w opisie danych potrzebnych do rozstrzygnięcia (jednoczesny pobór z dwóch hydrantów, sieć obwodowa i ciśnienie, udział okien w ścianie, obszar, dla którego liczono gęstość obciążenia ogniowego, dach albo strop nad ostatnią kondygnacją): zdający nie może wtedy ocenić wymagania, a ocena zależy od domysłu.
- Rysunek niezgodny z opisem bez zamiaru (spocznik 0,4 m na rzucie przy 1,50 m w opisie, droga pożarowa z ostrym narożnikiem przy opisanym łuku, brak dojścia od wyjścia do drogi pożarowej, gaśnica przy źródle ciepła, korony drzew narysowane mniejsze niż w opisie); symbole nachodzące na siebie albo stojące w świetle drzwi.
- Cytat urwany tak, że zmienia sens: „mniejszej jednak niż 10 dm3/s” bez poprzedzającego „nie”. Cytuj całe zdanie albo całą jednostkę redakcyjną z przeczeniem i warunkiem.
- Niepełna lista wyjątków: „wyjątek tylko dla zabytków”, a § 211 ust. 2 wyłącza też budynki na terenie zakładów karnych i aresztów śledczych. Nie pisz „jedynym wyjątkiem”, jeśli nie przeczytałeś całego przepisu.
- Naprawa, która tworzy nową niezgodność: nowe wyjście bez dojścia do drogi i z utratą zwolnienia z § 12 ust. 7 rozp. z 2009 r.; drzwi przestawione na korytarz, których skrzydło mija się ze skrzydłem sąsiednich drzwi (§ 242 ust. 4). Sprawdź każdą proponowaną naprawę tymi samymi przepisami co usterkę.
- Dane w opisie niezgodne z przepisami spoza ochrony ppoż. (lokal użytkowy 24,7 m² przy minimum 25 m² z § 56a WT): komisja to zauważy i odciągnie uwagę od tematu kazusu.`

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
${LESSONS}\nZASADA NADRZĘDNA: każda liczba, próg i podstawa prawna w kluczu pochodzi z tekstu aktu przeczytanego w tej sesji; "quote" to dosłowny fragment jednej linii pliku źródłowego. Niczego nie podawaj z pamięci. Jeśli wymaganie zależy od normy, której tekstu nie ma, nie rób z niego usterki.
Styl: polski, rzeczowy, zdaniami; bez emoji i wykrzykników; dane inwestora fikcyjne, bez nazwisk. W liczbach używaj przecinka dziesiętnego.
Zwróć: ok, file, findings (liczba usterek i braków), traps (liczba pozycji „poprawne”), note (na co kontroler powinien zwrócić uwagę).`

const LENS = {
  A: `SPOSÓB PRACY: zacznij od przepisów. Ułóż listę wymagań dla tego obiektu w kolejności oceny i sprawdź każde w dokumentacji: kwalifikacja (grupa wysokości, ZL albo PM, liczba osób, strefy), odporność pożarowa i oddzielenia, ewakuacja (przejścia, dojścia, wyjścia, szerokości, klatki schodowe, kierunek otwierania drzwi), urządzenia przeciwpożarowe i instalacje, gaśnice, droga pożarowa, woda do zewnętrznego gaszenia, usytuowanie, kompletność danych, obowiązek uzgodnienia. Odległości i długości licz z geometrii rysunków (współrzędne w metrach), nie tylko z napisów.`,
  B: `SPOSÓB PRACY: zacznij od rysunków. Napisz krótki skrypt (w katalogu ${W}/cases/CASE/calc-B/), który z geometrii w task.json wypisze wymiary pomieszczeń, szerokości korytarzy, drzwi i biegów, kierunki otwierania drzwi, położenie urządzeń, długości dróg (po rzeczywistej trasie, z ominięciem ścian i regałów), odległości od granic działek, sąsiednich budynków, drogi pożarowej i hydrantów. Porównaj każdą liczbę z opisem i z napisami na rysunku; rozbieżności opisu z rysunkiem to osobne ustalenia. Dopiero potem przejdź po przepisach: kwalifikacja, odporność pożarowa, ewakuacja, urządzenia, gaśnice, droga pożarowa, woda, usytuowanie, uzgodnienie.`,
}
const solver = (c, who) => `Jesteś kandydatem na rzeczoznawcę do spraw zabezpieczeń przeciwpożarowych w części ustnej egzaminu. Komisja przekazała dokumentację: ${W}/cases/${c.id}/task.json (zadanie, opis, rysunki jako geometria w metrach, pytania) oraz rysunki ${W}/cases/${c.id}/${c.id}-*.png (oglądaj tylko pliki bez „-klucz” w nazwie). Opis formatu rysunków: ${ROOT}/content/cases/README.md.
NIE otwieraj pliku ${ROOT}/content/cases/${c.id}.json, plików „-klucz” ani katalogów calc-* innych osób: zawierają klucz albo cudzą ocenę, a Twoja ocena ma być niezależna.
${CONTEXT}
ZADANIE: oceń zgodność dokumentacji z wymaganiami ochrony przeciwpożarowej tak rzetelnie, jak przy prawdziwym uzgodnieniu.
${LENS[who].replace('CASE', c.id)}
Przy każdym wymaganiu przeczytaj cały paragraf z wyjątkami i zwolnieniami, zanim uznasz rozwiązanie za niezgodne.
Dla każdej niezgodności lub braku podaj: title, where (punkt opisu albo rysunek i miejsce), is (co jest w dokumentacji, z wartością), should (wymaganie z wartością), basis (jednostka redakcyjna), quote (dosłowny fragment przepisu z pliku źródłowego), sure (pewne / prawdopodobne / wątpliwe). Zgłaszaj tylko to, co wynika z przeczytanego tekstu przepisu; nie zgłaszaj rozwiązań zgodnych. W "unclear" wypisz miejsca, w których dokumentacja jest niejednoznaczna albo nie pozwala ocenić wymagania. W "verdict" napisz w 2–4 zdaniach, czy projekt można uzgodnić i co o tym przesądza.
Zwróć: ok, findings, unclear, verdict.`

const solverJSON = sv => {
  const out = []
  for (const who of ['A', 'B']) {
    const s = sv[who]
    if (s && s.findings) out.push({ who, findings: s.findings, unclear: s.unclear || [], verdict: s.verdict })
    else out.push({ who, note: 'ten zdający nie zwrócił wyniku' })
  }
  return JSON.stringify(out)
}

const checker = (c, a, sv) => `Sprawdź w przepisach kazus ${c.id} do części ustnej przed publikacją: plik ${ROOT}/content/cases/${c.id}.json (dokumentacja z kluczem). Format i zasady: ${ROOT}/content/cases/README.md. Wzorzec jakości: ${ROOT}/content/cases/K01.json.
${CONTEXT}
UWAGI AUTORA: ${a && a.note ? a.note : 'brak'}
DWÓCH NIEZALEŻNYCH ZDAJĄCYCH oceniło dokumentację bez dostępu do klucza: A zaczynał od przepisów, B od rysunków i pomiarów z geometrii. Ich ustalenia (JSON, pole "who"):
${solverJSON(sv)}
ZRÓB PO KOLEI:
1. Każdą pozycję klucza (findings) sprawdź w źródle: odszukaj przepis (grep + Read z sąsiednimi ustępami, wyjątkami i zwolnieniami), porównaj wartość, próg („powyżej” a „co najmniej”), warunki stosowania i jednostkę redakcyjną; sprawdź, czy "quote" występuje dosłownie w pliku. Sprawdź też, czy stan opisany w "is" naprawdę wynika z opisu albo z geometrii rysunku (policz odległości ze współrzędnych). Błędne pozycje popraw; pozycje, których nie da się obronić, usuń.
2. Pozycje „poprawne”: potwierdź w przepisie, że rozwiązanie jest zgodne.
3. Ustalenia zdających, których nie ma w kluczu: każde rozstrzygnij w źródle. Jeśli zdający ma rację, to jest niezamierzona niezgodność: popraw dokumentację (opis albo rysunek), żeby była zgodna, albo — gdy usterka jest wartościowa dydaktycznie — dopisz ją do klucza. Jeśli zdający się myli, nic nie zmieniaj. Zgodne ustalenia obu zdających, których nie ma w kluczu, traktuj ze szczególną uwagą.
4. Pozycje klucza, których nie wskazał żaden zdający: sprawdź, czy da się je wykryć z materiałów. Jeśli nie, uzupełnij opis albo rysunek tak, żeby były wykrywalne, bez podpowiadania.
5. Miejsca z "unclear": doprecyzuj dokumentację, jeśli niejasność nie jest zamierzona.
6. Punkty wzorcowych odpowiedzi na pytania komisji: każdą podstawę, wartość i brzmienie obowiązku („musi”, „może”) sprawdź w źródle tak samo jak klucz.
7. Po zmianach: python3 ${ROOT}/tools/validate_case.py ${ROOT}/content/cases/${c.id}.json ma przejść bez błędów. Rysunki zostaw do następnego etapu, chyba że poprawka dokumentacji wymaga zmiany geometrii. Pola "review" nie dopisuj: dopisze je kontroler w ostatnim etapie.
Nie dopisuj treści z pamięci. Zachowaj format pliku i styl (polski, rzeczowy, bez emoji).
Zwróć: ok, keyConfirmed, keyFixed, keyRemoved, addedFromSolver, unintendedFixed, foundA i foundB (ile pozycji klucza po kontroli wskazał każdy zdający), foundAny (ile wskazał co najmniej jeden), drawingFixes, note (co poprawiono, które pozycje klucza wskazał który zdający, co pozostaje niepewne).`

const skeptic = (c, sv, k) => `Jesteś drugim, niezależnym kontrolerem kazusu ${c.id} do części ustnej: plik ${ROOT}/content/cases/${c.id}.json. Format: ${ROOT}/content/cases/README.md. Pierwszy kontroler sprawdził już klucz w przepisach; Twoim zadaniem jest spróbować go obalić, zanim kazus trafi do użytkownika. Domyślnie zakładaj, że każda pozycja może być błędna, dopóki nie sprawdzisz jej sam w tekście przepisu i w geometrii.
${CONTEXT}
${LESSONS}
NOTATKA PIERWSZEGO KONTROLERA: ${k && k.note ? k.note : 'kontrola przepisów nie zwróciła wyniku — wykonaj ją sam w pełnym zakresie (każda pozycja klucza, pozycje poprawne, odpowiedzi wzorcowe, ustalenia zdających)'}
USTALENIA ZDAJĄCYCH (bez dostępu do klucza; A od przepisów, B od rysunków):
${solverJSON(sv)}
ZRÓB PO KOLEI:
1. Liczby. Napisz skrypt (w ${W}/cases/${c.id}/calc-S/), który z geometrii rysunków w pliku kazusu policzy wszystkie wielkości użyte w opisie, kluczu i odpowiedziach wzorcowych: długości dróg po rzeczywistej trasie, odległości, szerokości, powierzchnie, zasięgi. Każdą różnicę ponad 0,1 m albo 1% wyjaśnij: zamierzona usterka opisana w kluczu albo błąd kazusu do poprawy.
2. Każda pozycja klucza (błąd, brak, niespójność): szukaj powodu, dla którego jest NIEPRAWDZIWA — wyjątku, zwolnienia, innej kwalifikacji obiektu, innego progu, przepisu zmienionego albo dodanego później, warunku, którego obiekt nie spełnia. Przeczytaj cały paragraf i powiązane przepisy innych aktów. Jeśli pozycja upada albo wymaga zmiany, popraw ją albo usuń (usuniętą przenieś do pozycji „poprawne”, jeśli to dobry podchwytliwy przykład).
3. Każda pozycja „poprawne”: szukaj powodu, dla którego rozwiązanie jednak jest niezgodne.
4. Reszta dokumentacji: przejdź kategorie oceny (kwalifikacja, odporność, strefy, ewakuacja, urządzenia, gaśnice, droga pożarowa, woda, usytuowanie, uzgodnienie) i szukaj niezgodności, których nie ma w kluczu ani u zdających. Niezamierzoną niezgodność usuń z dokumentacji albo dopisz do klucza, jeśli jest wartościowa dydaktycznie.
5. Odpowiedzi wzorcowe: podstawy, wartości i brzmienie obowiązku z przepisu.
6. Rysunki: node ${ROOT}/tools/render_case.js ${ROOT}/content/cases/${c.id}.json ${W}/cases/${c.id} i obejrzyj wszystkie PNG narzędziem Read. Popraw nachodzące napisy, nieczytelne miejsca, źle skierowane drzwi, wymiary niezgodne z geometrią (chyba że to zamierzona usterka opisana w kluczu), znaczniki postawione na napisach, elementy bez podpisu.
7. Dopisz w pliku pole "review": {"date": "${DATE}", "solverFound": liczba usterek i braków po kontroli (bez pozycji „poprawne”) wskazanych przez co najmniej jednego zdającego, "solverFoundA": to samo dla zdającego A, "solverFoundB": to samo dla zdającego B, "issues": liczba usterek i braków po kontroli, "refuted": liczba pozycji klucza i pozycji „poprawne”, które zmieniłeś albo usunąłeś w tym etapie, "note": "jedno zdanie o tym, co poprawiono w obu kontrolach"}. Dopisz je tylko wtedy, gdy po Twojej kontroli kazus nadaje się do nauki; jeśli nie, zostaw plik bez "review" i opisz powód w note.
8. Na koniec: python3 ${ROOT}/tools/validate_case.py ${ROOT}/content/cases/${c.id}.json oraz ponownie render_case.js; oba mają przejść bez błędów.
Nie dopisuj treści z pamięci. Zachowaj format pliku i styl (polski, rzeczowy, bez emoji).
Zwróć: ok (czy kazus ma pole review), attacked (ile pozycji klucza i „poprawne” sprawdziłeś), refuted (ile zmieniłeś albo usunąłeś), fixed, removed, trapsWrong, unintendedFixed, answersFixed, drawingFixes, solverFound, issues, note (co zmieniłeś i dlaczego, z podstawą, oraz co pozostaje niepewne).`

const results = await pipeline(
  args.cases,
  c => c.recheck ? { ok: true, file: ROOT + '/content/cases/' + c.id + '.json', note: 'Kazus napisany wcześniej bez niezależnej kontroli; sprawdź go tak samo jak pozostałe.' }
    : agent(author(c), { label: 'autor:' + c.id, phase: 'Autor', schema: DONE }),
  (a, c) => a && a.ok
    ? parallel(['A', 'B'].map(who => () => agent(solver(c, who), { label: 'zdający ' + who + ':' + c.id, phase: 'Zdający', schema: SOLVED })))
        .then(([A, B]) => ({ a, sv: { A, B } }))
    : { a, sv: null },
  (r, c) => r.sv
    ? agent(checker(c, r.a, r.sv), { label: 'przepisy:' + c.id, phase: 'Kontrola przepisów', schema: CHECKED }).then(k => ({ ...r, k }))
    : { ...r, k: null },
  (r, c) => {
    const base = { id: c.id, author: r.a,
      solvers: r.sv ? { A: r.sv.A ? r.sv.A.findings.length : null, B: r.sv.B ? r.sv.B.findings.length : null, verdictA: r.sv.A && r.sv.A.verdict, verdictB: r.sv.B && r.sv.B.verdict } : null,
      check: r.k }
    if (!r.sv) return { ...base, skeptic: null }
    return agent(skeptic(c, r.sv, r.k), { label: 'sceptyk:' + c.id, phase: 'Próba obalenia', schema: SKEPTIC }).then(x => ({ ...base, skeptic: x }))
  },
)
const done = results.filter(r => r && r.skeptic && r.skeptic.ok).map(r => r.id)
const dropped = results.map((r, i) => r && r.skeptic && r.skeptic.ok ? null : args.cases[i].id).filter(Boolean)
log('Kazusy po kontroli: ' + (done.join(', ') || 'brak') + (dropped.length ? ' | bez pola review (nie publikować): ' + dropped.join(', ') : ''))
return { done, dropped, results }
