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
                       stan='aktualne', stanNote='', topic='Z9', basis='', quote='', expl='', norms=[],
                       verif='stary-klucz' if old else 'brak')
        out.append(rec)
    return out


LEGACY_TOPIC = {'Klasyfikacja': 'W1', 'Ewakuacja': 'W3', 'Woda': 'H1', 'Instalacje gaśnicze': 'R2', 'Wybuch': 'X1',
                'Procedury': 'P2', 'Strefy': 'W2', 'SSP i DSO': 'U1', 'Oświetlenie': 'U3', 'Wentylacja': 'U6', 'Obliczenia': 'O1'}


def build_flashcards():
    cards = []
    new = []
    for fn in sorted(glob.glob(C('flashcards', '*.json'))):
        new += load(fn, [])
    if new:
        for i, c in enumerate(new, 1):
            cards.append(dict(id=c.get('id') or f'N{i:03d}', topic=c['topic'], front=c['front'], back=c['back'],
                              ref=c.get('ref', ''), conf=c.get('conf', 'średnia'), week=c.get('week')))
    else:
        for i, (front, back, cat) in enumerate(load(C('flashcards_legacy.json'), []), 1):
            cards.append(dict(id=f'F{i:03d}', topic=LEGACY_TOPIC.get(cat, 'Z9'), front=front, back=back, ref='',
                              conf='niska', week=None))
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
        stale = [e for e in cited_eds if not any(e.split('+')[0] in t for t in cur_tags)]
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
}
ACT_NOTE = {
    'wt_2002': 'Utraciło moc 21.09.2026 (upływ terminu z art. 66 ustawy o zapewnianiu dostępności). Do 24.11.2026 nie ogłoszono nowego rozporządzenia. Prawo budowlane, art. 102a–102c: przez 18 miesięcy od 20.09.2026 (do 20.03.2028) projekt można sporządzić według przepisów obowiązujących do 19.09.2026 po złożeniu oświadczenia inwestora. Ucz się ostatniego brzmienia i śledź publikację nowych WT.',
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
                        url='https://api.sejm.gov.pl/eli/acts/%s/text.pdf' % base,
                        page='https://eli.gov.pl/eli/%s/ogl' % eli))
    out.sort(key=lambda x: (not x['inForce'], x['short']))
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
    verif = collections.Counter(q['verif'] for q in questions)
    conf = collections.Counter(q['conf'] for q in questions)
    meta = dict(built=datetime.date.today().isoformat(), legalDate=LEGAL_DATE,
                exam=dict(questions=40, minutes=40, pass_=21, ok=1, bad=-1, none=0, sheets=14),
                counts=dict(questions=len(questions), flashcards=len(cards), lessons=len(lessons)),
                key=dict(verif=dict(verif), conf=dict(conf)))
    sizes['meta.json'] = dump('meta.json', meta)
    print(json.dumps(sizes), dict(verif), dict(conf))


if __name__ == '__main__':
    main()
