export const meta = {
  name: 'verify-block',
  description: 'Nocna weryfikacja klucza odpowiedzi dla jednego bloku tematycznego oraz ściąga i fiszki do lekcji tego bloku',
  phases: [
    { title: 'Klucz A', detail: 'odpowiedzi z tekstu źródeł' },
    { title: 'Klucz B', detail: 'niezależny drugi przebieg' },
    { title: 'Arbiter', detail: 'rozstrzyganie rozbieżności' },
    { title: 'Sceptyk', detail: 'próba obalenia całego klucza części, także odpowiedzi zgodnych' },
    { title: 'Lekcje', detail: 'ściąga, pytania ustne, fiszki' },
    { title: 'Kontrola lekcji', detail: 'sprawdzenie wartości w źródłach' },
  ],
}
const ROOT = args.root, W = ROOT + '/.work', RAW = ROOT + '/content/key/raw', B = args.block
const SRC = args.sources.map(s => `- ${W}/corpus/${s.file} — ${s.read}`).join('\n')
const NORMS = `NORMY (pliki ${W}/corpus/normy/*.txt): pierwsza linia pliku podaje numer normy, wydanie i stan (aktualna albo wycofana, z numerem wydania aktualnego). Gdy masz tylko wydanie wycofane: "ans" ustal według niego (tak pytała komisja), a "stan" wpisz "nieustalone" ze "stanNote": które wydanie sprawdzono i które jest aktualne — chyba że przepis rozporządzenia rozstrzyga sprawę niezależnie od normy. Pliki opisane jako „materiał pomocniczy” (streszczenia, wytyczne VdS) nie są źródłem: wolno z nich skorzystać jako ze wskazówki, pewność najwyżej „średnia”. Teksty norm są licencjonowane do użytku wewnętrznego: jako cytat podawaj najwyżej jedno zdanie z numerem punktu normy; w ściągach i fiszkach podawaj wartości własnymi słowami z numerem punktu, bez przepisywania akapitów i tablic w całości.`
const SUM = { type: 'object', properties: { ok: { type: 'boolean' },
  answers: { type: 'array', items: { type: 'object', properties: { id: { type: 'number' }, ans: { type: 'string', enum: ['a', 'b', 'c'] },
    conf: { type: 'string', enum: ['wysoka', 'średnia', 'niska'] }, ansNow: { type: 'string', enum: ['=', 'a', 'b', 'c', 'brak'] } }, required: ['id', 'ans', 'conf', 'ansNow'] } },
  skipped: { type: 'array', items: { type: 'number' } }, note: { type: 'string' } }, required: ['ok', 'answers', 'skipped'] }
const DONE = { type: 'object', properties: { ok: { type: 'boolean' }, files: { type: 'array', items: { type: 'string' } }, note: { type: 'string' } }, required: ['ok', 'files'] }
const SKEPTIC = { type: 'object', properties: { ok: { type: 'boolean' }, attacked: { type: 'number' },
  changedAns: { type: 'array', items: { type: 'number' } }, changedState: { type: 'array', items: { type: 'number' } },
  changedOther: { type: 'array', items: { type: 'number' } }, badQuotes: { type: 'array', items: { type: 'number' } },
  confirmed: { type: 'array', items: { type: 'number' } }, note: { type: 'string' } }, required: ['ok', 'attacked', 'changedAns', 'note'] }
const RULES = `
KONTEKST. Aplikacja do nauki do egzaminu na rzeczoznawcę do spraw zabezpieczeń przeciwpożarowych (KG PSP). Pytania testowe A/B/C pochodzą z egzaminów 2015–2026 (pole "sheet": arkusz 1 ≈ 2015 … 14 ≈ 2026); KG PSP nie publikuje klucza. Użytkownik uczy się z tych odpowiedzi do egzaminu zawodowego: błąd w kluczu to realna szkoda. Dzisiejszy stan prawny opisuje ${W}/corpus/INDEX.md (przeczytaj najpierw; m.in. WT z 2002 r. wygasły 21.09.2026 i są traktowane jako odniesienie).
BLOK: ${args.name}
ŹRÓDŁA BLOKU (tylko do odczytu; katalog ${W}/corpus):
${SRC}
ZASADA PRACY: pliki oznaczone „CAŁY” przeczytaj w całości narzędziem Read ZANIM zaczniesz odpowiadać, tak aby odpowiadać z tekstu, a nie z pamięci. W pozostałych szukaj (grep -n -i, potem Read właściwego zakresu linii wraz z sąsiednimi ustępami i wyjątkami). Inne akty są w ${W}/corpus/akty (lista w INDEX.md). Pliku, którego nie ma, po prostu nie używaj. WebSearch wolno użyć oszczędnie (ToolSearch "select:WebSearch") tylko dla szczegółów norm, których tekstu nie ma.
${NORMS}
DLA KAŻDEGO PYTANIA, na które da się odpowiedzieć ze źródeł tego bloku:
- "ans": odpowiedź poprawna wg aktu lub wydania normy, na które pytanie się powołuje albo które obowiązywały w czasie egzaminu (zamierzona przez komisję).
- "stan" / "ansNow" wg stanu na dziś: "aktualne" + "=" gdy dziś odpowiedź jest ta sama; "zmienione" + "a|b|c|brak" gdy dziś poprawna byłaby inna opcja lub wartość; "uchylone" gdy akt uchylono i następca nie ma odpowiednika; "nieustalone" gdy pytanie cytuje wycofane wydanie normy, a treści aktualnego wydania nie da się sprawdzić. Dla stan ≠ "aktualne" obowiązkowe "stanNote": co się zmieniło, jaki akt lub wydanie obowiązuje i jaka jest dzisiejsza wartość. Dla aktów uchylonych z następcą zawsze odszukaj odpowiednik w następcy.
- "conf": "wysoka" tylko gdy przepis wprost rozstrzyga i podajesz dosłowny cytat (pole "quote", z jednej linii pliku, ≥ 15 znaków) oraz plik w "src"; "średnia" gdy odpowiedź wynika z rozumowania lub obliczenia na podstawie znalezionych przepisów; "niska" gdy źródło nie rozstrzyga albo pytanie jest niejednoznaczne. Nie zawyżaj. Uważaj na wyjątki, negacje („nie wymaga się…”), progi („powyżej” a „co najmniej”) i obliczenia.
- "topic": jeden kod: P1 ustawa o ochronie ppoż./PSP/rzeczoznawcy/kontrole; P2 prawo budowlane, uzgadnianie, odstępstwa, rozwiązania zamienne, ekspertyzy; P3 wyroby; W1 WT klasyfikacja, odporność pożarowa i ogniowa, reakcja na ogień; W2 WT strefy pożarowe, oddzielenia, usytuowanie, dachy, ściany zewnętrzne; W3 WT ewakuacja; W4 WT instalacje, kotłownie, LPG, przepusty; W5 garaże; W6 budynki IN i budowle rolnicze; R1 rozp. 2010 część ogólna; R2 rozp. 2010 obowiązek SSP/DSO/SUG, hydranty wewnętrzne; H1 woda do zewnętrznego gaszenia, hydranty zewnętrzne, zbiorniki; H2 drogi pożarowe; U1 SSP; U2 DSO; U3 oświetlenie awaryjne i znaki; U4 tryskacze i urządzenia wodne; U5 SUG gazowe, pianowe, proszkowe; U6 wentylacja pożarowa; U7 instalacje elektryczne, kable, PWP, dźwigi; X1 zagrożenie wybuchem; S1 paliwa i gaz; S2 tunele, drogi; S3 metro; S4 odpady; S5 lasy; S6 przedszkola, żłobki; S7 imprezy, widownie; S8 poważne awarie; O1 obciążenie ogniowe, obliczenia; Z9 inne.
- "basis": zwięzła podstawa z jednostką redakcyjną (np. „§ 19 ust. 3 pkt 2 rozp. MSWiA z 7.06.2010”); "expl": 2–3 zdania po polsku dla uczącego się: reguła lub wartość, która rozstrzyga, i dlaczego kuszące odpowiedzi są błędne; bez ogólników; "norms": numery bazowe norm albo [].
PYTANIA SPOZA BLOKU (dotyczą aktu lub normy, których nie ma w źródłach bloku i nie znalazłeś ich w korpusie) pomiń: nie zapisuj ich w pliku, tylko wymień ich id w "skipped".
FORMAT PLIKU: lista obiektów {"id":1,"ans":"a","conf":"wysoka","ansNow":"=","stan":"aktualne","stanNote":"","topic":"R2","basis":"…","src":"akty/rozp_ppoz_2010.txt","quote":"…","expl":"…","norms":[]}.`
const solver = (part, v) => `Jesteś ekspertem ochrony przeciwpożarowej (poziom rzeczoznawcy). Ustal odpowiedzi do pytań z pliku ${W}/blocks/${B}/part_${part}.json (pola id, sheet, q, a, b, c). ${v === 'A'
  ? 'Pracuj w kolejności pytań.'
  : 'Pracuj od OSTATNIEGO pytania do pierwszego; przy każdym najpierw wskaż odpowiedź, a potem aktywnie poszukaj w tekście wyjątku lub przepisu, który jej przeczy.'} Pracujesz niezależnie: nie czytaj innych plików w ${RAW}.
${RULES}
ZAPISZ wynik do ${RAW}/${v}_${B}_${part}.json, potem uruchom i poprawiaj do skutku (lista id = pytania, na które odpowiedziałeś):
python3 ${ROOT}/tools/validate_batch.py ${RAW}/${v}_${B}_${part}.json ${W}/blocks/${B}/part_${part}.json --adj <id,id,…>
Zwróć: ok (walidator OK), answers [{id, ans, conf, ansNow}], skipped [id pominiętych], note (jedno zdanie).`
const judge = (part, ids, why) => `Jesteś arbitrem-ekspertem ochrony przeciwpożarowej. Dwóch niezależnych ekspertów (A i B) odpowiedziało na pytania z ${W}/blocks/${B}/part_${part}.json; poniższe są sporne. Rozstrzygnij je w źródłach — sprawdź, nie głosuj.
${RULES}
SPORNE (id → powód): ${why}
Wyniki A: ${RAW}/A_${B}_${part}.json, wyniki B: ${RAW}/B_${B}_${part}.json (przeczytaj ich basis, quote, expl dla spornych id; sprawdź grep, czy cytaty naprawdę są w plikach i dotyczą tego stanu faktycznego). Stary klucz z poprzedniej wersji quizu (słaba wskazówka, bez podstaw): ${ROOT}/content/questions.json, pola oldKey i oldConf.
Jeśli po rzetelnej próbie nie da się rozstrzygnąć, wybierz odpowiedź lepiej uzasadnioną, ustaw conf "niska" i napisz w "expl", na czym polega wątpliwość. Jeśli pytanie jest spoza bloku — pomiń je (skipped).
ZAPISZ wynik (ten sam format + pole "verdict": kto miał rację i dlaczego) do ${RAW}/J_${B}_${part}.json i uruchom:
python3 ${ROOT}/tools/validate_batch.py ${RAW}/J_${B}_${part}.json ${W}/blocks/${B}/part_${part}.json --adj <id rozstrzygnięte>
Zwróć: ok, answers, skipped, note.`
const author = id => `Opracuj ściągę, pytania do części ustnej i fiszki dla lekcji ${id} w aplikacji do nauki na rzeczoznawcę do spraw zabezpieczeń przeciwpożarowych. Opis lekcji (tytuł, focus, tematy, czytania, normy): ${ROOT}/content/plan.json — tydzień z polem "lesson": "${id}". Odbiorca: inżynier pożarnictwa uczący się do egzaminu testowego (+1/−1/0) i ustnego (praca z dokumentacją, 20 minut przygotowania, wolno korzystać z tekstów przepisów).
BLOK: ${args.name}
ŹRÓDŁA (katalog ${W}/corpus; stan prawny: ${W}/corpus/INDEX.md):
${SRC}
Pliki „CAŁY” przeczytaj w całości; z pozostałych właściwe paragrafy. Zobacz też, o co pytano na egzaminach: pliki ${W}/blocks/${B}/part_*.json (treść pytań) — z nich wynika, które liczby i wyjątki są sprawdzane.
ZASADA NADRZĘDNA: każda liczba, próg, klasa i wyjątek w ściądze i fiszkach musi pochodzić z przeczytanego tekstu źródła i mieć podaną jednostkę redakcyjną. Niczego nie dopisuj z pamięci. Jeśli lekcja obejmuje normę, której tekstu nie masz, napisz to wprost w "intro" i ogranicz się do tego, co wynika z przepisów oraz z treści pytań egzaminacyjnych (jako „o to pytano”), bez podawania wartości jako pewnych.
${NORMS}
PLIK 1: ${ROOT}/content/lessons/${id}.json — obiekt:
{"intro": "2–4 zdania: co obejmuje lekcja, stan prawny, na co uważać",
 "sections": [{"h": "nagłówek", "text": "akapity; linie zaczynające się od '- ' tworzą listę", "table": {"head": ["…"], "rows": [["…"]]}}],   // 4–8 sekcji; table opcjonalne; tabele dla progów i zestawień
 "keyValues": [{"label": "co", "value": "wartość", "ref": "§ … ust. …"}],   // 15–30 najważniejszych wartości do zapamiętania
 "traps": ["pułapka egzaminacyjna w jednym zdaniu, z podstawą"],   // 6–12, na podstawie rzeczywistych pytań
 "oral": [{"q": "pytanie otwarte lub krótki kazus jak przed komisją", "points": ["punkt odpowiedzi z podstawą"]}],   // 5–7
 "selfCheck": ["pytanie kontrolne do czytania aktywnego"]}   // 6–10
PLIK 2: ${ROOT}/content/flashcards/${id}.json — lista 25–40 fiszek: {"id": "${id}-01", "topic": "kod tematu z lekcji", "front": "pytanie o jedną rzecz", "back": "krótka odpowiedź", "ref": "§ … ust. …", "conf": "wysoka", "week": numer tygodnia}. Jedna fiszka = jeden fakt; bez pytań typu „wymień wszystkie”.
Styl: polski, rzeczowy, zdaniami; bez emoji i wykrzykników. Na koniec sprawdź poprawność JSON: python3 -c "import json;json.load(open('${ROOT}/content/lessons/${id}.json'));json.load(open('${ROOT}/content/flashcards/${id}.json'));print('ok')"
Zwróć: ok, files, note.`
const checker = id => `Sprawdź merytorycznie ściągę i fiszki lekcji ${id}: pliki ${ROOT}/content/lessons/${id}.json i ${ROOT}/content/flashcards/${id}.json. Są przeznaczone do nauki do egzaminu zawodowego, więc błędna liczba to realna szkoda.
ŹRÓDŁA (katalog ${W}/corpus):
${SRC}
Dla KAŻDEJ pozycji keyValues, każdej tabeli, każdej pułapki, każdego punktu odpowiedzi ustnej i każdej fiszki odszukaj podstawę w tekście źródła (grep + Read) i porównaj wartość, próg („powyżej” a „co najmniej”), jednostkę oraz numer paragrafu. Popraw błędy bezpośrednio w plikach. Pozycję, której nie da się potwierdzić w źródłach, usuń albo — gdy dotyczy normy bez dostępnego tekstu — oznacz: w fiszce "conf": "niska", w ściądze dopisek „(do sprawdzenia w normie)”. Nie dopisuj nowych treści z pamięci. Wartość wziętą z wycofanego wydania normy (pierwsza linia pliku normy podaje stan) zostaw, ale dopisz przy niej wydanie, z którego pochodzi, i numer wydania aktualnego; dłuższe dosłowne przepisanie tekstu normy zastąp omówieniem z numerem punktu. Zachowaj format plików i sprawdź JSON:
python3 -c "import json;json.load(open('${ROOT}/content/lessons/${id}.json'));json.load(open('${ROOT}/content/flashcards/${id}.json'));print('ok')"
Zwróć: ok, files, note (ile pozycji sprawdzono, poprawiono i usunięto).`

const skeptic = (part, cur) => `Jesteś sceptykiem-ekspertem ochrony przeciwpożarowej. Klucz do pytań z ${W}/blocks/${B}/part_${part}.json ustalili już dwaj niezależni eksperci (A, B) i arbiter (J). Twoje zadanie: spróbować go OBALIĆ, pytanie po pytaniu, także tam, gdzie A i B byli zgodni — wspólny błąd dwóch osób czytających ten sam przepis tak samo jest najgroźniejszy, bo nikt go nie wykryje.
${RULES}
OBECNY KLUCZ (id → odpowiedź; skąd): ${cur}
Uzasadnienia: ${RAW}/A_${B}_${part}.json, ${RAW}/B_${B}_${part}.json, ${RAW}/J_${B}_${part}.json (jeśli jest; dla id rozstrzygniętych przez arbitra liczy się J). Stary klucz z poprzedniej wersji quizu: ${ROOT}/content/questions.json, pola oldKey i oldConf (słaba wskazówka; tam, gdzie obecny klucz się od niego różni, odtwórz rozstrzygnięcie od zera).
DLA KAŻDEGO PYTANIA:
1. Przeczytaj treść pytania i wszystkie trzy odpowiedzi; zwróć uwagę na przeczenia w pytaniu („nie jest wymagane”, „nieprawdziwe”), progi („powyżej” a „co najmniej”), jednostki i to, czy inna opcja nie jest równie albo bardziej poprawna.
2. Sprawdź cytat: grep -n -F fragmentu w pliku "src". Cytat ma istnieć dosłownie i dotyczyć stanu faktycznego pytania (ten sam rodzaj obiektu, ten sam przypadek), a nie sąsiedniego przepisu.
3. Szukaj obalenia: przeczytaj cały paragraf z wyjątkami („nie stosuje się”, „dopuszcza się”, „z wyjątkiem”), przepisy szczególne w innych paragrafach, tabele załącznika; obliczenia przelicz samodzielnie.
4. Stan dzisiejszy: czy "stan" i "ansNow" są prawdziwe na dziś (akt uchylony, zmieniony, wydanie normy zastąpione; norma aktualna i wycofana są w źródłach, jeśli je dostarczono — porównaj wartości obu wydań).
5. Wyjaśnienie "expl" ma być poprawne i konkretne.
ZMIANY: do pliku ${RAW}/S_${B}_${part}.json zapisz listę obiektów w formacie jak wyżej (pełny obiekt, wszystkie pola) TYLKO dla pytań, w których coś zmieniasz (odpowiedź, stan, ansNow, pewność, cytat, podstawę albo wyjaśnienie), z dodatkowym polem "verdict": co było źle, dlaczego, z podstawą. Odpowiedź zmieniaj tylko wtedy, gdy masz podstawę w tekście; jeśli Twoje obalenie opiera się na rozumowaniu, a nie na wyraźnym przepisie, wpisz conf „średnia” albo „niska” i opisz wątpliwość w "expl" — wtedy pytanie zostanie oznaczone w aplikacji jako sporne. Gdy nic nie zmieniasz, zapisz pustą listę [].
Jeśli plik nie jest pusty, uruchom: python3 ${ROOT}/tools/validate_batch.py ${RAW}/S_${B}_${part}.json ${W}/blocks/${B}/part_${part}.json --adj <id zmienione> i poprawiaj do skutku.
Zwróć: ok, attacked (ile pytań sprawdziłeś), changedAns (id ze zmienioną odpowiedzią "ans"), changedState (id ze zmienionym stan/ansNow), changedOther (id z poprawionym cytatem, podstawą, pewnością lub wyjaśnieniem), badQuotes (id, w których cytatu nie było w pliku albo nie dotyczył pytania), confirmed (id, których nie udało się obalić), note (najważniejsze zmiany z podstawą i co pozostaje niepewne).`

const keyJob = pipeline(args.parts,
  async part => {
    const [A, Bv] = await parallel([
      () => agent(solver(part, 'A'), { label: `A:${B}:${part}`, phase: 'Klucz A', schema: SUM }),
      () => agent(solver(part, 'B'), { label: `B:${B}:${part}`, phase: 'Klucz B', schema: SUM }),
    ])
    return { A, Bv }
  },
  async (r, part) => {
    const am = new Map(((r.A && r.A.answers) || []).map(x => [x.id, x])), bm = new Map(((r.Bv && r.Bv.answers) || []).map(x => [x.id, x]))
    const ids = [...new Set([...am.keys(), ...bm.keys()])].sort((x, y) => x - y), disputed = [], why = []
    for (const id of ids) {
      const a = am.get(id), b = bm.get(id)
      let reason = null
      if (!a || !b) reason = `odpowiedział tylko ${a ? 'A' : 'B'} (${(a || b).ans}), drugi uznał pytanie za spoza bloku lub nie skończył`
      else if (a.ans !== b.ans) reason = `A=${a.ans}, B=${b.ans}`
      else if (a.ansNow !== b.ansNow) reason = `zgodni co do ${a.ans}, różnią się co do stanu dzisiejszego (A: ${a.ansNow}, B: ${b.ansNow})`
      else if (a.conf === 'niska' && b.conf === 'niska') reason = `obaj ${a.ans}, obaj z niską pewnością`
      if (reason) { disputed.push(id); why.push(`${id} → ${reason}`) }
    }
    let J = null
    if (disputed.length) J = await agent(judge(part, disputed, why.join('; ')), { label: `J:${B}:${part} (${disputed.length})`, phase: 'Arbiter', schema: SUM })
    const jm = new Map(((J && J.answers) || []).map(x => [x.id, x]))
    const cur = ids.map(id => {
      const j = jm.get(id), a = am.get(id), b = bm.get(id)
      if (j) return `${id} → ${j.ans} (J)`
      if (a && b && a.ans === b.ans) return `${id} → ${a.ans} (A i B zgodni)`
      if (a && b) return `${id} → sporne A=${a.ans}, B=${b.ans} (arbiter nie rozstrzygnął)`
      return `${id} → ${(a || b).ans} (tylko ${a ? 'A' : 'B'})`
    }).join('; ')
    return { part, a: am.size, b: bm.size, agreed: ids.length - disputed.length, disputed: disputed.length, jOk: disputed.length ? !!(J && J.ok) : null, cur, n: ids.length }
  },
  async (r, part) => {
    if (!r.n) return { ...r, cur: undefined, skeptic: null }
    const S = await agent(skeptic(part, r.cur), { label: `S:${B}:${part}`, phase: 'Sceptyk', schema: SKEPTIC })
    const { cur, ...rest } = r
    return { ...rest, skeptic: S }
  })
const lessonJob = pipeline(args.lessons || [],
  id => agent(author(id), { label: `lekcja:${id}`, phase: 'Lekcje', schema: DONE }),
  (r, id) => agent(checker(id), { label: `kontrola:${id}`, phase: 'Kontrola lekcji', schema: DONE }).then(c => ({ id, authored: !!(r && r.ok), checked: !!(c && c.ok), note: (c && c.note) || '' })))
const [key, lessons] = await Promise.all([keyJob, lessonJob])
return { block: B, key: key.filter(Boolean), lessons: lessons.filter(Boolean) }
