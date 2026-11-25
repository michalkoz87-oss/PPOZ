# Nocna weryfikacja klucza i treści — instrukcja przebiegu

Cel: po jednym bloku tematycznym na noc sprawdzić klucz odpowiedzi w tekstach źródeł, napisać ściągę
i fiszki do lekcji bloku, a potem zbudować i opublikować aplikację. Ciężką pracę (agenci) wolno
uruchamiać tylko w nocy (zadanie cykliczne startuje o 23:30 czasu polskiego). Jeden blok na noc.

Kolejność bloków: R → K → K2 → H → P → D1 → D2 → D3 → E1 → E2 → W1 → W2 → Z (`content/key/progress.json`, pole `order`).
Bloki R–Z z `blocks.json` to weryfikacja klucza pytań testowych; K i K2 to kazusy części ustnej (opis niżej).
Warunki techniczne (W1, W2) są na końcu, bo nowe rozporządzenie jest podpisane, ale nieogłoszone.
Stan postępu: `content/key/progress.json` (`done`: bloki ukończone).

## Kroki

1. **Przygotowanie.** `git status` i `git pull`. Jeśli brakuje `.work/corpus/akty` (świeży kontener):

   ```bash
   mkdir -p .work/corpus/akty .work/corpus/normy && python3 tools/fetch_acts.py .work/corpus/akty && cp content/reference/*.md .work/corpus/
   ```

   **Teksty norm.** Normy są plikami użytkownika w jego Dropboxie (licencja PKN: tylko do użytku
   wewnętrznego). Wykaz: `tools/nightly/norms.json` (identyfikator pliku, nazwa pliku roboczego, wydanie
   aktualne czy wycofane, blok). Tekstów norm nie zapisuj w repozytorium ani nie przepisuj do aplikacji.

   ```bash
   python3 -I tools/nightly/norms_from_dropbox.py stan R
   ```

   Dla pozycji `BRAK` bieżącego bloku:
   - `fetch` — wywołaj `mcp__Dropbox__fetch` z podanym `id` (pliki do 5 MiB z warstwą tekstową), potem
     `python3 -I tools/nightly/norms_from_dropbox.py tekst`. Pobieraj tylko normy bieżącego bloku:
     odpowiedzi średniej wielkości trafiają do kontekstu rozmowy.
   - `pobranie`, `pobranie+OCR` — plik jest za duży dla `fetch` albo jest skanem. Wymaga bezpośredniego
     pobrania (`mcp__Dropbox__download_link` + `curl`), a to działa tylko wtedy, gdy użytkownik dopisał
     w ustawieniach środowiska domenę `*.dl.dropboxusercontent.com` (każdy link ma inny, losowy serwer;
     pojedynczych adresów nie da się dopisać z góry). PDF zapisz w `.work/pdf/` pod nazwą z wykazu
     (z końcówką `.pdf`) i uruchom `python3 -I tools/nightly/norms_from_dropbox.py pdf .work/pdf`.
     OCR: `apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-pol`.
     Jeśli pobranie jest zablokowane, nie obchodź blokady: pracuj bez tej normy i napisz o tym w sprawozdaniu.

   `select_block.py` sam dołącza do źródeł bloku te normy z wykazu, których tekst jest w
   `.work/corpus/normy/`, i wypisuje brakujące.

2. **Przed blokami W1 i W2** sprawdź w API Sejmu, czy ogłoszono nowe warunki techniczne budynków
   (`https://api.sejm.gov.pl/eli/acts/search?title=budynki i ich usytuowanie&dateFrom=2026-09-01`).
   Jeśli tak: pobierz tekst do `.work/corpus/akty/wt_nowe.txt`, dopisz akt do `tools/fetch_acts.py`,
   `content/acts_eli.json` i planu, popraw notatkę o WT w `tools/build_data.py`.

3. **Wybór pytań.** Następny blok = pierwszy z kolejności, którego nie ma w `progress.json`.

   ```bash
   python3 tools/nightly/select_block.py R
   ```

   Polecenie wypisuje argumenty przebiegu (JSON). Gdy części jest 0, uruchom przebieg tylko dla lekcji.

4. **Przebieg.** `Workflow` ze `scriptPath: tools/nightly/verify-block.js` i wypisanymi argumentami.
   Wyniki trafiają do `content/key/raw/` (A_, B_, J_), `content/lessons/`, `content/flashcards/`.
   Nie uruchamiaj kilku przebiegów naraz.

5. **Po przebiegu:**

   ```bash
   python3 tools/merge_key.py content/key/raw && python3 tools/build_data.py && python3 tools/build.py
   ```

   Test w przeglądarce: serwer `python3 -m http.server 8200 --directory app`, potem
   `node tools/smoke.js <katalog na zrzuty>`; ma być `ERRORS 0`.
   Uruchom też `node tools/smoke_ustna.js <katalog na zrzuty>` (moduł części ustnej).
   Dopisz blok do `content/key/progress.json` (data, liczba pytań, liczba spornych), zrób commit i push,
   opublikuj `dist/artifact.html` z plikami `dist/data/*.json` (także `cases.json`) pod adresem
   `https://claude.ai/artifact/AYFFkjMbuJvG6gfe7YbMSC`.

6. **Limit użycia.** Jeśli limit przerwie przebieg, nic nie ginie: wyniki są w plikach. Wykonaj krok 5
   dla tego, co jest, a następnej nocy uruchom ten sam blok ponownie (`select_block.py` pomija pytania
   już potwierdzone w źródłach). Bloku nie wpisuj do `progress.json`, dopóki przebieg się nie skończył.

7. **Koniec.** Po bloku Z wyłącz zadanie cykliczne i napisz użytkownikowi podsumowanie: ile pytań ma
   odpowiedź potwierdzoną cytatem, ile zostało spornych lub niepewnych i dlaczego.

## Bloki K i K2: kazusy części ustnej

Kazus to fikcyjna dokumentacja z celowymi błędami, rysunkami, pytaniami komisji i kluczem (`content/cases/K??.json`,
format w `content/cases/README.md`). Lista tematów: `tools/nightly/cases.json`. Jeden przebieg obejmuje trzy kazusy,
każdy przechodzi cztery etapy (5 agentów na kazus):

1. **Autor** pisze kazus z tekstu przepisów.
2. **Dwóch zdających** ocenia dokumentację bez klucza, niezależnie od siebie: A zaczyna od przepisów, B od rysunków
   (mierzy geometrię skryptem i porównuje z opisem).
3. **Kontrola przepisów** sprawdza w źródłach klucz, pozycje „poprawne”, odpowiedzi wzorcowe i ustalenia obu zdających.
4. **Sceptyk** próbuje obalić klucz: szuka wyjątków i zwolnień, przelicza liczby z geometrii, szuka niezamierzonych
   niezgodności, ogląda rysunki i dopiero wtedy dopisuje pole `review` (`solverFound`, `solverFoundA`, `solverFoundB`,
   `issues`, `refuted`).

Typowe błędy z wcześniejszych kazusów są wpisane do poleceń autora i sceptyka (stała `LESSONS` w `cases.js`);
po każdym bloku dopisz tam nowe, jeśli kontrola je wykryła. Kazus napisany wcześniej ręcznie (K01) pomija autora.

1. Przygotuj `.work/corpus/akty` jak w kroku 1. Przed przebiegiem sprawdź, czy ogłoszono nowe warunki techniczne (krok 2).
2. Argumenty przebiegu:

   ```bash
   python3 tools/nightly/select_cases.py 3
   ```

3. `Workflow` ze `scriptPath: tools/nightly/cases.js` i wypisanymi argumentami. Bez innych przebiegów równolegle.
4. Po przebiegu sprawdź każdy nowy plik (`python3 tools/validate_case.py content/cases/K0?.json`), zbuduj dane
   i wersje do publikacji, uruchom oba testy w przeglądarce (`node tools/smoke.js <katalog>` oraz
   `node tools/smoke_ustna.js <katalog>`; oba mają dać `ERRORS 0`) i obejrzyj zrzuty rysunków nowych kazusów.
   Kazus bez pola `review` nie przeszedł kontroli: nie publikuj go (przenieś plik do `.work/`) i powtórz następnej nocy.
5. Wpisz blok do `progress.json`, zrób commit i push, opublikuj artefakt (z plikiem `dist/data/cases.json`).
6. W sprawozdaniu podaj dla każdego kazusu: ile usterek ma klucz, ile wskazał zdający A, ile B, ile co najmniej jeden,
   co poprawiła kontrola przepisów, co sceptyk obalił albo zmienił i co pozostaje niepewne.

Blok K2 to ten sam przebieg dla kolejnych trzech tematów z listy.

## Zasady

- Klucz ma być uczciwy: pewność „wysoka” tylko z cytatem; spory i braki źródeł widoczne w aplikacji.
- Aplikacja opiera się na aktualnych wydaniach norm (rejestr z wyszukiwarki PKN). Tekstów norm,
  których nie dostarczył użytkownik, nie ma: wartości z nich mają pewność „niska” albo „średnia”.
- Część norm użytkownika to wydania wycofane (stan w `norms.json` i w pierwszej linii pliku normy).
  Odpowiedź sprawdzona tylko w wydaniu wycofanym dostaje stan „nieustalone” z opisem, które wydanie
  jest aktualne. Z tekstu normy do aplikacji trafia najwyżej jednozdaniowy cytat z numerem punktu.
- W sprawozdaniu dla użytkownika podaj liczby, nie ogólniki, i powiedz, czego nie udało się sprawdzić.
