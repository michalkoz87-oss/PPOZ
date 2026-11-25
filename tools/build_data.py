#!/usr/bin/env python3
"""Składa pliki danych aplikacji (app/data/*.json) ze źródeł w content/.

Źródła:
  content/questions.json        560 pytań KG PSP (treść, arkusz, stary klucz)
  content/key/final.json        zweryfikowany klucz (jeśli jest); inaczej stary klucz AI
  content/plan.json, topics.json
  content/lessons/*.json        lekcje (po jednej na plik)
  content/flashcards/*.json     fiszki (listy); content/flashcards_legacy.json — stare 81 fiszek
  content/norms_pkn.json        rejestr norm z wyszukiwarki PKN
  content/norm_notes.json       uwagi o zmianach między wydaniami (opcjonalnie)
  content/acts_eli.json         rejestr aktów z API Sejmu (ELI)
"""
import json, os, re, glob, datetime, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = lambda *p: os.path.join(ROOT, 'content', *p)
OUT = os.path.join(ROOT, 'app', 'data')
LEGAL_DATE = '2026-11-24'


def load(path, default=None):
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    return default


def dump(name, obj):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    return os.path.getsize(os.path.join(OUT, name))


ROUGH = [('S3', r'\bmetr[ao]\b|metra'), ('S2', r'tunel|autostrad|drogow\w+ obiekt|\bmost'), ('S1', r'baz\w* paliw|stacj\w* paliw|naftow|rurociąg|gazu płynnego|gazem płynnym|lpg|sieci gazow|gazociąg|tłoczni'),
         ('S4', r'odpad'), ('S5', r'\blas\w*\b|leśn'), ('S6', r'przedszkol|żłob|szkoł'), ('S7', r'imprez|widowisk|stadion|13200'), ('W6', r'rolnicz|inwentarsk|budynk\w* in\b|zwierz'),
         ('S8', r'poważn\w* awari|zwiększonym ryzyku|dużym ryzyku|ochrony środowiska'), ('U4', r'12845|tryskacz|zraszacz|esfr|mgł'), ('U5', r'15004|gaz\w* gaśnicz|gaśnicz\w* gazow|fk-5|pianow|proszk|aerozol'),
         ('U1', r'54-14|czujk|sygnalizacji pożar|ostrzegacz'), ('U2', r'60849|dźwiękow\w* system|\bdso\b'), ('U3', r'1838|50172|oświetleni\w* awaryjn|oświetleni\w* ewakuac|7010|znak\w* bezp|01256'),
         ('U6', r'12101|02877|oddymia|dym|nadciśnieni|różnicowania ciśnień|wentylacj\w* pożar'), ('U7', r'\bsep\b|60364|kabl|przewod\w* elektr|zasilani|wyłącznik|dźwig|81-7'),
         ('X1', r'wybuch|60079|1127|atex'), ('H1', r'02857|zbiornik\w* przeciwpożarow|do zewnętrznego gaszenia|hydrant\w* zewn|zaopatrzeni\w* w wodę|zaopatrzenia wodnego'), ('H2', r'drog\w* pożarow'),
         ('R2', r'hydrant|671|instalacj\w* wodociągow\w* przeciwpożarow|zawor\w* 52'), ('P2', r'uzgodni|uzgadni|rzeczoznawc|projekt\w* budowlan|pozwoleni|odstępst|ekspertyz|rozwiąza\w* zamienn'),
         ('P1', r'państwowej straży|komendant|kontrolno|ustaw\w* o ochronie'), ('P3', r'świadectw|dopuszczeni|wyrob|certyfik|deklaracj'), ('O1', r'02852|obciążeni\w* ogniow|eurokod|1992-1-2'),
         ('W5', r'garaż'), ('W3', r'ewakuac|dojści|przejści|klatk\w* schodow|drzwi'), ('W2', r'stref\w* pożarow|oddzieleni\w* przeciwpożar|odległoś|usytuow|ścian\w* zewn|dach'),
         ('W1', r'odporności ogniow|odporności pożar|reakcji na ogień|kategori\w* zagrożenia ludzi|\bzl\b'), ('W4', r'\bgaz|kotłow|komin|wentylac|instalac'), ('R1', r'gaśnic|instrukcj\w* bezpieczeństwa|przegląd')]
NORM_RX = re.compile(r'((?:PKN-)?CEN/TS\s*\d+-\d+|PN[- ]EN[- ](?:ISO |IEC )?\d+(?:-\d+)*|PN-HD\s*\d+(?:-\d+)*|PN-[A-Z][- ]\d+(?:-\d+)*|N\s*SEP-E[- ]?\d+)')


def rough_topic(q):
    """Przybliżony temat ze słów kluczowych — używany, dopóki pytanie nie ma tematu z weryfikacji klucza."""
    t = ' '.join((q['q'], q['a'], q['b'], q['c'])).lower()
    for code, rx in ROUGH:
        if re.search(rx, t):
            return code
    return 'Z9'


def rough_norms(q):
    out = []
    for m in NORM_RX.findall(' '.join((q['q'], q['a'], q['b'], q['c']))):
        n = re.sub(r'\s+', ' ', m.upper()).replace('PN EN', 'PN-EN').replace('PN-EN-', 'PN-EN ')
        n = re.sub(r'^CEN/TS', 'PKN-CEN/TS', n)
        n = re.sub(r'N SEP-E[- ]?0*(\d+)', lambda x: 'N SEP-E-%03d' % int(x.group(1)), n)
        n = re.sub(r'PN-([A-Z]) ', r'PN-\1-', n)
        if n not in out:
            out.append(n)
    return out


def build_questions():
    qs = load(C('questions.json'))
    final = {int(k): v for k, v in (load(C('key', 'final.json'), {}) or {}).items()}
    out = []
    for q in qs:
        k = final.get(q['id'])
        rec = dict(id=q['id'], sheet=q['sheet'], q=q['q'], a=q['a'], b=q['b'], c=q['c'],
                   dup=q.get('dupGroup'), note=q.get('note'), legacyId=q.get('legacyId'))
        if k:
            now = k.get('ansNow', '=')
            rec.update(ans=k['ans'], ansNow=now, key=now if now in 'abc' and len(now) == 1 else k['ans'],
                       conf=k['conf'], stan=k.get('stan', 'aktualne'), stanNote=k.get('stanNote') or '',
                       topic=k.get('topic', 'Z9'), basis=k.get('basis', ''), quote=k.get('quote', ''),
                       expl=k.get('expl', ''), norms=k.get('norms', []), verif=k.get('verif', 'zgodne'),
                       alt=k.get('alt'))
        else:
            old = q.get('oldKey')
            rec.update(ans=old or '', ansNow='=', key=old or '', conf=q.get('oldConf') or 'niska',
                       stan='aktualne', stanNote='', topic=rough_topic(q), basis='', quote='', expl='', norms=rough_norms(q),
                       verif='stary-klucz' if old else 'brak')
        out.append(rec)
    return out


LEGACY_TOPIC = {'Klasyfikacja': 'W1', 'Ewakuacja': 'W3', 'Woda': 'H1', 'Instalacje gaśnicze': 'R2', 'Wybuch': 'X1',
                'Procedury': 'P2', 'Strefy': 'W2', 'SSP i DSO': 'U1', 'Oświetlenie': 'U3', 'Wentylacja': 'U6', 'Obliczenia': 'O1'}


def build_flashcards():
    """Fiszki autorskie z content/flashcards/*.json; dla tematów, które ich jeszcze nie mają — dawne fiszki (niesprawdzone)."""
    cards, seen = [], set()
    for fn in sorted(glob.glob(C('flashcards', '*.json'))):
        for i, c in enumerate(load(fn, []) or [], 1):
            cid = c.get('id') or '%s-%02d' % (os.path.basename(fn)[:-5], i)
            if cid in seen:
                continue
            seen.add(cid)
            cards.append(dict(id=cid, topic=c.get('topic', 'Z9'), front=c['front'], back=c['back'], ref=c.get('ref', ''),
                              conf=c.get('conf', 'średnia'), week=c.get('week')))
    covered = {c['topic'] for c in cards}
    for i, (front, back, cat) in enumerate(load(C('flashcards_legacy.json'), []), 1):
        topic = LEGACY_TOPIC.get(cat, 'Z9')
        if topic not in covered:
            cards.append(dict(id='F%03d' % i, topic=topic, front=front, back=back, ref='', conf='niska', week=None))
    return cards


def build_lessons():
    """Lekcja = tydzień planu z identyfikatorem lekcji + (opcjonalnie) treść autorska z content/lessons/<id>.json."""
    plan = load(C('plan.json'))
    out = []
    for w in plan['weeks']:
        if not w.get('lesson'):
            continue
        a = load(C('lessons', w['lesson'] + '.json'), {}) or {}
        out.append(dict(id=w['lesson'], week=w['n'], block=w['block'], title=w['title'], focus=w.get('focus', ''),
                        topics=w.get('topics', []), readings=w.get('readings', []), norms=w.get('norms', []),
                        intro=a.get('intro', ''), sections=a.get('sections', []), keyValues=a.get('keyValues', []),
                        traps=a.get('traps', []), oral=a.get('oral', []), selfCheck=a.get('selfCheck', []),
                        authored=bool(a)))
    return out


def build_norms(questions):
    reg = load(C('norms_pkn.json'))
    notes = load(C('norm_notes.json'), {}) or {}
    by_norm = collections.defaultdict(set)
    topics = collections.defaultdict(collections.Counter)
    for q in questions:
        for n in q.get('norms') or []:
            by_norm[n].add(q['id'])
            topics[n][q['topic']] += 1
    cited = reg.get('citedInQuestions', {})
    out = []
    for n in reg['norms']:
        base = n['base']
        c = cited.get(base) or {}
        ids = sorted(set(c.get('ids', [])) | by_norm.get(base, set()))
        cur = [dict(num=e['num'], langs=e['langs']) for e in n['current']]
        cited_eds = [e for e in (c.get('editions') or {}) if e != '—']
        cur_tags = {re.sub(r'^.*?:', '', e['num']) for e in n['current']}
        stale = [e for e in cited_eds if not any(e.split('+')[0] in t for t in cur_tags)] if n['found'] else []
        if not n['found'] and not ids:
            continue
        out.append(dict(base=base, title=n.get('title') or '', current=cur,
                        withdrawn=[w['num'] for w in n['withdrawn']], successor=n.get('successorOtherNumber', []),
                        additions=n.get('additions', []), cited=c.get('editions') or {}, qids=ids,
                        staleCited=stale, topic=(topics[base].most_common(1)[0][0] if topics.get(base) else None),
                        note=notes.get(base, '')))
    out.sort(key=lambda x: (-len(x['qids']), x['base']))
    return dict(checked=reg.get('generated', LEGAL_DATE), source=reg.get('source', ''), norms=out)


ACT_SHORT = {
    'ustawa_ppoz': 'Ustawa o ochronie przeciwpożarowej', 'ustawa_psp': 'Ustawa o Państwowej Straży Pożarnej',
    'prawo_budowlane': 'Prawo budowlane', 'pos': 'Prawo ochrony środowiska', 'ustawa_odpady': 'Ustawa o odpadach',
    'ustawa_imprezy_masowe': 'Ustawa o bezpieczeństwie imprez masowych', 'ustawa_wyroby_budowlane': 'Ustawa o wyrobach budowlanych',
    'rozp_ppoz_2010': 'Rozp. MSWiA z 7.06.2010 – ochrona ppoż. budynków, innych obiektów i terenów',
    'wt_2002': 'Rozp. MI z 12.04.2002 – warunki techniczne budynków (WT)',
    'woda_drogi_2009': 'Rozp. MSWiA z 24.07.2009 – zaopatrzenie w wodę i drogi pożarowe',
    'uzgadnianie_2023': 'Rozp. MSWiA z 5.08.2023 – uzgadnianie projektów',
    'uzgadnianie_2021_uchylone': 'Rozp. MSWiA z 17.09.2021 – uzgadnianie projektów',
    'uzgadnianie_2015_uchylone': 'Rozp. MSWiA z 2.12.2015 – uzgadnianie projektu budowlanego',
    'projekt_bud_2020': 'Rozp. MR z 11.09.2020 – zakres i forma projektu budowlanego',
    'bazy_paliw_2023': 'Rozp. MKiŚ z 24.07.2023 – bazy i stacje paliw', 'bazy_paliw_2005_uchylone': 'Rozp. MG z 21.11.2005 – bazy i stacje paliw',
    'wyroby_2007': 'Rozp. MSWiA z 20.06.2007 – wyroby (świadectwa dopuszczenia)',
    'seveso_2016': 'Rozp. MR z 29.01.2016 – substancje niebezpieczne (ZZR i ZDR)',
    'metro_2023': 'Rozp. z 2023 r. – obiekty budowlane metra', 'metro_2011_uchylone': 'Rozp. MI z 17.06.2011 – obiekty budowlane metra',
    'drogi_2022': 'Rozp. MI z 24.06.2022 – przepisy techniczno-budowlane dróg publicznych (tunele, mosty)',
    'doi_2000_uchylone': 'Rozp. MTiGM z 30.05.2000 – drogowe obiekty inżynierskie', 'autostrady_2002_uchylone': 'Rozp. MI z 16.01.2002 – autostrady płatne',
    'odpady_ppoz_2020': 'Rozp. MSWiA z 19.02.2020 – ochrona ppoż. miejsc gromadzenia odpadów',
    'atex_2016': 'Rozp. MR z 6.06.2016 – urządzenia w atmosferze potencjalnie wybuchowej (ATEX)',
    'atex_bhp_2010': 'Rozp. MG z 8.07.2010 – BHP przy atmosferze wybuchowej',
    'sieci_gazowe_2013_uchylone': 'Rozp. MG z 26.04.2013 – sieci gazowe', 'lasy_2006': 'Rozp. MŚ z 22.03.2006 – zabezpieczenie ppoż. lasów',
    'przedszkola_2017': 'Rozp. MEN z 25.08.2017 – oddziały przedszkolne w szkołach', 'zlobki_2014': 'Rozp. MPiPS z 10.07.2014 – żłobki i kluby dziecięce',
    'budowle_rolnicze_2023': 'Rozp. MRiRW z 13.01.2023 – budowle rolnicze', 'budowle_rolnicze_1997_uchylone': 'Rozp. z 7.10.1997 – budowle rolnicze',
    'egzamin_rzeczoznawcy_2015': 'Rozp. MSWiA z 2.12.2015 – egzamin na rzeczoznawcę', 'szkolenia_rzeczoznawcow_2015': 'Rozp. MSW z 10.11.2015 – szkolenia rzeczoznawców',
    'kontr_rozp_2005': 'Rozp. MSWiA z 24.10.2005 – czynności kontrolno-rozpoznawcze',
    'wt_uzytkowania_bud_mieszk_1999_uchylone': 'Rozp. MSWiA z 16.08.1999 – warunki techniczne użytkowania budynków mieszkalnych',
    'bhp_ogolne_1997': 'Rozp. MPiPS z 26.09.1997 – ogólne przepisy BHP',
    'budowle_ochronne_2025': 'Rozp. MSWiA z 4.11.2025 – warunki techniczne budowli ochronnych',
    'mds_2025': 'Rozp. MSWiA z 9.07.2025 – miejsca doraźnego schronienia',
    'magazyny_mat_wybuchowych': 'Rozp. MRPiT – magazyny materiałów wybuchowych, broni i amunicji (t.j. 2025)',
}
ACT_NOTE = {
    'budowle_ochronne_2025': 'Nowy akt. Pytania z niego pojawiły się w arkuszu egzaminacyjnym z 2026 r.',
    'mds_2025': 'Nowy akt. Pytanie z niego pojawiło się w arkuszu egzaminacyjnym z 2026 r.',
    'magazyny_mat_wybuchowych': 'Pytania z tego aktu pojawiły się w arkuszu egzaminacyjnym z 2026 r.',
    'wt_2002': 'Utraciło moc 21.09.2026 (upływ terminu z art. 66 ustawy o zapewnianiu dostępności). Nowe rozporządzenie jest podpisane, ale do 25.11.2026 nie zostało ogłoszone w Dzienniku Ustaw. Prawo budowlane, art. 102a–102c: przez 18 miesięcy od 20.09.2026 (do 20.03.2028) projekt można sporządzić według przepisów obowiązujących do 19.09.2026 po złożeniu oświadczenia inwestora. Ucz się ostatniego brzmienia i śledź publikację nowych WT.',
    'sieci_gazowe_2013_uchylone': 'Utraciło moc 21.09.2026 z tego samego powodu co WT; pytania egzaminacyjne odwołują się do jego treści.',
    'wt_uzytkowania_bud_mieszk_1999_uchylone': 'Utraciło moc 21.09.2026; art. 102c Prawa budowlanego dopuszcza użytkowanie budynków mieszkalnych według dotychczasowych przepisów przez 18 miesięcy.',
    'uzgadnianie_2021_uchylone': 'Zastąpione rozporządzeniem z 5.08.2023.', 'uzgadnianie_2015_uchylone': 'Zastąpione rozporządzeniem z 2021 r., a następnie z 5.08.2023.',
    'bazy_paliw_2005_uchylone': 'Zastąpione rozporządzeniem MKiŚ z 24.07.2023. Większość starszych pytań cytuje ten akt.',
    'metro_2011_uchylone': 'Zastąpione rozporządzeniem z 2023 r.', 'doi_2000_uchylone': 'Zastąpione rozporządzeniem MI z 24.06.2022.',
    'autostrady_2002_uchylone': 'Zastąpione rozporządzeniem MI z 24.06.2022.', 'budowle_rolnicze_1997_uchylone': 'Zastąpione rozporządzeniem z 13.01.2023.',
    'rozp_ppoz_2010': 'Tekst jednolity z 2023 r. ze zmianami: z 21.11.2024 (autonomiczne czujki dymu i tlenku węgla) oraz z 28.09.2026 (oznakowanie punktów schronienia).',
}


def build_legal():
    out = []
    for a in load(C('acts_eli.json'), []):
        key = a['file'][:-4]
        eli = a['eli']
        y, p = eli.split('/')[1:]
        base = a.get('tj') or eli
        out.append(dict(id=key, short=ACT_SHORT.get(key, a['title'][:90]), title=a['title'], eli=eli,
                        dz='Dz.U. %s poz. %s' % (y, p), status=a['status'], inForce=a['inForce'] == 'IN_FORCE',
                        repealDate=a.get('repealDate'), repealedBy=[r[0] for r in a.get('repealedBy', [])],
                        composition=a['composition'], note=ACT_NOTE.get(key, ''),
                        url=('https://api.sejm.gov.pl/eli/acts/%s/text/U/D%s%04dLj.pdf' % (eli, y, int(p)) if a['composition'].startswith('tekst ujednolicony') else 'https://api.sejm.gov.pl/eli/acts/%s/text.pdf' % base),
                        consolidated=a['composition'].startswith('tekst ujednolicony'),
                        page='https://eli.gov.pl/eli/%s/ogl' % eli))
    out.sort(key=lambda x: (not x['inForce'], x['short']))
    return out


def build_cases():
    """Kazusy części ustnej: content/cases/K*.json (dokumentacja do oceny, rysunki, pytania komisji, klucz)."""
    from validate_case import check
    out = []
    for fn in sorted(glob.glob(C('cases', 'K*.json'))):
        c = load(fn)
        errs = check(c)
        if errs:
            raise SystemExit('Błędy w %s:\n  ' % os.path.basename(fn) + '\n  '.join(errs))
        out.append(c)
    return out


def main():
    questions = build_questions()
    cards = build_flashcards()
    lessons = build_lessons()
    sizes = {}
    sizes['questions.json'] = dump('questions.json', questions)
    sizes['flashcards.json'] = dump('flashcards.json', cards)
    sizes['lessons.json'] = dump('lessons.json', lessons)
    sizes['norms.json'] = dump('norms.json', build_norms(questions))
    sizes['legal.json'] = dump('legal.json', build_legal())
    sizes['topics.json'] = dump('topics.json', load(C('topics.json')))
    sizes['plan.json'] = dump('plan.json', load(C('plan.json')))
    cases = build_cases()
    sizes['cases.json'] = dump('cases.json', cases)
    verif = collections.Counter(q['verif'] for q in questions)
    conf = collections.Counter(q['conf'] for q in questions)
    meta = dict(built=datetime.date.today().isoformat(), legalDate=LEGAL_DATE,
                exam=dict(questions=40, minutes=40, pass_=21, ok=1, bad=-1, none=0, sheets=14),
                counts=dict(questions=len(questions), flashcards=len(cards), lessons=len(lessons), cases=len(cases)),
                key=dict(verif=dict(verif), conf=dict(conf)))
    sizes['meta.json'] = dump('meta.json', meta)
    print(json.dumps(sizes), dict(verif), dict(conf))


if __name__ == '__main__':
    main()
