# Nocna weryfikacja klucza i treści — instrukcja przebiegu

Cel: po jednym bloku tematycznym na noc sprawdzić klucz odpowiedzi w tekstach źródeł, napisać ściągę
i fiszki do lekcji bloku, a potem zbudować i opublikować aplikację. Ciężką pracę (agenci) wolno
uruchamiać tylko po 23:00 czasu polskiego. Jeden blok na noc.

Kolejność bloków (`blocks.json`): R → H → P → D1 → D2 → D3 → E1 → E2 → W1 → W2 → Z.
Warunki techniczne (W1, W2) są na końcu, bo nowe rozporządzenie jest podpisane, ale nieogłoszone.
Stan postępu: `content/key/progress.json` (`done`: bloki ukończone).

## Kroki

1. **Przygotowanie.** `git status` i `git pull`. Jeśli brakuje `.work/corpus/akty` (świeży kontener):

   ```bash
   mkdir -p .work/corpus/akty .work/corpus/normy && python3 tools/fetch_acts.py .work/corpus/akty && cp content/reference/*.md .work/corpus/
   ```

   Normy przekazane przez użytkownika (PDF w `/root/.claude/uploads/…`) zamień na tekst poleceniem
   `pdftotext -layout` do `.work/corpus/normy/` pod nazwami z `blocks.json`. Nie zapisuj ich w repozytorium.
   Jeśli plików nie ma, pracuj bez nich.

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
   Dopisz blok do `content/key/progress.json` (data, liczba pytań, liczba spornych), zrób commit i push,
   opublikuj `dist/artifact.html` z plikami `dist/data/*.json` pod adresem
   `https://claude.ai/artifact/AYFFkjMbuJvG6gfe7YbMSC`.

6. **Limit użycia.** Jeśli limit przerwie przebieg, nic nie ginie: wyniki są w plikach. Wykonaj krok 5
   dla tego, co jest, a następnej nocy uruchom ten sam blok ponownie (`select_block.py` pomija pytania
   już potwierdzone w źródłach). Bloku nie wpisuj do `progress.json`, dopóki przebieg się nie skończył.

7. **Koniec.** Po bloku Z wyłącz zadanie cykliczne i napisz użytkownikowi podsumowanie: ile pytań ma
   odpowiedź potwierdzoną cytatem, ile zostało spornych lub niepewnych i dlaczego.

## Zasady

- Klucz ma być uczciwy: pewność „wysoka” tylko z cytatem; spory i braki źródeł widoczne w aplikacji.
- Aplikacja opiera się na aktualnych wydaniach norm (rejestr z wyszukiwarki PKN). Tekstów norm,
  których nie dostarczył użytkownik, nie ma: wartości z nich mają pewność „niska” albo „średnia”.
- W sprawozdaniu dla użytkownika podaj liczby, nie ogólniki, i powiedz, czego nie udało się sprawdzić.
