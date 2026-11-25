# Kazusy części ustnej: dokumentacja do oceny

Jeden plik `K??.json` to jedno zadanie z części ustnej egzaminu (§ 16 ust. 1 pkt 2 rozporządzenia MSWiA z 2.12.2015):
wyciąg z dokumentacji z celowymi błędami, rysunki, pytania komisji i klucz. Wzorzec: `K01.json`.

Sprawdzenie formy: `python3 tools/validate_case.py content/cases/K02.json`.
Podgląd rysunków: `node tools/render_case.js content/cases/K02.json <katalog>` (PNG czyste i ze znacznikami; wypisuje też
długości dróg ewakuacyjnych z geometrii i wymiary niezgodne z geometrią). Rysunki trzeba obejrzeć, nie wystarczy, że się narysowały.

## Zasady merytoryczne

- Każda liczba i każda podstawa prawna w kluczu pochodzi z przeczytanego tekstu aktu. Podstawa zawsze z jednostką redakcyjną.
- Usterka musi być rozstrzygalna: z opisu albo rysunku wynika wartość, a z przepisu wymaganie. Bez spraw zależnych od uznania.
- Dokumentacja nie może zawierać niezamierzonych niezgodności. Wszystko, czego klucz nie wymienia, ma być zgodne z przepisami.
- Co najmniej dwie pozycje „poprawne”: rozwiązania zgodne, które wyglądają podejrzanie (wartość tuż przy progu, brak urządzenia,
  które nie jest wymagane).
- Część usterek ma wynikać tylko z rysunku (odległość, szerokość, kierunek otwierania drzwi, brak urządzenia), część tylko z opisu,
  część z rozbieżności między nimi.
- Wymagania z warunków technicznych z 2002 r. oznacz `"act": "wt_2002"` (rozporządzenie wygasło 21.09.2026 i jest stosowane
  przejściowo; po ogłoszeniu nowych przepisów te pozycje będą sprawdzane ponownie).
- Dane inwestora i adres są fikcyjne i ogólne. Bez nazwisk.
- Z tekstów norm najwyżej jedno zdanie cytatu; wartości własnymi słowami z numerem punktu normy.

## Pola kazusu

| Pole | Treść |
|---|---|
| `id`, `title`, `lead`, `tags`, `level` | `K02`; tytuł; jedno zdanie zachęty; 3–5 etykiet; trudność 1–3 |
| `topics` | kody tematów z `content/topics.json` |
| `legal` | uwaga o stanie prawnym (jak w K01, gdy klucz opiera się na WT z 2002 r.) |
| `problem` | zadanie komisji, 2–4 zdania; akapity rozdzielone `\n` |
| `doc` | `title`, `meta` (pary etykieta–wartość), `sections`: `{no, h, text, table:{head, rows}}`; w `text` linie od `- ` tworzą listę |
| `drawings` | co najmniej dwa rysunki (zwykle plan zagospodarowania i rzut), format niżej |
| `questions` | 6–8 pytań komisji: `{id, kind, q, points:[{t, basis}]}`; `kind`: `ocena`, `zamienne`, `ekspertyza`, `procedura` |
| `findings` | klucz: `{id, kind, weight, act, where, title, is, should, basis, quote, fix, marker:{d, at:[x,y]}}` |
| `summary` | wniosek końcowy: czy projekt można uzgodnić i co o tym przesądza |

`findings.kind`: `błąd`, `brak`, `niespójność` albo `poprawne`. `weight`: 3 = przesądza o braku zgodności, 2 = istotna, 1 = drobna.
Kilka podstaw w `basis` rozdziel średnikiem. `quote`: dosłowny krótki cytat z przepisu (opcjonalny, do 260 znaków).

## Rysunki

Współrzędne w metrach, początek w lewym górnym rogu, oś x w prawo, oś y w dół.

```json
{"id": "R1", "title": "Rzut parteru", "scale": "1:100", "kind": "rzut", "size": [40, 15], "pad": [3, 2.8, 1.5, 2.6], "font": 0.42,
 "north": [9, 12], "note": "podpis pod rysunkiem", "items": [ … ]}
```

`size` to obrys rysowanego obszaru, `pad` marginesy [lewy, górny, prawy, dolny] na wymiary, `font` wysokość pisma w metrach
(rzut 1:100 około 0,42; plan 1:500 około 1,15). `north` rysuje strzałkę północy (tylko plan zagospodarowania).

| `t` | Pola | Uwagi |
|---|---|---|
| `wall` | `pts`, `k`: `ext`/`int`/`fire`, `w`, `close`, `label` | oś ściany; `ext` domyślnie 0,4 m, pozostałe 0,2 m; `fire` = oddzielenie przeciwpożarowe (czerwona), `label` np. „REI 120” |
| `door` | `at`, `w`, `dir`: `h`/`v`, `open`: `n`/`s`/`e`/`w`, `hinge`: `a`/`b`, `leafs`: 2, `cls`, `label`, `lo`, `th` | `at` = środek otworu na osi ściany; `dir` = kierunek ściany; `open` = strona, na którą otwiera się skrzydło; `cls` np. „EI 30”; `th` = grubość ściany |
| `window` | `at`, `w`, `dir`, `th` | |
| `room` | `rect`, `no`, `name`, `area`, `note`, `lo`, `flat`, `fill`, `size` | podpis w środku; wąskie pomieszczenia dostają podpis pionowy, `flat` to wyłącza; `fill`: `evac`, `fire`, `tech`, `accent` |
| `stair` | `rect`, `n`, `axis`: `x`/`y`, `label` | |
| `dim` | `a`, `b`, `off`, `text`, `tlo` | linia wymiarowa; `off` odsuwa ją prostopadle; `text` domyślnie długość z geometrii; `tlo` przesuwa napis |
| `path` | `pts`, `k`: `evac`/`hose`, `label`, `auto`, `lo` | droga ewakuacyjna albo zasięg hydrantu według projektanta; `auto` wpisuje długość z geometrii |
| `sym` | `k`, `at`, `label`, `lo`, `r` | `H25`, `H33`, `H52`, `Z52`, `G`, `HZ`, `ROP`, `PWP`, `CSP`, `EW`, `KD`, `TREE`, `ZB` |
| `rect`, `poly` | `k`, `rect` albo `pts`, `label`, `lo`, `size` | `building`, `neighbor`, `road`, `fireroad`, `paved`, `parking`, `green`, `tank`, `plot`, `shed` |
| `zone` | `rect`, `label` | strefa pożarowa |
| `line` | `a`, `b`, `k`: `thin`/`boundary` | |
| `text` | `at`, `text`, `k`, `size`, `anchor`, `rot` | |
| `leader` | `a`, `b`, `text`, `anchor`, `lo` | odnośnik ze strzałką od `a` (napis) do `b` |

Wskazówki:

- Najpierw ściany, potem okna i drzwi, potem pomieszczenia, urządzenia, drogi, wymiary. Elementy rysują się warstwami niezależnie od kolejności.
- Wymiar wpisany w `text` musi zgadzać się z geometrią, chyba że rozbieżność jest zamierzoną usterką typu `niespójność`.
- Długość drogi ewakuacyjnej podana przez projektanta ma wynikać z geometrii (sprawdź wypis `render_case.js`). Jeśli projektant
  „pomylił się” celowo, opisz to w kluczu.
- Napisy nie mogą nachodzić na siebie ani na linie wymiarowe; przesuwaj je polem `lo` [dx, dy] w metrach.
- Znacznik usterki (`marker.at`) stawiaj obok miejsca usterki, nie na napisie.
- Na planie zagospodarowania pokazuj to, co podlega ocenie: odległości od sąsiednich budynków i granic, drogę pożarową z wymiarami,
  hydranty zewnętrzne, wejścia, drzewa i stałe elementy między drogą a budynkiem.
