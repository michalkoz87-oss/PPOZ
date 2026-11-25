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
    print(json.dumps(dict(root=ROOT, block=bid, name=b['name'], parts=parts, sources=b['sources'], lessons=b.get('lessons', [])), ensure_ascii=False))
    print('pytań: %d | części: %d' % (len(sel), len(parts)), file=sys.stderr)


if __name__ == '__main__':
    main()
