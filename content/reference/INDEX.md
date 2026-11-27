# INDEKS KORPUSU PRZEPISÓW (stan prawny wg API Sejmu ELI na 2026-11-24)

Pliki tekstowe w katalogu `akty/` (konwersja PDF→tekst, układ zachowany; tabele mogą być rozsunięte). Szukaj: `grep -n -i 'fraza' plik`, czytaj kontekst: `sed -n 'OD,DOp' plik`.

## NAJWAŻNIEJSZE ZMIANY STANU PRAWNEGO

1. **WT budynków (rozp. MI z 12.04.2002) UTRACIŁY MOC z dniem 21.09.2026** (art. 66 ustawy o zapewnianiu dostępności; upływ 84 miesięcy). Nowego rozporządzenia do 24.11.2026 NIE ogłoszono (projekt w notyfikacji UE). Prawo budowlane art. 102a–102c: przez 18 miesięcy od 20.09.2026 (do 20.03.2028) można projektować wg przepisów obowiązujących do 19.09.2026 po złożeniu oświadczenia inwestora. NA POTRZEBY KLUCZA: ostatnie brzmienie WT 2002 (t.j. 2022 + zmiany 2023/2024, plik wt_2002.txt) traktuj jako przepisy odniesienia — NIE oznaczaj z tego powodu pytań jako 'uchylone'. Oznacz 'zmienione' tylko wtedy, gdy nowelizacja WT zmieniła odpowiedź względem daty egzaminu.
   To samo dotyczy: sieci gazowych (rozp. MG 26.04.2013) i WT użytkowania budynków mieszkalnych (1999) — utraciły moc 21.09.2026 bez następcy; traktuj ostatnie brzmienie jako odniesienie.
2. **Uzgadnianie projektów**: rozp. 2015 → 2021 → OBOWIĄZUJE rozp. MSWiA z 5.08.2023 (uzgadnianie_2023.txt).
3. **Bazy i stacje paliw**: rozp. MG 21.11.2005 uchylone → OBOWIĄZUJE rozp. MKiŚ z 24.07.2023 (bazy_paliw_2023.txt).
4. **Metro**: rozp. 2011 uchylone → OBOWIĄZUJE rozp. z 2023 (metro_2023.txt).
5. **Tunele/drogi/autostrady**: rozp. 2000 (drogowe obiekty inżynierskie) i 2002 (autostrady płatne) uchylone → OBOWIĄZUJE rozp. MI z 24.06.2022 ws. przepisów techniczno-budowlanych dotyczących dróg publicznych (drogi_2022.txt).
6. **Budowle rolnicze**: rozp. 1997 uchylone → OBOWIĄZUJE rozp. z 13.01.2023.
7. **Rozp. MSWiA 7.06.2010 (ochrona ppoż. budynków)**: t.j. 2023 + zmiana z 21.11.2024 (m.in. autonomiczne czujki dymu i tlenku węgla) + zmiana z 28.09.2026 (oznakowanie punktów schronienia).
8. **Ustawa o ochronie ppoż.**: tekst ujednolicony (t.j. 2025 poz. 188 + zm. 2026 poz. 815).
9. **Normy**: aktualne wydania — patrz `NORMY_AKTUALNE.md` (stan wg wyszukiwarki PKN). Wiele wydań cytowanych w starszych pytaniach jest WYCOFANYCH (np. PN-EN 12845:2015-10 i +A1:2020-05 → PN-EN 12845+A2:2026-09; PN-EN 1838:2013-11 → :2025-05; PN-EN 15004-1:2019-06 → :2025-05; PN-EN 12101-6:2007 → :2022-09; PN-B-02877-4:2001 → :2025-07; PN-EN 60849:2001 → PN-EN 50849:2017-04; PN-EN 60079-10-1:2016-02 → PN-EN IEC 60079-10-1:2021-09; PKN-CEN/TS 54-14:2006 → :2020-09). Tekstów norm NIE MA w korpusie (prawa autorskie PKN).

## UWAGA: TABELA 1 ZAŁĄCZNIKA NR 3 DO WT (określenia palności a klasy PN-EN 13501-1)

W pliku akty/wt_2002.txt tabela straciła granice komórek i czyta się ją niejednoznacznie. Odczyt z oficjalnego PDF
(Dz.U. 2022 poz. 1225, zał. nr 3, tabela 1):
- niepalne: A1; A2-s1,d0; A2-s2,d0; A2-s3,d0;
- niezapalne (palne): A2-s1..s3 z d1 lub d2; wszystkie klasy B (B-s1..s3, d0..d2);
- trudno zapalne (palne): wszystkie klasy C (C-s1..s3, d0..d2); D-s1,d0; D-s1,d1; D-s1,d2;
- łatwo zapalne (palne): D-s2 i D-s3 (d0..d2); E-d2; E; F;
- niekapiące: klasy z d0 (A1, A2, B, C, D z d0); samogasnące: co najmniej E;
- intensywnie dymiące: wszystkie z s3 (A2, B, C, D), E-d2, E, F.

## PLIKI

| plik | akt | status | skład | tematy |
|---|---|---|---|---|
| akty/atex_2016.txt (102k zn.) | Ministra Rozwoju z dnia 6 czerwca 2016 r. w sprawie wymagań dla urządzeń i systemów ochronnych przeznaczonych do użytku w atmosferze potencjalnie wybu | obowiązujący | tekst pierwotny DU/2016/817 | X1 |
| akty/atex_bhp_2010.txt (28k zn.) | Ministra Gospodarki z dnia 8 lipca 2010 r. w sprawie minimalnych wymagań, dotyczących bezpieczeństwa i higieny pracy, związanych z możliwością wystąpi | obowiązujący | tekst pierwotny DU/2010/931 | X1 |
| akty/autostrady_2002_uchylone.txt (225k zn.) | Ministra Infrastruktury z dnia 16 stycznia 2002 r. w sprawie przepisów techniczno-budowlanych dotyczących autostrad płatnych. | uznany za uchylony (od 2022-09-21) | tekst pierwotny DU/2002/116 + zmiany: DU/2010/409, DU/2014/857, DU/2019/1644 | S2 (uchylone 2022) |
| akty/bazy_paliw_2005_uchylone.txt (170k zn.) | Ministra Gospodarki z dnia 21 listopada 2005 r. w sprawie warunków technicznych, jakim powinny odpowiadać bazy i stacje paliw płynnych, rurociągi prze | uznany za uchylony (od 2023-09-09) | t.j. DU/2014/1853 + zmiany: DU/2017/282 | S1 (uchylone 2023 — większość pytań cytuje to rozporządzenie) |
| akty/bazy_paliw_2023.txt (148k zn.) | Ministra Klimatu i Środowiska z dnia 24 lipca 2023 r. w sprawie warunków technicznych, jakim powinny odpowiadać bazy i stacje paliw płynnych, bazy i s | obowiązujący | tekst pierwotny DU/2023/1707 | S1 (OBOWIĄZUJE) |
| akty/bhp_ogolne_1997.txt (337k zn.) | Ministra Pracy i Polityki Socjalnej z dnia 26 września 1997 r. w sprawie ogólnych przepisów bezpieczeństwa i higieny pracy. | akt posiada tekst jednolity | t.j. DU/2003/1650 + zmiany: DU/2007/330, DU/2008/690, DU/2011/1034, DU/2021/2088, DU/2026/ | Z9 |
| akty/budowle_rolnicze_1997_uchylone.txt (40k zn.) | Ministra Rolnictwa i Gospodarki Żywnościowej z dnia 7 października 1997 r. w sprawie warunków technicznych, jakim powinny odpowiadać budowle rolnicze  | uznany za uchylony (od 2023-03-02) | t.j. DU/2014/81 | W6 (uchylone) |
| akty/budowle_rolnicze_2023.txt (31k zn.) | Ministra Rolnictwa i Rozwoju Wsi z dnia 13 stycznia 2023 r. w sprawie warunków technicznych, jakim powinny odpowiadać budowle rolnicze i ich usytuowan | obowiązujący | tekst pierwotny DU/2023/297 | W6 (OBOWIĄZUJE) |
| akty/doi_2000_uchylone.txt (454k zn.) | Ministra Transportu i Gospodarki Morskiej z dnia 30 maja 2000 r. w sprawie warunków technicznych, jakim powinny odpowiadać drogowe obiekty inżynierski | uznany za uchylony (od 2022-09-21) | tekst pierwotny DU/2000/735 + zmiany: DU/2010/408, DU/2012/608, DU/2013/528, DU/2014/858,  | S2 (uchylone 2022: drogowe obiekty inżynierskie/tunele) |
| akty/drogi_2022.txt (188k zn.) | Ministra Infrastruktury z dnia 24 czerwca 2022 r. w sprawie przepisów techniczno-budowlanych dotyczących dróg publicznych | obowiązujący | tekst pierwotny DU/2022/1518 + zmiany: DU/2025/1352 | S2 (OBOWIĄZUJE: tunele, mosty, drogi) |
| akty/egzamin_rzeczoznawcy_2015.txt (20k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 2 grudnia 2015 r. w sprawie egzaminu dla osób ubiegających się o przyznanie prawa do wykonywania za | obowiązujący | tekst pierwotny DU/2015/2083 | P1 |
| akty/kontr_rozp_2005.txt (23k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 24 października 2005 r. w sprawie czynności kontrolno-rozpoznawczych przeprowadzanych przez Państwo | obowiązujący | tekst pierwotny DU/2005/1934 + zmiany: DU/2023/1493 | P1 |
| akty/lasy_2006.txt (39k zn.) | Ministra Środowiska z dnia 22 marca 2006 r. w sprawie szczegółowych zasad zabezpieczenia przeciwpożarowego lasów | akt posiada tekst jednolity | t.j. DU/2022/1065 | S5 |
| akty/metro_2011_uchylone.txt (130k zn.) | Ministra Infrastruktury z dnia 17 czerwca 2011 r. w sprawie warunków technicznych, jakim powinny odpowiadać obiekty budowlane metra i ich usytuowanie | uznany za uchylony (od 2023-12-28) | tekst pierwotny DU/2011/859 | S3 (uchylone 2023) |
| akty/metro_2023.txt (115k zn.) | Ministra Infrastruktury z dnia 16 maja 2023 r. w sprawie warunków technicznych, jakim powinny odpowiadać obiekty budowlane metra i ich usytuowanie | obowiązujący | tekst pierwotny DU/2023/1210 | S3 (OBOWIĄZUJE) |
| akty/odpady_ppoz_2020.txt (73k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 19 lutego 2020 r. w sprawie wymagań w zakresie ochrony przeciwpożarowej, jakie mają spełniać obiekt | obowiązujący | tekst pierwotny DU/2020/296 | S4 |
| akty/pos.txt (817k zn.) | z dnia 27 kwietnia 2001 r. Prawo ochrony środowiska. | akt posiada tekst jednolity | tekst ujednolicony (U) | S8 (poważne awarie, ZZR/ZDR) |
| akty/prawo_budowlane.txt (403k zn.) | z dnia 7 lipca 1994 r. - Prawo budowlane. | akt posiada tekst jednolity | tekst ujednolicony (U) | P2 (art. 9 odstępstwa, art. 56, art. 102a–102c okres przejściowy WT) |
| akty/projekt_bud_2020.txt (70k zn.) | Ministra Rozwoju z dnia 11 września 2020 r. w sprawie szczegółowego zakresu i formy projektu budowlanego | akt posiada tekst jednolity | t.j. DU/2022/1679 + zmiany: DU/2023/2405, DU/2026/597 | P2 |
| akty/przedszkola_2017.txt (17k zn.) | Ministra Edukacji Narodowej z dnia 25 sierpnia 2017 r. w sprawie wymagań ochrony przeciwpożarowej, jakie musi spełniać lokal, w którym są prowadzone o | akt posiada tekst jednolity | t.j. DU/2020/1531 | S6 |
| akty/rozp_ppoz_2010.txt (117k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 7 czerwca 2010 r. w sprawie ochrony przeciwpożarowej budynków, innych obiektów budowlanych i terenó | akt posiada tekst jednolity | t.j. DU/2023/822 + zmiany: DU/2024/1716, DU/2026/1276 | R1,R2,X1 (§37), U1–U5 obowiązek stosowania urządzeń |
| akty/seveso_2016.txt (41k zn.) | Ministra Rozwoju z dnia 29 stycznia 2016 r. w sprawie rodzajów i ilości znajdujących się w zakładzie substancji niebezpiecznych, decydujących o zalicz | obowiązujący | tekst pierwotny DU/2016/138 | S8 |
| akty/sieci_gazowe_2013_uchylone.txt (141k zn.) | Ministra Gospodarki z dnia 26 kwietnia 2013 r. w sprawie warunków technicznych, jakim powinny odpowiadać sieci gazowe i ich usytuowanie | uznany za uchylony (od 2026-09-21) | tekst pierwotny DU/2013/640 | S1 (utraciło moc 21.09.2026, brak następcy) |
| akty/szkolenia_rzeczoznawcow_2015.txt (12k zn.) | Ministra Spraw Wewnętrznych z dnia 10 listopada 2015 r. w sprawie szkoleń dla rzeczoznawców do spraw zabezpieczeń przeciwpożarowych | akt posiada tekst jednolity | t.j. DU/2021/1871 | P1 |
| akty/ustawa_imprezy_masowe.txt (108k zn.) | z dnia 20 marca 2009 r. o bezpieczeństwie imprez masowych | akt posiada tekst jednolity | tekst ujednolicony (U) | S7 |
| akty/ustawa_odpady.txt (624k zn.) | z dnia 14 grudnia 2012 r. o odpadach | akt posiada tekst jednolity | tekst ujednolicony (U) | S4 (operat ppoż., art. 42–43) |
| akty/ustawa_ppoz.txt (107k zn.) | z dnia 24 sierpnia 1991 r. o ochronie przeciwpożarowej. | akt posiada tekst jednolity | tekst ujednolicony (U) | P1,P2 (rzeczoznawcy art. 11a–11n, rozwiązania zamienne art. 6a–6g, obowiązki) |
| akty/ustawa_psp.txt (367k zn.) | z dnia 24 sierpnia 1991 r. o Państwowej Straży Pożarnej. | akt posiada tekst jednolity | tekst ujednolicony (U) | P1 (kontrole, decyzje) |
| akty/ustawa_wyroby_budowlane.txt (83k zn.) | z dnia 16 kwietnia 2004 r. o wyrobach budowlanych | akt posiada tekst jednolity | tekst ujednolicony (U) | P3 |
| akty/uzgadnianie_2015_uchylone.txt (22k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 2 grudnia 2015 r. w sprawie uzgadniania projektu budowlanego pod względem ochrony przeciwpożarowej | uznany za uchylony (od 2021-09-19) | tekst pierwotny DU/2015/2117 | P2 (uchylone — pytania z arkuszy 1–10) |
| akty/uzgadnianie_2021_uchylone.txt (38k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 17 września 2021 r. w sprawie uzgadniania projektu zagospodarowania działki lub terenu, projektu ar | uznany za uchylony (od 2023-08-09) | tekst pierwotny DU/2021/1722 | P2 (uchylone — pytania z arkuszy 11–12) |
| akty/uzgadnianie_2023.txt (45k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 5 sierpnia 2023 r. w sprawie uzgadniania projektu zagospodarowania działki lub terenu, projektu arc | obowiązujący | tekst pierwotny DU/2023/1563 | P2 (OBOWIĄZUJE) |
| akty/woda_drogi_2009.txt (53k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 24 lipca 2009 r. w sprawie przeciwpożarowego zaopatrzenia w wodę oraz dróg pożarowych | obowiązujący | tekst pierwotny DU/2009/1030 | H1,H2 |
| akty/wt_2002.txt (537k zn.) | Ministra Infrastruktury z dnia 12 kwietnia 2002 r. w sprawie warunków technicznych, jakim powinny odpowiadać budynki i ich usytuowanie. | uznany za uchylony (od 2026-09-21) | t.j. DU/2022/1225 + zmiany: DU/2023/2442, DU/2024/474, DU/2024/726 | W1–W6 (dział VI, zał. 1 wykaz norm, zał. 3 NRO) |
| akty/wt_uzytkowania_bud_mieszk_1999_uchylone.txt (63k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 16 sierpnia 1999 r. w sprawie warunków technicznych użytkowania budynków mieszkalnych. | uznany za uchylony (od 2026-09-21) | tekst pierwotny DU/1999/836 + zmiany: DU/2009/1584 | R1 (utraciło moc 21.09.2026) |
| akty/wyroby_2007.txt (383k zn.) | Ministra Spraw Wewnętrznych i Administracji z dnia 20 czerwca 2007 r. w sprawie wykazu wyrobów służących zapewnieniu bezpieczeństwa publicznego lub oc | obowiązujący | tekst pierwotny DU/2007/1002 + zmiany: DU/2010/553, DU/2018/984, DU/2022/2282, DU/2026/556 | P3 (świadectwa dopuszczenia CNBOP) |
| akty/zlobki_2014.txt (18k zn.) | Ministra Pracy i Polityki Społecznej z dnia 10 lipca 2014 r. w sprawie wymagań lokalowych i sanitarnych jakie musi spełniać lokal, w którym ma być pro | akt posiada tekst jednolity | t.j. DU/2019/72 | S6 |
