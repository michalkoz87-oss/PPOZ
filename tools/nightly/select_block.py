#!/usr/bin/env python3
"""Wybiera pytania do nocnej weryfikacji jednego bloku i dzieli je na części.

Użycie: select_block.py <id bloku z blocks.json> [rozmiar części, domyślnie 30]
Pomija pytania, które mają już odpowiedź potwierdzoną w źródłach (verif = 'źródła').
Zapisuje części w .work/blocks/<id>/part_NN.json i wypisuje argumenty dla przebiegu verify-block.js.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from build_data import rough_topic  # noqa: E402


def main():
    bid = sys.argv[1]
    size = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    blocks = json.load(open(os.path.join(ROOT, 'tools', 'nightly', 'blocks.json'), encoding='utf-8'))
    b = [x for x in blocks if x['id'] == bid][0]
    qs = json.load(open(os.path.join(ROOT, 'content', 'questions.json'), encoding='utf-8'))
    fp = os.path.join(ROOT, 'content', 'key', 'final.json')
    final = json.load(open(fp, encoding='utf-8')) if os.path.exists(fp) else {}
    rx = re.compile(b['rx'], re.I) if b.get('rx') else None
    sel = []
    for q in qs:
        k = final.get(str(q['id']))
        if k and k.get('verif') == 'źródła':
            continue
        topic = k['topic'] if k else rough_topic(q)
        text = ' '.join((q['q'], q['a'], q['b'], q['c']))
        if topic in b['topics'] or (rx and rx.search(text)):
            sel.append(q)
    n = max(1, -(-len(sel) // size))
    per = -(-len(sel) // n) if sel else 0
    out = os.path.join(ROOT, '.work', 'blocks', bid)
    os.makedirs(out, exist_ok=True)
    parts = []
    for i in range(n):
        chunk = sel[i * per:(i + 1) * per]
        if not chunk:
            continue
        name = '%02d' % (i + 1)
        with open(os.path.join(out, 'part_%s.json' % name), 'w', encoding='utf-8') as f:
            json.dump([{k: q[k] for k in ('id', 'sheet', 'q', 'a', 'b', 'c')} for q in chunk], f, ensure_ascii=False, indent=1)
        parts.append(name)
    for fn in os.listdir(out):  # części z wcześniejszego podziału tego bloku (autor lekcji czyta part_*.json)
        if re.fullmatch(r'part_\d+\.json', fn) and fn[5:-5] not in parts:
            os.remove(os.path.join(out, fn))
    sources, missing = block_sources(b)
    print(json.dumps(dict(root=ROOT, block=bid, name=b['name'], parts=parts, sources=sources, lessons=b.get('lessons', [])), ensure_ascii=False))
    print('pytań: %d | części: %d | norm w źródłach: %d' % (len(sel), len(parts), len(sources) - len(b['sources'])), file=sys.stderr)
    for n in missing:
        print('brak tekstu normy: %s (%s; %s) — patrz README, krok 1' % (n['norm'], n['via'], n['id']), file=sys.stderr)


def block_sources(b):
    """Źródła bloku z blocks.json oraz normy z wykazu, których tekst jest w .work/corpus/normy (i lista brakujących)."""
    bid = b['id']
    sources, missing = list(b['sources']), []
    for n in json.load(open(os.path.join(ROOT, 'tools', 'nightly', 'norms.json'), encoding='utf-8')):
        if bid != 'Z' and bid not in n['blocks']:
            continue
        p = os.path.join(ROOT, '.work', 'corpus', 'normy', n['file'])
        if not os.path.exists(p):
            if bid != 'Z':
                missing.append(n)
            continue
        how = 'CAŁY plik' if os.path.getsize(p) < 45000 else 'grep po słowach z pytania, potem Read właściwego rozdziału'
        sources.append(dict(file='normy/' + n['file'], read='%s; %s — %s; %s' % (how, n['norm'], n['stan'], n.get('uwagi', ''))))
    return sources, missing


if __name__ == '__main__':
    main()
