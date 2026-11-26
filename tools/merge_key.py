#!/usr/bin/env python3
"""Scala wyniki weryfikacji klucza w content/key/final.json.

Użycie: merge_key.py <katalog z plikami wyników>
Pliki wyników (listy obiektów na paczkę pytań):
  A_NN.json, B_NN.json  – dwa niezależne przebiegi z weryfikacją w tekstach przepisów
  J_NN.json             – rozstrzygnięcia arbitra dla pytań spornych
  S_NN.json             – poprawki sceptyka (próba obalenia całego klucza części); mają pierwszeństwo przed A/B/J,
                          ale zmiana odpowiedzi bez cytatu i pewności „wysoka” daje pytanie sporne (alt = odpowiedź A/B/J)
  T_NN.json             – przebieg oszczędny (wiedza + punktowe sprawdzenia)
Stary klucz (z poprzedniej wersji quizu) pochodzi z content/questions.json.

Pole verif w wyniku:
  'źródła'      – odpowiedź sprawdzona w tekście przepisu (przebieg A/B lub arbiter)
  'zgodne'      – dwa niezależne opracowania wskazują tę samą odpowiedź
  'sporne'      – opracowania się różnią (pole alt = druga wskazana odpowiedź)
  'jednokrotne' – jedno opracowanie, bez porównania
"""
import json, os, sys, glob, re, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RANK = {'niska': 0, 'średnia': 1, 'wysoka': 2}
FIELDS = ('ans', 'ansNow', 'conf', 'stan', 'stanNote', 'topic', 'basis', 'quote', 'expl', 'norms')


def load_dir(src, prefix):
    out = {}
    for fn in sorted(glob.glob(os.path.join(src, prefix + '_*.json'))):
        try:
            data = json.load(open(fn, encoding='utf-8'))
        except Exception as e:
            print('pominięto (błędny JSON):', os.path.basename(fn), e)
            continue
        for o in data if isinstance(data, list) else []:
            if isinstance(o, dict) and o.get('ans') in ('a', 'b', 'c') and isinstance(o.get('id'), int):
                out[o['id']] = o
    return out


def clean(o):
    r = {k: o.get(k) for k in FIELDS}
    r['ansNow'] = r['ansNow'] if r['ansNow'] in ('=', 'a', 'b', 'c', 'brak') else '='
    r['conf'] = r['conf'] if r['conf'] in RANK else 'niska'
    r['stan'] = r['stan'] if r['stan'] in ('aktualne', 'zmienione', 'uchylone', 'nieustalone') else 'aktualne'
    for k in ('stanNote', 'basis', 'quote', 'expl'):
        r[k] = (r[k] or '').strip()
    r['topic'] = r['topic'] or 'Z9'
    r['norms'] = [re.sub(r'\s+', ' ', n).strip() for n in (r['norms'] or []) if isinstance(n, str)]
    return r


def main():
    src = sys.argv[1]
    qs = json.load(open(os.path.join(ROOT, 'content', 'questions.json'), encoding='utf-8'))
    A, B, J, T, S = (load_dir(src, p) for p in 'ABJTS')
    final, stats = {}, collections.Counter()
    for q in qs:
        i, old, oldc = q['id'], q.get('oldKey'), q.get('oldConf') or 'niska'
        a, b, j, t, s = A.get(i), B.get(i), J.get(i), T.get(i), S.get(i)
        alt, r, verif = None, None, None
        if j:
            r, verif = clean(j), 'źródła'
        elif a and b:
            if a['ans'] == b['ans']:
                r = clean(a if RANK.get(a.get('conf'), 0) >= RANK.get(b.get('conf'), 0) else b)
                verif = 'źródła'
            else:
                pick, other = (a, b) if RANK.get(a.get('conf'), 0) >= RANK.get(b.get('conf'), 0) else (b, a)
                r, verif, alt = clean(pick), 'sporne', other['ans']
                r['conf'] = 'niska'
        elif a or b:
            g = a or b
            r = clean(g)
            others = [x for x in (t and t['ans'], old) if x]
            if others and all(x != r['ans'] for x in others) and r['conf'] != 'wysoka':
                verif, alt, r['conf'] = 'sporne', others[0], 'niska'
            else:
                verif = 'źródła' if r['quote'] else 'jednokrotne'
        elif t:
            r = clean(t)
            if old and old == r['ans']:
                verif = 'zgodne'
                if r['conf'] != 'wysoka':
                    r['conf'] = 'średnia' if (r['conf'] == 'średnia' or oldc == 'wysoka') else 'niska'
            elif old:
                verif, alt = 'sporne', old
                r['conf'] = 'średnia' if (r['conf'] == 'wysoka' and r['quote']) else 'niska'
            else:
                verif = 'źródła' if (r['conf'] == 'wysoka' and r['quote']) else 'jednokrotne'
        if s:
            rs = clean(s)
            if r is None:
                verif = 'źródła' if (rs['conf'] == 'wysoka' and rs['quote']) else 'jednokrotne'
            elif rs['ans'] != r['ans']:
                stats['sceptyk:zmiana odpowiedzi'] += 1
                if rs['conf'] == 'wysoka' and rs['quote']:
                    verif, alt = 'źródła', None
                else:
                    verif, alt, rs['conf'] = 'sporne', r['ans'], 'niska'
            elif verif in ('sporne', 'jednokrotne') and rs['conf'] == 'wysoka' and rs['quote']:
                verif, alt = 'źródła', None
            stats['sceptyk:poprawki'] += 1
            r = rs
        if r is None:
            continue
        if r['conf'] == 'wysoka' and not r['quote']:
            r['conf'] = 'średnia'
        r['verif'], r['alt'] = verif, alt
        final[i] = r
        stats[verif] += 1
        stats['conf:' + r['conf']] += 1
        stats['stan:' + r['stan']] += 1
    out = os.path.join(ROOT, 'content', 'key', 'final.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({str(k): v for k, v in sorted(final.items())}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('pytań z kluczem:', len(final), 'z', len(qs), '| źródła A/B/J/T/S:', len(A), len(B), len(J), len(T), len(S))
    print(dict(stats))
    print('tematy:', dict(collections.Counter(v['topic'] for v in final.values()).most_common()))


if __name__ == '__main__':
    main()
