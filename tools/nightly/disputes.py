#!/usr/bin/env python3
"""Pytania sporne między ekspertami A i B jednej części (ta sama reguła co w verify-block.js) — do ręcznego
uruchamiania etapów, gdy narzędzie Workflow jest niedostępne (zob. tools/nightly/prompts.js).

Użycie: disputes.py <blok> <część> <plik wynikowy JSON>
Zapisuje {"ids": [...], "why": "id → powód; …"} (wejście dla `prompts.js … judge`) i wypisuje liczby.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'content', 'key', 'raw')


def load(prefix, bid, part):
    fn = os.path.join(RAW, '%s_%s_%s.json' % (prefix, bid, part))
    if not os.path.exists(fn):
        return {}
    return {o['id']: o for o in json.load(open(fn, encoding='utf-8')) if isinstance(o, dict) and o.get('ans') in ('a', 'b', 'c')}


def main():
    bid, part, out = sys.argv[1:4]
    A, B = load('A', bid, part), load('B', bid, part)
    ids, why = [], []
    for i in sorted(set(A) | set(B)):
        a, b = A.get(i), B.get(i)
        reason = None
        if not a or not b:
            reason = 'odpowiedział tylko %s (%s), drugi uznał pytanie za spoza bloku lub nie skończył' % ('A' if a else 'B', (a or b)['ans'])
        elif a['ans'] != b['ans']:
            reason = 'A=%s, B=%s' % (a['ans'], b['ans'])
        elif (a.get('ansNow') or '=') != (b.get('ansNow') or '='):
            reason = 'zgodni co do %s, różnią się co do stanu dzisiejszego (A: %s, B: %s)' % (a['ans'], a.get('ansNow'), b.get('ansNow'))
        elif a.get('conf') == 'niska' and b.get('conf') == 'niska':
            reason = 'obaj %s, obaj z niską pewnością' % a['ans']
        if reason:
            ids.append(i)
            why.append('%d → %s' % (i, reason))
    json.dump({'ids': ids, 'why': '; '.join(why)}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print('A: %d, B: %d, wspólnych id: %d, spornych: %d' % (len(A), len(B), len(set(A) | set(B)), len(ids)))
    for w in why:
        print('  ' + w)


if __name__ == '__main__':
    main()
