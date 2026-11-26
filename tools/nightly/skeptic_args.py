#!/usr/bin/env python3
"""Argumenty dla samego etapu sceptyka (verify-block.js z skepticOnly) dla bloku już zweryfikowanego.

Użycie: skeptic_args.py <id bloku>
Bierze istniejące części .work/blocks/<id>/part_NN.json (te same, na których pracowali A, B i J; select_block.py
ich nie nadpisuje, dopóki go nie uruchomisz dla tego bloku) i wyniki content/key/raw/{A,B,J}_<id>_NN.json,
układa obecny klucz każdej części (id → odpowiedź i jej pochodzenie) i wypisuje JSON argumentów.
Części, dla których jest już S_<id>_NN.json, pomija.
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from select_block import block_sources  # noqa: E402

RAW = os.path.join(ROOT, 'content', 'key', 'raw')


def answers(prefix, bid, part):
    fn = os.path.join(RAW, '%s_%s_%s.json' % (prefix, bid, part))
    if not os.path.exists(fn):
        return {}
    return {o['id']: o for o in json.load(open(fn, encoding='utf-8')) if isinstance(o, dict) and o.get('ans') in ('a', 'b', 'c')}


def main():
    bid = sys.argv[1]
    b = [x for x in json.load(open(os.path.join(ROOT, 'tools', 'nightly', 'blocks.json'), encoding='utf-8')) if x['id'] == bid][0]
    parts, cur, skipped = [], {}, []
    for fn in sorted(glob.glob(os.path.join(ROOT, '.work', 'blocks', bid, 'part_*.json'))):
        part = os.path.basename(fn)[5:-5]
        if os.path.exists(os.path.join(RAW, 'S_%s_%s.json' % (bid, part))):
            skipped.append(part)
            continue
        A, B, J = (answers(p, bid, part) for p in 'ABJ')
        rows = []
        for q in json.load(open(fn, encoding='utf-8')):
            i, a, bb, j = q['id'], A.get(q['id']), B.get(q['id']), J.get(q['id'])
            if j:
                rows.append('%d → %s (J)' % (i, j['ans']))
            elif a and bb and a['ans'] == bb['ans']:
                rows.append('%d → %s (A i B zgodni)' % (i, a['ans']))
            elif a and bb:
                rows.append('%d → sporne A=%s, B=%s (arbiter nie rozstrzygnął)' % (i, a['ans'], bb['ans']))
            elif a or bb:
                rows.append('%d → %s (tylko %s)' % (i, (a or bb)['ans'], 'A' if a else 'B'))
        if rows:
            parts.append(part)
            cur[part] = '; '.join(rows)
    sources, missing = block_sources(b)
    print(json.dumps(dict(root=ROOT, block=bid, name=b['name'], parts=parts, sources=sources, lessons=[],
                          skepticOnly=True, cur=cur), ensure_ascii=False))
    print('części: %s | pominięte (jest już S_): %s | norm w źródłach: %d' % (parts, skipped, len(sources) - len(b['sources'])),
          file=sys.stderr)
    for n in missing:
        print('brak tekstu normy: %s (%s; %s)' % (n['norm'], n['via'], n['id']), file=sys.stderr)


if __name__ == '__main__':
    main()
