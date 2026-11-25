# Egzamin rzeczoznawcy ppoż.

Aplikacja do nauki do egzaminu na rzeczoznawcę do spraw zabezpieczeń przeciwpożarowych (KG PSP):
plan nauki na 26 tygodni, lekcje, 560 pytań z egzaminów 2015–2026, fiszki, powtórki rozłożone
w czasie i egzaminy próbne z punktacją egzaminacyjną.

Stan prawny i wydania norm: **24 listopada 2026 r.** Zanim przystąpisz do egzaminu, sprawdź je ponownie
(patrz „Aktualizacja danych").

## Uruchomienie

Najprościej: otwórz w przeglądarce plik `dist/egzamin-rzeczoznawcy-ppoz.html`. Wszystko jest w tym
jednym pliku, działa bez internetu, a postęp zapisuje się w przeglądarce.

Wersja robocza z katalogu `app/` wymaga serwera plików:

```bash
python3 -m http.server 8000 --directory app
```

Postęp przenosisz między urządzeniami przez **Ustawienia → Zapisz kopię zapasową / Wczytaj kopię**.
W wersji opublikowanej jako artefakt Claude postęp zapisuje się na koncie i jest wspólny dla telefonu
i komputera.

## Co jest w środku

| Widok | Do czego służy |
|---|---|
| Dziś | powtórki na dziś, zadania bieżącego tygodnia, nowy materiał |
| Plan | harmonogram 26 tygodni (warianty 20 i 13), przesuwanie terminu, eksport do kalendarza |
| Nauka | lekcja na każdy tydzień: co przeczytać, aktualne wydania norm, co pada na egzaminie |
| Pytania | sesje z wyjaśnieniem i podstawą prawną, pula błędów, poprawianie klucza, własne pytania |
| Fiszki | powtórki w rosnących odstępach: 1, 3, 7, 16, 35, 75, 150 dni |
| Egzamin próbny | 14 rzeczywistych arkuszy i egzamin losowy; 40 pytań, 40 minut, +1 / −1 / 0, próg 21 pkt |
| Przepisy i normy | status 40 aktów prawnych i aktualne wydania 162 norm |
| Statystyki | gotowość do egzaminu, wyniki według tematów, kalibracja pewności |

## Zastrzeżenia, które trzeba znać

- **Klucz odpowiedzi nie pochodzi od KG PSP.** KG PSP publikuje same pytania. Klucz opracowano
  niezależnie i każde pytanie ma oznaczoną pewność oraz sposób weryfikacji. Część odpowiedzi
  sprawdzono w tekstach przepisów (z cytatem), większość pochodzi jeszcze z wcześniejszego
  opracowania bez podstaw prawnych. Klucz można poprawiać w aplikacji.
- **Warunki techniczne budynków z 2002 r. utraciły moc 21 września 2026 r.**, a nowego rozporządzenia
  do 24 listopada 2026 r. nie ogłoszono. Prawo budowlane (art. 102a–102c) pozwala przez 18 miesięcy
  projektować według dotychczasowych przepisów. Aplikacja uczy ostatniego brzmienia.
- **Normy.** Rejestr podaje aktualne wydania według wyszukiwarki PKN. Starsze pytania cytują wydania
  wycofane, więc wartości mogły się zmienić. Aplikacja nie zawiera tekstów norm.
- Fiszki pochodzą z wcześniejszego opracowania i nie zostały jeszcze sprawdzone w źródłach.

## Dane i narzędzia

```
content/            źródła danych
  questions.json      560 pytań KG PSP (14 arkuszy po 40)
  key/final.json      klucz odpowiedzi po scaleniu wyników weryfikacji
  plan.json           harmonogram i rytm tygodnia
  topics.json         tematy
  norms_pkn.json      rejestr norm z wyszukiwarki PKN
  acts_eli.json       rejestr aktów z API Sejmu (ELI)
  lessons/, flashcards/   treści autorskie (opcjonalne)
tools/
  build_data.py       składa app/data/*.json ze źródeł
  build.py            buduje dist/ (jeden plik oraz strona artefaktu z danymi obok)
  merge_key.py        scala wyniki weryfikacji klucza
  pkn_lookup.py       pobiera status norm z wyszukiwarki PKN
  fetch_acts.py       pobiera teksty i status aktów z API Sejmu
app/                aplikacja (HTML, CSS, JS bez bundlera)
dist/               wersje do użycia
```

Po zmianie danych:

```bash
python3 tools/build_data.py
```

```bash
python3 tools/build.py
```

## Aktualizacja danych

- Akty prawne: `tools/fetch_acts.py` pobiera status i teksty z `api.sejm.gov.pl`. Sprawdź przede
  wszystkim, czy ogłoszono nowe warunki techniczne budynków.
- Normy: `tools/pkn_lookup.py` odpytuje wyszukiwarkę norm PKN (`wiedza.pkn.pl`) dla numerów
  z `content/norm_queries.json`.
- Pytania: KG PSP publikuje zbiór pytań po każdym egzaminie na stronie
  „Rzeczoznawcy (egzamin)" w serwisie gov.pl.
