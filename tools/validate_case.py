#!/usr/bin/env python3
"""Sprawdza budowę kazusu części ustnej (content/cases/K??.json): pola, rysunki, znaczniki, podstawy prawne.

Użycie: validate_case.py <plik.json> [...]
Sprawdzana jest forma, nie treść merytoryczna. Opis formatu: content/cases/README.md.
"""
import json, math, re, sys

ITEM = {'wall': ['pts'], 'door': ['at'], 'window': ['at'], 'room': ['rect'], 'stair': ['rect'], 'dim': ['a', 'b'], 'path': ['pts'],
        'sym': ['k', 'at'], 'rect': ['k', 'rect'], 'poly': ['k', 'pts'], 'line': ['a', 'b'], 'zone': ['rect'], 'text': ['at', 'text'],
        'leader': ['a', 'b', 'text']}
SYMS = {'H25', 'H33', 'H52', 'Z52', 'G', 'HZ', 'ROP', 'PWP', 'CSP', 'EW', 'KD', 'TREE', 'ZB'}
AREAS = {'building', 'neighbor', 'road', 'fireroad', 'paved', 'parking', 'green', 'tank', 'plot', 'shed'}
KINDS = {'błąd', 'brak', 'niespójność', 'poprawne'}
QKINDS = {'ocena', 'zamienne', 'ekspertyza', 'procedura'}
BASIS = re.compile(r'(§|art\.|pkt|PN-|załącznik)', re.I)


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def pt(v):
    return isinstance(v, list) and len(v) == 2 and all(num(x) for x in v)


def text(v, n=3):
    return isinstance(v, str) and len(v.strip()) >= n


def check_drawing(d, errs):
    did = d.get('id', '?')
    e = lambda m: errs.append('rysunek %s: %s' % (did, m))
    if not text(d.get('title')):
        e('brak title')
    if not text(d.get('scale'), 3):
        e('brak scale')
    size = d.get('size')
    if not pt(size) or size[0] <= 0 or size[1] <= 0:
        e('size ma być [szerokość, wysokość] w metrach')
        return
    pad = d.get('pad', [3, 3, 3, 3])
    lo, hi = (-pad[0], -pad[1]), (size[0] + pad[2], size[1] + pad[3])

    def inside(p, what):
        if not pt(p):
            e('%s: punkt ma być [x, y]' % what)
        elif not (lo[0] - 0.01 <= p[0] <= hi[0] + 0.01 and lo[1] - 0.01 <= p[1] <= hi[1] + 0.01):
            e('%s: punkt %s poza arkuszem' % (what, p))

    items = d.get('items') or []
    if len(items) < 8:
        e('za mało elementów rysunku (%d)' % len(items))
    for i, it in enumerate(items):
        t = it.get('t')
        what = '%s nr %d' % (t, i + 1)
        if t not in ITEM:
            e('nieznany rodzaj elementu: %r (nr %d)' % (t, i + 1))
            continue
        for f in ITEM[t]:
            if f not in it:
                e('%s: brak pola %s' % (what, f))
        for f in ('at', 'a', 'b'):
            if f in it:
                inside(it[f], what)
        if 'pts' in it:
            if not isinstance(it['pts'], list) or len(it['pts']) < 2:
                e('%s: pts ma mieć co najmniej 2 punkty' % what)
            else:
                for p in it['pts']:
                    inside(p, what)
        if 'rect' in it:
            r = it['rect']
            if not (isinstance(r, list) and len(r) == 4 and all(num(x) for x in r) and r[2] > 0 and r[3] > 0):
                e('%s: rect ma być [x, y, szerokość, wysokość]' % what)
            else:
                inside([r[0], r[1]], what)
                inside([r[0] + r[2], r[1] + r[3]], what)
        if t == 'sym' and it.get('k') not in SYMS:
            e('%s: nieznany symbol %r (dozwolone: %s)' % (what, it.get('k'), ', '.join(sorted(SYMS))))
        if t in ('rect', 'poly') and it.get('k') not in AREAS:
            e('%s: nieznany rodzaj powierzchni %r (dozwolone: %s)' % (what, it.get('k'), ', '.join(sorted(AREAS))))
        if t in ('door', 'window') and it.get('dir', 'h') not in ('h', 'v'):
            e('%s: dir ma być "h" albo "v"' % what)
        if t == 'door':
            op, dr = it.get('open'), it.get('dir', 'h')
            if (dr == 'h' and op not in ('n', 's')) or (dr == 'v' and op not in ('e', 'w')):
                e('%s: open ma być n/s dla ściany poziomej (dir h) albo e/w dla pionowej (dir v)' % what)
        if t == 'wall' and it.get('k', 'int') not in ('ext', 'int', 'fire'):
            e('%s: k ma być ext, int albo fire' % what)


def check(c):
    errs = []
    e = errs.append
    if not re.fullmatch(r'K\d\d', str(c.get('id', ''))):
        e('id ma mieć postać K01')
    for f, n in (('title', 5), ('lead', 20), ('problem', 80), ('summary', 80)):
        if not text(c.get(f), n):
            e('brak albo za krótkie pole %s' % f)
    if not isinstance(c.get('tags'), list) or not c['tags']:
        e('brak tags')
    if c.get('level') not in (1, 2, 3):
        e('level ma być 1, 2 albo 3')
    doc = c.get('doc') or {}
    if not text(doc.get('title'), 5):
        e('doc.title')
    secs = doc.get('sections') or []
    if len(secs) < 5:
        e('doc.sections: co najmniej 5 punktów opisu')
    for s in secs:
        if not text(s.get('h')) or not (text(s.get('text'), 10) or s.get('table')):
            e('doc.sections: punkt bez nagłówka albo treści: %r' % s.get('h'))
        if s.get('table') and not (isinstance(s['table'].get('rows'), list) and s['table']['rows']):
            e('doc.sections: tabela bez wierszy w punkcie %r' % s.get('h'))
    draws = c.get('drawings') or []
    if not draws:
        e('brak rysunków')
    ids = [d.get('id') for d in draws]
    if len(set(ids)) != len(ids):
        e('powtórzone id rysunków')
    for d in draws:
        check_drawing(d, errs)
    qs = c.get('questions') or []
    if len(qs) < 5:
        e('co najmniej 5 pytań komisji')
    seen = set()
    for q in qs:
        qid = q.get('id')
        if not qid or qid in seen:
            e('pytanie bez id albo z powtórzonym id: %r' % qid)
        seen.add(qid)
        if not text(q.get('q'), 20):
            e('pytanie %s: brak treści' % qid)
        if q.get('kind') not in QKINDS:
            e('pytanie %s: kind ma być jednym z %s' % (qid, ', '.join(sorted(QKINDS))))
        pts_ = q.get('points') or []
        if len(pts_) < 2:
            e('pytanie %s: co najmniej 2 punkty odpowiedzi' % qid)
        for p in pts_:
            if not isinstance(p, dict) or not text(p.get('t'), 15):
                e('pytanie %s: punkt odpowiedzi ma być obiektem {t, basis}' % qid)
    if not any(q.get('kind') in ('zamienne', 'ekspertyza', 'procedura') for q in qs):
        e('co najmniej jedno pytanie o tryb postępowania, rozwiązania zamienne albo ekspertyzę')
    fs = c.get('findings') or []
    issues = [f for f in fs if f.get('kind') != 'poprawne']
    if len(issues) < 6:
        e('co najmniej 6 usterek lub braków (jest %d)' % len(issues))
    if len(fs) - len(issues) < 1:
        e('co najmniej jedna pozycja „poprawne” (rozwiązanie zgodne, które wygląda podejrzanie)')
    seen = set()
    sizes = {d.get('id'): d.get('size') for d in draws}
    for f in fs:
        fid = f.get('id')
        if not fid or fid in seen:
            e('pozycja klucza bez id albo z powtórzonym id: %r' % fid)
        seen.add(fid)
        if f.get('kind') not in KINDS:
            e('%s: kind ma być jednym z %s' % (fid, ', '.join(sorted(KINDS))))
        for k, n in (('title', 8), ('where', 4), ('is', 10), ('should', 20)):
            if not text(f.get(k), n):
                e('%s: brak albo za krótkie pole %s' % (fid, k))
        if not text(f.get('basis'), 4) or not BASIS.search(f.get('basis', '')):
            e('%s: basis musi wskazywać jednostkę redakcyjną (§, art., pkt, norma)' % fid)
        if f.get('weight') not in (1, 2, 3):
            e('%s: weight ma być 1, 2 albo 3' % fid)
        if f.get('quote') and len(f['quote']) > 260:
            e('%s: cytat dłuższy niż 260 znaków' % fid)
        m = f.get('marker')
        if m:
            if m.get('d') not in sizes:
                e('%s: znacznik wskazuje nieistniejący rysunek %r' % (fid, m.get('d')))
            elif not pt(m.get('at')) or not (0 <= m['at'][0] <= sizes[m['d']][0] and 0 <= m['at'][1] <= sizes[m['d']][1]):
                e('%s: znacznik poza rysunkiem' % fid)
    if sum(1 for f in fs if f.get('marker')) < 3:
        e('co najmniej 3 pozycje klucza muszą mieć znacznik na rysunku')
    blob = json.dumps(c, ensure_ascii=False)
    for bad in ('TODO', 'lorem', 'XXX'):
        if bad in blob:
            e('tekst roboczy w pliku: %s' % bad)
    return errs


if __name__ == '__main__':
    bad = 0
    for fn in sys.argv[1:]:
        errs = check(json.load(open(fn, encoding='utf-8')))
        print(fn, 'ok' if not errs else '\n  ' + '\n  '.join(errs))
        bad += bool(errs)
    sys.exit(1 if bad else 0)
